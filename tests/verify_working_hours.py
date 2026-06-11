import urllib.request
import urllib.error
import json
import time
import sys
import uuid

def make_request(url, method, data=None, token=None):
    req = urllib.request.Request(url, method=method)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    if data is not None:
        req.add_header("Content-Type", "application/json")
        jsondata = json.dumps(data).encode("utf-8")
        try:
            with urllib.request.urlopen(req, data=jsondata) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode("utf-8"))
            except Exception:
                return e.code, {"error": e.reason}
        except Exception as e:
            return 500, {"error": str(e)}
    else:
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode("utf-8"))
            except Exception:
                return e.code, {"error": e.reason}
        except Exception as e:
            return 500, {"error": str(e)}

def main():
    print("Polling backend health endpoint...")
    backend_ready = False
    for i in range(15):
        try:
            with urllib.request.urlopen("http://localhost:5000/health", timeout=2) as response:
                if response.status == 200:
                    backend_ready = True
                    print(f"Backend settled in {i} seconds.")
                    break
        except Exception:
            pass
        time.sleep(1)
        
    if not backend_ready:
        print("FAIL: Backend did not settle within 15 seconds.")
        sys.exit(1)
        
    auth_url = "http://localhost:5000/api/auth"
    hours_url = "http://localhost:5000/api/working-hours"
    
    # Generate unique credentials for repeatable state
    suffix_c = str(uuid.uuid4())[:8]
    suffix_a = str(uuid.uuid4())[:8]
    
    user_client = f"client_wh_{suffix_c}"
    email_client = f"client_wh_{suffix_c}@example.com"
    
    user_admin = f"admin_wh_{suffix_a}"
    email_admin = f"admin_wh_{suffix_a}@example.com"
    
    password = "testpassword"

    # 1. Login/Register Client
    try:
        make_request(f"{auth_url}/register", "POST", {
            "username": user_client, "password": password, "name": "Client User", "email": email_client, "phone": "111-111-1111"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_client, "password": password
        })
        client_token = res["token"]
        print(f"PASS: Client setup complete ({user_client}).")
    except Exception as e:
        print(f"FAIL: Client setup failed: {e}")
        sys.exit(1)

    # 2. Login/Register Admin
    try:
        make_request(f"{auth_url}/register", "POST", {
            "username": user_admin, "password": password, "name": "Admin User", "email": email_admin, "phone": "222-222-2222", "role": "admin"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_admin, "password": password
        })
        admin_token = res["token"]
        print(f"PASS: Admin setup complete ({user_admin}).")
    except Exception as e:
        print(f"FAIL: Admin setup failed: {e}")
        sys.exit(1)

    # ==========================================
    # TEST 1: Unauthenticated Requests (expect 401)
    # ==========================================
    print("\n1. Testing Unauthenticated Requests...")
    code, res = make_request(hours_url, "GET")
    print(f"  GET hours no token: {code}")
    assert code == 401
    
    code, res = make_request(f"{hours_url}/admin", "POST", {"date": "2026-06-20", "startTime": "09:00:00", "endTime": "17:00:00"})
    print(f"  POST hours no token: {code}")
    assert code == 401
    print("PASS: Unauthenticated requests blocked with 401.")

    # ==========================================
    # TEST 2: Time and Date Validations (expect 400)
    # ==========================================
    print("\n2. Testing Time/Date Validations (expect 400)...")
    # EndTime before StartTime
    code, res = make_request(f"{hours_url}/admin", "POST", {
        "date": "2026-06-20", "startTime": "17:00:00", "endTime": "09:00:00"
    }, admin_token)
    print(f"  POST endTime < startTime: {code} ({res.get('error')})")
    assert code == 400
    assert "strictly before" in res.get("error", "").lower()

    # Past date
    code, res = make_request(f"{hours_url}/admin", "POST", {
        "date": "2020-01-01", "startTime": "09:00:00", "endTime": "17:00:00"
    }, admin_token)
    print(f"  POST past date: {code} ({res.get('error')})")
    assert code == 400
    assert "past date" in res.get("error", "").lower()
    print("PASS: Validation blocks invalid hours/past dates.")

    # ==========================================
    # TEST 3: Add Working Hours (Happy Path) (expect 201)
    # ==========================================
    print("\n3. Testing Set Working Hours (Happy Path)...")
    # Fetch initial count first
    code, res = make_request(hours_url, "GET", token=client_token)
    initial_count = len(res["workingHours"])
    
    code, res = make_request(f"{hours_url}/admin", "POST", {
        "date": "2026-06-20", "startTime": "09:00:00", "endTime": "17:00:00"
    }, admin_token)
    print(f"  POST hours status: {code}")
    assert code == 201
    slot_id_1 = res["slotId"]
    assert slot_id_1 is not None
    print(f"PASS: Working hours set successfully. ID: {slot_id_1}")

    # ==========================================
    # TEST 4: Overlap / Conflict Test (expect 409)
    # ==========================================
    print("\n4. Testing Duplicate Date Conflict (expect 409)...")
    code, res = make_request(f"{hours_url}/admin", "POST", {
        "date": "2026-06-20", "startTime": "10:00:00", "endTime": "18:00:00"
    }, admin_token)
    print(f"  POST duplicate date: {code} ({res.get('error')})")
    assert code == 409
    print("PASS: Overlap/conflict blocked with 409.")

    # ==========================================
    # TEST 5: Verify List and Count Incrementation
    # ==========================================
    print("\n5. Testing List Count Increment...")
    code, res = make_request(hours_url, "GET", token=client_token)
    current_list = res["workingHours"]
    print(f"  Current hours count: {len(current_list)}")
    assert len(current_list) == initial_count + 1
    matching = [h for h in current_list if h["id"] == slot_id_1]
    assert len(matching) == 1
    assert matching[0]["start_time"] == "09:00:00"
    print("PASS: Verified schedule count and details.")

    # ==========================================
    # TEST 6: Update Working Hours (PUT) (expect 200)
    # ==========================================
    print("\n6. Testing Update Working Hours (PUT)...")
    code, res = make_request(f"{hours_url}/admin/{slot_id_1}", "PUT", {
        "date": "2026-06-20", "startTime": "08:00:00", "endTime": "16:00:00"
    }, admin_token)
    print(f"  PUT update status: {code}")
    assert code == 200
    assert res.get("message") == "Working hours updated successfully"
    
    # Verify change
    code, res = make_request(f"{hours_url}/2026-06-20", "GET", token=client_token)
    assert res["workingHours"]["start_time"] == "08:00:00"
    print("PASS: Update working hours works.")

    # ==========================================
    # TEST 7: Update Duplicate Date Conflict (expect 409)
    # ==========================================
    print("\n7. Testing Update Duplicate Date Conflict (expect 409)...")
    # Add a second slot
    code, res = make_request(f"{hours_url}/admin", "POST", {
        "date": "2026-06-21", "startTime": "09:00:00", "endTime": "17:00:00"
    }, admin_token)
    slot_id_2 = res["slotId"]
    
    # Attempt to update first slot to use second slot's date
    code, res = make_request(f"{hours_url}/admin/{slot_id_1}", "PUT", {
        "date": "2026-06-21", "startTime": "08:00:00", "endTime": "16:00:00"
    }, admin_token)
    print(f"  PUT duplicate date: {code} ({res.get('error')})")
    assert code == 409
    print("PASS: Update collision blocked with 409.")

    # ==========================================
    # TEST 8: Client Access Boundaries (expect 403)
    # ==========================================
    print("\n8. Testing Client Access Boundaries (expect 403)...")
    # Client tries to update
    code, res = make_request(f"{hours_url}/admin/{slot_id_1}", "PUT", {
        "date": "2026-06-20", "startTime": "08:00:00", "endTime": "16:00:00"
    }, client_token)
    print(f"  Client PUT status: {code}")
    assert code == 403
    
    # Client tries to delete
    code, res = make_request(f"{hours_url}/admin/{slot_id_1}", "DELETE", token=client_token)
    print(f"  Client DELETE status: {code}")
    assert code == 403
    print("PASS: Client access boundaries enforced.")

    # ==========================================
    # TEST 9: Delete and Cleanup
    # ==========================================
    print("\n9. Cleaning up slots (DELETE)...")
    code, res = make_request(f"{hours_url}/admin/{slot_id_1}", "DELETE", token=admin_token)
    assert code == 200
    code, res = make_request(f"{hours_url}/admin/{slot_id_2}", "DELETE", token=admin_token)
    assert code == 200
    
    # Verify final list size matches initial_count
    code, res = make_request(hours_url, "GET", token=client_token)
    print(f"  Final count: {len(res['workingHours'])} (expected {initial_count})")
    assert len(res["workingHours"]) == initial_count
    print("PASS: Cleanup complete.")

    print("\n=== ALL WORKING HOURS ENDPOINTS & BOUNDARIES VERIFIED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
