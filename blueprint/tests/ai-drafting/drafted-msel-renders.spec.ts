// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from "../../fixtures";
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  tempBlueprintName,
  blueprintCall,
  navigateToMselSection,
} from "../../test-helpers";

/**
 * A MSEL built by the AI draft shows on every tab as a hand-built one does. The draft builds the MSEL through code apart
 * from the forms, so it can leave out a setting the views rely on: Information and Facilitation rows once listed as a bare
 * type because no column was marked for them. The MSEL here is built by the same builder from a fixed draft, through
 * `POST /api/msels/ai-draft/import`, which calls no model, so it costs nothing and answers the same each time.
 */
test.describe("A drafted MSEL renders on every tab", () => {
  let token: string;
  let templateId: string;
  let draftedMselId: string | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const template = await createMsel(token, {
      name: tempBlueprintName("TestBP-AiRenderTemplate"),
      isTemplate: true,
    });
    templateId = template.id;
    await seedMselDataFields(token, templateId);
    draftedMselId = undefined;
  });

  test.afterEach(async () => {
    if (draftedMselId) await deleteMsel(token, draftedMselId);
    if (templateId) await deleteMsel(token, templateId);
  });

  test("shows every row, move and page of a drafted MSEL", async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const name = tempBlueprintName("TestBP-AiRendered");
    const imported = await blueprintCall<any>(
      token,
      "/api/msels/ai-draft/import",
      {
        method: "POST",
        body: { templateMselId: templateId, draft: draft(name) },
      },
    );
    expect(imported.ok, imported.text).toBe(true);
    draftedMselId = imported.data.msel.id;

    // every row shows its title: the injects, the read-in notice (Information) and the facilitator's note (Facilitation)
    await navigateToMselSection(page, draftedMselId!, "Scenario Events");
    for (const title of [
      "Read the read-in page before play starts",
      "Cables cut",
      "Check in with each team lead",
      "Press asks about the outage",
    ]) {
      await expect(page.getByText(title, { exact: false }).first()).toBeVisible(
        { timeout: 15000 },
      );
    }

    // the moves, between the pre-exercise move and the hot wash, with their situations
    await navigateToMselSection(page, draftedMselId!, "Moves");
    for (const move of ["Outage", "Pressure"]) {
      await expect(page.getByText(move, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
    }

    // the pages the finish adds
    await navigateToMselSection(page, draftedMselId!, "Info");
    for (const pageName of ["Exercise Overview", "Facilitator Guide"]) {
      await expect(page.getByRole("tab", { name: pageName })).toBeVisible({
        timeout: 15000,
      });
    }
    await expect(page.getByRole("tab", { name: /Read-In/ })).toBeVisible();

    // what participants see
    await navigateToMselSection(page, draftedMselId!, "Exercise View");
    await expect(page.getByText("Cables cut").first()).toBeVisible({
      timeout: 15000,
    });
  });
});

// a two-move tabletop on the template's standard columns: the read-in notice, two injects, a facilitator's note and a read-in
function draft(name: string) {
  return {
    name,
    description: "Undersea cables to the islands are cut.",
    durationMinutes: 120,
    design: {
      format: "Discussion",
      citeAssessment: "None",
      moves: 2,
      profilePages: false,
    },
    scenario: {
      problem: "Two cables to the islands are cut.",
      premise: "A ship dragged its anchor.",
      escalationCeiling: "No loss of life",
    },
    objectives: [
      {
        id: "O1",
        task: "Lead the response",
        condition: "With partial outages",
        standard: "A lead within 30 minutes",
        competencies: [],
      },
    ],
    moves: [
      {
        moveNumber: 0,
        description: "Outage",
        situationDescription: "<p>The islands lose internet.</p>",
        startMinutes: 0,
        situationTime: "2026-03-04T08:00:00.000Z",
        purpose: "Choose a lead",
      },
      {
        moveNumber: 1,
        description: "Pressure",
        situationDescription: "<p>The press calls.</p>",
        startMinutes: 60,
        situationTime: "2026-03-05T09:00:00.000Z",
        purpose: "Public pressure",
      },
    ],
    teams: [
      {
        name: "Security operations",
        shortName: "SOC",
        description: "Watches the network.",
        competencies: [],
        duties: [],
      },
    ],
    organizations: [
      {
        name: "Harbour Herald",
        shortName: "NEWS",
        description: "The regional paper",
        summary: "The regional paper",
      },
    ],
    cards: [],
    injects: [
      {
        minutes: 0,
        eventType: "Information",
        values: { Title: "Read the read-in page before play starts" },
      },
      {
        minutes: 5,
        eventType: "Inject",
        expectedAction: "Choose a lead",
        values: { Title: "Cables cut", Description: "Both cables are down." },
      },
      {
        minutes: 30,
        eventType: "Facilitation",
        expectedAction: "Ask each lead for status",
        values: { Title: "Check in with each team lead" },
      },
      {
        minutes: 70,
        eventType: "Inject",
        expectedAction: "Agree a holding line",
        values: { Title: "Press asks about the outage" },
      },
    ],
    readIn: "<p>Read this before play starts.</p>",
    citeActions: [],
    competencies: [],
    plannerNotes: [],
  };
}
