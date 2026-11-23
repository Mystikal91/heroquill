import { aboutTab } from "../app/about";
import { language } from "../app/language";
import { leavePage, showView } from "../app/navigation";
import { VERSION } from "../app/version";
import { CHANGELOG, DISCORD_URL, ROADMAP, contributePath, newsPath, pick } from "../content/news";
import { type UiKey, ui } from "../i18n/ui";

const REPO_URL = "https://github.com/Mystikal91/heroquill";
const TABS = ["home", "roadmap", "changelog"] as const;

const SECTIONS = ["welcome", "flow", "share", "packs", "translation"] as const;

function Home() {
  return (
    <>
      {SECTIONS.map((section) => (
        <section key={section}>
          <h3>{ui(`about.home.${section}.title` as UiKey)}</h3>
          <p>{ui(`about.home.${section}.body` as UiKey)}</p>
          {section === "packs" && (
            <p>
              <button type="button" class="link" onClick={() => showView("packs")}>
                {ui("footer.packs")}
              </button>
            </p>
          )}
          {section === "translation" && (
            <p>
              <button type="button" class="link" onClick={() => showView("translate")}>
                {ui("footer.translate")}
              </button>
            </p>
          )}
        </section>
      ))}
      <section>
        <h3>{ui("about.home.version.title")}</h3>
        <p>{ui("about.home.version.body", { version: VERSION })}</p>
        <p>
          <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
            {ui("about.home.version.report")}
          </a>
          {" · "}
          <a href={contributePath(language.value)} target="_blank" rel="noopener noreferrer">
            {ui("about.contribute")}
          </a>
          {" · "}
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            {ui("about.discord")}
          </a>
          {" · "}
          <button type="button" class="link" onClick={() => showView("credits")}>
            {ui("footer.credits")}
          </button>
        </p>
      </section>
    </>
  );
}

/** The changelog and the roadmap are on the website too, where they can be linked and found. */
const OnTheWeb = () => (
  <p>
    <a href={newsPath(language.value)} target="_blank" rel="noopener noreferrer">
      {ui("about.onTheWeb")}
    </a>
  </p>
);

function Roadmap() {
  return (
    <>
      <p>{ui("about.roadmap.intro")}</p>
      <ul class="about-list">
        {ROADMAP.map((item) => (
          <li key={item.id}>{pick(item.text, language.value)}</li>
        ))}
      </ul>
      <OnTheWeb />
    </>
  );
}

function Changelog() {
  return (
    <>
      <p>{ui("about.changelog.intro")}</p>
      <OnTheWeb />
      {CHANGELOG.map((entry) => (
        <section key={entry.version}>
          <h3>
            {ui("about.changelog.version", { version: entry.version })}{" "}
            <small class="muted">{entry.date}</small>
          </h3>
          <ul class="about-list">
            {entry.notes.map((note) => (
              <li key={note.en}>
                {note.kind && (
                  <>
                    <span class="note-kind" data-kind={note.kind}>
                      [{ui(`about.changelog.kind.${note.kind}`)}]
                    </span>{" "}
                  </>
                )}
                {pick(note, language.value)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Home, roadmap and changelog: how the app works, what is missing, and what changed. */
export function AboutPage() {
  const current = aboutTab.value;
  return (
    <article class="card about">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>
        {ui("app.title")}
        <small class="muted"> v{VERSION}</small>
      </h2>
      <nav class="tabs" aria-label={ui("about.tabs")}>
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            class={`tab${current === tab ? " active" : ""}`}
            aria-current={current === tab ? "page" : undefined}
            onClick={() => {
              aboutTab.value = tab;
            }}
          >
            {ui(`about.tab.${tab}` as UiKey)}
          </button>
        ))}
      </nav>
      {current === "home" && <Home />}
      {current === "roadmap" && <Roadmap />}
      {current === "changelog" && <Changelog />}
    </article>
  );
}
