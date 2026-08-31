// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Player VM API helpers: seed a view + team + VM over HTTP so VM-dependent specs
 * stop depending on whatever VMs the environment happens to hold.
 *
 * Why this exists: the Console UI and the VM UI both need a real VM id, and the
 * only way to get one used to be to walk the view list and scrape the first
 * `/vm/{id}/console` link. That made the specs conditional — no VMs in the
 * environment meant `test.skip(!vmId, ...)`, which reports green while asserting
 * nothing. Seeding removes the condition: the VM exists because the test made it.
 *
 * What a seeded VM *is*, and is not:
 *
 *   `VmCreateForm` carries no hypervisor identity, so `MappingProfile` maps a
 *   form with no `ProxmoxVmInfo` to `Type = VmType.Unknown`, and nothing sets a
 *   power state — the state pollers are what populate it, and they only know
 *   about machines that exist in vSphere/Proxmox. So a seeded VM is
 *   `Type=Unknown, PowerState=Unknown`.
 *
 *   That is enough for anything that renders a VM: the Console UI's
 *   `console.component.html` handles `vmType.Unknown` on the same branch as
 *   vSphere, so `app-options-bar` + `app-wmks` mount normally (they just never
 *   connect to a screen, which no assertion here depends on).
 *
 *   Pending upstream: it is *not* enough to drive a power operation. The VM
 *   list binds `[dtsDisabled]="vm.powerState.toString() === 'Unknown'"`, so a
 *   seeded VM cannot be selected in the UI at all, and `BulkPowerOperation`
 *   rejects a non-vSphere/Proxmox VM with "Unsupported Operation" before it
 *   reaches a hypervisor. Neither `VmCreateForm` nor `VmUpdateForm` exposes
 *   `type` or `powerState`, so there is no way to seed past this from a test.
 *   Browser coverage of the multi-select power path therefore needs a real
 *   hypervisor; until the API can seed a type/power state, do not build a
 *   power-operation spec on top of this seeder.
 *
 * Every seeder here pairs with a deleter, and {@link seedViewWithVm} returns a
 * `cleanup()` that removes the view (which cascades its teams) and the VM.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { Services } from '../shared-fixtures';
import { getClientSecret, getKeycloakAdminToken } from '../keycloak-admin';
import {
  createTeam,
  createView,
  createWebhookSubscription,
  deleteView,
  deleteWebhookSubscription,
  getPlayerToken,
  getViewTeams,
  getWebhookSubscriptions,
  PlayerTeam,
} from '../player-helpers';

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

