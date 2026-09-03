# Gameboard Application Comprehensive Test Plan

## Application Overview

The Gameboard application is a competition and scoring platform within the
Crucible cybersecurity training ecosystem. It integrates with Keycloak for
OpenID Connect authentication and with TopoMojo for challenge infrastructure
(workspaces, VMs, challenge content). This plan documents the automated tests
that live in `gameboard/tests/` — including the helpers each test uses to
create, exercise, and clean up its own resources.

## Prerequisites

The tests assume the `competition.env` Aspire launch profile is running:

- Gameboard API: `http://localhost:5002`
- Gameboard UI: `http://localhost:4202`
- TopoMojo API: `http://localhost:5000`
- TopoMojo UI: `http://localhost:4201`
- Keycloak: `https://localhost:8443`
- Postgres: `localhost:5432` (read password from `docker inspect crucible-postgres`)

The default `admin` / `admin` user is an Administrator in Keycloak and an Admin
in Gameboard (all permissions — games, sponsors, reports, support settings).

## Test Infrastructure

Tests are fully **self-contained**: each test creates the resources it needs in
`beforeEach`, exercises the scenario, and deletes them in `afterEach`. No
shared fixture data is required.

### Assets (`gameboard/assets/`)

- `gameboard-logo.svg` — original 260×260 SVG logo (used as sponsor avatars)
- `gameboard-card.png` — 500×500 PNG (GB-recommended game card resolution)
- `gameboard-map.png` — 1600×900 PNG (GB-recommended map background resolution)

### Helpers

| Module | Responsibility |
|---|---|
| `gameboard/fixtures.ts` | Gameboard-specific Playwright fixture; authenticates the admin via Keycloak by navigating to `/admin` (which triggers the in-app "Login — localhost:8443" button). |
| `gameboard/api-helpers.ts` | Gameboard REST API: create/delete games, sponsors, sub-sponsors; image uploads; enrollments; challenge specs; team/multi-user flows (invite, enlist, promote). Auto-discovers the API port. |
| `gameboard/db-helpers.ts` | Direct Postgres access for seeding scoreboard data (Players rows with pre-filled Score/Rank) and seeded Challenge rows (with arbitrary state / submissions). Reads the postgres password from the running `crucible-postgres` container via `docker inspect`. |
| `topomojo-helpers.ts` (repo root) | TopoMojo REST API: create/delete workspaces, set workspace audience (controls Gameboard visibility), set challenge YAML. |
| `keycloak-admin.ts` (repo root) | Keycloak admin API: create/delete temporary users, assign realm roles, get user-level bearer tokens. |

### Standard seed patterns

