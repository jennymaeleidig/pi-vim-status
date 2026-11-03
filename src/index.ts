import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { Channels, VimStatus, Write } from "./reconcile.ts";
import { reconcile } from "./reconcile.ts";

const KEY = "pi-vim-status:vim";
const VIM_EDITOR = Symbol.for("pi-vim-editor");
const CLEAR: Channels = { zentui: undefined, status: undefined };

type EditorFactory = NonNullable<ReturnType<ExtensionUIContext["getEditorComponent"]>>;
type Editor = ReturnType<EditorFactory>;

/** The mutable probe Zentui answers on its capability event. */
type Probe = { supported: boolean; active: boolean; key: string };

/** The settings keys this package reads; `vimEditor` belongs to pi-vim-editor. */
type SettingsLike = { vimEditor?: { indicator?: unknown } };

/**
 * Read the Vim capability the editor carries. The capability is looked up on every
 * call because the editor may have been reinstalled; anything unexpected is "no
 * status" rather than an error.
 */
function readStatus(editor: Editor | undefined): VimStatus | undefined {
  if (editor === undefined) return undefined;
  try {
    const capability: unknown = Reflect.get(editor, VIM_EDITOR);
    if (typeof capability !== "object" || capability === null) return undefined;
    const { version, status } = capability as { version?: unknown; status?: unknown };
    if (version !== 1 || typeof status !== "function") return undefined;
    const value: unknown = status.call(capability);
    if (typeof value !== "object" || value === null) return undefined;
    const { mode, label } = value as { mode?: unknown; label?: unknown };
    if (typeof mode !== "string" || typeof label !== "string") return undefined;
    return { mode, label };
  } catch {
    return undefined;
  }
}

/**
 * Wrap the Vim-decorated editor's render so each render schedules one sync, then
 * calls through with the original receiver and returns its lines untouched.
 */
export default function piVimStatus(pi: ExtensionAPI): void {
  let ui: ExtensionUIContext | undefined;
  let editor: Editor | undefined;
  let channels: Channels = CLEAR;
  let wrapped = new WeakSet<Editor>();
  let scheduled = false;
  let warned = false;

  const apply = (target: ExtensionUIContext, writes: readonly Write[]): void => {
    for (const write of writes) {
      if (write.channel === "zentui") {
        pi.events.emit("zentui:variable", { key: KEY, text: write.text });
      } else {
        target.setStatus(KEY, write.text);
      }
    }
  };

  /** Clear both channels and drop the bookkeeping the previous session left behind. */
  const reset = (target: ExtensionUIContext | undefined): void => {
    const result = reconcile(channels, undefined, false);
    channels = result.next;
    if (target !== undefined) apply(target, result.writes);
    scheduled = false;
    warned = false;
    wrapped = new WeakSet<Editor>();
  };

  const sync = (): void => {
    const target = ui;
    if (target === undefined) return;

    const probe: Probe = { supported: false, active: false, key: KEY };
    pi.events.emit("zentui:variable-capability", probe);
    const active = probe.active === true;

    const result = reconcile(channels, readStatus(editor), active);
    channels = result.next;
    apply(target, result.writes);

    if (!warned && active && (pi.getSettings() as SettingsLike).vimEditor?.indicator !== "none") {
      warned = true;
      target.notify(
        `pi-vim-status: vimEditor.indicator is not "none", so the Vim label is drawn in the ` +
          `editor border as well as in Zentui's slot. Set vimEditor.indicator to "none".`,
        "warning",
      );
    }
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      if (!scheduled) return;
      scheduled = false;
      sync();
    });
  };

  const wrapRender = (target: Editor): void => {
    const render = target.render;
    target.render = function (this: Editor, width: number): string[] {
      schedule();
      return render.call(this, width);
    };
  };

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ui = ctx.ui;
    reset(ui);

    const previous = ctx.ui.getEditorComponent();
    if (previous === undefined) return;

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const next = previous(tui, theme, keybindings);
      editor = next;
      if (!wrapped.has(next)) {
        wrapped.add(next);
        wrapRender(next);
      }
      return next;
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    reset(ui);
    ui = undefined;
    editor = undefined;
  });
}
