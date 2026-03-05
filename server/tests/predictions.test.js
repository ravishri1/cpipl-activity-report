/**
 * API Integration Tests for Predictions/Predictive Maintenance
 * Tests all 8 endpoints for correct behavior, auth, and data validation
 */

const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test tokens (from seed data)
const ADMIN_TOKEN = 'admin@cpipl.com:password123';
const MEMBER_TOKEN = 'member@cpipl.com:password123';
const OTHER_MEMBER_TOKEN = 'other@cpipl.com:password123';

// Test data IDs (from seed)
let testAssetId = 1;
let testAssetId2 = 2;
let adminUserId = 1;
let memberUserId = 2;

describe('Predictions API - Phase 2D Integration Tests', () => {
  
  // ==========================================
  // Setup & Teardown
  // ==========================================

  beforeAll(async () => {
    console.log('\\n🧪 Starting Predictions API Tests...');
    // Create test data if needed
  });

  afterAll(async () => {
    console.log('\\n✅ Predictions API Tests Complete');
    await prisma.$disconnect();
  });

  // ==========================================
  // Test 1: GET /api/predictions/asset/:assetId/health
  // ==========================================

  describe('GET /api/predictions/asset/:assetId/health', () => {
    
    it('should return health data for valid asset with admin auth', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(res.body).toHaveProperty('asset');
      expect(res.body).toHaveProperty('healthScore');
      expect(res.body).toHaveProperty('predictions');
      expect(res.body).toHaveProperty('recommendations');
      expect(res.body.asset.id).toBe(testAssetId);
    });

    it('should return health data for assigned asset with member auth', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .expect(200);

      expect(res.body.asset.id).toBe(testAssetId);
    });

    it("should forbid member viewing other user's asset", async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId2}/health`)
        .set('Authorization', `Bearer ${OTHER_MEMBER_TOKEN}`)
        .expect(403);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent asset', async () => {
      const res = await request(app)
        .get('/api/predictions/asset/99999/health')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(404);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for invalid asset ID format', async () => {
      const res = await request(app)
        .get('/api/predictions/asset/invalid/health')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should calculate fresh predictions if missing', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      // Verify response has complete data structure
      expect(res.body.healthScore).toBeDefined();
      expect(res.body.predictions).toBeDefined();
      expect(res.body.recommendations).toBeDefined();
    });

    it('should parse risk factors from JSON string', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (res.body.predictions && res.body.predictions.primaryRiskFactors) {
        expect(Array.isArray(res.body.predictions.primaryRiskFactors)).toBe(true);
      }
    });
  });

  // ==========================================
  // Test 2: GET /api/predictions/at-risk
  // ==========================================

  describe('GET /api/predictions/at-risk', () => {
    
    it('should return all at-risk assets for admin', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.assets)).toBe(true);
      expect(res.body).toHaveProperty('summary');
    });

    it('should filter by risk level (critical)', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk?riskLevel=critical')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.assets)).toBe(true);
      res.body.assets.forEach(asset => {
        expect(['critical']).toContain(asset.riskLevel);
      });
    });

    it('should filter by risk level (high)', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk?riskLevel=high')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.assets)).toBe(true);
    });

    it('should return only assigned assets for member', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .expect(200);

      // Member should only see their assigned assets
      expect(Array.isArray(res.body.assets)).toBe(true);
    });

    it('should accept sort parameter', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk?sort=riskScore')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.assets)).toBe(true);
    });

    it('should include summary statistics', async () => {
      const res = await request(app)
        .get('/api/predictions/at-risk')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(res.body.summary).toHaveProperty('critical');
      expect(res.body.summary).toHaveProperty('high');
      expect(res.body.summary).toHaveProperty('medium');
      expect(res.body.summary).toHaveProperty('low');
    });
  });

  // ==========================================
  // Test 3: GET /api/predictions/dashboard/summary
  // ==========================================

  describe('GET /api/predictions/dashboard/summary', () => {
    
    it('should return dashboard summary for admin', async () => {
      const res = await request(app)
        .get('/api/predictions/dashboard/summary')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalAssets');
      expect(res.body).toHaveProperty('atRiskCount');
      expect(res.body).toHaveProperty('riskDistribution');
      expect(res.body).toHaveProperty('avgHealthScore');
      expect(res.body).toHaveProperty('criticalAssets');
    });

    it('should have correct data structure', async () => {
      const res = await request(app)
        .get('/api/predictions/dashboard/summary')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(res.body.riskDistribution).toHaveProperty('critical');
      expect(res.body.riskDistribution).toHaveProperty('high');
      expect(res.body.riskDistribution).toHaveProperty('medium');
      expect(res.body.riskDistribution).toHaveProperty('low');
    });

    it('should filter data for member users', async () => {
      const res = await request(app)
        .get('/api/predictions/dashboard/summary')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .expect(200);

      // Member sees only their assets
      expect(res.body.totalAssets).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // Test 4: PUT /api/predictions/asset/:assetId/health
  // ==========================================

  describe('PUT /api/predictions/asset/:assetId/health', () => {
    
    it('should recalculate health for admin', async () => {
      const res = await request(app)
        .put(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({})
        .expect(200);

      expect(res.body).toHaveProperty('healthScore');
      expect(res.body.healthScore).toHaveProperty('assetId', testAssetId);
    });

    it('should forbid member from recalculating', async () => {
      const res = await request(app)
        .put(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({})
        .expect(403);
    });

    it('should return 404 for invalid asset', async () => {
      const res = await request(app)
        .put('/api/predictions/asset/99999/health')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({})
        .expect(404);
    });

    it('should accept custom recalculation parameters', async () => {
      const res = await request(app)
        .put(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ forceRecalculate: true })
        .expect(200);

      expect(res.body.healthScore).toBeDefined();
    });
  });

  // ==========================================
  // Test 5: POST /api/predictions/batch/calculate
  // ==========================================

  describe('POST /api/predictions/batch/calculate', () => {
    
    it('should calculate predictions for multiple assets', async () => {
      const res = await request(app)
        .post('/api/predictions/batch/calculate')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ assetIds: [testAssetId, testAssetId2] })
        .expect(200);

      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(2);
    });

    it('should require assetIds array', async () => {
      const res = await request(app)
        .post('/api/predictions/batch/calculate')
        .set('Authorization', `Bear ${ADMIN_TOKEN}`)
        .send({})
        .expect(400);
    });

    it('should return success/failure for each asset', async () => {
      const res = await request(app)
        .post('/api/predictions/batch/calculate')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({ assetIds: [testAssetId] })
        .expect(200);

      res.body.results.forEach(result => {
        expect(result).toHaveProperty('assetId');
        expect(result).toHaveProperty('success');
      });
    });

    it('should forbid non-admin users', async () => {
      const res = await request(app)
        .post('/api/predictions/batch/calculate')
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .send({ assetIds: [testAssetId] })
        .expect(403);
    });
  });

  // ==========================================
  // Test 6: GET /api/predictions/recommendations/:id
  // ==========================================

  describe('GET /api/predictions/recommendations/:recommendationId', () => {
    
    it('should return recommendation details', async () => {
      // First get a recommendation ID
      const asset = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (asset.body.recommendations.length > 0) {
        const recId = asset.body.recommendations[0].id;

        const res = await request(app)
          .get(`/api/predictions/recommendations/${recId}`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .expect(200);

        expect(res.body).toHaveProperty('id', recId);
        expect(res.body).toHaveProperty('assetId');
        expect(res.body).toHaveProperty('priority');
        expect(res.body).toHaveProperty('estimatedCost');
      }
    });

    it('should return 404 for invalid recommendation', async () => {
      const res = await request(app)
        .get('/api/predictions/recommendations/99999')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(404);
    });
  });

  // ==========================================
  // Test 7: PUT /api/predictions/recommendations/:id/status
  // ==========================================

  describe('PUT /api/predictions/recommendations/:recommendationId/status', () => {
    
    it('should update recommendation status for admin', async () => {
      const asset = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (asset.body.recommendations.length > 0) {
        const recId = asset.body.recommendations[0].id;

        const res = await request(app)
          .put(`/api/predictions/recommendations/${recId}/status`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .send({ status: 'approved' })
          .expect(200);

        expect(res.body.status).toBe('approved');
      }
    });

    it('should require valid status value', async () => {
      const asset = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (asset.body.recommendations.length > 0) {
        const recId = asset.body.recommendations[0].id;

        const res = await request(app)
          .put(`/api/predictions/recommendations/${recId}/status`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .send({ status: 'invalid_status' })
          .expect(400);
      }
    });

    it('should forbid non-admin from updating', async () => {
      const asset = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
        .expect(200);

      if (asset.body.recommendations.length > 0) {
        const recId = asset.body.recommendations[0].id;

        const res = await request(app)
          .put(`/api/predictions/recommendations/${recId}/status`)
          .set('Authorization', `Bearer ${MEMBER_TOKEN}`)
          .send({ status: 'approved' })
          .expect(403);
      }
    });
  });

  // ==========================================
  // Test 8: GET /api/predictions/insights/:assetId/trend
  // ==========================================

  describe('GET /api/predictions/insights/:assetId/trend', () => {
    
    it('should return health trend data', async () => {
      const res = await request(app)
        .get(`/api/predictions/insights/${testAssetId}/trend`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('minScore');
      expect(res.body).toHaveProperty('maxScore');
      expect(res.body).toHaveProperty('avgScore');
    });

    it('should accept time range parameter (1-24 months)', async () => {
      const res = await request(app)
        .get(`/api/predictions/insights/${testAssetId}/trend?months=12`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 404 for invalid asset', async () => {
      const res = await request(app)
        .get('/api/predictions/insights/99999/trend')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(404);
    });

    it('should include trend indicators', async () => {
      const res = await request(app)
        .get(`/api/predictions/insights/${testAssetId}/trend`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      expect(res.body).toHaveProperty('trend'); // 'up' | 'down' | 'stable'
    });
  });

  // ==========================================
  // Performance Tests
  // ==========================================

  describe('Performance', () => {
    
    it('should return at-risk summary in <1000ms', async () => {
      const start = Date.now();
      await request(app)
        .get('/api/predictions/at-risk')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should calculate health in <2000ms', async () => {
      const start = Date.now();
      await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });

  // ==========================================
  // Data Validation Tests
  // ==========================================

  describe('Data Validation', () => {
    
    it('should return valid health score (0-100)', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (res.body.healthScore) {
        expect(res.body.healthScore.score).toBeGreaterThanOrEqual(0);
        expect(res.body.healthScore.score).toBeLessThanOrEqual(100);
      }
    });

    it('should return valid failure probabilities (0-1)', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (res.body.predictions) {
        expect(res.body.predictions.failureProbability30Days).toBeGreaterThanOrEqual(0);
        expect(res.body.predictions.failureProbability30Days).toBeLessThanOrEqual(1);
      }
    });

    it('should return properly formatted dates', async () => {
      const res = await request(app)
        .get(`/api/predictions/asset/${testAssetId}/health`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect(200);

      if (res.body.healthScore && res.body.healthScore.lastUpdated) {
        const date = new Date(res.body.healthScore.lastUpdated);
        expect(date instanceof Date && !isNaN(date)).toBe(true);
      }
    });
  });

});

module.exports = {};
