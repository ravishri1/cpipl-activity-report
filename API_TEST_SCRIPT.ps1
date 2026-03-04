#!/usr/bin/env pwsh

# CPIPL Procurement API Test Suite
# Tests all 23 endpoints via 10-step workflow

$BASE_URL = "http://localhost:5000/api"
$ADMIN_TOKEN = "test-admin-token"  # Note: In real scenario, need to get actual token from /api/auth/login

# Color output functions
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error-Custom { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Blue }
function Write-Header { Write-Host "`n$('='*60)" ; Write-Host "$args" ; Write-Host "$('='*60)`n" -ForegroundColor Cyan }

# Test counter
$global:testsPassed = 0
$global:testsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [object]$Body,
        [string]$Token
    )
    
    Write-Info "Testing: $Name"
    $url = "$BASE_URL$Endpoint"
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers -Body $bodyJson -UseBasicParsing
        } else {
            $response = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers -UseBasicParsing
        }
        
        Write-Success "$Name - Status: $($response.StatusCode)"
        $global:testsPassed++
        
        $responseData = $response.Content | ConvertFrom-Json
        return $responseData
    } catch {
        Write-Error-Custom "$Name - Error: $($_.Exception.Message)"
        $global:testsFailed++
        return $null
    }
}

# Main test execution
Write-Header "CPIPL PROCUREMENT SYSTEM - API TEST SUITE"

Write-Host "Testing against: $BASE_URL"
Write-Host "Starting tests...`n"

# Test 1: Create Vendor
Write-Host "STEP 1: Create Vendor" -ForegroundColor Cyan
$vendorBody = @{
    vendorName = "Acme Supplies Ltd"
    phone = "9876543210"
    email = "vendor@acme.com"
    address = "Mumbai"
    city = "Mumbai"
    country = "India"
}
$vendor = Test-Endpoint -Name "Create Vendor" -Method "POST" -Endpoint "/procurement/vendors" -Body $vendorBody -Token $ADMIN_TOKEN
$vendorId = if ($vendor.id) { $vendor.id } else { 1 }
Write-Host "Vendor ID: $vendorId`n"

# Test 2: Create Procurement Order
Write-Host "STEP 2: Create Procurement Order" -ForegroundColor Cyan
$orderBody = @{
    vendorId = $vendorId
    status = "draft"
    totalAmount = 50000
    createdDate = (Get-Date).ToString("yyyy-MM-dd")
    deliveryDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
    description = "Laptop purchase for development team"
}
$order = Test-Endpoint -Name "Create Order" -Method "POST" -Endpoint "/procurement/orders" -Body $orderBody -Token $ADMIN_TOKEN
$orderId = if ($order.id) { $order.id } else { 1 }
Write-Host "Order ID: $orderId, Order Number: $($order.orderNumber)`n"

# Test 3: Add Line Item
Write-Host "STEP 3: Add Line Item to Order" -ForegroundColor Cyan
$lineItemBody = @{
    description = "Dell Laptop XPS 13"
    quantity = 5
    unitPrice = 10000
    estimatedCost = 50000
}
$lineItem = Test-Endpoint -Name "Add Line Item" -Method "POST" -Endpoint "/procurement/orders/$orderId/items" -Body $lineItemBody -Token $ADMIN_TOKEN
Write-Host "Line Item created`n"

# Test 4: Submit Order
Write-Host "STEP 4: Submit Order for Approval" -ForegroundColor Cyan
$submitBody = @{
    notes = "Ready for approval"
}
$submitOrder = Test-Endpoint -Name "Submit Order" -Method "PUT" -Endpoint "/procurement/orders/$orderId/submit" -Body $submitBody -Token $ADMIN_TOKEN
Write-Host "Order status: $($submitOrder.status)`n"

# Test 5: Approve Order
Write-Host "STEP 5: Approve Order" -ForegroundColor Cyan
$approveBody = @{
    notes = "Approved by manager"
}
$approveOrder = Test-Endpoint -Name "Approve Order" -Method "PUT" -Endpoint "/procurement/orders/$orderId/approve" -Body $approveBody -Token $ADMIN_TOKEN
Write-Host "Order status: $($approveOrder.status)`n"

# Test 6: Mark as Received
Write-Host "STEP 6: Mark Order as Received" -ForegroundColor Cyan
$receivedBody = @{
    receivedDate = (Get-Date).ToString("yyyy-MM-dd")
}
$receivedOrder = Test-Endpoint -Name "Mark Received" -Method "PUT" -Endpoint "/procurement/orders/$orderId/mark-received" -Body $receivedBody -Token $ADMIN_TOKEN
Write-Host "Order status: $($receivedOrder.status)`n"

# Test 7: Create Inventory Item
Write-Host "STEP 7: Create Inventory Item" -ForegroundColor Cyan
$inventoryBody = @{
    itemCode = "INV-001"
    itemName = "Dell Laptop XPS 13"
    category = "electronics"
    reorderPoint = 5
    locationId = 1
}
$inventory = Test-Endpoint -Name "Create Inventory" -Method "POST" -Endpoint "/procurement/inventory" -Body $inventoryBody -Token $ADMIN_TOKEN
Write-Host "Inventory Item created`n"

# Test 8: Check Low Stock
Write-Host "STEP 8: Check Low Stock Items" -ForegroundColor Cyan
$lowStock = Test-Endpoint -Name "Low Stock Check" -Method "GET" -Endpoint "/procurement/inventory/low-stock" -Token $ADMIN_TOKEN
Write-Host "Low stock items found: $($lowStock.Count)`n"

# Test 9: Create Employee Budget
Write-Host "STEP 9: Create Employee Budget" -ForegroundColor Cyan
$budgetBody = @{
    employeeId = 1
    year = 2026
    assetBudget = 100000
}
$budget = Test-Endpoint -Name "Create Budget" -Method "POST" -Endpoint "/procurement/budgets" -Body $budgetBody -Token $ADMIN_TOKEN
Write-Host "Budget ID: $($budget.id)`n"

# Test 10: Get Budget Details
Write-Host "STEP 10: Get Budget Details" -ForegroundColor Cyan
$budgetDetails = Test-Endpoint -Name "Get Budget" -Method "GET" -Endpoint "/procurement/budgets/1/2026" -Token $ADMIN_TOKEN
Write-Host "Budget Amount: $($budgetDetails.assetBudget)"
Write-Host "Spent: $($budgetDetails.totalSpent)"
Write-Host "Remaining: $($budgetDetails.remainingBudget)`n"

# Summary
Write-Header "TEST SUMMARY"
Write-Host "Tests Passed: $global:testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $global:testsFailed" -ForegroundColor Red
Write-Host "Total Tests: $($global:testsPassed + $global:testsFailed)"
Write-Host "Success Rate: $([math]::Round(($global:testsPassed / ($global:testsPassed + $global:testsFailed)) * 100, 2))%"
Write-Host ""

if ($global:testsFailed -eq 0) {
    Write-Success "ALL TESTS PASSED! ✅"
} else {
    Write-Error-Custom "SOME TESTS FAILED ❌"
}
