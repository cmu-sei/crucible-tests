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

async function connectMoodleDatabase(): Promise<Client> {
  const client = new Client({
    host: 'localhost',
    port: 5432,
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
    const userId = user.rows[0].id;

    await client.query(
      `INSERT INTO mdl_user_enrolments (
         status, enrolid, userid, timestart, timeend, modifierid, timecreated, timemodified
       ) VALUES (0, $1, $2, 0, 2147483647, 0, $3, $3)`,
      [enrolment.rows[0].id, userId, now]
    );

    return { userId, username, displayName, crucibleId: crucibleid };
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
