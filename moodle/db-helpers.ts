// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Minimal Moodle database fixture support for tests that need an enrolled
 * participant but must not alter a shared user account.
 */

import { execSync } from 'child_process';
import { Client } from 'pg';

let postgresPassword: string | undefined;

function getPostgresPassword(): string {
  if (postgresPassword) {
    return postgresPassword;
  }

  if (process.env.CRUCIBLE_POSTGRES_PASSWORD) {
    postgresPassword = process.env.CRUCIBLE_POSTGRES_PASSWORD;
    return postgresPassword;
  }

  const output = execSync(
    `docker inspect crucible-postgres --format='{{range .Config.Env}}{{println .}}{{end}}'`,
    { encoding: 'utf8' }
  );
  const passwordLine = output.split('\n').find(line => line.startsWith('POSTGRES_PASSWORD='));
  if (!passwordLine) {
    throw new Error('POSTGRES_PASSWORD is not configured on the crucible-postgres container.');
  }

  postgresPassword = passwordLine.substring('POSTGRES_PASSWORD='.length);
  return postgresPassword;
}

let postgresPort: number | undefined;

/**
 * Resolves the host port Postgres is published on.
 *
 * Aspire assigns the host side of the mapping at startup, so it is not 5432 and
 * changes between runs of the AppHost. `docker port` reports whatever it is now.
 */
function getPostgresPort(): number {
  if (postgresPort) {
    return postgresPort;
  }

  if (process.env.CRUCIBLE_POSTGRES_PORT) {
    postgresPort = Number(process.env.CRUCIBLE_POSTGRES_PORT);
    return postgresPort;
  }

  const output = execSync('docker port crucible-postgres 5432/tcp', { encoding: 'utf8' });
  // One line per published address, e.g. "127.0.0.1:16272".
  const match = output.split('\n').map(line => line.trim()).find(line => /:\d+$/.test(line));
  if (!match) {
    throw new Error(`Could not determine the published Postgres port from: ${output.trim()}`);
  }

  postgresPort = Number(match.slice(match.lastIndexOf(':') + 1));
  return postgresPort;
}

export async function connectMoodleDatabase(): Promise<Client> {
  const client = new Client({
    // 127.0.0.1 rather than localhost: the mapping is published on the IPv4
    // loopback only, and localhost resolves to ::1 first here.
    host: process.env.CRUCIBLE_POSTGRES_HOST || '127.0.0.1',
    port: getPostgresPort(),
    user: 'postgres',
    password: getPostgresPassword(),
    database: 'moodle',
  });
  await client.connect();
  return client;
}

export interface MoodleCrucibleParticipant {
  userId: number;
  username: string;
  displayName: string;
  crucibleId: number;
}

/**
 * Creates a disposable, manually-enrolled student for the course containing a
 * Crucible activity. The participant is never used to log in or deploy a lab;
 * it exists only as an isolated table row for manage-deployments UI tests.
 */
