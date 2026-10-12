// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { randomUUID } from 'crypto';
import { APIRequestContext } from '@playwright/test';
import { test, expect, Services, getCiteApiToken, seedScoringModel, apiDeleteScoringModel } from '../../fixtures';

const COPY_SUFFIX = /^ \*copy by .+\*$/;

async function downloadJson(request: APIRequestContext, headers: Record<string, string>, id: string) {
  const response = await request.get(`${Services.Cite.API}/api/scoringModels/${id}/json`, { headers });
  expect(response.status()).toBe(200);
  return JSON.parse(await response.text());
}

async function uploadJson(request: APIRequestContext, headers: Record<string, string>, scoringModel: object) {
  const response = await request.post(`${Services.Cite.API}/api/scoringModels/json`, {
    headers,
    multipart: {
      ToUpload: {
        name: 'scoring-model.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(scoringModel)),
      },
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

async function countByDescription(request: APIRequestContext, headers: Record<string, string>, description: string) {
  const response = await request.get(`${Services.Cite.API}/api/scoringModels`, {
    headers,
    params: { description, includeArchived: true },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).length;
}

test.describe('Scoring Model JSON Import', () => {
  let headers: Record<string, string>;
  const createdIds: string[] = [];

  test.beforeEach(async ({ request }) => {
    headers = { Authorization: `Bearer ${await getCiteApiToken(request)}` };
  });

  test.afterEach(async () => {
    while (createdIds.length) {
      await apiDeleteScoringModel(createdIds.pop()!);
    }
  });

  test('Import with a new id and an unused description keeps the description', async ({ request }) => {
    const sourceId = await seedScoringModel();
    createdIds.push(sourceId);
    const file = await downloadJson(request, headers, sourceId);
    const fileId = randomUUID();
    const description = `Imported Scoring Model ${randomUUID()}`;
    file.Id = fileId;
    file.Description = description;

    // 1. Import the file
    const imported = await uploadJson(request, headers, file);
    createdIds.push(imported.id);

    // expect: a new scoring model with the file's description, no copy suffix
    expect(imported.id).not.toBe(sourceId);
    expect(imported.description).toBe(description);
  });

  test('Import with a description already in use adds the copy suffix', async ({ request }) => {
    const description = `Colliding Scoring Model ${randomUUID()}`;
    const sourceId = await seedScoringModel(description);
    createdIds.push(sourceId);
    const file = await downloadJson(request, headers, sourceId);
    file.Id = randomUUID();

    // 1. Import a file whose description matches an existing scoring model
    const imported = await uploadJson(request, headers, file);
    createdIds.push(imported.id);

    // expect: a new scoring model, named "<description> *copy by <user>*"
    expect(imported.id).not.toBe(sourceId);
    expect(imported.description.startsWith(description)).toBe(true);
    expect(imported.description.slice(description.length)).toMatch(COPY_SUFFIX);
  });

  test('Import with an existing id returns the existing scoring model unchanged', async ({ request }) => {
    const description = `Existing Scoring Model ${randomUUID()}`;
    const sourceId = await seedScoringModel(description);
    createdIds.push(sourceId);
    const file = await downloadJson(request, headers, sourceId);
    file.Description = `${description} edited in the file`;

    // 1. Import a file whose id is already a scoring model template
    const imported = await uploadJson(request, headers, file);
    if (imported.id !== sourceId) createdIds.push(imported.id);

    // expect: the existing scoring model is returned as is, and no copy is made
    expect(imported.id).toBe(sourceId);
    expect(imported.description).toBe(description);
    expect(await countByDescription(request, headers, description)).toBe(1);
  });

  test('Copy still adds the copy suffix', async ({ request }) => {
    const description = `Copied Scoring Model ${randomUUID()}`;
    const sourceId = await seedScoringModel(description);
    createdIds.push(sourceId);

    // 1. Copy an existing scoring model
    const response = await request.post(`${Services.Cite.API}/api/scoringModels/${sourceId}/copy`, { headers });
    expect(response.status()).toBe(201);
    const copy = await response.json();
    createdIds.push(copy.id);

    // expect: a new scoring model, named "<description> *copy by <user>*"
    expect(copy.id).not.toBe(sourceId);
    expect(copy.description.slice(description.length)).toMatch(COPY_SUFFIX);
  });
});
