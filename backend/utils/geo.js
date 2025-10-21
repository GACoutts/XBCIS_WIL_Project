export function normalizePlaceId(value) {
  if (!value) return null;
  // Remove v1 "places/" prefix if present and clamp length
  return String(value).replace(/^places\//, "").slice(0, 64);
}
