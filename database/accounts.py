from datetime import datetime
import secrets
from .connection import get_db_connection, get_cursor, DATABASE_URL, qry

def get_next_available_account(username=None):
    """Gets the active account associated with the user, falling back to a shared account."""
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    row = None
    if username:
        cursor.execute(qry(f"""
            SELECT id, name, secure_1psid, secure_1psidts, provider 
            FROM {table_name} 
            WHERE username = ? AND status = 'active' 
            ORDER BY last_used ASC NULLS FIRST 
            LIMIT 1
        """), (username,))
        row = cursor.fetchone()
        
    if not row:
        cursor.execute(qry(f"""
            SELECT id, name, secure_1psid, secure_1psidts, provider 
            FROM {table_name} 
            WHERE username IS NULL AND status = 'active' 
            ORDER BY last_used ASC NULLS FIRST 
            LIMIT 1
        """))
        row = cursor.fetchone()
        
    conn.close()
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "secure_1psid": row["secure_1psid"],
            "secure_1psidts": row["secure_1psidts"],
            "provider": row["provider"] if "provider" in row.keys() else "gemini"
        }
    return None

def update_account_status(account_id, status, error_message=None):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    cursor.execute(
        qry(f"UPDATE {table_name} SET status = ?, error_message = ? WHERE id = ?"),
        (status, error_message, account_id)
    )
    conn.commit()
    conn.close()

def mark_account_used(account_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    cursor.execute(
        qry(f"UPDATE {table_name} SET last_used = ? WHERE id = ?"),
        (datetime.utcnow().isoformat(), account_id)
    )
    conn.commit()
    conn.close()

def create_app(name):
    api_key = f"paradise_ai_{secrets.token_hex(16)}"
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.apps" if DATABASE_URL else "apps"
    cursor.execute(qry(f"INSERT INTO {table_name} (name, api_key) VALUES (?, ?)"), (name, api_key))
    conn.commit()
    conn.close()
    return api_key

def get_apps():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.apps" if DATABASE_URL else "apps"
    cursor.execute(qry(f"SELECT * FROM {table_name} ORDER BY id DESC"))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_accounts():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    cursor.execute(qry(f"SELECT id, username, name, status, error_message, last_used, provider, created_at FROM {table_name} ORDER BY id DESC"))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_account(username, name, secure_1psid, secure_1psidts, provider="gemini"):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    if username:
        cursor.execute(qry(f"DELETE FROM {table_name} WHERE username = ?"), (username,))
    cursor.execute(
        qry(f"INSERT INTO {table_name} (username, name, secure_1psid, secure_1psidts, provider, status) VALUES (?, ?, ?, ?, ?, ?)"),
        (username, name, secure_1psid, secure_1psidts, provider, "active")
    )
    conn.commit()
    conn.close()

def delete_account(account_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    cursor.execute(qry(f"DELETE FROM {table_name} WHERE id = ?"), (account_id,))
    conn.commit()
    conn.close()
