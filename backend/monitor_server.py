import psutil
import time
import os

def print_system_stats():
    # 1. System overall stats
    cpu_percent = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # disk io
    io_start = psutil.disk_io_counters()
    time.sleep(1)
    io_end = psutil.disk_io_counters()
    
    read_speed = (io_end.read_bytes - io_start.read_bytes) / 1024 / 1024 # MB/s
    write_speed = (io_end.write_bytes - io_start.write_bytes) / 1024 / 1024 # MB/s
    
    print("="*40)
    print("System Overall Status")
    print(f"CPU Usage: {cpu_percent}%")
    print(f"Memory Usage: {mem.percent}% ({mem.used/1024/1024/1024:.2f}GB / {mem.total/1024/1024/1024:.2f}GB)")
    print(f"Disk Usage: {disk.percent}% ({disk.used/1024/1024/1024:.2f}GB / {disk.total/1024/1024/1024:.2f}GB)")
    print(f"Disk I/O Speed: Read {read_speed:.2f} MB/s | Write {write_speed:.2f} MB/s")
    
    # 2. Uvicorn process stats
    print("\nUvicorn (Backend) Process Status")
    found = False
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = p.info['cmdline']
            if cmd and 'uvicorn' in ' '.join(cmd) and 'app.main:app' in ' '.join(cmd):
                p_mem = p.memory_info()
                p_cpu = p.cpu_percent(interval=0.1)
                print(f"PID: {p.info['pid']}")
                print(f"CPU: {p_cpu}%")
                print(f"Memory (RAM): {p_mem.rss / 1024 / 1024:.2f} MB")
                found = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
            
    if not found:
        print("Uvicorn process not found. Is the backend running?")
    print("="*40)

if __name__ == "__main__":
    print_system_stats()
