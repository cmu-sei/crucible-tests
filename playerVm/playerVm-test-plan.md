# Player VM UI Test Plan

End-to-end tests for the **Player VM UI** (`Services.PlayerVM.UI`, dev port 4303).
This app renders the VM list, the Map application, and hosts VM consoles. It is
normally embedded as an iframe inside the Player UI, but its routes are also
reachable directly.

Authentication is via Keycloak SSO through the Player UI (see `fixtures.ts`):
the Player VM UI has no view list of its own, so tests authenticate on Player,
discover a real view id from "My Views", then navigate into the VM UI routes.

## The view page (`views/:viewId`)

The page a Player user spends the session on, and the one everything else about
this app is reached from. `vm-main` renders a tab strip; each tab mounts one
component, and five of the six are wrapped in `<ng-template matTabContent>`, so
clicking the tab is the only thing that instantiates them. The VM List tab is
the exception — it has no `matTabContent`, so its content stays in the DOM after
a switch, which is why locators here are scoped to the component element
(`app-iso-list`, `app-user-list`, …) rather than to a `tabpanel` role.

Three things about the page shape the specs:

- **It is normally an iframe.** Player's view page embeds this app, and
  `hideTopbar = this.inIframe()` suppresses the VM UI's own topbar so Player's is
  the only one. Navigating a route directly never takes that branch. One test
  synthesises a host page on the VM UI's own origin (`page.route` fulfilling a
  one-line HTML document) and asserts through a `frameLocator` — same origin, so
  the OIDC session carries in with no second login, and the test depends on the
  VM UI's behaviour rather than on Player finding an application to embed.
- **The UI session is persisted.** `main.ts` runs
  `persistState({ key: 'akita-vm-ui', include: ['vmUISession'] })`, keyed by the
  caller's primary team: selected tab, search string, the two IP checkboxes, and
  the set of opened VMs all survive a reload. Each of those has a reload test,
  because each is a round trip through a different emitter on the way out and the
  single `uiSession` setter on the way back. `sortByTeams` is deliberately *not*
  in the model and resets.
- **A seeded VM is `PowerState=Unknown`**, and the list binds
  `[dtsDisabled]` on exactly that, so no VM in a seeded view can be selected.
  `selectedVms.length` cannot leave zero from a browser, and the five power
  operations and two "open selected" items are therefore covered as far as
  "offered, and disabled with nothing selected". Driving one needs a real
  hypervisor behind the VM API; `vm-helpers.ts` explains why the API cannot seed
  past it.

One more trap worth knowing before editing these specs: the VM list's search
input binds `(keyup)`, not `(input)`, so `fill()` sets the value without running
the filter — the clear button appears while the rows stay put. Searches go
through `pressSequentially`.

### Tests

`tab-strip.spec.ts`:

- **View page opens on the VM List tab with the whole tab strip** — VM List,
  User Follow, Usage Logging, Networks and Files all present (the seeding user
  holds every Player system permission, so the three gated tabs are an assertion
  and not a precondition), VM List selected, the seeded VM listed, and the app's
  own topbar drawn.
- **User Follow / Networks / Files tabs mount their components** — one test each,
  clicking the tab and asserting a control that only that component has.
- **Usage Logging tab mounts the session form** — gated on
  `GET /api/vmusageloggingsessions/isloggingenabled`, because the tab is rendered
  either way and `[disabled]="!usageLoggingEnabled"` is what changes; clicking a
  disabled `mat-tab` mounts nothing.
- **Selected tab survives a reload** — and the restored index re-mounts the lazy
  content, which a restore that only moved the highlight would not.
- **Unknown view renders View Not Found with no tab strip** — the all-zero uuid
  takes the real lookup path rather than the "not a uuid" short-circuit.
- **Embedded in an iframe the tab strip renders without its own topbar.**

`vm-list-controls.spec.ts` (a view with a second, empty team, so
`canSortByTeams$` — `getTeams(viewId).length > 1` — renders the checkbox at all):

- **Search filters the list and Clear Search restores it.**
- **Search term is remembered across a reload** — asserted on the rows as well
  as the input, since the restore path re-runs `applyFilter`.
- **Power-state filter hides a VM in an unmatched state**, and "All Machines"
  brings it back.
- **Show IPs and IPv4 Only are remembered across a reload** — together, because
  they travel on separate emitters and return through one setter.
- **Sort by Team groups the list under the owning team** — and ungrouping
  restores the flat list.
- **Actions menu offers every bulk operation, disabled with nothing selected** —
  the eight items, with Clear Selections the only enabled one.
- **Clear Selections asks for confirmation before clearing** — cancel reaches no
  further than closing the dialog; confirm runs the real clear path.
- **Search typed while sorted by team is remembered** — regression. With Sort by
  Team on and no panel yet clicked, `applyFilter` cleared a team panel selection
  that did not exist and threw on `groupSelects.get(undefined)` — after filtering
  the rows but before emitting, so the rows looked right while the term never
  reached the persisted session. Deliberately clicks no panel before typing, and
  asserts on the session rather than the rows.

