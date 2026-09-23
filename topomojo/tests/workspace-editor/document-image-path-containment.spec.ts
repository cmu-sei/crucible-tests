// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md

/**
 * API-level containment checks for `DELETE /api/image/{id}?filename=`.
 *
 * This is deliberately not a UI test. The TopoMojo UI only ever sends a filename
 * it got back from `GET /api/images/{id}`, so driving the browser can exercise
 * the happy path but can never submit a traversing name. The attack is a
 * hand-built request, so the test has to be one too.
 *
 * Document storage puts a workspace's markdown at `<DocRoot>/<id>.md` and its
 * images in `<DocRoot>/<id>/`, which makes another workspace's document exactly
 * one `../` away from the image directory. Each case asserts that the target
 * survived, not merely that the API returned an error status — a status
 * assertion alone would also pass if the delete succeeded and then happened to
 * report a failure.
 *
 * Every traversal below aims at a file this spec created. That is a safety
 * requirement, not a stylistic choice: against a build without the containment
 * check these requests really do delete what they point at, and in a dev stack
 * `DocRoot` is `src/TopoMojo.Api/wwwroot/docs` inside a source tree the API
 * process owns. A deeper probe would delete real repository files. Depth beyond
 * one level, absolute paths, and the `..`-only cases are covered for free and
 * without side effects by PathGuardTests in the TopoMojo repo.
 *
 * The inverse test matters as much as the traversals: a guard that rejected
 * every name would satisfy them all while breaking image deletion entirely.
 */

import { test, expect } from '../../fixtures';
import {
  CreatedWorkspace,
  createWorkspace,
  deleteDocumentImage,
  deleteWorkspace,
  getTopoMojoAdminToken,
  listDocumentImages,
  loadWorkspaceDocument,
  saveWorkspaceDocument,
  uploadDocumentImage,
} from '../../../topomojo-helpers';

// 1x1 PNG. The endpoint does not inspect content, but a real image keeps the
// upload honest if validation is ever added.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Workspace Editor - document image path containment', () => {
  let token: string;
  let editable: CreatedWorkspace;
  let neighbor: CreatedWorkspace;
  let neighborDocument: string;

  test.beforeAll(async () => {
    token = await getTopoMojoAdminToken();

    const stamp = Date.now();
    editable = await createWorkspace(token, { name: `path-containment-editable-${stamp}` });
    neighbor = await createWorkspace(token, { name: `path-containment-neighbor-${stamp}` });

    // The document whose survival the traversal cases assert. Both workspaces
    // belong to the same account on purpose: the fault under test is directory
    // containment, not cross-account authorization, so a second Keycloak
    // identity would add setup without strengthening the assertion.
    neighborDocument = `neighbor document ${stamp}`;
    await saveWorkspaceDocument(token, neighbor.id, neighborDocument);

    // Give the editable workspace a real image so its image directory exists and
    // the traversal attempts start from the state a genuine delete would.
    await uploadDocumentImage(token, editable.id, 'diagram.png', PNG_1X1);
  });

  test.afterAll(async () => {
    // Deleting a workspace leaves <DocRoot>/<id>.md and <DocRoot>/<id>/ behind,
    // so the document artifacts have to be cleared separately. There is no
    // delete-document endpoint; blanking the markdown is the closest equivalent.
    if (editable) {
      for (const image of await listDocumentImages(token, editable.id)) {
        await deleteDocumentImage(token, editable.id, image);
      }
      await saveWorkspaceDocument(token, editable.id, '');
      await deleteWorkspace(token, editable.id);
    }
    if (neighbor) {
      await saveWorkspaceDocument(token, neighbor.id, '');
      await deleteWorkspace(token, neighbor.id);
    }
  });

  test('refuses a relative traversal and leaves the neighboring document intact', async () => {
    // One "../" escapes <DocRoot>/<editable>/ and lands on <DocRoot>/<neighbor>.md.
    const status = await deleteDocumentImage(token, editable.id, `../${neighbor.id}.md`);

    expect(status).toBe(400);
    expect(await loadWorkspaceDocument(token, neighbor.id)).toBe(neighborDocument);
  });

  test('refuses a traversal that re-enters through a sibling directory', async () => {
    // Resolves to the same neighboring document by a longer route, so a guard
    // that only string-matched a leading "../" would miss it.
    const status = await deleteDocumentImage(
      token,
      editable.id,
      `../${editable.id}/../${neighbor.id}.md`
    );

    expect(status).toBe(400);
    expect(await loadWorkspaceDocument(token, neighbor.id)).toBe(neighborDocument);
  });

  test('refuses a backslash-separated traversal', async () => {
    // A backslash is a legal filename character on Linux, so stripping invalid
    // filename characters leaves this name untouched. It is inert on Linux today
    // and pins the intent rather than a live escape.
    const status = await deleteDocumentImage(token, editable.id, `..\\${neighbor.id}.md`);

    expect(status).toBe(400);
    expect(await loadWorkspaceDocument(token, neighbor.id)).toBe(neighborDocument);
  });

  test('still deletes a genuine image in the workspace', async () => {
    const stored = await uploadDocumentImage(token, editable.id, 'removable.png', PNG_1X1);
    expect(await listDocumentImages(token, editable.id)).toContain(stored);

    expect(await deleteDocumentImage(token, editable.id, stored)).toBe(200);
    expect(await listDocumentImages(token, editable.id)).not.toContain(stored);
  });
});
