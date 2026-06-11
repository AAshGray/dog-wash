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
    pets_url = "http://localhost:5000/api/pets"
    hours_url = "http://localhost:5000/api/working-hours"
    appt_url = "http://localhost:5000/api/appointments"
    
    # Generate unique test data to ensure repeatable, isolated test runs
    suffix = str(uuid.uuid4())[:8]
    user_client = f"client_appt_{suffix}"
    email_client = f"client_appt_{suffix}@example.com"
    
    user_other = f"client_other_{suffix}"
    email_other = f"client_other_{suffix}@example.com"
    
    user_admin = f"admin_appt_{suffix}"
    email_admin = f"admin_appt_{suffix}@example.com"
    
    password = "testpassword"

    # 1. Setup Client, Admin, and Other User
    try:
        # Register and login primary client
        make_request(f"{auth_url}/register", "POST", {
            "username": user_client, "password": password, "name": "Alice Smith", "email": email_client, "phone": "555-123-4567"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_client, "password": password
        })
        client_token = res["token"]
        
        # Register a pet for primary client
        _, res = make_request(pets_url, "POST", {
            "name": "Buddy", "breed": "Beagle", "age": 2
        }, client_token)
        pet_id = res["petId"]
        
        # Register and login secondary client (for ownership checks)
        make_request(f"{auth_url}/register", "POST", {
            "username": user_other, "password": password, "name": "Bob Jones", "email": email_other, "phone": "555-987-6543"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_other, "password": password
        })
        other_token = res["token"]
        
        # Register a pet for secondary client
        _, res = make_request(pets_url, "POST", {
            "name": "Max", "breed": "Poodle", "age": 4
        }, other_token)
        other_pet_id = res["petId"]

        # Register and login admin
        make_request(f"{auth_url}/register", "POST", {
            "username": user_admin, "password": password, "name": "Groomer Admin", "email": email_admin, "phone": "555-555-5555", "role": "admin"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_admin, "password": password
        })
        admin_token = res["token"]

        # Admin sets working hours for a future date (2026-06-25, 09:00:00 - 17:00:00)
        make_request(f"{hours_url}/admin", "POST", {
            "date": "2026-06-25", "startTime": "09:00:00", "endTime": "17:00:00"
        }, admin_token)
        
        print("PASS: Setup completed. Client, Admin, Pets, and Working Hours established.")
    except Exception as e:
        print(f"FAIL: Setup failed: {e}")
        sys.exit(1)

    # ==========================================
    # TEST 1: Unauthenticated Request (expect 401)
    # ==========================================
    print("\n1. Testing Unauthenticated Request...")
    code, res = make_request(appt_url, "GET")
    print(f"  GET appointments no token: {code}")
    assert code == 401
    
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "10:00:00", "endTime": "11:00:00"
    })
    print(f"  POST appointments no token: {code}")
    assert code == 401
    print("PASS: Unauthenticated booking blocked.")

    # ==========================================
    # TEST 2: Invalid Date / Past Date (expect 400)
    # ==========================================
    print("\n2. Testing Past Date Validation...")
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id,
        "date": "2020-01-01",
        "startTime": "10:00:00",
        "endTime": "11:00:00"
    }, client_token)
    print(f"  POST past date: {code} ({res.get('error')})")
    assert code == 400
    assert "past date" in res.get("error", "").lower()
    print("PASS: Past date scheduling blocked.")

    # ==========================================
    # TEST 3: Booking Outside Working Hours (expect 400)
    # ==========================================
    print("\n3. Testing Working Hours Boundary Checks...")
    # Outside scheduled range (Starts too early)
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "08:00:00", "endTime": "10:00:00"
    }, client_token)
    print(f"  POST starts before working hours: {code} ({res.get('error')})")
    assert code == 400
    
    # Outside scheduled range (Ends too late)
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "16:00:00", "endTime": "18:00:00"
    }, client_token)
    print(f"  POST ends after working hours: {code} ({res.get('error')})")
    assert code == 400

    # Date with no working hours scheduled
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-26", "startTime": "10:00:00", "endTime": "11:00:00"
    }, client_token)
    print(f"  POST on date with no schedule: {code} ({res.get('error')})")
    assert code == 400
    assert "no working hours" in res.get("error", "").lower()
    print("PASS: Out of hours scheduling blocked.")

    # ==========================================
    # TEST 4: Invalid Input - Time Logic (expect 400)
    # ==========================================
    print("\n4. Testing Invalid Input (startTime >= endTime)...")
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "12:00:00", "endTime": "11:00:00"
    }, client_token)
    print(f"  POST startTime >= endTime: {code} ({res.get('error')})")
    assert code == 400
    print("PASS: Invalid time sequence blocked.")

    # ==========================================
    # TEST 5: Pet Ownership Enforcement (expect 404)
    # ==========================================
    print("\n5. Testing Pet Ownership Enforcement...")
    # client_appt attempts to schedule an appointment using client_other's pet ID
    code, res = make_request(appt_url, "POST", {
        "petId": other_pet_id, "date": "2026-06-25", "startTime": "10:00:00", "endTime": "11:00:00"
    }, client_token)
    print(f"  POST with unauthorized pet ID: {code} ({res.get('error')})")
    assert code == 404
    print("PASS: Unauthorized pet booking blocked.")

    # ==========================================
    # TEST 6: Create Appointment (Happy Path) (expect 201)
    # ==========================================
    print("\n6. Testing Create Appointment (Happy Path)...")
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id,
        "date": "2026-06-25",
        "startTime": "10:00:00",
        "endTime": "11:00:00",
        "notes": "Full groom and claw trim"
    }, client_token)
    print(f"  Create Appointment Status: {code}")
    assert code == 201
    appt_id = res["appointmentId"]
    assert appt_id is not None
    assert res["status"] == "pending"
    print(f"PASS: Appointment scheduled successfully. ID: {appt_id}")

    # ==========================================
    # TEST 7: Overlap Conflict Check (expect 409)
    # ==========================================
    print("\n7. Testing Overlap / Double Booking Conflicts (expect 409)...")
    # Attempt to book at same exact time
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "10:00:00", "endTime": "11:00:00"
    }, client_token)
    print(f"  POST exact overlap: {code} ({res.get('error')})")
    assert code == 409

    # Attempt to book overlapping the start (09:30 - 10:30)
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "09:30:00", "endTime": "10:30:00"
    }, client_token)
    print(f"  POST start overlap: {code}")
    assert code == 409

    # Attempt to book overlapping the end (10:30 - 11:30)
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "10:30:00", "endTime": "11:30:00"
    }, client_token)
    print(f"  POST end overlap: {code}")
    assert code == 409
    print("PASS: Double bookings blocked with 409 Conflict.")

    # ==========================================
    # TEST 8: Client Fetch List & Decryption Check
    # ==========================================
    print("\n8. Testing Client Appointments List Fetch...")
    code, res = make_request(appt_url, "GET", token=client_token)
    print(f"  Client GET status: {code}")
    assert code == 200
    appts = res["appointments"]
    assert len(appts) >= 1
    matching = [a for a in appts if a["id"] == appt_id]
    assert len(matching) == 1
    assert matching[0]["pet_name"] == "Buddy"
    assert matching[0]["pet_breed"] == "Beagle"
    print("PASS: Client can retrieve list with correct pet details.")

    # ==========================================
    # TEST 9: Admin Fetch & Decryption Verification
    # ==========================================
    print("\n9. Testing Admin Fetch & Personal Info Decryption...")
    code, res = make_request(f"{appt_url}/admin/all", "GET", token=admin_token)
    print(f"  Admin GET status: {code}")
    assert code == 200
    appts = res["appointments"]
    matching = [a for a in appts if a["id"] == appt_id]
    assert len(matching) == 1
    admin_appt = matching[0]
    
    # Assert critical client info is decrypted correctly and raw ciphertext column is deleted
    print(f"  Admin Decrypted Client details:\n    Name: {admin_appt.get('client_name')}\n    Email: {admin_appt.get('client_email')}\n    Phone: {admin_appt.get('client_phone')}")
    assert admin_appt.get("client_name") == "Alice Smith"
    assert admin_appt.get("client_email") == email_client
    assert admin_appt.get("client_phone") == "555-123-4567"
    assert "encrypted_name" not in admin_appt
    print("PASS: Admin can view list with decrypted client PII.")

    # ==========================================
    # TEST 10: Client Cancels Appointment
    # ==========================================
    print("\n10. Testing Client Cancellation...")
    code, res = make_request(f"{appt_url}/{appt_id}/cancel", "PATCH", token=client_token)
    print(f"  Client CANCEL status: {code}")
    assert code == 200
    
    # Check status changed to cancelled
    code, res = make_request(f"{appt_url}/{appt_id}", "GET", token=client_token)
    assert res["appointment"]["status"] == "cancelled"
    print("PASS: Client can cancel their appointment.")

    # ==========================================
    # TEST 11: Admin Status Modification
    # ==========================================
    print("\n11. Testing Admin Status Update...")
    # Create another appointment to modify status
    code, res = make_request(appt_url, "POST", {
        "petId": pet_id, "date": "2026-06-25", "startTime": "12:00:00", "endTime": "13:00:00"
    }, client_token)
    appt_id_2 = res["appointmentId"]
    
    # Admin updates status to confirmed
    code, res = make_request(f"{appt_url}/admin/{appt_id_2}/status", "PATCH", {
        "status": "confirmed"
    }, admin_token)
    print(f"  Admin status update: {code}")
    assert code == 200
    assert res["status"] == "confirmed"
    
    # Verify status changed on client side
    code, res = make_request(f"{appt_url}/{appt_id_2}", "GET", token=client_token)
    assert res["appointment"]["status"] == "confirmed"
    print("PASS: Admin can confirm client appointments.")

    print("\n=== ALL APPOINTMENTS SCHEDULING, CONFLICTS & ADMIN ENDPOINTS VERIFIED ===")

if __name__ == "__main__":
    main()