export async function seedMoodleCrucibleParticipant(cmid: string): Promise<MoodleCrucibleParticipant> {
  const client = await connectMoodleDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const username = `__e2e_crucible_schedule_${suffix}`;
  const displayName = `E2E Schedule ${suffix}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const activity = await client.query<{ courseid: number; crucibleid: number }>(
      `SELECT cm.course AS courseid, crucible.id AS crucibleid
         FROM mdl_course_modules cm
         JOIN mdl_modules module ON module.id = cm.module AND module.name = 'crucible'
         JOIN mdl_crucible crucible ON crucible.id = cm.instance
        WHERE cm.id = $1`,
      [Number(cmid)]
    );
    if (activity.rowCount !== 1) {
      throw new Error(`Could not find Crucible activity course module ${cmid}.`);
    }

    const { courseid, crucibleid } = activity.rows[0];
    const enrolment = await client.query<{ id: number }>(
      `SELECT id
         FROM mdl_enrol
        WHERE courseid = $1 AND enrol = 'manual' AND status = 0
        ORDER BY id
        LIMIT 1`,
      [courseid]
    );
    if (enrolment.rowCount !== 1) {
      throw new Error(`Course ${courseid} has no enabled manual enrolment method.`);
    }

    const user = await client.query<{ id: number }>(
      `INSERT INTO mdl_user (
         auth, confirmed, policyagreed, deleted, suspended, mnethostid,
         username, password, idnumber, firstname, lastname, email,
         timecreated, timemodified
       ) VALUES (
         'manual', 1, 0, 0, 0, 1,
         $1, '', '', 'E2E', $2, $3,
         $4, $4
       )
       RETURNING id`,
      [username, displayName, `${username}@example.invalid`, now]
    );
    // pg hands bigint back as a string; coerced here so the returned ids compare
    // as numbers against ids read from other queries.
    const userId = Number(user.rows[0].id);

    await client.query(
      `INSERT INTO mdl_user_enrolments (
         status, enrolid, userid, timestart, timeend, modifierid, timecreated, timemodified
       ) VALUES (0, $1, $2, 0, 2147483647, 0, $3, $3)`,
      [enrolment.rows[0].id, userId, now]
    );

    return { userId, username, displayName, crucibleId: Number(crucibleid) };
  } finally {
    await client.end();
  }
}

/**
 * Removes every record created for a disposable participant, including any
 * queued bulk-deployment task the UI may have created before a test failed.
 */
export async function cleanupMoodleCrucibleParticipant(
  participant: MoodleCrucibleParticipant | undefined
): Promise<void> {
  if (!participant) {
    return;
  }

  const client = await connectMoodleDatabase();
  try {
    const jobs = await client.query<{ id: number }>(
      `SELECT DISTINCT job.id
         FROM mdl_crucible_bulkdeploy_job job
         JOIN mdl_crucible_bulkdeploy_user deployment ON deployment.jobid = job.id
        WHERE job.crucibleid = $1 AND deployment.userid = $2`,
      [participant.crucibleId, participant.userId]
    );

    for (const job of jobs.rows) {
      await client.query(
        `DELETE FROM mdl_task_adhoc
          WHERE component = 'mod_crucible'
            AND classname = '\\mod_crucible\\task\\bulkdeploy_run'
            AND customdata LIKE $1`,
        [`%"jobid":${job.id}%`]
      );
    }

    await client.query(`DELETE FROM mdl_crucible_bulkdeploy_user WHERE userid = $1`, [participant.userId]);
    for (const job of jobs.rows) {
      await client.query(
        `DELETE FROM mdl_crucible_bulkdeploy_job
          WHERE id = $1
            AND NOT EXISTS (
              SELECT 1 FROM mdl_crucible_bulkdeploy_user WHERE jobid = $1
            )`,
        [job.id]
      );
    }

    await client.query(`DELETE FROM mdl_crucible_attempts WHERE userid = $1`, [participant.userId]);
    await client.query(`DELETE FROM mdl_user_enrolments WHERE userid = $1`, [participant.userId]);
    await client.query(`DELETE FROM mdl_user WHERE id = $1 AND username = $2`, [
      participant.userId,
      participant.username,
    ]);
  } finally {
    await client.end();
  }
}

export interface MoodleTopomojoActivity {
  cmid: number;
  instanceId: number;
  courseId: number;
  name: string;
  workspaceId: string;
  /** Point maximum for the activity, mirrored onto the gradebook item. */
  grade: number;
  /** Attempt window in seconds; 0 means no limit was requested. */
  duration: number;
  /** 1-based in Moodle; 0 asks TopoMojo to pick at random. */
  variant: number;
  questionorder: string | null;
}

/** Reads the activity record behind a TopoMojo course module. */
export async function getMoodleTopomojoActivity(cmid: string | number): Promise<MoodleTopomojoActivity> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query(
      `SELECT cm.id AS cmid, t.id AS instanceid, cm.course AS courseid, t.name,
              t.workspaceid, t.grade, t.duration, t.variant, t.questionorder
         FROM mdl_course_modules cm
         JOIN mdl_modules m ON m.id = cm.module AND m.name = 'topomojo'
         JOIN mdl_topomojo t ON t.id = cm.instance
        WHERE cm.id = $1`,
      [Number(cmid)]
    );
    if (result.rowCount !== 1) {
      throw new Error(`Could not find TopoMojo activity course module ${cmid}.`);
    }
    const row = result.rows[0];
    return {
      cmid: Number(row.cmid),
      instanceId: Number(row.instanceid),
      courseId: Number(row.courseid),
      name: row.name,
      workspaceId: row.workspaceid,
      grade: Number(row.grade),
      duration: Number(row.duration),
      variant: Number(row.variant),
      questionorder: row.questionorder,
    };
  } finally {
    await client.end();
  }
}

export interface MoodleTopomojoParticipant {
  userId: number;
  username: string;
  displayName: string;
  email: string;
  topomojoId: number;
}

/**
 * The longest email local part a participant can be given.
 *
 * `payload_builder::build()` sends the part of the address before the `@` as the
 * gamespace player's `subjectId`, and TopoMojo stores that in a `varchar(36)`
 * column. A longer one makes the gamespace POST fail with an opaque
 * `HTTP 500: {"message":"Error"}`, so seeded addresses are deliberately short and
 * must stay that way — matching the (longer) username would break every deploy.
 */
export const TOPOMOJO_SUBJECT_ID_MAX_LENGTH = 36;

/**
 * Creates disposable, manually-enrolled participants for the course containing a
 * TopoMojo activity. `manage.php` lists every enrolled user regardless of role
 * (`get_enrolled_users` with no capability filter), so an enrolment row is all
 * that is needed to make a row appear.
 *
 * These accounts are never logged in with — Moodle authenticates through
 * Keycloak, and a DB-seeded user has no identity-provider credentials. They
 * exist to be selected and bulk-deployed to from an admin session.
 *
 * Each participant gets a real email address, because a user without one is
 * skipped by `launcher::launch_phase()` before any gamespace is requested, and a
 * deliberately short one — see `TOPOMOJO_SUBJECT_ID_MAX_LENGTH`.
 *
 * `emailLocalPartLength` overrides that, for tests about the limit itself.
 */
export async function seedMoodleTopomojoParticipants(
  cmid: string | number,
  count: number = 2,
  emailLocalPartLength?: number
): Promise<MoodleTopomojoParticipant[]> {
  const activity = await getMoodleTopomojoActivity(cmid);
  const client = await connectMoodleDatabase();
  const now = Math.floor(Date.now() / 1000);

  try {
    const enrolment = await client.query<{ id: number }>(
      `SELECT id
         FROM mdl_enrol
        WHERE courseid = $1 AND enrol = 'manual' AND status = 0
        ORDER BY id
        LIMIT 1`,
      [activity.courseId]
    );
    if (enrolment.rowCount !== 1) {
      throw new Error(`Course ${activity.courseId} has no enabled manual enrolment method.`);
    }

    const participants: MoodleTopomojoParticipant[] = [];
    for (let index = 0; index < count; index++) {
      const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const username = `__e2e_topomojo_${suffix}`;
      const lastname = `Deploy${index + 1}`;

      // The address is not the username: the username carries the prefix cleanup
      // is guarded on and is far too long to survive as a subject id, so the local
      // part is built separately and padded only when a test asks for a specific
      // length.
      let localpart = `e2etm${Date.now().toString(36)}${index}`;
      if (emailLocalPartLength !== undefined) {
        localpart = localpart.padEnd(emailLocalPartLength, 'x').slice(0, emailLocalPartLength);
      }
      const email = `${localpart}@example.invalid`;

      const user = await client.query<{ id: number }>(
        `INSERT INTO mdl_user (
           auth, confirmed, policyagreed, deleted, suspended, mnethostid,
           username, password, idnumber, firstname, lastname, email,
           timecreated, timemodified
         ) VALUES (
           'manual', 1, 0, 0, 0, 1,
           $1, '', '', 'E2E', $2, $3,
           $4, $4
         )
         RETURNING id`,
        [username, lastname, email, now]
      );
      // pg hands bigint back as a string, and callers match this against ids read
      // from other queries, so coerce it here rather than at every comparison.
      const userId = Number(user.rows[0].id);

      await client.query(
        `INSERT INTO mdl_user_enrolments (
           status, enrolid, userid, timestart, timeend, modifierid, timecreated, timemodified
         ) VALUES (0, $1, $2, 0, 2147483647, 0, $3, $3)`,
        [enrolment.rows[0].id, userId, now]
      );

      participants.push({
        userId,
        username,
        displayName: `E2E ${lastname}`,
        email,
        topomojoId: activity.instanceId,
      });
    }
    return participants;
  } finally {
    await client.end();
  }
}

export interface MoodleTopomojoAttempt {
  id: number;
  userId: number;
  state: string;
  score: number | null;
  eventId: string | null;
  launchpointUrl: string | null;
  endtime: number;
  timestart: number;
  questionUsageId: number;
  variant: number;
}

/** Reads every attempt on an activity, newest first. */
export async function getMoodleTopomojoAttempts(
  topomojoId: number,
  userIds?: number[]
): Promise<MoodleTopomojoAttempt[]> {
  const client = await connectMoodleDatabase();
  try {
    const filtered = userIds && userIds.length > 0;
    const result = await client.query(
      `SELECT id, userid, state, score, eventid, launchpointurl, endtime,
              timestart, questionusageid, variant
         FROM mdl_topomojo_attempts
        WHERE topomojoid = $1
          ${filtered ? 'AND userid = ANY($2::bigint[])' : ''}
        ORDER BY id DESC`,
      filtered ? [topomojoId, userIds] : [topomojoId]
    );
    return result.rows.map(row => ({
      id: Number(row.id),
      userId: Number(row.userid),
      state: row.state,
      score: row.score === null ? null : Number(row.score),
      eventId: row.eventid,
      launchpointUrl: row.launchpointurl,
      endtime: Number(row.endtime),
      timestart: Number(row.timestart),
      questionUsageId: Number(row.questionusageid),
      variant: Number(row.variant),
    }));
  } finally {
    await client.end();
  }
}

export interface MoodleTopomojoDeployment {
  userId: number;
  jobId: number;
  /** `launched`, `ready`, `failed`, `skipped`, … as the launcher recorded it. */
  status: string;
  gamespaceId: string | null;
  errorMessage: string | null;
}

/**
 * Reads the per-user rows a bulk deploy job writes.
 *
 * The launcher records why an individual user did not get a lab here — a skipped
 * user, a TopoMojo HTTP error, a timeout — and then lets the job complete
 * successfully anyway, so this is the only place a partial failure is visible.
 */
export async function getMoodleTopomojoDeployments(
  topomojoIds: number[],
  userIds: number[]
): Promise<MoodleTopomojoDeployment[]> {
  if (topomojoIds.length === 0 || userIds.length === 0) {
    return [];
  }

  const client = await connectMoodleDatabase();
  try {
    const result = await client.query(
      `SELECT deployment.userid, deployment.jobid, deployment.status,
              deployment.gamespaceid, deployment.errormessage
         FROM mdl_topomojo_bulkdeploy_user deployment
         JOIN mdl_topomojo_bulkdeploy_job job ON job.id = deployment.jobid
        WHERE job.topomojoid = ANY($1::bigint[]) AND deployment.userid = ANY($2::bigint[])
        ORDER BY deployment.id`,
      [topomojoIds, userIds]
    );
    return result.rows.map(row => ({
      userId: Number(row.userid),
      jobId: Number(row.jobid),
      status: row.status,
      gamespaceId: row.gamespaceid,
      errorMessage: row.errormessage,
    }));
  } finally {
    await client.end();
  }
}

export interface MoodleGradeItem {
  id: number;
  itemName: string | null;
  /** 1 = GRADE_TYPE_VALUE, 0 = GRADE_TYPE_NONE. */
  gradeType: number;
  gradeMax: number;
  gradeMin: number;
}

/**
 * Reads the gradebook item Moodle created for a TopoMojo activity instance, or
 * null when `topomojo_grade_item_update()` never managed to create one.
 */
export async function getMoodleTopomojoGradeItem(
  courseId: number,
  instanceId: number
): Promise<MoodleGradeItem | null> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query(
      `SELECT id, itemname, gradetype, grademax, grademin
         FROM mdl_grade_items
        WHERE courseid = $1
          AND itemtype = 'mod'
          AND itemmodule = 'topomojo'
          AND iteminstance = $2
          AND itemnumber = 0`,
      [courseId, instanceId]
    );
    if (result.rowCount === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      id: Number(row.id),
      itemName: row.itemname,
      gradeType: Number(row.gradetype),
      gradeMax: Number(row.grademax),
      gradeMin: Number(row.grademin),
    };
  } finally {
    await client.end();
  }
}

/**
 * Removes the deployment trail a bulk deploy leaves for a set of users: their
 * attempts and question usages, bulk-deploy rows, any adhoc task still queued for
 * a job of theirs, and their grades on the activity. The user accounts and their
 * enrolments are left alone, so this is safe to run against a shared account that
 * a test borrowed rather than created.
 *
 * Gamespaces the deploy created are NOT released here — the caller holds the
 * TopoMojo token and must delete them, otherwise real VMs are left running. The
 * returned gamespace ids are the ones this cleanup found, so a caller that lost
 * track of them can still tear them down.
 */
export async function cleanupMoodleTopomojoDeployments(
  topomojoIds: number[],
  userIds: number[]
): Promise<string[]> {
  if (topomojoIds.length === 0 || userIds.length === 0) {
    return [];
  }

  const client = await connectMoodleDatabase();
  try {
    const gamespaces = await client.query<{ gamespaceid: string | null }>(
      `SELECT gamespaceid FROM mdl_topomojo_bulkdeploy_user
        WHERE userid = ANY($1::bigint[]) AND gamespaceid IS NOT NULL
        UNION
       SELECT eventid FROM mdl_topomojo_attempts
        WHERE topomojoid = ANY($2::bigint[]) AND userid = ANY($1::bigint[]) AND eventid IS NOT NULL`,
      [userIds, topomojoIds]
    );

    const jobs = await client.query<{ id: number }>(
      `SELECT DISTINCT job.id
         FROM mdl_topomojo_bulkdeploy_job job
         JOIN mdl_topomojo_bulkdeploy_user deployment ON deployment.jobid = job.id
        WHERE job.topomojoid = ANY($1::bigint[]) AND deployment.userid = ANY($2::bigint[])`,
      [topomojoIds, userIds]
    );

    for (const job of jobs.rows) {
      await client.query(
        `DELETE FROM mdl_task_adhoc
          WHERE component = 'mod_topomojo'
            AND classname = '\\mod_topomojo\\task\\bulkdeploy_run'
            AND customdata LIKE $1`,
        [`%"jobid":${job.id}%`]
      );
    }

    if (jobs.rowCount && jobs.rowCount > 0) {
      await client.query(
        `DELETE FROM mdl_topomojo_bulkdeploy_user
          WHERE userid = ANY($1::bigint[]) AND jobid = ANY($2::bigint[])`,
        [userIds, jobs.rows.map(job => job.id)]
      );
    }
    for (const job of jobs.rows) {
      await client.query(
        `DELETE FROM mdl_topomojo_bulkdeploy_job
          WHERE id = $1
            AND NOT EXISTS (
              SELECT 1 FROM mdl_topomojo_bulkdeploy_user WHERE jobid = $1
            )`,
        [job.id]
      );
    }

    // Question usages are shared plumbing, so drop them by the ids the attempts
    // point at rather than by owner. A bulk-deployed attempt has usage id 0,
    // which matches nothing and is skipped.
    const usages = await client.query<{ questionusageid: string }>(
      `SELECT DISTINCT questionusageid
         FROM mdl_topomojo_attempts
        WHERE topomojoid = ANY($1::bigint[]) AND userid = ANY($2::bigint[]) AND questionusageid > 0`,
      [topomojoIds, userIds]
    );
    const usageIds = usages.rows.map(row => Number(row.questionusageid));
    if (usageIds.length > 0) {
      await client.query(
        `DELETE FROM mdl_question_attempt_step_data WHERE attemptstepid IN (
           SELECT qas.id FROM mdl_question_attempt_steps qas
             JOIN mdl_question_attempts qa ON qa.id = qas.questionattemptid
            WHERE qa.questionusageid = ANY($1::bigint[])
         )`,
        [usageIds]
      );
      await client.query(
        `DELETE FROM mdl_question_attempt_steps WHERE questionattemptid IN (
           SELECT id FROM mdl_question_attempts WHERE questionusageid = ANY($1::bigint[])
         )`,
        [usageIds]
      );
      await client.query(`DELETE FROM mdl_question_attempts WHERE questionusageid = ANY($1::bigint[])`, [usageIds]);
      await client.query(`DELETE FROM mdl_question_usages WHERE id = ANY($1::bigint[])`, [usageIds]);
    }

    await client.query(
      `DELETE FROM mdl_topomojo_attempts WHERE topomojoid = ANY($1::bigint[]) AND userid = ANY($2::bigint[])`,
      [topomojoIds, userIds]
    );
    await client.query(
      `DELETE FROM mdl_topomojo_grades WHERE topomojoid = ANY($1::bigint[]) AND userid = ANY($2::bigint[])`,
      [topomojoIds, userIds]
    );
    await client.query(
      `DELETE FROM mdl_grade_grades
        WHERE userid = ANY($1::bigint[])
          AND itemid IN (
            SELECT id FROM mdl_grade_items
             WHERE itemtype = 'mod' AND itemmodule = 'topomojo' AND iteminstance = ANY($2::bigint[])
          )`,
      [userIds, topomojoIds]
    );

    return gamespaces.rows
      .map(row => row.gamespaceid)
      .filter((id): id is string => !!id);
  } finally {
    await client.end();
  }
}

/**
 * Removes disposable participants entirely: their deployment trail (see
 * `cleanupMoodleTopomojoDeployments`), then their enrolment and user record. The
 * user delete is guarded on the seeded username prefix so it can never remove a
 * real account.
 *
 * Returns the gamespace ids that were attached to them, for the caller to delete
 * from TopoMojo.
 */
export async function cleanupMoodleTopomojoParticipants(
  participants: MoodleTopomojoParticipant[] | undefined
): Promise<string[]> {
  if (!participants || participants.length === 0) {
    return [];
  }

  const userIds = participants.map(p => p.userId);
  const topomojoIds = [...new Set(participants.map(p => p.topomojoId))];
  const gamespaceIds = await cleanupMoodleTopomojoDeployments(topomojoIds, userIds);

  const client = await connectMoodleDatabase();
  try {
    await client.query(
      `DELETE FROM mdl_user_enrolments
        WHERE userid = ANY($1::bigint[])
          AND userid IN (SELECT id FROM mdl_user WHERE username LIKE '\\_\\_e2e\\_topomojo\\_%')`,
      [userIds]
    );
    await client.query(
      `DELETE FROM mdl_user WHERE id = ANY($1::bigint[]) AND username LIKE '\\_\\_e2e\\_topomojo\\_%'`,
      [userIds]
    );
  } finally {
    await client.end();
  }

  return gamespaceIds;
}
