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
    admin_url = "http://localhost:5000/api/admin"
    pets_url = "http://localhost:5000/api/pets"
    
    suffix = str(uuid.uuid4())[:8]
    user_client = f"client_adm_{suffix}"
    email_client = f"client_adm_{suffix}@example.com"
    
    user_admin = f"admin_adm_{suffix}"
    email_admin = f"admin_adm_{suffix}@example.com"
    
    password = "testpassword"

    # 1. Register and Login Client
    try:
        make_request(f"{auth_url}/register", "POST", {
            "username": user_client, "password": password, "name": "Alice Peterson", "email": email_client, "phone": "555-444-3333"
        })
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": user_client, "password": password
        })
        client_id = res["user"]["id"]
        client_token = res["token"]
        print(f"PASS: Client setup complete. ID: {client_id}")
    except Exception as e:
        print(f"FAIL: Client setup failed: {e}")
        sys.exit(1)

    # 2. Register and Login Admin (Seed directly in DB to bypass public signup role restriction)
    try:
        # Register standard user first, then admin updates role
        # Or let's use the seeded 'admin' / 'adminpassword' account!
        # Using the seeded administrator account is the most robust and secure way!
        _, res = make_request(f"{auth_url}/login", "POST", {
            "loginIdentifier": "admin",
            "password": "adminpassword"
        })
        admin_token = res["token"]
        print(f"PASS: Admin login complete (using seeded admin).")
    except Exception as e:
        print(f"FAIL: Admin login failed: {e}")
        sys.exit(1)

    # ==========================================
    # TEST 1: Unauthenticated Requests (expect 401)
    # ==========================================
    print("\n1. Testing Unauthenticated Access to Admin routes...")
    code, res = make_request(f"{admin_url}/clients", "GET")
    print(f"  GET clients no token: {code}")
    assert code == 401
    
    code, res = make_request(f"{admin_url}/clients/{client_id}/ban", "PATCH", {"isBanned": True})
    print(f"  PATCH ban no token: {code}")
    assert code == 401
    print("PASS: Unauthenticated requests blocked with 401.")

    # ==========================================
    # TEST 2: Client Access Boundaries (expect 403)
    # ==========================================
    print("\n2. Testing Client Access Boundaries...")
    code, res = make_request(f"{admin_url}/clients", "GET", token=client_token)
    print(f"  GET clients as client: {code}")
    assert code == 403
    
    code, res = make_request(f"{admin_url}/clients/{client_id}/ban", "PATCH", {"isBanned": True}, token=client_token)
    print(f"  PATCH ban as client: {code}")
    assert code == 403
    print("PASS: Client blocked from admin routes with 403.")

    # ==========================================
    # TEST 3: Pet Data Isolation Check
    # ==========================================
    print("\n3. Testing Pet Data Isolation Check...")
    code, res = make_request(pets_url, "GET", token=client_token)
    print(f"  GET initial pets list size: {len(res.get('pets', []))}")
    assert code == 200
    assert len(res["pets"]) == 0, f"Expected 0 pets initially, found {len(res['pets'])}"
    print("PASS: New client has isolated, empty pet list.")

    # ==========================================
    # TEST 4: Admin GET and Decryption Check
    # ==========================================
    print("\n4. Testing Admin List & PII Decryption...")
    code, res = make_request(f"{admin_url}/clients", "GET", token=admin_token)
    print(f"  Admin GET status: {code}")
    assert code == 200
    clients = res["clients"]
    matching = [c for c in clients if c["id"] == client_id]
    assert len(matching) == 1
    adm_client = matching[0]
    
    # Assert personal info is decrypted
    print(f"  Decrypted Client: {adm_client}")
    assert adm_client["name"] == "Alice Peterson"
    assert adm_client["email"] == email_client
    assert adm_client["phone"] == "555-444-3333"
    assert adm_client["is_banned"] == 0
    assert "encrypted_name" not in adm_client
    print("PASS: Decrypted profile fields verified.")

    # ==========================================
    # TEST 5: Search/Filter (Happy Path)
    # ==========================================
    print("\n5. Testing Search / Filter in Admin Clients...")
    # Search by Name
    code, res = make_request(f"{admin_url}/clients?q=alice", "GET", token=admin_token)
    assert len(res["clients"]) >= 1
    assert any(c["id"] == client_id for c in res["clients"])
    
    # Search by Username
    code, res = make_request(f"{admin_url}/clients?q={user_client[:12]}", "GET", token=admin_token)
    assert len(res["clients"]) >= 1
    assert any(c["id"] == client_id for c in res["clients"])

    # Search by Email
    code, res = make_request(f"{admin_url}/clients?q={email_client[:12]}", "GET", token=admin_token)
    assert len(res["clients"]) >= 1
    assert any(c["id"] == client_id for c in res["clients"])

    # Search by Phone
    code, res = make_request(f"{admin_url}/clients?q=444-3333", "GET", token=admin_token)
    assert len(res["clients"]) >= 1
    
    # Search for nonexistent term
    code, res = make_request(f"{admin_url}/clients?q=nonexistentquery", "GET", token=admin_token)
    assert len(res["clients"]) == 0
    print("PASS: Search filters client records correctly across multiple columns.")

    # ==========================================
    # TEST 6: Ban Nonexistent / Invalid Client
    # ==========================================
    print("\n6. Testing Ban nonexistent client ID (expecting 404)...")
    fake_id = str(uuid.uuid4())
    code, res = make_request(f"{admin_url}/clients/{fake_id}/ban", "PATCH", {
        "isBanned": True
    }, admin_token)
    print(f"  Ban nonexistent client: {code}")
    assert code == 404
    print("PASS: Nonexistent client ban returned 404.")

    # ==========================================
    # TEST 7: Ban Client
    # ==========================================
    print("\n7. Testing Ban client...")
    code, res = make_request(f"{admin_url}/clients/{client_id}/ban", "PATCH", {
        "isBanned": True
    }, admin_token)
    print(f"  Ban Status: {code}")
    assert code == 200
    assert res["isBanned"] is True
    
    # Verify ban state in list
    code, res = make_request(f"{admin_url}/clients", "GET", token=admin_token)
    matching = [c for c in res["clients"] if c["id"] == client_id]
    assert matching[0]["is_banned"] == 1
    print("PASS: Client banned successfully.")

    # ==========================================
    # TEST 8: Ban Enforcement (Access Rejection)
    # ==========================================
    print("\n8. Testing Ban Enforcement / Blocked Access...")
    # Client tries to log in again -> expect 403 Forbidden
    code, res = make_request(f"{auth_url}/login", "POST", {
        "loginIdentifier": user_client, "password": password
    })
    print(f"  Banned client Login: {code} ({res.get('error')})")
    assert code == 403
    assert "banned" in res.get("error", "").lower()
    
    # Client tries to call API with their existing token -> expect 403 Forbidden
    code, res = make_request(pets_url, "GET", token=client_token)
    print(f"  Banned client existing token GET /pets: {code} ({res.get('error')})")
    assert code == 403
    assert "banned" in res.get("error", "").lower()
    
    code, res = make_request(f"{auth_url}/me", "GET", token=client_token)
    print(f"  Banned client existing token GET /me: {code} ({res.get('error')})")
    assert code == 403
    print("PASS: Ban successfully blocks registration/login/authenticated routes.")

    # ==========================================
    # TEST 9: Unban Client & Restore Access (Verify Old Token works)
    # ==========================================
    print("\n9. Testing Unban client and Old Token recovery...")
    code, res = make_request(f"{admin_url}/clients/{client_id}/ban", "PATCH", {
        "isBanned": False
    }, admin_token)
    print(f"  Unban Status: {code}")
    assert code == 200
    assert res["isBanned"] is False
    
    # Verify the OLD client_token (obtained before the ban) works again!
    code, res = make_request(pets_url, "GET", token=client_token)
    print(f"  Old token GET /pets after unban: {code}")
    assert code == 200
    print("PASS: Old token successfully re-validated after unban.")

    print("\n=== ALL CLIENT MANAGEMENT & BAN ENFORCEMENTS VERIFIED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
