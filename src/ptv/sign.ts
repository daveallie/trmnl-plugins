import { createHmac } from "node:crypto";

export function signRequest(apiKey: string, requestPath: string): string {
  return createHmac("sha1", apiKey).update(requestPath).digest("hex").toUpperCase();
}
