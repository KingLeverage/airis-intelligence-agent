/** URL-safe slug from a space name (used at creation; not a unique constraint in MVP). */
export function slugFromName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "space";
}
