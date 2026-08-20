// Shared by every service that proxies a fetch to a user-supplied URL
// (external GeoJSON layers, plugin data, plugin metadata) — reads a
// Response body while enforcing a byte cap, checking both the declared
// Content-Length header and (since that header can be missing or wrong) the
// actual streamed size.
export async function readBodyWithLimit(response: Response, maxBytes: number, onExceeded: () => never): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    onExceeded();
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      onExceeded();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
}
