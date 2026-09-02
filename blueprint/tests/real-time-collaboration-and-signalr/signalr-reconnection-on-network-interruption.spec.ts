// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import type { WebSocket } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Verifies SignalR recovers from a network interruption: the client detects the drop,
 * retries, reopens the hub connection, re-joins the MSEL's group, and resumes delivering
 * real-time updates — all without a page reload.
 *
 * Rewritten. The previous version had two defects:
 *
 * 1. **It leaked a MSEL on every run.** It created one named the literal
 *    `'Reconnection Test MSEL'` through the UI with no afterEach, so the teardown purge
 *    (which matches the shape `tempBlueprintName()` emits) never swept it.
 * 2. **It could not fail.** Its real assertions were `pageIsResponsive` (`body` visible)
 *    and `document.readyState === 'complete'` — both true on any page that loads at all,
 *    and neither about SignalR. The reconnection check itself was
 *    `if (hasReconnectionBehavior) { expect(...).toBeTruthy() } else { console.warn(...) }`,
 *    which passes either way. It also called `page.reload()` before checking, which
 *    *creates* a fresh connection and so destroys the evidence of a reconnect. And its
 *    "disconnect notification" locator was a comma-joined `text=/.../i` string, which
 *    Playwright treats as one selector rather than a list, so it never matched anything.
 *
 * Reconnection is real and observable. Measured on this stack: with the context offline,
 * the client's `serverTimeout` fires at ~30s ("Connection reconnecting because of error
 * ... Server timeout elapsed"), `withAutomaticReconnect(new RetryPolicy(120, 0, 5))`
 * schedules retries, and once the network is restored the socket reopens and
 * "HubConnection reconnected successfully" is logged (~37s total). `onreconnected` then
 * calls `join()`, which re-invokes `Join` + `selectMsel`, and pushes resume.
 *
 * No fixed sleeps: every stage waits on a console line, a websocket lifecycle event, a
 * frame, or rendered DOM. There is deliberately NO `page.reload()` — the whole point is
 * that recovery happens on its own.
 *
 * ── Why this runs on Chromium only ──
 * The interruption is produced by `context.setOffline(true)`, and in Firefox that does not
 * reach an already-established WebSocket. Measured on this stack (Playwright 1.58.2,
 * bundled Firefox): with the context offline, `navigator.onLine` is `false` and `fetch()`
 * rejects with "NetworkError when attempting to fetch resource", yet the open hub socket
 * kept receiving frames — 3 server keepalive pings during a 45s offline window (the server
 * sends one every ~15s). Because messages keep arriving, the client's 30s `serverTimeout`
 * never elapses: 75s offline produced no transport error, no
 * "Connection reconnecting…", and no reconnect attempt at all. Chromium, by contrast,
 * severs the socket — keepalives stop, the timeout fires at ~32s, and the reconnect
 * sequence proceeds as described above.
 *
 * So on Firefox the test cannot interrupt the connection it is trying to interrupt; there is
 * nothing to detect and nothing to recover from. Closing the socket from page context
 * instead would test a clean client-side close (which logs "Connection reconnecting." with
 * no error, a different code path) rather than a network partition, so it is not a
 * substitute. This is a browser-automation limit, not an app or client defect — the SignalR
 * client code under test is the same JavaScript in both browsers, and Chromium exercises it
 * end to end.
 *
 * `page.on('websocket')` is filtered to `/hubs/main`, because the hub is not the only socket
 * the page may open. When the UI resource runs in dev mode (`Launch__Blueprint=true` ->
 * `ng serve`), `@angular-devkit/build-angular:dev-server` also opens a Vite HMR socket at
 * `ws://localhost:<uiPort>/?token=…`, and that socket both inflates the count and reopens on
 * its own when the network comes back — so an unfiltered `sockets.length` could satisfy the
 * "a new hub socket opened" assertion without SignalR having reconnected at all.
 */
const HUB_PATH = '/hubs/main';

