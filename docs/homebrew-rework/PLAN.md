# Homebrew rework — bozza di piano a fasi

Bozza del 2026-11-15. Parte da `RECON.md` (com'è oggi) e `DECISIONS.md` (cosa vogliamo). Il rework resta su
`homebrew-rework`, non si pubblica finché non è finito: le singole fasi possono rompere la compatibilità.

## Principio guida
Ogni fase termina con qualcosa che si **vede e si prova** (fetta verticale), non con strati invisibili. I capisaldi
(semplicità per il principiante, funzionalità = estetica = UX = QoL, desktop-first) sono criteri di accettazione
di ogni fase, non una fase a sé.

## Fase 0 — Fondamenta del dato  ✅ fatta (2026-11-15, non ancora committata)
Realizzato: `src/storage/packFormat.ts` (versione 2, migratore a passi, rifiuto dei pack troppo nuovi), campi
nuovi nel record (`formatVersion`, `meta`, `translations`, `provenance`), `packTexts`/`packLanguages`,
`restrictedIds`/`withoutRestricted`, file `heroquill-pack` (il vecchio `dnd-character-maker-pack` si legge ancora),
`loadContent` che sceglie i testi per lingua, `mergeCarried`/`removeEntry` che portano con sé traduzioni e origini,
pack condivisi con un personaggio senza le voci riservate. Test in `src/storage/packFormat.test.ts`.
Rimandato: storage per voce (la misura ha senso solo con pack grandi nell'editor nuovo); UI per lingue/metadati.
Scelte prese: il record conserva `strings`+`lang` come lingua originale e aggiunge `translations` per le altre
(modifica additiva, migrazione 1→2 senza perdita); l'estensione del file resta `.dndpack.json`.
Obiettivo: decidere e fissare *cosa è* un pack, prima di costruirci sopra.
- **Pack v2 versionato** ("libro"): `formatVersion`, metadati (nome, autore, versione, descrizione, licenza,
  copertina opzionale), `origin` (nato qui / copiato da SRD / copiato da Aurora: serve per il divieto di export),
  voci, testi **multilingua** (`strings[lingua][idVoce.campo]`, lingua originale + ripiego).
- **Migratore** dal formato attuale (`dnd-character-maker-pack`, una lingua) al v2, applicato anche a ciò che c'è
  già in IndexedDB, nei file importati e nei pack dentro i file dei personaggi/backup.
- Storage: salvataggio per voce o per pack? (oggi si riscrive tutto il record) — da misurare, non da assumere.
- Aggiornare `loadContent` per leggere i testi per lingua.
- Test: round-trip, migrazione di pack di esempio, validazione.
Uscita: nuovo formato + migratore + test, senza UI nuova.

## Fase 1 — Il catalogo: l'editor deriva dal motore  ✅ fatta (2026-11-15, non ancora committata)
Realizzato, in `src/homebrew/catalog/`: `fields.ts` (piccolo linguaggio di descrizione dei campi + `checkValue`/
`checkFields`, validazione generica), `introspect.ts` (legge lo schema valibot del motore), `effects.ts`
(`EFFECT_META` esaustivo: un effetto nuovo nello schema non compila finché non lo si classifica; i campi di ogni
effetto vengono dallo schema stesso), `kinds.ts` (`KIND_META`, ruoli main/owned/vocabulary, cosa possiede cosa),
`data.ts` (`DATA_FIELDS`: tutto il `data` di ogni kind, scritto a mano ma **verificato contro ogni voce delle SRD**).
In `src/homebrew/entries.ts`: modifica diretta delle voci (`addEntry`, `updateEntry` che non ricostruisce nulla,
`setText` anche per le traduzioni, `ownedEntries`, `deleteEntry`, `newEntryId`, `entryProblems`).
Test di copertura: catalogo vs schema (kind ed effetti), vs dati SRD 5.1/5.2, vs gli schemi dati del motore
(item, classe, sottoclasse), vs ciò che produce l'editor attuale. Scoperte utili: `startingGold`, `proficiencyChoices`,
`subclassSpecific`, `dc.desc`, specie senza `size` (2024).
Non ancora coperto: l'output dell'importer Aurora (serve `AURORA_CORPUS`; da aggiungere al corpus test), e i campi
`json` opachi (`featureSpecific`, `traitSpecific`, azioni dei mostri, `forms`), da descrivere nella Fase 3.
Da fare nelle fasi successive: riferimenti portabili (vedi sotto), ricollegare le chiavi i18n dell'editor.
Obiettivo: niente più form scritti a mano per ogni kind/effetto.
- **Catalogo dichiarativo** dei kind di voce e dei tipi di effetto (campi, tipi, etichette, aiuti, livello
  "guidato" o "avanzato", in che kind sono ammessi), costruito sopra `schema.ts` e il motore.
- **Modifica diretta della voce** (non più bozza di stringhe + builder/inverse per kind): si edita l'`Entry`
  reale, quindi nessuna perdita al salvataggio.
- **Test di copertura**: fallisce se il motore ha un kind/effetto/campo `data.*` che il catalogo non descrive.
  È il nostro garante del requisito "tutto ciò che Heroquill gestisce".
- Inventario di ciò che il motore legge in `data` per ogni kind (oggi non è documentato in un posto solo).
Uscita: catalogo + test di copertura (e un'API interna per leggere/scrivere voci), ancora senza UI definitiva.

### Riferimenti portabili a contenuto di altri pack (aggiunto 2026-11-15; Fase 1-2)
Problema: una voce homebrew che punta a una voce Aurora usa l'id completo `imp<codice>:kind/slug`, e il codice
del pack Aurora è generato sul dispositivo (`importAuroraSources`), quindi chi riceve il pack homebrew ha quasi
sempre un id diverso e il riferimento si rompe (funziona solo se il contenuto Aurora arriva da backup/trasferimento
dallo stesso dispositivo, dove l'id si mantiene). Le voci copiate da Aurora sono "riservate" e non partono.
Da fare:
- Salvare nei riferimenti verso pack non-SRD una **chiave portabile** (id originale di Aurora dove c'è, `aids`;
  altrimenti tipo + nome) accanto all'id locale, e **ricollegarli** all'apertura sul dispositivo di chi riceve.
- Se il contenuto manca: avviso chiaro ("serve il pack X"), non errore; verificare che il motore tolleri i
  riferimenti non risolti senza rompere la scheda (oggi non verificato).
- L'editor mostra e segnala questi riferimenti (insieme agli avvisi sui riferimenti rotti), e l'export dichiara da
  quali pack esterni dipende il pack.
- Test: pack con riferimento ad Aurora esportato e letto su un dispositivo con id diverso (ricollegato) e senza
  il contenuto (avviso, scheda integra).

### Edizioni 2014/2024 (aggiunto 2026-11-15; decisione 11)
- Campo `ruleset` opzionale sulla voce (`srd51` | `srd52`; assente = entrambe): nel formato v2, nel catalogo,
  in `addEntry`/`updateEntry`, e nel caricamento (una voce "solo 2014" non appare a un personaggio 2024).
- Riferimenti neutri all'SRD nel selettore di voci, risolti per edizione con la logica già esistente
  (`localizeSpells`, `spellFor2024`, `subclassOf` in `engine/rulesets.ts`); segnalazione dei gemelli mancanti.
- Catalogo: campi marcati per edizione (es. specie: aumenti di punteggio solo 2014; talento: `category` e
  prerequisiti 2024), usati dall'editor per mostrare solo ciò che serve.
- Avvisi di compatibilità nel pannello avvisi della Fase 2.

## Fase 2 — Guscio dell'editor (desktop-first)  ✅ fatta nelle parti essenziali (2026-11-15, non committata)
Realizzato: `src/ui/studio/` (Studio, Library, EntryList, Editor, SpellForm, Preview, Controls, studio.css) e
`src/app/studio.ts` (sessione del pack aperto, salvataggio ritardato 700 ms, cronologia annulla/ripeti con unione
delle digitazioni in `src/homebrew/history.ts`, modalità Guidata/Avanzata ricordata, Ctrl+S / Ctrl+Z / Ctrl+Y).
Layout a 4 pannelli (biblioteca · elenco · editor · anteprima) che si impila sotto 1320 e 960 px. L'incantesimo è
il primo tipo completo sul nuovo editor; in Avanzata compaiono tutti gli altri campi del catalogo tramite il
renderer generico `FieldControl` (liste, oggetti, record, scelte). Anteprima dal vivo dell'incantesimo (anche non
salvato) e pannello Controlli (`src/homebrew/warnings.ts`). Metadati del pack (autore, versione, descrizione)
modificabili. Gli altri tipi aprono ancora il vecchio form dentro il nuovo guscio (ponte `legacyForm`); i tipi senza
editor (mostro, opzione, divinità...) non sono ancora creabili. Testi in 5 lingue (`studio.*`). Provato nel browser:
creazione pack, nuovo incantesimo, digitazione, annulla/ripeti, modalità avanzata con righe annidate, salvataggio in
IndexedDB (formato v2), ponte verso il vecchio form (specie).
Da rifinire (Fasi 3 e 7): messaggi di errore del catalogo ancora tecnici in inglese; id di una voce nuova fissato
al momento della creazione (`spell/spell` finché senza nome: sistemare con la riscrittura degli id della Fase 4);
anteprima solo per l'incantesimo (gli altri tipi usano la pagina Regole quando la voce è già caricata);
`ruleset` per voce non ancora implementato; ricerca/ordinamento/duplicazione avanzati; versione telefono da rifinire.

## Fase 2 (progetto originale) — Guscio dell'editor (desktop-first)
Obiettivo: l'ambiente in cui si lavora, bello e comodo, con un primo tipo di voce completo (fetta verticale).
- Layout a più pannelli: **libreria** (pack, sezioni per tipo) · **elenco voci** (ricerca, filtri, ordinamento)
  · **editor** · **anteprima**. Su telefono collassa in una navigazione a schermate.
- Interruttore **Guidato / Avanzato** per voce (e preferenza ricordata).
- Scorciatoie da tastiera, salvataggio automatico con annulla/ripristina, duplicazione veloce.
- Primo tipo end-to-end: incantesimo (semplice, già presente nell'attuale) come banco di prova del catalogo.
- Anteprima live v1 (come appare nel Regole/nella scheda) e pannello **avvisi** (riferimenti rotti con
  `brokenReferences`, campi mancanti, effetti incoerenti).
Uscita: si crea e si modifica un incantesimo nel nuovo editor, con anteprima e avvisi.

## Fase 3 — Tutti i tipi di voce e il costruttore di effetti
Obiettivo: copertura completa, nell'ordine in cui rendono di più.
1. Oggetti (armi, armature, equipaggiamento, **oggetti magici**: rarità, sintonia, effetti da equipaggiato).
2. Talenti, background, lingue, proprietà.
3. Specie, sottospecie/lineage, tratti, scelte di taglia/abilità.
4. Classi (tabelle livello per livello, risorse di classe, scelte, equipaggiamento iniziale) e sottoclassi
   (incantesimi sempre preparati/espansi, spellcasting proprio).
5. Opzioni (regole attivabili), divinità, mostri e compagni, e gli altri kind del catalogo.
- **Costruttore di effetti**: in modalità guidata frasi in linguaggio naturale ("Dà +1 alla CA mentre indossi
  un'armatura") con pochi campi; in avanzata l'elenco completo con `when`, `uses`, `spends`, ecc.
- A ogni kind: anteprima e avvisi specifici; test che il risultato funzioni davvero sulla scheda (motore).
Uscita: ogni kind del catalogo è creabile e modificabile.

## Fase 4 — Riordino tra pacchetti
- Selezione multipla; **copia, taglia, incolla, sposta**, anche trascinando tra pack; duplica.
- Lo spostamento cambia l'id (`pack:kind/slug`): aggiorna le voci figlie (tratti, feature, sottoclassi),
  i riferimenti in altre voci, i personaggi salvati (come `migrationMap` / `migrateSavedCharacters`), con anteprima
  di cosa cambierà e **annulla**.
- Gestione collisioni di slug e di dipendenze (spostare una classe porta con sé le sue feature; avviso se una
  sottoclasse resta orfana).
- Copia da SRD e da Aurora (quest'ultima resta non esportabile).
Uscita: un pannello di riordino comodo, con test sulle riscritture di id.

## Fase 5 — Carta: stampa e Homebrewery
- Decidere (prototipo breve di entrambe) tra **stampa interna** (riuso di `src/ui/print/`), **export Markdown per
  Homebrewery**, o **ibrido** con un unico modello "voce → blocchi" da cui derivarli.
- Ambiti: singola voce, sezione, pack intero; layout carta (A4/Letter come la scheda) e opzioni (colonne, copertina,
  indice).
- Per le voci con restrizioni (copie da Aurora) valgono le stesse regole dell'export di file: da stabilire se la
  stampa privata è ammessa.
Uscita: stampa/export funzionante per tutti i kind.

## Fase 6 — Integrazione con il resto dell'app
- Ricablare i punti d'ingresso: "Copia come nuovo" (Quick edit), "Personalizza" arma/armatura, "Scrivi
  incantesimo" da scheda (e il pack speciale `hbmyspells`).
- Pack che viaggiano col personaggio (`carried`), backup/trasferimento (`bundle`, `transfer`), Google Drive.
- Tag "homebrew" in picker, inventario, regole.
- i18n: nuove chiavi **solo in inglese** (`locales/en/ui.json`) più le 5 lingue per `news.ts`.
- Rimuovere il vecchio editor (`model.ts`, `HomebrewPage.tsx`, builder/inverse) e i suoi test.
- Aggiornare `docs/CONTENT_PACKS.md`, CHANGELOG e ROADMAP.

## Fase 7 — Rifinitura e prova sul campo
- Passata di UX/estetica sull'intero flusso (principiante vs. avanzato), accessibilità e tastiera.
- Prova con contenuto reale: ricreare a mano alcune voci note (una classe, una specie, un oggetto magico) e
  verificare che la scheda le applichi; prova su telefono.
- Prestazioni con pack grandi; lint, typecheck, test; poi si decide la pubblicazione.

## Rischi principali
1. **Catalogo troppo grande per essere semplice**: la modalità guidata deve restare piccola; si decide cosa
   è "guidato" con criteri chiari (frequenza d'uso) e si revisiona a ogni fase.
2. **Modifica diretta delle voci** richiede che ogni campo del motore sia gestito in modo sicuro (nessun JSON
   libero in guidata); l'avanzata può offrire un editor JSON validato come ultima risorsa.
3. **Riscrittura degli id** (riordino): è la parte con più rischio di corrompere personaggi; vanno test fitti e
   annulla affidabile.
4. **Multilingua**: UX da progettare con cura (un testo, tante lingue) per non appesantire il principiante.
5. **Dimensione**: è un lavoro grande; le fasi 0-2 sono la base, e dopo la fase 2 si può già fare una versione
   interna provabile.

## Decisioni che prenderemo dentro le fasi (non ora)
- Storage per pack o per voce (fase 0).
- Quali effetti sono "guidati" e come si formulano (fase 1/3).
- Stampa interna vs Homebrewery vs ibrido (fase 5).
- Fedeltà dell'anteprima: riuso dei componenti reali di Regole/Scheda o resa dedicata (fase 2).

## Ordine e parallelismo
Fase 0 → 1 → 2 in sequenza (sono la spina dorsale). Dopo la fase 2, le fasi 3 (tipo per tipo), 4 e 5 possono
procedere in parallelo, su file diversi. La fase 6 chiude, la 7 rifinisce.
