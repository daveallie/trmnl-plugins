export interface TextFetchResponse {
  ok: boolean;
  status?: number;
  text(): Promise<string>;
}

export type TextFetchLike = (url: string) => Promise<TextFetchResponse>;

export interface CalendarClient {
  getIcsTexts(): Promise<string[]>;
}

export interface CalendarClientOptions {
  icsUrls: string[];
  fetchImpl?: TextFetchLike;
}

export function createCalendarClient({
  icsUrls,
  fetchImpl = fetch as unknown as TextFetchLike,
}: CalendarClientOptions): CalendarClient {
  return {
    async getIcsTexts() {
      const settled = await Promise.allSettled(
        icsUrls.map(async (url) => {
          const res = await fetchImpl(url);
          if (!res.ok) throw new Error(`calendar fetch ${url} returned ${res.status}`);
          return res.text();
        }),
      );
      return settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);
    },
  };
}
