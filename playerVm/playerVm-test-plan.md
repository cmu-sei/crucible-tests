# Player VM UI Test Plan

End-to-end tests for the **Player VM UI** (`Services.PlayerVM.UI`, dev port 4303).
This app renders the VM list, the Map application, and hosts VM consoles. It is
normally embedded as an iframe inside the Player UI, but its routes are also
reachable directly.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`):
the Player VM UI has no view list of its own, so tests authenticate on Player,
discover a real view id from "My Views", then navigate into the VM UI routes.

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
