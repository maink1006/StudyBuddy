#!/bin/bash
cd "$(dirname "$0")" || exit 1
PORT=8000
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PORT=8001
fi
python3 -m http.server "$PORT" >/tmp/study-buddy-http.log 2>&1 &
SERVER_PID=$!
sleep 1
open "http://localhost:$PORT"
echo "Study Buddy is running at http://localhost:$PORT"
echo "Keep this Terminal window open while using the app. Press Control+C to stop."
wait "$SERVER_PID"
