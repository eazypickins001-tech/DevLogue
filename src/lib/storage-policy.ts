export const DEFAULT_STORAGE_WARNING_BYTES = 8 * 1024 ** 3;
export const DEFAULT_MEDIA_RETENTION_DAYS = 90;

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export function storageWarningLevel(
  bytes: number,
  warningBytes = DEFAULT_STORAGE_WARNING_BYTES,
): "ok" | "warning" {
  return bytes >= warningBytes ? "warning" : "ok";
}

export function storageWarningThreshold(): number {
  const configured = Number(process.env.STORAGE_WARNING_BYTES ?? DEFAULT_STORAGE_WARNING_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STORAGE_WARNING_BYTES;
}

export function mediaRetentionDays(): number {
  const configured = Number(process.env.MEDIA_RETENTION_DAYS ?? DEFAULT_MEDIA_RETENTION_DAYS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MEDIA_RETENTION_DAYS;
}

export function retentionCutoff(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
