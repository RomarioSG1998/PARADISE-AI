import sqlite3
import os
import secrets
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hub.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    from dotenv import load_dotenv
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create apps table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create gemini_accounts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gemini_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        secure_1psid TEXT NOT NULL,
        secure_1psidts TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        error_message TEXT,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create request_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER,
        prompt_length INTEGER,
        response_length INTEGER,
        duration_ms INTEGER,
        status_code INTEGER,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(app_id) REFERENCES apps(id)
    )
    """)
    
    # Check if we have any registered apps. If not, seed the first one
    cursor.execute("SELECT COUNT(*) FROM apps")
    if cursor.fetchone()[0] == 0:
        # Generate first API Key
        default_key = f"paradise_ai_{secrets.token_hex(16)}"
        cursor.execute(
            "INSERT INTO apps (name, api_key, status) VALUES (?, ?, ?)",
            ("Paradise AI Study Secretary Bot (Telegram)", default_key, "active")
        )
        print(f"[AI Hub DB] Seeded first app. API KEY: {default_key}")

    # Check if we have accounts. If not, migrate old cookies from .env
    cursor.execute("SELECT COUNT(*) FROM gemini_accounts")
    if cursor.fetchone()[0] == 0:
        env_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        load_dotenv(env_file_path, override=True)
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        if secure_1psid and secure_1psidts:
            cursor.execute(
                "INSERT INTO gemini_accounts (name, secure_1psid, secure_1psidts, status) VALUES (?, ?, ?, ?)",
                ("Conta Pro Migrada (.env)", secure_1psid, secure_1psidts, "active")
            )
            print("[AI Hub DB] Successfully migrated old .env cookies to SQLite database pool.")

    conn.commit()
    conn.close()

def validate_api_key(api_key):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, status FROM apps WHERE api_key = ? LIMIT 1", (api_key,))
    row = cursor.fetchone()
    conn.close()
    if row and row["status"] == "active":
        return {"id": row["id"], "name": row["name"]}
    return None

def get_next_available_account():
    """Gets the active account that was least recently used."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, secure_1psid, secure_1psidts 
        FROM gemini_accounts 
        WHERE status = 'active' 
        ORDER BY last_used ASC NULLS FIRST 
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "secure_1psid": row["secure_1psid"],
            "secure_1psidts": row["secure_1psidts"]
        }
    return None

def update_account_status(account_id, status, error_message=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE gemini_accounts SET status = ?, error_message = ? WHERE id = ?",
        (status, error_message, account_id)
    )
    conn.commit()
    conn.close()

def mark_account_used(account_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE gemini_accounts SET last_used = ? WHERE id = ?",
        (datetime.utcnow().isoformat(), account_id)
    )
    conn.commit()
    conn.close()

def log_request(app_id, prompt_len, resp_len, duration_ms, status_code, error=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO request_logs (app_id, prompt_length, response_length, duration_ms, status_code, error)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (app_id, prompt_len, resp_len, duration_ms, status_code, error))
    conn.commit()
    conn.close()

def create_app(name):
    api_key = f"paradise_ai_{secrets.token_hex(16)}"
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO apps (name, api_key) VALUES (?, ?)", (name, api_key))
    conn.commit()
    conn.close()
    return api_key

def get_apps():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM apps ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_accounts():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, status, error_message, last_used, created_at FROM gemini_accounts ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_account(name, secure_1psid, secure_1psidts):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO gemini_accounts (name, secure_1psid, secure_1psidts, status) VALUES (?, ?, ?, ?)",
        (name, secure_1psid, secure_1psidts, "active")
    )
    conn.commit()
    conn.close()

def delete_account(account_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM gemini_accounts WHERE id = ?", (account_id,))
    conn.commit()
    conn.close()

def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total Requests
    cursor.execute("SELECT COUNT(*) FROM request_logs")
    total_requests = cursor.fetchone()[0]
    
    # Success Rate
    cursor.execute("SELECT COUNT(*) FROM request_logs WHERE status_code = 200")
    success_requests = cursor.fetchone()[0]
    success_rate = (success_requests / total_requests * 100) if total_requests > 0 else 0
    
    # Average Duration
    cursor.execute("SELECT AVG(duration_ms) FROM request_logs WHERE status_code = 200")
    avg_duration = cursor.fetchone()[0] or 0
    
    # Active accounts
    cursor.execute("SELECT COUNT(*) FROM gemini_accounts WHERE status = 'active'")
    active_accounts = cursor.fetchone()[0]

    # Recent Logs
    cursor.execute("""
        SELECT l.id, a.name as app_name, l.prompt_length, l.response_length, l.duration_ms, l.status_code, l.created_at
        FROM request_logs l
        LEFT JOIN apps a ON l.app_id = a.id
        ORDER BY l.id DESC
        LIMIT 10
    """)
    recent_logs = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return {
        "total_requests": total_requests,
        "success_rate": round(success_rate, 1),
        "avg_duration": round(avg_duration),
        "active_accounts": active_accounts,
        "recent_logs": recent_logs
    }
