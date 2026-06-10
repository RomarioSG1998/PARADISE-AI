import psycopg2
import os
from dotenv import load_dotenv

load_dotenv(".env")
url = os.getenv("DATABASE_URL")
conn = psycopg2.connect(url)
conn.autocommit = True
cur = conn.cursor()

# Kill all queries that are blocking
cur.execute("""
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state IN ('idle in transaction', 'active')
AND pid <> pg_backend_pid();
""")

print("Killed lingering connections.")
