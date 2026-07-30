// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoExhibitSection, apiSetExhibitMoveAndInject } from '../../fixtures';

/**
 * The seeded exhibit's articles occupy exactly three move/inject positions:
 * (0,0), (1,0) and (1,1) — see the `seededExhibit` fixture. `AdvanceAsync`
 * walks that distinct, sorted list, so Advance is expected to succeed twice
 * from the start and then refuse at (1,1), which is the boundary under test.
 */
const POSITIONS = [
  { move: 0, inject: 0 },
  { move: 1, inject: 0 },
  { move: 1, inject: 1 },
];
const LAST = POSITIONS[POSITIONS.length - 1];

test.describe('Edge Cases and Negative Testing', () => {
  // Advancing writes CurrentMove/CurrentInject to the database and
  // `seededExhibit` is worker-scoped, so restore the starting position after
  // each test or every later test in this worker inherits the advanced state.
  test.afterEach(async ({ seededExhibit }) => {
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, POSITIONS[0].move, POSITIONS[0].inject);
  });

  test('Advance at Last Move or Inject', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    // Start from a known position rather than trusting whatever ran before.
    await apiSetExhibitMoveAndInject(seededExhibit.exhibitId, POSITIONS[0].move, POSITIONS[0].inject);

    // Navigate straight to the seeded exhibit's Wall view by id. My Exhibits is
    // paginated, so a name-based row lookup is flaky while sibling specs seed
    // their own exhibits concurrently.
    await gotoExhibitSection(page, seededExhibit.exhibitId, 'wall');
    await expect(page).toHaveTitle('Gallery Wall');

    // The exhibit is seeded with showAdvanceButton=true, so the control must be
    // present — a missing button means the seed or the UI gate regressed.
    const advanceButton = page.getByRole('button', { name: 'Advance' });
    await expect(advanceButton).toBeVisible();

    const moveInjectLabel = page.getByText(/Move \d+, Inject \d+/);
    await expect(moveInjectLabel).toHaveText(`Move ${POSITIONS[0].move}, Inject ${POSITIONS[0].inject}`);

    // 1. Click 'Advance' repeatedly to reach the last move/inject.
    // Each click must land on the next seeded position, in order.
    for (const position of POSITIONS.slice(1)) {
      const advanced = page.waitForResponse(
        (response) => response.url().includes('/advance') && response.request().method() === 'PUT'
      );
      await advanceButton.click();
      expect((await advanced).status()).toBe(200);

      // expect: the label reflects the new position (proves Advance took effect,
      // rather than merely that the button exists)
      await expect(moveInjectLabel).toHaveText(`Move ${position.move}, Inject ${position.inject}`);
    }

    // 2. Click 'Advance' once more, now at the last move/inject.
    const refused = page.waitForResponse(
      (response) => response.url().includes('/advance') && response.request().method() === 'PUT'
    );
    await advanceButton.click();

    // expect: the API refuses with 400 rather than silently wrapping around
    expect((await refused).status()).toBe(400);

    // expect: an error message informs the user they cannot advance further, using the
    // descriptive `detail` sentence from the ProblemDetails response (not just the
    // generic `title`).
    await expect(
      page.getByText('Already at the last move/inject. There are no further moves or injects to advance to.')
    ).toBeVisible();

    // expect: the move/inject values stay pinned at the boundary
    await expect(moveInjectLabel).toHaveText(`Move ${LAST.move}, Inject ${LAST.inject}`);
  });
});
