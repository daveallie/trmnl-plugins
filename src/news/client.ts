// Fetches plain RSS feeds and extracts item headlines. Used by the briefing's
// news digest to blend general/world news (e.g. ABC, BBC) with the HN headlines.

// Minimal response shape so a fake fetch can be injected in tests.
export interface TextFetchResponse {
  ok: boolean;
  status?: number;
  text(): Promise<string>;
}
export type TextFetchLike = (url: string) => Promise<TextFetchResponse>;

export interface NewsClient {
  // Resolves to the feed's item titles in document order. Throws on a non-ok
  // response so callers can degrade that source independently.
  getHeadlines(feedUrl: string): Promise<string[]>;
}

export interface NewsClientOptions {
  fetchImpl?: TextFetchLike;
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

// Decode the handful of entities that show up in headlines. &amp; is decoded
// last so an encoded "&amp;lt;" doesn't turn into "<".
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Extract the first <title> of each <item> (RSS 2.0). Channel/image titles live
// outside <item> blocks, so they're naturally excluded.
export function parseRssTitles(xml: string): string[] {
  const titles: string[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/i;
  for (const item of xml.matchAll(itemRe)) {
    const match = item[0].match(titleRe);
    if (!match) continue;
    const title = decodeEntities(stripCdata(match[1] ?? "")).trim();
    if (title) titles.push(title);
  }
  return titles;
}

export function createNewsClient({
  fetchImpl = fetch as unknown as TextFetchLike,
}: NewsClientOptions = {}): NewsClient {
  return {
    async getHeadlines(feedUrl: string): Promise<string[]> {
      const res = await fetchImpl(feedUrl);
      if (!res.ok) {
        throw new Error(`News feed returned ${res.status}`);
      }
      return parseRssTitles(await res.text());
    },
  };
}
