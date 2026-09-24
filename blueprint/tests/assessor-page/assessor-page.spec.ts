// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license
// information.

// spec: specs/blueprint-test-plan.md
//
// The assessor page, /assess?msel=<id> (AssessorPageComponent wrapping app-assessor-view).
// It lists a MSEL's scenario events grouped by move and time group, showing only the data
// fields marked "Assessor View". Checkbox fields are the only thing an assessor edits here.
//
// Each test seeds its own MSEL: one move, two assessor-visible fields (a String and a
// Checkbox), one field that is not assessor-visible, and two events a minute apart. The
// xAPI evidence and competency panels are only checked for their empty states; assertions
// and statements are other specs' concern.

import { test, expect, Services } from '../../fixtures';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createMove,
  createDataField,
  createScenarioEvent,
  setScenarioEventFieldValue,
  getScenarioEvent,
  listMselDataFields,
  addUserMselRole,
  removeUserMselRole,
  createUnit,
  deleteUnit,
  addUnitToMsel,
  addUserToUnit,
  deleteBlueprintUser,
  signInToBlueprintAs,
  tempBlueprintName,
} from '../../test-helpers';

const NOTES = 'Assessor Notes';
const OBSERVED = 'Observed';
const HIDDEN = 'Hidden Field';

interface SeededMsel {
  mselId: string;
  mselName: string;
  firstEventId: string;
  firstNote: string;
  secondNote: string;
  hiddenValue: string;
}

async function seedAssessorMsel(token: string): Promise<SeededMsel> {
  const mselName = tempBlueprintName('TestBP-Assessor');
  const { id: mselId } = await createMsel(token, { name: mselName });
  await createMove(token, mselId, { moveNumber: 1, deltaSeconds: 0, description: 'Opening move' });
  // Fields first: an event gets a data value only for the fields that exist when it is created.
  await createDataField(token, mselId, {
    name: NOTES,
    dataType: 'String',
    displayOrder: 1,
    isAssessorVisible: true,
  });
  await createDataField(token, mselId, {
    name: OBSERVED,
    dataType: 'Checkbox',
    displayOrder: 2,
    isAssessorVisible: true,
  });
  await createDataField(token, mselId, {
    name: HIDDEN,
    dataType: 'String',
    displayOrder: 3,
    isAssessorVisible: false,
  });

  const suffix = `${Date.now()}`;
  const firstNote = `first-note-${suffix}`;
  const secondNote = `second-note-${suffix}`;
  const hiddenValue = `hidden-value-${suffix}`;
  const first = await createScenarioEvent(token, mselId, { deltaSeconds: 0 });
  await setScenarioEventFieldValue(token, first.id, NOTES, firstNote);
  await setScenarioEventFieldValue(token, first.id, HIDDEN, hiddenValue);
  const second = await createScenarioEvent(token, mselId, { deltaSeconds: 60 });
  await setScenarioEventFieldValue(token, second.id, NOTES, secondNote);

  return { mselId, mselName, firstEventId: first.id, firstNote, secondNote, hiddenValue };
}

