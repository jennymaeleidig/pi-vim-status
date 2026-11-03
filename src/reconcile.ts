/**
 * The one pure seam of pi-vim-status: what each channel should hold for a given
 * Vim status and Zentui activeness, which writes that implies, and how label
 * text is fitted to the Zentui custom-variable protocol's text limit.
 */

/** The status pi-vim-editor publishes: a mode name and the label to show. */
export type VimStatus = Readonly<{ mode: string; label: string }>;

/** The text currently held by each publication channel, if any. */
export type Channels = Readonly<{
  zentui: string | undefined;
  status: string | undefined;
}>;

/** One channel assignment: a string publishes, `undefined` clears. */
export type Write = Readonly<{
  channel: "zentui" | "status";
  text: string | undefined;
}>;

/** Zentui's custom-variable protocol limit, in UTF-16 code units. */
export const MAX_TEXT_CODE_UNITS = 256;

const CONTROL_AND_LINE_BREAK = /\p{Cc}|\p{Zl}|\p{Zp}/gu;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const ELLIPSIS = "…";
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Remove what must never reach the bus: control characters, line breaks, lone surrogates. */
function clean(text: string): string {
  return text.replace(CONTROL_AND_LINE_BREAK, "").replace(LONE_SURROGATE, "");
}

/** Truncate at a grapheme boundary, leaving room for a single-character ellipsis. */
function truncate(text: string): string {
  const budget = MAX_TEXT_CODE_UNITS - ELLIPSIS.length;
  let used = 0;
  let head = "";
  for (const { segment } of segmenter.segment(text)) {
    if (used + segment.length > budget) break;
    head += segment;
    used += segment.length;
  }
  return head + ELLIPSIS;
}

/**
 * Fit label text to the protocol limit. Control characters and lone surrogates
 * are stripped first; text at or under the limit is returned unchanged, longer
 * text is cut at a grapheme boundary and marked with an ellipsis. No text at all
 * is `undefined`, which is how both channels are cleared.
 */
export function fitLabel(text: string): string | undefined {
  const cleaned = clean(text);
  if (cleaned === "") return undefined;
  if (cleaned.length <= MAX_TEXT_CODE_UNITS) return cleaned;
  return truncate(cleaned);
}

/** The text a status asks for: nothing for INSERT, the fitted label otherwise. */
function textFor(status: VimStatus | undefined): string | undefined {
  if (status === undefined) return undefined;
  if (status.mode === "insert") return undefined;
  return fitLabel(status.label);
}

/**
 * Decide the channel values a status implies and the exact writes that reach
 * them from `previous`, Zentui first then status. An absent status clears both
 * channels; Zentui active moves the text to the Zentui channel and clears the
 * fallback, inactive does the reverse.
 */
export function reconcile(
  previous: Channels,
  status: VimStatus | undefined,
  zentuiActive: boolean,
): { next: Channels; writes: readonly Write[] } {
  const text = textFor(status);
  const next: Channels = zentuiActive
    ? { zentui: text, status: undefined }
    : { zentui: undefined, status: text };

  const writes: Write[] = [];
  if (next.zentui !== previous.zentui) writes.push({ channel: "zentui", text: next.zentui });
  if (next.status !== previous.status) writes.push({ channel: "status", text: next.status });

  return { next, writes };
}
