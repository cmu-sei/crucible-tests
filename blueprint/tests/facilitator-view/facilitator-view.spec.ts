// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license
// information.

// spec: specs/blueprint-test-plan.md
//
// The Facilitator View, /facilitate?msel=<id> (FacilitatorPageComponent wrapping
// app-facilitator-view), where a facilitator runs a deployed MSEL: it lists every move and group,
// with the events and their automation tasks under them, and offers Start Move/Group, Run,
// Cancel, Rerun, and Pause.
//
// Each test seeds its own MSEL: two moves, a field marked Facilitate and one that is not, and
// three events: the first (move 1) with two manual tasks chained on success, the second (move 1,
// a minute later) with none, and the third (move 2) with one manual task. The tasks are http GETs
// of Blueprint's health endpoint (see healthCheckTask), so they run without a Player view. The
// MSEL is marked deployed in the database (deployMselForAutomation): a real push needs Player.

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createMove,
  createDataField,
  createScenarioEvent,
  setScenarioEventFieldValue,
  setAutomationTasks,
  healthCheckTask,
  latestRunStatus,
  listAutomationRuns,
  getMselExecution,
  addUserMselRole,
  removeUserMselRole,
  createUnit,
  deleteUnit,
  addUnitToMsel,
  addUserToUnit,
  signInToBlueprintAs,
  navigateToMsel,
  navigateToMselSection,
  mselSectionItem,
  dashboardCard,
  tempBlueprintName,
} from '../../test-helpers';
import { clearMselIntegrationState, deployMselForAutomation } from '../../db-helpers';

const NOTE = 'Facilitator Note';
const HIDDEN = 'Hidden Field';
const FIRST_TASK = 'Check health';
const CHAINED_TASK = 'Check again';
const MOVE_TWO_TASK = 'Move two check';

interface SeededMsel {
  mselId: string;
  mselName: string;
  taskIds: Record<string, string>;
  withTasks: string;
  withoutTasks: string;
  moveTwo: string;
}

async function seedFacilitatorMsel(
  token: string,
  opts: { deploy?: boolean; firstTask?: Parameters<typeof healthCheckTask>[1] } = {}
): Promise<SeededMsel> {
  const mselName = tempBlueprintName('TestBP-Facilitator');
  const { id: mselId } = await createMsel(token, { name: mselName, status: 'Approved' });
  await createMove(token, mselId, { moveNumber: 1, deltaSeconds: 0, description: 'Opening move' });
  await createMove(token, mselId, { moveNumber: 2, deltaSeconds: 3600, description: 'Second move' });
  // Fields first: an event gets a data value only for the fields that exist when it is created.
  await createDataField(token, mselId, {
    name: NOTE,
    dataType: 'String',
    displayOrder: 1,
    onFacilitatorView: true,
    isAssessorVisible: true,
  });
  await createDataField(token, mselId, { name: HIDDEN, dataType: 'String', displayOrder: 2 });

  const suffix = `${Date.now()}`;
  const notes = {
    withTasks: `with-tasks-${suffix}`,
    withoutTasks: `without-tasks-${suffix}`,
    moveTwo: `move-two-${suffix}`,
  };
  const first = await createScenarioEvent(token, mselId, { deltaSeconds: 0 });
  await setScenarioEventFieldValue(token, first.id, NOTE, notes.withTasks);
  await setScenarioEventFieldValue(token, first.id, HIDDEN, `hidden-${suffix}`);
  const second = await createScenarioEvent(token, mselId, { deltaSeconds: 60 });
  await setScenarioEventFieldValue(token, second.id, NOTE, notes.withoutTasks);
  const third = await createScenarioEvent(token, mselId, { deltaSeconds: 3600 });
  await setScenarioEventFieldValue(token, third.id, NOTE, notes.moveTwo);

  const taskIds: Record<string, string> = {};
  for (const t of await setAutomationTasks(token, first.id, [
    healthCheckTask(FIRST_TASK, opts.firstTask),
    healthCheckTask(CHAINED_TASK, { triggerCondition: 'OnSuccess', triggerTask: FIRST_TASK }),
  ])) {
    taskIds[t.name] = t.id;
  }
  for (const t of await setAutomationTasks(token, third.id, [healthCheckTask(MOVE_TWO_TASK)])) {
    taskIds[t.name] = t.id;
  }
  if (opts.deploy ?? true) await deployMselForAutomation(mselId);
  return { mselId, mselName, taskIds, ...notes };
}

