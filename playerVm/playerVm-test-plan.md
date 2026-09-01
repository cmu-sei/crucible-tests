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
  disabled `mat-tab` mounts nothing. `usage-logging.spec.ts` is the rest of that
  tab.
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

`usage-logging.spec.ts` (the Usage Logging tab, the one feature of this page behind
a deployment switch):

- **Usage Logging tab is enabled exactly when the API says logging is on** — the
  only test in this file that is *not* gated on the setting, and deliberately so.
  With `VmUsageLogging:Enabled` off, every endpoint but `isloggingenabled` answers
  404 and the tab is rendered disabled rather than hidden; a browser only ever sees
  the branch its deployment is configured for, so this asserts both against what
  the API reports and one of them is always real. The disabled branch dispatches
  the click event directly, because a disabled `mat-tab` is `pointer-events: none`
  and a real click cannot reach `_handleClick` — which is where the guard that
  matters is, since the tab body is a `matTabContent` template.
- **A session created through the form appears in the table** — with the team it
  was filed against (the Teams column renders `getTeamName`, so "Unknown" is what a
  session with the wrong team ids looks like), and the record read back from the
  API. The Log Name box is typed into rather than filled: the value reaches the
  component through `(change)`, and a `change` event only follows a blur when the
  value was changed by keystrokes.
- **Download CSV saves the session log under the session name** — the client names
  the file itself (`saveAs(blob, name + '.csv')`) rather than using the API's
  `FileDownloadName`, so this is the browser half and not a restatement of the
  endpoint. A session with no console activity still has the header row, which is
  the report's whole vocabulary.
- **End closes a session that is still running** — the End button exists only for a
  session whose end is in the future, so its disappearance is the row reporting the
  new end.
- **Delete removes the row only after the confirmation is confirmed** — cancel
  keeps both the row and the record. Log entries cascade off the session in the
  logging database, so the confirmation is all that stands between a mis-click and
  an exercise's recorded history.

### Not covered here

The view page's other routes — `views/:viewId/vms/:name/console`,
`views/:viewId/auto-deploy` and `views/:viewName/:teamId/welder` — have no tests in
either suite yet.

## Usage reporting (`usage`)

The read side of usage logging, and the only route in this app that is not about a
single view. `usage-reporting.spec.ts`.

One thing shapes the whole file: **a row in this report cannot be seeded.** Log
entries are written in exactly one place — `VmHub.SetActiveVirtualMachine` — there is
no endpoint that creates one, and this suite has no SignalR client. The only way to
put data in the report is to open a VM console in a browser and leave it. So the
data-dependent assertions are all in one test, which drives `console.ui` in a second
page of the same browser context; closing that page is what disconnects the hub, and
`OnDisconnectedAsync` → `CloseVmLogEntry` is the only thing that closes the entry.
The report filters on `VmInactiveDT > VmActiveDT`: an open console is not yet usage.

Two more traps in the seeding, both in `vm-helpers.ts`:

- **A session has to fit inside one day.** The hub attaches an entry only to a
  session that is running *now*, and the report selects only a session its range
  *wholly contains* — while the page floors the start to 00:00 and ceilings the end
  to 23:59:59. A session that ran past midnight satisfies the first and fails the
  second, and the report comes back empty for reasons nothing on the page explains.
- **Sessions live in a separate database** (`VmUsageLogging:PostgreSQL`), keyed by
  view id, so deleting the Player view cascades to neither the session nor its
  entries. `deleteViewUsageLoggingSessions` is the teardown net.

### Tests

- **Usage report page renders both formats with nothing to report yet** —
  unconditional, because the page is behind no permission and no setting: with
  logging off the report request 404s and the empty state is the same. Get is
  disabled until a range is set, CSV until a report has rows, and the table is not
  rendered at all.
- **A range with no sessions in it reports no data** — a range far enough back that
  no deployment can have data in it. The empty-state message is on screen *before*
  Get is pressed, so the response is what separates "no data" from "never asked":
  the test waits for the report call and asserts it came back `200 []`.
