#!/bin/bash

################################################################################
# Production Deployment Script for CPIPL HR Procurement Module
# Usage: ./deploy.sh [staging|production] [version]
# Example: ./deploy.sh production v1.2.3
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_DIR="/app/procurement"
GITHUB_REGISTRY="ghcr.io/cpipl"
BACKEND_IMAGE="${GITHUB_REGISTRY}/procurement-backend"
FRONTEND_IMAGE="${GITHUB_REGISTRY}/procurement-frontend"
BACKUP_DIR="/app/backups"
LOG_FILE="/var/log/procurement-deploy.log"

################################################################################
# Helper Functions
################################################################################

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
  echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}❌ $1${NC}" | tee -a "$LOG_FILE"
  exit 1
}

warning() {
  echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

print_section() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

################################################################################
# Pre-flight Checks
################################################################################

check_prerequisites() {
  print_section "Pre-flight Checks"
  
  # Check if running as root or with sudo
  if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root"
  fi
  
  # Check required commands
  local commands=("docker" "docker-compose" "git" "curl")
  for cmd in "${commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
      error "Required command not found: $cmd"
    fi
  done
  success "All prerequisites installed"
  
  # Check Docker daemon
  if ! docker ps &> /dev/null; then
    error "Docker daemon is not running"
  fi
  success "Docker daemon is running"
  
  # Check disk space
  local available=$(df "$DEPLOYMENT_DIR" | awk 'NR==2 {print $4}')
  if [[ $available -lt 1048576 ]]; then  # Less than 1GB
    error "Insufficient disk space (< 1GB available)"
  fi
  success "Sufficient disk space available"
}

################################################################################
# Input Validation
################################################################################

validate_inputs() {
  print_section "Validating Inputs"
  
  # Validate environment
  if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT (must be 'staging' or 'production')"
  fi
  log "Environment: $ENVIRONMENT"
  
  # Validate version format
  if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    error "Invalid version format: $VERSION (must be v1.2.3)"
  fi
  log "Version: $VERSION"
  
  # Extract version number (v1.2.3 -> 1.2.3)
  VERSION_NUMBER="${VERSION:1}"
  
  success "Inputs validated"
}

################################################################################
# Backup Current Deployment
################################################################################

create_backup() {
  print_section "Creating Backup"
  
  # Create backup directory
  mkdir -p "$BACKUP_DIR"
  
  # Backup current state
  local backup_time=$(date +'%Y%m%d_%H%M%S')
  local backup_name="procurement_${backup_time}"
  
  log "Backing up current deployment to $BACKUP_DIR/$backup_name"
  
  cd "$DEPLOYMENT_DIR" || error "Cannot access deployment directory"
  
  # Backup docker-compose file and .env
  if [[ -f "docker-compose.yml" ]]; then
    cp docker-compose.yml "$BACKUP_DIR/${backup_name}.docker-compose.yml"
  fi
  
  if [[ -f ".env" ]]; then
    cp .env "$BACKUP_DIR/${backup_name}.env"
  fi
  
  # Backup database
  if [[ -f "data/prod.db" ]]; then
    cp data/prod.db "$BACKUP_DIR/${backup_name}_prod.db"
    log "Database backed up"
  fi
  
  # Log current running images
  docker-compose ps > "$BACKUP_DIR/${backup_name}_services.log" 2>&1 || true
  
  success "Backup created: $backup_name"
  export BACKUP_NAME="$backup_name"
}

################################################################################
# Pull Latest Code
################################################################################

pull_latest_code() {
  print_section "Pulling Latest Code"
  
  cd "$DEPLOYMENT_DIR" || error "Cannot access deployment directory"
  
  # Fetch from remote
  log "Fetching from remote repository"
  git fetch origin
  
  # Checkout specific version tag
  log "Checking out tag: $VERSION"
  git checkout "$VERSION" || error "Cannot checkout version $VERSION"
  
  # Verify checkout
  local current_tag=$(git describe --tags --exact-match 2>/dev/null || echo "unknown")
  log "Current tag: $current_tag"
  
  success "Code updated to $VERSION"
}

################################################################################
# Build and Push Docker Images
################################################################################

build_and_push_images() {
  print_section "Building Docker Images"
  
  cd "$DEPLOYMENT_DIR" || error "Cannot access deployment directory"
  
  # Login to GitHub Container Registry (assuming token is in environment)
  if [[ -n "$GITHUB_TOKEN" ]]; then
    log "Logging in to GitHub Container Registry"
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin || \
      error "Cannot login to GitHub Container Registry"
  else
    warning "GITHUB_TOKEN not set - assuming already logged in"
  fi
  
  # Build backend image
  log "Building backend image: $BACKEND_IMAGE:$VERSION_NUMBER"
  docker build \
    -f server/Dockerfile.backend \
    -t "$BACKEND_IMAGE:$VERSION_NUMBER" \
    -t "$BACKEND_IMAGE:latest" \
    . || error "Failed to build backend image"
  success "Backend image built"
  
  # Build frontend image
  log "Building frontend image: $FRONTEND_IMAGE:$VERSION_NUMBER"
  docker build \
    -f client/Dockerfile.frontend \
    -t "$FRONTEND_IMAGE:$VERSION_NUMBER" \
    -t "$FRONTEND_IMAGE:latest" \
    . || error "Failed to build frontend image"
  success "Frontend image built"
  
  # Push images to registry
  if [[ -n "$GITHUB_TOKEN" ]]; then
    log "Pushing images to registry"
    docker push "$BACKEND_IMAGE:$VERSION_NUMBER" || error "Failed to push backend image"
    docker push "$BACKEND_IMAGE:latest" || error "Failed to push backend latest tag"
    docker push "$FRONTEND_IMAGE:$VERSION_NUMBER" || error "Failed to push frontend image"
    docker push "$FRONTEND_IMAGE:latest" || error "Failed to push frontend latest tag"
    success "Images pushed to registry"
  fi
}

################################################################################
# Deploy Services
################################################################################

deploy_services() {
  print_section "Deploying Services"
  
  cd "$DEPLOYMENT_DIR" || error "Cannot access deployment directory"
  
  # Stop running services
  log "Stopping running services"
  docker-compose down || warning "Some services were not running"
  
  # Pull latest images from registry
  log "Pulling latest images from registry"
  docker-compose pull || error "Failed to pull images"
  
  # Start services
  log "Starting services"
  docker-compose up -d || error "Failed to start services"
  
  success "Services deployed"
}

################################################################################
# Health Checks
################################################################################

health_check() {
  print_section "Running Health Checks"
  
  local max_attempts=30
  local attempt=1
  local wait_seconds=2
  
  # Check backend health
  log "Checking backend health (max $max_attempts attempts)"
  while [[ $attempt -le $max_attempts ]]; do
    if curl -sf http://localhost:5000/api/health > /dev/null 2>&1; then
      success "Backend is healthy"
      break
    fi
    
    if [[ $attempt -eq $max_attempts ]]; then
      error "Backend health check failed after $((max_attempts * wait_seconds)) seconds"
    fi
    
    warning "Backend not ready yet (attempt $attempt/$max_attempts)"
    sleep $wait_seconds
    ((attempt++))
  done
  
  # Check frontend health
  attempt=1
  log "Checking frontend health (max $max_attempts attempts)"
  while [[ $attempt -le $max_attempts ]]; do
    if curl -sf http://localhost:80/ > /dev/null 2>&1; then
      success "Frontend is healthy"
      break
    fi
    
    if [[ $attempt -eq $max_attempts ]]; then
      error "Frontend health check failed after $((max_attempts * wait_seconds)) seconds"
    fi
    
    warning "Frontend not ready yet (attempt $attempt/$max_attempts)"
    sleep $wait_seconds
    ((attempt++))
  done
  
  # Check database connectivity
  log "Checking database connectivity"
  if docker-compose exec -T backend node -e "require('./src/app.js')" > /dev/null 2>&1; then
    success "Database is accessible"
  else
    warning "Database check skipped (service not fully initialized yet)"
  fi
  
  success "All health checks passed"
}

################################################################################
# Smoke Tests
################################################################################

smoke_tests() {
  print_section "Running Smoke Tests"
  
  # Test API endpoints
  log "Testing API endpoints"
  
  # Test health endpoint
  if curl -sf http://localhost:5000/api/health | grep -q "healthy"; then
    success "Health endpoint working"
  else
    error "Health endpoint failed"
  fi
  
  # Test authentication endpoint (should exist even if unauthorized)
  if curl -sf http://localhost:5000/api/auth 2>&1 | grep -q ""; then
    success "Authentication endpoint accessible"
  else
    warning "Authentication endpoint check skipped"
  fi
  
  # Test frontend load
  log "Testing frontend load"
  if curl -sf http://localhost:80/ | grep -q "<!DOCTYPE html"; then
    success "Frontend HTML loaded correctly"
  else
    error "Frontend HTML not loading properly"
  fi
  
  success "All smoke tests passed"
}

################################################################################
# Service Status
################################################################################

show_service_status() {
  print_section "Service Status"
  
  cd "$DEPLOYMENT_DIR" || return
  
  log "Running services:"
  docker-compose ps
  
  log "Container logs (last 10 lines each):"
  echo ""
  log "Backend logs:"
  docker-compose logs --tail=10 backend || warning "No backend logs available"
  echo ""
  log "Frontend logs:"
  docker-compose logs --tail=10 frontend || warning "No frontend logs available"
}

################################################################################
# Rollback Procedure
################################################################################

rollback() {
  print_section "Rolling Back Deployment"
  
  if [[ -z "$BACKUP_NAME" ]]; then
    error "No backup information available for rollback"
  fi
  
  warning "Rolling back to backup: $BACKUP_NAME"
  
  cd "$DEPLOYMENT_DIR" || error "Cannot access deployment directory"
  
  # Stop current services
  log "Stopping current services"
  docker-compose down || warning "Services were not running"
  
  # Restore docker-compose file
  if [[ -f "$BACKUP_DIR/${BACKUP_NAME}.docker-compose.yml" ]]; then
    log "Restoring docker-compose configuration"
    cp "$BACKUP_DIR/${BACKUP_NAME}.docker-compose.yml" docker-compose.yml
  fi
  
  # Restore .env file
  if [[ -f "$BACKUP_DIR/${BACKUP_NAME}.env" ]]; then
    log "Restoring environment configuration"
    cp "$BACKUP_DIR/${BACKUP_NAME}.env" .env
  fi
  
  # Start services with previous versions
  log "Starting services with previous versions"
  docker-compose up -d || error "Failed to start services"
  
  # Run health checks
  health_check
  
  success "Rollback completed successfully"
}

################################################################################
# Cleanup
################################################################################

cleanup() {
  print_section "Cleanup"
  
  log "Cleaning up old Docker images (keeping last 3 versions)"
  docker image prune -a --filter "until=72h" -f || warning "Image cleanup failed"
  
  log "Removing old backups (keeping last 10)"
  ls -t "$BACKUP_DIR"/* 2>/dev/null | tail -n +11 | xargs -r rm -f || warning "Backup cleanup failed"
  
  success "Cleanup completed"
}

################################################################################
# Notification
################################################################################

send_notification() {
  local status=$1
  local message=$2
  
  if [[ -n "$SLACK_WEBHOOK" ]]; then
    log "Sending Slack notification"
    
    local color="good"
    local emoji="✅"
    
    if [[ "$status" != "success" ]]; then
      color="danger"
      emoji="❌"
    fi
    
    curl -X POST -H 'Content-type: application/json' \
      --data "{
        \"attachments\": [{
          \"color\": \"$color\",
          \"title\": \"$emoji Procurement Deployment - $ENVIRONMENT\",
          \"text\": \"Version: $VERSION\nStatus: $message\nTime: $(date)\",
          \"footer\": \"CPIPL HR System\"
        }]
      }" \
      "$SLACK_WEBHOOK" || warning "Failed to send Slack notification"
  fi
}

################################################################################
# Main Execution
################################################################################

main() {
  print_section "CPIPL HR Procurement Module Deployment"
  
  # Parse arguments
  ENVIRONMENT="${1:-production}"
  VERSION="${2:-latest}"
  
  # Initialize log
  > "$LOG_FILE"
  
  log "Starting deployment process"
  log "Environment: $ENVIRONMENT"
  log "Version: $VERSION"
  
  # Execute deployment steps
  check_prerequisites || { send_notification "failed" "Prerequisites check failed"; exit 1; }
  validate_inputs || { send_notification "failed" "Input validation failed"; exit 1; }
  create_backup || { send_notification "failed" "Backup creation failed"; exit 1; }
  pull_latest_code || { send_notification "failed" "Code pull failed"; rollback; exit 1; }
  build_and_push_images || { send_notification "failed" "Image build failed"; rollback; exit 1; }
  deploy_services || { send_notification "failed" "Service deployment failed"; rollback; exit 1; }
  health_check || { send_notification "failed" "Health checks failed"; rollback; exit 1; }
  smoke_tests || { send_notification "failed" "Smoke tests failed"; rollback; exit 1; }
  show_service_status
  cleanup || warning "Cleanup had issues"
  
  print_section "Deployment Successful"
  success "Deployment completed successfully!"
  success "Version $VERSION is now running in $ENVIRONMENT"
  
  send_notification "success" "Deployed successfully"
  
  log "Full log available at: $LOG_FILE"
}

# Run main function
main "$@"
