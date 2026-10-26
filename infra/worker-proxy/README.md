# DevLogue worker proxy

Cloudflare Worker that exposes the Contabo worker control service at a stable HTTPS hostname:

- Public hostname: `https://worker.kiganza.online`
- Origin: `https://worker.178.18.246.145.sslip.io`
- Allowed paths: `/health`, `/status`, `/start`, `/stop`

Deploy from the repository root:

```bash
npx wrangler deploy --config infra/worker-proxy/wrangler.toml
```

`WORKER_CONTROL_TOKEN` is not stored in this Worker. Vercel sends it in the
`Authorization` header and the origin validates it. Update `ORIGIN` in
`wrangler.toml` if the Coolify worker hostname changes.
