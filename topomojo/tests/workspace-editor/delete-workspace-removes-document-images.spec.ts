// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  createWorkspace,
  deleteWorkspace,
  getTopoMojoAdminToken,
  resolveTopoApiBase,
} from '../../../topomojo-helpers';

// A 1x1 transparent PNG, so the upload is a real image the static file handler will serve.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HSFTAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

// API-only: document images are served from /docs/{id}/<file> with no authorization, so
// what matters is whether that URL still answers after the workspace is gone.
test.describe('Workspace Editor', () => {
  let token: string;
  let workspaceId: string | null = null;

  test.beforeEach(async () => {
    token = await getTopoMojoAdminToken();
  });

  test.afterEach(async () => {
    if (workspaceId) {
      // Tolerates the 404 when the test already deleted it.
      await deleteWorkspace(token, workspaceId);
      workspaceId = null;
    }
  });

  test('Workspace Editor - Delete Workspace Removes Document Images', async ({ request }) => {
    const api = await resolveTopoApiBase();
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Create a workspace, save a document, and upload a document image
    const workspace = await createWorkspace(token, {
      name: `TestWorkspace-DocImages-${Date.now()}`,
      audience: null,
    });
    workspaceId = workspace.id;

    const upload = await request.post(`${api}/api/image/${workspaceId}`, {
      headers,
      multipart: {
        file: { name: 'diagram.png', mimeType: 'image/png', buffer: PNG },
      },
    });
    expect(upload.status()).toBe(200);
    const { filename } = await upload.json();
    expect(filename).toBeTruthy();

    const imageUrl = `${api}/docs/${workspaceId}/${encodeURIComponent(filename)}`;

    // The endpoint binds a JSON string body, so the markdown is sent as a quoted JSON string.
    const saved = await request.put(`${api}/api/document/${workspaceId}`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: JSON.stringify(`# Doc\n\n![diagram](${imageUrl})\n`),
    });
    expect(saved.status()).toBe(200);

    // expect: The image is publicly served while the workspace exists
    const before = await request.get(imageUrl);
    expect(before.status()).toBe(200);

    // 2. Delete the workspace
    const deleted = await request.delete(`${api}/api/workspace/${workspaceId}`, { headers });
    expect(deleted.status()).toBe(200);

    // expect: The image is no longer served
    const after = await request.get(imageUrl);
    expect(after.status()).toBe(404);
  });
});
