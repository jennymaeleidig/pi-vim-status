import assert from "node:assert/strict";
import { test } from "node:test";
import type { Channels, VimStatus, Write } from "../src/reconcile.ts";
import { fitLabel, MAX_TEXT_CODE_UNITS, reconcile } from "../src/reconcile.ts";

const CLEAR: Channels = { zentui: undefined, status: undefined };

/** A status whose label is the mode name, as pi-vim-editor publishes it. */
function shown(mode: string, label: string = mode.toUpperCase()): VimStatus {
  return { mode, label };
}

type Transition = Readonly<{
  name: string;
  previous: Channels;
  status: VimStatus | undefined;
  zentuiActive: boolean;
  next: Channels;
  writes: readonly Write[];
}>;

const transitions: readonly Transition[] = [
  {
    name: "INSERT with Zentui active publishes INSERT",
    previous: CLEAR,
    status: shown("insert"),
    zentuiActive: true,
    next: { zentui: "INSERT", status: undefined },
    writes: [{ channel: "zentui", text: "INSERT" }],
  },
  {
    name: "INSERT with Zentui inactive publishes INSERT on the status channel",
    previous: CLEAR,
    status: shown("insert"),
    zentuiActive: false,
    next: { zentui: undefined, status: "INSERT" },
    writes: [{ channel: "status", text: "INSERT" }],
  },
  {
    name: "NORMAL with Zentui active puts NORMAL on the Zentui channel",
    previous: CLEAR,
    status: shown("normal"),
    zentuiActive: true,
    next: { zentui: "NORMAL", status: undefined },
    writes: [{ channel: "zentui", text: "NORMAL" }],
  },
  {
    name: "NORMAL with Zentui inactive puts NORMAL on the status channel",
    previous: CLEAR,
    status: shown("normal"),
    zentuiActive: false,
    next: { zentui: undefined, status: "NORMAL" },
    writes: [{ channel: "status", text: "NORMAL" }],
  },
  {
    name: "Zentui becoming active moves the label from status to Zentui",
    previous: { zentui: undefined, status: "NORMAL" },
    status: shown("normal"),
    zentuiActive: true,
    next: { zentui: "NORMAL", status: undefined },
    writes: [
      { channel: "zentui", text: "NORMAL" },
      { channel: "status", text: undefined },
    ],
  },
  {
    name: "Zentui becoming inactive moves the label from Zentui to status",
    previous: { zentui: "NORMAL", status: undefined },
    status: shown("normal"),
    zentuiActive: false,
    next: { zentui: undefined, status: "NORMAL" },
    writes: [
      { channel: "zentui", text: undefined },
      { channel: "status", text: "NORMAL" },
    ],
  },
  {
    name: "a pending count is published verbatim",
    previous: CLEAR,
    status: shown("normal", "3d"),
    zentuiActive: true,
    next: { zentui: "3d", status: undefined },
    writes: [{ channel: "zentui", text: "3d" }],
  },
  {
    name: "a search query is published verbatim",
    previous: { zentui: "3d", status: undefined },
    status: shown("normal", "/parser"),
    zentuiActive: true,
    next: { zentui: "/parser", status: undefined },
    writes: [{ channel: "zentui", text: "/parser" }],
  },
  {
    name: "VISUAL and REPLACE publish their label",
    previous: { zentui: "NORMAL", status: undefined },
    status: shown("visual-line", "VISUAL LINE"),
    zentuiActive: true,
    next: { zentui: "VISUAL LINE", status: undefined },
    writes: [{ channel: "zentui", text: "VISUAL LINE" }],
  },
  {
    name: "an unrecognised mode shows its label rather than being hidden",
    previous: CLEAR,
    status: shown("operator-pending", "OP-PENDING"),
    zentuiActive: true,
    next: { zentui: "OP-PENDING", status: undefined },
    writes: [{ channel: "zentui", text: "OP-PENDING" }],
  },
  {
    name: "an empty label is no text",
    previous: CLEAR,
    status: shown("normal", ""),
    zentuiActive: false,
    next: CLEAR,
    writes: [],
  },
  {
    name: "an absent status clears both channels, Zentui first",
    previous: { zentui: "VISUAL", status: undefined },
    status: undefined,
    zentuiActive: true,
    next: CLEAR,
    writes: [{ channel: "zentui", text: undefined }],
  },
  {
    name: "an absent status clears a fallback status too",
    previous: { zentui: undefined, status: "NORMAL" },
    status: undefined,
    zentuiActive: false,
    next: CLEAR,
    writes: [{ channel: "status", text: undefined }],
  },
  {
    name: "repeating an identical active state writes nothing",
    previous: { zentui: "NORMAL", status: undefined },
    status: shown("normal"),
    zentuiActive: true,
    next: { zentui: "NORMAL", status: undefined },
    writes: [],
  },
  {
    name: "repeating an identical inactive state writes nothing",
    previous: { zentui: undefined, status: "NORMAL" },
    status: shown("normal"),
    zentuiActive: false,
    next: { zentui: undefined, status: "NORMAL" },
    writes: [],
  },
  {
    name: "repeating INSERT writes nothing when the chip already shows INSERT",
    previous: { zentui: "INSERT", status: undefined },
    status: shown("insert"),
    zentuiActive: true,
    next: { zentui: "INSERT", status: undefined },
    writes: [],
  },
];

