// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// contract: player/vm.api/contracts/openapi-surface.json

/**
 * The freshness check for the API client `vm.ui` has checked in.
 *
 * `vm.ui/src/app/generated/vm-api` is generated from the VM API's OpenAPI document by
 * `npm run swagger:gen`, and then committed. Nothing runs that command on a schedule, in a pipeline, or
 * as a condition of merging - so a DTO property renamed in `vm.api` changes the JSON the API sends and
 * changes nothing about the TypeScript interface the browser parses it into. Both repositories build,
 * both test suites pass, and the field is `undefined` in production. That is the gap this closes.
 *
 * `Player.Vm.Api.Tests/OpenApiSurfaceTests.cs` pins the API's side into
 * `contracts/openapi-surface.json`: a derived summary of the document holding what a generated client is
 * built out of - operation ids and tags, because they become method and service names, and schema
 * properties with their types, because they become interfaces. Regenerated deliberately, with
 * `VMAPI_UPDATE_CONTRACTS=1`. This spec compares that snapshot to the client actually checked in, which
 * is the comparison neither repository can make alone.
 *
 * A failure here means one of two things, and the message says which: the client is stale and
 * `npm run swagger:gen` needs running against a current API, or the snapshot was regenerated in `vm.api`
 * without the client being regenerated with it. Either way the fix is in an application repository, not
 * here.
 *
 * This reads application source. `../../../AGENTS.md` permits that to verify a contract, and nothing
 * here writes to an application repository.
 */

import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  OpenApiSurface,
  allPresent,
  contractsDirectory,
  generatedClientDirectory,
  generatedEnumValues,
  generatedInterfaceProperties,
  generatedModels,
  generatedServices,
  normalizeName,
  readJson,
} from '../../contract-sources';

const surfaceFile = path.join(contractsDirectory(), 'openapi-surface.json');

/** The surface and the generated client, or a skip when either repository is not checked out. */
function bothSides(): OpenApiSurface {
  requirePrecondition(
    allPresent(surfaceFile, generatedClientDirectory()),
    `Both ${surfaceFile} and the generated vm.ui API client must be checked out.`
  );

  return readJson<OpenApiSurface>(surfaceFile);
}

const stale =
  'The checked-in client is out of date with the API. Regenerate it with `npm run swagger:gen` in ' +
  'vm.ui against a current API, or - if the surface snapshot in vm.api was updated without the client - ' +
  'regenerate both together.';

test.describe('Player VM generated client freshness', () => {
  /**
   * The coarsest drift and the one that breaks loudest: a schema the API no longer describes, or a new
   * one no generated model exists for. Compared on names with casing and separators removed, because
   * that is the only part of the transformation from a schema name to a TypeScript type name that is
   * stable across generator versions.
   */
  test('the generated models are exactly the schemas the API describes', () => {
    const surface = bothSides();

    const described = Object.keys(surface.schemas).map(normalizeName).sort();
    const generated = generatedModels().map(normalizeName).sort();

    expect(generated, stale).toEqual(described);
  });

  /**
   * The drift that breaks quietly. A renamed property leaves the generated interface with the old name,
   * so `vm.ui` compiles - it is reading a property that exists on its own type - and reads `undefined`
   * off every response forever.
   */
  test('every object schema has the properties its generated interface declares', () => {
    const surface = bothSides();
    const differences: string[] = [];

    for (const [name, schema] of Object.entries(surface.schemas)) {
      if (!schema.properties) {
        continue;
      }

      const described = Object.keys(schema.properties).sort();
      const generated = generatedInterfaceProperties(name);

      if (generated === null) {
        differences.push(`${name}: the API describes an object, the client has no interface for it`);
        continue;
      }

      const missing = described.filter((x) => !generated.includes(x));
      const extra = [...generated].sort().filter((x) => !described.includes(x));

      if (missing.length || extra.length) {
        differences.push(
          `${name}: the client is missing [${missing}] and still declares [${extra}]`
        );
      }
    }

    expect(differences, stale).toEqual([]);
  });

  /**
   * Enum values are string literals on both sides, so a value added in `vm.api` is a value the client's
   * union type rejects - and one removed is a value the client will happily send to an API that no
   * longer accepts it.
   */
  test('every enum schema has the values its generated union declares', () => {
    const surface = bothSides();
    const differences: string[] = [];

    for (const [name, schema] of Object.entries(surface.schemas)) {
      if (schema.properties) {
        continue;
      }

      // The generated side decides whether this is an enum: the snapshot renders both an enum and a
      // formatted scalar as `type(...)`, and only the client can say which one the generator saw.
      const generated = generatedEnumValues(name);

      if (generated === null) {
        differences.push(`${name}: the API describes '${schema.type}', the client has no union type`);
        continue;
      }

      const described = /^\w+\((.*)\)\??$/.exec(schema.type)?.[1].split('|') ?? [];

      expect(described.length, `the snapshot's '${schema.type}' does not read as a list of values`)
        .toBeGreaterThan(0);

      if (described.sort().join('|') !== [...generated].sort().join('|')) {
        differences.push(`${name}: the API has [${described}], the client has [${generated}]`);
      }
    }

    expect(differences, stale).toEqual([]);
  });

  /**
   * Every operation is reachable from the client, from the service the API's tag puts it on. Asserted
   * per service rather than across all of them because a moved tag is its own kind of breakage: the
   * method still exists, on a class `vm.ui` does not inject at that call site.
   */
  test('every operation the API declares is a method on the generated service for its tag', () => {
    const surface = bothSides();
    const services = new Map(
      generatedServices().map((x) => [normalizeName(x.file), x.methods.map(normalizeName)])
    );
    const differences: string[] = [];

    for (const [route, operation] of Object.entries(surface.operations)) {
      if (!operation.operationId) {
        differences.push(`${route}: the API declares no operationId, so no method can be generated`);
        continue;
      }

      for (const tag of operation.tags ?? []) {
        const methods = services.get(normalizeName(tag));

        if (!methods) {
          differences.push(`${route}: the client has no service for the tag '${tag}'`);
        } else if (!methods.includes(normalizeName(operation.operationId))) {
          differences.push(`${route}: '${operation.operationId}' is not a method on ${tag}Service`);
        }
      }
    }

    expect(differences, stale).toEqual([]);
  });

  /**
   * The other direction. A method the API no longer has is a call `vm.ui` can still make and still
   * compile, and it fails as a 404 at runtime - which reads as an outage rather than as a rename.
   */
  test('every method on a generated service is an operation the API declares', () => {
    const surface = bothSides();
    const declared = new Set(
      Object.values(surface.operations)
        .map((x) => x.operationId)
        .filter(Boolean)
        .map(normalizeName)
    );

    const orphans = generatedServices()
      .flatMap((service) =>
        service.methods
          .filter((method) => !declared.has(normalizeName(method)))
          .map((method) => `${service.file}.${method}`)
      )
      .sort();

    expect(orphans, stale).toEqual([]);
  });

  test('the surface snapshot the API publishes is readable', () => {
    requirePrecondition(fs.existsSync(surfaceFile), `${surfaceFile} is not checked out.`);

    const surface = readJson<OpenApiSurface>(surfaceFile);

    expect(Object.keys(surface.operations).length).toBeGreaterThan(0);
    expect(Object.keys(surface.schemas).length).toBeGreaterThan(0);
  });
});
