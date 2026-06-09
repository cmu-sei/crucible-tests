# Moodle TopoMojo Tests

## Prerequisites

These tests require **both Moodle and TopoMojo** to be properly configured and running:

### 1. Aspire Services Running
Start Crucible services with Moodle and TopoMojo enabled:
```bash
cd /workspaces/crucible-development
aspire run
```

Or use VS Code launch profile (F5) with Moodle + TopoMojo enabled.

### 2. TopoMojo Configuration
The TopoMojo API must be configured in Moodle:

1. Log into Moodle as admin (http://localhost:8081)
2. Navigate to: **Site administration → Plugins → Activity modules → TopoMojo**
3. Configure settings:
   - **TopoMojo API URL**: `http://topomojo-api:5000` (or appropriate URL)
   - **API Key**: Valid TopoMojo API key
   - **OAuth Settings**: Keycloak client ID/secret if using OAuth

### 3. Test Workspace
Tests use workspace ID: `11d9f0cb5ad64e27982a181e116f48b8` (Moodle Test Workspace - Variants)

This workspace must exist in TopoMojo with:
- At least one challenge with questions
- Known penalty values (e.g., 0.1)
- Known weight values (e.g., 1 point per question)
- Multiple variants (for variant testing)

### 4. Test Course
Tests assume a Moodle course exists at `http://localhost:8081/course/view.php?id=2` with:
- Course name: "Test Course"
- At least one TopoMojo activity created

## Running Tests

### All Moodle TopoMojo Tests
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts
```

### Specific Test
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts -g "penalty cumulatively"
```

### With Headed Browser (see what happens)
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts --headed
```

### With Debugging
```bash
npx playwright test tests/moodle/topomojo-penalty-weight.spec.ts --debug
```

## Test Status

All tests are currently marked `.skip()` because they require:
- [ ] TopoMojo API properly configured in Moodle
- [ ] Test workspace created in TopoMojo with known question data
- [ ] Test course and activity pre-created in Moodle
- [ ] Shared test fixtures for Moodle auth (similar to other Crucible apps)

## Implementation Checklist

To enable these tests:

1. **Create shared Moodle fixtures** (`tests/moodle/moodle-fixtures.ts`)
   - Moodle login helper (Keycloak OAuth flow)
   - Course navigation helpers
   - Activity creation helpers

2. **Create test data setup** (`tests/moodle/moodle-test-data.setup.ts`)
   - Create test course if not exists
   - Create test TopoMojo activity with known workspace
   - Configure activity with interactive behavior

3. **Add TopoMojo API helper** (`tests/moodle/topomojo-api.ts`)
   - Fetch challenge JSON from TopoMojo API
   - Get expected weight/penalty values
   - Compare against Moodle imported values

4. **Update tests to use fixtures**
   - Replace manual login with `moodleAuth` fixture
   - Use shared helpers for navigation
   - Add proper waits for gamespace deployment

5. **Add database verification**
   - Query `mdl_question` table after import
   - Verify `defaultmark` and `penalty` fields
   - Requires database connection from Playwright

## Test Plan

See `/mnt/data/crucible/crucible-tests/moodle/moodle-test-plan.md` for comprehensive test scenarios covering:
- Authentication
- Course management
- TopoMojo activity workflows
- Penalty calculation
- Question sync
- Scheduled deployments
- Bulk deployment management
- Variants
- Exploration mode

## Related Documentation

- [Moodle Test Plan](../../moodle/moodle-test-plan.md)
- [Penalty/Weight Verification TODO](/workspaces/crucible-development/TODO/topomojo-penalty-weight-verification.md)
- [TopoMojo Plugin Source](/mnt/data/crucible/moodle/mod/topomojo/)