- **A console session that has ended appears in the report** — seed a session
  covering today, open the seeded VM's console in `console.ui` until the log entry
  appears, close it so the entry closes, then report on today. Asserts the row (by
  session name, since the report is deployment-wide), that switching to By Session
  rebuilds the table around a different first column, and that the CSV button —
  which builds its file from the rows the page already has — produces
  `VmUsageData.csv`.
  The wait re-fires `window:focus` while it polls: `ngOnInit` claims the VM only
  `if (document.hasFocus())`, which a page that has never been interacted with may
  not report, and only after `startConnection()` resolves, which nothing on the page
  announces. Each focus that lands records its own entry; the report groups by
  session, VM and user, so several are still one row.

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

## View event callback

`tests/callback/view-event-callback.spec.ts`. No browser: nothing in the estate
draws any of this.

Half of the VM API's behaviour is reachable only from the Player API. When a view
is created, the Player API POSTs `ViewCreated { ViewId, ParentId, ViewName }` to
every webhook subscription; when one is deleted, `ViewDeleted { ViewId }`. The VM
API takes those at `POST api/callback` and spends them in
`CallbackBackgroundService`: a view with a parent gets the parent's maps
re-pointed at its own teams and a usage-logging session of its own, and a deleted
view loses its maps and has its running sessions closed. That is the whole of
"starting an exercise from a template keeps the map", and there is no endpoint,
no schedule and no button that does any of it.

**Why it needs a test here rather than in either repository.** Both sides are
already covered in process — and that is the gap. `CallbacksEndpointTests` and
`CallbackBackgroundServiceTests` drive the VM API from a *hand-written* event, so
what they assert is the payload a fixture decided the Player API would send. The
VM API reads the inner payload with Newtonsoft, where a name it does not
recognise is silently null, and the Player API serialises it with
`System.Text.Json` from its own DTO. A field renamed on either side leaves both
suites green and a cloned view quietly without its map. Only a run against both
real APIs compares them.

Four things shape the file:

- **The webhook is off unless a subscription exists, and the dev stack has
  none.** `SeedData.Subscriptions` is commented out in `player.api`'s
  `appsettings.json` and the AppHost sets nothing, so `GET /api/webhooks` is
  empty and this feature has never run there. The spec creates the subscription
  itself (`subscribeVmToViewEvents`), which needs the callback client's secret —
  read from Keycloak rather than checked in — and an address for the VM API that
  *the Player API's process* can reach.
- **A subscription is deployment-wide while it exists.** Every view any spec
  creates or deletes is delivered through it, and both browser projects run this
  file, so one event can be delivered twice. Nothing here asserts a count: a
  doubled delivery clones a map twice and is otherwise idempotent.
- **A cloned view cannot be observed through the view's own endpoints.**
  `ViewEntity.Clone()` copies no memberships, so the caller has no primary team
  in the child and `getViewMaps` — which filters to the caller's visibility
  teams — reports it as having no maps at all; after a delete it 404s. Both are
  indistinguishable from the assertion failing. `getMapsForView` in
  `vm-helpers.ts` reads the deployment-wide list instead.
- **Every wait is bounded and reports why it gave up.** Delivery is a background
  queue on one side and a background service on the other, with a retry between.
  `awaitingDelivery` adds the subscription's `lastError` to a timeout, which
  separates the two failures: an error means the event never landed (unreachable
  callback, refused token — a deployment fault), and no error with nothing done
  means it landed and the VM API made nothing of it, which is the contract
  breaking.

### Tests

- **A view cloned from a parent is given the parent's maps, on its own team** —
  the copy is a new map with new coordinate rows, drawn for the child's team
  (matched to the parent's by *name*, since a clone's teams are new ids), and the
  parent keeps its own: a copy, not a move. Coordinates are asserted because a
  map cloned without them renders as a working map with nothing clickable on it.
- **A cloned view is given a usage-logging session of its own, named after it** —
  named from the payload's `ViewName`, which makes this the assertion that the
  field arrived at all; a null session name is what a rename on the sending side
  looks like from here. Also its teams and its window, which is "now, for a
  year", because a console cannot be logged against a session that is not open.
  Gated on `VmUsageLogging:Enabled`.
- **Deleting a view removes the maps filed under it** — asserted present first,
  because the VM API's maps outlive their view otherwise, which is the reason
  this callback exists.
- **Deleting a view closes a usage-logging session that is still running** —
  seeded an hour out so it is unambiguously running, and asserted as *closed
  rather than gone*: sessions live in a separate database that nothing cascades,
  which is what keeps an ended exercise's usage readable in the report.

## Real-time delivery (`tests/realtime/`)

