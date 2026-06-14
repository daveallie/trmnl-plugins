import type {
  HnItemResponse,
  HnSearchResponse,
  HnStory,
} from "./types.ts";

const HN_BASE = "https://hn.algolia.com/api/v1";

// Minimal response shape so a fake fetch can be injected in tests.
export interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}
export type FetchLike = (url: string) => Promise<FetchResponse>;

export interface HnClient {
  getTopStories(opts: { since: number; hitsPerPage?: number }): Promise<HnStory[]>;
  getTopComments(storyId: number, limit: number): Promise<string[]>;
}

export interface HnClientOptions {
  fetchImpl?: FetchLike;
}

export function parseSearchHits(data: HnSearchResponse): HnStory[] {
  return (data.hits ?? [])
    .map((h) => ({
      id: Number(h.objectID),
      title: h.title ?? "",
      url: h.url ?? undefined,
      author: h.author ?? "",
      points: h.points ?? 0,
      num_comments: h.num_comments ?? 0,
      created_at_i: h.created_at_i ?? 0,
    }))
    .filter((s) => s.title !== "" && Number.isFinite(s.id));
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createHnClient({ fetchImpl = fetch }: HnClientOptions = {}): HnClient {
  async function getTopStories({
    since,
    hitsPerPage = 30,
  }: {
    since: number;
    hitsPerPage?: number;
  }): Promise<HnStory[]> {
    const filter = encodeURIComponent(`created_at_i>${since}`);
    const url = `${HN_BASE}/search?tags=story&numericFilters=${filter}&hitsPerPage=${hitsPerPage}`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      throw new Error(`HN API returned ${res.status}`);
    }
    return parseSearchHits((await res.json()) as HnSearchResponse);
  }

  async function getTopComments(storyId: number, limit: number): Promise<string[]> {
    try {
      const res = await fetchImpl(`${HN_BASE}/items/${storyId}`);
      if (!res.ok) return [];
      const data = (await res.json()) as HnItemResponse;
      return (data.children ?? [])
        .map((c) => stripHtml(c.text ?? ""))
        .filter((t) => t !== "")
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  return { getTopStories, getTopComments };
}