`open-vm-tab.spec.ts` (the seeded VM's `url` is the VM API's readiness endpoint —
`app-focused-app` iframes `vm.url` verbatim, and this is the cheapest thing in
the deployment that answers 200 with no framing headers; only the `src` the UI
computed is ever asserted):

- **Clicking a VM opens a tab holding the VM in an iframe** — without navigating
  the page, which is `openHere`'s `preventDefault` for an embeddable VM.
- **Closing an opened tab removes it and returns to the VM List.**
- **Open in Browser Tab opens the VM in a real browser tab.**
- **Open in Browser Tab removes the in-app tab it popped out** — regression.
  `openInNewTab` dropped the VM from the local list but not from the persisted
  session, so the session replay re-added the tab it had just removed and a reload
  re-opened it in place. The reload is the load-bearing half of the test: the
  replay is asynchronous, so an immediate "the tab is gone" assertion can win a
  race against it.
- **An opened VM tab is restored after a reload** — tab *and* iframe, since a
  restored tab with no url is an empty pane with the right label.

### Not covered here

The view page's other routes — `views/:viewId/vms/:name/console`,
`views/:viewId/auto-deploy`, `views/:viewName/:teamId/welder` and `usage` — have
no tests in either suite yet.

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

## Client/server contracts

`tests/contract/` is the exception to everything above: no browser, no
Keycloak, nothing running. These specs read source — the contract files
`vm.api` publishes under `contracts/`, and the client code in `vm.ui` and
`console.ui` that is supposed to honour them. `../AGENTS.md` permits reading
app source to verify a contract, and `contract-sources.ts` only ever reads.

They exist because two of the three ways this UI talks to its API are agreed
on at build time by repositories that never see each other, and a disagreement
produces no error anywhere:

- **SignalR** dispatches by name *and* argument count. A client that invokes
  `JoinView` with the wrong number of arguments gets a rejected invocation on
  a connection that stays up — the view simply stops receiving updates. A
  handler registered for a message name nothing sends is never called. Both
  sides compile; the feature is quietly dead.
- **The generated API client.** `vm.ui/src/app/generated/vm-api` is generated
  by `npm run swagger:gen` and then committed. Nothing runs that on a
  schedule, in a pipeline, or as a condition of merging, so a DTO property
  renamed in `vm.api` leaves the TypeScript interface with the old name and
  the field reads `undefined` in production.

`vm.api` asserts its own side of both files — `ContractTests.cs` reflects over
the hub classes and drives the real event handlers into a recording hub
context; `OpenApiSurfaceTests.cs` pins the OpenAPI surface into
`contracts/openapi-surface.json`. This suite asserts the client side of the
same files, which is the comparison neither repository can make alone.

A failure here is fixed in an application repository, not in this one: either
a client is calling something the API does not have, or the checked-in client
needs regenerating.

Because they need no stack, they can be run on their own without `run-tests.sh`
and its service checks:

```bash
npx playwright test playerVm/tests/contract --project=chromium
```

They read the app repositories from the directory that holds this one, which is
how the workspace is laid out; `CRUCIBLE_SOURCE_ROOT` overrides it. A repository
that is not checked out is a `requirePrecondition` skip locally and a failure
under `CRUCIBLE_STRICT`/CI, like every other precondition in this suite.

### Tests

`signalr-contract.spec.ts`, per hub and per client the contract lists:

- **invokes only methods the API declares, with the arguments it declares.**
- **listens only for messages the API sends** — or messages recorded under
  `clientListenersWithNoSender`, which is where a handler with no sender is
  documented rather than tolerated silently.
- **binds no more arguments than the API sends** — against the *smallest*
  arity a name is ever sent with. Binding fewer is legal and both clients do
  it deliberately; SignalR drops the extras. Binding more yields `undefined`.
- **connects to the hub path the API maps.**
- **every message it broadcasts is listened for by some client** — the
  direction `vm.api` cannot check, because from inside the API a send nobody
  receives looks exactly like a send.
- **the unsent message `Complete` is still listened for** — keeps the recorded
  anomaly honest, so the entry is deleted when it stops being true.
- **`modifiedProperties`** — every name `VmUpdated` can carry, and every key
  it never names, is a property of the generated `Vm` interface. `vm.ui`
  spends that list as `model[x] = vm[x]`, so a name that is not a key of the
  serialized VM writes `undefined` over a value that was correct a moment ago.

`openapi-surface.spec.ts`, comparing the pinned surface to the committed
client:

- **the generated models are exactly the schemas the API describes.**
- **every object schema has the properties its generated interface declares.**
- **every enum schema has the values its generated union declares.**
- **every operation is a method on the generated service for its tag** — the
  tag matters as much as the name, because `typescript-angular` groups
  operations into one injectable service per tag.
- **every method on a generated service is an operation the API declares** —
  a method the API no longer has still compiles and fails as a 404, which
  reads as an outage rather than as a rename.
