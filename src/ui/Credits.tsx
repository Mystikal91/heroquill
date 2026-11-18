import { leavePage } from "../app/navigation";
import { content } from "../app/store";
import { ui } from "../i18n/ui";

const REPO_URL = "https://github.com/Mystikal91/heroquill";

/** The official translations of the SRD that the rules texts come from, by file code. */
const TRANSLATED_SRDS = [
  ["IT", "Italiano"],
  ["FR", "Français"],
  ["DE", "Deutsch"],
  ["ES", "Español"],
] as const;

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Attribution and licenses. The SRD attribution text is required by its license and stays in English. */
export function Credits() {
  // Packs the user added carry their own notes; only the content shipped with the app is credited.
  const attributions = [
    ...new Set(
      content.value?.packs
        .filter((p) => p.manifest.ruleset !== "custom")
        .map((p) => p.manifest.attribution),
    ),
  ];

  return (
    <article class="card credits">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("credits.title")}</h2>

      <h3>{ui("credits.rules")}</h3>
      <p>{ui("credits.rulesIntro")}</p>
      <ul>
        <li>
          <ExternalLink href="https://dnd.wizards.com/resources/systems-reference-document">
            System Reference Document 5.1
          </ExternalLink>
          {" — Wizards of the Coast"}
        </li>
        <li>
          <ExternalLink href="https://www.dndbeyond.com/srd">
            System Reference Document 5.2.1
          </ExternalLink>
          {" — Wizards of the Coast"}
        </li>
        <li>
          <ExternalLink href="https://creativecommons.org/licenses/by/4.0/legalcode">
            Creative Commons Attribution 4.0 International
          </ExternalLink>
        </li>
      </ul>
      {attributions.map((text) => (
        <blockquote key={text} lang="en">
          {text}
        </blockquote>
      ))}

      <h3>{ui("credits.legal")}</h3>
      <ul>
        <li>
          <a href="/privacy">{ui("credits.privacy")}</a>
        </li>
        <li>
          <a href="/terms">{ui("credits.terms")}</a>
        </li>
      </ul>

      <h3>{ui("credits.data")}</h3>
      <p>
        {ui("credits.dataText")}{" "}
        <ExternalLink href="https://github.com/5e-bits/5e-database">
          5e-bits/5e-database
        </ExternalLink>
        {" · "}
        <ExternalLink href="https://github.com/open5e/open5e-api">open5e/open5e-api</ExternalLink>
      </p>

      <h3>{ui("credits.translations")}</h3>
      <p>{ui("credits.translationsText")}</p>
      <ul>
        {TRANSLATED_SRDS.map(([code, name]) => (
          <li key={code}>
            <ExternalLink
              href={`https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1_${code}.pdf`}
            >
              {`SRD 5.1 — ${name}`}
            </ExternalLink>
          </li>
        ))}
        <li>
          <ExternalLink href="https://www.dndbeyond.com/srd">
            {"SRD 5.2.1 — Italiano, Français, Deutsch, Español"}
          </ExternalLink>
        </li>
      </ul>

      <h3>{ui("credits.design")}</h3>
      <p>{ui("credits.designText")}</p>
      <ul>
        <li>
          <ExternalLink href="https://www.dmsguild.com/en/product/232835/class-character-sheets-the-bundle">
            Class Character Sheets: The Bundle
          </ExternalLink>
          {" — Emmet Byrne"}
        </li>
      </ul>

      <h3>{ui("credits.fonts")}</h3>
      <p>{ui("credits.fontsText")}</p>

      <h3>{ui("credits.software")}</h3>
      <p>
        {ui("credits.softwareText")}{" "}
        <ExternalLink href={REPO_URL}>{ui("credits.source")}</ExternalLink>
      </p>
      <p>
        {ui("credits.qr")}{" "}
        <ExternalLink href="https://github.com/kazuhikoarase/qrcode-generator">
          qrcode-generator
        </ExternalLink>
      </p>
    </article>
  );
}
