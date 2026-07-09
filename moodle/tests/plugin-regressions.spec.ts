// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/TODO-task-testing.md

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const modCruciblePath = process.env.MOD_CRUCIBLE_PATH || '/mnt/data/crucible/moodle/mod/crucible';

function readCrucibleFile(relativePath: string): string {
  return readFileSync(join(modCruciblePath, relativePath), 'utf8');
}

test.describe('Moodle plugin regression guards', () => {
  test('Crucible view blocks immediate relaunch while Alloy still has an active event', () => {
    const viewPhp = readCrucibleFile('view.php');

    const bindActiveEventIndex = viewPhp.indexOf('using active Alloy event without open Moodle attempt');
    const startRequestIndex = viewPhp.indexOf('start request received');

    expect(bindActiveEventIndex, 'view.php should bind active Alloy events even when Moodle has no open attempt').toBeGreaterThan(-1);
    expect(startRequestIndex, 'view.php should still handle start requests').toBeGreaterThan(-1);
    expect(bindActiveEventIndex, 'active Alloy event binding must happen before start request handling').toBeLessThan(startRequestIndex);

    expect(viewPhp).toContain('if (!$attempt && empty($object->event) && !empty($object->events))');
    expect(viewPhp).toContain('$object->event = end($activeevents);');
    expect(viewPhp).toContain('if (!$object->event) {');
    expect(viewPhp).toContain('start_event($object->userauth, $object->crucible->eventtemplateid)');
    expect(viewPhp).toContain('$object->is_ended()');
    expect(viewPhp).not.toContain('$object->isended()');
  });

  test('Crucible view script hides the workspace section outside the active state', () => {
    for (const relativePath of ['amd/src/view.js', 'amd/build/view.min.js']) {
      const script = readCrucibleFile(relativePath);

      expect(script).toContain("editStyle('crucible-workspace-section', 'display', 'none');");
      expect(script).toContain("editStyle('crucible-workspace-section', 'display', 'block');");

      const firstHideIndex = script.indexOf("editStyle('crucible-workspace-section', 'display', 'none');");
      const showActiveIndex = script.indexOf('function show_active()');
      const showWorkspaceIndex = script.indexOf("editStyle('crucible-workspace-section', 'display', 'block');");

      expect(firstHideIndex, `${relativePath} should hide the workspace before active rendering`).toBeGreaterThan(-1);
      expect(showActiveIndex, `${relativePath} should define show_active`).toBeGreaterThan(-1);
      expect(showWorkspaceIndex, `${relativePath} should show the workspace from show_active`).toBeGreaterThan(showActiveIndex);
    }
  });
});
