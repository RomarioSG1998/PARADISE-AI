from datetime import datetime
from .connection import get_db_connection, get_cursor, DATABASE_URL, qry

def create_writer_environment(username, name):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_environments" if DATABASE_URL else "writer_environments"
    if DATABASE_URL:
        cursor.execute(qry(f"INSERT INTO {tbl} (username, name) VALUES (?, ?) RETURNING id"), (username, name))
        row = cursor.fetchone()
        env_id = row["id"] if "id" in row else row[0]
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
    
    new_id = None
    if DATABASE_URL:
        cursor.execute(
            f"INSERT INTO {tbl} (environment_id, name, material_type, content_text) VALUES (%s, %s, %s, %s) RETURNING id",
            (env_id, name, material_type, content_text)
        )
        row = cursor.fetchone()
        if row:
            new_id = row["id"]
    else:
        cursor.execute(
            f"INSERT INTO {tbl} (environment_id, name, material_type, content_text) VALUES (?, ?, ?, ?)",
            (env_id, name, material_type, content_text)
        )
        new_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return new_id

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
            new_doc_id = row["id"] if "id" in row else row[0]
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

def clear_writer_messages(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_messages" if DATABASE_URL else "writer_messages"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE environment_id = ?"), (env_id,))
    conn.commit()
    conn.close()

def delete_writer_document(doc_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_documents" if DATABASE_URL else "writer_documents"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (doc_id,))
    conn.commit()
    conn.close()

def add_writer_context(env_id, name, content_text):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_contexts" if DATABASE_URL else "writer_contexts"
    cursor.execute(
        qry(f"INSERT INTO {tbl} (environment_id, name, content_text) VALUES (?, ?, ?)"),
        (env_id, name, content_text)
    )
    conn.commit()
    conn.close()

def get_writer_contexts(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_contexts" if DATABASE_URL else "writer_contexts"
    cursor.execute(qry(f"SELECT id, name, content_text, created_at FROM {tbl} WHERE environment_id = ? ORDER BY created_at ASC"), (env_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_writer_context(context_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_contexts" if DATABASE_URL else "writer_contexts"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (context_id,))
    conn.commit()
    conn.close()

def get_writer_material_details(material_id):
    import uuid as _uuid
    def is_valid_uuid(val):
        try:
            _uuid.UUID(str(val))
            return True
        except ValueError:
            return False

    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_materials" if DATABASE_URL else "writer_materials"

    row = None
    if DATABASE_URL:
        if is_valid_uuid(material_id):
            try:
                cursor.execute(f"SELECT id, name, content_text FROM {tbl} WHERE id = %s", (material_id,))
                row = cursor.fetchone()
            except Exception:
                conn.rollback()

        if not row:
            clean_term = str(material_id).lower().replace("material", "").replace("reference", "").replace("-", " ").replace("_", " ").strip()
            words = [w for w in clean_term.split() if len(w) >= 3]
            if words:
                conditions = ["name ILIKE %s" for _ in words]
                params = [f"%{w}%" for w in words]
                query = f"SELECT id, name, content_text FROM {tbl} WHERE " + " AND ".join(conditions) + " LIMIT 1"
                try:
                    cursor.execute(query, params)
                    row = cursor.fetchone()
                except Exception:
                    conn.rollback()
    else:
        cursor.execute(qry(f"SELECT id, name, content_text FROM {tbl} WHERE id = ?"), (material_id,))
        row = cursor.fetchone()
        if not row:
            clean_term = str(material_id).lower().replace("material", "").replace("reference", "").replace("-", " ").replace("_", " ").strip()
            words = [w for w in clean_term.split() if len(w) >= 3]
            if words:
                conditions = ["name LIKE ?" for _ in words]
                params = [f"%{w}%" for w in words]
                query = f"SELECT id, name, content_text FROM {tbl} WHERE " + " AND ".join(conditions) + " LIMIT 1"
                cursor.execute(qry(query), params)
                row = cursor.fetchone()

    conn.close()
    return dict(row) if row else None

# ─── WRITER AGENTS ──────────────────────────────────────────────────────────

def create_writer_agent(env_id, name, role, system_prompt, is_leader=False):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agents" if DATABASE_URL else "writer_agents"
    if DATABASE_URL:
        cursor.execute(
            f"INSERT INTO {tbl} (environment_id, name, role, system_prompt, is_leader) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (env_id, name, role, system_prompt, is_leader)
        )
        agent_id = cursor.fetchone()["id"]
    else:
        import uuid
        agent_id = str(uuid.uuid4())
        cursor.execute(
            qry(f"INSERT INTO {tbl} (id, environment_id, name, role, system_prompt, is_leader) VALUES (?,?,?,?,?,?)"),
            (agent_id, env_id, name, role, system_prompt, is_leader)
        )
    conn.commit()
    conn.close()
    return str(agent_id)

def get_writer_agents(env_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agents" if DATABASE_URL else "writer_agents"
    cursor.execute(qry(f"SELECT id, name, role, system_prompt, is_leader, created_at FROM {tbl} WHERE environment_id = ? ORDER BY is_leader DESC, created_at ASC"), (env_id,))
    rows = cursor.fetchall()
    
    agents = []
    tbl_msgs = "public.writer_agent_messages" if DATABASE_URL else "writer_agent_messages"
    for r in rows:
        agent = dict(r)
        # Find the last message for this agent
        cursor.execute(qry(f"SELECT sender, message FROM {tbl_msgs} WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1"), (agent["id"],))
        last_msg_row = cursor.fetchone()
        if last_msg_row:
            last_msg = dict(last_msg_row)
            agent["last_message"] = last_msg["message"]
            agent["last_message_sender"] = last_msg["sender"]
            agent["status"] = "working" if last_msg["sender"] == "user" else "idle"
        else:
            agent["last_message"] = None
            agent["last_message_sender"] = None
            agent["status"] = "idle"
        agents.append(agent)
        
    conn.close()
    return agents

def delete_writer_agent(agent_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agents" if DATABASE_URL else "writer_agents"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE id = ?"), (agent_id,))
    conn.commit()
    conn.close()

def get_writer_agent_messages(agent_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agent_messages" if DATABASE_URL else "writer_agent_messages"
    cursor.execute(qry(f"SELECT id, sender, message, created_at FROM {tbl} WHERE agent_id = ? ORDER BY created_at ASC"), (agent_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_writer_agent_message(agent_id, sender, message):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agent_messages" if DATABASE_URL else "writer_agent_messages"
    if DATABASE_URL:
        cursor.execute(f"INSERT INTO {tbl} (agent_id, sender, message) VALUES (%s,%s,%s)", (agent_id, sender, message))
    else:
        import uuid
        cursor.execute(qry(f"INSERT INTO {tbl} (id, agent_id, sender, message) VALUES (?,?,?,?)"), (str(uuid.uuid4()), agent_id, sender, message))
    conn.commit()
    conn.close()

def reset_writer_agent_messages(agent_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agent_messages" if DATABASE_URL else "writer_agent_messages"
    cursor.execute(qry(f"DELETE FROM {tbl} WHERE agent_id = ?"), (agent_id,))
    conn.commit()
    conn.close()

def get_writer_agent(agent_id):
    conn = get_db_connection()
    cursor = get_cursor(conn)
    tbl = "public.writer_agents" if DATABASE_URL else "writer_agents"
    cursor.execute(qry(f"SELECT id, name, role, system_prompt, is_leader FROM {tbl} WHERE id = ?"), (agent_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
