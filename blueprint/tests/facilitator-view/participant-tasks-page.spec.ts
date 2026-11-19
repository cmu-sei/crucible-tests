// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license
// information.

// spec: specs/blueprint-test-plan.md
//
// The participants' Tasks page, /msel/<id>/tasks (ParticipantTasksPageComponent), which takes the
// place of Steamfitter's task page: a member of one of the MSEL's teams runs the tasks marked
// "Participants can run it", and sees the exercise's score.
//
// The test seeds a MSEL with one event and two tasks worth points: one participants can run, and
// one only a facilitator runs. The tasks are http GETs of Blueprint's health endpoint (see
// healthCheckTask). The participant is the worker's pool user, on one of the MSEL's teams with no
// MSEL role. Signing in as them is theme-independent, so the test runs once.

import { test, expect, Services } from '../../fixtures';
import type { BrowserContext } from '@playwright/test';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createScenarioEvent,
  createTeam,
  addUserToTeam,
  setAutomationTasks,
  healthCheckTask,
  listAutomationRuns,
  signInToBlueprintAs,
  tempBlueprintName,
} from '../../test-helpers';
import { clearMselIntegrationState, deployMselForAutomation } from '../../db-helpers';

const PARTICIPANT_TASK = 'Report in';
const FACILITATOR_TASK = 'Facilitator only';

test.describe('Participant Tasks Page', () => {
  let token: string;
  let mselId: string | undefined;
  let context: BrowserContext | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
  });

  test.afterEach(async () => {
    await context?.close();
    context = undefined;
    if (mselId) {
      await clearMselIntegrationState(mselId);
      // The team, and the user's place on it, go with the MSEL.
      await deleteMsel(token, mselId);
    }
    mselId = undefined;
  });

  test('A participant runs the task marked for them and earns its points', async ({ browser, nonAdminUser }) => {
    const mselName = tempBlueprintName('TestBP-ParticipantTasks');
    mselId = (await createMsel(token, { name: mselName, status: 'Approved' })).id;
    const event = await createScenarioEvent(token, mselId, { deltaSeconds: 0 });
    const tasks = await setAutomationTasks(token, event.id, [
      healthCheckTask(PARTICIPANT_TASK, { description: 'Tell the white cell you are ready', score: 10, userExecutable: true }),
      healthCheckTask(FACILITATOR_TASK, { score: 20 }),
    ]);
    const team = await createTeam(token, mselId);
    await addUserToTeam(token, team.id, nonAdminUser.userId);

    context = await browser.newContext({ ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const tasksUrl = `${Services.Blueprint.UI}/msel/${mselId}/tasks`;
    await signInToBlueprintAs(page, nonAdminUser.username, nonAdminUser.password, tasksUrl);

    // expect: before the push the page says the exercise is not running, and the task cannot be run
    await expect(page.getByRole('paragraph').filter({ hasText: 'The exercise is not running.' })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole('button', { name: `Run ${PARTICIPANT_TASK}` })).toBeDisabled();

    await deployMselForAutomation(mselId);
    await page.reload();

    // expect: only the task marked for participants is listed, and the score counts every task's points
    const row = page.getByRole('row').filter({ hasText: PARTICIPANT_TASK });
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText('Tell the white cell you are ready');
    await expect(row).toContainText('Not run');
    await expect(page.getByRole('row').filter({ hasText: FACILITATOR_TASK })).toHaveCount(0);
    await expect(page.getByText('Score: 0/30 (0%)')).toBeVisible();

    await row.getByRole('button', { name: `Run ${PARTICIPANT_TASK}` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Run Task' });
    await expect(confirm).toContainText(`Are you sure that you want to run ${PARTICIPANT_TASK}?`);
    await confirm.getByRole('button', { name: 'Run', exact: true }).click();

    // expect: the task succeeds, earns its points, and runs only once
    await expect(row).toContainText('Succeeded', { timeout: 30000 });
    await expect(page.getByText('Score: 10/30 (33%)')).toBeVisible();
    await expect(row).toContainText('The task has succeeded, and runs only once.');
    await expect(row.getByRole('button', { name: `Run ${PARTICIPANT_TASK}` })).toBeDisabled();

    // expect: the run is the exercise's, started by the participant
    const run = (await listAutomationRuns(token, mselId, 'Exercise')).find((r) => r.automationTaskId === tasks[0].id);
    expect(run).toMatchObject({ source: 'Participant', requestedBy: nonAdminUser.userId, status: 'Succeeded' });
  });
});
