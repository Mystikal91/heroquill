/**
 * A colour for each class, by the end of its id: the band of the character card on the build screen
 * and the head of the sheet. White is written on them, so each is dark enough to read it
 * (`classColor.test.ts`). A class of another book with the name of one of these and something more
 * (`artificer-2`) takes the colour of its name; a class the table does not know, or none, a slate.
 */
export const CLASS_COLORS: Record<string, string> = {
  artificer: "#82622b",
  barbarian: "#a33a30",
  bard: "#a8457a",
  cleric: "#7a651f",
  druid: "#457335",
  fighter: "#5b6472",
  monk: "#29736e",
  paladin: "#8f5710",
  ranger: "#3a734a",
  rogue: "#454a57",
  sorcerer: "#a74f2c",
  warlock: "#6a4a9a",
  wizard: "#3b6ba3",
};

export const NO_CLASS_COLOR = "#4a5468";

export function classColor(classId: string | undefined): string {
  const slug = classId?.split("/").pop() ?? "";
  return CLASS_COLORS[slug] ?? CLASS_COLORS[slug.split("-")[0] ?? ""] ?? NO_CLASS_COLOR;
}
