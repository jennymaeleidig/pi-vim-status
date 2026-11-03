# pi-vim-status

Show `pi-vim-editor`'s mode in a Zentui Minimalist border slot, without giving up Zentui's
frame.

pi-vim-status is a bridge between two extensions: it reads the Vim status `pi-vim-editor`
publishes, republishes the label on Zentui's custom-variable bus, and falls back to Pi's
ordinary extension status channel when Zentui is not listening. It is presentation only —
it draws no rows, owns no border, and never replaces the editor. Vim key handling,
operators, text objects, search, undo and redo are untouched, Visual selection highlighting
keeps working, and cursor shapes stay `pi-vim-editor`'s job.

## Install

pi-vim-status is not published to npm; install it from the repository checkout:

```sh
pi install npm:pi-vim-editor
pi install /path/to/pi-extensions/pi-vim-status
pi install npm:pi-zentui
```

Use an absolute path to the package directory. Pi loads a local source from the resolved
path without copying it, so leave the checkout where it is. A relative path resolves from
the settings file that declares it: `./pi-vim-status` works only together with `--local`
from inside the project.

Packages load in the order they are declared in the `packages` array of
`~/.pi/agent/settings.json`, so install them in that order; edit the array by hand to
reorder later, or `pi remove` and reinstall. With `--local` the declaration is written to
`.pi/settings.json` in a trusted project instead. Then add the Vim setting and the Zentui
configuration below.

## Load order is part of the contract

```text
pi-vim-editor  ->  pi-vim-status  ->  pi-zentui
```

Each layer has to see what it expects:

- **`pi-vim-editor` decorates the stock editor.** It lays out the label in Pi's border
  rows and disables Visual highlighting and `H`/`M`/`L` when the editor it decorates has
  already rearranged those rows. With Zentui loaded inside it, Vim is asked to decorate a
  frame whose editor it cannot reach, and it warns that Vim is off.
- **`pi-vim-status` holds the Vim-decorated editor** and reads the Vim capability from that
  instance. Loaded after Zentui, the editor it holds is Zentui's frame, which carries no
  capability: with `indicator: "none"` there is then no mode feedback at all.
- **`pi-zentui` wraps whatever editor factory is installed**, so loading last means it
  wraps the Vim-decorated editor and draws exactly one frame.

## Requirements

- `pi-vim-editor` 0.9.0 or newer.
- `vimEditor.indicator` set to `"none"` in Pi's settings — `~/.pi/agent/settings.json`, or
  `.pi/settings.json` in a trusted project:

```json
{
  "vimEditor": {
    "indicator": "none",
    "cursorShape": true
  }
}
```

With the default `bottom-right` indicator, Vim splices `── NORMAL ──` into the border rows
before Zentui frames them, which adds a second rule row, crosses the left rail, and
offsets the metadata line. `"none"` stops Vim drawing the label at all; this package
supplies it inside the frame Zentui owns. An older `pi-vim-editor` ignores the value and
restores `bottom-right`, so the duplicate rule row comes back — upgrade rather than
configuring around it.

`cursorShape: true` is what carries INSERT. The chip stays empty in INSERT, so the cursor
shape is the only mode signal there: block in NORMAL and the Visual modes, bar in INSERT,
underline in REPLACE. Leave it off and every mode looks the same at the cursor.

If `indicator` is not `"none"`, pi-vim-status sends one warning per session when it first
has a Zentui surface to publish to.

## Zentui configuration

Zentui reads its own configuration from `~/.pi/agent/zentui.json`. Give the publisher key a
local alias with `variables`, then reference the alias in a slot. `variables` sits beside
`formats`, both directly under `minimalist`:

```json
{
  "components": {
    "editor": {
      "style": "minimalist",
      "styles": {
        "minimalist": {
          "variables": { "vim": "pi-vim-status:vim" },
          "formats": {
            "bottomLeft": "$vim$join_sep($cwd$join_sep($git_branch))"
          }
        }
      }
    }
  }
}
```

