import type { Plugin } from "../plugin.ts";
import type { HnClient } from "../hn/client.ts";
import type { HnStory } from "../hn/types.ts";
import type { Summarizer } from "../llm/claude.ts";
import type { SummaryCache } from "../cache.ts";
import { formatMelbourneTime } from "../time.ts";
import { emphasize } from "../emphasis.ts";

export const MAX_STORIES = 5;
export const SEARCH_HITS = 30;
export const WINDOW_SECONDS = 24 * 60 * 60;
export const TOP_COMMENTS = 3;

export interface ShapedStory {
  id: number;
  title: string;
  domain: string;
  points: number;
  comments: number;
  author: string;
  summary: string;
}

export interface HackerNewsData {
  updated_at: string;
  stories: ShapedStory[];
}

export type ArticleFetcher = (url: string) => Promise<string>;

export interface HackerNewsDeps {
  client: HnClient;
  summarizer: Summarizer;
  fetchArticle: ArticleFetcher;
  cache: SummaryCache;
  // Clock factory, consumed only by createHackerNewsPlugin to stamp each poll.
  // fetchHackerNewsData takes the already-resolved Date as its own argument.
  now?: () => Date;
}

export function domainFromUrl(url: string | undefined): string {
  if (!url) return "news.ycombinator.com";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "news.ycombinator.com";
  }
}

// Best-effort, cache-aware summary for one story. Never throws.
async function summarizeStory(
  { client, summarizer, fetchArticle, cache }: HackerNewsDeps,
  story: HnStory,
): Promise<string> {
  try {
    const cached = await cache.get(story.id);
    if (cached !== null) return cached;

    const [articleText, comments] = await Promise.all([
      story.url ? fetchArticle(story.url) : Promise.resolve(""),
      client.getTopComments(story.id, TOP_COMMENTS),
    ]);
    const summary = await summarizer({ title: story.title, url: story.url, articleText, comments });
    if (summary) await cache.set(story.id, summary);
    return summary;
  } catch {
    return "";
  }
}

export async function fetchHackerNewsData(deps: HackerNewsDeps, now: Date): Promise<HackerNewsData> {
  const since = Math.floor(now.getTime() / 1000) - WINDOW_SECONDS;
  const stories = (await deps.client.getTopStories({ since, hitsPerPage: SEARCH_HITS }))
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_STORIES);

  const shaped = await Promise.all(
    stories.map(async (s, i): Promise<ShapedStory> => {
      return {
        id: s.id,
        title: s.title,
        domain: domainFromUrl(s.url),
        points: s.points,
        comments: s.num_comments,
        author: s.author,
        summary: i < 2 ? emphasize(await summarizeStory(deps, s)) : '',
      };
    }),
  );

  return { updated_at: formatMelbourneTime(now), stories: shaped };
}

export function createHackerNewsPlugin(deps: HackerNewsDeps): Plugin {
  const now = deps.now ?? (() => new Date());
  return {
    name: "hackernews",
    route: "/hackernews",
    templateUrl: new URL("./hackernews.liquid", import.meta.url),
    handler: async (_req, res) => {
      try {
        res.json(await fetchHackerNewsData(deps, now()));
      } catch (err) {
        res.status(502).json({ error: (err as Error).message });
      }
    },
  };
}
