import urllib.request
import urllib.error
import json
import time
import sys
import uuid

def post_json(url, data, token=None):
    req = urllib.request.Request(url, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
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

def get_json(url, token=None):
    req = urllib.request.Request(url, method="GET")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
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

def validate_jwt(token):
    assert isinstance(token, str) and len(token) > 0, "Token is not a non-empty string"
    parts = token.split(".")
    assert len(parts) == 3, f"Token is not a valid JWT shape: {token}"

def main():
    # 1. Health check poll to avoid hardcoded sleep
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
    
    base_url = "http://localhost:5000/api/auth"
    
    # Generate unique identifiers to allow repeated runs without collisions
    suffix = str(uuid.uuid4())[:8]
    username = f"client_{suffix}"
    email = f"client_{suffix}@example.com"
    password = "testpassword"
    phone = "123-456-7890" # Stored exactly as inputted (no format normalization is enforced by backend)

    print(f"Running tests with randomized user: {username} / {email}")

    # ==========================================
    # POSITIVE PATHS
    # ==========================================

    # 1. Test Admin Login (Seeded on start) & verify profile with token
    print("\n1. Testing Seeded Admin Login & Token usage...")
    try:
        status, res = post_json(f"{base_url}/login", {
            "loginIdentifier": "admin",
            "password": "adminpassword"
        })
        print(f"Admin Login Status: {status}")
        assert status == 200, "Admin login failed"
        admin_token = res["token"]
        validate_jwt(admin_token)
        
        # Test Admin Token in fetching profile
        p_status, p_res = get_json(f"{base_url}/me", admin_token)
        print(f"Admin Profile Status: {p_status}")
        assert p_status == 200
        assert p_res["user"]["role"] == "admin", "Admin role mismatch"
        print("PASS: Seeded Admin login and profile check works.")
    except Exception as e:
        print(f"FAIL: Seeded Admin login failed: {e}")
        sys.exit(1)

    # 2. Test Client Registration
    print("\n2. Testing Client Registration...")
    try:
        status, res = post_json(f"{base_url}/register", {
            "username": username,
            "password": password,
            "name": "John Doe",
            "email": email,
            "phone": phone
        })
        print(f"Client Register Status: {status}")
        assert status == 201, "Client registration failed"
        assert "userId" in res, "Registration response missing userId"
        print(f"PASS: Client registered. ID: {res['userId']}")
    except Exception as e:
        print(f"FAIL: Client registration failed: {e}")
        sys.exit(1)

    # 3. Test Client Login using Username
    print("\n3. Testing Client Login using Username...")
    try:
        status, res = post_json(f"{base_url}/login", {
            "loginIdentifier": username,
            "password": password
        })
        print(f"Client Login (Username) Status: {status}")
        assert status == 200, "Client login with username failed"
        client_token = res["token"]
        validate_jwt(client_token)
        print("PASS: Client login with username works.")
    except Exception as e:
        print(f"FAIL: Client login with username failed: {e}")
        sys.exit(1)

    # 4. Test Client Login using Email
    print("\n4. Testing Client Login using Email...")
    try:
        status, res = post_json(f"{base_url}/login", {
            "loginIdentifier": email,
            "password": password
        })
        print(f"Client Login (Email) Status: {status}")
        assert status == 200, "Client login with email failed"
        validate_jwt(res["token"])
        print("PASS: Client login with email works.")
    except Exception as e:
        print(f"FAIL: Client login with email failed: {e}")
        sys.exit(1)

    # 5. Test Profile Fetch (PII Decryption)
    print("\n5. Testing /me Profile Endpoint and PII Decryption...")
    try:
        status, res = get_json(f"{base_url}/me", client_token)
        print(f"Profile Status: {status}")
        assert status == 200, "Profile fetch failed"
        user_info = res["user"]
        print(f"Decrypted Profile: {user_info}")
        assert user_info["name"] == "John Doe", "Decrypted name mismatch"
        assert user_info["email"] == email, "Decrypted email mismatch"
        assert user_info["phone"] == phone, "Decrypted phone mismatch"
        assert user_info["role"] == "client", "Role mismatch"
        print("PASS: Decryption and user context verification works.")
    except Exception as e:
        print(f"FAIL: Profile decryption/fetch failed: {e}")
        sys.exit(1)

    # ==========================================
    # NEGATIVE / FAILURE PATHS
    # ==========================================
    print("\n=== RUNNING FAILURE / NEGATIVE TESTS ===")

    # 6. Login with wrong password -> expect 401
    print("Testing Login with wrong password (expecting 401)...")
    try:
        status, res = post_json(f"{base_url}/login", {
            "loginIdentifier": username,
            "password": "wrongpassword"
        })
        print(f"Wrong Password Status: {status}")
        assert status == 401, f"Expected 401, got {status}"
        print("PASS: Login with wrong password returns 401.")
    except Exception as e:
        print(f"FAIL: Wrong password test failed: {e}")
        sys.exit(1)

    # 7. Login with unknown user -> expect 401
    print("Testing Login with unknown user (expecting 401)...")
    try:
        status, res = post_json(f"{base_url}/login", {
            "loginIdentifier": f"nonexistent_{suffix}",
            "password": password
        })
        print(f"Unknown User Status: {status}")
        assert status == 401, f"Expected 401, got {status}"
        print("PASS: Login with unknown user returns 401.")
    except Exception as e:
        print(f"FAIL: Unknown user test failed: {e}")
        sys.exit(1)

    # 8. Register with duplicate username -> expect 400
    print("Testing Register with duplicate username (expecting 400)...")
    try:
        status, res = post_json(f"{base_url}/register", {
            "username": username,
            "password": "newpassword",
            "name": "Different Name",
            "email": f"different_{suffix}@example.com",
            "phone": "555-555-5555"
        })
        print(f"Duplicate Username Status: {status}")
        assert status == 400, f"Expected 400, got {status}"
        print("PASS: Register with duplicate username blocked.")
    except Exception as e:
        print(f"FAIL: Duplicate username test failed: {e}")
        sys.exit(1)

    # 9. Register with duplicate email -> expect 400
    print("Testing Register with duplicate email (expecting 400)...")
    try:
        status, res = post_json(f"{base_url}/register", {
            "username": f"different_{suffix}",
            "password": "newpassword",
            "name": "Different Name",
            "email": email,
            "phone": "555-555-5555"
        })
        print(f"Duplicate Email Status: {status}")
        assert status == 400, f"Expected 400, got {status}"
        print("PASS: Register with duplicate email blocked.")
    except Exception as e:
        print(f"FAIL: Duplicate email test failed: {e}")
        sys.exit(1)

    # 10. Access /me with no token -> expect 401
    print("Testing Access /me with no token (expecting 401)...")
    try:
        status, res = get_json(f"{base_url}/me")
        print(f"No Token Profile Status: {status}")
        assert status == 401, f"Expected 401, got {status}"
        print("PASS: Access /me without token returns 401.")
    except Exception as e:
        print(f"FAIL: No token test failed: {e}")
        sys.exit(1)

    # 11. Access /me with bad token -> expect 403
    print("Testing Access /me with bad token (expecting 403)...")
    try:
        status, res = get_json(f"{base_url}/me", "invalid.jwt.token")
        print(f"Bad Token Profile Status: {status}")
        assert status == 403, f"Expected 403, got {status}"
        print("PASS: Access /me with bad token returns 403.")
    except Exception as e:
        print(f"FAIL: Bad token test failed: {e}")
        sys.exit(1)

    print("\n=== ALL AUTH POSITIVE & NEGATIVE ENDPOINTS VERIFIED SUCCESSFULLY ===")

if __name__ == "__main__":
    main()
