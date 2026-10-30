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
 * Draft MSEL with AI, in two steps: the model writes the design and its questions, the planner reviews the design in
 * tabs and answers, and Create MSEL creates the MSEL at once and builds the rest into it on the MSEL's page.
 *
 * The model is the one thing stubbed: the endpoints that call it (the design, the inject outline, the finish, and the
 * build status after the outline) answer fixed results, because a live model call takes minutes, costs money and
 * answers differently each time. Create MSEL goes to the real Blueprint API, which needs AI drafting turned on
 * (`Ai:Enabled`), and the MSEL it makes is checked against what it saved.
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

  test('Designs from the design choices, takes the answers, and builds the MSEL on its page', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const draftedName = tempBlueprintName('TestBP-AiDraft');
    let designRequest: any;
    let createRequest: any;
    await page.route('**/api/msels/ai-draft/design', async (route) => {
      designRequest = route.request().postDataJSON();
      await route.fulfill({ json: designResult(templateId, templateName, draftedName) });
    });
    // the steps that call the model once the MSEL exists; the first status read is real, so the build starts at the outline
    let statusReads = 0;
    await page.route('**/api/msels/*/ai-draft', async (route) => {
      if (route.request().method() !== 'GET' || statusReads++ === 0) return route.continue();
      await route.fulfill({ json: { stage: 'Articles', parallel: 6, injects: [], articles: [], profiles: [], warnings: [] } });
    });
    await page.route('**/api/msels/*/ai-draft/injects', (route) =>
      route.fulfill({ json: { stage: 'Articles', parallel: 6, injects: [], articles: [], profiles: [], warnings: ['Added a read-in notice.'] } })
    );
    await page.route('**/api/msels/*/ai-draft/finish', (route) =>
      route.fulfill({ json: { stage: null, parallel: 6, injects: [], articles: [], profiles: [], warnings: [] } })
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

    // the design choices went with the design request
    await expect(dialog.getByRole('tab', { name: 'Questions (1)' })).toBeVisible({ timeout: 15000 });
    expect(designRequest.templateMselId).toBe(templateId);
    expect(designRequest.design).toMatchObject({ format: 'Discussion', moves: 2, profilePages: true });

    // the question starts with its suggested answer; the planner changes it
    const answer = dialog.getByRole('textbox', { name: 'Should the outage reach the hospital?' });
    await expect(answer).toHaveValue('Stop at the port');
    await answer.fill('Yes, the hospital loses power');

    // the design tabs
    await dialog.getByRole('tab', { name: 'Design' }).click();
    await expect(dialog.getByRole('textbox', { name: 'The problem' })).toHaveValue('Two cables to the islands are cut.');
    await expect(dialog.getByRole('textbox', { name: 'O1 task' })).toHaveValue('Lead the response');
    await dialog.getByRole('tab', { name: 'Moves (2)' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Move 0 purpose' })).toHaveValue('Make the team choose a lead');
    await dialog.getByRole('tab', { name: 'Teams and organizations (2)' }).click();
    await expect(dialog.getByRole('textbox', { name: 'SOC description' })).toHaveValue('Watches the network.');

    const createResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/msels/ai-draft/create') && r.request().method() === 'POST',
      { timeout: 60000 }
    );
    page.on('request', (r) => {
      if (r.url().endsWith('/api/msels/ai-draft/create')) createRequest = r.postDataJSON();
    });
    await dialog.getByRole('button', { name: 'Create MSEL' }).click();
    const response = await createResponse;
    expect(response.ok(), await response.text()).toBe(true);
    draftedMselId = (await response.json()).msel.id;
    expect(createRequest.answers).toEqual([{ question: 'Should the outage reach the hospital?', answer: 'Yes, the hospital loses power' }]);

    // the MSEL opens and its page shows the build, then that it is done
    await expect(page).toHaveURL(new RegExp(`/build\\?msel=${draftedMselId}`), { timeout: 15000 });
    const banner = page.getByRole('region', { name: 'Drafting with AI' });
    await expect(banner).toContainText('Drafted with AI.', { timeout: 30000 });
    await expect(banner).toContainText('1 note from the draft');

    // the MSEL was created from the design: play between a pre-exercise move and a hot wash, with the teams
    const msel = await blueprintCall<any>(token, `/api/msels/${draftedMselId}`);
    expect(msel.ok, msel.text).toBe(true);
    expect(msel.data.name).toBe(draftedName);
    const moves = await blueprintCall<any[]>(token, `/api/msels/${draftedMselId}/moves`);
    expect(moves.data.map((m) => m.description).sort()).toEqual(
      ['Pre-exercise', 'Outage', 'Pressure', 'Post-exercise: hot wash'].sort()
    );
    const teams = await blueprintCall<any[]>(token, `/api/msels/${draftedMselId}/teams`);
    expect(teams.data.map((t) => t.shortName)).toContain('SOC');
  });
});

// a design on the template's Title column: one objective, two moves, one team, one organization, one question
function designResult(templateMselId: string, templateName: string, name: string) {
  return {
    templateMselId,
    templateName,
    fields: [{ name: 'Title', dataType: 'String', options: [] }],
    warnings: [],
    competencies: [],
    questions: [{ id: 'Q1', question: 'Should the outage reach the hospital?', why: 'Sets the stakes', suggested: 'Stop at the port' }],
    draft: {
      draftId: '00000000-0000-0000-0000-000000000000',
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
        },
        {
          moveNumber: 1, description: 'Pressure', situationDescription: 'The press calls.', startMinutes: 60,
          situationTime: '2026-03-05T09:00:00.000Z', purpose: 'Public pressure',
        },
      ],
      teams: [{ name: 'Security operations', shortName: 'SOC', description: 'Watches the network.', competencies: [], duties: [] }],
      organizations: [{ name: 'Harbour Herald', shortName: 'NEWS', description: 'The regional paper', summary: 'The regional paper' }],
      cards: [],
      injects: [],
      citeActions: [],
      competencies: [],
      plannerNotes: [],
    },
  };
}
