export interface SummarizeInput {
  title: string;
  url?: string;
  articleText: string;
  comments: string[];
}

export type Summarizer = (input: SummarizeInput) => Promise<string>;

// Minimal fetch shape so a fake can be injected in tests.
export interface JsonFetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}
export type JsonFetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<JsonFetchResponse>;

interface AnthropicMessage {
  content?: { type?: string; text?: string }[];
}

export const noopSummarizer: Summarizer = async () => "";

export interface ClaudeSummarizerOptions {
  apiKey: string;
  fetchImpl?: JsonFetchLike;
  model?: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// url is intentionally omitted from the prompt — the title + article text carry the content.
function buildPrompt({ title, articleText, comments }: SummarizeInput): string {
  const article = articleText ? `Article excerpt:\n${articleText}` : "Article text unavailable.";
  const discussion = comments.length
    ? `Top comments:\n${comments.map((c) => `- ${c}`).join("\n")}`
    : "No comments available.";
  return [
    `Summarize this Hacker News story in one to three sentences (300 characters MAX).`,
    `Capture what it is about and, if useful, the gist of the discussion.`,
    `Reply with only the summary, no preamble.`,
    ``,
    `Title: ${title}`,
    ``,
    article,
    ``,
    discussion,
  ].join("\n");
}

export function createClaudeSummarizer({
  apiKey,
  fetchImpl = fetch as unknown as JsonFetchLike,
  model = "claude-haiku-4-5",
}: ClaudeSummarizerOptions): Summarizer {
  return async (input) => {
    try {
      const res = await fetchImpl(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 150,
          messages: [{ role: "user", content: buildPrompt(input) }],
        }),
      });
      if (!res.ok) return "";
      const data = (await res.json()) as AnthropicMessage;
      return (data.content?.[0]?.text ?? "").trim();
    } catch {
      return "";
    }
  };
}
