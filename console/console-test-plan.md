# Console UI Test Plan

End-to-end tests for the **Console UI** (`Services.Console.UI`, dev port 4305),
the app that renders an individual VM's console (vSphere/WMKS or Proxmox/noVNC).
It is normally embedded as an iframe by the Player VM UI but its console route
is reachable directly at `/vm/:vmId/console`.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`),
which is also where the view/VM lists live.

## Test data

Specs that need a real console page seed one with `seedViewWithVm`
(`playerVm/vm-helpers.ts`) rather than discovering (or skipping for lack of) an
existing VM. It runs in a `beforeAll` inside each theme's `describe`, so the
light and dark runs each get their own Player view (with its Admin team) and a
VM API record on that team, with the theme in the seeded name. The seeding
token comes from `getPlayerToken()` and covers both the Player and VM APIs.

The record has no hypervisor VM behind it, so `/vm/{id}/console` renders the
options bar and stays "Connecting". The matching `afterAll` calls `cleanup()`,
which deletes the VM and the view.

## Theme Coverage

Every Console spec runs once per theme, with no exceptions: each file loops
over `CONSOLE_THEMES` (`light`, `dark`) and reports under a `light theme ›` /
`dark theme ›` describe prefix. Every Console spec is authenticated, so none
needed the pattern adapted. Player VM specs that open a console along the way
(`playerVm/tests/usage-reporting`, `playerVm/tests/realtime`) navigate to it
with the same `gotoConsole`, so those consoles run in the Player VM spec's
theme too.

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

## Proxmox console (`proxmox/`)

The Proxmox console's options bar (`app-options-bar2`) against a live Proxmox
VM: the controls that bring it up to the vSphere console, the items it disables
(with a reason) when the VM can't support them, and the API's reason on a
refused operation (console.ui #756, vm.api #99).

### Test data: a configured machine, not a seeded record

The VM API keys `proxmox_vm_info` on the Proxmox vmid, so a machine can back
only one record and a test cannot seed its own record for it (a second create
fails with a duplicate key). These specs therefore use the existing VM API
record for one configured machine:

- `PROXMOX_CONSOLE_VMID` and `PROXMOX_CONSOLE_NODE` (set them in `.env.local`;
  the vmid is whatever the local Proxmox host assigned) name a running QEMU VM.
- `requireProxmoxConsoleVm()` (`playerVm/vm-helpers.ts`) resolves it to its
  record and reads `GET api/vms/proxmox/{id}`. Each step is a
  `requirePrecondition`: the variables unset, no record for the machine, the
  API unable to read it from Proxmox, or the machine not running all skip with
  the reason (and fail under `CI`/`CRUCIBLE_STRICT`).

Nothing changes the VM. Menus are opened and closed, the Send Text dialog is
cancelled, Read Only is a page query parameter, and the only power request is
Power On on a running VM, which Proxmox refuses. The specs never power off,
reboot, revert or snapshot. They run on the chromium project only, as the other
live-VM specs do.

Items gated on the machine's Proxmox config are asserted against what the API
reports for it, so the same spec holds for a machine with or without a guest
agent, a snapshot or `clipboard=vnc`. A disabled item's reason is read by
hovering its tooltip wrapper (`expectGatedControl` in `fixtures.ts`), except
Snapshots, whose tooltip is on the disabled item itself and is read as its
accessible description.

### Tests

`options-menus.spec.ts`:

- **Console options lists the vSphere console controls** — the main menu has
  Fullscreen, Reconnect, Resolution, Power, Snapshots, Files, Keyboard and
  Clipboard, plus the Read Only and Dark Theme switches; the toolbar has Copy,
  Paste and Ctrl-Alt-Del.
- **Power menu offers Shutdown OS, as the vSphere console names it** — exactly
  Power On, Power Off, Reboot, Shutdown OS.
- **Keyboard menu offers Send Text, which opens the Send Text dialog** — Send
  Ctrl-Alt-Del, Send Text, Paste to Clipboard; Send Text opens "Enter Text to
  Send", which Cancel closes without sending.
- **Files menu needs the guest agent to send or download a file** — Send File
  To VM and Download File From VM are enabled when `guestAgentRunning`, and
  otherwise disabled with "Requires the QEMU guest agent"; Mount ISO is enabled.
- **Copy needs the VM's VNC clipboard** — the toolbar's and the Clipboard
  menu's Copy are enabled when `vncClipboardEnabled`, and otherwise disabled
  with "Copy from the VM needs the VNC clipboard (clipboard=vnc) enabled on this
  VM"; Paste is enabled in both.
- **Snapshots is available only when the VM has a snapshot** — disabled with
  "No snapshots available" when `hasSnapshot` is false, otherwise enabled with
  "Select a snapshot to revert to".

`power-error-reason.spec.ts`:

- **Power On on a running VM shows Proxmox's reason once** — the POST to
  `actions/power-on` answers 400 and the snackbar reads exactly "Power On
  failed: VM {vmid} already running": one prefix, not "Power On failed: Power
  On failed: ...", and not "Http failure response for ...".

`resolution.spec.ts`:

- **Resolution starts on Scale to Fit** — two items, Scale to Fit checked.
- **Match Window Size falls back to Scale to Fit, and says so, when the guest
  keeps its size** — the display adapter decides whether the guest resizes and
  the API doesn't report it, so the outcome is asserted either way and recorded
  as a `guest resize` annotation. Fallback (std VGA): the snackbar "This VM
  didn't change resolution, so the console is scaling to fit instead.", Scale to
  Fit checked again, and Match Window Size disabled with "This VM's display
  adapter can't change resolution from the console". Matched: Match Window Size
  stays checked, and the spec switches back to Scale to Fit.

`read-only.spec.ts`:

- **Read Only hides the controls that change the VM** — turning the switch on
  sets `?readOnly=true`, adds "(Read Only)" to the VM name, removes the
  toolbar's Copy / Paste / Ctrl-Alt-Del and the Power, Snapshots, Files,
  Keyboard and Clipboard items, keeps Fullscreen, Reconnect and Resolution, and
  disables Match Window Size ("A read-only console can't change this VM's
  resolution", or the adapter reason if noVNC hasn't seen resize support).
  Turning it off brings the controls back.

### Not covered here

- **Sending text, files or clipboard contents to the guest, and downloading a
  file** — they change the guest, and the configured machine has no guest agent;
  the API's refusal of a download is covered in `playerVm`.
- **Reverting to a snapshot and bulk revert** — they roll the machine back.
- **Power Off, Reboot, Shutdown OS** — they change the machine's state.
- **Mount ISO** beyond the item being enabled — mounting changes the VM's
  config.
- **Task progress** in the bar — it needs a running Proxmox task, which only a
  state-changing operation starts.