async function gotoFacilitatorPage(page: Page, mselId: string): Promise<void> {
  await page.goto(`${Services.Blueprint.UI}/facilitate?msel=${mselId}`, { waitUntil: 'domcontentloaded' });
}

/** An event row, found by its unique Facilitator Note value. */
function eventRow(page: Page, note: string): Locator {
  return page.locator('app-facilitator-view tbody tr').filter({ hasText: note });
}

/** Open an event's automation panel, and return it. */
async function openAutomationPanel(page: Page, note: string): Promise<Locator> {
  const row = eventRow(page, note);
  await row.getByRole('button', { name: /^Event \d+ automation$/ }).click();
  const panel = page.locator('app-facilitator-automation-panel');
  await expect(panel).toBeVisible();
  return panel;
}

for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › Facilitator View`, () => {
    let token: string;
    let seeded: SeededMsel | undefined;

    test.beforeEach(async () => {
      token = await getBlueprintToken();
    });

    test.afterEach(async () => {
      if (seeded) {
        // Back to an ordinary MSEL first, so deleting it does not queue a pull.
        await clearMselIntegrationState(seeded.mselId);
        await deleteMsel(token, seeded.mselId);
      }
      seeded = undefined;
    });

    test('Lists every move, the events with tasks, and the Facilitate columns', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      await gotoFacilitatorPage(page, seeded.mselId);

      const view = page.locator('app-facilitator-view');
      // expect: both moves have a header with their Start button, and the summary says it has not started
      await expect(view.getByText('Not started')).toBeVisible({ timeout: 30000 });
      await expect(view.getByRole('button', { name: 'Start Move 1' })).toBeVisible();
      await expect(view.getByRole('button', { name: 'Start Move 2' })).toBeVisible();

      // expect: the columns are the system ones, Automation, and the field marked Facilitate only
      const headers = view.locator('thead th');
      await expect(headers.filter({ hasText: 'Automation' })).toHaveCount(1);
      await expect(headers.filter({ hasText: NOTE })).toHaveCount(1);
      await expect(headers.filter({ hasText: HIDDEN })).toHaveCount(0);

      // expect: with the toggle on, as it is at first, the event without tasks is hidden
      const toggle = view.getByRole('switch', { name: 'Only events with tasks' });
      await expect(toggle).toBeChecked();
      await expect(eventRow(page, seeded.withTasks)).toBeVisible();
      await expect(eventRow(page, seeded.withTasks)).toContainText('2 not run');
      await expect(eventRow(page, seeded.moveTwo)).toBeVisible();
      await expect(eventRow(page, seeded.withoutTasks)).toHaveCount(0);

      // expect: turning it off shows every event
      await toggle.click();
      await expect(toggle).not.toBeChecked();
      await expect(eventRow(page, seeded.withoutTasks)).toBeVisible();
    });

    test('A facilitator runs a task, its chain follows, and a task that ran once is not rerun', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      const { mselId, taskIds } = seeded;
      await gotoFacilitatorPage(page, mselId);

      const panel = await openAutomationPanel(page, seeded.withTasks);
      // expect: the chained task cannot be run by hand while the one before it has not run
      await expect(panel.getByRole('button', { name: `Run ${FIRST_TASK}` })).toBeEnabled();

      await panel.getByRole('button', { name: `Run ${FIRST_TASK}` }).click();

      // expect: the task and the one chained after it succeed, on the server and on the page
      await expect.poll(() => latestRunStatus(token, mselId, taskIds[FIRST_TASK]), { timeout: 30000 }).toBe('Succeeded');
      await expect.poll(() => latestRunStatus(token, mselId, taskIds[CHAINED_TASK]), { timeout: 30000 }).toBe('Succeeded');
      await expect(eventRow(page, seeded.withTasks)).toContainText('2 succeeded', { timeout: 15000 });

      // expect: a task that is not repeatable and succeeded is not rerun
      const rerun = panel.getByRole('button', { name: `Rerun ${FIRST_TASK}` });
      await expect(rerun).toBeDisabled();

      // expect: the history names the run, how it started, and its output
      await panel.getByRole('button', { name: `History of ${FIRST_TASK}` }).click();
      const drawer = page.getByRole('region', { name: new RegExp(`^History of .*${FIRST_TASK}$`) });
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText('Succeeded');
      await expect(drawer).toContainText('Healthy');
      await drawer.getByRole('button', { name: 'Close the history' }).click();
      await expect(drawer).toBeHidden();
    });

    test('A waiting task can be cancelled, and then run again', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      // A long delay holds the run as waiting until it is cancelled.
      seeded = await seedFacilitatorMsel(token, { firstTask: { delaySeconds: 600, repeatable: true } });
      const { mselId, taskIds } = seeded;
      await gotoFacilitatorPage(page, mselId);

      const panel = await openAutomationPanel(page, seeded.withTasks);
      await panel.getByRole('button', { name: `Run ${FIRST_TASK}` }).click();
      // expect: the summary and the event's row both count it as waiting
      await expect(page.locator('.facilitator-summary').getByText('1 waiting')).toBeVisible({ timeout: 15000 });
      await expect(eventRow(page, seeded.withTasks)).toContainText('1 waiting');

      await panel.getByRole('button', { name: `Cancel ${FIRST_TASK}` }).click();

      // expect: the run is cancelled, so nothing it would trigger runs
      await expect.poll(() => latestRunStatus(token, mselId, taskIds[FIRST_TASK]), { timeout: 30000 }).toBe('Cancelled');
      expect(await latestRunStatus(token, mselId, taskIds[CHAINED_TASK])).toBeNull();

      // expect: a repeatable task can be run again once its run ended
      const rerun = panel.getByRole('button', { name: `Rerun ${FIRST_TASK}` });
      await expect(rerun).toBeEnabled({ timeout: 15000 });
      await rerun.click();
      await expect
        .poll(async () => (await listAutomationRuns(token, mselId, 'Exercise')).filter((r) => r.automationTaskId === taskIds[FIRST_TASK]).length)
        .toBe(2);
    });

    test('Starting a move makes it current and runs the manual tasks chosen', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      const { mselId, taskIds } = seeded;
      await gotoFacilitatorPage(page, mselId);

      await page.getByRole('button', { name: 'Start Move 2' }).click();

      // expect: the dialog says what starting the move does, and offers the move's manual task
      const dialog = page.getByRole('dialog', { name: 'Start Move 2' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Make this move the MSEL's current one");
      const task = dialog.getByRole('checkbox', { name: new RegExp(`${MOVE_TWO_TASK}$`) });
      await expect(task).toBeChecked();
      await dialog.getByRole('button', { name: 'Start Move' }).click();
      await expect(dialog).toBeHidden();

      // expect: move 2 is current on the page and the server, and its task ran
      await expect(page.locator('app-facilitator-view').getByText('Now: Move 2 · Group 0')).toBeVisible({ timeout: 15000 });
      await expect.poll(async () => Number((await getMselExecution(token, mselId)).currentMoveNumber)).toBe(2);
      await expect.poll(() => latestRunStatus(token, mselId, taskIds[MOVE_TWO_TASK]), { timeout: 30000 }).toBe('Succeeded');
      // expect: the move 1 tasks were not run
      expect(await latestRunStatus(token, mselId, taskIds[FIRST_TASK])).toBeNull();
    });

    test('Pausing the automation is saved and can be undone', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      const { mselId } = seeded;
      await gotoFacilitatorPage(page, mselId);

      await page.getByRole('button', { name: 'Pause Automation' }).click();

      // expect: the view says so, the server has it, and it lasts across a reload
      const view = page.locator('app-facilitator-view');
      await expect(view.getByText('Automation is paused')).toBeVisible();
      await expect.poll(async () => (await getMselExecution(token, mselId)).automationPaused).toBe(true);
      await page.reload();
      await expect(view.getByText('Automation is paused')).toBeVisible({ timeout: 30000 });

      await view.getByRole('button', { name: 'Resume Automation' }).click();
      await expect(view.getByText('Automation is paused')).toHaveCount(0);
      await expect.poll(async () => (await getMselExecution(token, mselId)).automationPaused).toBe(false);
    });

    test('The Data Fields Facilitate column chooses the columns of the editor tab', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      await navigateToMselSection(page, seeded.mselId, 'Data Fields');
      // The tab shows the List and View flags at first; add the Facilitate column.
      await page.getByRole('combobox', { name: 'Display columns' }).click();
      await page.getByRole('option', { name: 'Facilitate', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);

      // Mark the hidden field Facilitate, and take the Move column off.
      const facilitate = (name: string) =>
        page
          .locator('mat-row')
          .filter({ has: page.getByText(name, { exact: true }) })
          .locator('mat-checkbox[title="Display on the Facilitator View"]')
          .getByRole('checkbox');
      for (const [name, checked] of [
        [HIDDEN, true],
        ['Move', false],
      ] as const) {
        const box = facilitate(name);
        await expect(box).toBeChecked({ checked: !checked, timeout: 15000 });
        const saved = page.waitForResponse(
          (r) => r.request().method() === 'PUT' && /\/api\/(datafields|msels)\//i.test(new URL(r.url()).pathname)
        );
        await box.click();
        expect((await saved).ok()).toBe(true);
      }

      await mselSectionItem(page, 'Facilitator View').click();
      const headers = page.locator('app-facilitator-view thead th');
      await expect(headers.filter({ hasText: HIDDEN })).toHaveCount(1, { timeout: 15000 });
      await expect(headers.filter({ hasText: NOTE })).toHaveCount(1);
      await expect(headers.filter({ hasText: /^Move$/ })).toHaveCount(0);
      await expect(headers.filter({ hasText: /^Group$/ })).toHaveCount(1);
    });

    test('The Assessor View of the same MSEL shows no automation', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);
      await page.goto(`${Services.Blueprint.UI}/assess?msel=${seeded.mselId}`, { waitUntil: 'domcontentloaded' });

      const assessor = page.locator('app-assessor-view');
      await expect(assessor.locator('tr').filter({ hasText: seeded.withTasks })).toBeVisible({ timeout: 30000 });
      await expect(assessor.locator('thead th').filter({ hasText: 'Automation' })).toHaveCount(0);
      await expect(assessor.getByRole('button', { name: new RegExp(`Run ${FIRST_TASK}`) })).toHaveCount(0);
      await expect(assessor.getByRole('button', { name: /^Start Move/ })).toHaveCount(0);
    });

    test('A MSEL that is not deployed offers no actions', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token, { deploy: false });
      await gotoFacilitatorPage(page, seeded.mselId);

      const view = page.locator('app-facilitator-view');
      await expect(view.getByText(/This MSEL is not deployed/)).toBeVisible({ timeout: 30000 });
      await expect(eventRow(page, seeded.withTasks)).toBeVisible();
      await expect(view.getByRole('button', { name: /^Start Move/ })).toHaveCount(0);
      await expect(view.getByRole('button', { name: 'Pause Automation' })).toHaveCount(0);
    });

    test('The dashboard card and the facilitate list open a running exercise', async ({
      blueprintAuthenticatedPage: page,
    }) => {
      await applyBlueprintTheme(page, theme);
      seeded = await seedFacilitatorMsel(token);

      await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });
      const card = dashboardCard(page, 'FACILITATE');
      await expect(card).toBeVisible({ timeout: 30000 });
      await card.getByRole('button', { name: 'Facilitate Events' }).click();
      await expect(page).toHaveURL(/\/facilitate$/);

      // expect: the list has the exercise's card, which opens its Facilitator View
      const link = page.getByRole('link', { name: 'Facilitate', exact: true }).and(
        page.locator(`[title="Facilitate ${seeded.mselName}"]`)
      );
      await expect(link).toBeVisible({ timeout: 30000 });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/facilitate\\?msel=${seeded.mselId}`));
      await expect(eventRow(page, seeded.withTasks)).toBeVisible({ timeout: 30000 });
    });

    // Signs in as a MSEL member (one of the worker's pool users) in its own context. The theme switch drives the
    // admin user's menu, so these role checks are theme-independent and run once.
    if (theme === 'light') {
      test.describe('as a MSEL member', () => {
        let context: BrowserContext | undefined;
        let unitId: string | undefined;

        test.afterEach(async () => {
          await context?.close();
          context = undefined;
          if (unitId) await deleteUnit(token, unitId);
          unitId = undefined;
        });

        // A MSEL role on its own grants no reads: the user also joins a unit attached to the MSEL.
        test('Access follows the MSEL role: none, Evaluator, Editor, then Facilitator', async ({
          browser,
          nonAdminUser,
        }) => {
          seeded = await seedFacilitatorMsel(token);
          const { mselId, taskIds } = seeded;

          context = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
          const page = await context.newPage();
          await signInToBlueprintAs(
            page,
            nonAdminUser.username,
            nonAdminUser.password,
            `${Services.Blueprint.UI}/facilitate?msel=${mselId}`
          );

          // expect: with no role on the MSEL the page refuses
          await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 30000 });

          unitId = (await createUnit(token)).id;
          await addUnitToMsel(token, mselId, unitId);
          await addUserToUnit(token, unitId, nonAdminUser.userId);

          // expect: an Evaluator is refused too, and the MSEL editor has no Facilitator View tab for them
          const evaluator = await addUserMselRole(token, mselId, nonAdminUser.userId, 'Evaluator');
          await page.reload();
          await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 30000 });
          await navigateToMsel(page, mselId);
          await expect(mselSectionItem(page, 'Assessor View')).toBeVisible();
          await expect(mselSectionItem(page, 'Facilitator View')).toHaveCount(0);
          await removeUserMselRole(token, evaluator.id);

          // expect: an Editor follows the exercise, but cannot run tasks or start moves
          const editor = await addUserMselRole(token, mselId, nonAdminUser.userId, 'Editor');
          await gotoFacilitatorPage(page, mselId);
          await expect(eventRow(page, seeded.withTasks)).toBeVisible({ timeout: 30000 });
          await expect(page.getByText(/You can follow the exercise here/)).toBeVisible();
          await expect(page.getByRole('button', { name: /^Start Move/ })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Pause Automation' })).toHaveCount(0);
          const readOnly = await openAutomationPanel(page, seeded.withTasks);
          await expect(readOnly.getByRole('button', { name: `Run ${FIRST_TASK}` })).toHaveCount(0);
          await removeUserMselRole(token, editor.id);

          // expect: a Facilitator runs a task
          await addUserMselRole(token, mselId, nonAdminUser.userId, 'Facilitator');
          await page.reload();
          const panel = await openAutomationPanel(page, seeded.withTasks);
          await panel.getByRole('button', { name: `Run ${FIRST_TASK}` }).click();
          await expect.poll(() => latestRunStatus(token, mselId, taskIds[FIRST_TASK]), { timeout: 30000 }).toBe('Succeeded');
          const run = (await listAutomationRuns(token, mselId, 'Exercise')).find((r) => r.automationTaskId === taskIds[FIRST_TASK]);
          expect(run.requestedBy).toBe(nonAdminUser.userId);
        });
      });
    }
  });
}
