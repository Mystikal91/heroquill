import { useEffect } from "preact/hooks";
import { language, localeChain } from "../app/language";
import { isPage, mode, showView, view } from "../app/navigation";
import {
  character,
  content,
  initStorage,
  loadError,
  openExample,
  storageReady,
} from "../app/store";
import { loadUserPacks, userPacks, userPacksReady } from "../app/userPacks";
import { loadContent } from "../content/browser";
import { DISCORD_URL } from "../content/news";
import { ui } from "../i18n/ui";
import { CharacterBar } from "./CharacterBar";
import { Credits } from "./Credits";
import "../app/translate";
import { startBackClose } from "../app/backClose";
import { monstersWanted } from "../app/rulesView";
import { VERSION } from "../app/version";
import { startKeepingAwake } from "../app/wakeLock";
import { AboutPage } from "./AboutPage";
import { AppMenu } from "./AppMenu";
import { AutoTranslatePage } from "./AutoTranslatePage";
import { CustomSpellDialog } from "./CustomSpellDialog";
import { CustomizeItemDialog } from "./CustomizeItemDialog";
import { ExplainDialog } from "./Explain";

import { InstallNotice } from "./InstallNotice";
import { ItemPickerDialog } from "./ItemPicker";
import { ModeBadge, ModeSwitch } from "./ModeSwitch";
import { ConfirmDialog, UndoNotice } from "./Notices";
import { PacksNotice } from "./PacksNotice";
import { PacksPage } from "./PacksPage";
import { QuickEditDialog } from "./QuickEdit";
import { Sheet } from "./Sheet";
import { PlayerTableChip } from "./TableChip";
import { DmMessageNotice, TableRequestCard } from "./TableRequest";
import { Tabs } from "./Tabs";
import { Tour } from "./Tour";
import { TransferDialog } from "./TransferDialog";
import { UpdateNotice } from "./UpdateNotice";
import { BuildTab } from "./build/BuildTab";
import { LevelUp } from "./build/LevelUp";
import { DmLoader } from "./dm/DmLoader";
import { QuillIcon } from "./icons";
import { PlayTab } from "./play/PlayTab";
import { RollToast } from "./play/RollToast";
import { PrintView } from "./print/PrintView";
import { RuleDialog } from "./rules/EntryDetail";
import { RulesPage } from "./rules/RulesPage";
import { SpellDialog } from "./spells/SpellInfo";
import { Studio } from "./studio/Studio";
import { PaperView } from "./studio/paper/PaperView";
import { useSlashSearch } from "./useSlashSearch";

function Screen() {
  switch (view.value) {
    case "credits":
      return <Credits />;
    case "packs":
      return <PacksPage />;
    case "homebrew":
      return <Studio />;
    case "homebrewPrint":
      return <PaperView />;
    case "translate":
      return <AutoTranslatePage />;
    case "dm":
      return <DmLoader />;
    case "about":
      return <AboutPage />;
    case "print":
      return <PrintView />;
    case "sheet":
      return <Sheet />;
    case "play":
      return <PlayTab />;
    case "rules":
      return <RulesPage />;
    default:
      return <BuildTab />;
  }
}

export function App() {
  useEffect(() => {
    void initStorage();
    void loadUserPacks();
    startKeepingAwake();
    startBackClose();
  }, []);

  // Rules texts follow the language; the old texts stay on screen until the new ones are loaded.
  const lang = language.value;
  const added = userPacks.value;
  const packsReady = userPacksReady.value;
  // A druid in a beast's shape needs the beast on every screen, for the numbers of the sheet.
  const monsters = monstersWanted.value || Boolean(character.value.play.wildShape);
  useEffect(() => {
    if (!packsReady) return;
    let current = true;
    loadContent(localeChain(lang), added, { monsters }).then(
      (loaded) => {
        if (current) content.value = loaded;
      },
      (error: unknown) => {
        loadError.value = String(error);
        console.error(error);
      },
    );
    return () => {
      current = false;
    };
  }, [lang, added, packsReady, monsters]);

  // A link from the welcome page (/app/#example) opens the example character once all is ready,
  // also when the app is already open and only the address changes.
  const ready = Boolean(content.value) && storageReady.value;
  useEffect(() => {
    if (!ready) return;
    const openFromLink = () => {
      if (location.hash !== "#example") return;
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      void openExample();
    };
    openFromLink();
    addEventListener("hashchange", openFromLink);
    return () => removeEventListener("hashchange", openFromLink);
  }, [ready]);

  // The tab names the character, so several open tabs can be told apart.
  const heading = character.value.name.trim();
  const appTitle = ui("app.title");
  useEffect(() => {
    document.title = heading ? `${heading} · ${appTitle}` : appTitle;
  }, [heading, appTitle]);

  useSlashSearch();

  // The character bar is part of the header, under the title (a slim row on a phone).
  const withBar = ready && !loadError.value && !isPage(view.value);

  return (
    <main class="shell">
      <button
        type="button"
        class="skip-link no-print"
        onClick={() => document.getElementById("content")?.focus()}
      >
        {ui("app.skip")}
      </button>
      <header class="app-header no-print" data-bar={withBar || undefined}>
        <div class="mode-slot">
          <ModeSwitch place="header" />
        </div>
        <div class="app-title">
          <h1>
            <button type="button" class="title-link" onClick={() => showView("about")}>
              {ui("app.title")}
            </button>
            <ModeBadge />
          </h1>
          <div class="title-ornament" aria-hidden="true">
            <QuillIcon />
          </div>
        </div>
        {withBar && <CharacterBar />}
        <div class="app-actions">
          {/* The online table: the DM page puts its own here (it is loaded only with that page). */}
          <div id="header-extra" class="header-extra" />
          {mode.value === "player" && ready && <PlayerTableChip />}
          <AppMenu />
        </div>
      </header>
      {loadError.value ? (
        <p role="alert">{ui("app.loadError")}</p>
      ) : !content.value || !storageReady.value ? (
        <p>{ui("app.loading")}</p>
      ) : (
        <div id="content" tabIndex={-1} class="content-anchor">
          {!isPage(view.value) && (
            <>
              <PacksNotice />
              <Tabs />
            </>
          )}
          <div class="screen" key={view.value}>
            <Screen />
          </div>
        </div>
      )}
      <RollToast />
      {mode.value === "player" && (
        <>
          <TableRequestCard />
          <DmMessageNotice />
        </>
      )}
      <UndoNotice />
      <ConfirmDialog />
      <UpdateNotice />
      <InstallNotice />
      <SpellDialog />
      <QuickEditDialog />
      <ExplainDialog />
      <RuleDialog />
      <ItemPickerDialog />
      <TransferDialog />
      <CustomSpellDialog />
      <CustomizeItemDialog />
      <LevelUp />
      <Tour />
      <footer class="site-footer no-print">
        <p>{ui("footer.unofficial")}</p>
        <p>
          <button type="button" class="link" onClick={() => showView("about")}>
            {ui("footer.about")}
          </button>
          {" · "}
          <a class="link" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          {" · "}
          <button type="button" class="link" onClick={() => showView("packs")}>
            {ui("footer.packs")}
          </button>
          {" · "}
          <button type="button" class="link" onClick={() => showView("translate")}>
            {ui("footer.translate")}
          </button>
          {" · "}
          <button type="button" class="link" onClick={() => showView("credits")}>
            {ui("footer.credits")}
          </button>
        </p>
        <p class="muted">v{VERSION}</p>
      </footer>
    </main>
  );
}