`VmHub` driven over a live connection from a browser, which nothing else in either
repository does. Two files, and between them the only place in this suite that opens
**two sessions as two different users**.

The two halves that already exist stop just short of each other. `vm.api`'s
`ContractTests`/event-handler tests drive the handlers into a recording hub context
and assert the *group names* they send to; `tests/contract/signalr-contract.spec.ts`
asserts that the clients register handlers of the right arity for the names the hub
sends. Neither runs a connection. What sits between them fails silently every time:
the connection itself (`${basePath}/hubs/vm` and the bearer token it carries),
`JoinView`/`JoinViewUsers`/`JoinVm` actually being invoked for what is on screen, the
group name assembled the same way on both ends, and the store update reaching the
binding. All of it looks exactly like a list nobody has changed.

Three things shape both files:

- **The list is fetched once and never refetched.** `vm-list.component` calls
  `GetViewVms` behind a `hasLoadedVms` guard and nothing in `vm.ui` polls, so
  `live-vm-list.spec.ts` counts responses on `/views/{viewId}/vms` and asserts the
  count did not move across the mutation. Without that counter a passing assertion
  is equally consistent with the page having quietly reloaded and the hub being
  dead; with it, the row can only have arrived over the connection. A guard asserts
  the count *started*, so a moved URL fails loudly instead of passing vacuously.
- **The page joins its groups a beat after it draws.** The list comes from an HTTP
  response while `SignalRService` connects independently, so a mutation fired the
  moment the row appears is routinely broadcast before the browser is in the view's
  group — and a broadcast to a group nobody has joined is simply gone. Every test
  waits for the `JoinView` *completion* frame (SignalR `type: 3`, matched on the
  invocation id read off the sent frame) before mutating: an invocation the hub
  rejects leaves the connection up and is identical from the client. A real session
  has the same blind spot for the second it takes to connect; nothing here can fix
  that, so the tests wait for the state a user spends the session in.
- **Presence is addressed to somebody else.** Every message in
  `console-presence.spec.ts` is broadcast to groups derived from the *acting* user's
  teams and views, so one session can watch the whole feature work and learn
  nothing. Hence two Keycloak accounts in two browser contexts: presence is keyed by
  `sub`, and two sessions as `admin` are one user to the hub.

Four preconditions in the presence file, each of which fails invisibly:

- **The second user must be in a team in the view, and it must be their first.** A
  user's first membership in a view becomes their *primary* team, and
  `SetActiveVirtualMachine` scopes both broadcasts to that team and the views
  reachable from it. A user with no primary team is reported to nobody, and neither
  screen says so.
- **They must exist in Player.** Nothing creates a user for someone else; the row
  appears when a token is first presented, so the spec fetches
  `GET api/users/{id}` with the member's own token (`provisionPlayerUser`) and
  asserts the name Player derived from the `name` claim.
- **The watcher must be an admin** for the console readout. `.connected-users` is
  gated on `!readOnly`, and `readOnly` is false only for a user who can edit the
  view or the team.
- **The seeded VM needs an absolute url.** The Last VM cell renders
  `getVmUrl(vm.url)` → `new URL(url)`, which *throws* on the empty string the API
  defaults to and takes the whole table's render with it. The spec points it at the
  VM API's health endpoint: inert, reachable, absolute.

Both presence readouts also need the member's console to *claim* the VM, which
`console-page.component` does in `ngOnInit` only `if (document.hasFocus())` and only
after `startConnection()` resolves — neither of which the page announces. Waits
re-dispatch `window:focus` each round, the same path a user switching back to the tab
takes; that also covers a watcher that joined its group late, since every focus
re-broadcasts.

### Tests

`live-vm-list.spec.ts`, each seeding its own view (two of them change what it
contains), mutating through the VM API — which is not a contrived stand-in, since
Caster and Steamfitter do exactly that while people sit in front of the page:

- **A VM created by another client appears in an open list** — `VmCreated` to the
  view group, into the store, out as a row, with no refetch.
- **A VM renamed by another client is renamed in the open list** — the narrowest
  test of `modifiedProperties` there is: the client copies only the named
  properties, so a name missing from the list leaves the old label and a name that
  is not a property of the client's `Vm` writes `undefined` and blanks it. The old
  label is asserted gone as well as the new one present.
