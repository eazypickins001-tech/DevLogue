import "server-only";

import { redirect } from "next/navigation";

export function redirectWith(
  path: string,
  params: Record<string, string | undefined>,
): never {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  if (!query) redirect(path);
  const [base, hash] = path.split("#");
  redirect(`${base}?${query}${hash ? `#${hash}` : ""}`);
}

export function redirectError(path: string, message: string): never {
  return redirectWith(path, { error: message });
}

export function redirectSuccess(path: string, message: string): never {
  return redirectWith(path, { message });
}
