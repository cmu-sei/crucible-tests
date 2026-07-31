// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoExhibitSection,
  apiCreateCollection,
  apiCreateExhibit,
  apiCreateTeam,
  apiCreateCard,
  apiCreateTeamCard,
  apiRenameCard,
  apiSetTeamCardShownOnWall,
  apiGetAdminUserId,
  apiAddUserToTeam,
  apiRemoveUserFromTeam,
  apiDeleteCollectionById,
} from '../../fixtures';

/**
 * Wall View Functionality — a TeamCard belonging to another exhibit's team must not
 * flip a card onto the Wall of the exhibit being viewed (regression cover for
 * gallery.ui `4fc3104`, the last of the `023e011` → `8b85554` → `4fc3104` series on
 * `isTeamCardInActiveExhibit`).
 *
 * ## Why a foreign TeamCard reaches this browser at all
 *
 * `TeamCardHandler.GetGroups` (gallery.api
 * `.../Infrastructure/EventHandlers/TeamCardHandler.cs`) addresses `TeamCardUpdated`
 * to the TeamCard's own id, to `MainHub.EXHIBIT_GROUP`, and to **every user on the
 * TeamCard's team**. The home/Wall area invokes `Join` (`signalr.service.ts` builds
 * the method name as `'Join' + applicationArea`, and `ApplicationArea.home` is the
 * empty string), and `MainHub.Join()` adds only the caller's own user-id group — so
 * `AdminExhibitGroup` is *not* joined here. The per-user group is enough on its own:
 * a user on teams in two exhibits receives that other exhibit's TeamCard events while
 * looking at this one. This was confirmed on a live stack by reading the websocket
 * frames, not inferred from the source: with the Wall open on exhibit B, a
 * `PUT /api/teamCards/{id}` against a team of exhibit A delivers a `TeamCardUpdated`
 * frame naming exhibit A's team to B's browser tab.
 *
 * That matters because the Wall's stores are flat and id-keyed and
 * `wall.component.ts#setShownCardList` matches a TeamCard to a Card **on `cardId`
 * alone** — it never re-checks the team. Collections are reusable across exhibits, so
 * A and B can share a collection and therefore a card id, and an accepted foreign
 * TeamCard with `isShownOnWall: true` puts that shared card onto B's Wall.
 *
 * ## Which branch of the predicate this pins
 *
 * `isTeamCardInActiveExhibit` has three arms:
 *   1. not scoped (admin area, or no active exhibit) → accept;
 *   2. team resolvable from the store *with* an `exhibitId` → accept iff it equals the
 *      active exhibit (**authoritative**);
 *   3. team unresolvable → accept unless `TeamDataService.loadedExhibitId` equals the
 *      active exhibit.
 *
 * **This spec pins branch 3's reject arm, not branch 2.** That is a deliberate choice
 * forced by what is reachable, and it is the arm `4fc3104` actually changed: branch 2
 * is byte-for-byte identical between `8b85554` and `4fc3104`, so a spec covering
 * branch 2 could not distinguish the two commits. Branch 2 is also unreachable for a
 * *foreign* team here, because `8b85554` added the matching `isTeamInActiveExhibit`
 * filter to the `TeamCreated`/`TeamUpdated` handlers — a foreign team can no longer
 * enter the team store while an exhibit is active, so a foreign TeamCard's team is
 * never resolvable and always falls through to branch 3.
 *
 * The state branch 3 must reject is an **authoritative empty** team load:
 * `TeamService.GetMineByExhibitAsync` returns `[]` for a user who is not on any team
 * of the requested exhibit, so `loadMine(B)` succeeds, sets the store empty, and
 * records `loadedExhibitId = B`. That is a steady state, not a transient one. Pre-fix
 * the fallback asked `teamQuery.hasEntity(t => t.exhibitId === B)`, which is false for
 * an empty store, so the negation **accepted every foreign TeamCard** for as long as
 * the user stayed on B. Post-fix the marker reads B and the event is rejected.
 *
 * ## How the state is reached through the UI
 *
 * The admin user starts as a member of B's team (so the Wall renders normally and
 * `switchTeam` joins B's groups), then that membership is dropped and the Wall is
 * re-entered via the in-app Archive → Wall buttons. Those are router navigations, so
 * `home-app.component.ts` re-fires `loadExhibitData()` → `loadMine(B)` — now an
 * authoritative empty — while the SignalR connection and its group memberships
 * survive. A full page reload would drop the per-user group subscription and the
 * foreign frame would never arrive, which is why this is a navigation and not a
 * `page.goto`.
 *
 * ## Why the pass cannot be vacuous
 *
 * Four guards, all asserted before the property:
 *
 *   - **Control 1** flips B's *own* TeamCard off and on again *while the user is still a
 *     member of B*, asserting both transitions render. This proves `TeamCardUpdated`
 *     frames reach this tab and that the Wall's `teamCardQuery.selectAll()`
 *     subscription recomputes — i.e. the whole delivery chain works. Note it exercises
 *     the predicate's *authoritative* branch, not branch 3: B's own team is in the store
 *     with a matching `exhibitId`, so the decision never reaches the fallback. (Confirmed
 *     by instrumenting the predicate: these events decide on the authoritative branch.
 *     Mutating it breaks this control; mutating only the fallback does not.) It has to
 *     happen before the membership drop: `GetGroups` addresses a TeamCard only to users on
 *     *that TeamCard's* team, so once the user leaves B's team, B's own TeamCard events
 *     legitimately stop arriving. (Discovered by running this control after the drop and
 *     watching it fail.)
 *   - **Frame-delivery assertion** reads the actual websocket frames and asserts that
 *     the foreign `TeamCardUpdated` was received by this tab. This is direct evidence
 *     of delivery rather than an inference from the source's group plumbing — the whole
 *     spec is meaningless if the frame never arrives, so it is asserted rather than
 *     assumed.
 *   - **Foreign-card precondition** asserts the foreign `CardUpdated` also arrived, so the
 *     leaked TeamCard has a card to flip. Without this the spec passes against the
 *     *pre-fix* predicate — verified by experiment. See the assertion at step 5.
 *   - **Ordering guard** renames the local card *after* the foreign event and waits for
 *     the new title. SignalR preserves frame order on one connection, so once the
 *     rename has rendered, the foreign frame's handler has already run. The final
 *     assertion is therefore a real check on the handler's decision rather than a race
 *     against a frame still in flight — no sleep needed. The rename travels as
 *     `CardUpdated`, which `CardHandler.GetGroups` fans out to every user on a team in
 *     any exhibit of the card's collection, so it still reaches this user via their
 *     surviving membership of A.
 *
 * The closing assertion is `toHaveText([...])` on the exact title list, which fails on
 * a leaked extra card *and* on a wrongly-dropped legitimate one. Verified both ways by
 * rebuilding `dist/browser` (which `:4723` serves via `npx serve`): with the pre-fix
 * `!teamQuery.hasEntity(...)` fallback the foreign card leaks onto B's Wall and this
 * fails with two cards; with `4fc3104` it stays at one.
 *
 * Seeds its own collection, since it needs two exhibits sharing one collection and
 * mutates team membership. Deleting the collection cascades to both exhibits, both
 * teams, the TeamUser rows, the cards and the TeamCards.
 */
