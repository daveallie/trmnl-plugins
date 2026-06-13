import { Liquid } from "liquidjs";
import { readFile } from "node:fs/promises";
import type { Request, RequestHandler } from "express";

const engine = new Liquid();

export interface PreviewOptions {
  // The plugin's Liquid template to render.
  templateUrl: URL;
  loadData: (req: Request) => Promise<object>;
}

function renderPage(inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TRMNL preview</title>
  <link rel="stylesheet" href="https://trmnl.com/css/latest/plugins.css" />
  <style>
    body { margin: 0; background: #777; display: grid; place-items: center; min-height: 100vh; }
    .screen { width: 800px; height: 480px; background: #fff; overflow: hidden; }
  </style>
</head>
<body>
  <!-- .trmnl is the scope every framework selector is nested under -->
  <div class="trmnl">
    <div class="screen">${inner}</div>
  </div>
</body>
</html>`;
}

export function createPreviewHandler({ templateUrl, loadData }: PreviewOptions): RequestHandler {
  return async (req, res) => {
    try {
      const data = await loadData(req);
      const template = await readFile(templateUrl, "utf8");
      const inner = await engine.parseAndRender(template, data);
      res.type("html").send(renderPage(inner));
    } catch (err) {
      res.status(502).type("html").send(`<pre>Preview error: ${(err as Error).message}</pre>`);
    }
  };
}
