/** UUID v4 for new entities (browser + Node 20+). */
export function newUuid(): string {
  return crypto.randomUUID();
}
