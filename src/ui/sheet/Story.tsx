import { character, content } from "../../app/store";
import type { Story } from "../../engine/character";
import { type UiKey, ui } from "../../i18n/ui";
import { QuillIcon } from "../icons";
import { Panel } from "./parts";

const LOOKS = ["age", "height", "weight", "eyes", "skin", "hair"] as const;
const TEXTS = [
  "personalityTraits",
  "ideals",
  "bonds",
  "flaws",
  "appearance",
  "backstory",
  "allies",
  "enemies",
  "notes",
] as const satisfies readonly (keyof Story)[];

/** What the player wrote about the character. Hidden until something is written. */
export function StoryPanel() {
  const c = content.value;
  const story = character.value.story;
  if (!c) return null;
  const looks = LOOKS.filter((f) => story[f].trim());
  const texts = TEXTS.filter((f) => story[f].trim());
  const deity = story.deity ? c.name(story.deity) : "";
  if (looks.length === 0 && texts.length === 0 && !deity) return null;

  return (
    <Panel title={ui("sheet.story")} tint="story" icon={QuillIcon}>
      {deity && (
        <p class="story-looks">
          <span>
            <span class="muted">{ui("story.deity")}</span> {deity}
          </span>
        </p>
      )}
      {looks.length > 0 && (
        <p class="story-looks">
          {looks.map((f) => (
            <span key={f}>
              <span class="muted">{ui(`print.field.${f}` as UiKey)}</span> {story[f]}
            </span>
          ))}
        </p>
      )}
      <dl class="story-list">
        {texts.map((f) => (
          <div key={f}>
            <dt>{ui(`story.${f}` as UiKey)}</dt>
            <dd>{story[f]}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
