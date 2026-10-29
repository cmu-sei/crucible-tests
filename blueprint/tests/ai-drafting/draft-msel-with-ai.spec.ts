// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  tempBlueprintName,
  blueprintCall,
} from '../../test-helpers';

/**
 * Draft MSEL with AI: the planner's design choices go with the draft, the review shows the design, and Create MSEL
 * builds the MSEL with its pages and an Expected Actions column for controllers.
 *
 * The model is the one thing stubbed: the draft and profile endpoints answer a fixed draft, because a live model
 * call takes minutes, costs money and answers differently each time. Create MSEL goes to the real Blueprint API,
 * which needs AI drafting turned on (`Ai:Enabled`), and everything after it is checked against what it saved.
 */
test.describe('Draft MSEL with AI', () => {
  let token: string;
  let templateId: string;
  let templateName: string;
  let draftedMselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    templateName = tempBlueprintName('TestBP-AiTemplate');
    const template = await createMsel(token, { name: templateName, isTemplate: true });
    templateId = template.id;
    await seedMselDataFields(token, templateId);
    draftedMselId = undefined;
  });

  test.afterEach(async () => {
    if (draftedMselId) await deleteMsel(token, draftedMselId);
    if (templateId) await deleteMsel(token, templateId);
  });

  test('Drafts from the design choices and creates the MSEL with its pages', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const draftedName = tempBlueprintName('TestBP-AiDraft');
    let draftRequest: any;
    await page.route('**/api/msels/ai-draft', async (route) => {
      draftRequest = route.request().postDataJSON();
      await route.fulfill({ json: draftResult(templateId, templateName, draftedName) });
    });
    await page.route('**/api/msels/ai-draft/profile', (route) =>
      route.fulfill({ json: { html: '<h2>Security operations</h2><p>Watches the network.</p>', notes: [] } })
    );

    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Draft MSEL with AI' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Draft MSEL with AI')).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Template' }).click();
    await page.getByRole('option', { name: templateName }).click();
    await dialog.getByText('Design choices (optional)').click();
    await dialog.getByRole('combobox', { name: 'Format' }).click();
    await page.getByRole('option', { name: 'Discussion (tabletop)' }).click();
    await dialog.getByRole('spinbutton', { name: 'Number of moves' }).fill('2');
    await dialog.getByRole('textbox', { name: 'Exercise description' }).fill('Two undersea cables to the islands are cut.');
    await dialog.getByRole('button', { name: 'Draft' }).click();

    // the design choices went with the draft
    await expect(dialog.getByRole('heading', { name: 'Scenario and objectives' })).toBeVisible({ timeout: 15000 });
    expect(draftRequest.templateMselId).toBe(templateId);
    expect(draftRequest.design).toMatchObject({ format: 'Discussion', moves: 2, profilePages: true });

    // the review shows the design
    await expect(dialog.getByText('Two cables to the islands are cut.')).toBeVisible();
    await expect(dialog.getByText(/Lead the response/).first()).toBeVisible();
    await dialog.getByText('Move 0', { exact: true }).click();
    const move = dialog.getByLabel('Move 0 design');
    await expect(move.getByText('Make the team choose a lead')).toBeVisible();
    await expect(move.getByText('Decide who leads the response')).toBeVisible();

    const importResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/msels/ai-draft/import') && r.request().method() === 'POST',
      { timeout: 60000 }
    );
    await dialog.getByRole('button', { name: 'Create MSEL' }).click();
    const response = await importResponse;
    expect(response.ok(), await response.text()).toBe(true);
    draftedMselId = (await response.json()).msel.id;

    await expect(page.getByRole('dialog').getByRole('button', { name: 'Open MSEL' })).toBeVisible({ timeout: 15000 });

    // the pages: an overview participants see, the read-in, a guide only exercise control sees, and the profiles
    const pages = await blueprintCall<any[]>(token, `/api/msels/${draftedMselId}/mselpages`);
    expect(pages.ok, pages.text).toBe(true);
    const byName = Object.fromEntries(pages.data.map((p) => [p.name, p]));
    expect(Object.keys(byName).sort()).toEqual(
      ['Exercise Overview', 'Facilitator Guide', `${draftedName} Read-In`, 'Organization Profiles', 'Team Profiles'].sort()
    );
    expect(byName['Exercise Overview'].allCanView).toBe(true);
    expect(byName['Exercise Overview'].content).toContain('Lead the response');
    expect(byName['Facilitator Guide'].allCanView).toBe(false);
    expect(byName['Facilitator Guide'].content).toContain('Hold the vendor call until they ask.');

    // expected actions go in a column controllers see and participants do not
    const fields = await blueprintCall<any[]>(token, `/api/msels/${draftedMselId}/dataFields`);
    const expected = fields.data.find((f) => f.name === 'Expected Actions');
    expect(expected, 'the drafted MSEL has an Expected Actions column').toBeTruthy();
    expect(expected.onScenarioEventList).toBe(true);
    expect(expected.onExerciseView).toBe(false);

    await page.getByRole('dialog').getByRole('button', { name: 'Open MSEL' }).click();
    await expect(page).toHaveURL(new RegExp(`/build\\?msel=${draftedMselId}`));
  });
});

// a draft on the template's Title column: one objective, two moves, one team and one organization
function draftResult(templateMselId: string, templateName: string, name: string) {
  return {
    templateMselId,
    templateName,
    fields: [{ name: 'Title', dataType: 'String', options: [] }],
    warnings: [],
    competencies: [],
    draft: {
      name,
      description: 'Undersea cables to the islands are cut.',
      durationMinutes: 120,
      design: { format: 'Discussion', citeAssessment: 'None', moves: 2, profilePages: true },
      scenario: {
        problem: 'Two cables to the islands are cut.',
        premise: 'A ship dragged its anchor.',
        environment: 'An island state with one carrier',
        escalationCeiling: 'No loss of life',
        assumptions: ['Repair takes weeks'],
      },
      objectives: [
        { id: 'O1', task: 'Lead the response', condition: 'With partial outages', standard: 'A lead within 30 minutes', competencies: [] },
      ],
      moves: [
        {
          moveNumber: 0, description: 'Outage', situationDescription: 'The islands lose internet.', startMinutes: 0,
          situationTime: '2026-03-04T08:00:00.000Z', purpose: 'Make the team choose a lead',
          expectedDecisions: ['Decide who leads the response'], controllerNotes: 'Hold the vendor call until they ask.', citeQuestions: [],
        },
        {
          moveNumber: 1, description: 'Pressure', situationDescription: 'The press calls.', startMinutes: 60,
          situationTime: '2026-03-05T09:00:00.000Z', purpose: 'Public pressure', expectedDecisions: ['Brief the ministry'], citeQuestions: [],
        },
      ],
      teams: [{ name: 'Security operations', shortName: 'SOC', description: 'Watches the network.', competencies: [] }],
      organizations: [{ name: 'Harbour Herald', shortName: 'NEWS', description: 'The regional paper', summary: 'The regional paper' }],
      cards: [],
      injects: [
        { minutes: 5, eventType: 'Inject', values: { Title: 'Outage reported' }, competencies: [], expectedAction: 'Open an incident and assign a lead', objective: 'O1' },
        { minutes: 70, eventType: 'Inject', values: { Title: 'Press call' }, competencies: [], expectedAction: 'Agree what to tell the press', objective: 'O1' },
      ],
      readIn: '<h2>Background</h2><p>The cables run under the strait.</p>',
      citeActions: [],
      competencies: [],
      plannerNotes: [],
    },
  };
}
