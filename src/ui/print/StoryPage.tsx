import { content } from "../../app/store";
import type { Content } from "../../content/browser";
import { itemData } from "../../data/items";
import type { Character } from "../../engine/character";
import { COINS } from "../../engine/coins";
import { type UiKey, ui } from "../../i18n/ui";
import { backgroundFeature, originFeat } from "../backgroundFeature";
import { FitBox } from "./FitBox";
import { PageFoot } from "./PageFoot";
import { RuledArea } from "./RuledArea";
import { printedCharacter, shown } from "./printSource";

const FIELDS = ["age", "height", "weight", "eyes", "skin", "hair"] as const;
const SLOTS = [
  "head",
  "amulet",
  "cloak",
  "armor",
  "hands",
  "ring",
  "ring",
  "belt",
  "boots",
] as const;
const MAGIC_ITEM_LINES = 5;

/** The equipped items that belong in a given slot, by name. Only armor and hands are known. */
function slotValue(c: Content, ch: Character, slot: (typeof SLOTS)[number]): string {
  const equipped = ch.inventory
    .filter((i) => i.equipped)
    .map((i) => ({ id: i.itemId, data: c.index.get(i.itemId) }))
    .filter((i) => i.data);
  const names = (keep: (data: ReturnType<typeof itemData>) => boolean) =>
    equipped
      .filter((i) => i.data && keep(itemData(i.data)))
      .map((i) => c.name(i.id))
      .join(", ");
  if (slot === "armor") return names((d) => Boolean(d.armor) && d.armor?.category !== "shield");
  if (slot === "hands") return names((d) => Boolean(d.weapon) || d.armor?.category === "shield");
  return "";
}

/**
 * What a 2024 feat gives, by the names of its benefits (the bold lead-ins of its text: "Two Cantrips",
 * "Level 1 Spell"...), which say more in one line than the sentence that opens it. The first line of
 * the text when it has none.
 */
function benefitNames(text: string | undefined): string {
  const lines = (text ?? "").split("\n");
  const names = lines.flatMap((line) => {
    const lead = /^\*\*(.+?)\.?\*\*/.exec(line.trim());
    return lead?.[1] ? [lead[1].replace(/\.$/, "")] : [];
  });
  return names.length > 0 ? names.join(" · ") : (lines[0] ?? "");
}

/** A frame to write in: the text the player already wrote, or ruled lines to handwrite on. */
function Block({
  title,
  text = "",
  className = "",
}: {
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <section class={`p-frame p-block ${className}`.trim()}>
      <h3 class="p-h">{title}</h3>
      {text.trim() ? <FitBox text={text} /> : <RuledArea />}
    </section>
  );
}

