// Subset of the HN Algolia Search API we read.
// Search: https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>{since}
// Item:   https://hn.algolia.com/api/v1/items/{id}

export interface HnSearchHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at_i?: number;
}

export interface HnSearchResponse {
  hits?: HnSearchHit[];
}

export interface HnComment {
  text?: string | null;
  children?: HnComment[];
}

export interface HnItemResponse {
  id?: number;
  children?: HnComment[];
}

// Normalised story used by the plugin.
export interface HnStory {
  id: number;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at_i: number;
}
