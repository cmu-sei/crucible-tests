// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// reads: player/vm.api (/swagger/v1/swagger.json), player/vm.ui (generated client)

/**
 * The freshness check for the API client `vm.ui` has checked in.
 *
 * `vm.ui/src/app/generated/vm-api` is generated from the VM API's OpenAPI document by
 * `npm run swagger:gen`, and then committed. Nothing runs that command on a schedule, in a pipeline, or as
 * a condition of merging - so a DTO property renamed in `vm.api` changes the JSON the API sends and changes
 * nothing about the TypeScript interface the browser parses it into. Both repositories build, both test
 * suites pass, and the field is `undefined` in production. That is the gap this closes.
 *
 * The API's half comes from the running service: `/swagger/v1/swagger.json`, the same document
 * `swagger:gen` is pointed at. It used to come from `contracts/openapi-surface.json`, a snapshot
 * `Player.Vm.Api.Tests` regenerated on demand, and that file was deleted along with the test that wrote
 * it. Reading the live document is the stronger of the two anyway - a snapshot can be stale in its own
 * right, and a spec whose input file will never exist again does not fail, it skips forever - but it costs
 * a running API, so these tests are preconditioned on one rather than on a checkout.
 *
 * Only the parts a client is generated *from* are compared: operation ids and tags, because they become
 * method and service names, and schema properties and enum values, because they become interfaces and
 * union types. {@link openApiSurfaceFrom} does that reduction, and `contract-reader.spec.ts` drives it from
 * a fixture so the reduction itself is checked without a server.
 *
 * A failure here means the client is stale: `npm run swagger:gen` needs running in `vm.ui` against a
 * current API. The fix is in an application repository, not here.
 *
 * This reads application source. `../../../AGENTS.md` permits that to verify a contract, and nothing here
 * writes to an application repository.
 */

import { expect, test } from '@playwright/test';
import { requireAppSources, requirePrecondition } from '../../../shared-fixtures';
import {
  OpenApiSurface,
  allPresent,
  fetchOpenApiDocument,
  generatedClientDirectory,
  generatedEnumValues,
  generatedInterfaceProperties,
  generatedModels,
  generatedServices,
  normalizeName,
  openApiDocumentUrl,
  openApiSurfaceFrom,
} from '../../contract-sources';

/**
 * Fetched once for the file. Every test below wants the same document, the API is not going to change
 * between them, and a suite that asked six times would be six chances for a flake to read as drift.
 */
let fetched: Promise<OpenApiSurface | null> | null = null;

/**
 * Both sides of the comparison: the surface the API is serving, and - implicitly - the generated client on
 * disk.
 *
 * Two preconditions, deliberately different in kind. A missing `vm.ui` checkout is
 * {@link requireAppSources}, which only escalates when someone has said the app repos are there. An API
 * that is not answering is {@link requirePrecondition}, which escalates under CI, because CI is where the
 * whole stack is supposed to be up.
 */
async function surface(): Promise<OpenApiSurface> {
  requireAppSources(
    allPresent(generatedClientDirectory()),
    `${generatedClientDirectory()} is not checked out.`
  );

  fetched ??= fetchOpenApiDocument().then((document) =>
    document === null ? null : openApiSurfaceFrom(document)
  );

  const found = await fetched;

  requirePrecondition(found, `Nothing answered at ${openApiDocumentUrl()}.`);

  return found;
}

const stale =
  'The checked-in client is out of date with the API. Regenerate it with `npm run swagger:gen` in ' +
  'vm.ui against a current API and commit the result.';

test.describe('Player VM generated client freshness', () => {
  /**
   * The coarsest drift and the one that breaks loudest: a schema the API no longer describes, or a new one
   * no generated model exists for. Compared on names with casing and separators removed, because that is
   * the only part of the transformation from a schema name to a TypeScript type name that is stable across
   * generator versions.
   */
  test('the generated models are exactly the schemas the API describes', async () => {
    const described = Object.keys((await surface()).schemas).map(normalizeName).sort();
    const generated = generatedModels().map(normalizeName).sort();

    expect(generated, stale).toEqual(described);
  });

  /**
   * The drift that breaks quietly. A renamed property leaves the generated interface with the old name, so
   * `vm.ui` compiles - it is reading a property that exists on its own type - and reads `undefined` off
   * every response forever.
   */
  test('every object schema has the properties its generated interface declares', async () => {
    const differences: string[] = [];
    let compared = 0;

    for (const [name, schema] of Object.entries((await surface()).schemas)) {
      if (!schema.properties) {
        continue;
      }

      const generated = generatedInterfaceProperties(name);

      if (generated === null) {
        differences.push(`${name}: the API describes an object, the client has no interface for it`);
        continue;
      }

      compared++;
      const described = [...schema.properties].sort();
      const missing = described.filter((x) => !generated.includes(x));
      const extra = [...generated].sort().filter((x) => !described.includes(x));

      if (missing.length || extra.length) {
        differences.push(`${name}: the client is missing [${missing}] and still declares [${extra}]`);
      }
    }

    expect(differences, stale).toEqual([]);
    // Without this the test passes on a document whose schemas all came back without properties - which
    // is what a swagger endpoint answering with the wrong document looks like from here.
    expect(compared, 'no object schema was compared').toBeGreaterThan(0);
  });

  /**
   * Enum values are string literals on both sides, so a value added in `vm.api` is a value the client's
   * union type rejects - and one removed is a value the client will happily send to an API that no longer
   * accepts it.
   */
  test('every enum schema has the values its generated union declares', async () => {
    const differences: string[] = [];
    let compared = 0;

    for (const [name, schema] of Object.entries((await surface()).schemas)) {
      if (!schema.values) {
        continue;
      }

      const generated = generatedEnumValues(name);

      if (generated === null) {
        differences.push(
          `${name}: the API describes an enum of [${schema.values}], the client has no union type`
        );
        continue;
      }

      compared++;

      if ([...schema.values].sort().join('|') !== [...generated].sort().join('|')) {
        differences.push(`${name}: the API has [${schema.values}], the client has [${generated}]`);
      }
    }

    expect(differences, stale).toEqual([]);
    expect(compared, 'no enum schema was compared').toBeGreaterThan(0);
  });

  /**
   * Every operation is reachable from the client, from the service the API's tag puts it on. Asserted per
   * service rather than across all of them because a moved tag is its own kind of breakage: the method
   * still exists, on a class `vm.ui` does not inject at that call site.
   */
  test('every operation the API declares is a method on the generated service for its tag', async () => {
    const services = new Map(
      generatedServices().map((x) => [normalizeName(x.file), x.methods.map(normalizeName)])
    );
    const differences: string[] = [];

    for (const [route, operation] of Object.entries((await surface()).operations)) {
      if (!operation.operationId) {
        differences.push(`${route}: the API declares no operationId, so no method can be generated`);
        continue;
      }

      for (const tag of operation.tags) {
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
  test('every method on a generated service is an operation the API declares', async () => {
    const declared = new Set(
      Object.values((await surface()).operations)
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

  /**
   * The precondition the five tests above share. Each of them compares the client against a set read out
   * of the document, and an empty set makes all five pass; this is the one that fails when the document is
   * there but says nothing.
   */
  test('the API serves an OpenAPI document with operations and schemas', async () => {
    const found = await surface();

    expect(Object.keys(found.operations).length, `${openApiDocumentUrl()} describes no operations`)
      .toBeGreaterThan(0);
    expect(Object.keys(found.schemas).length, `${openApiDocumentUrl()} describes no schemas`)
      .toBeGreaterThan(0);
  });
});
