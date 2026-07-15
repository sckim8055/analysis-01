import requests

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