test.describe('Wall View Functionality', () => {
  // Recorded as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Foreign TeamCard Test collection');
    }
    collectionId = undefined;
  });

  test('A TeamCard for another exhibit does not change this Wall', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const adminUserId = await apiGetAdminUserId();

    const collection = await apiCreateCollection(`Foreign TeamCard Test ${suffix}`);
    collectionId = collection.id;

    // Two exhibits in ONE collection: that shared collection is what lets a single
    // card id be meaningful to both, which is the precondition for the leak.
    const exhibitA = await apiCreateExhibit(collectionId, `Foreign TC Exhibit A ${suffix}`);
    const exhibitB = await apiCreateExhibit(collectionId, `Foreign TC Exhibit B ${suffix}`);

    const teamA = await apiCreateTeam(exhibitA.id, {
      name: `Foreign TC Team A ${suffix}`,
      shortName: `FTCA`,
    });
    const teamB = await apiCreateTeam(exhibitB.id, {
      name: `Foreign TC Team B ${suffix}`,
      shortName: `FTCB`,
    });

    // Membership of BOTH teams is what puts this user in the per-user SignalR group
    // that receives exhibit A's TeamCard events. Membership of B is dropped later; the
    // membership of A is kept, because it is the reason the foreign frame is delivered.
    await apiAddUserToTeam(teamA.id, adminUserId);
    await apiAddUserToTeam(teamB.id, adminUserId);

    // The local card: belongs to B's team, and is the control + liveness marker.
    const localCardName = `Foreign TC Local ${suffix}`;
    const localCard = await apiCreateCard(collectionId, localCardName);
    const localTeamCard = await apiCreateTeamCard(teamB.id, localCard.id, {
      isShownOnWall: true,
    });

    // The foreign card: same collection, but its only TeamCard belongs to exhibit A's
    // team. Created hidden so that flipping it on later is the event under test.
    const foreignCardName = `Foreign TC Foreign ${suffix}`;
    const foreignCard = await apiCreateCard(collectionId, foreignCardName);
    const foreignTeamCard = await apiCreateTeamCard(teamA.id, foreignCard.id, {
      isShownOnWall: false,
    });

    const wallCardTitles = page.locator('section.cards mat-card mat-card-title');

    // Record the TeamCardUpdated frames this tab actually receives, so delivery of the
    // foreign event can be asserted rather than assumed. Registered before the first
    // navigation so the Wall's connection is captured.
    const teamCardFrames: string[] = [];
    const cardFrames: string[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        const payload = String(frame.payload);
        if (payload.includes('"TeamCardUpdated"')) {
          teamCardFrames.push(payload);
        }
        if (payload.includes('"CardUpdated"')) {
          cardFrames.push(payload);
        }
      });
    });

    // 1. Open B's Wall as a member of B's team. Only the local card is shown.
    await gotoExhibitSection(page, exhibitB.id, 'wall');
    await expect(wallCardTitles).toHaveText([localCardName]);

    // 2. CONTROL 1 — flip B's OWN TeamCard off and on again, while the user is STILL a
    //    member of B's team. Both transitions are observable, which proves
    //    TeamCardUpdated frames arrive on this connection and that the Wall recomputes
    //    from them. This must precede the membership drop in step 3: `GetGroups` sends a
    //    TeamCard only to users on that TeamCard's own team, so afterwards B's own
    //    TeamCard events would no longer be addressed to this user at all.
    await apiSetTeamCardShownOnWall(localTeamCard.id, teamB.id, localCard.id, false);
    await expect(wallCardTitles).toHaveCount(0);
    await apiSetTeamCardShownOnWall(localTeamCard.id, teamB.id, localCard.id, true);
    await expect(wallCardTitles).toHaveText([localCardName]);

    // 3. Drop the membership of B's team, so `GET /api/exhibits/{B}/my-teams` becomes
    //    an authoritative empty for this user. Membership of A is kept: it is what keeps
    //    exhibit A's TeamCard events addressed to this user's group.
    await apiRemoveUserFromTeam(teamB.id, adminUserId);

    // 4. Re-enter the Wall through the in-app buttons so `loadMine(B)` re-runs and
    //    records `loadedExhibitId = B` over an empty store, WITHOUT tearing down the
    //    SignalR connection. `gotoArchive`/`gotoWallSection` emit `sectionSelected`,
    //    which `home-app.component.ts#gotoSection` turns into a router navigation.
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.locator('app-archive')).toBeVisible();
    await page.getByRole('button', { name: 'Wall' }).click();
    await expect(page.locator('app-wall')).toBeVisible();

    // The Wall still renders the local card: the teamCard store is not cleared by the
    // navigation, so this is the same starting shape as step 1.
    await expect(wallCardTitles).toHaveText([localCardName]);

    // 5. Put the foreign card into B's card store. `CardUpdated` is filtered only by
    //    collection (`isCardInActiveExhibit`), and the collection is shared, so this is
    //    accepted by design — the card being *present* is not the bug. What must not
    //    happen is a foreign TeamCard flipping it onto the wall.
    cardFrames.length = 0;
    await apiRenameCard(foreignCard.id, collectionId, foreignCardName, {
      description: 'foreign card, now in the shared collection store',
    });

    // expect: the foreign card really did reach this tab's card store. This step is a
    // *precondition* of the whole test, not a behaviour under test, and it must be
    // asserted rather than assumed: `setShownCardList` iterates the card store and looks
    // TeamCards up by `cardId`, so a leaked foreign TeamCard is invisible unless its Card
    // is present too. Verified by experiment — with this step's effect absent, the spec
    // goes GREEN against the pre-fix predicate, because there is no card for the leaked
    // TeamCard to flip. If `CardHandler`'s fan-out is ever narrowed, or
    // `isCardInActiveExhibit` starts rejecting cross-exhibit cards, this assertion fails
    // loudly instead of the spec silently testing nothing.
    await expect
      .poll(
        () => cardFrames.filter(payload => payload.includes(foreignCard.id)).length,
        { message: 'the foreign CardUpdated frame should have been delivered to this tab' }
      )
      .toBeGreaterThan(0);

    // 6. THE EVENT UNDER TEST — flip the FOREIGN TeamCard (exhibit A's team) to shown.
    //    Pre-fix this was accepted into the teamCard store and, because
    //    `setShownCardList` matches on `cardId` alone, put the foreign card on B's Wall.
    teamCardFrames.length = 0;
    await apiSetTeamCardShownOnWall(foreignTeamCard.id, teamA.id, foreignCard.id, true);

    // 7. ORDERING GUARD — rename the local card. SignalR preserves frame order on a
    //    single connection, so once this rename has rendered, the foreign frame from
    //    step 6 has already been delivered and its handler has already decided. This is
    //    what makes the assertion below deterministic without a fixed sleep. The rename
    //    arrives as `CardUpdated`, whose group fan-out covers every user on a team in
    //    any exhibit of the collection, so the surviving membership of A carries it.
    const localCardRenamed = `Foreign TC Local Renamed ${suffix}`;
    await apiRenameCard(localCard.id, collectionId, localCardRenamed);
    // `toContainText` rather than the exact list: this wait exists only to establish
    // ordering, and pre-fix the leaked foreign card is also on the wall by now. Asserting
    // the exact list here would fail at this line, which reads as "the rename never
    // arrived" rather than "a foreign card leaked" — the property assertion below is
    // where that failure belongs.
    await expect(wallCardTitles).toContainText([localCardRenamed]);

    // expect: the foreign TeamCard event really did reach this browser. Without this the
    // spec could pass simply because nothing was delivered, which would make the
    // assertion below meaningless. Asserted after the ordering guard above, so the frame
    // has had its chance to arrive.
    expect(
      teamCardFrames.filter(payload => payload.includes(foreignTeamCard.id)),
      'the foreign TeamCardUpdated frame should have been delivered to this tab'
    ).not.toHaveLength(0);

    // expect: the Wall shows ONLY B's own card. The exact-list form fails both on a
    // leaked foreign card (the pre-fix behaviour, which rendered two cards here) and on
    // a fix that over-corrected and dropped B's legitimate TeamCard.
    await expect(wallCardTitles).toHaveText([localCardRenamed]);
  });
});
