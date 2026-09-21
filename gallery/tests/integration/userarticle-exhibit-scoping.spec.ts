// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  apiCreateCollection,
  apiCreateExhibit,
  apiCreateTeam,
  apiCreateArticle,
  apiCreateUserArticle,
  apiCreateGalleryUser,
  apiDeleteGalleryUser,
  apiGetAdminUserId,
  apiAddUserToTeam,
  apiSetExhibitMoveAndInject,
  apiGetExhibitUserArticles,
  apiGetExhibitTeamUserArticles,
  apiDeleteCollectionById,
} from '../../fixtures';
import { randomUUID } from 'crypto';

/**
 * Integration and API — both UserArticle list endpoints must answer only with articles
 * belonging to the exhibit named in the route.
 *
 * ## Why this is worth an e2e test at all
 *
 * Collections are reusable, so running the same MSEL as several concurrent exhibits is
 * the normal deployment shape — one per class section. Every UserArticle query in
 * `UserArticleService` therefore carries the same two-part predicate: the row must
 * belong to *this* exhibit, **and** its article must have been released by this
 * exhibit's position on the timeline (move behind the exhibit's current move, or the
 * same move with the inject at or behind). Those two halves are independent, and both
 * endpoints covered here had lost the first half in different ways — one to operator
 * precedence, one to an omitted predicate. Neither is visible from a single-exhibit
 * stack, which is why nothing caught them; both specs below seed a second exhibit
 * deliberately.
 *
 * ## Why move/inject is set the way it is
 *
 * Both exhibits are parked at move 1 / inject 1, and the foreign article sits at move 1
 * / inject 0. That is not arbitrary — it is the position that makes the precedence bug
 * observable. With `&&` binding tighter than `||`, the unparenthesised predicate parses
 * as `(exhibit matches AND move is behind) OR (move is equal AND inject is at or
 * behind)`: the exhibit test guards only the first arm, so a row leaks exactly when it
 * satisfies the *second* arm. Move 1 / inject 0 against a current position of 1/1 does.
 * A foreign article at move 0 would satisfy only the first arm and so would be filtered
 * correctly even by the broken predicate — it could never demonstrate the defect.
 *
 * Parking the foreign exhibit at the same 1/1 also means the foreign article is
 * genuinely released *within its own exhibit*, which each spec asserts as a precondition
 * (see the "foreign row really exists" guards). Without that the specs could pass simply
 * because nothing was ever seeded.
 *
 * ## Why the articles are collection-level
 *
 * The articles are seeded without an `exhibitId`; it is the UserArticle rows that carry
 * the exhibit. That is not a shortcut — `UserArticleEntity.ExhibitId` is the only exhibit
 * column any of these queries reads, so `Article.ExhibitId` is immaterial to what is
 * under test, and a collection-level article is the ordinary state of a MSEL template
 * before instantiation. It also keeps the seed off two unrelated 500s in
 * `ArticleService.LogXApiAsync`, which `CreateAsync` only reaches for an exhibit-scoped
 * article. See the note on `apiCreateArticle` in `gallery/fixtures.ts`.
 *
 * ## Cleanup
 *
 * Deleting the collection cascades to both exhibits, their teams and TeamUser rows, the
 * articles and the UserArticles. The seeded Gallery user is *not* cascaded by anything,
 * so it is deleted separately — and after the collection, because its UserArticle rows
 * reference it.
 */
