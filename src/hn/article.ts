import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface TextFetchResponse {
  ok: boolean;
  text(): Promise<string>;
}
export type TextFetchLike = (url: string) => Promise<TextFetchResponse>;

const DEFAULT_MAX_CHARS = 5000;

// Fetch a URL and extract its main readable text. Best-effort: any failure
// (non-ok response, unparseable HTML, network error) yields "".
export async function fetchArticleText(
  url: string,
  fetchImpl: TextFetchLike = fetch,
  maxChars: number = DEFAULT_MAX_CHARS,
): Promise<string> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return "";
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const parsed = new Readability(dom.window.document).parse();
    const text = (parsed?.textContent ?? "").replace(/\s+/g, " ").trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}
