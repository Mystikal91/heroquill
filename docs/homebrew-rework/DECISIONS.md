# Homebrew rework — decisioni prese

Aggiornato il 2026-11-15. Vedi `RECON.md` per lo stato di partenza.

1. **Pubblico: due livelli.** Modalità guidata (pochi concetti, per i giocatori) + modalità avanzata che espone
   tutti gli effetti del motore.
2. **Formato: nuovo, versionato.** Si può ridisegnare liberamente; serve un numero di versione e un migratore
   dai pack attuali (`dnd-character-maker-pack`).
3. **Multilingua: sì.** Un pack può contenere testi in più lingue; si mostra la lingua dell'app con ripiego
   sulla lingua originale.
4. **Ambito: copertura totale.** Tutto ciò che Heroquill sa gestire (ogni kind di `ENTRY_KINDS` e ogni effetto
   di `EffectSchema`, più i campi `data.*` rilevanti) deve essere creabile e modificabile dall'editor.
   Conseguenza: l'editor deve essere **derivato dallo schema/motore**, non un elenco di form scritti a mano,
   e serve un controllo automatico (test) che segnali quando il motore ha un effetto/kind che l'editor non copre.

5. **Anteprima live: fondamentale.** Pannello di anteprima accanto al form (come appare la voce nella scheda / nel
   passo Crea), con avvisi su riferimenti rotti (`brokenReferences`) ed effetti incoerenti, fin dalle prime fasi.
6. **Pack = libro con metadati:** nome, autore, versione, descrizione, licenza, copertina opzionale.
7. **Condivisione: solo file** (`.dndpack.json` e pack che viaggiano col personaggio). Nessun download
   automatico, nessun link, nessuna libreria online.
8. **Copie da Aurora: sì, ma con restrizioni.** Una voce importata si può copiare in homebrew e modificare, ma
   la copia resta non esportabile (si tiene traccia dell'origine), per non aggirare il divieto di condividere
   contenuto di terzi.

9. **Condivisione su carta.** Un pack, una sua sezione o una singola voce devono poter essere stampati, per i
   master che creano varianti e le condividono al tavolo. Da valutare (da decidere nel piano):
   - **Stampa interna:** l'app ha già un sistema di stampa per la scheda (`src/ui/print/`, `window.print()`,
     `@page`, impaginazione con `FitBox`/`FitText`, carte per incantesimi). Si può riusarlo per voci homebrew.
   - **Export compatibile con Homebrewery:** file Markdown (dialetto Homebrewery) da aprire lì, già pronto per
     la stampa. Nel repo non c'è nulla di Markdown/Homebrewery oggi.
   - Possibile soluzione ibrida: un unico modello "voce -> blocchi di testo" da cui derivare entrambi.
   Questo "sola file" non viola la decisione 7: la stampa/export è un'uscita, non un servizio di condivisione.
10. **Riordino tra pack.** Deve essere possibile e comodo spostare le voci fra pacchetti: copia, taglia, incolla,
    sposta (anche multi-selezione, anche tra pack diversi). Implicazioni da tenere nel piano: gli id includono il
    prefisso del pack (`pack:kind/slug`), quindi spostare = rinominare l'id e aggiornare i riferimenti nelle altre
    voci, nei personaggi salvati (esiste un precedente: `migrateSavedCharacters` / `migrationMap`) e nelle voci
    figlie (tratti, feature, sottoclassi di una classe); la copia deve evitare collisioni di slug; annulla (`offerUndo`).

11. **Edizioni 2014/2024: proprietà della voce, non del pack.** Un pack è neutro e può contenere voci per
    entrambe le edizioni. Ogni voce ha un campo opzionale `ruleset`: entrambe (predefinito), solo 2014, solo 2024.
    - Per il principiante è quasi invisibile (selettore con "entrambe" già scelto).
    - **Riferimenti all'SRD neutri:** scegliere "Mago" o "Fireball" si salva come riferimento neutro, che si
      risolve nell'edizione del personaggio quando esiste un gemello (come oggi fanno `localizeSpells` /
      `spellFor2024` / `subclassOf`); dove non c'è gemello l'editor lo dice.
    - **Campi per edizione:** l'editor mostra solo ciò che vale per l'edizione della voce (es. specie 2024 senza
      aumenti di punteggio, che arrivano dal background; talenti 2024 con categorie e requisiti propri).
    - **Avvisi, non muri:** una voce per "entrambe" che usa qualcosa di una sola edizione viene segnalata
      nell'anteprima, con la proposta di restringerla.
    - Dati: campo opzionale `ruleset` sulla voce nel formato v2 (catalogo + migrazione). Niente pack legati a
      una sola edizione (obbligherebbe a duplicare e complicherebbe lo spostamento tra pack).

## Capisaldi (valgono per ogni scelta del rework)
- **Massima semplicità, soprattutto nella versione "principiante"**, e massima comodità d'uso.
- **Funzionalità, bellezza estetica, UX e QoL sono tutte al primo posto**: nessuna sacrificata alle altre.
- **PC come strumento principale** per questa sezione; da telefono è accettabile un'esperienza un po' più
  ingombra (ma deve restare utilizzabile). Si progetta desktop-first.

## Ancora aperto
Niente di bloccante: si passa al piano a fasi.
