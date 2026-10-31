#!/usr/bin/env bash
# ==============================================================================
# ANIME-PLOT STUDIO - Startup Script
# ==============================================================================

DIR="/home/gtu-itr/anime-story-studio"
export PATH="/home/gtu-itr/tools/node/bin:$PATH"
export LD_LIBRARY_PATH="/home/gtu-itr/pgsql/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH}"

cd "$DIR"

# Check if anime-plot-studio is already running
PID_FILE="$DIR/server.pid"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1 && grep -q "server.js" "/proc/$OLD_PID/cmdline" 2>/dev/null; then
    echo "[ANIME-PLOT STUDIO] Server is already running on PID: $OLD_PID"
    echo "URL: http://127.0.0.1:4000"
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

mkdir -p "$DIR/logs"

echo "[ANIME-PLOT STUDIO] Starting ANIME-PLOT STUDIO on port 4000..."
nohup node server.js </dev/null >> "$DIR/logs/anime_studio.log" 2>&1 &
SERVER_PID=$!
disown $SERVER_PID 2>/dev/null || true
echo "$SERVER_PID" > "$PID_FILE"

sleep 2

if ps -p $SERVER_PID > /dev/null; then
  echo "[SUCCESS] ANIME-PLOT STUDIO is running!"
  echo "URL: http://127.0.0.1:4000"
  echo "PID: $SERVER_PID"
  echo "Logs: $DIR/logs/anime_studio.log"
else
  echo "[ERROR] Failed to start server. Checking logs:"
  cat "$DIR/logs/anime_studio.log"
  exit 1
fi
