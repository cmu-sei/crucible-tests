# Console UI Test Plan

End-to-end tests for the **Console UI** (`Services.Console.UI`, dev port 4305),
the app that renders an individual VM's console (vSphere/WMKS or Proxmox/noVNC).
It is normally embedded as an iframe by the Player VM UI but its console route
is reachable directly at `/vm/:vmId/console`.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`),
which is also where the view/VM lists live.

## Test data

Specs that need a real console page use the `consoleVm` fixture rather than
discovering (or skipping for lack of) an existing VM. It seeds, per test:

1. a Player view with its Admin team (Player API, Player UI token), then
2. a VM API record with only `name` and `teamIds: [adminTeamId]` (VM API, which
   rejects the Player UI token, so the fixture first loads a harmless Console
   UI route to obtain the Console UI's own token).

The record has no hypervisor VM behind it, so `/vm/{id}/console` renders the
options bar and stays "Connecting". Names are
`E2E Console [<project>-w<worker>-r<retry>-<hash>]`, unique per project, theme
variant, worker and retry. The VM and the view are deleted after each test.

## Theme Coverage

Every Console spec is authenticated and runs once per theme: each file loops
over `CONSOLE_THEMES` (`light`, `dark`) and reports under a `light theme ›` /
`dark theme ›` describe prefix. There are no unauthenticated or API-only
Console specs, so none are left unwrapped.

**Theme strategy — `?theme=` on every Console UI navigation.** The Console UI
does not persist the theme (it lives only in the in-memory store), so a theme
picked from the gear menu is lost on the next `page.goto` or reload. Specs
navigate with `gotoConsole(page, path, theme)`, which appends
`?theme=dark-theme` / `?theme=light-theme` (the channel the Player VM UI uses
when it embeds the console in an iframe) and asserts that `body.darkMode` is
present or absent before continuing.

`setConsoleTheme(page, theme)` switches an already-loaded console page through
the options bar gear menu (`button[aria-label="Console options"]` → "Dark
Theme" switch), waits for the menu panel and CDK backdrop to detach, and is a
no-op when the theme is already active. The theme contrast spec uses it
(loading light, then switching) so the switch itself is covered. The "VM Not
Found" page has no options bar, so it is always reached via `?theme=`.

### Expected failures (dark)

The user chose to ship the colors design spec's dark primary `#6A8DCA`
unchanged, so these checks fail by design and are left failing (not skipped,
and thresholds are not loosened):

- **Primary and on-primary text contrast (WCAG 1.4.3), dark** — primary used as
  text (the Send Text dialog's Cancel label and the options bar's Copy / Paste /
  Ctrl-Alt-Del labels) on the `#313131` surface is 3.89:1 (< 4.5:1).
- **Dark Theme switch contrast (WCAG 1.4.11), dark** — the selected switch
  track (`#6A8DCA`) on the `#474747` gear menu panel is 2.78:1 (< 3:1).

Compliant same-hue alternatives would be `#7999CF` (4.50:1) or `#90AAD7`
(5.52:1) on `#313131`.

## Console rendering

Route: `/vm/:vmId/console`

On navigation, the console component (`app-console` — options bar plus the
screen/canvas area, or the "Connecting…" / power-state overlay) must render
**on its own**, without the user having to click into or focus the window.

### Regression covered

The console did not render until the window was clicked/focused
(console.ui #732, fixed in `fix/console-render-onpush-readonly`). Root cause:
`readOnly$` (bound via `| async` in an OnPush component) was assigned late,
inside an async pipeline, so change detection never ran until an unrelated
host event — `@HostListener('window:focus')` — fired. Until then `app-console`
stayed unrendered (only Angular placeholder comments).

### Tests

- **Console renders without window focus** — navigate to
  `/vm/{seededVmId}/console` and, without dispatching any click or focus, assert
  `app-console` becomes visible with its options bar ("Console options" gear)
  and the "Connecting" overlay, and that "VM Not Found" is absent. (The seeded
  record has no hypervisor VM; the test asserts the component renders, not that
  the remote screen connects.)
- **Console shows "VM Not Found" for an invalid VM id** — navigate to
  `/vm/00000000-0000-0000-0000-000000000000/console`; expect the "VM Not Found"
  heading and no `app-console`.

## Accessibility

### Theme contrast compliance (`accessibility/theme-contrast-compliance.spec.ts`)

Runs in light and dark against the seeded VM; each console page loads light
and is switched with `setConsoleTheme`. Expected colors are read from the
served `assets/config/settings.json` / `settings.shared.json` /
`settings.env.json`, layered like `ComnSettingsService` (a missing overlay is
skipped).

- **Theme Contrast Compliance (WCAG 1.4.3 text)** — "VM Not Found" heading and
  description on the page surface, with a direction check (dark = light text on
  a darker surface, light = the reverse); the options bar "Connected:" label;
  the gear menu's Fullscreen / Reconnect / Keyboard items and "Dark Theme"
  label on the menu panel.
- **Console options icon contrast (WCAG 1.4.11)** — the gear glyph is painted
  `--mat-sys-primary` on the options bar (`--mat-sys-background`) and reaches
  3:1.
- **Dark Theme switch contrast (WCAG 1.4.11)** — dark: the selected track
  (primary) against the menu panel; light: the handle against the unselected
  track. Expected to fail in dark (2.78:1, see above).
- **Color settings applied per theme (design spec)** — `--crucible-topbar-background`
  / `--crucible-topbar-text` equal the top-bar settings in both modes (Console
  has no brand top bar that paints with them, so only the properties are
  checked); `--mat-sys-primary` / `--mat-sys-on-primary` equal the active mode's
  settings verbatim, with dark falling back to light.
- **Primary and on-primary text contrast (WCAG 1.4.3)** — via gear menu ›
  Keyboard › Send Text (filled in, then cancelled, never sent): the filled Send
  button's on-primary label, the Cancel label (primary as text) on the dialog
  surface, and the options bar's outlined Copy / Paste / Ctrl-Alt-Del labels.
  Primary-as-text checks are soft so every pair is reported. Expected to fail in
  dark (3.89:1, see above).
