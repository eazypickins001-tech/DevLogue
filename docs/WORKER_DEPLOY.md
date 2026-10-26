# Contabo worker deployment

This is the permanent worker path: DevLogue on Vercel calls a token-protected control service on the Contabo VPS, and that service starts/stops the render/transcription worker.

## Prerequisites

- SSH access to the VPS on a reachable port.
- The DevLogue repository cloned or a deploy key for a private repository.
- A MySQL/Neon `DATABASE_URL` and the R2 credentials.
- A public HTTPS hostname for the control service, normally through a Cloudflare Tunnel.

The VPS currently has ports 80 and 443 open, but port 22 and common alternate SSH ports were closed from the deployment machine. Open SSH access or run the bootstrap from the Contabo web console.

## Bootstrap

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

The control service must not be exposed as plain HTTP. Use a Cloudflare Tunnel with a hostname such as `worker.dominixai.com` and an origin of `http://127.0.0.1:4100`.

Create the tunnel/token in Cloudflare, install `cloudflared` on the VPS, and run the tunnel as a service. Then set in Vercel Production:

```dotenv
WORKER_CONTROL_URL=https://worker.dominixai.com
WORKER_CONTROL_TOKEN=a-long-random-token
```

Redeploy the app. The Video Production page should show the worker as configured and stopped/running.

## Security

- Keep `WORKER_CONTROL_HOST=127.0.0.1`.
- Use a long random token.
- Do not put the token in client code or Git.
- Restrict the tunnel hostname if Cloudflare Access is available.
- The control service can start a process on the VPS; treat the token like an admin credential.

## Verification

```bash
curl -H "Authorization: Bearer $WORKER_CONTROL_TOKEN" https://worker.dominixai.com/status
```

Then in DevLogue:

1. Open Video Production.
2. Confirm `Worker control` is configured.
3. Start the worker.
4. Queue a short timeline render.
5. Confirm the job moves to running then succeeded.
