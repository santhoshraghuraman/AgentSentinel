$env:OLLAMA_MODEL="qwen3:4b"
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m uvicorn src.agentsentinel.api.main:app --host 127.0.0.1 --port 8000"
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "ui"
while($true) { Start-Sleep -Seconds 10 }
