# Contabo worker deployment

This is the permanent worker path: DevLogue on Vercel calls a token-protected control service on the Contabo VPS, and that service starts/stops the render/transcription worker.

## Current Coolify deployment

- Coolify host: `coolify.kiganza.online` on `178.18.246.145`. Note: `84.247.129.45` is a different VPS and does not host this app.
- App: `devlogue-worker`, Dockerfile `/Dockerfile.worker`, internal port `4100`, health check `/health`.
- Public URL: `https://worker.178.18.246.145.sslip.io` (sslip.io DNS). Move to `worker.kiganza.online` after adding a DNS record.
- Coolify env: `DATABASE_URL`, `R2_*`, `WORKER_CONTROL_TOKEN`, `WORKER_CONTROL_AUTOSTART=true`, `WHISPER_MODEL=base.en`.
- Vercel Production: `WORKER_CONTROL_URL` and `WORKER_CONTROL_TOKEN` set. `/health` returns `200`; `/status` reports `running`.

## Prerequisites

- Access to the Coolify dashboard/API (preferred) or SSH to the VPS.
- The DevLogue repository, or a deploy key for a private repository.
- A MySQL/Neon `DATABASE_URL` and the R2 credentials.
- A public HTTPS hostname for the control service.

The current VPS exposes 80/443 through Coolify Traefik. SSH 22 and common alternate ports are closed from the deployment machine, so Coolify is the primary deployment path.

## Bootstrap (systemd fallback)

On the VPS:

```bash
export REPO_URL="git@github.com:eazypickins001-tech/DevLogue.git"
bash deploy/contabo/bootstrap.sh
```

If the repository is private, configure a deploy key first or clone with an HTTPS token.

The script installs Node 22, FFmpeg, Python, faster-whisper requirements, creates the `devlogue` service user, installs `devlogue-worker.service`, and starts the control service.

## Configure secrets

Edit:

```bash
sudo nano /etc/devlogue/worker.env
```

Set:

```dotenv
DATABASE_URL=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
WORKER_CONTROL_TOKEN=a-long-random-token
WORKER_CONTROL_AUTOSTART=true
```

Then:

```bash
sudo systemctl restart devlogue-worker
sudo systemctl status devlogue-worker
curl http://127.0.0.1:4100/health
```

## Expose it safely

Do not publish port `4100` directly. The current deployment uses Coolify Traefik with an `sslip.io` hostname and a valid HTTPS certificate. A Cloudflare Tunnel is optional for a stable custom hostname.

For a custom domain, point a DNS record at the Coolify host and set the Coolify app FQDN to `https://worker.kiganza.online`. Then set in Vercel Production:

```dotenv
WORKER_CONTROL_URL=https://worker.178.18.246.145.sslip.io
WORKER_CONTROL_TOKEN=a-long-random-token
```

Redeploy the app. The Video Production page should show the worker as configured and stopped/running.

## Security

- Keep the control service bound inside the container; publish it only through Traefik or a tunnel.
- Use a long random token.
- Do not put the token in client code or Git.
- Restrict the tunnel hostname if Cloudflare Access is available.
- The control service can start a process on the VPS; treat the token like an admin credential.

## Verification

```bash
curl -H "Authorization: Bearer $WORKER_CONTROL_TOKEN" https://worker.178.18.246.145.sslip.io/status
```

Then in DevLogue:

1. Open Video Production.
2. Confirm `Worker control` is configured.
3. Start the worker.
4. Queue a short timeline render.
5. Confirm the job moves to running then succeeded.
