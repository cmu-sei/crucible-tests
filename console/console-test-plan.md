# Console UI Test Plan

End-to-end tests for the **Console UI** (`Services.Console.UI`, dev port 4305),
the app that renders an individual VM's console (vSphere/WMKS or Proxmox/noVNC).
It is normally embedded as an iframe by the Player VM UI but its console route
is reachable directly at `/vm/:vmId/console`.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`),
which is also where the view/VM lists live; a VM id is discovered from the
Player VM UI's VM list (each VM links to `.../vm/{vmId}/console`).

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
  `/vm/{realVmId}/console` and, without dispatching any click or focus, assert
  `app-console` becomes present/visible. (The underlying VNC connection may not
  fully establish in every environment; the test asserts the component renders,
  not that the remote screen connects.)