for (const transition of transitions) {
  test(transition.name, () => {
    const { next, writes } = reconcile(
      transition.previous,
      transition.status,
      transition.zentuiActive,
    );
    assert.deepEqual(next, transition.next);
    assert.deepEqual(writes, transition.writes);
  });
}

test("INSERT replaces a chip another mode left behind", () => {
  const { next, writes } = reconcile(
    { zentui: "VISUAL", status: undefined },
    shown("insert"),
    true,
  );
  assert.deepEqual(next, { zentui: "INSERT", status: undefined });
  assert.deepEqual(writes, [{ channel: "zentui", text: "INSERT" }]);
});

test("an over-limit label is fitted to the protocol limit and marked with an ellipsis", () => {
  const { next, writes } = reconcile(CLEAR, shown("normal", "a".repeat(300)), true);
  const expected = `${"a".repeat(MAX_TEXT_CODE_UNITS - 1)}…`;
  assert.equal(next.zentui, expected);
  assert.equal(expected.length, MAX_TEXT_CODE_UNITS);
  assert.deepEqual(writes, [{ channel: "zentui", text: expected }]);
});

test("the fallback status receives the same fitted text", () => {
  const { next } = reconcile(CLEAR, shown("normal", "a".repeat(300)), false);
  assert.equal(next.status, `${"a".repeat(MAX_TEXT_CODE_UNITS - 1)}…`);
  assert.equal(next.zentui, undefined);
});

test("fitting leaves text under the limit unchanged", () => {
  for (const text of ["NORMAL", "3d", "/parser", "a".repeat(MAX_TEXT_CODE_UNITS)]) {
    assert.equal(fitLabel(text), text);
  }
});

test("fitting strips control characters and newlines before measuring", () => {
  assert.equal(fitLabel("NOR\u0000MAL\n"), "NORMAL");
  assert.equal(fitLabel("VI\u001bSUAL\r\nLINE"), "VISUALLINE");
  assert.equal(fitLabel("\n\t\u0007"), undefined);
  assert.equal(fitLabel(""), undefined);
});

test("fitting drops a lone surrogate instead of publishing a broken pair", () => {
  assert.equal(fitLabel("NO\uD800RMAL"), "NORMAL");
  assert.equal(fitLabel("\uDC00NORMAL"), "NORMAL");
});

test("fitting truncates a multi-byte label at a grapheme boundary", () => {
  const fitted = fitLabel("😀".repeat(200));
  assert.ok(fitted !== undefined);
  assert.equal(fitted, `${"😀".repeat(127)}…`);
  assert.ok(fitted.length <= MAX_TEXT_CODE_UNITS);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(fitted), "no unpaired high surrogate");
  assert.ok(!/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(fitted), "no unpaired low surrogate");
});

test("fitting keeps combining marks attached to their base character", () => {
  const fitted = fitLabel("e\u0301".repeat(200));
  assert.ok(fitted !== undefined);
  assert.ok(fitted.length <= MAX_TEXT_CODE_UNITS);
  assert.ok(fitted.endsWith("…"));
  assert.ok(fitted.endsWith("e\u0301…"), "does not orphan a combining mark");
  assert.equal(fitted, `${"e\u0301".repeat(127)}…`);
});

test("fitting a label full of control characters yields undefined", () => {
  assert.equal(fitLabel("\u0000".repeat(400)), undefined);
});
