const EXTENSION_PATTERN = /(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i;
const IGNORED_PATTERNS = [
  /Script .*\/sw\.js load failed/i,
  /ServiceWorker intercepted the request and encountered an unexpected error/i,
  /^ChunkLoadError:/i,
  /Failed to load chunk/i,
  /due to access control checks/i,
];

export function isExtensionError(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === "string" && EXTENSION_PATTERN.test(value));
}

export function isIgnorableClientError(...values: Array<string | null | undefined>): boolean {
  if (isExtensionError(...values)) return true;
  return values.some(
    (value) =>
      typeof value === "string" && IGNORED_PATTERNS.some((pattern) => pattern.test(value)),
  );
}
