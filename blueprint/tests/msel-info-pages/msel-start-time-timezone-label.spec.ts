// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * The MSEL Info tab labels Start Date / Time with a zone abbreviation. The
 * abbreviation has to come from the start time, not from today: in New York a
 * January date is EST and a July date is EDT whatever day the test runs.
 * Whichever half of the year the run falls in, one of the two MSELs is on the
 * other side of a DST boundary, so a label taken from today fails one.
 */
test.use({ timezoneId: 'America/New_York' });

test.describe('MSEL start time time zone label', () => {
  let token: string;
  let mselIds: string[] = [];

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselIds = [];
  });

  test.afterEach(async () => {
    for (const id of mselIds) {
      await deleteMsel(token, id);
    }
  });

  test('Start Date / Time is labeled with the zone in effect on that date', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // Noon in New York on each date: 17:00Z in winter, 16:00Z in summer.
    const cases = [
      { startTime: '2026-01-15T17:00:00Z', label: '15 Jan 2026 12:00 EST' },
      { startTime: '2026-07-15T16:00:00Z', label: '15 Jul 2026 12:00 EDT' },
    ];
    for (const c of cases) {
      const msel = await createMsel(token, {
        name: tempBlueprintName('TestBP-TZ'),
        startTime: c.startTime,
      });
      mselIds.push(msel.id);

      await navigateToMsel(page, msel.id);
      const field = page.locator('mat-form-field', { hasText: 'Start Date / Time' });
      await expect(field.locator('span', { hasText: c.label.slice(0, 11) })).toHaveText(c.label);
    }
  });
});
