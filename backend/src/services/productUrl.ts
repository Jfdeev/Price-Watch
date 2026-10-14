export function normalizeProductUrl(value?: string | null): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  try {
    const url = new URL(value);
    const normalized = `${url.origin}${url.pathname}${url.search}`;
    return normalized.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export function toNormalizedProductUrlColumn(value?: string | null): string | null {
  const normalized = normalizeProductUrl(value);
  return normalized.length > 0 ? normalized : null;
}
