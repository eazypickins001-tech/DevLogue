const ALLOWED_PATHS = new Set(["/health", "/status", "/start", "/stop"]);

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (!ALLOWED_PATHS.has(incoming.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    if (incoming.pathname !== "/health" && !request.headers.get("authorization")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const target = new URL(incoming.pathname + incoming.search, env.ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", "https");

    return fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : request.body,
      redirect: "manual",
    });
  },
};