The alias name is yours to choose; the value `pi-vim-status:vim` is the fixed publisher key
and must match exactly. The alias must also appear in a configured slot: under the default
Minimalist template, `$extensions` aggregates every publisher key it is not otherwise told
about, so a mismatched alias does not render nowhere — the value shows up in the aggregate
(top-right by default). Referencing the alias in a slot places the chip there and excludes
it from `$extensions`.

Colour the chip through Zentui's custom-value colour map. Keys there are full publisher
keys, not aliases:

```json
{
  "components": {
    "editor": {
      "customValueColors": { "pi-vim-status:vim": "bold fg:202" }
    }
  }
}
```

## Behaviour

- INSERT publishes nothing, so the chip is present only when there is a mode worth
  showing. It also clears a chip left by another mode.
- NORMAL, VISUAL, VISUAL LINE, VISUAL BLOCK and REPLACE show their label.
- Pending counts and search queries appear as they are typed: `3d` while the command is
  unfinished, `/parser` while the query is open.
- The chip updates on the keypress that changes the mode or the pending keys. There is no
  timer and no polling loop.
- A label longer than the protocol's 256 UTF-16 code units is fitted at a grapheme
  boundary and ends with an ellipsis, so a long search query degrades instead of freezing
  an older value in place.

The chip renders through Zentui's normal custom-value pipeline, so it is width-fitted and
sanitised like every other custom value and yields whole rather than wrapping the frame at
narrow widths.

## Fallback without Zentui

When Zentui is not installed, does not demand this key, or loses ownership of the surface,
the same text is published through Pi's extension status channel as
`ctx.ui.setStatus("pi-vim-status:vim", text)`. Nothing has to be configured for that, and
the mode is never shown twice.

The fallback is best-effort. Zentui's extension-status visibility policy can hide it, and a
hidden footer leaves nothing but the editor chip. The chip is the intended surface.

## What it does not do

- Draw, repair or own borders, rows, rails or frames.
- Add a widget or claim a surface of its own.
- Replace or wrap the editor.
- Handle cursor shapes; set `vimEditor.cursorShape` in `pi-vim-editor` for that.
- Own a settings file or schema, or rewrite your Pi or Zentui configuration.
- Provide a diagnostic command; the checks below and the one-time indicator warning are the
  diagnostics.
- Work through an editor wrapper between Vim and Zentui that neither returns the
  Vim-decorated instance nor forwards the capability — the mode is then treated as absent.

## Troubleshooting

Check in this order:

1. **Load order** is `pi-vim-editor`, then `pi-vim-status`, then `pi-zentui`. A Vim warning
   at startup means Zentui is loaded inside Vim.
2. **`vimEditor.indicator` is `"none"`.** Leaving it at `bottom-right` gives the duplicate
   rule row as well as the chip.
3. **The alias key is exactly `pi-vim-status:vim` and `$vim` appears in a configured
   slot.** `variables` must sit beside `formats`; a `variables` block nested inside
   `formats` is ignored, so `$vim` renders empty. If `$extensions` is still rendered, the
   value moves into that aggregate (top-right by default) instead of the slot you named,
   which means the alias is mismatched or unreferenced rather than the package being
   broken.
4. **Zentui owns the editor or the Starship Footer that demands the alias**, and the editor
   style is Minimalist or Opencode. A disabled editor with no footer demanding the key
   means no Zentui chip, and the text falls back to the extension status.
5. **If the chip appears but freezes**, suspect the publish path — whether the value is
   reconciled on every render — rather than Vim's status. It returns on the next render
   after a config change or an editor reinstall.

A chip that stays empty through the first keypress after startup is normal: the first
publication waits for the first render after Zentui reports that it owns the surface, so it
appears on the next keypress or repaint rather than from a timer.

## Minimum versions

| Package         | Minimum | Needed for                                      |
| --------------- | ------- | ----------------------------------------------- |
| `pi-vim-editor` | 0.9.0   | `vimEditor.indicator: "none"`                   |
| `pi-zentui`     | 0.34.0  | custom-value publisher protocol version 1       |
| Pi              | 1.5.0   | extension editor factory and status channel API |

## Retirement

pi-vim-status exists because Zentui does not read the Vim capability natively. If Zentui
grows native support for the capability, this package is redundant: remove it from
`packages` and drop the `vim` alias from the Zentui configuration.
