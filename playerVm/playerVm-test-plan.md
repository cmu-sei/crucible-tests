# Player VM UI Test Plan

End-to-end tests for the **Player VM UI** (`Services.PlayerVM.UI`, dev port 4303).
This app renders the VM list, the Map application, and hosts VM consoles. It is
normally embedded as an iframe inside the Player UI, but its routes are also
reachable directly.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`):
the Player VM UI has no view list of its own, so tests authenticate on Player,
then navigate into the VM UI routes. Specs that need a real view use the
`playerVmView` fixture, which seeds a fresh Player view (with its Admin team)
through the Player API, names it uniquely per project, theme variant, worker
and retry, and deletes it (plus any VM API maps left on it) after the test.

## Theme Coverage

Every Player VM spec is authenticated and runs once per theme: each file loops
over `PLAYERVM_THEMES` (`light`, `dark`) and reports under a `light theme ›` /
`dark theme ›` describe prefix. There are no unauthenticated or API-only Player
VM specs, so none are left unwrapped.

**Theme strategy — `?theme=` on every VM UI navigation.** The VM UI does not
persist the theme: its localStorage entry (`akita-vm-ui`) holds only
`vmUISession`, so a theme picked from the user menu is lost on the next
`page.goto` or reload. Specs therefore navigate with `gotoPlayerVm(page, path,
theme)`, which appends `?theme=dark-theme` / `?theme=light-theme` (the same
channel Player uses when it embeds the VM UI in an iframe) and asserts that
`body.darkMode` is present or absent before continuing. The param stays on the
URL, so it also survives a reload. The VM UI writes `?theme=` back onto the URL
when the theme later changes; no Player VM spec asserts on the query string.

`setPlayerVmTheme(page, theme)` switches the already-loaded page through the
user menu's "Dark Theme" switch, waits for the menu panel and CDK backdrop to
detach, and is a no-op when the theme is already active. The theme contrast
spec uses it (loading light, then switching) so the switch itself is covered.

## Map application

Route: `/views/:viewId/map`

The Map page distinguishes three states:

1. **Valid view, no map assigned** — shows the heading
   *"No Map is assigned to this Team"* (plus the Select Map dropdown / New Map
   button for users who can edit). It must **not** show "View Not Found".
2. **Valid view, map assigned** — auto-selects the team's map and renders the
   map image.
3. **Invalid / inaccessible view** — shows the *"View Not Found"* page
   (`app-page-not-found`).

### Regression covered

A valid view with no map incorrectly showed **"View Not Found"** instead of
**"No Map is assigned to this Team"** (introduced in vm.ui #579, fixed in
`fix/map-no-map-view-not-found`). Root cause: `viewExists$` was only assigned
after the maps pipeline emitted, and `combineLatest([])` never emits for a view
with no maps — so the "view exists" flag stayed undefined and the template fell
through to "View Not Found".

### Tests

- **Map shows "No Map is assigned" for a valid view without a map** — navigate
  to `/views/{realViewId}/map`; expect the "No Map is assigned to this Team"
  heading and absence of "View Not Found".
- **Map shows "View Not Found" for an invalid view** — navigate to
  `/views/00000000-0000-0000-0000-000000000000/map`; expect "View Not Found".
- **Editor can create, view, and delete a map** — on the seeded view, open
  "New Map", fill Name / External Image URL / Teams, Save, confirm the map
  renders ("Delete Map" visible), then delete it via the "Delete Map?" confirm
  dialog's Delete button and confirm the no-map state returns.

## Accessibility

### Theme contrast compliance (`accessibility/theme-contrast-compliance.spec.ts`)

Runs in light and dark against a seeded view; each page loads light and is
switched with `setPlayerVmTheme`. Expected colors are read from the served
`assets/config/settings.json` / `settings.shared.json` / `settings.env.json`,
layered like `ComnSettingsService` (a missing overlay, e.g. a 404 for
`settings.shared.json`, is skipped).

- **WCAG 1.4.3 text** — top bar title ("VM") and user menu against the top bar;
  the Map page's "No Map is assigned to this Team" heading against the page
  surface; plus a direction check (dark = light text on a darker surface,
  light = the reverse).
- **WCAG 1.4.11 primary icon** — type into the VM list Search field; the
  "Clear Search" icon button is painted `--mat-sys-primary` and reaches 3:1
  against its surface.
- **Color settings contract (colors design spec)** — `--crucible-topbar-background`
  / `--crucible-topbar-text` equal the top-bar settings in both modes and paint
  the toolbar; the "Player VM" home logo keeps the top-bar pair (disc in the
  top-bar text color, glyph in the top-bar color); `--mat-sys-primary` /
  `--mat-sys-on-primary` equal the active mode's settings verbatim, with dark
  falling back to light.
- **Primary / on-primary text** — the unsaved "New Map" dialog: the filled
  Save button's `on-primary` label and the `primary` Cancel label each reach
  4.5:1. Cancelled, never saved.
  - **Known failure (dark):** the design spec's dark primary `#6A8DCA` as text
    on the `#313131` dialog surface is 3.89:1, under 4.5:1. Left failing on
    purpose; it reads colors from settings, so it passes once the dark palette
    moves to a compliant value.
