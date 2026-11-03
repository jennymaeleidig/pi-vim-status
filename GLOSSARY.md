# pi-vim-status

Shows `pi-vim-editor`'s Vim status in a Zentui Minimalist border slot, and in Pi's
extension status channel when Zentui is not listening. A bridge with a deliberately small
surface: it reads one published capability, writes one publisher key, and draws nothing.

## Language

**Bridge**:
An extension loaded between two others that translates between their published interfaces
without owning either. It imports neither package and upgrades independently of both.
_Avoid_: Shim, adapter, glue, plugin, wrapper

**Capability**:
The editor property keyed by `Symbol.for("pi-vim-editor")` carrying `version: 1` and
`status()`. Read from the current editor on every call, never cached.
_Avoid_: Interface, API, handle, symbol, hook

**Vim status**:
The `{ mode, label }` object a capability's `status()` returns fresh on each call.
_Avoid_: State, status object, mode info

**Mode**:
One of `insert`, `normal`, `visual`, `visual-line`, `visual-block`, `replace` as the Vim
status reports it. Only `insert` is suppressed; any other mode shows its label.
_Avoid_: State, phase

**Label**:
The text `pi-vim-editor` publishes for the current state: the pending keys if any, otherwise
the mode name — `NORMAL`, `3d`, `/parser`.
_Avoid_: Text, value, message

**Chip**:
The label as rendered in one Zentui border slot; the user-visible result of the package.
_Avoid_: Badge, tag, indicator, widget

**Publisher key**:
The fixed key `pi-vim-status:vim` under which every value is published, on both channels.
It is stable across releases.
_Avoid_: Variable name, id, status key

**Alias**:
The local name a Zentui configuration gives the publisher key with `variables`, so a slot
can reference it as `$vim`.
_Avoid_: Publisher key, variable key, slot name

**Slot**:
One of the six configurable Minimalist border positions whose template renders the chip.
An alias that no slot references still reaches the `$extensions` aggregate.
_Avoid_: Segment, position, corner

**Zentui channel**:
Zentui's custom-variable bus: a capability probe on `zentui:variable-capability` and values
on `zentui:variable`. An empty or `undefined` value removes the chip.
_Avoid_: Event bus, Zentui API

**Status channel**:
Pi's ordinary extension status channel, written with `ctx.ui.setStatus(key, text)`. The
fallback whenever the Zentui channel is not active.
_Avoid_: Footer, widget, notification

**Active**:
Zentui's per-key report that it owns an enabled surface currently demanding the publisher
key. It is not a guarantee that the chip is visible at the current width.
_Avoid_: Enabled, visible, owned, available

**Surface ownership**:
The condition `active` reports: an owned, enabled, safely decorated editor or Starship
Footer whose template references the alias. Losing it clears the Zentui value instead of
leaving it frozen.
_Avoid_: Focus, attachment

**Fitted label**:
A label cut at a grapheme boundary to at most 256 UTF-16 code units and marked with an
ellipsis, so the protocol never silently ignores an update.
_Avoid_: Truncated, clipped, shortened

**Reconcile**:
The pure function `reconcile(previous, status, zentuiActive)` returning the next channel
state and the writes that reach it. Every publication and every clear comes from it.
_Avoid_: Sync, update, apply, diff

**Write**:
One channel update the reconcile returns, ordered Zentui then status, with `undefined`
meaning "clear this channel".
_Avoid_: Emit, publish, set

**Load order**:
The order `pi-vim-editor` -> `pi-vim-status` -> `pi-zentui` that the package requires. Vim
decorates the stock editor, this package holds that instance, Zentui wraps outside it.
_Avoid_: Stack order, precedence, priority

**Indicator**:
`pi-vim-editor`'s `vimEditor.indicator` setting. `"none"` removes Vim's own border label so
the chip is the only place the mode appears.
_Avoid_: Label, chip, status
