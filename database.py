import sqlite3
import os
import secrets
from datetime import datetime

# Load environment to check for DATABASE_URL
from dotenv import load_dotenv
root_dir = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(root_dir, ".env")
load_dotenv(ENV_PATH, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

def qry(sql: str) -> str:
    if DATABASE_URL:
        return sql.replace("?", "%s")
    return sql

def get_db_connection():
    if DATABASE_URL:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    else:
        DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        os.makedirs(DB_DIR, exist_ok=True)
        DB_PATH = os.path.join(DB_DIR, "hub.db")
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def get_cursor(conn):
    if DATABASE_URL:
        from psycopg2.extras import RealDictCursor
        return conn.cursor(cursor_factory=RealDictCursor)
    else:
        return conn.cursor()

def init_db():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    if not DATABASE_URL:
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
            provider TEXT DEFAULT 'gemini',
            status TEXT DEFAULT 'active',
            error_message TEXT,
            last_used TIMESTAMP,
            username TEXT REFERENCES profiles(username) ON DELETE CASCADE,
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

        # Create profiles table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            username TEXT PRIMARY KEY,
            email TEXT,
            full_name TEXT,
            password_hash TEXT,
            language TEXT NOT NULL DEFAULT 'pt',
            avatar_name TEXT NOT NULL DEFAULT 'Professor',
            avatar_image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Create narratives table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS narratives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT REFERENCES profiles(username) ON DELETE CASCADE,
            title TEXT NOT NULL,
            genre TEXT NOT NULL,
            duration INTEGER NOT NULL,
            voice_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Create narrative_segments table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS narrative_segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            narrative_id INTEGER NOT NULL REFERENCES narratives(id) ON DELETE CASCADE,
            segment_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            image_prompt TEXT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (narrative_id, segment_index)
        )
        """)

        # Create writer_environments table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS writer_environments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT REFERENCES profiles(username) ON DELETE CASCADE,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Create writer_materials table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS writer_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            material_type TEXT NOT NULL CHECK(material_type IN ('model', 'reference')),
            content_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Create writer_documents table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS writer_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # Create writer_messages table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS writer_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
            sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        conn.commit()
    else:
        try:
            cursor.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.writer_environments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username TEXT REFERENCES public.profiles(username) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.writer_materials (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                environment_id UUID REFERENCES public.writer_environments(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                material_type TEXT NOT NULL CHECK(material_type IN ('model', 'reference')),
                content_text TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.writer_documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                environment_id UUID REFERENCES public.writer_environments(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                content TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
            """)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.writer_messages (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                environment_id UUID REFERENCES public.writer_environments(id) ON DELETE CASCADE,
                sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            )
            """)
            conn.commit()
        except Exception as e:
            print(f"Error initializing postgres writer tables: {e}")
            conn.rollback()

    # Check if we have any registered apps. If not, seed the first one
    cursor.execute(qry("SELECT COUNT(*) as cnt FROM apps"))
    row = cursor.fetchone()
    app_count = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    
    if app_count == 0:
        default_key = f"paradise_ai_{secrets.token_hex(16)}"
        cursor.execute(
            qry("INSERT INTO apps (name, api_key, status) VALUES (?, ?, ?)"),
            ("Paradise AI Study Secretary Bot (Telegram)", default_key, "active")
        )
        conn.commit()
        print(f"[AI Hub DB] Seeded first app. API KEY: {default_key}")

    # Check if we have accounts. If not, migrate old cookies from .env
    cursor.execute(qry("SELECT COUNT(*) as cnt FROM gemini_accounts"))
    row = cursor.fetchone()
    account_count = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    
    if account_count == 0:
        env_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
        load_dotenv(env_file_path, override=True)
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        if secure_1psid and secure_1psidts:
            cursor.execute(
                qry("INSERT INTO gemini_accounts (name, secure_1psid, secure_1psidts, status) VALUES (?, ?, ?, ?)"),
                ("Conta Pro Migrada (.env)", secure_1psid, secure_1psidts, "active")
            )
            conn.commit()
            print("[AI Hub DB] Successfully migrated old .env cookies to database pool.")

    if DATABASE_URL:
        cursor.execute("ALTER TABLE public.gemini_accounts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'gemini'")
        conn.commit()
    else:
        try:
            cursor.execute("ALTER TABLE gemini_accounts ADD COLUMN provider TEXT DEFAULT 'gemini'")
            conn.commit()
        except:
            pass

    conn.close()

def validate_api_key(api_key):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    cursor.execute(qry("SELECT id, name, status FROM apps WHERE api_key = ? LIMIT 1"), (api_key,))
    row = cursor.fetchone()
    conn.close()
    if row and row["status"] == "active":
        return {"id": row["id"], "name": row["name"]}
    return None

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

def get_stats():
    conn = get_db_connection()
    cursor = get_cursor(conn)
    
    apps_tbl = "public.apps" if DATABASE_URL else "apps"
    accounts_tbl = "public.gemini_accounts" if DATABASE_URL else "gemini_accounts"
    logs_tbl = "public.request_logs" if DATABASE_URL else "request_logs"

    # Total Requests
    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {logs_tbl}"))
    row = cursor.fetchone()
    total_requests = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    total_requests = total_requests or 0
    
    # Success Rate
    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {logs_tbl} WHERE status_code = 200"))
    row = cursor.fetchone()
    success_requests = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    success_requests = success_requests or 0
    success_rate = (success_requests / total_requests * 100) if total_requests > 0 else 0
    
    # Average Duration
    cursor.execute(qry(f"SELECT AVG(duration_ms) as avg_dur FROM {logs_tbl} WHERE status_code = 200"))
    row = cursor.fetchone()
    avg_duration = row["avg_dur"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    avg_duration = avg_duration or 0
    
    # Active accounts
    cursor.execute(qry(f"SELECT COUNT(*) as cnt FROM {accounts_tbl} WHERE status = 'active'"))
    row = cursor.fetchone()
    active_accounts = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    active_accounts = active_accounts or 0

    # Recent Logs
    cursor.execute(qry(f"""
        SELECT l.id, a.name as app_name, l.prompt_length, l.response_length, l.duration_ms, l.status_code, l.created_at
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
        "recent_logs": recent_logs
    }

