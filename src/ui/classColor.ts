/**
 * A colour for each class of the 2014 rules, by the end of its id: the band of the character card on
 * the build screen and the head of the sheet. A class the table does not know takes the theme's ink.
 */
const COLORS: Record<string, string> = {
  artificer: "#8a6a2f",
  barbarian: "#a33a30",
  bard: "#a8457a",
  cleric: "#9c7a28",
  druid: "#4a7d3a",
  fighter: "#5b6472",
  monk: "#2f7f7a",
  paladin: "#b08a2e",
  ranger: "#3f7d4f",
  rogue: "#454a57",
  sorcerer: "#b0522f",
  warlock: "#6a4a9a",
  wizard: "#3d6fa8",
};

export function classColor(classId: string | undefined): string | undefined {
  return classId ? COLORS[classId.split("/").pop() ?? ""] : undefined;
}
