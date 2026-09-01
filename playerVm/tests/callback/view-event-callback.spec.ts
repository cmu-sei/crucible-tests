// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  cloneView,
  createView,
  deleteView,
  getPlayerToken,
  getViewTeams,
} from '../../../player-helpers';
import {
  createMap,
  createUsageLoggingSession,
  deleteViewMaps,
  deleteViewUsageLoggingSessions,
  getMapsForView,
  isUsageLoggingEnabled,
  listUsageLoggingSessions,
  subscribeVmToViewEvents,
  VmCallbackSubscription,
} from '../../vm-helpers';

/**
 * The callback the Player API POSTs to the VM API when a view is created or deleted —
 * the one contract in this estate that two APIs agree on and neither can check.
 *
 * The Player API raises `EntityCreated<ViewEntity>`/`EntityDeleted<ViewEntity>`, turns
 * each into a `ViewCreated { ViewId, ParentId, ViewName }` or `ViewDeleted { ViewId }`,
 * serialises it with `System.Text.Json`, and POSTs it to every subscription's callback
 * URI with a client-credentials token. The VM API takes that in at `POST api/callback`,
 * queues it, and `CallbackBackgroundService` spends it: a view with a parent gets the
 * parent's maps re-pointed at its own teams and a usage-logging session of its own, and
 * a deleted view loses its maps and has its running sessions closed. That is the whole
 * of "starting an exercise from a template keeps the map", and none of it is reachable
 * from either UI.
 *
 * Both sides are already tested in process, and that is exactly the problem this file
 * exists for. `CallbacksEndpointTests` and `CallbackBackgroundServiceTests` drive the VM
 * API's half from a *hand-written* event — the payload a fixture decided the Player API
 * would send — so a field renamed on the sending side breaks the feature while both
 * suites stay green. The VM API deserialises the inner payload with Newtonsoft and a
 * name it does not recognise is silently null, so there is no error anywhere: a cloned
 * view just quietly has no map. Nothing in either repository can catch that. This runs
 * against both real APIs, so the payload is the one the Player API actually sends.
 *
 * Two things shape the file:
 *
 *   - **It has to create the subscription.** The webhook is off unless a subscription
 *     exists, and the dev stack configures none (`SeedData.Subscriptions` is commented
 *     out) — so this feature has never run there at all. See `subscribeVmToViewEvents`
 *     for what that costs: while the subscription is up, every view any spec creates or
 *     deletes is delivered through it, and both browser projects run this file, so a
 *     single event can be delivered twice. Nothing here asserts a count for that
 *     reason; a doubled delivery clones a map twice and is otherwise idempotent.
 *   - **Every wait is bounded, and says why it gave up.** Delivery is a background queue
 *     on one side and a background service on the other, with a 5s-to-60s retry between
 *     them. Each wait goes through `awaitingDelivery`, which adds the subscription's
 *     `lastError` to a timeout: an error there means the event never landed (unreachable
 *     callback, refused token — a deployment fault), and no error with nothing done means
 *     it landed and the VM API made nothing of it, which is the contract breaking.
 *
 * API-only: there is no page in the estate that shows any of this.
 */
