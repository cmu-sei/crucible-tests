// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoExhibitSection,
  apiSetExhibitMoveAndInject,
  Services,
} from '../../fixtures';
import { request as pwRequest, type APIRequestContext } from '@playwright/test';
import { authStatePath } from '../../../auth-paths';

/**
 * Edge Cases §15.6 — Concurrent Operations.
 *
 * Both scenarios mutate persistent state on the worker-scoped `seededExhibit`
 * (Advance writes CurrentMove/CurrentInject; marking read writes UserArticle.IsRead), so
 * `afterEach` restores the starting position and clears every read flag it set. The
 * seeded exhibit is used rather than a fresh one on purpose: `AdvanceAsync` walks the
 * distinct move/inject pairs of the collection's *articles*, so a bare exhibit has
 * nothing to advance through and would 400 on the first click.
 */

/** The seeded exhibit's article positions, in the order Advance walks them. */
const POSITIONS = [
  { move: 0, inject: 0 },
  { move: 1, inject: 0 },
  { move: 1, inject: 1 },
];
const START = POSITIONS[0];

/** Run a callback with a Gallery API context and an admin bearer token. */
async function galleryApi<T>(fn: (ctx: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const tokenRes = await ctx.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
    });
    if (!tokenRes.ok()) {
      throw new Error(`Failed to get Gallery API token: ${tokenRes.status()} ${await tokenRes.text()}`);
    }
    return await fn(ctx, (await tokenRes.json()).access_token);
  } finally {
    await ctx.dispose();
  }
}

interface UserArticleState {
  id: string;
  isRead: boolean;
}

