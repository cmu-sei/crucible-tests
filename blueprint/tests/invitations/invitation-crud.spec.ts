// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
//
// MSEL "Invitations" section: the invitation list (invitation-list) and its create/edit dialog
// (invitation-edit-dialog). Using an invitation link is covered by invitation-join.spec.ts.
//
// Every test seeds its own MSEL and teams; invitations cascade-delete with the MSEL.

import { test, expect } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createInvitation,
  listInvitations,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

/** The list row for one invitation, found by its (per-domain) Edit button. */
function invitationRow(page: Page, emailDomain: string): Locator {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: `Edit ${emailDomain} invitation` }) });
}

function copyLinkButton(row: Locator): Locator {
  return row.locator('button[title^="Copy Invitation Link:"]');
}

test.describe('Invitations', () => {
  let token: string;
  let mselId: string | undefined;
  let alphaId: string;
  let bravoId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-Invitations') });
    mselId = msel.id;
    alphaId = (await createTeam(token, mselId, { name: 'Alpha Team', shortName: 'ALPHA' })).id;
    bravoId = (await createTeam(token, mselId, { name: 'Bravo Team', shortName: 'BRAVO' })).id;
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
    mselId = undefined;
  });

  test('Create an invitation, with email-domain validation', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await navigateToMselSection(page, mselId!, 'Invitations');
    // expect: a MSEL without invitations says so
    await expect(page.getByText('No invitations found')).toBeVisible();

    await page.getByRole('button', { name: 'Add an invitation' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Create an Invitation to this MSEL' });
    await expect(dialog).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Save' });

    // expect: defaults - one use, expiring 30 minutes out, team-leader option not offered
    const maxUses = dialog.getByRole('textbox', {
      name: 'Maximum number of users allowed to use this invitation',
    });
    await expect(maxUses).toHaveValue('1');
    await expect(dialog).toContainText(/\d{2} \w{3} \d{4} \d{2}:\d{2}/);
    await expect(dialog.getByRole('checkbox', { name: 'Can invite others to this team' })).toBeDisabled();

    // expect: Save stays disabled until a team is chosen
    await expect(save).toBeDisabled();
    await dialog.getByRole('combobox', { name: 'Team' }).click();
    await page.getByRole('option', { name: 'ALPHA - Alpha Team' }).click();
    await expect(save).toBeEnabled();

    // expect: a domain must be longer than 3 characters and contain an '@'
    const domain = dialog.getByRole('textbox', { name: 'User emails end with ...' });
    await domain.fill('abcd.test');
    await expect(save).toBeDisabled();
    await domain.fill('@ab');
    await expect(save).toBeDisabled();
    await domain.fill('@abc.test');
    await expect(save).toBeEnabled();

    await maxUses.fill('4');
    await save.click();

    // expect: the dialog closes and the list shows the new invitation
    await expect(dialog).toBeHidden();
    const row = invitationRow(page, '@abc.test');
    await expect(row.getByRole('cell').nth(1)).toHaveText('ALPHA');
    await expect(row.getByRole('cell').nth(2)).toHaveText('@abc.test');
    await expect(row.getByRole('cell').nth(3)).toHaveText(/\d{2} \w{3} \d{4} \d{2}:\d{2}/);
    await expect(row.getByRole('cell').nth(4)).toHaveText('4');
    await expect(row.getByRole('cell').nth(5)).toHaveText('4');
    await expect(page.getByText('No invitations found')).toBeHidden();

    // Secondary: it persisted with the dialog's values. Blueprint's JsonIntegerConverter writes
    // integers as JSON strings, so the counts are compared as numbers.
    const invitations = await listInvitations(token, mselId!);
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toMatchObject({ teamId: alphaId, emailDomain: '@abc.test' });
    expect(Number(invitations[0].maxUsersAllowed)).toBe(4);
    expect(Number(invitations[0].userCount)).toBe(0);
  });

  test('Invitation links are offered only once the MSEL is deployed', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await createInvitation(token, mselId!, alphaId, { emailDomain: '@alpha.test' });
    await navigateToMselSection(page, mselId!, 'Invitations');

    // expect: a Pending MSEL has no link to copy
    const row = invitationRow(page, '@alpha.test');
    await expect(copyLinkButton(row)).toBeDisabled();
    await expect(copyLinkButton(row)).toHaveAttribute('title', /^Copy Invitation Link: ?$/);

    await updateMsel(token, mselId!, { status: 'Deployed' });
    await navigateToMselSection(page, mselId!, 'Invitations');

    // expect: a Deployed MSEL offers a join link for the invitation's team.
    // Pending upstream: the link is built as document.baseURI + '/join/', and baseURI already
    // ends in '/', so it contains '//join/'. Once fixed, expect `${Services.Blueprint.UI}/join/`.
    const deployedRow = invitationRow(page, '@alpha.test');
    await expect(copyLinkButton(deployedRow)).toBeEnabled();
    const title = await copyLinkButton(deployedRow).getAttribute('title');
    const link = new URL(title!.replace(/^Copy Invitation Link: /, ''));
    expect(link.pathname).toBe('//join/');
    expect(link.searchParams.get('msel')).toBe(mselId);
    expect(link.searchParams.get('team')).toBe(alphaId);
  });

  test('Edit an invitation', async ({ blueprintAuthenticatedPage: page }) => {
    await createInvitation(token, mselId!, bravoId, { emailDomain: '@bravo.test', maxUsersAllowed: 2 });
    await navigateToMselSection(page, mselId!, 'Invitations');
    await expect(invitationRow(page, '@bravo.test').getByRole('cell').nth(4)).toHaveText('2');

    await page.getByRole('button', { name: 'Edit @bravo.test invitation' }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit an Invitation to this MSEL' });
    await expect(dialog).toBeVisible();

    // expect: the team is fixed once the invitation exists, and the fields hold its values
    await expect(dialog.getByRole('combobox', { name: 'Team' })).toHaveCount(0);
    await expect(dialog).toContainText('BRAVO - Bravo Team');
    await expect(dialog.getByRole('textbox', { name: 'User emails end with ...' })).toHaveValue(
      '@bravo.test'
    );
    const maxUses = dialog.getByRole('textbox', {
      name: 'Maximum number of users allowed to use this invitation',
    });
    await expect(maxUses).toHaveValue('2');

    // Pending upstream: the list opens this dialog on the frozen store entity, and every field is
    // [(ngModel)]-bound to it, so the first keystroke throws "Cannot assign to read only
    // property" into an error dialog, and Save then PUTs the invitation unchanged. When the list
    // passes a copy, drop the error-dialog steps and expect the row to show '@bravo2.test' with
    // 7 max and 7 remaining uses.
    const emailField = dialog.getByRole('textbox', { name: 'User emails end with ...' });
    const typeErrors = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'TypeError' }) });
    // A fill that lands while the dialog's bindings are still settling can be overwritten with no
    // error at all (seen on Firefox), so it is reissued until the error sheet appears.
    await expect(async () => {
      await emailField.fill('@bravo2.test');
      await expect(typeErrors.first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    // Firefox's fill fires several input events, so several sheets can open, each replacing the
    // last. The engines word the error differently.
    const typeError = typeErrors.last();
    await expect(typeError).toContainText(
      /Cannot assign to read only property 'emailDomain'|"emailDomain" is read-only/
    );
    await typeError.getByRole('button', { name: 'Close' }).click();
    await expect(typeErrors).toHaveCount(0);

    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/invitations/') && r.request().method() === 'PUT'
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect((await saved).ok()).toBe(true);
    await expect(dialog).toBeHidden();

    // expect: the row reflects the edit (currently: the edit is lost)
    const row = invitationRow(page, '@bravo.test');
    await expect(row.getByRole('cell').nth(1)).toHaveText('BRAVO');
    await expect(row.getByRole('cell').nth(4)).toHaveText('2');
    await expect(invitationRow(page, '@bravo2.test')).toHaveCount(0);

    const [edited] = await listInvitations(token, mselId!);
    expect(edited).toMatchObject({ teamId: bravoId, emailDomain: '@bravo.test' });
    expect(Number(edited.maxUsersAllowed)).toBe(2);
  });

  test('Search invitations by team or email domain', async ({ blueprintAuthenticatedPage: page }) => {
    await createInvitation(token, mselId!, alphaId, { emailDomain: '@alpha.test' });
    await createInvitation(token, mselId!, bravoId, { emailDomain: '@bravo.test' });
    await navigateToMselSection(page, mselId!, 'Invitations');
    await expect(invitationRow(page, '@alpha.test')).toBeVisible();
    await expect(invitationRow(page, '@bravo.test')).toBeVisible();

    // The list filters on keyup, not input, so type rather than fill.
    const search = page.getByPlaceholder('Search');
    await search.pressSequentially('bravo');

    // expect: only the matching invitation is listed
    await expect(invitationRow(page, '@bravo.test')).toBeVisible();
    await expect(invitationRow(page, '@alpha.test')).toHaveCount(0);

    // expect: the team short name is searched too
    await search.clear();
    await search.pressSequentially('ALPHA');
    await expect(invitationRow(page, '@alpha.test')).toBeVisible();
    await expect(invitationRow(page, '@bravo.test')).toHaveCount(0);

    await search.clear();
    await search.pressSequentially('no-such-invitation');
    await expect(page.getByText('No invitations found')).toBeVisible();

    // expect: Clear Search restores the full list
    await page.getByRole('button', { name: 'Clear Search' }).click();
    await expect(search).toHaveValue('');
    await expect(invitationRow(page, '@alpha.test')).toBeVisible();
    await expect(invitationRow(page, '@bravo.test')).toBeVisible();
  });

  test('Delete an invitation', async ({ blueprintAuthenticatedPage: page }) => {
    await createInvitation(token, mselId!, alphaId, { emailDomain: '@alpha.test' });
    await createInvitation(token, mselId!, bravoId, { emailDomain: '@bravo.test' });
    await navigateToMselSection(page, mselId!, 'Invitations');

    // expect: cancelling the confirmation keeps the invitation
    await page.getByRole('button', { name: 'Delete @alpha.test invitation' }).click();
    let confirm = page.getByRole('dialog').filter({ hasText: 'Delete Invitation' });
    await expect(confirm).toContainText(
      'Are you sure that you want to delete the invitation for @alpha.test?'
    );
    await confirm.getByRole('button', { name: 'No', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(invitationRow(page, '@alpha.test')).toBeVisible();

    await page.getByRole('button', { name: 'Delete @alpha.test invitation' }).click();
    confirm = page.getByRole('dialog').filter({ hasText: 'Delete Invitation' });
    await confirm.getByRole('button', { name: /YES/i }).click();

    // expect: only the confirmed invitation is removed
    await expect(confirm).toBeHidden();
    await expect(invitationRow(page, '@alpha.test')).toHaveCount(0);
    await expect(invitationRow(page, '@bravo.test')).toBeVisible();
    const remaining = await listInvitations(token, mselId!);
    expect(remaining.map((i) => i.emailDomain)).toEqual(['@bravo.test']);
  });
});
