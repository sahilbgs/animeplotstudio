#!/usr/bin/env bash
# ==============================================================================
# ANIME-PLOT STUDIO - Public Tunnel (localtunnel)
# ==============================================================================

DIR="/home/gtu-itr/anime-story-studio"
LOG="$DIR/logs/domain_tunnel.log"
URL_FILE="$DIR/public_url.txt"
PID_FILE="$DIR/tunnel.pid"

export PATH="/home/gtu-itr/tools/node/bin:$PATH"

mkdir -p "$DIR/logs"

# Kill previous tunnel if running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ps -p "$OLD_PID" > /dev/null 2>&1; then
    kill "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

echo "[Tunnel] Starting localtunnel on port 4000 with subdomain anime-story-studio..."
nohup npx --yes localtunnel --port 4000 --subdomain anime-story-studio </dev/null > "$LOG" 2>&1 &
TUNNEL_PID=$!
disown $TUNNEL_PID 2>/dev/null || true
echo "$TUNNEL_PID" > "$PID_FILE"

COUNT=0
while [ $COUNT -lt 15 ]; do
  sleep 1
  COUNT=$((COUNT + 1))
  URL=$(grep -o 'https://[-a-zA-Z0-9@:%._\+~#=]*\.loca\.lt' "$LOG" | head -n 1)
  if [ -n "$URL" ]; then
    echo "$URL" > "$URL_FILE"
    echo "=========================================================="
    echo "🌐 PUBLIC LIVE URL READY: $URL"
    echo "=========================================================="
    exit 0
  fi
done

echo "https://anime-story-studio.loca.lt" > "$URL_FILE"
echo "🌐 Default Public URL: https://anime-story-studio.loca.lt"
