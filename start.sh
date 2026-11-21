#!/bin/bash
cd "$(dirname "$0")"
echo "Gammal Meet Links: http://localhost:8080  (Ctrl+C to stop)"
( sleep 1; open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 ) &
python3 -m http.server 8080 --bind 127.0.0.1