/** A page of frames to handwrite in, with what the app knows already filled in. */
export function StoryPage() {
  const c = content.value;
  const ch = printedCharacter.value;
  if (!c) return null;
  const background = ch.choices.background;
  const { name: featureName, text: featureDesc } = backgroundFeature(ch, c);
  // A magic item (one with a rarity) goes in the box for them, whether it is worn or carried.
  const isMagic = (i: (typeof ch.inventory)[number]) => Boolean(c.index.get(i.itemId)?.data.rarity);
  const magicItems = ch.inventory.filter(isMagic);
  const carried = ch.inventory.filter((i) => !i.equipped && !isMagic(i));
  const story = ch.story;
  // The 2014 background gives a feature, the 2024 one a feat of its own (the Origin feat); what it gives
  // comes first, then the player's backstory, sized together to fit the frame.
  const origin = ch.ruleset === "srd52" ? originFeat(ch, c) : undefined;
  const given = origin
    ? `${ui("print.originFeat")}: ${origin.name}. ${benefitNames(origin.text)}`
    : featureName
      ? `${featureName}. ${featureDesc?.split("\n\n")[0] ?? ""}`
      : "";
  const backgroundText = [given, story.backstory].filter((part) => part.trim()).join("\n\n");

  return (
    <section class="p-page p-story">
      <div class="p-story-top">
        <div class="p-banner">
          <h1>{shown(ch.name || ui("sheet.unnamed"))}</h1>
          <small>{ui("sheet.name")}</small>
        </div>
        <div class="p-frame p-block">
          <dl class="p-fields">
            <div>
              <dd>{story.alignment ? c.name(story.alignment) : " "}</dd>
              <dt>{ui("story.alignment")}</dt>
            </div>
            {story.deity && (
              <div>
                <dd>{c.name(story.deity)}</dd>
                <dt>{ui("story.deity")}</dt>
              </div>
            )}
            {FIELDS.map((f) => (
              <div key={f}>
                <dd>{story[f] || " "}</dd>
                <dt>{ui(`print.field.${f}` as UiKey)}</dt>
              </div>
            ))}
            <div>
              <dd>{" "}</dd>
              <dt>{ui("print.xp")}</dt>
            </div>
          </dl>
        </div>
      </div>

      <div class="p-story-grid">
        <div class="col">
          <Block title={ui("print.story.appearance")} text={story.appearance} className="big" />
        </div>
        <div class="col">
          <Block
            title={ui("print.story.personality")}
            text={story.personalityTraits}
            className="fill"
          />
          <Block title={ui("print.story.ideals")} text={story.ideals} className="fill" />
          <Block title={ui("print.story.bonds")} text={story.bonds} className="fill" />
          <Block title={ui("print.story.flaws")} text={story.flaws} className="fill" />
        </div>
        <div class="col">
          <section class="p-frame p-block fill wide">
            <h3 class="p-h">{ui("print.story.background")}</h3>
            {background && <strong>{c.name(background)}</strong>}
            {backgroundText.trim() ? <FitBox text={backgroundText} /> : <RuledArea />}
          </section>
          <Block title={ui("print.story.allies")} text={story.allies} className="fill" />
          <Block title={ui("print.story.enemies")} text={story.enemies} className="fill" />
        </div>
      </div>

      <div class="p-story-bottom">
        <Block title={ui("print.story.additional")} text={story.notes} />

        <div class="col mid">
          <section class="p-frame p-block">
            <h3 class="p-h">{ui("print.story.equipment")}</h3>
            {SLOTS.map((slot, i) => (
              <div class="p-slot" key={`${slot}-${i + 1}`}>
                <span class="name">{ui(`print.slot.${slot}` as UiKey)}</span>
                <span class="value">{slotValue(c, ch, slot)}</span>
                <span class="p-pip" title={ui("print.attuned")} />
              </div>
            ))}
            <div class="p-coins">
              {COINS.map((coin) => (
                <div key={coin}>
                  <div class="p-coin">{ch.coins?.[coin] || ""}</div>
                  {coin.toUpperCase()}
                </div>
              ))}
            </div>
          </section>
          <section class="p-frame p-block grow">
            <h3 class="p-h">{ui("print.story.magicItems")}</h3>
            {Array.from({ length: Math.max(MAGIC_ITEM_LINES, magicItems.length) }, (_, i) => {
              const item = magicItems[i];
              return (
                <div class="p-slot single" key={`magic-${item?.itemId ?? i}`}>
                  <span class="value">
                    {item ? (item.custom?.name ?? c.name(item.itemId)) : " "}
                  </span>
                  <span class="p-pip" title={ui("print.attuned")} />
                </div>
              );
            })}
          </section>
        </div>

        <section class="p-frame p-block">
          <h3 class="p-h">{ui("print.story.backpack")}</h3>
          <ul class="p-lines">
            {carried.map((i) => (
              <li key={i.itemId}>
                {i.custom?.name ?? c.name(i.itemId)}
                {i.quantity > 1 && ` ×${i.quantity}`}
              </li>
            ))}
          </ul>
          <RuledArea />
        </section>
      </div>
      <PageFoot />
    </section>
  );
}
