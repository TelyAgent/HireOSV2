/**
 * `crypto.randomUUID()` only exists in a "secure context" (HTTPS, or
 * localhost) -- the current deploy is plain HTTP on a public IP (see
 * PORTS.md "远程部署"), so `window.isSecureContext` is false there and
 * `crypto.randomUUID` is `undefined`. Calling it threw synchronously before
 * any request was even sent, which looked like "the button does nothing".
 * `crypto.getRandomValues()` has no such restriction, so build a UUID v4
 * from that instead of the convenience method.
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
