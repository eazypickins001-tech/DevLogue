#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/devlogue}"
REPO_URL="${REPO_URL:?Set REPO_URL to the DevLogue Git repository before running.}"

if ! id devlogue >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash devlogue
fi

apt-get update
apt-get install -y git curl ca-certificates ffmpeg python3 python3-venv python3-pip build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pnpm@10

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
chown -R devlogue:devlogue "$APP_DIR"

runuser -u devlogue -- bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile"
runuser -u devlogue -- bash -lc "cd '$APP_DIR' && python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements-worker.txt"

install -d -m 750 /etc/devlogue
if [ ! -f /etc/devlogue/worker.env ]; then
  install -m 640 -o root -g devlogue deploy/contabo/worker.env.example /etc/devlogue/worker.env
  echo "Created /etc/devlogue/worker.env. Fill in DATABASE_URL, R2 settings and WORKER_CONTROL_TOKEN."
fi

install -m 644 deploy/contabo/devlogue-worker.service /etc/systemd/system/devlogue-worker.service
systemctl daemon-reload
systemctl enable devlogue-worker
systemctl restart devlogue-worker

echo "Worker control installed."
echo "Edit /etc/devlogue/worker.env, then run: systemctl restart devlogue-worker"
echo "It listens on 127.0.0.1:4100. Expose it with a Cloudflare Tunnel and set WORKER_CONTROL_URL in Vercel."