test.describe('Integration and API', () => {
  // Recorded as soon as each resource exists so `afterEach` removes it even when the
  // test body throws partway through.
  let collectionId: string | undefined;
  let seededUserId: string | undefined;

  test.afterEach(async () => {
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'UserArticle exhibit scoping collection');
      collectionId = undefined;
    }
    // After the collection: the user's UserArticle rows have to go first.
    if (seededUserId) {
      await apiDeleteGalleryUser(seededUserId);
      seededUserId = undefined;
    }
  });

  test('Exhibit user articles exclude another exhibit\'s articles', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const adminUserId = await apiGetAdminUserId();

    const collection = await apiCreateCollection(`UA Scoping ${suffix}`);
    collectionId = collection.id;

    const exhibitA = await apiCreateExhibit(collectionId, `UA Scoping Exhibit A ${suffix}`);
    const exhibitB = await apiCreateExhibit(collectionId, `UA Scoping Exhibit B ${suffix}`);

    // Both exhibits at the same position, so the foreign article is released in its own
    // exhibit as well as being a candidate to leak into this one. See the header.
    await apiSetExhibitMoveAndInject(exhibitA.id, 1, 1);
    await apiSetExhibitMoveAndInject(exhibitB.id, 1, 1);

    // Three articles in exhibit B spanning the release boundary, so the assertion below
    // pins both halves of the predicate rather than just the exhibit half:
    //   - `early`  is released by the move comparison alone;
    //   - `current` is released by the move-equal/inject comparison;
    //   - `future` is released by neither and must stay out.
    // Without `future`, a predicate that had collapsed to "this exhibit, unconditionally"
    // would also pass.
    const bEarly = await apiCreateArticle(collectionId, `UA Scoping B Early ${suffix}`, {
      move: 0,
      inject: 0,
    });
    const bCurrent = await apiCreateArticle(collectionId, `UA Scoping B Current ${suffix}`, {
      move: 1,
      inject: 1,
    });
    const bFuture = await apiCreateArticle(collectionId, `UA Scoping B Future ${suffix}`, {
      move: 2,
      inject: 0,
    });

    // The foreign article: its UserArticle row lands in exhibit A below, positioned to
    // satisfy the second arm of the predicate against exhibit B's current position.
    const aForeign = await apiCreateArticle(collectionId, `UA Scoping A Foreign ${suffix}`, {
      move: 1,
      inject: 0,
    });

    await apiCreateUserArticle(exhibitB.id, adminUserId, bEarly.id);
    await apiCreateUserArticle(exhibitB.id, adminUserId, bCurrent.id);
    await apiCreateUserArticle(exhibitB.id, adminUserId, bFuture.id);
    await apiCreateUserArticle(exhibitA.id, adminUserId, aForeign.id);

    // expect: the foreign row really exists and really is released for its own exhibit.
    // This is a precondition of the whole test, not behaviour under test: if the seed
    // were wrong, or the release gate excluded it everywhere, the assertion below would
    // pass vacuously.
    const exhibitAArticles = await apiGetExhibitUserArticles(exhibitA.id);
    expect(
      exhibitAArticles.map(ua => ua.articleId),
      'the foreign article should be visible on its own exhibit'
    ).toContain(aForeign.id);

    const exhibitBArticles = await apiGetExhibitUserArticles(exhibitB.id);

    // expect: nothing from another exhibit came back. Asserted as a property over the
    // whole response rather than just the absence of `aForeign`, because the broken
    // predicate leaks every released-by-the-second-arm row in the database, not only the
    // one this test seeded.
    expect(
      [...new Set(exhibitBArticles.map(ua => ua.exhibitId))],
      'every user article returned for an exhibit should belong to that exhibit'
    ).toEqual([exhibitB.id]);

    // expect: exactly B's two released articles. Exhibit B was created by this test and
    // nothing auto-creates UserArticles for it (the seeded articles are collection-level,
    // so `ArticleService.CreateAsync` never enters its exhibit fan-out), so the set is
    // fully determined. The exact form fails both on a leaked foreign row and on an
    // over-corrected filter that dropped a legitimate one.
    expect(new Set(exhibitBArticles.map(ua => ua.articleId))).toEqual(
      new Set([bEarly.id, bCurrent.id])
    );

    // expect: the unreleased article is still withheld — the exhibit filter was added
    // without loosening the timeline gate.
    expect(exhibitBArticles.map(ua => ua.articleId)).not.toContain(bFuture.id);
  });

  test('An observer sees only the observed team\'s articles for this exhibit', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const adminUserId = await apiGetAdminUserId();

    // The observed team needs a member who is not the caller: the observer branch
    // answers with the *other* team's rows, so somebody else has to own them.
    seededUserId = randomUUID();
    await apiCreateGalleryUser(seededUserId, `UA Scoping Observed ${suffix}`);

    const collection = await apiCreateCollection(`UA Observer Scoping ${suffix}`);
    collectionId = collection.id;

    const exhibitA = await apiCreateExhibit(collectionId, `UA Observer Exhibit A ${suffix}`);
    const exhibitB = await apiCreateExhibit(collectionId, `UA Observer Exhibit B ${suffix}`);
    await apiSetExhibitMoveAndInject(exhibitA.id, 1, 1);
    await apiSetExhibitMoveAndInject(exhibitB.id, 1, 1);

    // Exhibit B holds both the observer's team and the observed team. `GetByExhibitTeamAsync`
    // resolves the caller's TeamUser row with `SingleOrDefault` scoped to the exhibit, so
    // admin must be on exactly one team here — the observer team, and only that one.
    const observerTeam = await apiCreateTeam(exhibitB.id, {
      name: `UA Observer Team ${suffix}`,
      shortName: 'UAOBS',
    });
    const observedTeam = await apiCreateTeam(exhibitB.id, {
      name: `UA Observed Team ${suffix}`,
      shortName: 'UAOBD',
    });
    await apiAddUserToTeam(observerTeam.id, adminUserId, { isObserver: true });
    await apiAddUserToTeam(observedTeam.id, seededUserId);

    // The same person on a team in the other exhibit. The query filters on user ids
    // alone, so this membership is not strictly required to reproduce the leak — but it
    // is how the situation arises in practice (one student in two sections of the same
    // course), so the spec seeds the realistic shape rather than the minimal one.
    const foreignTeam = await apiCreateTeam(exhibitA.id, {
      name: `UA Observer Foreign Team ${suffix}`,
      shortName: 'UAFGN',
    });
    await apiAddUserToTeam(foreignTeam.id, seededUserId);

    const bCurrentName = `UA Observer B Current ${suffix}`;
    const bCurrent = await apiCreateArticle(collectionId, bCurrentName, {
      move: 1,
      inject: 1,
    });
    const bFuture = await apiCreateArticle(collectionId, `UA Observer B Future ${suffix}`, {
      move: 2,
      inject: 0,
    });
    const aForeign = await apiCreateArticle(collectionId, `UA Observer A Foreign ${suffix}`, {
      move: 1,
      inject: 0,
    });

    await apiCreateUserArticle(exhibitB.id, seededUserId, bCurrent.id);
    await apiCreateUserArticle(exhibitB.id, seededUserId, bFuture.id);
    await apiCreateUserArticle(exhibitA.id, seededUserId, aForeign.id);

    // expect: the foreign row exists and is released for its own exhibit — same
    // precondition guard as the first spec.
    const exhibitAArticles = await apiGetExhibitUserArticles(exhibitA.id);
    expect(
      exhibitAArticles.map(ua => ua.articleId),
      'the foreign article should be visible on its own exhibit'
    ).toContain(aForeign.id);

    const observed = await apiGetExhibitTeamUserArticles(exhibitB.id, observedTeam.id);

    // expect: the observed team's released article came back. This guard has to come
    // first, because it is what proves the observer branch ran at all: when the caller
    // is neither a member of the requested team nor an observer, `GetByExhibitTeamAsync`
    // falls through both branches and returns an empty list — which would satisfy every
    // "no foreign rows" assertion below without testing anything. Note the response is
    // grouped and re-keyed (`UserId` is rewritten to the caller and `Id` to the minimum
    // of the group), so the article, not the row identity, is what can be asserted on.
    expect(
      observed.map(ua => ua.article?.name),
      'the observer should see the observed team\'s released article'
    ).toEqual([bCurrentName]);

    // expect: nothing from another exhibit. The grouping preserves the row's own
    // `ExhibitId`, so a leaked row is identifiable by it.
    expect(
      [...new Set(observed.map(ua => ua.exhibitId))],
      'every user article returned for an exhibit should belong to that exhibit'
    ).toEqual([exhibitB.id]);

    const returnedArticleIds = observed.map(ua => ua.articleId);
    expect(returnedArticleIds).not.toContain(aForeign.id);

    // expect: the unreleased article is still withheld.
    expect(returnedArticleIds).not.toContain(bFuture.id);
  });
});
