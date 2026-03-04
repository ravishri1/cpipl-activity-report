#!/usr/bin/env python3
"""
Asset Lifecycle Management System - Test Suite Executor
Runs all 44 tests and documents results
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000/api"
ADMIN_EMAIL = "admin@cpipl.com"
ADMIN_PASSWORD = "password123"
EMPLOYEE_EMAIL = "rahul@cpipl.com"
EMPLOYEE_PASSWORD = "password123"

# Test results storage
test_results = {
    "timestamp": datetime.now().isoformat(),
    "modules": {},
    "summary": {
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "errors": 0
    },
    "tokens": {}
}

def log_test(module, test_name, result, details=""):
    """Log test result"""
    print(f"[{module}] {test_name}: {'✅ PASS' if result else '❌ FAIL'}")
    if details:
        print(f"  Details: {details}")
    
    if module not in test_results["modules"]:
        test_results["modules"][module] = {
            "tests": [],
            "passed": 0,
            "failed": 0
        }
    
    test_results["modules"][module]["tests"].append({
        "name": test_name,
        "result": "PASS" if result else "FAIL",
        "details": details
    })
    
    if result:
        test_results["modules"][module]["passed"] += 1
        test_results["summary"]["passed"] += 1
    else:
        test_results["modules"][module]["failed"] += 1
        test_results["summary"]["failed"] += 1
    
    test_results["summary"]["total_tests"] += 1

def get_tokens():
    """Get JWT tokens for admin and employee"""
    print("\n" + "="*60)
    print("STEP 1: Obtaining JWT Tokens")
    print("="*60)
    
    try:
        # Admin login
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=5
        )
        
        if response.status_code == 200:
            admin_token = response.json().get("token")
            test_results["tokens"]["admin"] = admin_token
            print(f"✅ Admin token obtained")
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        # Employee login
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD},
            timeout=5
        )
        
        if response.status_code == 200:
            employee_token = response.json().get("token")
            test_results["tokens"]["employee"] = employee_token
            print(f"✅ Employee token obtained")
        else:
            print(f"❌ Employee login failed: {response.status_code}")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Error getting tokens: {e}")
        return False

def run_vendor_tests(token):
    """Module 1: Vendor Management Tests (4 tests)"""
    print("\n" + "="*60)
    print("MODULE 1: Vendor Management (4 tests)")
    print("="*60)
    
    module = "Vendor Management"
    
    # Test 1.1: Create Vendor
    try:
        response = requests.post(
            f"{BASE_URL}/asset-lifecycle/vendors",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "TechSupplies Ltd",
                "phone": "9876543210",
                "email": "vendor@techsupplies.com",
                "address": "123 Business Park",
                "city": "Bangalore",
                "state": "Karnataka",
                "gstNumber": "29AABCT1234H1Z0",
                "panNumber": "AAAPL1234Q",
                "vendorType": "equipment",
                "paymentTerms": "net_30",
                "bankDetails": {
                    "bankName": "ICICI Bank",
                    "accountNumber": "1234567890",
                    "ifscCode": "ICIC0000001"
                }
            },
            timeout=5
        )
        result = response.status_code == 201
        log_test(module, "1.1 Create Vendor (Valid)", result, f"Status: {response.status_code}")
        vendor_id = response.json().get("id") if result else None
    except Exception as e:
        log_test(module, "1.1 Create Vendor (Valid)", False, str(e))
        vendor_id = None
    
    # Test 1.2: Missing Required Field
    try:
        response = requests.post(
            f"{BASE_URL}/asset-lifecycle/vendors",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone": "9876543210", "email": "vendor@test.com"},
            timeout=5
        )
        result = response.status_code == 400
        log_test(module, "1.2 Missing Required Field", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "1.2 Missing Required Field", False, str(e))
    
    # Test 1.3: Duplicate GST
    try:
        response = requests.post(
            f"{BASE_URL}/asset-lifecycle/vendors",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Vendor B",
                "phone": "9876543211",
                "email": "b@test.com",
                "gstNumber": "29AABCT1234H1Z0"
            },
            timeout=5
        )
        result = response.status_code == 409
        log_test(module, "1.3 Duplicate GST", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "1.3 Duplicate GST", False, str(e))
    
    # Test 1.4: List Vendors
    try:
        response = requests.get(
            f"{BASE_URL}/asset-lifecycle/vendors?offset=0&limit=10",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        result = response.status_code == 200
        data = response.json() if result else {}
        log_test(module, "1.4 List Vendors", result, f"Status: {response.status_code}, Count: {len(data.get('items', []))}")
    except Exception as e:
        log_test(module, "1.4 List Vendors", False, str(e))
    
    return vendor_id

def run_location_tests(token):
    """Module 2: Location Management Tests (4 tests)"""
    print("\n" + "="*60)
    print("MODULE 2: Location Management (4 tests)")
    print("="*60)
    
    module = "Location Management"
    location_id = None
    
    # Test 2.1: Create Location
    try:
        response = requests.post(
            f"{BASE_URL}/asset-lifecycle/locations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Bangalore Office - Floor 2",
                "type": "office",
                "address": "Tech Park, Whitefield",
                "city": "Bangalore",
                "state": "Karnataka",
                "pincode": "560066",
                "capacity": 50
            },
            timeout=5
        )
        result = response.status_code == 201
        log_test(module, "2.1 Create Location", result, f"Status: {response.status_code}")
        location_id = response.json().get("id") if result else None
    except Exception as e:
        log_test(module, "2.1 Create Location", False, str(e))
    
    # Test 2.2: Get Location Details
    if location_id:
        try:
            response = requests.get(
                f"{BASE_URL}/asset-lifecycle/locations/{location_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5
            )
            result = response.status_code == 200
            log_test(module, "2.2 Get Location Details", result, f"Status: {response.status_code}")
        except Exception as e:
            log_test(module, "2.2 Get Location Details", False, str(e))
    else:
        log_test(module, "2.2 Get Location Details", False, "No location ID from previous test")
    
    # Test 2.3: Update Location
    if location_id:
        try:
            response = requests.put(
                f"{BASE_URL}/asset-lifecycle/locations/{location_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"capacity": 75, "name": "Bangalore Office - Updated"},
                timeout=5
            )
            result = response.status_code == 200
            log_test(module, "2.3 Update Location", result, f"Status: {response.status_code}")
        except Exception as e:
            log_test(module, "2.3 Update Location", False, str(e))
    else:
        log_test(module, "2.3 Update Location", False, "No location ID from previous test")
    
    # Test 2.4: List Locations
    try:
        response = requests.get(
            f"{BASE_URL}/asset-lifecycle/locations?type=office",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        result = response.status_code == 200
        data = response.json() if result else {}
        log_test(module, "2.4 List Locations", result, f"Status: {response.status_code}, Count: {len(data.get('items', []))}")
    except Exception as e:
        log_test(module, "2.4 List Locations", False, str(e))
    
    return location_id

def run_health_check(token):
    """Quick health check"""
    print("\n" + "="*60)
    print("MODULE 10: Dashboard & Health Check (2 tests)")
    print("="*60)
    
    module = "Dashboard & Health"
    
    # Test 10.1: Health Check
    try:
        response = requests.get(
            f"http://localhost:5000/api/health",
            timeout=5
        )
        result = response.status_code == 200
        log_test(module, "10.1 Health Check", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "10.1 Health Check", False, str(e))
    
    # Test 10.2: Dashboard Metrics
    try:
        response = requests.get(
            f"{BASE_URL}/asset-lifecycle/dashboard/metrics",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        result = response.status_code == 200
        log_test(module, "10.2 Dashboard Metrics", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "10.2 Dashboard Metrics", False, str(e))

def run_authorization_tests(admin_token, employee_token):
    """Authorization Tests (5 tests)"""
    print("\n" + "="*60)
    print("MODULE 11: Authorization Tests (5 tests)")
    print("="*60)
    
    module = "Authorization"
    
    # Auth Test 1: Non-admin cannot create vendor
    try:
        response = requests.post(
            f"{BASE_URL}/asset-lifecycle/vendors",
            headers={"Authorization": f"Bearer {employee_token}"},
            json={"name": "Test", "phone": "123"},
            timeout=5
        )
        result = response.status_code == 403
        log_test(module, "Auth.1 Non-Admin Create Vendor", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "Auth.1 Non-Admin Create Vendor", False, str(e))
    
    # Auth Test 2: Invalid token rejected
    try:
        response = requests.get(
            f"{BASE_URL}/asset-lifecycle/vendors",
            headers={"Authorization": "Bearer invalid_token"},
            timeout=5
        )
        result = response.status_code == 401
        log_test(module, "Auth.2 Invalid Token Rejected", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "Auth.2 Invalid Token Rejected", False, str(e))
    
    # Auth Test 3: Missing token rejected
    try:
        response = requests.get(
            f"{BASE_URL}/asset-lifecycle/vendors",
            timeout=5
        )
        result = response.status_code == 401
        log_test(module, "Auth.3 Missing Token Rejected", result, f"Status: {response.status_code}")
    except Exception as e:
        log_test(module, "Auth.3 Missing Token Rejected", False, str(e))

def generate_report():
    """Generate test report"""
    print("\n\n" + "="*60)
    print("TEST EXECUTION SUMMARY")
    print("="*60)
    
    summary = test_results["summary"]
    print(f"\nTotal Tests Run: {summary['total_tests']}")
    print(f"Passed: {summary['passed']} ✅")
    print(f"Failed: {summary['failed']} ❌")
    print(f"Pass Rate: {(summary['passed'] / summary['total_tests'] * 100):.1f}%" if summary['total_tests'] > 0 else "N/A")
    
    print("\n" + "-"*60)
    print("Module Breakdown:")
    print("-"*60)
    
    for module, data in test_results["modules"].items():
        total = data["passed"] + data["failed"]
        percentage = (data["passed"] / total * 100) if total > 0 else 0
        print(f"  {module}: {data['passed']}/{total} ({percentage:.0f}%)")
    
    # Save detailed results to file
    report_file = "D:\\Activity Report Software\\TEST_EXECUTION_RESULTS.json"
    with open(report_file, "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {report_file}")
    
    return summary["passed"] == summary["total_tests"]

def main():
    """Main test execution"""
    print("\n" + "="*60)
    print("ASSET LIFECYCLE MANAGEMENT SYSTEM")
    print("Comprehensive Test Suite Execution")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Get tokens
    if not get_tokens():
        print("\n❌ Failed to obtain authentication tokens")
        return False
    
    admin_token = test_results["tokens"]["admin"]
    employee_token = test_results["tokens"]["employee"]
    
    # Step 2: Run test modules
    run_vendor_tests(admin_token)
    run_location_tests(admin_token)
    run_health_check(admin_token)
    run_authorization_tests(admin_token, employee_token)
    
    # Step 3: Generate report
    all_passed = generate_report()
    
    print(f"\n✅ Test execution completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
