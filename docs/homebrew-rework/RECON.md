# Homebrew rework — ricognizione dello stato attuale

Note di lavoro (branch `homebrew-rework`, partito da `main` @ ee11c31, v1.30.1 beta).
Scritte il 2026-11-15. Servono come memoria per la pianificazione: non sono documentazione utente.

## 1. Mappa dei file

| Area | File | Righe |
| --- | --- | --- |
| Modello (form -> entry) | `src/homebrew/model.ts` | 818 |
| Copia di una voce SRD in bozza | `src/homebrew/copy.ts` | 39 |
| Stato/azioni dell'editor | `src/app/homebrew.ts` | 108 |
| Pagina editor + primitive di form | `src/ui/HomebrewPage.tsx` | 844 |
| Persistenza pack (IndexedDB), export/import file | `src/storage/packs.ts` | 170 |
| Signal `userPacks`, import Aurora, export | `src/app/userPacks.ts` | 342 |
| Personalizza arma/armatura dall'inventario | `src/app/customizeItem.ts`, `src/ui/CustomizeItemDialog.tsx` | 139 + 247 |
| Incantesimo scritto dalla scheda | `src/app/customSpell.ts`, `src/ui/CustomSpellDialog.tsx` | 56 + 65 |
| Pagina Packs (Aurora, personal) | `src/ui/PacksPage.tsx` | 325 |
| Caricamento contenuti + ordine dei pack | `src/content/browser.ts` (`loadContent`) | |
| Pack che viaggiano col personaggio | `src/app/carry.ts`, `src/storage/carried.ts` | |
| Backup/trasferimento | `src/app/transfer.ts`, `src/storage/bundle.ts` | |
| Schema entry/effetti (valibot) | `src/data/schema.ts` | 537 |
| Documentazione pack | `docs/CONTENT_PACKS.md` | 274 |
| Test | `src/homebrew/*.test.ts` (20 test), `customSpell.test.ts` (2) | |

Nota: "feature personalizzate" del personaggio (`src/engine/custom.ts`, `CustomFeaturesPanel`) e "oggetto
personalizzato" (`ui/build/CustomItem.tsx`) sono un meccanismo **separato**: vivono nel personaggio, non in un pack.

## 2. Come funziona oggi

