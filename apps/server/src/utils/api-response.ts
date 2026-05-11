export function apiOk<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function apiErr(code: string, message: string): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code, message } };
}
