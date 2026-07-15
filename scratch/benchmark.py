import requests
import psutil
import time
import threading
import pandas as pd
import numpy as np

# 1. Find uvicorn processes
uvicorn_procs = []
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cmd = p.info['cmdline']
        if cmd and 'uvicorn' in ' '.join(cmd) and 'app.main:app' in ' '.join(cmd):
            uvicorn_procs.append(psutil.Process(p.info['pid']))
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

if not uvicorn_procs:
    print("Uvicorn is not running. Please start the backend.")
    exit(1)

print(f"Found Backend Processes: {[p.pid for p in uvicorn_procs]}")

def get_total_ram():
    total = 0
    for p in uvicorn_procs:
        try:
            total += p.memory_info().rss / 1024 / 1024
        except:
            pass
    return total

def get_total_cpu():
    total = 0
    for p in uvicorn_procs:
        try:
            total += p.cpu_percent(interval=0.1)
        except:
            pass
    return total

# Monitor thread to capture max CPU/RAM during request
max_cpu = 0
max_ram = 0
monitoring = False

def monitor_process():
    global max_cpu, max_ram, monitoring
    while monitoring:
        cpu = get_total_cpu()
        ram = get_total_ram()
        if cpu > max_cpu: max_cpu = cpu
        if ram > max_ram: max_ram = ram

# 2. Generate typical survey data (e.g. 500 rows, 30 columns)
print("Generating sample survey data (500 rows, 30 cols)...")
np.random.seed(42)
data = np.random.randint(1, 6, size=(500, 30))
cols = [f"var_{i}" for i in range(1, 31)]
df = pd.DataFrame(data, columns=cols)
df.to_csv("benchmark_sample.csv", index=False)

time.sleep(1) # wait to stabilize
base_ram = get_total_ram()
print(f"Base Memory before upload: {base_ram:.2f} MB")

# 3. Upload File
url_upload = "http://127.0.0.1:8000/api/upload"
headers = {
    "X-Session-Id": "benchmark_session_1",
    "X-Project-Id": "benchmark_project"
}

with open("benchmark_sample.csv", "rb") as f:
    files = {"file": ("benchmark_sample.csv", f, "text/csv")}
    res = requests.post(url_upload, files=files, headers=headers)

time.sleep(1)
post_upload_ram = get_total_ram()
ram_per_user = post_upload_ram - base_ram
print(f"Memory after upload: {post_upload_ram:.2f} MB")
print(f"Memory consumed by 1 user's data (500 rows, 30 cols): {ram_per_user:.2f} MB")

# 4. Run Analysis (e.g., EFA)
print("\nRunning Factor Analysis to measure calculation load...")
url_efa = "http://127.0.0.1:8000/api/analysis/efa"
payload = {
    "columns": cols,
    "method": "ml",
    "rotation": "varimax"
}

monitoring = True
t = threading.Thread(target=monitor_process)
t.start()

start_time = time.time()
res_efa = requests.post(url_efa, json=payload, headers=headers)
calc_time = time.time() - start_time

monitoring = False
t.join()

print(f"Calculation Time: {calc_time:.3f} seconds")
print(f"Max CPU spike during calculation: {max_cpu}%")
print(f"Peak Memory during calculation: {max_ram:.2f} MB (Spike of {max_ram - post_upload_ram:.2f} MB)")

# Clean up
import os
if os.path.exists("benchmark_sample.csv"):
    os.remove("benchmark_sample.csv")

print("\n" + "="*50)
print("SERVER CAPACITY ESTIMATE")
print(f"1 User Data footprint: ~{max(0.1, ram_per_user):.2f} MB")
print(f"1 User Calculation CPU time: ~{calc_time:.3f}s (Spikes to {max_cpu}%)")
print("="*50)
