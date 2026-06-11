import subprocess
import time
import sys
import urllib.request
import json
import socket
import os

def run_command(cmd, check=True):
    result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)
    return result

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2.0)
        try:
            s.connect(('127.0.0.1', port))
            return True
        except Exception:
            return False

def load_env():
    env = {
        "DB_ROOT_PASSWORD": "rootpassword",
        "DB_USER": "dogwash_user",
        "DB_PASSWORD": "dogwash_password",
        "DB_NAME": "dog_wash",
    }
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

def main():
    env_config = load_env()
    db_root_password = env_config.get("DB_ROOT_PASSWORD")
    db_user = env_config.get("DB_USER")
    db_password = env_config.get("DB_PASSWORD")
    db_name = env_config.get("DB_NAME")

    failed = False
    print("=== SETUP: Building and starting services ===")
    
    try:
        run_command("docker compose up -d --build")
    except Exception as e:
        print(f"SETUP FAILED: Docker Compose build/up failed: {e}")
        sys.exit(1)
        
    print("\n=== RUNNING DOCKER INTEGRATION TEST SUITE ===")
    
    try:
        # TEST 1: All 3 containers reach status=running
        print("TEST 1: All 3 containers reach status=running... ", end="", flush=True)
        try:
            db_run = run_command('docker inspect -f "{{.State.Running}}" dogwash_db').stdout.strip()
            back_run = run_command('docker inspect -f "{{.State.Running}}" dogwash_backend').stdout.strip()
            front_run = run_command('docker inspect -f "{{.State.Running}}" dogwash_frontend').stdout.strip()
            if db_run == "true" and back_run == "true" and front_run == "true":
                print("PASS")
            else:
                print("FAIL")
                print(f"  db: {db_run}, backend: {back_run}, frontend: {front_run}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 2: Ports 3306, 5000, 5173 bound on host
        print("TEST 2: Ports 3306, 5000, 5173 bound on host... ", end="", flush=True)
        p3306 = check_port(3306)
        p5000 = check_port(5000)
        p5173 = check_port(5173)
        if p3306 and p5000 and p5173:
            print("PASS")
        else:
            print("FAIL")
            print(f"  3306: {p3306}, 5000: {p5000}, 5173: {p5173}")
            failed = True

        # TEST 3: Backend/frontend on dogwash_network
        print("TEST 3: Backend/frontend on dogwash_network... ", end="", flush=True)
        try:
            back_net = run_command("docker inspect dogwash_backend").stdout
            front_net = run_command("docker inspect dogwash_frontend").stdout
            back_ok = "dogwash_network" in back_net
            front_ok = "dogwash_network" in front_net
            if back_ok and front_ok:
                print("PASS")
            else:
                print("FAIL")
                print(f"  backend: {back_ok}, frontend: {front_ok}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 4: Backend can ping db by hostname
        print("TEST 4: Backend can ping db by hostname... ", end="", flush=True)
        try:
            res = run_command("docker exec dogwash_backend ping -c 1 db", check=False)
            if res.returncode == 0:
                print("PASS")
            else:
                print("FAIL")
                print(f"  ping stdout: {res.stdout}\n  ping stderr: {res.stderr}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 5: DB env vars exact-match in backend container
        print("TEST 5: DB env vars exact-match in backend container... ", end="", flush=True)
        try:
            env_out = run_command("docker exec dogwash_backend env").stdout
            env_vars = {}
            for line in env_out.strip().split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
            
            p_ok = env_vars.get("PORT") == "5000"
            h_ok = env_vars.get("DB_HOST") == "db"
            u_ok = env_vars.get("DB_USER") == db_user
            n_ok = env_vars.get("DB_NAME") == db_name
            s_ok = bool(env_vars.get("JWT_SECRET"))
            enc_key = env_vars.get("ENCRYPTION_KEY", "")
            k_ok = len(enc_key) == 64 and all(c in '0123456789abcdefABCDEF' for c in enc_key)
            
            if p_ok and h_ok and u_ok and n_ok and s_ok and k_ok:
                print("PASS")
            else:
                print("FAIL")
                print(f"  PORT: {env_vars.get('PORT')} (ok: {p_ok})")
                print(f"  DB_HOST: {env_vars.get('DB_HOST')} (ok: {h_ok})")
                print(f"  DB_USER: {env_vars.get('DB_USER')} (ok: {u_ok})")
                print(f"  DB_NAME: {env_vars.get('DB_NAME')} (ok: {n_ok})")
                print(f"  JWT_SECRET non-empty: {s_ok}")
                print(f"  ENCRYPTION_KEY is 64-char hex: {k_ok} (length: {len(enc_key)})")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 6: MySQL accepts connections (mysqladmin ping, 10 retries x 3s)
        print("TEST 6: MySQL accepts connections... ", end="", flush=True)
        mysql_alive = False
        for _ in range(10):
            res = run_command(f"docker exec dogwash_db mysqladmin ping -u root -p{db_root_password}", check=False)
            if "mysqld is alive" in res.stdout:
                mysql_alive = True
                break
            time.sleep(3)
        if mysql_alive:
            print("PASS")
        else:
            print("FAIL")
            failed = True

        # TEST 7: db_user can connect to db_name
        print(f"TEST 7: {db_user} can connect to {db_name}... ", end="", flush=True)
        try:
            res = run_command(f'docker exec dogwash_db mysql -u {db_user} -p{db_password} -e "USE {db_name};"', check=False)
            if res.returncode == 0:
                print("PASS")
            else:
                print("FAIL")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 8: All 4 tables exist
        print("TEST 8: All 4 tables exist... ", end="", flush=True)
        try:
            tables_out = run_command(f'docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -e "SHOW TABLES;"').stdout
            tables = [line.strip() for line in tables_out.strip().split("\n")]
            has_users = "users" in tables
            has_pets = "pets" in tables
            has_hours = "working_hours" in tables
            has_appts = "appointments" in tables
            if has_users and has_pets and has_hours and has_appts:
                print("PASS")
            else:
                print("FAIL")
                print(f"  Found tables: {tables}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 9: users table has email_hash, encrypted_* columns, role, is_banned
        print("TEST 9: users table has correct columns... ", end="", flush=True)
        try:
            cols_out = run_command(f'docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -e "DESCRIBE users;"').stdout
            cols = [line.split("\t")[0].strip() for line in cols_out.strip().split("\n")]
            has_eh = "email_hash" in cols
            has_en = "encrypted_name" in cols
            has_ee = "encrypted_email" in cols
            has_ep = "encrypted_phone" in cols
            has_r = "role" in cols
            has_b = "is_banned" in cols
            if has_eh and has_en and has_ee and has_ep and has_r and has_b:
                print("PASS")
            else:
                print("FAIL")
                print(f"  Columns: {cols}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 10: appointments.status ENUM has all 4 values
        print("TEST 10: appointments.status ENUM has all 4 values... ", end="", flush=True)
        try:
            status_col = run_command(f'docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -e "SHOW COLUMNS FROM appointments LIKE \'status\';"').stdout
            expected = "'pending','confirmed','completed','cancelled'"
            if any(expected in line for line in status_col.split("\n")):
                print("PASS")
            else:
                print("FAIL")
                print(f"  Status column def: {status_col}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 11: 3 foreign keys exist in information_schema
        print("TEST 11: 3 foreign keys exist... ", end="", flush=True)
        try:
            fk1 = run_command(f"docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -N -e \"SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='{db_name}' AND TABLE_NAME='pets' AND REFERENCED_TABLE_NAME='users';\"").stdout.strip()
            fk2 = run_command(f"docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -N -e \"SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='{db_name}' AND TABLE_NAME='appointments' AND REFERENCED_TABLE_NAME='users';\"").stdout.strip()
            fk3 = run_command(f"docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -N -e \"SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='{db_name}' AND TABLE_NAME='appointments' AND REFERENCED_TABLE_NAME='pets';\"").stdout.strip()
            
            if fk1 == "1" and fk2 == "1" and fk3 == "1":
                print("PASS")
            else:
                print("FAIL")
                print(f"  FK counts - pets->users: {fk1}, appts->users: {fk2}, appts->pets: {fk3}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 12: users table is InnoDB + utf8mb4_unicode_ci
        print("TEST 12: users table is InnoDB + utf8mb4_unicode_ci... ", end="", flush=True)
        try:
            info = run_command(f"docker exec dogwash_db mysql -u {db_user} -p{db_password} {db_name} -e \"SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA='{db_name}' AND TABLE_NAME='users';\"").stdout
            has_engine = "InnoDB" in info
            has_collation = "utf8mb4_unicode_ci" in info
            if has_engine and has_collation:
                print("PASS")
            else:
                print("FAIL")
                print(f"  Table info: {info}")
                failed = True
        except Exception as e:
            print("FAIL")
            print(f"  Error: {e}")
            failed = True

        # TEST 13: Backend health endpoint returns 2xx (10 retries x 2s)
        print("TEST 13: Backend health endpoint returns 2xx... ", end="", flush=True)
        health_ok = False
        for _ in range(10):
            try:
                with urllib.request.urlopen("http://localhost:5000/health", timeout=2) as response:
                    if response.status == 200:
                        health_ok = True
                        break
            except Exception:
                pass
            time.sleep(2)
        if health_ok:
            print("PASS")
        else:
            print("FAIL")
            failed = True

    finally:
        print("\n=== TEARDOWN: Cleaning up Docker containers and volumes ===")
        run_command("docker compose down -v", check=False)
        
    if failed:
        print("\n=== TEST SUITE FAILED ===")
        sys.exit(1)
    else:
        print("\n=== ALL TESTS PASSED SUCCESSFULLY ===")
        sys.exit(0)

if __name__ == "__main__":
    main()
