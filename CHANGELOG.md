# Changelog

## [Unreleased]

- Make `prepare` tolerant of a production install: `pi update --extensions` runs
  `npm install --omit=dev` on a git checkout, where `husky` is absent, and `sh -c husky`
  failed the install with exit 127.

## [0.1.2]

- Keep the lockfile's version in step with the manifest. No behaviour change.

## [0.1.1]

- Ignore `node_modules/` and build output in the repository, so a checkout stays clean after
  installing dependencies.

## [0.1.0]

- Republish `pi-vim-editor`'s status on Zentui's custom-variable bus under the fixed key
  `pi-vim-status:vim`, with Pi's extension status channel as the fallback when Zentui is
  not active.
- Show every mode in the chip, INSERT included; pending counts and search queries pass
  through verbatim.
- Fit labels longer than 256 UTF-16 code units to the protocol limit at a grapheme
  boundary, with an ellipsis.
- Warn once per session when `vimEditor.indicator` is still set while Zentui owns the
  surface.
- Clear both channels on shutdown, and on ownership loss move the same text to the
  fallback rather than freezing it.