test.describe('Real-time Collaboration and SignalR', () => {
  let token: string;
  let mselId: string;

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Chromium-only: context.setOffline() does not interrupt an open WebSocket in Firefox — see the comment above'
  );

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-SignalRReconnect'),
      description: 'Seeded to verify SignalR reconnection after a network interruption.',
    });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      try {
        await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    }
  });

  test('SignalR Reconnection on Network Interruption', async ({
    blueprintAuthenticatedPage: page,
    context,
  }) => {
    // The client only notices the drop when its 30s serverTimeout elapses, and the retry
    // policy can add another backoff step, so this needs more than the default budget.
    test.setTimeout(240000);

    const sockets: WebSocket[] = [];
    const sentFrames: string[] = [];
    const receivedFrames: string[] = [];
    const consoleLines: string[] = [];

    const payloadText = (payload: string | Buffer): string =>
      typeof payload === 'string' ? payload : payload.toString('utf8');

    page.on('websocket', (ws) => {
      // Ignore anything that is not the SignalR hub (see the note on HUB_PATH above).
      if (!new URL(ws.url()).pathname.endsWith(HUB_PATH)) return;
      sockets.push(ws);
      ws.on('framesent', (frame) => sentFrames.push(payloadText(frame.payload)));
      ws.on('framereceived', (frame) => receivedFrames.push(payloadText(frame.payload)));
    });
    page.on('console', (msg) => consoleLines.push(msg.text()));

    // ── 1. Establish the connection by viewing a MSEL ────────────────────────────────
    await navigateToMsel(page, mselId);

    await expect
      .poll(() => sockets.length, {
        timeout: 30000,
        intervals: [200, 500, 1000],
        message: 'the Blueprint UI never opened a hub WebSocket',
      })
      .toBe(1);
    expect(new URL(sockets[0].url()).pathname).toBe(
      `${new URL(Services.Blueprint.API).pathname.replace(/\/$/, '')}${HUB_PATH}`
    );

    // Prove real-time delivery works BEFORE the interruption, so the post-reconnect
    // assertion is a genuine recovery signal and not a first-ever success.
    const nameField = page.getByRole('textbox', { name: 'Name', exact: true });
    const baselineName = tempBlueprintName('TestBP-Reconnect-Before');
    await updateMsel(token, mselId, { name: baselineName });
    await expect
      .poll(() => receivedFrames.join('').includes('"target":"MselUpdated"'), {
        timeout: 30000,
        intervals: [250, 500, 1000],
        message: 'no MselUpdated push arrived before the interruption — SignalR was never healthy',
      })
      .toBe(true);
    await expect(nameField).toHaveValue(baselineName, { timeout: 20000 });

    const framesBeforeOffline = receivedFrames.length;

    // ── 2. Interrupt the network ─────────────────────────────────────────────────────
    await context.setOffline(true);

    // expect: the client detects the loss. `signalR.HubConnection` logs this exact line
    // when its serverTimeout elapses (~30s with the default 30s serverTimeout against a
    // 15s server keepalive), so it is a deterministic marker, not a text guess.
    await expect
      .poll(() => consoleLines.filter((l) => /Connection reconnecting because of error/i.test(l)).length, {
        timeout: 90000,
        intervals: [500, 1000],
        message: 'SignalR never reported losing the connection while the context was offline',
      })
      .toBeGreaterThan(0);

    // expect: automatic reconnection is attempted. `withAutomaticReconnect(RetryPolicy)`
    // logs a numbered attempt with its backoff delay for each retry.
    await expect
      .poll(() => consoleLines.filter((l) => /Reconnect attempt number \d+ will start in/i.test(l)).length, {
        timeout: 60000,
        intervals: [500, 1000],
        message: 'SignalR scheduled no reconnect attempts',
      })
      .toBeGreaterThan(0);

    // ── 3. Restore the network ───────────────────────────────────────────────────────
    await context.setOffline(false);

    // expect: a NEW hub socket is opened. This is the transport-level proof of recovery;
    // no reload is performed, so the second socket can only come from the retry policy.
    await expect
      .poll(() => sockets.length, {
        timeout: 150000,
        intervals: [500, 1000, 2000],
        message: 'SignalR never reopened a hub WebSocket after the network was restored',
      })
      .toBeGreaterThan(1);

    // expect: the client considers itself reconnected.
    await expect
      .poll(() => consoleLines.filter((l) => /HubConnection reconnected successfully/i.test(l)).length, {
        timeout: 90000,
        intervals: [500, 1000],
        message: 'SignalR never logged a successful reconnection',
      })
      .toBeGreaterThan(0);

    // expect: the reconnect handler re-joins the hub and re-selects this MSEL. Without
    // this the socket would be open but the client would receive nothing for the MSEL,
    // since group membership lives per-connection in MainHub. `onreconnected -> join()`
    // is what makes it hold (signalr.service.ts), and `join()` re-invokes selectMsel via
    // the retained `this.mselId`.
    const sentAfterReconnect = () => {
      const joinCount = sentFrames.join('').split('"target":"Join"').length - 1;
      const selectCount = sentFrames.join('').split('"target":"selectMsel"').length - 1;
      return { joinCount, selectCount };
    };
    await expect
      .poll(() => sentAfterReconnect().joinCount, {
        timeout: 60000,
        intervals: [250, 500, 1000],
        message: 'the client did not re-invoke Join after reconnecting',
      })
      .toBeGreaterThan(1);
    await expect
      .poll(() => sentAfterReconnect().selectCount, {
        timeout: 60000,
        intervals: [250, 500, 1000],
        message: `the client did not re-invoke selectMsel for ${mselId} after reconnecting`,
      })
      .toBeGreaterThan(1);

    // expect: real-time updates resume. Change the MSEL out-of-band again and require a
    // *new* push (counted from the pre-interruption baseline) plus the rendered value.
    const recoveredName = tempBlueprintName('TestBP-Reconnect-After');
    await updateMsel(token, mselId, { name: recoveredName });

    await expect
      .poll(
        () =>
          receivedFrames
            .slice(framesBeforeOffline)
            .join('')
            .includes('"target":"MselUpdated"'),
        {
          timeout: 90000,
          intervals: [250, 500, 1000],
          message:
            'no MselUpdated push arrived after reconnection — real-time updates did not resume',
        }
      )
      .toBe(true);

    // The UI applied the pushed change with no reload — the URL is unchanged throughout.
    await expect(nameField).toHaveValue(recoveredName, { timeout: 30000 });
    expect(page.url()).toBe(`${Services.Blueprint.UI}/build?msel=${mselId}`);
  });
});
