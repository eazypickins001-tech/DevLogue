import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes("The destination stream errored while writing data") ||
      message.includes("NEXT_REDIRECT") ||
      message.includes("NEXT_NOT_FOUND")
    ) {
      return;
    }
  }
  const { captureError } = await import("@/lib/errors/capture");
  const header = (name: string): string | null => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  };
  await captureError({
    source: "server",
    severity: "error",
    error,
    route: request.path,
    action: context.routeType,
    requestId: header("x-vercel-id") ?? header("x-request-id"),
    traceId: header("x-vercel-id"),
    userAgent: header("user-agent"),
    context: {
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource ?? null,
      revalidateReason: context.revalidateReason ?? null,
    },
  });
};