**Dato.** Un pack homebrew è un `UserPackRecord` {id `hb<base36 timestamp>`, name, origin `"homebrew"`,
pack{manifest(ruleset `"custom"`), entries[]}, strings{`<entryId>.<campo>`: testo}, lang}. Una sola lingua
per pack (`lang: "en"` di default, i testi sono quelli scritti dall'utente). Gli id sono `pack:kind/slug`.
Un pack homebrew vale per **tutte** le edizioni (2014 e 2024).

**Editor.** Un `Draft` = {kind, values: Record<string,string>, traits[]}. Tutto è stringa (checkbox `"true"`/`""`,
liste separate da virgola). `buildDraft` traduce il draft in `Entry[]` + `strings`; `draftFromEntry` fa il
percorso inverso. I due sono **scritti a mano, kind per kind, e devono restare simmetrici**: l'edit di una voce
ricostruisce il draft dall'entry, quindi tutto ciò che il form non sa rappresentare viene **perso al
salvataggio** (es. effetti aggiunti da un import, `copyOf`, ecc. — sono preservati solo dove il codice se li porta dietro).
Salvare = `removeEntry` + `buildDraft` + riscrittura dell'intero record in IndexedDB.

**Tipi supportati (11):** spell, weapon, armor, gear, property, language, feat, species, background, class, subclass.
Weapon/armor/gear sono tutti `kind: "item"`.

**Punti di ingresso:** pagina "Homebrew" (menu app), "Copia come nuovo" da Quick edit (`copyAsNewHomebrew`),
"Personalizza" arma/armatura dall'inventario (salva nel primo pack homebrew, o ne crea uno), "Scrivi incantesimo"
dalla lista incantesimi di una classe (pack speciale `hbmyspells`).

**Condivisione:** export `.dndpack.json` (`format: "dnd-character-maker-pack"`), import file, e i pack usati
da un personaggio viaggiano nel file del personaggio (`homebrewUsedBy`, `mergeCarried`: aggiunge solo ciò che manca,
non sovrascrive). Link di condivisione del personaggio NON porta i pack. Bundle di backup include i pack homebrew.

**Ordine di applicazione:** SRD built-in -> pack `personal` (Aurora) -> pack `homebrew` -> `edits` (quick edit).
Gli id non collidono mai (prefissi diversi): l'ordine conta solo per i testi.

## 3. Il divario tra editor e motore (il cuore del rework)

Il motore sa applicare ~33 tipi di effetto dichiarativi (`schema.ts`): abilityBonus, proficiency, trait, choice,
grantSpell, modifier (11 target, 8 condizioni), movement, sense, defense, conditionImmunity, uses, spends, resource,
extraAttack, extraDamage, selfHeal, checkBoost, critRange, d20Floor, halfProficiency, expertise, unarmoredDefense,
unarmedStrike, weaponAbility, weaponMastery, abilityFloor, spellDamage, spellHealing, featureValue, attunementMax,
size, flag, e `when` (condizione composita, annidabile). Più `data.*` per gli item (rarity, enhancement,
attunement, enchants, ...) e opzioni (`option` con `replaces`, `backgroundFeature`).

L'editor ne produce **solo 4**: `abilityBonus`, `proficiency`, `trait` (come solo testo, senza effetti), `choice`
(skill di classe, lingue di background). Conseguenze concrete:

- Una **feature** (di classe, sottoclasse, specie) è solo nome + testo + livello: `effects: []` sempre. Niente
  modificatori, risorse/usi, resistenze, sensi, movimento, extra attack, incantesimi concessi, scelte...
- La roadmap in `news.ts` (id `homebrew`) già promette: "effetti dei privilegi, incantesimi di sottoclasse e più
  tipi di voci". Il rework realizza questa promessa.
- Un **feat** ha al massimo un bonus a un'abilità + un prerequisito di abilità (niente prerequisiti di livello/
  feature/spell, niente scelte, niente effetti).
- **Specie:** niente sottospecie/lineage, niente taglia a scelta, niente movimento/sensi/resistenze come effetti
  veri (si scrivono nel testo di un tratto). Taglia solo tiny..large (il motore conosce fino a gargantuan).
- **Classe:** tabelle slot solo standard (full/half/pact), `classSpecific` sempre `{}` (niente risorse di classe:
  ki, rage, ecc.), niente `startingChoices`/`startingEquipment`/`startingWealth`, niente scelte di sottoclasse a
  livello arbitrario, ASI come lista di livelli, cantrip/spell conosciuti con formule fisse.
- **Sottoclasse:** solo terzo di incantatore; `spells: []` sempre (nonostante il motore supporti spell sempre
  preparati, `expanded` ecc.).
