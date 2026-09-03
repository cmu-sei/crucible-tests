// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createTeam,
  deleteTeam,
  listTeams,
  createOrganization,
  deleteOrganization,
  listOrganizations,
  navigateToMselSection,
} from '../../test-helpers';

/**
 * The test plan called this "Assign Teams to Organization", but Blueprint has no such
 * feature: `Blueprint.Api.ViewModels.Team` carries no OrganizationId, no Data model
 * declares one, and the team-edit dialog has no organization control. Teams and
 * Organizations are siblings, each scoped to a MSEL by MselId.
 *
 * `PUT /api/teams/{id}` happily returns 200 for a body containing `organizationId` and
 * discards the field, so a test could "pass" while asserting nothing. Rather than keep
 * that false coverage, this spec asserts the relationship Blueprint actually implements:
 * teams and organizations are scoped to their own MSEL and do not leak across MSELs.
 */
test.describe('Teams and Organizations Management', () => {
  let token: string;
  let mselId: string;
  let otherMselId: string;
  let teamId: string;
  let orgId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();

    const msel = await createMsel(token);
    mselId = msel.id;

    // A second MSEL proves scoping: its sections must not show the first MSEL's rows.
    const otherMsel = await createMsel(token);
    otherMselId = otherMsel.id;

    const team = await createTeam(token, mselId, { name: 'Test Team Echo' });
    teamId = team.id;

    const org = await createOrganization(token, mselId, { name: 'Test Organization Sigma' });
    orgId = org.id;
  });

  test.afterEach(async () => {
    for (const [label, fn] of [
      [`team ${teamId}`, () => teamId && deleteTeam(token, teamId)],
      [`organization ${orgId}`, () => orgId && deleteOrganization(token, orgId)],
      [`MSEL ${mselId}`, () => mselId && deleteMsel(token, mselId)],
      [`MSEL ${otherMselId}`, () => otherMselId && deleteMsel(token, otherMselId)],
    ] as Array<[string, () => unknown]>) {
      try {
        await fn();
      } catch (err) {
        console.warn(`Cleanup failed for ${label}: ${err}`);
      }
    }
  });

  test('Teams and Organizations are scoped to their MSEL', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // The seeded team belongs to its MSEL, and only to it.
    const teams = await listTeams(token, mselId);
    expect(teams.map((t: any) => t.id)).toContain(teamId);
    expect(teams.every((t: any) => t.mselId === mselId)).toBe(true);

    const otherTeams = await listTeams(token, otherMselId);
    expect(otherTeams.map((t: any) => t.id)).not.toContain(teamId);

    // Same for the organization.
    const orgs = await listOrganizations(token, mselId);
    expect(orgs.map((o: any) => o.id)).toContain(orgId);

    const otherOrgs = await listOrganizations(token, otherMselId);
    expect(otherOrgs.map((o: any) => o.id)).not.toContain(orgId);

    // The UI renders each in its own section of the owning MSEL.
    await navigateToMselSection(page, mselId, 'Teams');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Echo' })).toBeVisible({
      timeout: 5000,
    });

    await navigateToMselSection(page, mselId, 'Organizations');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('row').filter({ hasText: 'Test Organization Sigma' })
    ).toBeVisible({ timeout: 5000 });

    // ...and not in the other MSEL's sections.
    await navigateToMselSection(page, otherMselId, 'Teams');
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('row').filter({ hasText: 'Test Team Echo' })).toHaveCount(0);
  });
});
