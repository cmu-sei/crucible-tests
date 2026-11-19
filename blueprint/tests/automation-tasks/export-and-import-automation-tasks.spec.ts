// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  listScenarioEvents,
  setAutomationTasks,
  healthCheckTask,
  listEventAutomationTasks,
  blueprintCall,
  tempBlueprintName,
} from '../../test-helpers';

const FIRST_TASK = 'Check health';
const CHAINED_TASK = 'Check again';
const SECRET_HEADER = 'X-Test-Secret';

/**
 * A MSEL's automation tasks go with it in its JSON file and come back on import, with their
 * order, chain, points and participant flag; their secrets do not.
 *
 * Seeds a MSEL with one event and two tasks, the first holding an http header (a secret), exports
 * it as JSON through the API, and imports that file through the UI. A secret is encrypted with this
 * installation's key, so the file names it without its value, and the import report says the task
 * needs it entered again.
 */
test.describe('Automation tasks in a MSEL JSON file', () => {
  let token: string;
  let sourceMselId: string | undefined;
  let importedMselId: string | undefined;
  let filePath: string | undefined;
  let secretValue: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const name = tempBlueprintName('TestBP-AutomationJson');
    sourceMselId = (await createMsel(token, { name })).id;
    const event = await createRenderableScenarioEvent(token, sourceMselId, 'Event with tasks');
    await setAutomationTasks(token, event.id, [
      healthCheckTask(FIRST_TASK, { score: 5, userExecutable: true }),
      healthCheckTask(CHAINED_TASK, { triggerCondition: 'OnSuccess', triggerTask: FIRST_TASK, repeatable: true }),
    ]);
    // Secrets are written with the task's own form: a seeded task carries none.
    secretValue = `secret-${Date.now()}`;
    const [first, second] = await listEventAutomationTasks(token, event.id);
    const saved = await blueprintCall(token, `/api/scenarioEvents/${event.id}`, {
      method: 'PUT',
      body: {
        ...(await blueprintCall(token, `/api/scenarioEvents/${event.id}`)).data,
        automationTasks: [
          { ...first, secretParameters: { Headers: JSON.stringify({ [SECRET_HEADER]: secretValue }) } },
          second,
        ],
      },
    });
    expect(saved.ok, saved.text).toBe(true);

    const res = await fetch(`${Services.Blueprint.API}/api/msels/${sourceMselId}/json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok, `export of ${sourceMselId} failed: ${res.status}`).toBe(true);
    filePath = path.join(os.tmpdir(), `${name}.json`);
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  });

  test.afterEach(async () => {
    if (importedMselId) await deleteMsel(token, importedMselId);
    importedMselId = undefined;
    if (sourceMselId) await deleteMsel(token, sourceMselId);
    sourceMselId = undefined;
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('Tasks come back with their chain and points, and their secrets do not', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    // expect: the file names the secret, never its value
    const file = fs.readFileSync(filePath!, 'utf8');
    expect(file).toContain(FIRST_TASK);
    expect(file).not.toContain(secretValue);

    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Upload a new MSEL from a file/i }).click();
    const uploadJson = page.getByRole('menuitem', { name: /Upload json file/i });
    await expect(uploadJson).toBeVisible({ timeout: 10000 });
    const fileChooser = page.waitForEvent('filechooser');
    const imported = page.waitForResponse(
      (r) => r.url().endsWith('/api/msels/json/import') && r.request().method() === 'POST',
      { timeout: 30000 }
    );
    await uploadJson.click();
    await (await fileChooser).setFiles(filePath!);
    const response = await imported;
    expect(response.ok()).toBe(true);
    importedMselId = (await response.json()).msel.id;

    // expect: the report says the task with a secret needs it entered again
    const dialog = page.getByRole('dialog');
    const changed = dialog.locator('section', { has: page.getByRole('heading', { name: 'Changed' }) });
    await expect(changed).toContainText('1 automation task(s) need a password or key entered again');

    // expect: the copy's tasks are its own, in order, the second following the first, with the points and flags
    const [event] = await listScenarioEvents(token, importedMselId!);
    const tasks = await listEventAutomationTasks(token, event.id);
    expect(tasks.map((t) => t.name)).toEqual([FIRST_TASK, CHAINED_TASK]);
    expect(tasks.every((t) => t.mselId === importedMselId)).toBe(true);
    expect(Number(tasks[0].score)).toBe(5);
    expect(tasks[0].userExecutable).toBe(true);
    expect(tasks[1]).toMatchObject({ triggerCondition: 'OnSuccess', triggerTaskId: tasks[0].id, repeatable: true });
    expect(tasks[0].secretParameterKeys).toEqual([]);
  });
});