async function vmCall<T = any>(
  token: string,
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    /**
     * `Accept`, when the endpoint does not produce JSON. `[Produces("text/csv")]`
     * on the download endpoint means the default `application/json` gets a 406
     * rather than a file.
     */
    accept?: string;
  } = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.PlayerVM.API.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: opts.accept ?? 'application/json',
      },
      data: opts.body,
    });
    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      /* non-JSON body — callers get `text` instead */
    }
    return { ok: res.ok(), status: res.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

export interface SeededVm {
  id: string;
  name: string;
}

/**
 * Create a VM assigned to the given teams. The caller must be able to manage
 * every team listed (`VmService.CreateAsync` checks each one against the Player
 * API and rejects the whole request otherwise), which the Admin team of a view
 * created by `createView` satisfies.
 *
 * Pair every call with {@link deleteVm}.
 */
export async function createVm(
  token: string,
  name: string,
  teamIds: string[],
  options: { url?: string; embeddable?: boolean } = {}
): Promise<SeededVm> {
  const r = await vmCall<SeededVm>(token, '/api/vms', {
    method: 'POST',
    body: {
      name,
      teamIds,
      url: options.url ?? '',
      embeddable: options.embeddable ?? true,
    },
  });
  if (!r.ok) {
    throw new Error(`createVm failed for "${name}" (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Delete a VM. Tolerates 404 so it is safe from a `finally` that may run twice,
 * and warns rather than throws so a cleanup failure cannot mask the test's own.
 */
export async function deleteVm(token: string, vmId: string): Promise<void> {
  const r = await vmCall(token, `/api/vms/${vmId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteVm failed for ${vmId} (${r.status}): ${r.text}`);
  }
}

export interface VmMapCoordinate {
  id: string;
  xPosition: number;
  yPosition: number;
  radius: number;
  urls: string[];
  label: string;
}

export interface VmMap {
  id: string;
  viewId: string;
  name: string;
  imageUrl: string;
  teamIds: string[];
  coordinates: VmMapCoordinate[];
}

export interface VmMapForm {
  name: string;
  /** The teams the map is drawn for. Must belong to the view. */
  teamIds: string[];
  /**
   * The map image. Loaded by the browser verbatim, so point it at something in the
   * deployment when a spec renders the map, and leave it alone otherwise.
   */
  imageUrl?: string;
  /** Clickable regions. Cloned with the map, coordinates and labels included. */
  coordinates?: Partial<VmMapCoordinate>[];
}

/** Create a map on a view. Pair every call with {@link deleteMap}. */
export async function createMap(
  token: string,
  viewId: string,
  form: VmMapForm
): Promise<VmMap> {
  const r = await vmCall<VmMap>(token, `/api/views/${viewId}/map`, {
    method: 'POST',
    body: {
      name: form.name,
      teamIds: form.teamIds,
      imageUrl: form.imageUrl ?? '',
      coordinates: form.coordinates ?? [],
    },
  });
  if (!r.ok) {
    throw new Error(`createMap failed for "${form.name}" on view ${viewId} (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Every map in the deployment, coordinates included (`getAllMaps`). Needs the
 * `ViewViews` system permission, which the seeding admin has.
 */
export async function getAllMaps(token: string): Promise<VmMap[]> {
  const r = await vmCall<VmMap[]>(token, '/api/views/maps');
  if (!r.ok) {
    throw new Error(`getAllMaps failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/**
 * The maps filed under a view id, whoever they are drawn for.
 *
 * Filtered out of {@link getAllMaps} rather than read from the view's own endpoint,
 * because that endpoint (`getViewMaps`, `/api/views/maps/viewMaps/{viewId}`) cannot
 * see the maps this suite most needs to look at. It returns only maps whose teams
 * intersect the caller's *visibility context*, and that context is empty unless the
 * caller holds a primary team membership in the view — so a cloned view, which copies
 * no memberships, reads as having no maps at all, and a deleted view 404s. Neither is
 * distinguishable from "the map is not there", which is the assertion.
 */
export async function getMapsForView(token: string, viewId: string): Promise<VmMap[]> {
  return (await getAllMaps(token)).filter((map) => map.viewId === viewId);
}

/** Delete a map. Tolerates 404 and warns rather than throws, as with deleteVm. */
export async function deleteMap(token: string, mapId: string): Promise<void> {
  const r = await vmCall(token, `/api/views/maps/${mapId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteMap failed for ${mapId} (${r.status}): ${r.text}`);
  }
}

/**
 * Remove every map on a view.
 *
 * Maps live in the VM API's own database, keyed by view id, so deleting the
 * Player view does *not* cascade to them — a spec that creates a map through the
 * UI and then fails before its own delete step would leak the map row even
 * though its view is gone. Call this from teardown as the safety net.
 */
export async function deleteViewMaps(token: string, viewId: string): Promise<void> {
  for (const map of await getMapsForView(token, viewId).catch(() => [])) {
    await deleteMap(token, map.id);
  }
}

/** VMs visible to the caller on a team, as the VM UI's list would see them. */
export async function getTeamVms(token: string, teamId: string): Promise<SeededVm[]> {
  const r = await vmCall<SeededVm[]>(token, `/api/teams/${teamId}/vms`);
  if (!r.ok) {
    throw new Error(`getTeamVms failed for ${teamId} (${r.status}): ${r.text}`);
  }
  return r.data;
}

/**
 * Whether the VM API was started with usage logging turned on
 * (`VmUsageLogging:Enabled`). The VM UI reads the same endpoint and uses it to
 * *disable* the Usage Logging tab rather than hide it, so a spec that clicks
 * that tab has to gate on this: the tab is present either way, and clicking a
 * disabled `mat-tab` mounts nothing.
 *
 * Deployment configuration, not something a test can seed — hand the result to
 * `requirePrecondition`. Never throws; unreachable reads as "not enabled".
 */
export async function isUsageLoggingEnabled(token: string): Promise<boolean> {
  try {
    const r = await vmCall<boolean>(
      token,
      '/api/vmusageloggingsessions/isloggingenabled'
    );
    return r.ok && r.data === true;
  } catch {
    return false;
  }
}

export interface UsageLoggingSession {
  id: string;
  sessionName: string;
  viewId: string;
  teamIds: string[];
  sessionStart: string;
  sessionEnd: string;
}

export interface CreateUsageLoggingSessionOptions {
  viewId: string;
  teamIds: string[];
  sessionName: string;
  /** Defaults to a window that starts an hour ago and ends at the end of today. */
  sessionStart?: Date;
  sessionEnd?: Date;
}

/**
 * The start of today and the last minute of it, in local time — the window the
 * usage-logging specs seed inside.
 *
 * It has to be inside a single day for both halves of the feature to see the
 * session at once. `VmUsageLoggingService.CreateVmLogEntry` only attaches an
 * entry to a session whose `SessionStart` has passed and whose `SessionEnd` has
 * not, and `GetVmUsageReport` only counts a session the report range *fully
 * contains* (`reportStart <= SessionStart && reportEnd >= SessionEnd`), while
 * the report page floors its start date to 00:00 and ceilings its end to
 * 23:59:59. A session that ran past midnight satisfies the first and fails the
 * second, and the report would come back empty for reasons nothing on the page
 * explains.
 */
export function todaysLoggingWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 1, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return { start, end };
}

/**
 * Create a usage-logging session over the API.
 *
 * Seeded rather than created through the form when the session is a
 * *precondition* — the form is only worth driving in the one spec whose subject
 * it is. Pair every call with {@link deleteUsageLoggingSession}, or with
 * {@link deleteViewUsageLoggingSessions} in teardown.
 */
export async function createUsageLoggingSession(
  token: string,
  options: CreateUsageLoggingSessionOptions
): Promise<UsageLoggingSession> {
  const window = todaysLoggingWindow();
  const r = await vmCall<UsageLoggingSession>(token, '/api/vmusageloggingsessions', {
    method: 'POST',
    body: {
      sessionName: options.sessionName,
      viewId: options.viewId,
      teamIds: options.teamIds,
      sessionStart: (options.sessionStart ?? window.start).toISOString(),
      sessionEnd: (options.sessionEnd ?? window.end).toISOString(),
    },
  });
  if (!r.ok) {
    throw new Error(
      `createUsageLoggingSession failed for view ${options.viewId} (${r.status}): ${r.text}`
    );
  }
  return r.data;
}

/**
 * Usage-logging sessions, optionally narrowed to one view.
 *
 * Returns an empty list when logging is switched off: every endpoint but
 * `isloggingenabled` answers 404 with "Vm Usage Logging is disabled", which is a
 * configuration answer and not a failure to report from teardown.
 */
export async function listUsageLoggingSessions(
  token: string,
  viewId?: string
): Promise<UsageLoggingSession[]> {
  const r = await vmCall<UsageLoggingSession[]>(
    token,
    `/api/vmusageloggingsessions${viewId ? `?viewId=${viewId}` : ''}`
  );
  if (r.status === 404) {
    return [];
  }
  if (!r.ok) {
    throw new Error(`listUsageLoggingSessions failed (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
}

/** Delete a usage-logging session. Tolerates 404 and warns rather than throws, as with deleteVm. */
export async function deleteUsageLoggingSession(token: string, id: string): Promise<void> {
  const r = await vmCall(token, `/api/vmusageloggingsessions/${id}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) {
    console.warn(`deleteUsageLoggingSession failed for ${id} (${r.status}): ${r.text}`);
  }
}

/**
 * Remove every usage-logging session on a view.
 *
 * The same hazard as {@link deleteViewMaps}, and worse: sessions live in a
 * *separate* database from the VM API's own (`VmUsageLogging:PostgreSQL`), keyed
 * by view id, so deleting the Player view cascades to neither the session nor
 * the usage-log entries hanging off it. Call this from teardown as the safety
 * net for anything that created a session, including one created through the UI.
 */
export async function deleteViewUsageLoggingSessions(
  token: string,
  viewId: string
): Promise<void> {
  for (const session of await listUsageLoggingSessions(token, viewId).catch(() => [])) {
    await deleteUsageLoggingSession(token, session.id);
  }
}

/**
 * The session's log as the CSV endpoint renders it: a header line and one line
 * per log entry, CRLF-separated.
 *
 * `[Produces("text/csv")]` means this has to ask for `text/csv` — the default
 * `Accept: application/json` gets a 406 and no file.
 */
export async function usageLoggingSessionCsv(token: string, id: string): Promise<string> {
  const r = await vmCall(token, `/api/vmusageloggingsessions/${id}/download`, {
    accept: 'text/csv',
  });
  if (!r.ok) {
    throw new Error(`usageLoggingSessionCsv failed for ${id} (${r.status}): ${r.text}`);
  }
  return r.text;
}

export interface UsageLogEntryRow {
  vmId: string;
  vmName: string;
  userName: string;
  activeAt: string;
  inactiveAt: string;
  /**
   * Whether the entry has been closed. Only closed entries reach the report -
   * `GetVmUsageReport` filters on `VmInactiveDT > VmActiveDT` - so this is the
   * difference between a console that is open and one that has been left.
   */
  closed: boolean;
}

/**
 * `DateTimeOffset.MinValue` as the CSV prints it, which is what an open entry's
 * inactive column holds. The VM UI makes the same comparison against its
 * `CSHARP_MIN_DATE` constant; matched as text here rather than parsed because
 * `Date.parse` does not reliably accept .NET's `M/d/yyyy h:mm:ss tt zzz`.
 */
const csvMinDate = /^0?1\/0?1\/0001/;

/**
 * The log entries recorded against a usage-logging session.
 *
 * There is no endpoint that returns these as JSON - the CSV download is the only
 * way to see them - so this parses it. Nothing a test writes contains a comma:
 * the API joins on `", "` and does not quote, and it replaces the separators
 * inside the one field that can hold several values (`IpAddress`).
 */
export async function usageLogEntries(token: string, id: string): Promise<UsageLogEntryRow[]> {
  const lines = (await usageLoggingSessionCsv(token, id))
    .split(/\r?\n/)
    .slice(1)
    .filter((x) => x.trim().length > 0);

  return lines.map((line) => {
    const [, , vmId, vmName, , , userName, activeAt, inactiveAt] = line.split(', ');
    return {
      vmId,
      vmName,
      userName,
      activeAt,
      inactiveAt,
      closed: !csvMinDate.test((inactiveAt ?? '').trim()),
    };
  });
}

export interface SeededViewWithVm {
  token: string;
  viewId: string;
  /** The view's Admin team — the caller is a member and it is their primary team. */
  teamId: string;
  /**
   * Teams created by `options.extraTeamNames`, in the order requested. Empty
   * unless asked for. The caller is *not* a member of these — they exist so the
   * view has more than one team, which is the only thing the VM list's
   * `canSortByTeams$` looks at.
   */
  extraTeams: PlayerTeam[];
  vmId: string;
  vmName: string;
  /** Removes the VM and the view. Safe to call more than once. */
  cleanup: () => Promise<void>;
}

export interface SeedViewWithVmOptions {
  /**
   * Additional team names to create in the view. The VM list only offers "Sort
   * by Team" when `getTeams(viewId)` returns more than one team, so a spec that
   * exercises grouping needs a second team even though no VM is assigned to it.
   */
  extraTeamNames?: string[];
  /**
   * `Vm.url` — what the VM UI loads into the `app-focused-app` iframe when the
   * VM's name is clicked. Defaults to empty, as the API does. Point it at
   * something inert and same-origin-ish when a spec asserts on the iframe: the
   * assertion should be about the `src` the UI computed, not about whatever
   * that page then does.
   */
  vmUrl?: string;
}

/**
 * Seed the whole chain a VM-facing spec needs: a view, its Admin team (created
 * for us by the Player API), and one VM on that team.
 *
 * Call this from `beforeAll`/`beforeEach` and its `cleanup()` from the matching
 * `afterAll`/`afterEach` — not inline at the end of the test, which would leak
 * the view whenever an assertion fails mid-test. If any step throws, everything
 * created up to that point is removed before the error propagates, so a partial
 * failure does not leak either.
 *
 * `namePrefix` should identify the spec, so leftovers from a crashed run are
 * recognisable in the Player and VM admin lists.
 */
export async function seedViewWithVm(
  namePrefix: string,
  options: SeedViewWithVmOptions = {}
): Promise<SeededViewWithVm> {
  const token = await getPlayerToken();
  // Date.now() keeps concurrent projects (chromium + firefox) off each other's
  // records; the suite is not fully parallel, but retries reuse the same spec.
  const stamp = Date.now();
  let viewId: string | null = null;
  let vmId: string | null = null;

  const cleanup = async () => {
    if (vmId) {
      await deleteVm(token, vmId);
      vmId = null;
    }
    if (viewId) {
      // Maps are keyed by view id in the VM API's own database and are not
      // cascaded by the Player view delete, so they go first.
      await deleteViewMaps(token, viewId);
      await deleteView(token, viewId);
      viewId = null;
    }
  };

  try {
    const view = await createView(token, `${namePrefix} View ${stamp}`);
    viewId = view.id;

    const teams = await getViewTeams(token, view.id);
    const adminTeam = teams[0];
    if (!adminTeam) {
      throw new Error(`Seeded view ${view.id} has no Admin team — createAdminTeam did not take effect`);
    }

    // Extra teams are created before the VM only so that a failure here still
    // leaves nothing behind but the view, which `cleanup` already removes —
    // teams cascade with it.
    const extraTeams: PlayerTeam[] = [];
    for (const name of options.extraTeamNames ?? []) {
      extraTeams.push(await createTeam(token, view.id, `${name} ${stamp}`));
    }

    const vmName = `${namePrefix} VM ${stamp}`;
    const vm = await createVm(token, vmName, [adminTeam.id], { url: options.vmUrl });
    vmId = vm.id;

    return {
      token,
      viewId: view.id,
      teamId: adminTeam.id,
      extraTeams,
      vmId: vm.id,
      vmName,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Seed just a view (no VM) plus its Admin team, for specs that need a view id
 * and nothing in it — the map specs, whose assertions depend on the view having
 * *no* map assigned.
 */
export async function seedView(namePrefix: string): Promise<{
  token: string;
  viewId: string;
  teamId: string;
  cleanup: () => Promise<void>;
}> {
  const token = await getPlayerToken();
  const stamp = Date.now();
  let viewId: string | null = null;

  const cleanup = async () => {
    if (viewId) {
      // See seedViewWithVm: maps do not cascade with the Player view.
      await deleteViewMaps(token, viewId);
      await deleteView(token, viewId);
      viewId = null;
    }
  };

  try {
    const view = await createView(token, `${namePrefix} View ${stamp}`);
    viewId = view.id;

    const teams = await getViewTeams(token, view.id);
    const adminTeam = teams[0];
    if (!adminTeam) {
      throw new Error(`Seeded view ${view.id} has no Admin team — createAdminTeam did not take effect`);
    }

    return { token, viewId: view.id, teamId: adminTeam.id, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * The Keycloak client the Player API authenticates as when it calls the VM API's
 * callback. Its scopes have to include the one the VM API's privileged policy
 * requires (`player-vm-privileged` in the dev realm), or every delivery is a 403.
 */
const CALLBACK_CLIENT_ID = process.env.PLAYERVM_WEBHOOK_CLIENT_ID || 'player.vm.webhooks';

export interface VmCallbackSubscription {
  id: string;
  callbackUri: string;
  /**
   * The Player API's own account of the last delivery that failed, re-read on each
   * call and null once one succeeds. Worth folding into anything that waits on a
   * callback: it separates "the event never arrived" from "it arrived and did
   * nothing", and only the second is a fault in the VM API.
   */
  lastError: () => Promise<string | null>;
  /** Deletes the subscription. Safe to call more than once. */
  cleanup: () => Promise<void>;
}

/**
 * Subscribe the VM API's callback endpoint to the Player API's view events, which is
 * the only thing that makes half of the VM API's behaviour reachable at all.
 *
 * Maps and usage-logging sessions are copied onto a cloned view, and removed when a
 * view is deleted, by `CallbackBackgroundService` — and nothing calls that endpoint
 * but the Player API's webhook sender. There is no in-app trigger, no scheduler and
 * no UI for it, so a deployment with no subscription has the feature switched off
 * without saying so anywhere. **The Aspire dev stack is such a deployment**:
 * `SeedData.Subscriptions` is commented out in `player.api/appsettings.json` and the
 * AppHost sets none, so `GET /api/webhooks` is empty and a cloned view keeps none of
 * its parent's maps. A spec that wants to assert the contract has to make the
 * subscription itself.
 *
 * Two things it needs that this suite cannot seed, both handed to
 * `requirePrecondition` by way of a throw:
 *
 *   - **Credentials.** The Player API fetches a client-credentials token before each
 *     delivery, so the subscription carries a client id and secret. Read from
 *     Keycloak (`PLAYERVM_WEBHOOK_CLIENT_ID`, default `player.vm.webhooks`) rather
 *     than checked in, so this works on any deployment whose realm has the client;
 *     `PLAYERVM_WEBHOOK_CLIENT_SECRET` skips the lookup when the Keycloak admin
 *     account is not available.
 *   - **A callback address the Player API can reach.** `Services.PlayerVM.API` is
 *     resolved by *this process*, and the Player API is the one that has to connect.
 *     That is the same address under Aspire (both are local processes) and a
 *     different one anywhere the services are containerised, where
 *     `PLAYERVM_CALLBACK_URL` is the way in.
 *
 * The subscription is deployment-wide while it exists — every view created or
 * deleted by any spec is delivered through it — so `cleanup()` belongs in an
 * `afterAll`, and each caller creates its own rather than sharing one: two
 * subscriptions mean the same event is delivered twice, which the VM API handles
 * idempotently apart from cloning a map twice, while a shared one deleted by
 * whichever project finishes first would strand the other mid-poll.
 */
export async function subscribeVmToViewEvents(
  playerToken: string,
  name: string
): Promise<VmCallbackSubscription> {
  const callbackUri =
    process.env.PLAYERVM_CALLBACK_URL ||
    `${Services.PlayerVM.API.replace(/\/$/, '')}/api/callback`;

  let clientSecret = process.env.PLAYERVM_WEBHOOK_CLIENT_SECRET ?? null;
  if (!clientSecret) {
    clientSecret = await getClientSecret(await getKeycloakAdminToken(), CALLBACK_CLIENT_ID);
  }
  if (!clientSecret) {
    throw new Error(
      `No secret available for the Keycloak client "${CALLBACK_CLIENT_ID}" that the Player API ` +
        'would authenticate as, so a webhook subscription would fail every delivery. Set ' +
        'PLAYERVM_WEBHOOK_CLIENT_SECRET, or PLAYERVM_WEBHOOK_CLIENT_ID if this deployment names ' +
        'the client differently.'
    );
  }

  const subscription = await createWebhookSubscription(playerToken, {
    name,
    callbackUri,
    clientId: CALLBACK_CLIENT_ID,
    clientSecret,
    eventTypes: ['ViewCreated', 'ViewDeleted'],
  });

  let id: string | null = subscription.id;
  return {
    id: subscription.id,
    callbackUri,
    lastError: async () =>
      (await getWebhookSubscriptions(playerToken).catch(() => [])).find(
        (x) => x.id === subscription.id
      )?.lastError ?? null,
    cleanup: async () => {
      if (id) {
        await deleteWebhookSubscription(playerToken, id);
        id = null;
      }
    },
  };
}
