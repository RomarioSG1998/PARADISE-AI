from .connection import get_db_connection, get_cursor, DATABASE_URL, qry

def validate_api_key(api_key):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    cursor.execute(qry("SELECT id, name, status FROM apps WHERE api_key = ? LIMIT 1"), (api_key,))
    row = cursor.fetchone()
    conn.close()
    if row and row["status"] == "active":
        return {"id": row["id"], "name": row["name"]}
    return None

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
