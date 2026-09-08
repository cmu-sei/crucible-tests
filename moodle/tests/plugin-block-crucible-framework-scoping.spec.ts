// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/TODO-task-testing.md
//
// Regression guards for block_crucible competency-framework scoping. Multiple
// competency frameworks can be active at once (NICE, DCWF, MITRE ATT&CK) and can
// share a competency idnumber (e.g. ATT&CK T1005 vs NICE T1005). Every place the
// block resolves, links, or renders a competency must be framework-aware, or the
// wrong framework's competency surfaces. These guards fail if any of the scoping
// behaviours is removed:
//   1. Learning-plan template view filters competencies by the selected framework
//      (MoodleMDL-138 — duplicate/foreign TSKs).
//   2. Learning-plan "Open my plan" stays in the framework-scoped block view instead
//      of the core plan page, which spans all frameworks (self-enrol leak).
//   3. Competency detail links carry the framework id so a shared idnumber resolves
//      to the competency the user clicked.
//   4. A bare/ambiguous idnumber renders a per-framework grouped view instead of
//      silently resolving one arbitrary competency.
//   5. The framework link in that view is gated on the viewer's capability.
//   6. The unmapped-framework page is dark-theme capable (no hardcoded light colors).
//   7. Competency pages use their own subject as the heading, not the site name.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const blockCruciblePath = process.env.BLOCK_CRUCIBLE_PATH || '/mnt/data/crucible/moodle/blocks/crucible';

function readBlockFile(relativePath: string): string {
  return readFileSync(join(blockCruciblePath, relativePath), 'utf8');
}

