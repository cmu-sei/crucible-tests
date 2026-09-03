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
  test('Crucible bulk deploy launches Alloy events as the target student', () => {
    const launcherPhp = readCrucibleFile('classes/local/bulkdeploy/launcher.php');

    const guidLookupIndex = launcherPhp.indexOf('get_user_alloy_guid($user->id)');
    const startEventIndex = launcherPhp.indexOf('start_event($auth, $crucible->eventtemplateid, $useralloyguid, $userdisplayname)');
    const markLaunchedIndex = launcherPhp.indexOf('mark_launched_if_pending($rowid, $eventid)');
    const createAttemptIndex = launcherPhp.indexOf('$this->create_attempt_for_user($user->id, $crucible, $event)');
    const readyStatusIndex = launcherPhp.indexOf('set_user_status($rowid, user_status::READY)');

    expect(guidLookupIndex, 'bulk deploy should resolve the selected Moodle user to an Alloy GUID').toBeGreaterThan(-1);
    expect(startEventIndex, 'bulk deploy should pass the selected user Alloy GUID and display name into Alloy event creation').toBeGreaterThan(-1);
    expect(startEventIndex, 'target user identity must be resolved before creating the Alloy event').toBeGreaterThan(guidLookupIndex);
    expect(launcherPhp).toContain("User does not have Alloy GUID (not OAuth2 user)");
    expect(launcherPhp).toContain("Event $eventid created for user {$user->username}");
    expect(launcherPhp).not.toContain('start_event($auth, $crucible->eventtemplateid);');

    expect(markLaunchedIndex, 'bulk deploy should mark the row launched (conditional write) after the Alloy event is created').toBeGreaterThan(startEventIndex);
    expect(createAttemptIndex, 'bulk deploy should create the Moodle attempt after the row is launched').toBeGreaterThan(markLaunchedIndex);
    expect(readyStatusIndex, 'bulk deploy should mark the row ready only after the attempt is created, so a task interruption can be retried without losing it').toBeGreaterThan(createAttemptIndex);
    expect(launcherPhp).toContain('$attempt->userid = $userid;');
    expect(launcherPhp).toContain('$attempt->eventid = $event->id;');
  });

  test('Crucible bulk deploy end action finishes attempts before relaunch is allowed', () => {
    const actionPhp = readCrucibleFile('manage_deployments_action.php');
    const viewPhp = readCrucibleFile('view.php');

    const endCaseIndex = actionPhp.indexOf("case 'end_selected':");
    const inProgressLookupIndex = actionPhp.indexOf("'state' => 'inprogress'", endCaseIndex);
    const stopEventIndex = actionPhp.indexOf('stop_event($auth, $attempt->eventid)', endCaseIndex);
    const finishedIndex = actionPhp.indexOf("$attempt->state = 'finished';", endCaseIndex);
    const timeFinishIndex = actionPhp.indexOf('$attempt->timefinish = time();', endCaseIndex);
    const updateIndex = actionPhp.indexOf("$DB->update_record('crucible_attempts', $attempt);", endCaseIndex);

    expect(endCaseIndex, 'manage_deployments_action.php should handle end_selected').toBeGreaterThan(-1);
    expect(inProgressLookupIndex, 'end_selected should target only in-progress attempts').toBeGreaterThan(endCaseIndex);
    expect(stopEventIndex, 'end_selected should stop the backing Alloy event').toBeGreaterThan(inProgressLookupIndex);
    expect(finishedIndex, 'end_selected should mark the Moodle attempt finished').toBeGreaterThan(stopEventIndex);
    expect(timeFinishIndex, 'end_selected should record a finish time').toBeGreaterThan(finishedIndex);
    expect(updateIndex, 'end_selected should persist the finished attempt before returning').toBeGreaterThan(timeFinishIndex);

    const bindActiveEventIndex = viewPhp.indexOf('using active Alloy event without open Moodle attempt');
    const startRequestIndex = viewPhp.indexOf('start request received');
    const guardedStartIndex = viewPhp.indexOf('if (!$object->event) {', startRequestIndex);
    const startEventIndex = viewPhp.indexOf('start_event($object->userauth, $object->crucible->eventtemplateid)', startRequestIndex);

    expect(bindActiveEventIndex, 'view.php should bind active Alloy events before handling launch requests').toBeLessThan(startRequestIndex);
    expect(guardedStartIndex, 'view.php should gate relaunch on absence of an active Alloy event').toBeGreaterThan(startRequestIndex);
    expect(startEventIndex, 'view.php should create a new event only inside the no-active-event guard').toBeGreaterThan(guardedStartIndex);
  });

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
