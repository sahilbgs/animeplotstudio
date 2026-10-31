#!/usr/bin/env bash
# ==============================================================================
# ANIME-PLOT STUDIO - Stop Script
# ==============================================================================

DIR="/home/gtu-itr/anime-story-studio"
PIDS=$(pgrep -f "node.*anime-story-studio.*server.js" || true)

if [ -z "$PIDS" ]; then
  # Try matching directory
  PIDS=$(pgrep -f "node server.js" | while read -r p; do
    if pwdx "$p" 2>/dev/null | grep -q "anime-story-studio"; then
      echo "$p"
    fi
  done)
fi

if [ -n "$PIDS" ]; then
  echo "Stopping ANIME-PLOT STUDIO PIDs: $PIDS"
  kill $PIDS
  sleep 1
  echo "[SUCCESS] Stopped ANIME-PLOT STUDIO."
else
  echo "[INFO] No running ANIME-PLOT STUDIO process found."
fi