- **A VM deleted by another client disappears from the open list** — `VmDeleted`
  carries only the id, so the row going is the client having found the entity by it.
  The record is confirmed deleted through the API first, because `deleteVm` warns
  rather than throws and a refused delete looks identical from the browser.

`console-presence.spec.ts`, sharing one view, one temporary Keycloak user and one
Player user across both tests, each of which opens and closes its own console
context:

- **Another user's console appears against them in User Follow, and clears when
  they leave** — the VM List tab is loaded first, because the Virtual Machine cell
  renders `vmsQuery.selectEntity(activeVmId)` and a VM the store has never heard of
  draws as "None", indistinguishable from nobody being on a console. Asserted per
  cell rather than per row: after a session the row contains the VM name twice.
  Closing the console page returns Active to "None" via `OnDisconnectedAsync` —
  nothing polls it, so a client that ignored the null would show the console
  occupied forever — while Last VM keeps the name.
- **A console names the other user connected to the same VM** — `.connected-users`
  in `console.ui`'s options bar, the literal answer to "who else is looking at this
  machine", fed only by `CurrentVirtualMachineUsers` and only for a connection that
  invoked `JoinVm`. Asserted as *contains*: the watcher's own name may be beside the
  member's and the order comes from a `ConcurrentDictionary`. The disconnect
  re-sends the list with the departing user left out, which is the half a client
  keeping its own tally would get wrong.

### Not covered here

- **`ProgressHub` over a connection.** `Progress` is sent from exactly two places —
  `Vsphere/Services/TaskService` and `Proxmox/Services/ProxmoxTaskService`, both
  polling a hypervisor task — so there is no way to make a real progress bar move
  without a hypervisor behind the VM API. `vm.api` asserts the group names from both
  ends and does one in-process round trip; that is as far as it goes.
- **Only the vSphere/Unknown options bar has a connected-users readout.**
  `app-options-bar2`, the Proxmox one, renders none, so the second test above says
  nothing about a Proxmox console.
- **One row leaks, as it already does in `usage-reporting.spec.ts`.**
  `VmHub.UpdateVmUser` writes a `VmUsers` row per (user, team) that no endpoint can
  delete and nothing cascades. Deleting the Keycloak user, the Player user and the
  view leaves it orphaned on ids that no longer resolve, invisible to every list in
  the estate.

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
how the workspace is laid out; `CRUCIBLE_SOURCE_ROOT` overrides it.

A repository that is not checked out is a `requireAppSources` skip — deliberately
*not* `requirePrecondition`, which escalates to a failure under CI. The two look
alike at the call site and are not the same claim: CI means the stack is expected
to be up, which says nothing about sibling checkouts, and a job that clones only
this repo can never satisfy these specs. So the escalation is opt-in instead —
setting `CRUCIBLE_SOURCE_ROOT` or `CRUCIBLE_REQUIRE_CONTRACTS=1` asserts the
sources are there and turns the skips into failures. A pipeline that checks the
app repos out should set one of them; otherwise these specs would report green
having read nothing, which is the failure mode this whole directory exists to
prevent, one level up.

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

`contract-reader.spec.ts`, the odd one out: `hubCalls` against fixture source
rather than against an app repo.

Everything above is only as good as the scanner underneath it, and that scanner
is hand-rolled — the suite has no TypeScript AST to hand. Its failure mode is
not a broken test but a *passing* one: a call it does not recognise is a call it
does not check, and `signalr-contract.spec.ts` then compares the calls it found
against the API's declarations and finds nothing wrong with a set it never read.
Each case below produced a wrong answer at some point, so read them as the
reader's own contract:

- **a generic invoke is read, not skipped** — `.invoke<Vm>('GetVm', id)` is how
  a typed call is spelled, and a matcher allowing only `.invoke(` passed over it
  in silence.
- **a regex literal does not corrupt the call after it** — the quotes inside
  `/'/g` opened a string that ran to the next quote in the file, which was the
  one opening the following `.on('VmCreated', …)`.
- **a division is not read as a regex literal** — the other half of the same
  judgement; over-eager literal detection blanks real code.
- **a comparison in an argument does not truncate the argument list**, and
  **a generic type in a handler parameter list does not split it** — the two
  sides of what `<` and `>` mean, which is why they are counted when splitting
  arguments and not when finding the end of a call.
- **a hub call inside a comment or a string is not a hub call.**
