import { describe, expect, it } from "vitest";
import {
  MAX_BODY_BYTES,
  RequestBodyTooLarge,
  readCappedBody,
} from "./request-body";

function chunkedBody(chunks: Uint8Array[], cancel: () => void = () => {}) {
  let next = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (next < chunks.length) controller.enqueue(chunks[next++]);
        else controller.close();
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
}

describe("capped workspace request body", () => {
  it("rejects a lengthless chunked body and cancels remaining chunks", async () => {
    let cancelled = false;
    const stream = chunkedBody(
      [new Uint8Array(70_000), new Uint8Array(70_000), new Uint8Array(70_000)],
      () => {
        cancelled = true;
      },
    );
    const request = new Request("http://localhost/api/workspace", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(request.headers.has("content-length")).toBe(false);
    await expect(readCappedBody(request.body)).rejects.toBeInstanceOf(
      RequestBodyTooLarge,
    );
    expect(cancelled).toBe(true);
  });

  it("counts UTF-8 bytes rather than decoded characters", async () => {
    const text = "é".repeat(66_000);
    const encoded = new TextEncoder().encode(text);
    expect(text.length).toBeLessThan(MAX_BODY_BYTES);
    expect(encoded.byteLength).toBeGreaterThan(MAX_BODY_BYTES);
    await expect(
      readCappedBody(
        chunkedBody([encoded.subarray(0, 65_535), encoded.subarray(65_535)]),
      ),
    ).rejects.toBeInstanceOf(RequestBodyTooLarge);
  });

  it("parses a permitted JSON body with UTF-8 split across chunks", async () => {
    const expected = { action: "job.close", payload: { id: "vacancy-🙂" } };
    const bytes = new TextEncoder().encode(JSON.stringify(expected));
    const result = await readCappedBody(
      chunkedBody([
        bytes.subarray(0, bytes.length - 4),
        bytes.subarray(bytes.length - 4),
      ]),
    );
    expect(JSON.parse(result)).toEqual(expected);
  });

  it("accepts the exact byte boundary and rejects the next byte", async () => {
    const exact = new Uint8Array(MAX_BODY_BYTES).fill(32);
    await expect(readCappedBody(chunkedBody([exact]))).resolves.toHaveLength(
      MAX_BODY_BYTES,
    );
    await expect(
      readCappedBody(chunkedBody([exact, new Uint8Array([32])])),
    ).rejects.toBeInstanceOf(RequestBodyTooLarge);
  });
});
