// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * The demo learner account, and the course enrolment a learner-view test needs.
 *
 * The account is shared: it is the Keycloak user the `moodleDemoUserPage` fixture
 * logs in as, and every spec that checks what a student sees uses that same one. So
 * nothing here creates it, and an enrolment is put back only when it was made here.
 */

import { MoodleLabModule } from './db-helpers';
import { runMoodlePhp } from './cli-helpers';

/** The learner account, borrowed from Keycloak by the moodleDemoUserPage fixture. */
export const demoUsername = process.env.MOODLE_DEMO_USERNAME || 'demo-user';

/** A course the demo user was enrolled in here, so teardown can put it back. */
export type DemoUserEnrolment = { courseId: number; created: boolean };

/**
 * Resolves the Moodle account the demo Keycloak user maps to.
 *
 * The account is created by the identity provider on first login, so it only
 * exists once something has logged in as it. Every environment this suite runs
 * against has, and seeding one here would produce a second account with no
 * Keycloak credentials behind it.
 */
export function resolveMoodleDemoUserId(): number {
  const output = runMoodlePhp(
    `$user = $DB->get_record_select('user', 'deleted = 0 AND (username = ? OR username LIKE ?)',`
    + ` ['${demoUsername}', '${demoUsername}@%'], 'id', IGNORE_MULTIPLE);`
    + ` echo $user ? $user->id : '';`
  );
  const userId = Number(output);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      `No Moodle account for the demo Keycloak user "${demoUsername}". `
      + 'It is created on first login, so log in as it once and re-run.'
    );
  }
  return userId;
}

/**
 * Enrols the demo user as a student in the course an activity belongs to.
 *
 * An unenrolled user never reaches the activity — Moodle sends them to the
 * enrolment page instead, so a test that meant to assert what the activity shows a
 * student ends up asserting that page. Enrolment goes through
 * `enrol_try_internal_enrol()` rather than an INSERT so the role assignment that
 * carries the learner capabilities comes with it.
 *
 * Reports whether the enrolment was created here: the demo account is shared, so
 * an enrolment it already had is left alone.
 */
export function enrolMoodleDemoUser(modname: MoodleLabModule, cmid: number, userId: number): DemoUserEnrolment {
  const output = runMoodlePhp(
    `require_once($CFG->libdir . '/enrollib.php');`
    + ` $cm = get_coursemodule_from_id('${modname}', ${cmid}, 0, false, MUST_EXIST);`
    + ` $context = context_course::instance($cm->course);`
    + ` if (is_enrolled($context, ${userId})) { echo 'already:' . $cm->course; exit; }`
    + ` $role = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);`
    + ` enrol_try_internal_enrol($cm->course, ${userId}, $role->id);`
    + ` echo (is_enrolled($context, ${userId}) ? 'enrolled' : 'failed') . ':' . $cm->course;`
  );

  const [state, courseId] = output.trim().split(':');
  if (state === 'failed') {
    throw new Error(`Could not enrol ${demoUsername} in the course holding ${modname} activity ${cmid}.`);
  }
  return { courseId: Number(courseId), created: state === 'enrolled' };
}

/** Reverses `enrolMoodleDemoUser`, including the role assignment it made. */
export function unenrolMoodleDemoUser(enrolment: DemoUserEnrolment, userId: number): void {
  if (!enrolment.created) {
    return;
  }
  runMoodlePhp(
    `require_once($CFG->libdir . '/enrollib.php');`
    + ` $manual = enrol_get_plugin('manual');`
    + ` foreach (enrol_get_instances(${enrolment.courseId}, true) as $instance) {`
    + ` if ($instance->enrol === 'manual') { $manual->unenrol_user($instance, ${userId}); } }`
  );
}