def get_profile(username):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.profiles" if DATABASE_URL else "profiles"
    cursor.execute(qry(f"SELECT * FROM {table_name} WHERE username = ?"), (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def save_profile(username, full_name, email, language, avatar_name, avatar_image_url):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.profiles" if DATABASE_URL else "profiles"
    if DATABASE_URL:
        cursor.execute(qry(f"""
            INSERT INTO {table_name} (username, full_name, email, language, avatar_name, avatar_image_url)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (username) DO UPDATE
            SET full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                language = EXCLUDED.language,
                avatar_name = EXCLUDED.avatar_name,
                avatar_image_url = EXCLUDED.avatar_image_url
        """), (username, full_name, email, language, avatar_name, avatar_image_url))
    else:
        cursor.execute(f"""
            INSERT OR REPLACE INTO profiles (username, full_name, email, language, avatar_name, avatar_image_url)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (username, full_name, email, language, avatar_name, avatar_image_url))
    conn.commit()
    conn.close()

def register_user(username, email, password, full_name):
    from werkzeug.security import generate_password_hash
    password_hash = generate_password_hash(password)
    
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.profiles" if DATABASE_URL else "profiles"
    
    # Check if username or email already exists
    cursor.execute(qry(f"SELECT username FROM {table_name} WHERE username = ? OR email = ?"), (username, email))
    if cursor.fetchone():
        conn.close()
        raise Exception("Usuário ou e-mail já cadastrado!")
        
    cursor.execute(qry(f"""
        INSERT INTO {table_name} (username, email, full_name, password_hash, language, avatar_name, avatar_image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """), (username, email, full_name, password_hash, "pt", "Professor", ""))
    
    conn.commit()
    conn.close()
    return True

def authenticate_user(username_or_email, password):
    from werkzeug.security import check_password_hash
    conn = get_db_connection()
    cursor = get_cursor(conn)
    table_name = "public.profiles" if DATABASE_URL else "profiles"
    
    cursor.execute(qry(f"SELECT * FROM {table_name} WHERE username = ? OR email = ?"), (username_or_email, username_or_email))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        user_dict = dict(row)
        if user_dict.get("password_hash") and check_password_hash(user_dict["password_hash"], password):
            return user_dict
    return None

# =========================================================================
# WRITER.AI DATABASE HELPER FUNCTIONS
# =========================================================================

def create_writer_environment(username, name):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_environments" if DATABASE_URL else "writer_environments"
    if DATABASE_URL:
        cursor.execute(qry(f"INSERT INTO {tbl} (username, name) VALUES (?, ?) RETURNING id"), (username, name))
        row = cursor.fetchone()
        env_id = row["id"] if isinstance(row, dict) else row[0]
    else:
        cursor.execute(f"INSERT INTO writer_environments (username, name) VALUES (?, ?)", (username, name))
        env_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return env_id

def get_writer_environments(username):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_environments" if DATABASE_URL else "writer_environments"
    cursor.execute(qry(f"SELECT * FROM {tbl} WHERE username = ? ORDER BY created_at DESC"), (username,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_writer_environment(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_environments" if DATABASE_URL else "writer_environments"
    cursor.execute(qry(f"SELECT * FROM {tbl} WHERE id = ?"), (env_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def delete_writer_environment(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_environments" if DATABASE_URL else "writer_environments"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (env_id,))
    conn.commit()
    conn.close()

def add_writer_material(env_id, name, material_type, content_text):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
    cursor.execute(
        qry(f"INSERT INTO {tbl} (environment_id, name, material_type, content_text) VALUES (?, ?, ?, ?)"),
        (env_id, name, material_type, content_text)
    )
    conn.commit()
    conn.close()

def get_writer_materials(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
    cursor.execute(qry(f"SELECT id, name, material_type, created_at FROM {tbl} WHERE environment_id = ? ORDER BY created_at ASC"), (env_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_writer_materials_with_text(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
    cursor.execute(qry(f"SELECT id, name, material_type, content_text FROM {tbl} WHERE environment_id = ? ORDER BY created_at ASC"), (env_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_writer_material_text(material_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
    cursor.execute(qry(f"SELECT content_text FROM {tbl} WHERE id = ?"), (material_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)["content_text"]
    return ""

def delete_writer_material(material_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (material_id,))
    conn.commit()
    conn.close()

def save_writer_document(env_id, doc_id, title, content):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_documents" if DATABASE_URL else "writer_documents"
    
    # Check if doc_id exists
    has_doc = False
    if doc_id:
        cursor.execute(qry(f"SELECT id FROM {tbl} WHERE id = ?"), (doc_id,))
        if cursor.fetchone():
            has_doc = True
            
    if has_doc:
        cursor.execute(
            qry(f"UPDATE {tbl} SET title = ?, content = ?, updated_at = ? WHERE id = ?"),
            (title, content, datetime.utcnow().isoformat(), doc_id)
        )
        new_doc_id = doc_id
    else:
        if DATABASE_URL:
            cursor.execute(qry(f"INSERT INTO {tbl} (environment_id, title, content) VALUES (?, ?, ?) RETURNING id"), (env_id, title, content))
            row = cursor.fetchone()
            new_doc_id = row["id"] if isinstance(row, dict) else row[0]
        else:
            cursor.execute(f"INSERT INTO writer_documents (environment_id, title, content) VALUES (?, ?, ?)", (env_id, title, content))
            new_doc_id = cursor.lastrowid
            
    conn.commit()
    conn.close()
    return new_doc_id

def get_writer_documents(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_documents" if DATABASE_URL else "writer_documents"
    cursor.execute(qry(f"SELECT * FROM {tbl} WHERE environment_id = ? ORDER BY updated_at DESC"), (env_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_writer_document(doc_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_documents" if DATABASE_URL else "writer_documents"
    cursor.execute(qry(f"SELECT * FROM {tbl} WHERE id = ?"), (doc_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_writer_messages(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_messages" if DATABASE_URL else "writer_messages"
    cursor.execute(qry(f"SELECT * FROM {tbl} WHERE environment_id = ? ORDER BY created_at ASC"), (env_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_writer_message(env_id, sender, message):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_messages" if DATABASE_URL else "writer_messages"
    cursor.execute(
        qry(f"INSERT INTO {tbl} (environment_id, sender, message) VALUES (?, ?, ?)"),
        (env_id, sender, message)
    )
    conn.commit()
    conn.close()

def delete_writer_document(doc_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_documents" if DATABASE_URL else "writer_documents"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (doc_id,))
    conn.commit()
    conn.close()