/** The read state of every UserArticle for one team on one exhibit. */
async function apiGetTeamUserArticles(
  exhibitId: string,
  teamId: string
): Promise<UserArticleState[]> {
  return await galleryApi(async (ctx, token) => {
    const res = await ctx.get(
      `${Services.Gallery.API}/api/exhibits/${exhibitId}/teams/${teamId}/userarticles`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!res.ok()) {
      throw new Error(`Failed to list user articles: ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as UserArticleState[];
  });
}

/** Force one UserArticle's read flag, used to undo what a test marked. */
async function apiSetUserArticleIsRead(userArticleId: string, isRead: boolean): Promise<void> {
  await galleryApi(async (ctx, token) => {
    const res = await ctx.put(
      `${Services.Gallery.API}/api/userArticles/${userArticleId}/isread`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: isRead,
      }
    );
    if (!res.ok()) {
      console.warn(`Cleanup: failed to reset UserArticle ${userArticleId}: ${res.status()}`);
    }
  });
}

test.describe('Edge Cases and Negative Testing', () => {
  // UserArticle ids this spec marked read, so afterEach can put them back. Ids are only
  // ever this exhibit's own, never a broad reset.
  let markedReadIds: string[] = [];

  test.beforeEach(() => {
    markedReadIds = [];
  });

  test.afterEach(async ({ seededExhibit }) => {
    for (const id of markedReadIds) {
      await apiSetUserArticleIsRead(id, false);
    }
    // `seededExhibit` is worker-scoped, so leaving it advanced would corrupt every later
    // test in this worker.
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, START.move, START.inject);
  });

  /**
   * §15.6 step 1 — rapidly click the Advance button multiple times.
   *
   * What rapid clicking really does: exactly ONE advance per burst. `wall.component.ts`
   * guards with `advanceExhibit() { if (!this.exhibit?.id || this.isAdvancing) return; }`
   * and the template binds `[disabled]="isAdvancing"`, so the first click latches the
   * flag and every click landing before the response returns is dropped on the floor.
   * The plan's "advances correctly without skipping" therefore holds in the strongest
   * possible sense — extra clicks are not queued up and replayed, they are discarded.
   *
   * Proving that needs the clicks to genuinely overlap. `locator.click()` auto-waits for
   * the element to be enabled, so a loop of plain clicks would politely serialise itself
   * and advance N times — testing nothing. `dispatchEvent('click')` skips the
   * actionability check and delivers the event straight to Angular's listener, which is
   * what a real burst of fast user clicks looks like to the component.
   */
  test('Rapid Advance Clicks', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, START.move, START.inject);

    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    const advanceButton = page.getByRole('button', { name: 'Advance' });
    await expect(advanceButton).toBeVisible();

    const moveInjectLabel = page.getByText(/Move \d+, Inject \d+/);
    await expect(moveInjectLabel).toHaveText(`Move ${START.move}, Inject ${START.inject}`);

    // Count every advance request the page actually issues, so a dropped click is
    // distinguishable from a click that reached the API.
    let advanceRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/advance') && request.method() === 'PUT') {
        advanceRequests++;
      }
    });

    // Two bursts, so the assertion is "one advance per burst" rather than a one-off.
    for (const expected of POSITIONS.slice(1)) {
      const requestsBefore = advanceRequests;

      const advanced = page.waitForResponse(
        (r) => r.url().includes('/advance') && r.request().method() === 'PUT'
      );

      // Fire five clicks as fast as the driver allows, without awaiting the app between
      // them, so they contend for the same in-flight request.
      await Promise.all(
        Array.from({ length: 5 }, () => advanceButton.dispatchEvent('click'))
      );

      // expect: the app handles the rapid clicks gracefully — the one request that got
      // through succeeds.
      expect((await advanced).status()).toBe(200);

      // expect: the move/inject advances by exactly one seeded position — no skipping.
      await expect(moveInjectLabel).toHaveText(`Move ${expected.move}, Inject ${expected.inject}`);

      // expect: the four suppressed clicks never became requests. This is the assertion
      // that would catch a regression re-introducing queued double-advances.
      expect(advanceRequests - requestsBefore).toBe(1);
    }

    // expect: no error surfaced anywhere during the bursts. A 400 from an extra advance
    // would have opened the "Cannot advance." snackbar (see advance-boundary.spec.ts).
    await expect(page.getByText('Cannot advance.')).toHaveCount(0);

    // Position is at the last seeded pair and nothing was skipped along the way.
    const last = POSITIONS[POSITIONS.length - 1];
    await expect(moveInjectLabel).toHaveText(`Move ${last.move}, Inject ${last.inject}`);
    expect(advanceRequests).toBe(POSITIONS.length - 1);
  });

  /**
   * §15.6 step 2 — open the same article in two browser contexts and mark Read in both.
   *
   * The second context reuses the storageState `global-setup.ts` provisioned, so it costs
   * a navigation rather than a second Keycloak login. Both contexts are the same admin
   * user on the same team, so they address the *same* UserArticle row — which is the
   * point: two concurrent `PUT /api/userArticles/{id}/isread` calls against one record.
   */
  test('Concurrent Mark Read in Two Contexts', async ({
    galleryAuthenticatedPage: page,
    browser,
    seededExhibit,
  }) => {
    // Articles at (0,0) are only visible at/after that position, so pin it.
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, START.move, START.inject);

    // The seeded article at (0,0) that both contexts will act on.
    const articleName = 'Intel Article 1';

    // Resolve the UserArticle id up front and register it for teardown *before* either
    // context touches it, so a mid-test failure still gets the flag cleared.
    const before = await apiGetTeamUserArticles(seededExhibit.exhibitId, seededExhibit.teamId);
    expect(before.length).toBeGreaterThan(0);
    for (const ua of before) {
      markedReadIds.push(ua.id);
    }

    /** Open the exhibit's Archive and return the target article's Read button. */
    const openArticle = async (target: import('@playwright/test').Page) => {
      await gotoExhibitSection(target, seededExhibit.exhibitId, 'archive');
      await expect(target).toHaveTitle(/Gallery Archive/);

      // Locate the card by its article name rather than typing into "Search the Archive".
      // That search box crashes the view: `archive.component.ts` filters with
      // `a.article.sourceType.toLowerCase()`, but the API serializes `sourceType` as a
      // numeric enum (verified live: `"sourceType":0` on GET
      // /api/exhibits/{id}/articles), so the filter throws
      // "TypeError: a.article.sourceType.toLowerCase is not a function" and Angular's
      // ErrorHandler covers the page in error sheets (pending upstream: the Archive
      // search predicate calls `.toLowerCase()` on a `sourceType` the API serializes as a
      // number). That is unrelated to the concurrency behaviour under test, so this spec
      // routes around it rather than tripping over it. Scoping by name is sufficient:
      // gotoExhibitSection pins the view to this exhibit, so only its own articles are
      // present.
      const card = target.locator('mat-card.card').filter({ hasText: articleName });
      await expect(card).toHaveCount(1);

      // `toggleReadStatus` is gated on `myTeamIsSelected()`, so an enabled button also
      // proves the team context resolved in this browser context.
      const readButton = card.getByRole('button', { name: 'Read' });
      await expect(readButton).toBeEnabled();
      return readButton;
    };

    // First context: the fixture's already-authenticated page.
    const firstReadButton = await openArticle(page);

    // Second context, seeded with the same saved auth state.
    const secondContext = await browser.newContext({
      storageState: authStatePath('gallery'),
      ignoreHTTPSErrors: true,
    });
    try {
      const secondPage = await secondContext.newPage();
      const secondReadButton = await openArticle(secondPage);

      /**
       * Click Read and return the PUT it issued, re-clicking one the app swallowed.
       *
       * A click here can produce no request at all. The other context's write lands first
       * and flips this context's `userArticle.isRead`, and the two Read buttons live in
       * `@if (!userArticle.isRead)` / `@if (userArticle.isRead)` blocks — so that flip makes
       * Angular destroy the button being clicked and build the other branch's copy in its
       * place. A click already committed to the old node then reaches a listener that is no
       * longer wired up, and `toggleReadStatus` never runs. That is what made this test
       * flaky on Firefox: `page.waitForResponse` timed out having seen no PUT.
       *
       * The wait is armed before the click, per context, so no response can be missed. Only
       * a swallowed click costs a retry, so the common path is still both clicks dispatched
       * together against the same record.
       */
      const markRead = async (
        target: import('@playwright/test').Page,
        button: import('@playwright/test').Locator
      ) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const pending = target
            .waitForResponse(
              (r) => r.url().includes('/isread') && r.request().method() === 'PUT',
              { timeout: 5000 }
            )
            .catch(() => null);
          await button.click();
          const response = await pending;
          if (response) {
            return response;
          }
        }
        throw new Error(`Read was clicked 3 times without issuing a PUT: ${target.url()}`);
      };

      // Mark Read in both contexts concurrently.
      // expect: both operations complete without errors. Neither request is rejected as a
      // conflict — `SetIsReadAsync` is a last-writer-wins update, so both are accepted.
      const [firstResult, secondResult] = await Promise.all([
        markRead(page, firstReadButton),
        markRead(secondPage, secondReadButton),
      ]);
      expect(firstResult.status()).toBe(200);
      expect(secondResult.status()).toBe(200);

      // Both contexts acted on the same underlying record, which is what makes this a
      // genuine concurrency case rather than two unrelated writes.
      expect(new URL(firstResult.url()).pathname).toBe(new URL(secondResult.url()).pathname);

      // expect: no error notification in either context.
      await expect(page.locator('app-system-message')).toHaveCount(0);
      await expect(secondPage.locator('app-system-message')).toHaveCount(0);

      // The record survives both writes holding one of the two submitted values — the
      // last writer wins and nothing is left corrupted or half-applied.
      //
      // Deliberately NOT asserted as `isRead === true`. `toggleReadStatus` sends
      // `!userArticle.isRead` computed from *that* context's copy of the record, and the
      // first write's response/broadcast can reach the second context before its own click
      // is dispatched — in which case the second context submits `false` and the record
      // legitimately converges to unread. An earlier version asserted `true` here and was
      // flaky on Firefox for exactly that reason. The plan's expectation for this step is
      // "both operations complete without errors", which the status and system-message
      // assertions above cover; what is additionally deterministic is the convergence
      // below, so that is what is claimed.
      const submitted = [firstResult, secondResult].map(
        (result) => JSON.parse(result.request().postData() ?? 'null') as boolean | null
      );
      expect(submitted, 'both contexts submitted a boolean isRead').toEqual([
        expect.any(Boolean),
        expect.any(Boolean),
      ]);

      const targetId = new URL(firstResult.url()).pathname.split('/').at(-2)!;
      const after = await apiGetTeamUserArticles(seededExhibit.exhibitId, seededExhibit.teamId);
      const storedIsRead = after.find((ua) => ua.id === targetId)?.isRead;
      expect(submitted, `stored isRead=${storedIsRead} is one of the submitted values`).toContain(
        storedIsRead
      );

      // When both contexts did submit the same value — the case where "the two writes
      // converge rather than cancelling out" is a meaningful claim — that value must be
      // the stored one. This is the assertion that would catch a write being dropped.
      if (submitted[0] === submitted[1]) {
        expect(storedIsRead, 'both contexts submitted the same value').toBe(submitted[0]);
      }
    } finally {
      await secondContext.close();
    }
  });
});
