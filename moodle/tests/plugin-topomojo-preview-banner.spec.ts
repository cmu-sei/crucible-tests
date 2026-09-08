// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md
//
// Regression guard for the mod_topomojo preview-banner bug (item 8). The activity
// page (view.php) and challenge page (challenge.php) used to print the "preview
// mode - this attempt will not be recorded" banner whenever $ispreview == 1, which
// on a GET comes straight from a bare ?preview=1 URL param. With no attempt open,
// the start form's Launch Lab button still posts preview=0 and creates a regular,
// GRADED attempt - so an instructor who trusted the banner left real attempt rows
// behind (freezes question re-import, lands in the gradebook). The fix gates the
// banner on an actual preview attempt or live gamespace being resolved
// ($ispreview == 1 && ($activeattempt || !empty($object->event))). These guards
// fail if either banner reverts to the bare $ispreview == 1 check.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const modTopomojoPath = process.env.MOD_TOPOMOJO_PATH || '/mnt/data/crucible/moodle/mod/topomojo';

function readPluginFile(relativePath: string): string {
  return readFileSync(join(modTopomojoPath, relativePath), 'utf8');
}

// The banner call the guards protect. Kept as a single normalized string so the
// assertions are resilient to whitespace/formatting differences.
const BANNER_CALL = "get_string('previewmode', 'mod_topomojo')";

// The gate that must precede the banner so it only shows for a real preview.
const GATE = /\$ispreview\s*==\s*1\s*&&\s*\(\s*\$activeattempt\s*\|\|\s*!empty\(\$object->event\)\s*\)/;

// A bare `if ($ispreview == 1)` immediately followed by the banner is the bug.
const BARE_GUARD = /if\s*\(\s*\$ispreview\s*==\s*1\s*\)\s*\{[^}]*get_string\('previewmode'/;

test.describe('mod_topomojo preview-banner regression guards (item 8)', () => {
  test('view.php gates the preview banner on a resolved preview attempt or gamespace', () => {
    const viewphp = readPluginFile('view.php');

    expect(viewphp.includes(BANNER_CALL), 'view.php should still print a preview-mode banner').toBe(true);
    expect(GATE.test(viewphp), 'the preview banner must be gated on ($activeattempt || !empty($object->event))').toBe(true);
    expect(BARE_GUARD.test(viewphp), 'the preview banner must NOT fire on a bare `if ($ispreview == 1)`').toBe(false);
  });

  test('challenge.php gates the preview banner on a resolved preview attempt or gamespace', () => {
    const challengephp = readPluginFile('challenge.php');

    expect(challengephp.includes(BANNER_CALL), 'challenge.php should still print a preview-mode banner').toBe(true);
    expect(GATE.test(challengephp), 'the preview banner must be gated on ($activeattempt || !empty($object->event))').toBe(true);
    expect(BARE_GUARD.test(challengephp), 'the preview banner must NOT fire on a bare `if ($ispreview == 1)`').toBe(false);
  });

  test('the start form still defaults the preview field to 0 (Launch Lab creates a graded attempt)', () => {
    const startform = readPluginFile('templates/startform.mustache');

    // The bug is only misleading because Launch Lab posts preview=0. That default is
    // intentional (Preview Lab is the JS-driven preview path); assert it stays put so
    // a future change to the banner gate is reasoned about against the real form state.
    expect(
      /name="preview"\s+value="0"/.test(startform),
      'the hidden preview field must default to 0 so Launch Lab creates a graded attempt'
    ).toBe(true);
    expect(
      startform.includes("previewField.value = '1'"),
      'the Preview Lab button must remain the explicit path that opts into a preview attempt'
    ).toBe(true);
  });
});
