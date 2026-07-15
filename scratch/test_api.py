import os
import requests
import time
import subprocess

print("Starting backend...")
python_exe = r"d:\test\claudecode\files\analysis-01\backend\venv\Scripts\python.exe"
proc = subprocess.Popen([python_exe, "-m", "uvicorn", "app.main:app", "--port", "8123"], cwd=r"d:\test\claudecode\files\analysis-01\backend")

time.sleep(5) # Wait for startup

try:
    print("Testing upload API with headers...")
    url = "http://127.0.0.1:8123/api/upload"
    
    # Create a dummy csv
    with open("dummy.csv", "w", encoding="utf-8") as f:
        f.write("A,B,C\n1,2,3\n4,5,6")
        
    with open("dummy.csv", "rb") as f:
        files = {"file": ("dummy.csv", f, "text/csv")}
        headers = {
            "X-Session-Id": "test-session-123",
            "X-Project-Id": "test-project-xyz"
        }
        res = requests.post(url, files=files, headers=headers)
        
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        if data.get("project_id") == "test-project-xyz":
            print("SUCCESS! API correctly read X-Project-Id and isolated the session.")
        else:
            print("FAILED: Wrong project ID returned.")
    else:
        print(f"Response: {res.text}")
            
    # Also test import_url
    url2 = "http://127.0.0.1:8123/api/import_url"
    res2 = requests.post(url2, json={"url": "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"}, headers=headers)
    print(f"Import URL Status: {res2.status_code}")
    
finally:
    proc.terminate()
    if os.path.exists("dummy.csv"):
        os.remove("dummy.csv")
