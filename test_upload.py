import requests
import sqlite3

# find an environment id from the database to test with
conn = sqlite3.connect('database.sqlite')
cursor = conn.cursor()
cursor.execute("SELECT id FROM writer_environments LIMIT 1")
env_id = cursor.fetchone()[0]

url = f"http://localhost:5000/api/writer/environments/{env_id}/materials"
files = {'file': ('test.txt', 'This is a test upload')}
data = {'name': 'Test Material', 'material_type': 'reference'}
# we don't have the real session cookie, so this will return unauthorized if it reaches flask

response = requests.post(url, files=files, data=data)
print(response.status_code)
print(response.text)
