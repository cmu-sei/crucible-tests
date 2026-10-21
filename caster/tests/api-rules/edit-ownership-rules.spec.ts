// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  casterApi,
  requireTestModuleCatalog,
  seedCasterDesign,
  seedCasterDirectory,
  seedCasterFile,
  seedCasterProject,
  seedCasterWorkspace,
} from '../../fixtures';

// Caster authorizes an edit against where a record is stored, not against
// ownership IDs in the request body, so an edit can't carry a record into a
// directory, workspace or design the caller never had to be allowed into. The UI
// stopped sending those IDs; these checks send them anyway, through the API.

test.describe('API Rules › Edit Ownership', () => {
  test('Edits Ignore Ownership IDs In The Body', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectId = await seedCasterProject(page, `API Ownership Project ${Date.now()}`);
    cleanupCasterProject(projectId);
    const home = await seedCasterDirectory(page, projectId, 'Home');
    const other = await seedCasterDirectory(page, projectId, 'Other');

    // 1. Edit a file, naming the other directory in the body
    const fileId = await seedCasterFile(page, home, 'main.tf', '# one\n');
    expect((await casterApi(page, 'POST', `files/${fileId}/actions/lock`)).status).toBe(200);
    const fileEdit = await casterApi(page, 'PUT', `files/${fileId}`, {
      name: 'main.tf',
      content: '# two\n',
      directoryId: other,
    });
    await casterApi(page, 'POST', `files/${fileId}/actions/unlock`);

    // expect: the content changes, and the file stays where it was
    expect(fileEdit.status).toBe(200);
    expect(fileEdit.body).toMatchObject({ directoryId: home, content: '# two\n' });
    expect((await casterApi<any[]>(page, 'GET', `directories/${other}/files`)).body).toHaveLength(0);

    // 2. Edit a workspace, naming the other directory in the body
    const workspaceId = await seedCasterWorkspace(page, home, 'staying');
    const workspaceEdit = await casterApi(page, 'PUT', `workspaces/${workspaceId}`, {
      name: 'renamed',
      directoryId: other,
    });

    // expect: the rename applies, and the workspace stays where it was
    expect(workspaceEdit.status).toBe(200);
    expect(workspaceEdit.body).toMatchObject({ name: 'renamed', directoryId: home });
    expect((await casterApi<any[]>(page, 'GET', `directories/${other}/workspaces`)).body).toHaveLength(0);
  });

  test('Design Module Edits Ignore The Design ID In The Body', async ({
    casterAuthenticatedPage: page,
    cleanupCasterProject,
  }) => {
    const { blankMachine } = await requireTestModuleCatalog(page);
    const projectId = await seedCasterProject(page, `API Design Module Project ${Date.now()}`);
    cleanupCasterProject(projectId);
    const directoryId = await seedCasterDirectory(page, projectId, 'Designs');
    const home = await seedCasterDesign(page, directoryId, 'Home Design');
    const other = await seedCasterDesign(page, directoryId, 'Other Design');

    const created = await casterApi(page, 'POST', 'designModules', {
      designId: home,
      moduleId: blankMachine.id,
      name: 'Blank_Machine',
      moduleVersion: 'v1.1.0',
      values: [{ name: 'vm_name', value: 'web01' }],
    });
    expect(created.status).toBe(201);

    // 1. Edit the design module, naming the other design in the body
    const edited = await casterApi(page, 'PUT', `designModules/${created.body.id}`, {
      designId: other,
      moduleId: blankMachine.id,
      name: 'Renamed_Machine',
      moduleVersion: 'v1.0.0',
      values: [{ name: 'vm_name', value: 'web02' }],
    });

    // expect: the name, version and value change, and it stays on its design
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ designId: home, name: 'Renamed_Machine', moduleVersion: 'v1.0.0' });
    expect((await casterApi<any[]>(page, 'GET', `designs/${other}/modules`)).body).toHaveLength(0);
    const { values } = (await casterApi(page, 'GET', `designModules/${created.body.id}`)).body;
    expect(values).toEqual([{ name: 'vm_name', value: 'web02' }]);
  });

  test('A File Belongs To Its Workspace Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectId = await seedCasterProject(page, `API File Scope Project ${Date.now()}`);
    cleanupCasterProject(projectId);
    const home = await seedCasterDirectory(page, projectId, 'Home');
    const other = await seedCasterDirectory(page, projectId, 'Other');
    const workspaceId = await seedCasterWorkspace(page, home, 'ws');

    // 1. Create a file in one directory for a workspace of another, in the same project
    const mismatched = await casterApi(page, 'POST', 'files', {
      name: 'vars.auto.tfvars',
      directoryId: other,
      workspaceId,
      content: '',
    });

    // expect: 409, even for an administrator, and no file
    expect(mismatched.status).toBe(409);
    expect(mismatched.body.title).toBe('File and Workspace must be in the same Directory');
    expect((await casterApi<any[]>(page, 'GET', `directories/${other}/files`)).body).toHaveLength(0);

    // 2. Create one for a workspace that doesn't exist
    const missing = await casterApi(page, 'POST', 'files', {
      name: 'vars.auto.tfvars',
      directoryId: other,
      workspaceId: '00000000-0000-0000-0000-000000000001',
      content: '',
    });

    // expect: 404 for the workspace
    expect(missing.status).toBe(404);
    expect(missing.body.title).toBe('Workspace not found');

    // 3. Create one for the workspace in its own directory
    const matched = await casterApi(page, 'POST', 'files', {
      name: 'vars.auto.tfvars',
      directoryId: home,
      workspaceId,
      content: '',
    });

    // expect: it is created in that workspace
    expect(matched.status).toBe(201);
    expect(matched.body).toMatchObject({ directoryId: home, workspaceId });
  });

  test('Tagging Versions Exactly The Requested Files', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectId = await seedCasterProject(page, `API Tag Project ${Date.now()}`);
    cleanupCasterProject(projectId);
    const directoryId = await seedCasterDirectory(page, projectId, 'Tagged');
    const first = await seedCasterFile(page, directoryId, 'a.tf', '# a\n');
    const second = await seedCasterFile(page, directoryId, 'b.tf', '# b\n');
    const tagged = async (fileId: string) =>
      (await casterApi<any[]>(page, 'GET', `files/${fileId}/versions`)).body.filter((v) => v.tag).map((v) => v.tag);

    // 1. Tag nothing, with an empty and with a missing list
    for (const body of [{ tag: 'empty', fileIds: [] }, { tag: 'empty' }]) {
      // expect: refused at authorization, since there is no file to authorize against
      expect((await casterApi(page, 'POST', 'files/actions/tag', body)).status).toBe(403);
    }

    // 2. Tag a batch where one file doesn't exist
    const partial = await casterApi(page, 'POST', 'files/actions/tag', {
      tag: 'partial',
      fileIds: [first, '00000000-0000-0000-0000-000000000009'],
    });

    // expect: 404, and the file that does exist gets no version either
    expect(partial.status).toBe(404);
    expect(await tagged(first)).toEqual([]);

    // 3. Tag one file, listing it twice
    const duplicate = await casterApi(page, 'POST', 'files/actions/tag', { tag: 'release-1', fileIds: [first, first] });

    // expect: one version, for that file only
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toHaveLength(1);
    expect(duplicate.body[0]).toMatchObject({ fileId: first, tag: 'release-1' });
    expect(await tagged(first)).toEqual(['release-1']);
    expect(await tagged(second)).toEqual([]);
  });
});