async function gotoAssessorPage(page: Page, mselId: string): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/assess?msel=${mselId}`, { waitUntil: 'domcontentloaded' });
}

/** An event row, found by its unique Assessor Notes value. */
function eventRow(page: Page, note: string): Locator {
  return page.locator('tr[title="Click to expand/collapse"]').filter({ hasText: note });
}

async function observedValue(token: string, eventId: string, mselId: string): Promise<string | null> {
  const field = (await listMselDataFields(token, mselId)).find((f) => f.name === OBSERVED);
  const event = await getScenarioEvent(token, eventId);
  return (event.dataValues ?? []).find((dv: any) => dv.dataFieldId === field.id)?.value ?? null;
}

test.describe('Assessor Page', () => {
  let token: string;
  let seeded: SeededMsel | undefined;
  let emptyMselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
  });

  test.afterEach(async () => {
    if (seeded) await deleteMsel(token, seeded.mselId);
    seeded = undefined;
    if (emptyMselId) await deleteMsel(token, emptyMselId);
    emptyMselId = undefined;
  });

  test('A MSEL without assessor-visible fields shows the empty state', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const mselName = tempBlueprintName('TestBP-AssessorEmpty');
    emptyMselId = (await createMsel(token, { name: mselName })).id;
    await createDataField(token, emptyMselId, { name: HIDDEN, dataType: 'String', displayOrder: 1 });

    await gotoAssessorPage(page, emptyMselId);

    // expect: the page is for this MSEL, and explains why there is nothing to assess
    await expect(page.getByText(mselName)).toBeVisible();
    await expect(page.getByText('No data fields are marked as assessor-visible.')).toBeVisible();
    await expect(page.getByText('Access Denied')).toHaveCount(0);
    await expect(page.locator('tr[title="Click to expand/collapse"]')).toHaveCount(0);
  });

  test('Events are listed by move and group with only assessor-visible fields', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    seeded = await seedAssessorMsel(token);
    await gotoAssessorPage(page, seeded.mselId);

    // expect: the assessor-visible fields are the columns, in display order; the other is not
    const headers = page.locator('thead tr').last().locator('th');
    await expect(headers.filter({ hasText: NOTES })).toHaveCount(1);
    await expect(headers.filter({ hasText: OBSERVED })).toHaveCount(1);
    await expect(headers.filter({ hasText: HIDDEN })).toHaveCount(0);
    await expect(headers.nth(2)).toHaveText(NOTES);
    await expect(headers.nth(3)).toHaveText(OBSERVED);

    // expect: one move header, a time group per distinct event time, and numbered events
    const moveHeader = page.locator('tr[title="Click to expand/collapse move"]');
    await expect(moveHeader).toHaveCount(1);
    await expect(moveHeader).toContainText('Move 1');
    await expect(moveHeader).toContainText('Opening move');
    const groupHeaders = page.locator('tr[title="Click to expand/collapse group"]');
    await expect(groupHeaders).toHaveText([/Group 0/, /Group 1/]);

    const first = eventRow(page, seeded.firstNote);
    const second = eventRow(page, seeded.secondNote);
    await expect(first.locator('.row-index')).toHaveText('1');
    await expect(second.locator('.row-index')).toHaveText('2');
    // expect: the non-visible field's value is not shown anywhere
    await expect(page.getByText(seeded.hiddenValue)).toHaveCount(0);

    // expect: rows run move header, group 0, event 1, group 1, event 2
    const bodyRows = page.locator('tbody > tr');
    await expect(bodyRows).toHaveCount(5);
    await expect(bodyRows.nth(0)).toHaveAttribute('title', 'Click to expand/collapse move');
    await expect(bodyRows.nth(2)).toContainText(seeded.firstNote);
    await expect(bodyRows.nth(4)).toContainText(seeded.secondNote);
  });

  test('Expand and collapse events, groups and moves', async ({ blueprintAuthenticatedPage: page }) => {
    seeded = await seedAssessorMsel(token);
    await gotoAssessorPage(page, seeded.mselId);

    const expandAll = page.getByRole('button', { name: 'Expand All (Ctrl+Shift+E)' });
    const collapseAll = page.getByRole('button', { name: 'Collapse All (Ctrl+Shift+C)' });
    const details = page.locator('tr.detail-row');
    const first = eventRow(page, seeded.firstNote);

    // expect: everything starts collapsed
    await expect(first).toBeVisible();
    await expect(details).toHaveCount(0);
    await expect(collapseAll).toBeDisabled();
    await expect(expandAll).toBeEnabled();

    // expect: clicking an event opens its evidence and assessment panels, empty for a new MSEL
    await first.click();
    await expect(details).toHaveCount(1);
    await expect(details).toContainText('No xAPI statements found for this event.');
    await expect(details).toContainText('No competencies on this event.');
    await expect(collapseAll).toBeEnabled();

    // expect: clicking it again closes it
    await first.click();
    await expect(details).toHaveCount(0);

    // expect: Expand All opens the move, both groups and both events
    await expandAll.click();
    await expect(details).toHaveCount(5);
    await expect(expandAll).toBeDisabled();
    await expect(page.getByText('No xAPI statements found for this move.')).toBeVisible();
    await expect(page.getByText('No competencies in this move.')).toBeVisible();

    await collapseAll.click();
    await expect(details).toHaveCount(0);
    await expect(collapseAll).toBeDisabled();
  });

  test('Search filters events by assessor-visible values', async ({ blueprintAuthenticatedPage: page }) => {
    seeded = await seedAssessorMsel(token);
    await gotoAssessorPage(page, seeded.mselId);
    await expect(eventRow(page, seeded.firstNote)).toBeVisible();
    await expect(eventRow(page, seeded.secondNote)).toBeVisible();

    await page.getByRole('button', { name: 'Search Events' }).click();
    const search = page.getByRole('textbox', { name: 'Search' });
    await expect(search).toBeVisible();

    // The search runs on keyup, so type rather than fill.
    await search.pressSequentially(seeded.secondNote);
    // expect: only the matching event remains, still under its move header
    await expect(eventRow(page, seeded.firstNote)).toHaveCount(0);
    await expect(eventRow(page, seeded.secondNote)).toBeVisible();
    await expect(page.locator('tr[title="Click to expand/collapse move"]')).toContainText('Move 1');

    // expect: a value held only in a field hidden from assessors matches nothing
    await search.clear();
    await search.pressSequentially(seeded.hiddenValue);
    await expect(page.locator('tr[title="Click to expand/collapse"]')).toHaveCount(0);

    // expect: closing the search row clears the filter. Two buttons are titled "Clear Search":
    // the field's clear icon only empties the text, while the header's filter-off button closes
    // the row, and that is the one clicked here.
    await page.locator('th.expand-col').getByRole('button', { name: 'Clear Search' }).click();
    await expect(search).toBeHidden();
    await expect(eventRow(page, seeded.firstNote)).toBeVisible();
    await expect(eventRow(page, seeded.secondNote)).toBeVisible();
  });

  test('An administrator can tick an assessor checkbox', async ({ blueprintAuthenticatedPage: page }) => {
    seeded = await seedAssessorMsel(token);
    await gotoAssessorPage(page, seeded.mselId);

    const first = eventRow(page, seeded.firstNote);
    const checkbox = first.getByRole('checkbox');
    await expect(checkbox).toBeEnabled();
    await expect(checkbox).not.toBeChecked();

    await checkbox.click();

    // expect: the box is ticked, and ticking it did not also expand the row
    await expect(checkbox).toBeChecked();
    await expect(page.locator('tr.detail-row')).toHaveCount(0);
    await expect.poll(() => observedValue(token, seeded!.firstEventId, seeded!.mselId)).toBe('true');

    // expect: it is still ticked after a reload, and the other event's box is untouched
    await page.reload();
    await expect(eventRow(page, seeded.firstNote).getByRole('checkbox')).toBeChecked();
    await expect(eventRow(page, seeded.secondNote).getByRole('checkbox')).not.toBeChecked();

    await eventRow(page, seeded.firstNote).getByRole('checkbox').click();
    await expect(eventRow(page, seeded.firstNote).getByRole('checkbox')).not.toBeChecked();
    await expect.poll(() => observedValue(token, seeded!.firstEventId, seeded!.mselId)).toBe('false');
  });

  test.describe('as a MSEL member', () => {
    const password = 'TestPass-123!';
    let kcToken: string;
    let kcUser: { id: string; username: string } | undefined;
    let context: BrowserContext | undefined;
    let unitId: string | undefined;

    test.afterEach(async () => {
      await context?.close();
      context = undefined;
      if (unitId) await deleteUnit(token, unitId);
      unitId = undefined;
      if (kcUser) {
        await deleteBlueprintUser(token, kcUser.id);
        await deleteKeycloakUser(kcToken, kcUser.id);
      }
      kcUser = undefined;
    });

    // A MSEL role on its own grants no reads: MselViewRequirement also wants the user in a unit
    // attached to the MSEL (or on one of its teams). So the user joins such a unit once the
    // sign-in has created their Blueprint record.
    //
    // Pending upstream: the page decides from whichever one of the user's MSEL roles it finds
    // first and treats Evaluator alone as able to view and edit, while the API refuses every
    // read to an Evaluator alone and lets a checkbox be ticked only by an Owner or by an
    // Evaluator who is also an Editor or Approver. Owner is the single role both sides agree
    // may tick, so it stands in for the evaluator here. When the page follows the API's rules,
    // add an Evaluator-plus-Editor step.
    test('Access follows the MSEL role: none, Editor, then Owner', async ({ browser }) => {
      seeded = await seedAssessorMsel(token);
      kcToken = await getKeycloakAdminToken();
      kcUser = await createKeycloakUser(kcToken, { username: tempUsername('bp-assessor'), password });

      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: { cookies: [], origins: [] },
      });
      const page = await context.newPage();
      const rolesLoaded = page.waitForResponse(
        // A user with no role on the MSEL gets 403 here, so wait for the response whatever its status.
        (r) => r.url().includes(`/api/msels/${seeded!.mselId}/usermselroles`),
        { timeout: 60000 }
      );
      await signInToBlueprintAs(
        page,
        kcUser.username,
        password,
        `${Services.Blueprint.UI}/assess?msel=${seeded.mselId}`
      );
      await rolesLoaded;

      // expect: with no role on the MSEL the page refuses, even once the roles have loaded
      await expect(page.getByText('Access Denied')).toBeVisible();
      await expect(
        page.getByText('You need at least Editor role on this MSEL to view the assessor page.')
      ).toBeVisible();
      await expect(page.locator('app-assessor-view')).toHaveCount(0);

      unitId = (await createUnit(token)).id;
      await addUnitToMsel(token, seeded.mselId, unitId);
      await addUserToUnit(token, unitId, kcUser.id);

      // expect: an Editor can view the events but not tick the checkboxes
      const editor = await addUserMselRole(token, seeded.mselId, kcUser.id, 'Editor');
      await page.reload();
      const first = eventRow(page, seeded.firstNote);
      await expect(first).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('Access Denied')).toHaveCount(0);
      await expect(first.getByRole('checkbox')).toBeDisabled();

      // expect: an Owner can tick them
      await removeUserMselRole(token, editor.id);
      await addUserMselRole(token, seeded.mselId, kcUser.id, 'Owner');
      await page.reload();
      const checkbox = eventRow(page, seeded.firstNote).getByRole('checkbox');
      await expect(checkbox).toBeEnabled({ timeout: 30000 });
      await checkbox.click();
      await expect(checkbox).toBeChecked();
      await expect.poll(() => observedValue(token, seeded!.firstEventId, seeded!.mselId)).toBe('true');
    });
  });
});
