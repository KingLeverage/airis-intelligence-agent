/** Normalize user-entered URL to http(s), or preserve about: URLs. Throws if still invalid. */
export function normalizeHttpUrl(input: string): string {
  const t = input.trim();
  if (!t) {
    throw new Error("empty_url");
  }
  if (/^about:/i.test(t)) {
    try {
      return new URL(t).toString();
    } catch {
      throw new Error("invalid_url");
    }
  }
  try {
    const u = new URL(t);
    if (!/^https?:$/i.test(u.protocol)) {
      throw new Error("invalid_protocol");
    }
    return u.toString();
  } catch {
    try {
      const u = new URL(`https://${t}`);
      if (!u.hostname) throw new Error("invalid_host");
      return u.toString();
    } catch {
      throw new Error("invalid_url");
    }
  }
}