- **Admin-only flows** (most admin/*) — acquire `getAdminToken()`, create/mutate, clean up.
- **Team-based flows** (team/*, game-details/team-registration-*) — create two Keycloak users via `createKeycloakUser`, enroll both in a team game, captain issues invite via `generateTeamInvite`, member redeems via `redeemTeamInvite`. Transfer captaincy via `promoteToCaptain`.
- **Scoreboard-seeded flows** (leaderboard/*, error-handling/leaderboard-pagination, performance/api-response-leaderboard) — use `db-helpers.seedScoreboardPlayers()` to insert Player rows with Score/Rank directly. Cleanup via `cleanupSeededScoreboard()`.
- **Challenge-seeded flows** (challenges/*, error-handling/{answer-case-sensitivity,concurrent-submissions}) — create a TopoMojo workspace, attach it as a Gameboard challenge-spec, enroll admin, then insert Challenge + ChallengeSubmission rows via `db-helpers.seedChallenge()` and `seedChallengeSubmission()`. Challenge state JSON is customized per scenario (hints, VMs, etc.).
- **Image / sponsor flows** — load PNG/SVG from `gameboard/assets/` and `uploadSponsorAvatar` / `uploadGameCardImage` / `uploadGameMapImage`.
- **Unauthorized-access flows** — create a non-admin Keycloak user with `createKeycloakUser()`, log in as that user, verify access is denied.

## Test Scenarios

### 1. Authentication and Authorization (5 tests)

All files in `tests/authentication/`. Exercise the Gameboard-Keycloak OIDC
handshake using the shared authenticator. Pattern A fixtures use
`gameboardAuthenticatedPage`; Pattern B tests start with `storageState: { cookies: [], origins: [] }`.

| File | Scenario |
|---|---|
| `successful-authentication.spec.ts` | Complete login flow: navigate → Keycloak → return authenticated. |
| `failed-authentication-invalid-credentials.spec.ts` | Invalid credentials produce an error and stay on the Keycloak login. |
| `session-persistence.spec.ts` | Admin session survives a page reload. |
| `logout.spec.ts` | Log-out link clears session; subsequent `/admin` redirects to login. |
| `silent-token-renewal.spec.ts` | Session remains valid after background OIDC activity. |

### 2. Home Page and Game Discovery (6 tests)

All files in `tests/home/`. Each test seeds a game via `createGame()`.

| File | Scenario |
|---|---|
| `home-page-display.spec.ts` | Home page renders with top nav and Upcoming Games / Completed Games sections. |
| `game-list-active.spec.ts` | Seeded currently-in-window game appears under "Live!". |
| `game-list-empty.spec.ts` | Sections render; empty-state copy "No games coming up" appears when no cards. |
| `game-list-filter-status.spec.ts` | Seeded future game appears under "Upcoming Games". |
| `game-search.spec.ts` | Search field filters the game card list. |
| `navigate-to-game-details.spec.ts` | Hovering a card reveals Open button; direct-URL navigation renders detail page. |

### 3. Game Details and Registration (5 tests)

All files in `tests/game-details/`. Tests that need enrollment seed a
sponsor and set it on the actor first.

| File | Scenario |
|---|---|
| `details-page-display.spec.ts` | Game detail page renders Enrollment, Info, Scoreboard sections with game name. |
| `individual-registration.spec.ts` | Enroll button visible on details page when user has a non-default sponsor. |
| `team-registration-create.spec.ts` | Enrolling in a team-size>1 game makes the user captain (role: manager). |
| `team-registration-join.spec.ts` | Second Keycloak user enrolls, redeems captain's invite code, joins same team. |
| `unregister.spec.ts` | Enrolled user sees the Unenroll action. |

### 4. Team Management (8 tests)

All files in `tests/team/`. All multi-user scenarios use `createKeycloakUser()`
for each participant and `provisionGameboardUser()` to ensure each has a
Gameboard user record + sponsor.

| File | Scenario |
|---|---|
| `view-team-details.spec.ts` | Team captain sees game details with Unenroll action. |
| `edit-team-captain.spec.ts` | Captain updates team display name via `updatePlayer`. |
| `edit-team-unauthorized.spec.ts` | Non-admin Keycloak user sees no admin team controls. |
| `invite-member.spec.ts` | Captain generates invite code (and can regenerate). |
| `accept-invitation.spec.ts` | Second user enrolls, redeems invite, joins captain's team. |
| `leave-team.spec.ts` | Non-captain deletes their own player row; team size drops by 1. |
| `remove-member.spec.ts` | Admin deletes a team member; team size drops by 1. |
| `transfer-captain.spec.ts` | `promoteToCaptain` moves manager role from captain to the member. |

### 5. Challenge Board and Gameplay (13 tests)

All files in `tests/challenges/`. Every test follows the full seed pipeline:
TopoMojo workspace (audience `gameboard`) → challenge-spec attached to a
Gameboard game → admin enrollment → `seedChallenge()` (and `seedChallengeSubmission()`
where the test needs submission history).

| File | Scenario |
|---|---|
| `board-display.spec.ts` | Seeded challenge visible via `GET /api/challenges?gid={gameId}`. |
| `open-details.spec.ts` | `GET /api/challenge/{id}` returns the seeded name. |
| `start-challenge.spec.ts` | Challenge with `hasDeployedGamespace: true` and StartTime ≤ now. |
| `filter-category.spec.ts` | Two challenges with different names produce distinct `tag` values. |
| `filter-difficulty.spec.ts` | Challenges with different point values distinguish easy/hard. |
| `filter-status.spec.ts` | Seeded completed and in-progress challenges are both present, distinguished by score. |
| `hints.spec.ts` | Challenge state includes a hint string from TopoMojo workspace YAML. |
| `resources.spec.ts` | Challenge state references a named VM. |
| `console-access.spec.ts` | Challenge with deployed gamespace and VM descriptor returned by API. |
| `submit-correct.spec.ts` | Challenge with `completed: true` reports `score == points`. |
| `submit-incorrect.spec.ts` | Challenge with `score: 0` reports partial state. |
| `submit-max-attempts.spec.ts` | 3 submissions seeded; `/api/challenge/{id}/submissions` returns them all. |
| `timer-expiration.spec.ts` | Challenge with `durationMinutes: -1` has EndTime in the past. |

### 6. Leaderboard and Scoring (5 tests)

All files in `tests/leaderboard/`. Use `seedScoreboardPlayers()` to insert
Players directly with pre-filled Score/Rank.

| File | Scenario |
|---|---|
| `game-leaderboard.spec.ts` | Empty-game scoreboard shows "No one's scored" placeholder. |
| `search-team.spec.ts` | `GET /api/game/{id}/score` returns the seeded team names. |
| `view-details.spec.ts` | `GET /api/team/{teamId}/score` returns per-team scoring detail. |
| `realtime-updates.spec.ts` | Adding more seeded players increases the scoreboard team count. |
| `score-history.spec.ts` | Per-team scoring detail includes the seeded approved name. |

### 7. User Profile and Settings (4 tests)

All files in `tests/profile/`.

| File | Scenario |
|---|---|
| `view-profile.spec.ts` | `/user/profile` shows Display Name and Sponsor sections. |
| `edit-profile.spec.ts` | Submitting a Requested Display Name stays on profile page. |
| `game-history.spec.ts` | History tab renders. |
| `notification-settings.spec.ts` | `GET/PUT /api/user/settings` round-trips `playAudioOnBrowserNotification`. |

### 8. Notifications (1 test)

File in `tests/notifications/`.

| File | Scenario |
|---|---|
| `display.spec.ts` | Admin → Notifications page and Create Notification button render. |

Gameboard's notification model differs from the original plan: banners appear
on login and are dismissible per-user; there is no inbox, no read-state, no
"Clear All" control. Tests for those behaviors were removed as inapplicable.

### 9. Administration — Games (8 tests)

All files in `tests/admin/` (subset).

| File | Scenario |
|---|---|
| `dashboard-access-authorized.spec.ts` | Admin sees Administration heading and admin sub-tabs. |
| `dashboard-access-unauthorized.spec.ts` | Non-admin Keycloak user does not see admin sidebar links. |
| `create-game.spec.ts` | Click "New Game" creates a draft; test also uploads card + map imagery. |
| `edit-game.spec.ts` | Seeded game visible on admin dashboard. |
| `publish-game.spec.ts` | PUT toggles `isPublished: false → true`. |
| `unpublish-game.spec.ts` | PUT toggles `isPublished: true → false`. |
| `delete-game.spec.ts` | DELETE removes the game from `/api/games`. |
| `clone-game.spec.ts` | POST `/api/game/clone` produces a distinct new game. |

### 10. Administration — Challenges (9 tests)

Files in `tests/admin/` relating to challenges.

| File | Scenario |
|---|---|
| `challenges-list.spec.ts` | Admin Challenges tab renders; seeded game+spec visible via `listGameChallengeSpecs`. |
| `create-challenge.spec.ts` | TopoMojo workspace created and attached as Gameboard challenge-spec (GB doesn't create challenges directly). |
| `edit-challenge.spec.ts` | PUT `/api/challengespec` updates name and points. |
| `add-challenge-to-game.spec.ts` | Workspace → spec linkage persists. |
| `remove-challenge-from-game.spec.ts` | DELETE spec removes it from `listGameChallengeSpecs`. |
| `delete-challenge.spec.ts` | Same as above, exercised with verified pre-state. |
| `add-challenge-resources.spec.ts` | Card + map image uploads populate `logo` and `background` fields. |
| `configure-hints.spec.ts` | TopoMojo challenge YAML includes hint; linked into Gameboard game. |
| `challenge-visibility-permission.spec.ts` | Admin can attach workspaces regardless of audience; `setWorkspaceAudience` toggles restriction. |

### 11. Administration — Users (6 tests)

Files in `tests/admin/` relating to users.

| File | Scenario |
|---|---|
| `view-participants.spec.ts` | Admin users page renders with search/filter controls. |
| `search-users.spec.ts` | Search field filters user list and accepts typed input. |
| `view-user-details.spec.ts` | Temporary Keycloak user created; `GET /api/user/{id}` returns detail. |
| `assign-admin-role.spec.ts` | New user promoted to Support role via `PUT /api/user`; verified. |
| `manual-registration.spec.ts` | Admin enrolls via `enrollAdmin` helper. |
| `remove-user-from-game.spec.ts` | 2-user team → admin deletes one player → team size drops. |

Additional admin test: `sponsor-hierarchy-with-avatar.spec.ts` exercises
sponsor hierarchy (parent + child sub-sponsor) with shared logo uploads.

### 12. Administration — Reports (3 tests)

Files in `tests/admin/` relating to reports.

| File | Scenario |
|---|---|
| `game-statistics.spec.ts` | Admin → Live page shows Live Stats KPIs. |
| `challenge-analytics.spec.ts` | Admin → Reports → Challenges report renders. |
| `export-game-report.spec.ts` | `GET /api/reports/export/enrollment` returns a CSV/binary payload. |
| `export-participants.spec.ts` | `GET /api/admin/games/{gameId}/players/export` returns player CSV data. |

### 13. Error Handling and Edge Cases (11 tests)

All files in `tests/error-handling/`.

| File | Scenario |
|---|---|
| `network-failure.spec.ts` | Blocking API calls via `page.route` keeps the SPA shell intact. |
| `server-error.spec.ts` | Mocked 500 response doesn't crash the app; no uncaught errors. |
| `form-validation-required.spec.ts` | Create-Notification modal's Save button is disabled when Title/Content empty. |
| `form-validation-format.spec.ts` | PUT /api/game with name > 128 chars is rejected or truncated. |
| `session-timeout.spec.ts` | Clearing cookies/storage mid-session redirects subsequent admin navigation to login. |
| `back-button.spec.ts` | Browser back navigation through home → admin pages restores each page. |
| `deep-link-unauthenticated.spec.ts` | Direct access to `/admin/registrar/users` without auth redirects to login, preserves `redirectTo`. |
| `xss-protection.spec.ts` | Submitting `<script>` payload in profile form does not execute. |
| `concurrent-submissions.spec.ts` | Two seeded submissions at the same time don't double-credit score. |
| `leaderboard-pagination.spec.ts` | 120-team scoreboard loads in under 60 seconds. |
| `invalid-game-id.spec.ts` | Bogus UUID game URL does not crash the app. |
| `answer-case-sensitivity.spec.ts` | Submissions with differing case are stored distinctly. |

### 14. Performance and Accessibility (10 tests)

Files in `tests/performance/` and `tests/accessibility/`.

**Performance:**

| File | Scenario |
|---|---|
| `home-page-load.spec.ts` | Home page loads in under 15 seconds. |
| `challenge-board-load.spec.ts` | Admin-challenges endpoint returns 20 seeded challenges quickly. |
| `api-response-leaderboard.spec.ts` | 50-team scoreboard responds within performance threshold. |

**Accessibility:**

| File | Scenario |
|---|---|
| `color-contrast.spec.ts` | axe-core `wcag2aa + color-contrast` reports no critical violations on home. |
| `screen-reader-aria.spec.ts` | axe-core `link-name, html-has-lang, document-title` checks pass on home. |
| `keyboard-tab-order.spec.ts` | Tab key navigates through at least 3 distinct interactive elements. |
| `keyboard-form-submission.spec.ts` | Profile form submittable via keyboard. |
| `focus-management-modals.spec.ts` | Create-notification modal shows focusable controls; Escape returns to list. |
| `responsive-mobile.spec.ts` | Mobile viewport (375×667) renders the hamburger toggle. |
| `responsive-tablet.spec.ts` | Tablet viewport (768×1024) keeps heading visible. |

## Cleanup Contract

Every test's `afterEach` must remove whatever it created:

- Games via `deleteGame()`
- Sponsors via `deleteSponsor()`
- Players via `deletePlayer()` (or let cascading Game deletion take care of them)
- Challenge-specs via `deleteChallengeSpec()` (cascades to seeded Challenge rows)
- TopoMojo workspaces via `deleteWorkspace()`
- Keycloak users via `deleteKeycloakUser()`
- Admin's sponsor restoration via `setAdminSponsor(previousSponsorId)`
- Direct-seeded rows via `cleanupSeededScoreboard()` / `cleanupSeededChallenges()`
  (rows are tagged with `__seed__` prefix for unambiguous cleanup)

After a clean run, the only residual environment state is Gameboard's
bundled `Other Department/Agency` sponsor and TopoMojo's default `Workspace Title`.

## Running the Tests

```bash
cd /mnt/data/crucible/crucible-tests
./run-tests.sh gameboard            # runs the full gameboard suite
./run-tests.sh gameboard --filter team    # only team tests
./run-tests.sh gameboard --filter "admin" # only admin tests
```

Parallel workers: 2 is the recommended default (some tests modify shared
admin sponsor state, so >2 workers can race). Use `--retries=1` to absorb
timing flakes in the home-page search/filter UI when several tests seed games
simultaneously.
