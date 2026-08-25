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
import {
  createView,
  deleteView,
  getPlayerToken,
  getViewTeams,
} from '../player-helpers';

async function newContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

async function vmCall<T = any>(
  token: string,
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const base = Services.PlayerVM.API.replace(/\/$/, '');
  const ctx = await newContext();
  try {
    const res = await ctx.fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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

export interface SeededMap {
  id: string;
  name: string;
}

/**
 * Maps assigned to a view. Returns an empty list for a view with no maps and
 * (per the API) 404s for a view the caller cannot see — treated as "no maps"
 * here so this is usable from teardown after the view has already been deleted.
 */
export async function getViewMaps(token: string, viewId: string): Promise<SeededMap[]> {
  const r = await vmCall<SeededMap[]>(token, `/api/views/maps/viewMaps/${viewId}`);
  if (r.status === 404) {
    return [];
  }
  if (!r.ok) {
    throw new Error(`getViewMaps failed for ${viewId} (${r.status}): ${r.text}`);
  }
  return r.data ?? [];
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
  for (const map of await getViewMaps(token, viewId).catch(() => [])) {
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

export interface SeededViewWithVm {
  token: string;
  viewId: string;
  /** The view's Admin team — the caller is a member and it is their primary team. */
  teamId: string;
  vmId: string;
  vmName: string;
  /** Removes the VM and the view. Safe to call more than once. */
  cleanup: () => Promise<void>;
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
export async function seedViewWithVm(namePrefix: string): Promise<SeededViewWithVm> {
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

    const vmName = `${namePrefix} VM ${stamp}`;
    const vm = await createVm(token, vmName, [adminTeam.id]);
    vmId = vm.id;

    return { token, viewId: view.id, teamId: adminTeam.id, vmId: vm.id, vmName, cleanup };
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
