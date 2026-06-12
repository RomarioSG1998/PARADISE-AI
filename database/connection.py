"""
database/connection.py
Low-level database connection primitives shared across all database modules.
Schema creation lives in database/schema.py.
"""
import sqlite3
import os
from dotenv import load_dotenv

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "CRITICAL DATABASE ERROR: DATABASE_URL is not set! "
        "Supabase connection is mandatory for persistence. "
        "Please check your .env file."
    )


def qry(sql: str) -> str:
    """Adapts SQL placeholders from SQLite (?) to PostgreSQL (%s)."""
    if DATABASE_URL:
        return sql.replace("?", "%s")
    return sql


def get_db_connection():
    """Returns a raw database connection (PostgreSQL or SQLite)."""
    if DATABASE_URL:
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    DB_DIR = os.path.join(root_dir, "data")
    os.makedirs(DB_DIR, exist_ok=True)
    DB_PATH = os.path.join(DB_DIR, "hub.db")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_cursor(conn):
    """Returns a dict-like cursor compatible with both backends."""
    if DATABASE_URL:
        from psycopg2.extras import RealDictCursor
        return conn.cursor(cursor_factory=RealDictCursor)
    return conn.cursor()


# ── Stats & Logging ───────────────────────────────────────────────────────────

def log_request(app_id, prompt_len, resp_len, duration_ms, status_code, error=None):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.request_logs" if DATABASE_URL else "request_logs"
    cursor.execute(qry(f"""
        INSERT INTO {table_name} (app_id, prompt_length, response_length, duration_ms, status_code, error)
        VALUES (?, ?, ?, ?, ?, ?)
    """), (app_id, prompt_len, resp_len, duration_ms, status_code, error))
    conn.commit()
    conn.close()


def get_stats():
    conn = get_db_connection()
    cursor = get_cursor(conn)

    apps_tbl = "public.apps" if DATABASE_URL else "apps"
    accounts_tbl = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    logs_tbl = "public.request_logs" if DATABASE_URL else "request_logs"

    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {logs_tbl}"))
    row = cursor.fetchone()
    total_requests = (row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]) or 0

    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {logs_tbl} WHERE status_code = 200"))
    row = cursor.fetchone()
    success_requests = (row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]) or 0
    success_rate = (success_requests / total_requests * 100) if total_requests > 0 else 0

    cursor.execute(qry(f"SELECT AVG(duration_ms) as avg_dur FROM {logs_tbl} WHERE status_code = 200"))
    row = cursor.fetchone()
    avg_duration = (row["avg_dur"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]) or 0

    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {accounts_tbl} WHERE status = 'active'"))
    row = cursor.fetchone()
    active_accounts = (row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]) or 0

    cursor.execute(qry(f"""
        SELECT l.id, a.name as app_name, l.prompt_length, l.response_length,
               l.duration_ms, l.status_code, l.created_at
        FROM {logs_tbl} l
        LEFT JOIN {apps_tbl} a ON l.app_id = a.id
        ORDER BY l.id DESC
        LIMIT 10
    """))
    recent_logs = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return {
        "total_requests": total_requests,
        "success_rate": round(success_rate, 1),
        "avg_duration": round(avg_duration),
        "active_accounts": active_accounts,
        "recent_logs": recent_logs,
    }