- **Item:** armi/armature/gear base. Non esiste: oggetti magici con effetti da equipaggiato (il motore li
  supporta: "un anello che dà +1 CA e una resistenza"), attunement, rarity, cariche, pozioni, veicoli, ecc.
  `rarity`/`attunement` non sono nel form (arrivano solo dall'import Aurora). `enhancement` max +3, `magical` sì.
- **Kind non editabili** pur esistendo nello schema: `subspecies`, `feature` (solo come figlie), `option`,
  `monster`, `deity`, `condition`, `alignment`, `skill`, `school`, `ability`, `proficiency`.
  Un Aurora import produce monster/deity/option; l'editor non li sa aprire.
- Nessun modo di **vedere/capire** gli effetti: l'editor non mostra un'anteprima della scheda/entry risultante né
  segnala errori di riferimento rotto (`brokenReferences` esiste in schema ma non è collegato all'editor).

## 4. Limiti strutturali del design attuale

1. **`Draft` piatto di stringhe + builder per-kind.** Ogni nuovo campo = toccare `Draft`, `buildDraft`,
   `draftFromEntry`, `Fields` (UI), chiavi i18n `hb.f.*` (75!) in 5 lingue. Non scala verso "tutti gli effetti".
2. **Round-trip con perdita.** Modificare una voce ricostruisce l'entry da zero dal form: qualsiasi dato che il form
   non conosce sparisce. Con un editor di effetti generico questo va risolto alla radice (editare l'entry, non il draft).
3. **Una lingua per pack** (`lang`), testi mischiati in `strings` con chiave `id.campo`. Nessun supporto a
   traduzioni multiple dello stesso pack (le SRD hanno 5 lingue).
4. **Persistenza grossolana:** ogni salvataggio riscrive tutto il record; nessuna cronologia/versione, nessun
   id stabile oltre allo slug del nome (`freshId` unico nel pack; rinominare non cambia id, ok).
5. **UI monopagina:** lista di entry + un solo form modale-inline; nessuna ricerca, ordinamento, raggruppamento per
   tipo, duplicazione, spostamento tra pack, né vista d'insieme di un pack (es. una classe con le sue sottoclassi).
6. **Tre/quattro percorsi di creazione paralleli** (pagina, copia da Quick edit, Personalizza item, incantesimo
   da scheda) che riusano le primitive di `HomebrewPage.tsx` (`Text`, `Num`, `Pick`, `Check`, `FormApi`) importate
   da altri dialog: l'accoppiamento è tra UI, quindi rifare il form obbliga a rifare anche questi.
7. **Dipendenze dal contenuto caricato:** `saveHomebrewEntry` passa `languages`/`skills` dal contenuto per le scelte.
   Riferimenti ad altri entry (spell, classi, item) sono liste di slug/id nei form, non selettori con ricerca
   uniforme (`entriesOfKind` in `ui/build/fields`).
8. **Identità dei pack:** `PERSONAL_SPELLS_PACK` (`hbmyspells`) è un id speciale cablato; "primo pack homebrew" è
   la regola implicita per Personalizza/Copia. Con più pack diventa ambiguo dove finiscono le cose.
9. **Test sottili:** 20 test sul modello, nessuno sulla UI dell'editor (c'è solo `ui/smoke.test.ts`).
10. **Sicurezza/validazione file importati:** `parsePack` valida lo schema, ma niente controlli su dimensione,
    riferimenti rotti o effetti incoerenti al momento dell'import del `.dndpack.json`.

## 5. Cosa NON toccare (vincoli già emersi)

- Formato pack `dnd-character-maker-pack` e ids `pack:kind/slug`: il pack può essere condiviso e i personaggi
  puntano agli id. Poiché il rework non verrà pubblicato finché non è finito, il formato può evolvere, ma
  conviene decidere presto se serve migrazione dei pack esistenti dell'utente (Mario ha dei pack di prova?).
- Lo schema degli effetti è l'interfaccia col motore ("estendere deliberatamente, un tipo alla volta"):
  l'editor dovrebbe **derivare** da `EffectSchema`, non duplicarlo.
- Pack Aurora (`personal`) non esportabili: l'editor non deve permettere di copiarli in un pack esportabile.
- Ordine di applicazione SRD -> personal -> homebrew -> edits.
- Regole del repo (CONTRIBUTING): codice e commenti in inglese; stringhe nuove solo in `locales/en/ui.json`;
  una riga in `CHANGELOG` (`src/content/news.ts`, 5 lingue); lint (Biome), typecheck, test.

## 6. Domande aperte da decidere con l'utente

1. Obiettivo del rework: editor "per giocatori" (guidato, pochi concetti) o "per autori" (potente, vicino al JSON
   degli effetti), o entrambi a livelli (semplice + modalità avanzata)?
2. Mantenere il formato pack attuale (retrocompatibile) o definirne uno nuovo con versione e migrazione?
3. Traduzioni dentro un pack (multi-lingua) sì/no?
4. Ambito dei tipi di voce: aggiungere subspecies, option, monster, deity, oggetti magici, ecc.?
5. Anteprima live ("come apparirà sulla scheda / nel passo Crea") e validazione: quanto in alto in priorità?
6. Un pack = un "libro" (con più autori/versione/licenza) oppure resta una cartella personale?
7. Condivisione: solo file, o anche link/libreria pubblica (oggi esplicitamente no: nessun download automatico)?
8. Importer Aurora e editor: l'utente deve poter aprire/modificare in homebrew le voci importate (copia)?