test.describe('block_crucible framework scoping regression guards (MoodleMDL-138)', () => {
  test('learning-plan template view filters competencies by the selected framework', () => {
    const learningplans = readBlockFile('classes/learningplans.php');

    const guardIndex = learningplans.indexOf('if ($frameworkid > 0) {');
    const fwsqlIndex = learningplans.indexOf("$fwsql = ' AND c.competencyframeworkid = :fwid ';");
    const bindIndex = learningplans.indexOf("$params['fwid'] = $frameworkid;");
    const templateWhereIndex = learningplans.indexOf('WHERE tc.templateid = :tid');
    const fwsqlUseIndex = learningplans.indexOf('$fwsql', templateWhereIndex);

    expect(guardIndex, 'get_template_view_data should branch on a selected framework').toBeGreaterThan(-1);
    expect(fwsqlIndex, 'a framework predicate must be built when a framework is selected').toBeGreaterThan(guardIndex);
    expect(bindIndex, 'the framework id must be bound as the :fwid parameter').toBeGreaterThan(guardIndex);
    expect(fwsqlUseIndex, 'the framework predicate must be interpolated into the template query WHERE clause')
      .toBeGreaterThan(templateWhereIndex);
  });

  test('learning-plan "Open my plan" stays framework-scoped and avoids the core plan when a framework is set', () => {
    const templatePhp = readBlockFile('template.php');

    // When a framework filter is active, the plan link must stay in the block view;
    // the core plan page (/admin/tool/lp/plan.php) mirrors the whole multi-framework template.
    const guardIndex = templatePhp.indexOf('if ($fwid > 0) {');
    const blockPlanIndex = templatePhp.indexOf(
      "$data->planurl = (new moodle_url('/blocks/crucible/template.php'", guardIndex);
    const corePlanIndex = templatePhp.indexOf("(new moodle_url('/admin/tool/lp/plan.php'");

    expect(guardIndex, 'template.php should branch the plan link on a selected framework').toBeGreaterThan(-1);
    expect(blockPlanIndex, 'framework-selected plan link should stay in the block template view')
      .toBeGreaterThan(guardIndex);
    expect(corePlanIndex, 'core plan link should still exist for the no-framework case').toBeGreaterThan(-1);
    // The block-scoped link must come first (inside the framework guard), the core link after (else branch).
    expect(blockPlanIndex, 'block-scoped plan link must precede the core plan fallback').toBeLessThan(corePlanIndex);
  });

  test('competency detail links carry the framework id to disambiguate shared idnumbers', () => {
    const competencies = readBlockFile('classes/competencies.php');

    // Mapped list (list_mapped_via_api): conditionally attach fwid when the competency has a framework.
    const mappedParamsIndex = competencies.indexOf("$detailparams = ['idnumber' => $idnumber];");
    const mappedFwidIndex = competencies.indexOf("$detailparams['fwid'] = (int)$fwid;", mappedParamsIndex);

    // Unmapped list (get_unmapped_for_framework): the framework id is always known.
    const unmappedParamsIndex = competencies.indexOf("$detailparams = ['idnumber' => $idnumber, 'fwid' => $fwid];");

    // Neither builder should link by idnumber alone anymore.
    const bareLink = competencies.indexOf("competency.php', ['idnumber' => $idnumber])");

    expect(mappedParamsIndex, 'mapped detail link should build a params array').toBeGreaterThan(-1);
    expect(mappedFwidIndex, 'mapped detail link should attach fwid when the competency has a framework')
      .toBeGreaterThan(mappedParamsIndex);
    expect(unmappedParamsIndex, 'unmapped detail link should include fwid').toBeGreaterThan(-1);
    expect(bareLink, 'no competency detail link should use idnumber without a framework').toBe(-1);
  });

  test('an ambiguous idnumber renders a per-framework grouped view instead of resolving one', () => {
    const competencies = readBlockFile('classes/competencies.php');
    const competencyPhp = readBlockFile('competency.php');

    // Service can enumerate every framework that carries a given idnumber.
    expect(competencies.indexOf('public function get_idnumber_matches('),
      'competencies service should expose get_idnumber_matches').toBeGreaterThan(-1);

    // The page branches on >1 match and renders the grouped disambiguation template.
    const matchesIndex = competencyPhp.indexOf('$svc->get_idnumber_matches($idnumber)');
    const countGuardIndex = competencyPhp.indexOf('if (count($matches) > 1) {', matchesIndex);
    const templateIndex = competencyPhp.indexOf("'block_crucible/competency_disambiguation'", countGuardIndex);

    expect(matchesIndex, 'competency.php should look up all frameworks for the idnumber').toBeGreaterThan(-1);
    expect(countGuardIndex, 'competency.php should branch when the idnumber is ambiguous').toBeGreaterThan(matchesIndex);
    expect(templateIndex, 'the ambiguous case should render the grouped disambiguation template')
      .toBeGreaterThan(countGuardIndex);
  });

  test('the framework link in the multi-framework view is gated on the viewer capability', () => {
    const competencies = readBlockFile('classes/competencies.php');

    // frameworkurl defaults empty and is only set to the core framework page when the
    // user can read the framework context (same check the core page enforces).
    const defaultEmptyIndex = competencies.indexOf("$frameworkurl = '';");
    const capIndex = competencies.indexOf('competency_framework::can_read_context($fwcontext)');
    const coreFwPageIndex = competencies.indexOf("'/admin/tool/lp/competencies.php'", capIndex);

    expect(defaultEmptyIndex, 'frameworkurl should default to empty (no link)').toBeGreaterThan(-1);
    expect(capIndex, 'the framework link should be gated on can_read_context').toBeGreaterThan(-1);
    expect(coreFwPageIndex, 'the framework link should target the core framework page only after the capability check')
      .toBeGreaterThan(capIndex);
  });

  test('the unmapped-framework page is dark-theme capable (no hardcoded light colors)', () => {
    const tpl = readBlockFile('templates/framework_unmapped.mustache');

    expect(tpl.indexOf('crucible-card__body'), 'unmapped-framework page should use the shared card classes')
      .toBeGreaterThan(-1);
    // Dark theme is driven by [data-bs-theme="dark"] overrides on those classes, so the
    // template must not pin light colors inline.
    expect(/background:\s*#fff/i.test(tpl), 'should not hardcode a white background').toBe(false);
    expect(/color:\s*#[0-9a-f]{3,6}/i.test(tpl), 'should not hardcode text colors').toBe(false);
  });

  test('competency pages use the page subject as the heading, not the site name', () => {
    const competencyPhp = readBlockFile('competency.php');

    expect(competencyPhp.indexOf('set_heading(format_string($SITE->fullname))'),
      'competency pages should not use the site full name as the heading').toBe(-1);
    expect(competencyPhp.indexOf('$PAGE->set_heading($data->name);'),
      'the detail page heading should be the competency name').toBeGreaterThan(-1);
  });
});
