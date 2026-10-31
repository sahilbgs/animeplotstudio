#!/usr/bin/env bash
# ==============================================================================
# ANIME-PLOT STUDIO - Production Startup Script (PM2 Managed)
# ==============================================================================

DIR="/home/gtu-itr/anime-story-studio"
export PATH="/home/gtu-itr/tools/node/bin:$PATH"
export LD_LIBRARY_PATH="/home/gtu-itr/pgsql/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH}"

cd "$DIR"

if command -v pm2 >/dev/null 2>&1; then
  if pm2 list | grep -q "anime-plot-studio"; then
    pm2 restart anime-plot-studio
  else
    pm2 start server.js --name "anime-plot-studio"
  fi
  pm2 save
  echo "[SUCCESS] ANIME-PLOT STUDIO is running under PM2!"
else
  nohup node server.js </dev/null >> "$DIR/logs/anime_studio.log" 2>&1 &
  echo "[SUCCESS] ANIME-PLOT STUDIO started with nohup!"
fi

echo "Local:  http://127.0.0.1:4000"
echo "Public: https://anime.aceglory.in"
