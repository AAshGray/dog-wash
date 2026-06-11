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
    
    # Generate unique credentials for isolated, repeatable state
    suffix_a = str(uuid.uuid4())[:8]
    suffix_b = str(uuid.uuid4())[:8]
    
    user_a = f"client_a_{suffix_a}"
    email_a = f"client_a_{suffix_a}@example.com"
    
    user_b = f"client_b_{suffix_b}"
    email_b = f"client_b_{suffix_b}@example.com"
    
    password = "testpassword"

    # Register and login User A (Owner)
    try:
        make_request(f"{auth_url}/register", "POST", {
            "username": user_a, "password": password, "name": "User A", "email": email_a, "phone": "111-111-1111"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_a, "password": password
        })
        token_a = res["token"]
    except Exception as e:
        print(f"FAIL: Owner setup failed: {e}")
        sys.exit(1)

    # Register and login User B (Attacker/Different client)
    try:
        make_request(f"{auth_url}/register", "POST", {
            "username": user_b, "password": password, "name": "User B", "email": email_b, "phone": "222-222-2222"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_b, "password": password
        })
        token_b = res["token"]
    except Exception as e:
        print(f"FAIL: Secondary client setup failed: {e}")
        sys.exit(1)

    print(f"Test users initialized:\n  User A: {user_a}\n  User B: {user_b}")

    # ==========================================
    # TEST 1: Auth Boundary - No Token (expect 401)
    # ==========================================
    print("\n1. Testing Auth Boundary: Accessing pets endpoints without token...")
    code, res = make_request(pets_url, "GET")
    print(f"  GET pets no token: {code}")
    assert code == 401
    
    code, res = make_request(pets_url, "POST", {"name": "Test", "breed": "Test", "age": 1})
    print(f"  POST pets no token: {code}")
    assert code == 401
    print("PASS: Unauthenticated access blocked.")

    # ==========================================
    # TEST 2: Invalid Input - Missing Required Fields (expect 400)
    # ==========================================
    print("\n2. Testing Invalid Input: Missing name on POST...")
    code, res = make_request(pets_url, "POST", {
        "breed": "Labrador",
        "age": 2
    }, token_a)
    print(f"  POST missing name: {code} ({res.get('error')})")
    assert code == 400
    print("PASS: Missing required fields blocked.")

    # ==========================================
    # TEST 3: Add Pet (Happy Path) (expect 201)
    # ==========================================
    print("\n3. Testing Add Pet (Happy Path)...")
    code, res = make_request(pets_url, "POST", {
        "name": "Buddy",
        "breed": "Golden Retriever",
        "age": 3,
        "special_notes": "Likes belly rubs"
    }, token_a)
    print(f"  Add Pet Status: {code}")
    assert code == 201
    pet_id = res["petId"]
    assert pet_id is not None
    print(f"PASS: Pet added successfully. ID: {pet_id}")

    # ==========================================
    # TEST 4: List Pets (expect 200, length 1)
    # ==========================================
    print("\n4. Testing List Pets for User A...")
    code, res = make_request(pets_url, "GET", token=token_a)
    print(f"  List Pets Status: {code}")
    assert code == 200
    pets = res["pets"]
    assert len(pets) == 1, f"Expected 1 pet, found {len(pets)}"
    assert pets[0]["id"] == pet_id
    assert pets[0]["name"] == "Buddy"
    print("PASS: Owner can retrieve their own pets list.")

    # ==========================================
    # TEST 5: Auth Boundary - Ownership Enforcement (expect 404)
    # ==========================================
    print("\n5. Testing Auth Boundary: User B accessing User A's pet...")
    # User B tries to fetch User A's pet by ID
    code, res = make_request(f"{pets_url}/{pet_id}", "GET", token=token_b)
    print(f"  GET foreign pet status: {code}")
    assert code == 404, f"Expected 404, got {code}"

    # User B tries to update User A's pet
    code, res = make_request(f"{pets_url}/{pet_id}", "PUT", {
        "name": "Hacked", "breed": "Hacked", "age": 5
    }, token_b)
    print(f"  PUT foreign pet status: {code}")
    assert code == 404, f"Expected 404, got {code}"

    # User B tries to delete User A's pet
    code, res = make_request(f"{pets_url}/{pet_id}", "DELETE", token=token_b)
    print(f"  DELETE foreign pet status: {code}")
    assert code == 404, f"Expected 404, got {code}"
    print("PASS: Ownership boundaries enforced successfully (User B blocked).")

    # ==========================================
    # TEST 6: Update Pet & Verify Response
    # ==========================================
    print("\n6. Testing Update Pet (Happy Path)...")
    code, res = make_request(f"{pets_url}/{pet_id}", "PUT", {
        "name": "Buddy",
        "breed": "Golden Retriever",
        "age": 4,
        "special_notes": "Needs grain-free diet"
    }, token_a)
    print(f"  Update Pet Status: {code}")
    assert code == 200
    assert res.get("message") == "Pet updated successfully"
    print("PASS: Owner can update their pet details.")

    # ==========================================
    # TEST 7: Fetch Specific Pet (Verify updates)
    # ==========================================
    print("\n7. Testing Fetch Specific Pet & Verify Updates...")
    code, res = make_request(f"{pets_url}/{pet_id}", "GET", token=token_a)
    print(f"  GET specific pet status: {code}")
    assert code == 200
    pet = res["pet"]
    assert pet["age"] == 4
    assert pet["special_notes"] == "Needs grain-free diet"
    print("PASS: Decrypted pet details are updated and correct.")

    # ==========================================
    # TEST 8: Invalid Input - Update Nonexistent Pet (expect 404)
    # ==========================================
    print("\n8. Testing Update Nonexistent Pet ID...")
    fake_uuid = str(uuid.uuid4())
    code, res = make_request(f"{pets_url}/{fake_uuid}", "PUT", {
        "name": "Fake", "breed": "Fake", "age": 1
    }, token_a)
    print(f"  PUT fake pet status: {code}")
    assert code == 404
    print("PASS: Nonexistent updates blocked.")

    # ==========================================
    # TEST 9: Delete Pet (expect 200)
    # ==========================================
    print("\n9. Testing Delete Pet (Happy Path)...")
    code, res = make_request(f"{pets_url}/{pet_id}", "DELETE", token=token_a)
    print(f"  DELETE status: {code}")
    assert code == 200
    assert res.get("message") == "Pet deleted successfully"
    print("PASS: Owner can delete their pet.")

    # ==========================================
    # TEST 10: 404 Handling on Deleted Pet & Verification
    # ==========================================
    print("\n10. Testing Fetch Deleted Pet (expect 404)...")
    code, res = make_request(f"{pets_url}/{pet_id}", "GET", token=token_a)
    print(f"  GET deleted pet status: {code}")
    assert code == 404
    
    code, res = make_request(pets_url, "GET", token=token_a)
    print(f"  GET list after delete size: {len(res['pets'])}")
    assert len(res["pets"]) == 0
    print("PASS: Pet list is empty, and access returns 404.")

    print("\n=== ALL PET CRUD & OWNERSHIP ENDPOINTS VERIFIED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
