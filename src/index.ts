import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Scaffold: registers the lifecycle hooks and does nothing yet.
 * A non-TUI session returns before touching the editor, events or settings.
 */
export default function piVimStatus(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
  });

  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
  });
}
