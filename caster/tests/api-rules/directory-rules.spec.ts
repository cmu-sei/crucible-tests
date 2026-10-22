// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, casterApi, seedCasterDirectory, seedCasterProject } from '../../fixtures';

// Rules the Caster API enforces on directories that the UI has no way to break:
// its Terraform Version field only offers installed versions, and it has no way
// to move a directory. Checked through the API, as the signed-in admin.

const VERSION_ERROR =
  'The specified version is not available. Please contact a system administrator to request it be added to the system.';

test.describe('API Rules › Directories', () => {
  test('Terraform Version Must Be One Caster Can Run', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectId = await seedCasterProject(page, `API Version Project ${Date.now()}`);
    cleanupCasterProject(projectId);
    const versions: string[] = (await casterApi(page, 'GET', 'terraform/versions')).body.versions;

    // 1. Create a directory pinned to a version that isn't installed
    const created = await casterApi(page, 'POST', 'directories', {
      name: 'Unknown-Version',
      projectId,
      terraformVersion: '0.0.0-not-installed',
    });

    // expect: 400 on the version, and no directory
    expect(created.status).toBe(400);
    expect(created.body.errors.TerraformVersion).toEqual([VERSION_ERROR]);
    expect((await casterApi(page, 'GET', `projects/${projectId}/directories`)).body).toHaveLength(0);

    // 2. Create one with an installed version
    const directoryId = await seedCasterDirectory(page, projectId, 'Known-Version', { terraformVersion: versions[0] });

    // 3. Change it to a path instead of a version
    const traversal = await casterApi(page, 'PATCH', `directories/${directoryId}`, { terraformVersion: '../../bin' });

    // expect: 400, and the version unchanged
    expect(traversal.status).toBe(400);
    expect(traversal.body.errors.TerraformVersion).toEqual([VERSION_ERROR]);
    expect((await casterApi(page, 'GET', `directories/${directoryId}`)).body.terraformVersion).toBe(versions[0]);

    // 4. A workspace is held to the same rule
    const workspace = await casterApi(page, 'POST', 'workspaces', {
      name: 'unknown-version',
      directoryId,
      terraformVersion: '0.0.0-not-installed',
    });
    expect(workspace.status).toBe(400);
    expect(workspace.body.errors.TerraformVersion).toEqual([VERSION_ERROR]);
  });

  test('Directories Move Only Within Their Project And Never Under Themselves', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    const suffix = Date.now();
    const projectId = await seedCasterProject(page, `API Move Project ${suffix}`);
    cleanupCasterProject(projectId);
    const otherProjectId = await seedCasterProject(page, `API Move Other ${suffix}`);
    cleanupCasterProject(otherProjectId);

    const parent = await seedCasterDirectory(page, projectId, 'Parent');
    const child = await seedCasterDirectory(page, projectId, 'Child', { parentId: parent });
    const grandchild = await seedCasterDirectory(page, projectId, 'Grandchild', { parentId: child });
    const sibling = await seedCasterDirectory(page, projectId, 'Sibling');
    const elsewhere = await seedCasterDirectory(page, otherProjectId, 'Elsewhere');

    const move = (id: string, parentId: string | null) => casterApi(page, 'PATCH', `directories/${id}`, { parentId });
    const parentOf = async (id: string) => (await casterApi(page, 'GET', `directories/${id}`)).body.parentId;

    // 1. Make a directory its own parent, then a child of its own descendant
    for (const target of [parent, grandchild]) {
      const res = await move(parent, target);
      // expect: 409, and the tree unchanged
      expect(res.status).toBe(409);
      expect(res.body.title).toBe('A Directory cannot be its own parent or a child of its descendants');
    }
    expect(await parentOf(parent)).toBeNull();

    // 2. Move a directory under one in another project
    const crossProject = await move(elsewhere, parent);

    // expect: 409, and it stays where it was
    expect(crossProject.status).toBe(409);
    expect(crossProject.body.title).toBe('Parent and child Directories must be in the same Project');
    expect(await parentOf(elsewhere)).toBeNull();

    // 3. Move a directory within its project
    const within = await move(sibling, grandchild);

    // expect: it moves
    expect(within.status).toBe(200);
    expect(await parentOf(sibling)).toBe(grandchild);

    // 4. Clear a parent with an explicit null
    const cleared = await move(child, null);

    // expect: the child becomes top-level, and its descendants go with it
    expect(cleared.status).toBe(200);
    expect(await parentOf(child)).toBeNull();
    expect(await parentOf(grandchild)).toBe(child);
    const topLevel = (await casterApi<any[]>(page, 'GET', `projects/${projectId}/directories`)).body
      .filter((d) => d.parentId === null)
      .map((d) => d.name)
      .sort();
    expect(topLevel).toEqual(['Child', 'Parent']);
  });
});
