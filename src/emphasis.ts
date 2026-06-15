// Turns the LLM's lightweight **markdown** emphasis into TRMNL-renderable HTML.
//
// The model is prompted to wrap the few most important words in `**...**`. We
// HTML-escape the whole string first (so model output can never inject arbitrary
// markup), then convert the surviving `**...**` markers into a bold span. The
// asterisk markers contain no HTML-special characters, so escaping first is safe.
// Templates render the result raw (liquidjs does not auto-escape `{{ }}`).
//
// We emit `font--bold` rather than a bare <strong>/<b> because on TRMNL device
// bundles bold is a separate font file selected by that class. But these spans live
// inside a `.description` element, which pins `font-variation-settings:"wght" …`
// (400 for --large, 500 for --xlarge). font-variation-settings is inherited and,
// when it sets `wght` explicitly, it overrides a descendant's `font-weight` on
// variable-font displays — so the class alone leaves the text un-bolded. The inline
// `font-variation-settings:'wght' 700` on the span overrides the inherited axis.

const BOLD_OPEN = `<span class="font--bold" style="font-variation-settings:'wght' 700">`;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emphasize(text: string): string {
  return escapeHtml(text).replace(/\*\*([\s\S]+?)\*\*/g, `${BOLD_OPEN}$1</span>`);
}
