const EXTENSION_PATTERN = /(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i;

export function isExtensionError(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => typeof value === "string" && EXTENSION_PATTERN.test(value));
}
