// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

/**
 * File names are written straight into a Workspace's working directory when a Run
 * is prepared, so the API must reject names that could escape that directory.
 * These names cannot be typed into the UI dialog in a meaningful way, so the
 * checks are made directly against the API using the authenticated user's token.
 */
const invalidFileNames = [
  '../../etc/cron.d/backdoor',
  '../escaped.tf',
  'subdir/main.tf',
  '..\\escaped.tf',
  'main.tf\0.txt',
  '..',
  '',
];

test.describe('Error Handling and Validation', () => {
  test('File Name Path Traversal Rejection', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    await expect(page.getByText('My Projects')).toBeVisible();

    const result = await page.evaluate(
      async ({ names }) => {
        const settingsResp = await fetch('/assets/config/settings.env.json');
        const apiUrl: string = (await settingsResp.json()).ApiUrl;

        let token: string | null = null;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            try {
              const val = JSON.parse(sessionStorage.getItem(key) || '');
              if (val.access_token) {
                token = val.access_token;
                break;
              }
            } catch {
              // not a token entry
            }
          }
        }
        if (!token) throw new Error('No access token found in session storage');

        const send = async (path: string, body: unknown) =>
          fetch(`${apiUrl}${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

        // Setup: a project and a directory to create files in
        const projectResp = await send('/api/projects', { name: `Traversal Test ${Date.now()}` });
        const project = await projectResp.json();

        const directoryResp = await send('/api/directories', {
          name: 'Traversal Directory',
          projectId: project.id,
        });
        const directory = await directoryResp.json();

        // Each traversing name is rejected
        const rejected: { name: string; status: number }[] = [];
        for (const name of names) {
          const resp = await send('/api/files', {
            name,
            directoryId: directory.id,
            content: '# content',
          });
          rejected.push({ name, status: resp.status });
        }

        // An ordinary name is still accepted
        const validResp = await send('/api/files', {
          name: 'main.tf',
          directoryId: directory.id,
          content: '# content',
        });
        const validStatus = validResp.status;
        const file = validStatus === 201 ? await validResp.json() : null;

        // Renaming to a traversing name is rejected and leaves the name alone
        let renameStatus: number | null = null;
        let nameAfterRename: string | null = null;
        if (file) {
          const renameResp = await send(`/api/files/${file.id}/actions/rename`, {
            name: '../../etc/cron.d/backdoor',
          });
          renameStatus = renameResp.status;

          const getResp = await fetch(`${apiUrl}/api/files/${file.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          nameAfterRename = (await getResp.json()).name;
        }

        return {
          projectId: project.id,
          projectStatus: projectResp.status,
          directoryStatus: directoryResp.status,
          rejected,
          validStatus,
          renameStatus,
          nameAfterRename,
        };
      },
      { names: invalidFileNames }
    );

    cleanupCasterProject(result.projectId);

    // Setup succeeded
    expect(result.projectStatus).toBe(201);
    expect(result.directoryStatus).toBe(201);

    // 2 & 3. Every traversing or separator-bearing name is rejected
    for (const { name, status } of result.rejected) {
      expect(status, `POST /api/files should reject name ${JSON.stringify(name)}`).toBe(400);
    }

    // 5. An ordinary file name still works
    expect(result.validStatus).toBe(201);

    // 4. Rename is validated too, and the file keeps its name
    expect(result.renameStatus).toBe(400);
    expect(result.nameAfterRename).toBe('main.tf');
  });
});
