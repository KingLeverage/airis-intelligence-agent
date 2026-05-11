let flush: (() => Promise<void>) | null = null;

export function setSpacePreviewFlush(fn: (() => Promise<void>) | null): void {
  flush = fn;
}

export async function runSpacePreviewFlush(): Promise<void> {
  await flush?.();
}
