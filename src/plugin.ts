import type { RequestHandler } from "express";

export interface Plugin {
  name: string;
  route: string;
  handler: RequestHandler;
  // Liquid template for this plugin's TRMNL view (used by the preview route).
  templateUrl: URL;
}