test.describe('View event callback', () => {
  let token: string;
  let subscription: VmCallbackSubscription;
  let subscribed = false;
  let subscribeError = '';
  let usageLoggingEnabled = false;

  /** Cleanup for everything a test made, drained in reverse in `afterEach`. */
  const cleanups: Array<() => Promise<void>> = [];

  test.beforeAll(async () => {
    token = await getPlayerToken();
    usageLoggingEnabled = await isUsageLoggingEnabled(token);
    try {
      subscription = await subscribeVmToViewEvents(token, `E2E View Callback ${Date.now()}`);
      subscribed = true;
    } catch (error) {
      // Deferred to each test rather than thrown here: a `requirePrecondition` in a
      // `beforeAll` would decide the whole file's verdict from a hook, and what is
      // missing is worth stating per test.
      subscribeError = error instanceof Error ? error.message : String(error);
    }
  });

  test.afterEach(async () => {
    // Reverse order, so a child view goes before the parent it was cloned from.
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  test.afterAll(async () => {
    // Not optional: a subscription left behind keeps the Player API POSTing every
    // view in the deployment at the VM API for as long as it exists.
    await subscription?.cleanup();
  });

  /**
   * Register a view for teardown. Maps and usage-logging sessions live in the VM
   * API's own databases keyed by view id and are cascaded by nothing, so they go
   * first — and they are removed here explicitly rather than left to the callback,
   * which is the thing under test and cannot be relied on to clean up after it.
   */
  const trackView = (viewId: string): void => {
    cleanups.push(async () => {
      await deleteViewUsageLoggingSessions(token, viewId);
      await deleteViewMaps(token, viewId);
      await deleteView(token, viewId);
    });
  };

  /** A view and its Admin team, registered for teardown before anything can throw. */
  const seedTrackedView = async (name: string) => {
    const view = await createView(token, name);
    trackView(view.id);
    const [team] = await getViewTeams(token, view.id);
    if (!team) {
      throw new Error(`Seeded view ${view.id} has no Admin team — createAdminTeam did not take effect`);
    }
    return { view, team };
  };

  const requireSubscription = (): void =>
    requirePrecondition(
      subscribed,
      'The Player API could not be subscribed to deliver view events to the VM API, so the ' +
        `callback under test cannot fire: ${subscribeError}`
    );

  /** Poll intervals for a delivery: fast at first, then patient enough for one retry. */
  const deliveryPoll = { timeout: 90000, intervals: [500, 1000, 2000, 3000, 5000, 10000] };

  /**
   * Run a wait for something a callback should have done, and if it never happens say
   * what the Player API thinks of the delivery.
   *
   * The two failures look identical from the VM API's side — nothing happened — and are
   * fixed in completely different places, so the distinction is worth carrying into the
   * message. It is reported rather than asserted on: the field belongs to the
   * subscription, not to this event, and the subscription carries every view event in
   * the deployment — so an assertion about it could fail over a hiccup delivering
   * somebody else's view while this test's callback worked perfectly.
   */
  const awaitingDelivery = async (wait: () => Promise<void>): Promise<void> => {
    try {
      await wait();
    } catch (error) {
      const lastError = await subscription.lastError();
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n\n` +
          `Player's last delivery error for this subscription: ${
            lastError ??
            'none — so the event was accepted and the VM API made nothing of it, which is ' +
              'the payload contract breaking rather than the deployment'
          }`
      );
    }
  };

  test("A view cloned from a parent is given the parent's maps, on its own team", async () => {
    requireSubscription();

    const stamp = Date.now();
    const parent = await seedTrackedView(`E2E Callback Parent View ${stamp}`);
    const mapName = `E2E Callback Map ${stamp}`;
    const original = await createMap(token, parent.view.id, {
      name: mapName,
      teamIds: [parent.team.id],
      imageUrl: 'map.png',
      coordinates: [
        { xPosition: 12.5, yPosition: 34.5, radius: 6, label: `Coordinate ${stamp}`, urls: [] },
      ],
    });

    const child = await cloneView(token, parent.view.id, `E2E Callback Child View ${stamp}`);
    trackView(child.id);

    // The clone's teams are new rows with the parent's names, and matching on the name
    // is how the VM API decides which of them a cloned map belongs to.
    const [childTeam] = await getViewTeams(token, child.id);
    expect(childTeam.name).toBe(parent.team.name);
    expect(childTeam.id).not.toBe(parent.team.id);

    // `toContain` rather than an exact list: with both browser projects subscribed, the
    // same `ViewCreated` can be delivered twice and cloned twice.
    await awaitingDelivery(() =>
      expect
        .poll(async () => (await getMapsForView(token, child.id)).map((x) => x.name), deliveryPoll)
        .toContain(mapName)
    );

    const [cloned] = (await getMapsForView(token, child.id)).filter((x) => x.name === mapName);
    expect(cloned.id).not.toBe(original.id);
    // The assertion the feature is for: the copy is drawn for the child's team, not
    // for a team in a view this one has nothing to do with.
    expect(cloned.teamIds).toEqual([childTeam.id]);
    expect(cloned.imageUrl).toBe(original.imageUrl);

    // Coordinates come with it, as new rows. A map cloned without them is an image
    // with nothing clickable on it, which renders as a working map.
    expect(cloned.coordinates).toHaveLength(1);
    expect(cloned.coordinates[0]).toMatchObject({
      label: original.coordinates[0].label,
      xPosition: original.coordinates[0].xPosition,
      yPosition: original.coordinates[0].yPosition,
      radius: original.coordinates[0].radius,
    });
    expect(cloned.coordinates[0].id).not.toBe(original.coordinates[0].id);

    // And the parent still has its own map: this is a copy, not a move.
    expect((await getMapsForView(token, parent.view.id)).map((x) => x.id)).toEqual([original.id]);
  });

  test('A cloned view is given a usage-logging session of its own, named after it', async () => {
    requireSubscription();
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session exists to clone and the endpoints that would read one answer 404'
    );

    const stamp = Date.now();
    const parent = await seedTrackedView(`E2E Callback Session Parent View ${stamp}`);
    await createUsageLoggingSession(token, {
      viewId: parent.view.id,
      teamIds: [parent.team.id],
      sessionName: `E2E Callback Parent Session ${stamp}`,
    });

    const childName = `E2E Callback Session Child View ${stamp}`;
    const child = await cloneView(token, parent.view.id, childName);
    trackView(child.id);

    // Named after the *child view*, which is the payload's `ViewName` — so this is also
    // the assertion that the field arrived at all. Newtonsoft leaves a name it does not
    // recognise null, and a null session name is what a rename on the Player API's side
    // looks like from here.
    await awaitingDelivery(() =>
      expect
        .poll(
          async () => (await listUsageLoggingSessions(token, child.id)).map((x) => x.sessionName),
          deliveryPoll
        )
        .toContain(childName)
    );

    const [session] = (await listUsageLoggingSessions(token, child.id)).filter(
      (x) => x.sessionName === childName
    );
    const [childTeam] = await getViewTeams(token, child.id);
    expect(session.teamIds).toEqual([childTeam.id]);

    // Running now and for a year: the session is meant to cover the whole of an
    // exercise nobody has scheduled the end of, and a console cannot be logged
    // against a session that is not open (`CreateVmLogEntry` checks the window).
    const start = new Date(session.sessionStart).getTime();
    const end = new Date(session.sessionEnd).getTime();
    expect(start).toBeLessThanOrEqual(Date.now());
    expect((end - start) / 86_400_000).toBeGreaterThan(360);
  });

  test('Deleting a view removes the maps filed under it', async () => {
    requireSubscription();

    const stamp = Date.now();
    const seeded = await seedTrackedView(`E2E Callback Deleted View ${stamp}`);
    const mapName = `E2E Callback Deleted Map ${stamp}`;
    await createMap(token, seeded.view.id, { name: mapName, teamIds: [seeded.team.id] });

    // Asserted before the delete so the wait below cannot pass on a map that was
    // never created — the VM API's maps outlive their view otherwise, which is the
    // whole reason this callback exists.
    expect((await getMapsForView(token, seeded.view.id)).map((x) => x.name)).toEqual([mapName]);

    await deleteView(token, seeded.view.id);

    await awaitingDelivery(() =>
      expect
        .poll(
          async () => (await getMapsForView(token, seeded.view.id)).map((x) => x.name),
          deliveryPoll
        )
        .toEqual([])
    );
  });

  test('Deleting a view closes a usage-logging session that is still running', async () => {
    requireSubscription();
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session can be created'
    );

    const stamp = Date.now();
    const seeded = await seedTrackedView(`E2E Callback Closed Session View ${stamp}`);
    // An hour out, so the session is unambiguously still running whatever time of day
    // this runs at: `EndVmLoggingSessions` only moves an end that is in the future,
    // and a session that had already lapsed would satisfy the assertion by itself.
    const session = await createUsageLoggingSession(token, {
      viewId: seeded.view.id,
      teamIds: [seeded.team.id],
      sessionName: `E2E Callback Closed Session ${stamp}`,
      sessionEnd: new Date(Date.now() + 60 * 60 * 1000),
    });
    expect(new Date(session.sessionEnd).getTime()).toBeGreaterThan(Date.now());

    await deleteView(token, seeded.view.id);

    // Sessions live in a separate database and are cascaded by neither the view nor
    // anything else, so the row is still there afterwards — closed rather than gone,
    // which is what keeps an ended exercise's recorded usage readable in the report.
    await awaitingDelivery(() =>
      expect
        .poll(
          async () =>
            (await listUsageLoggingSessions(token, seeded.view.id))
              .filter((x) => x.id === session.id)
              .map((x) => new Date(x.sessionEnd).getTime() <= Date.now()),
          deliveryPoll
        )
        .toEqual([true])
    );
  });
});
