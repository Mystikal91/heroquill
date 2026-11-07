import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChoiceGrant } from "../engine/choices";

/** Every kind of choice needs a heading; adding a kind to the schema fails typecheck here first. */
const GRANTS: Record<ChoiceGrant, true> = {
  proficiency: true,
  language: true,
  spell: true,
  trait: true,
  abilityBonus: true,
  expertise: true,
  feat: true,
  mastery: true,
};

describe("the headings of the choices", () => {
  for (const lang of ["en", "it", "fr", "de", "es"]) {
    it(`has one for every kind of choice in ${lang}`, () => {
      const texts = JSON.parse(readFileSync(`locales/${lang}/ui.json`, "utf8")) as Record<
        string,
        string
      >;
      for (const grant of Object.keys(GRANTS)) {
        expect(texts[`choice.kind.${grant}`], `choice.kind.${grant}`).toBeTruthy();
      }
    });
  }
});
