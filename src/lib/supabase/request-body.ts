export const MAX_BODY_BYTES = 128 * 1024;
export class RequestBodyTooLarge extends Error {
  constructor() {
    super("This form is too large.");
    this.name = "RequestBodyTooLarge";
  }
}
export async function readCappedBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLarge();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteCount);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  } finally {
    reader.releaseLock();
  }
}
