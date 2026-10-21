import subprocess
import sys
import os
import time
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def main():
    log = open("services.log", "w")
    cwd = r"C:\Users\91959\Documents\Agent Sentinel\AgentSentinel"
    
    # Start Backend
    if not is_port_in_use(8000):
        print("Starting backend...")
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "src.agentsentinel.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=cwd,
            env={**os.environ, "PYTHONPATH": "."},
            stdout=log,
            stderr=subprocess.STDOUT
        )
    else:
        print("Backend already running on port 8000.")
        
    # Start Frontend
    if not is_port_in_use(5173):
        print("Starting frontend...")
        ui_cwd = os.path.join(cwd, "ui")
        subprocess.Popen(
            ["npm.cmd", "run", "dev"],
            cwd=ui_cwd,
            stdout=log,
            stderr=subprocess.STDOUT
        )
    else:
        print("Frontend already running on port 5173.")
        
    time.sleep(3)
    print("Services check complete.")

if __name__ == "__main__":
    main()
