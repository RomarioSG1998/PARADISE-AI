"""
database/schema.py
Responsible for initializing all database tables (SQLite and PostgreSQL).
"""
import os
import secrets
from dotenv import load_dotenv
from .connection import get_db_connection, get_cursor, DATABASE_URL, qry

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(root_dir, ".env")


def init_db():
    conn = get_db_connection()
    cursor = get_cursor(conn)

    if not DATABASE_URL:
        _create_sqlite_tables(cursor)
        conn.commit()
    else:
        _create_postgres_tables(cursor, conn)

    _seed_apps(cursor, conn)
    _migrate_env_accounts(cursor, conn)
    _apply_migrations(cursor, conn)

    conn.close()


def _create_sqlite_tables(cursor):
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
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
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_environments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT REFERENCES profiles(username) ON DELETE CASCADE,
        name TEXT NOT NULL,
        production_context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
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
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_contexts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_agents (
        id TEXT PRIMARY KEY,
        environment_id INTEGER REFERENCES writer_environments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT,
        system_prompt TEXT,
        is_leader BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS writer_agent_messages (
        id TEXT PRIMARY KEY,
        agent_id TEXT REFERENCES writer_agents(id) ON DELETE CASCADE,
        sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)


def _create_postgres_tables(cursor, conn):
    try:
        cursor.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS public.writer_environments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username TEXT REFERENCES public.profiles(username) ON DELETE CASCADE,
            name TEXT NOT NULL,
            production_context TEXT,
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
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS public.writer_contexts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            environment_id UUID REFERENCES public.writer_environments(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            content_text TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS public.writer_agents (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            environment_id UUID REFERENCES public.writer_environments(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            role TEXT,
            system_prompt TEXT,
            is_leader BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS public.writer_agent_messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id UUID REFERENCES public.writer_agents(id) ON DELETE CASCADE,
            sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
            message TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
        """)
        conn.commit()
    except Exception as e:
        print(f"Error initializing postgres writer tables: {e}")
        conn.rollback()


def _seed_apps(cursor, conn):
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


def _migrate_env_accounts(cursor, conn):
    cursor.execute(qry("SELECT COUNT(*) as cnt FROM gemini_accounts"))
    row = cursor.fetchone()
    account_count = row["cnt"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
    if account_count == 0:
        load_dotenv(ENV_PATH, override=True)
        secure_1psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        secure_1psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        if secure_1psid and secure_1psidts:
            cursor.execute(
                qry("INSERT INTO gemini_accounts (name, secure_1psid, secure_1psidts, status) VALUES (?, ?, ?, ?)"),
                ("Conta Pro Migrada (.env)", secure_1psid, secure_1psidts, "active")
            )
            conn.commit()
            print("[AI Hub DB] Successfully migrated old .env cookies to database pool.")


def _apply_migrations(cursor, conn):
    if DATABASE_URL:
        cursor.execute("ALTER TABLE public.gemini_accounts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'gemini'")
        cursor.execute("ALTER TABLE public.writer_environments ADD COLUMN IF NOT EXISTS production_context TEXT")
        conn.commit()
    else:
        for sql in [
            "ALTER TABLE gemini_accounts ADD COLUMN provider TEXT DEFAULT 'gemini'",
            "ALTER TABLE writer_environments ADD COLUMN production_context TEXT",
        ]:
            try:
                cursor.execute(sql)
                conn.commit()
            except Exception:
                pass
