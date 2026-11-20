// The guide to the blank character sheet: the fillable PDFs to download (site/sheets.mjs) and how a
// D&D 5e character sheet is filled in, by the rules, step by step, in every language. A section is a
// heading and a list of blocks, as in guides.mjs: a string is a paragraph, an array is a list.
// `downloads` is the box at the top: the two editions, each with its files.

export const SHEET_GUIDE = {
  en: {
    label: "Blank character sheet (PDF)",
    title: "Free Fillable D&D 5e Character Sheet PDF (2014 and 2024) and How to Fill It In",
    desc: "Download a free blank D&D 5e character sheet as a fillable PDF, for the 2014 or the 2024 rules, and learn how to fill it in step by step: ability scores, skills, armor class, hit points, attacks and spells.",
    h1: "Fillable D&D 5e character sheet, and how to fill it in",
    intro:
      "A free blank character sheet for Dungeons & Dragons 5th edition, as a PDF you can fill in on the computer or print and fill by hand, for the 2014 rules and for the 2024 ones. Below the download, a step-by-step guide to filling it in by the rules of the game.",
    cta: "Rather not work out the numbers? Heroquill fills in the sheet for you.",
    downloads: {
      heading: "Download the blank sheet",
      text: [
        "Five pages: the character sheet, the story and equipment page, a page for features and traits, and two pages for spells (the spells by level, with slots and boxes for the prepared ones, then room to copy out six spells). Every number, name, line and box is a field: open the file in any PDF reader (your browser, Acrobat, Preview) to type in it, or print it.",
      ],
      editions: {
        2014: {
          name: "2014 rules",
          note: "The 5th edition as it was first published (Player's Handbook 2014, SRD 5.1): race and subrace, background with personality traits.",
        },
        2024: {
          name: "2024 rules",
          note: "The revised 5th edition (Player's Handbook 2024, SRD 5.2.1): species, a background that gives ability increases and an Origin feat, weapon mastery, Heroic Inspiration.",
        },
      },
      papers: { a4: "Download the PDF (A4)", letter: "Download the PDF (US Letter)" },
    },
    sections: [
      [
        "Make three choices first",
        [
          "A character is a species (called race in the 2014 rules), a class and a background. Read them in the rules before writing anything: almost every number on the sheet comes from them. Write the name, the species, the class with the level (a new character is level 1), the background and the alignment in the header.",
        ],
      ],
      [
        "Ability scores",
        [
          "The six abilities are Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma. Give them a score in one of three ways, as your table prefers:",
          [
            "the standard array: 15, 14, 13, 12, 10 and 8, one to each ability;",
            "point buy: every score starts at 8 and you have 27 points to raise them, up to 15 (a 9 costs 1 point, a 13 costs 5, a 14 costs 7, a 15 costs 9);",
            "rolling: roll four six-sided dice, keep the three highest and add them; do it six times and place the results.",
          ],
          "Then add the increases: in the 2014 rules they come from the race (for example +2 to one ability and +1 to another), in the 2024 rules from the background (+2 to one of its three abilities and +1 to another, or +1 to all three). No score goes above 20.",
        ],
      ],
      [
        "Modifiers",
        [
          "Each score has a modifier, written under it in the oval: subtract 10 from the score, divide by 2 and round down. A 10 or 11 is +0, 12 or 13 is +1, 14 or 15 is +2, 16 or 17 is +3, 18 or 19 is +4, 20 is +5; an 8 or 9 is −1. The modifiers are what you add to the dice, so most of the sheet is built on them.",
        ],
      ],
      [
        "Proficiency bonus",
        [
          "Write the proficiency bonus in the first circle: +2 from level 1 to 4, +3 from 5 to 8, +4 from 9 to 12, +5 from 13 to 16 and +6 from 17 to 20. You add it to everything your character is trained in.",
        ],
      ],
      [
        "Saving throws and skills",
        [
          "Your class gives you proficiency in two saving throws, and the class and the background give you skills (the background two, the class two to four of a list). Tick the box of each one you are proficient in.",
          "The number beside a saving throw or a skill is the modifier of its ability, plus the proficiency bonus if the box is ticked. Some features double the proficiency bonus in a skill you choose. Passive Perception is 10 plus your Perception bonus; passive Insight and Investigation work the same way.",
        ],
      ],
      [
        "Armor class, initiative and speed",
        [
          "Armor class is how hard you are to hit:",
          [
            "without armor, 10 plus your Dexterity modifier;",
            "light armor: the armor's number plus your Dexterity modifier;",
            "medium armor: the armor's number plus your Dexterity modifier, at most +2;",
            "heavy armor: the armor's number, Dexterity does not count;",
            "a shield adds 2; some classes have their own way of counting it without armor (the barbarian and the monk).",
          ],
          "Initiative is your Dexterity modifier. Speed comes from your species: 30 feet for most of them.",
        ],
      ],
      [
        "Hit points and hit dice",
        [
          "Each class has a hit die: d6 for the sorcerer and the wizard; d8 for the bard, cleric, druid, monk, rogue and warlock; d10 for the fighter, paladin and ranger; d12 for the barbarian. At level 1 your maximum hit points are the highest number of that die plus your Constitution modifier. At every level after, add a roll of the die (or its average rounded up: 4, 5, 6 or 7) plus the Constitution modifier.",
          "You have as many hit dice as your level: write them as, for example, 3d8. Current and temporary hit points are written in pencil as you play, and the death save boxes are ticked only when you fall to 0.",
        ],
      ],
      [
        "Attacks",
        [
          "For each weapon write its attack bonus and its damage. The attack bonus is the Strength modifier for a melee weapon or the Dexterity modifier for a ranged one (a finesse weapon lets you choose), plus the proficiency bonus if your class or species is proficient with that weapon. The damage is the weapon's die plus the same modifier: a longsword with Strength 16 is +5 to hit at level 1 and 1d8+3 slashing damage.",
          "In the 2024 rules, write in the Mastery column the mastery property of the weapons your class lets you use it with.",
        ],
      ],
      [
        "Spellcasting",
        [
          "If your class casts spells, its spellcasting ability is Intelligence for the wizard, Wisdom for the cleric, druid and ranger, and Charisma for the bard, paladin, sorcerer and warlock. Then:",
          [
            "spell save DC = 8 + proficiency bonus + the ability's modifier;",
            "spell attack bonus = proficiency bonus + the ability's modifier;",
            "the spell slots of each level come from your class table: write them, and tick a box each time you use one;",
            "write your cantrips and spells on the spell pages, and tick the ones you have prepared if your class prepares them.",
          ],
        ],
      ],
      [
        "Proficiencies, features and equipment",
        [
          "Write the armor, weapons and tools you are proficient with and the languages you speak (everyone speaks Common, plus what the species and the background add). Under features and traits, list what the species, the class and the background give you, with the uses of each one that has a limited number of uses. In the 2024 rules the background also gives an Origin feat.",
          "Your class and background give a starting equipment (or gold to buy it): list it on the story and equipment page, with the coins.",
        ],
      ],
      [
        "The story page",
        [
          "Age, height, appearance, allies and the story of your character are free to write. In the 2014 rules, the background suggests personality traits, an ideal, a bond and a flaw: choose them or write your own. They help you play the character, and the Dungeon Master can reward them with Inspiration.",
        ],
      ],
      [
        "When you go up a level",
        [
          "Add hit points and a hit die, look at the class table for new features, spell slots and spells, and raise the proficiency bonus at levels 5, 9, 13 and 17. A higher proficiency bonus changes the saving throws, the skills, the attacks and the spell numbers it is part of: write them again.",
        ],
      ],
      [
        "Or let Heroquill fill it in",
        [
          "Heroquill is a free character creator that does all of this for you: choose the species, the class and the background, and it works out every number of this guide, with feats, multiclassing and level ups. It prints the same sheet already filled in, or gives it to you as a fillable PDF, and you can play the character on the same screen with hit points, spell slots, rests and dice. It is free, needs no account and works offline.",
        ],
      ],
    ],
  },

  it: {
    label: "Scheda in bianco (PDF)",
    title: "Scheda personaggio D&D 5e compilabile in PDF gratis (2014 e 2024) e come compilarla",
    desc: "Scarica gratis la scheda del personaggio di D&D 5e in bianco, in PDF compilabile, per le regole 2014 o 2024, e impara a compilarla passo per passo: caratteristiche, abilità, Classe Armatura, punti ferita, attacchi e incantesimi.",
    h1: "Scheda personaggio D&D 5e compilabile, e come si compila",
    intro:
      "Una scheda del personaggio di Dungeons & Dragons quinta edizione in bianco e gratuita, in PDF da compilare al computer o da stampare e riempire a mano, per le regole 2014 e per quelle 2024. Sotto i download, una guida passo per passo per compilarla secondo le regole del gioco.",
    cta: "Preferisci non fare i conti? Heroquill compila la scheda per te.",
    downloads: {
      heading: "Scarica la scheda in bianco",
      text: [
        "Cinque pagine: la scheda del personaggio, la pagina di storia ed equipaggiamento, una pagina per privilegi e tratti e due pagine per gli incantesimi (gli incantesimi per livello, con gli slot e le caselle per quelli preparati, poi lo spazio per ricopiarne sei). Ogni numero, nome, riga e casella è un campo: apri il file in qualsiasi lettore PDF (il browser, Acrobat, Anteprima) per scriverci, oppure stampalo.",
      ],
      editions: {
        2014: {
          name: "Regole 2014",
          note: "La quinta edizione come è uscita la prima volta (Manuale del Giocatore 2014, SRD 5.1): razza e sottorazza, background con tratti della personalità.",
        },
        2024: {
          name: "Regole 2024",
          note: "La quinta edizione rivista (Manuale del Giocatore 2024, SRD 5.2.1): specie, un background che dà gli aumenti di caratteristica e un talento di origine, maestria delle armi, Ispirazione eroica.",
        },
      },
      papers: { a4: "Scarica il PDF (A4)", letter: "Scarica il PDF (US Letter)" },
    },
    sections: [
      [
        "Prima fai tre scelte",
        [
          "Un personaggio è una specie (razza nelle regole 2014), una classe e un background. Leggili nelle regole prima di scrivere: quasi ogni numero della scheda viene da lì. Nell'intestazione scrivi il nome, la specie, la classe con il livello (un personaggio nuovo è di livello 1), il background e l'allineamento.",
        ],
      ],
      [
        "Punteggi di caratteristica",
        [
          "Le sei caratteristiche sono Forza, Destrezza, Costituzione, Intelligenza, Saggezza e Carisma. Dai a ognuna un punteggio in uno di questi tre modi, come preferisce il tuo tavolo:",
          [
            "la serie standard: 15, 14, 13, 12, 10 e 8, uno per caratteristica;",
            "l'acquisto a punti: ogni punteggio parte da 8 e hai 27 punti per alzarli fino a 15 (un 9 costa 1 punto, un 13 ne costa 5, un 14 ne costa 7, un 15 ne costa 9);",
            "i dadi: tira quattro dadi a sei facce, tieni i tre più alti e sommali; fallo sei volte e assegna i risultati.",
          ],
          "Poi aggiungi gli aumenti: nelle regole 2014 vengono dalla razza (per esempio +2 a una caratteristica e +1 a un'altra), nelle regole 2024 dal background (+2 a una delle sue tre caratteristiche e +1 a un'altra, oppure +1 a tutte e tre). Nessun punteggio supera 20.",
        ],
      ],
      [
        "Modificatori",
        [
          "Ogni punteggio ha un modificatore, che si scrive sotto l'ovale: togli 10 al punteggio, dividi per 2 e arrotonda per difetto. 10 o 11 vale +0, 12 o 13 vale +1, 14 o 15 vale +2, 16 o 17 vale +3, 18 o 19 vale +4, 20 vale +5; 8 o 9 vale −1. I modificatori sono ciò che aggiungi ai dadi, per questo quasi tutta la scheda si basa su di loro.",
        ],
      ],
      [
        "Bonus di competenza",
        [
          "Scrivi il bonus di competenza nel primo cerchio: +2 dal livello 1 al 4, +3 dal 5 all'8, +4 dal 9 al 12, +5 dal 13 al 16 e +6 dal 17 al 20. Lo aggiungi a tutto ciò in cui il personaggio è addestrato.",
        ],
      ],
      [
        "Tiri salvezza e abilità",
        [
          "La classe ti dà la competenza in due tiri salvezza, e classe e background ti danno delle abilità (il background due, la classe da due a quattro scelte da un elenco). Segna la casella di ognuna in cui hai competenza.",
          "Il numero accanto a un tiro salvezza o a un'abilità è il modificatore della sua caratteristica, più il bonus di competenza se la casella è segnata. Alcuni privilegi raddoppiano il bonus di competenza in un'abilità a scelta. La Percezione passiva è 10 più il tuo bonus di Percezione; Intuizione e Indagare passive funzionano allo stesso modo.",
        ],
      ],
      [
        "Classe Armatura, iniziativa e velocità",
        [
          "La Classe Armatura dice quanto è difficile colpirti:",
          [
            "senza armatura, 10 più il modificatore di Destrezza;",
            "armatura leggera: il valore dell'armatura più il modificatore di Destrezza;",
            "armatura media: il valore dell'armatura più il modificatore di Destrezza, al massimo +2;",
            "armatura pesante: il valore dell'armatura, la Destrezza non conta;",
            "lo scudo aggiunge 2; alcune classi hanno un loro modo di contarla senza armatura (il barbaro e il monaco).",
          ],
          "L'iniziativa è il modificatore di Destrezza. La velocità viene dalla specie: 9 metri per la maggior parte.",
        ],
      ],
      [
        "Punti ferita e Dadi Vita",
        [
          "Ogni classe ha un Dado Vita: d6 per lo stregone e il mago; d8 per bardo, chierico, druido, monaco, ladro e warlock; d10 per guerriero, paladino e ranger; d12 per il barbaro. Al livello 1 i punti ferita massimi sono il numero più alto di quel dado più il modificatore di Costituzione. A ogni livello successivo aggiungi un tiro del dado (o la sua media arrotondata per eccesso: 4, 5, 6 o 7) più il modificatore di Costituzione.",
          "Hai tanti Dadi Vita quanto è il tuo livello: scrivili per esempio come 3d8. I punti ferita attuali e temporanei si scrivono a matita durante il gioco, e le caselle dei tiri salvezza contro la morte si segnano solo quando scendi a 0.",
        ],
      ],
      [
        "Attacchi",
        [
          "Per ogni arma scrivi il bonus di attacco e i danni. Il bonus di attacco è il modificatore di Forza per un'arma da mischia o di Destrezza per un'arma a distanza (un'arma accurata ti lascia scegliere), più il bonus di competenza se la tua classe o specie ha competenza in quell'arma. I danni sono il dado dell'arma più lo stesso modificatore: una spada lunga con Forza 16 al livello 1 è +5 per colpire e 1d8+3 danni taglienti.",
          "Nelle regole 2024, scrivi nella colonna Maestria la proprietà di maestria delle armi con cui la tua classe ti permette di usarla.",
        ],
      ],
      [
        "Incantesimi",
        [
          "Se la tua classe lancia incantesimi, la sua caratteristica da incantatore è Intelligenza per il mago, Saggezza per chierico, druido e ranger, Carisma per bardo, paladino, stregone e warlock. Poi:",
          [
            "CD del tiro salvezza degli incantesimi = 8 + bonus di competenza + modificatore della caratteristica;",
            "bonus di attacco con incantesimo = bonus di competenza + modificatore della caratteristica;",
            "gli slot di ogni livello vengono dalla tabella della classe: scrivili, e segna una casella ogni volta che ne usi uno;",
            "scrivi trucchetti e incantesimi nelle pagine degli incantesimi, e segna quelli preparati se la tua classe li prepara.",
          ],
        ],
      ],
      [
        "Competenze, privilegi ed equipaggiamento",
        [
          "Scrivi le armature, le armi e gli strumenti in cui hai competenza e le lingue che parli (tutti parlano il Comune, più quelle date da specie e background). In privilegi e tratti elenca ciò che ti danno la specie, la classe e il background, con gli usi di quelli che si possono usare un numero limitato di volte. Nelle regole 2024 il background dà anche un talento di origine.",
          "Classe e background danno un equipaggiamento iniziale (o le monete per comprarlo): elencalo nella pagina di storia ed equipaggiamento, insieme alle monete.",
        ],
      ],
      [
        "La pagina della storia",
        [
          "Età, altezza, aspetto, alleati e la storia del personaggio sono liberi. Nelle regole 2014 il background suggerisce tratti della personalità, un ideale, un legame e un difetto: scegli quelli proposti o scrivi i tuoi. Aiutano a interpretare il personaggio, e il Dungeon Master può premiarli con l'Ispirazione.",
        ],
      ],
      [
        "Quando sali di livello",
        [
          "Aggiungi punti ferita e un Dado Vita, guarda la tabella della classe per i nuovi privilegi, slot e incantesimi, e alza il bonus di competenza ai livelli 5, 9, 13 e 17. Un bonus di competenza più alto cambia i tiri salvezza, le abilità, gli attacchi e i numeri degli incantesimi di cui fa parte: riscrivili.",
        ],
      ],
      [
        "Oppure lascia che la compili Heroquill",
        [
          "Heroquill è un creatore di personaggi gratuito che fa tutto questo per te: scegli specie, classe e background, e calcola ogni numero di questa guida, con talenti, multiclasse e salite di livello. Stampa la stessa scheda già compilata, o te la dà come PDF compilabile, e puoi giocare il personaggio sulla stessa schermata con punti ferita, slot, riposi e dadi. È gratis, non serve un account e funziona offline.",
        ],
      ],
    ],
  },

  fr: {
    label: "Fiche vierge (PDF)",
    title:
      "Fiche de personnage D&D 5e à remplir en PDF gratuit (2014 et 2024) et comment la remplir",
    desc: "Téléchargez gratuitement une fiche de personnage D&D 5e vierge en PDF modifiable, pour les règles de 2014 ou de 2024, et apprenez à la remplir pas à pas : caractéristiques, compétences, classe d'armure, points de vie, attaques et sorts.",
    h1: "Fiche de personnage D&D 5e à remplir, et comment la remplir",
    intro:
      "Une fiche de personnage vierge et gratuite pour Donjons & Dragons cinquième édition, en PDF à remplir sur l'ordinateur ou à imprimer et remplir à la main, pour les règles de 2014 et pour celles de 2024. Sous les téléchargements, un guide pas à pas pour la remplir selon les règles du jeu.",
    cta: "Vous préférez ne pas faire les calculs ? Heroquill remplit la fiche pour vous.",
    downloads: {
      heading: "Télécharger la fiche vierge",
      text: [
        "Cinq pages : la fiche de personnage, la page d'histoire et d'équipement, une page pour les aptitudes et les traits, et deux pages pour les sorts (les sorts par niveau, avec les emplacements et des cases pour les sorts préparés, puis la place pour en recopier six). Chaque nombre, nom, ligne et case est un champ : ouvrez le fichier dans n'importe quel lecteur PDF (votre navigateur, Acrobat, Aperçu) pour y écrire, ou imprimez-le.",
      ],
      editions: {
        2014: {
          name: "Règles de 2014",
          note: "La cinquième édition telle qu'elle est parue d'abord (Manuel des joueurs 2014, SRD 5.1) : race et sous-race, historique avec traits de personnalité.",
        },
        2024: {
          name: "Règles de 2024",
          note: "La cinquième édition révisée (Manuel des joueurs 2024, SRD 5.2.1) : espèce, un historique qui donne les augmentations de caractéristiques et un don d'origine, maîtrise des armes, Inspiration héroïque.",
        },
      },
      papers: { a4: "Télécharger le PDF (A4)", letter: "Télécharger le PDF (US Letter)" },
    },
    sections: [
      [
        "Faites d'abord trois choix",
        [
          "Un personnage, c'est une espèce (race dans les règles de 2014), une classe et un historique. Lisez-les dans les règles avant d'écrire : presque tous les nombres de la fiche en viennent. Dans l'en-tête, écrivez le nom, l'espèce, la classe avec le niveau (un nouveau personnage est de niveau 1), l'historique et l'alignement.",
        ],
      ],
      [
        "Valeurs de caractéristiques",
        [
          "Les six caractéristiques sont la Force, la Dextérité, la Constitution, l'Intelligence, la Sagesse et le Charisme. Donnez une valeur à chacune de l'une de ces trois façons, selon votre table :",
          [
            "la série standard : 15, 14, 13, 12, 10 et 8, une par caractéristique ;",
            "l'achat de points : chaque valeur part de 8 et vous avez 27 points pour les monter jusqu'à 15 (un 9 coûte 1 point, un 13 en coûte 5, un 14 en coûte 7, un 15 en coûte 9) ;",
            "les dés : lancez quatre dés à six faces, gardez les trois meilleurs et additionnez-les ; faites-le six fois et répartissez les résultats.",
          ],
          "Ajoutez ensuite les augmentations : dans les règles de 2014 elles viennent de la race (par exemple +2 à une caractéristique et +1 à une autre), dans celles de 2024 de l'historique (+2 à l'une de ses trois caractéristiques et +1 à une autre, ou +1 aux trois). Aucune valeur ne dépasse 20.",
        ],
      ],
      [
        "Modificateurs",
        [
          "Chaque valeur a un modificateur, écrit sous l'ovale : retirez 10 de la valeur, divisez par 2 et arrondissez à l'inférieur. 10 ou 11 donne +0, 12 ou 13 donne +1, 14 ou 15 donne +2, 16 ou 17 donne +3, 18 ou 19 donne +4, 20 donne +5 ; 8 ou 9 donne −1. Les modificateurs sont ce que vous ajoutez aux dés : presque toute la fiche repose sur eux.",
        ],
      ],
      [
        "Bonus de maîtrise",
        [
          "Écrivez le bonus de maîtrise dans le premier cercle : +2 du niveau 1 au 4, +3 du 5 au 8, +4 du 9 au 12, +5 du 13 au 16 et +6 du 17 au 20. Vous l'ajoutez à tout ce que votre personnage maîtrise.",
        ],
      ],
      [
        "Jets de sauvegarde et compétences",
        [
          "Votre classe vous donne la maîtrise de deux jets de sauvegarde, et la classe et l'historique vous donnent des compétences (l'historique deux, la classe deux à quatre dans une liste). Cochez la case de chacun que vous maîtrisez.",
          "Le nombre à côté d'un jet de sauvegarde ou d'une compétence est le modificateur de sa caractéristique, plus le bonus de maîtrise si la case est cochée. Certaines aptitudes doublent le bonus de maîtrise dans une compétence choisie. La Perception passive vaut 10 plus votre bonus de Perception ; l'Intuition et l'Investigation passives se calculent de la même façon.",
        ],
      ],
      [
        "Classe d'armure, initiative et vitesse",
        [
          "La classe d'armure dit à quel point vous êtes difficile à toucher :",
          [
            "sans armure, 10 plus votre modificateur de Dextérité ;",
            "armure légère : la valeur de l'armure plus votre modificateur de Dextérité ;",
            "armure intermédiaire : la valeur de l'armure plus votre modificateur de Dextérité, au maximum +2 ;",
            "armure lourde : la valeur de l'armure, la Dextérité ne compte pas ;",
            "un bouclier ajoute 2 ; certaines classes ont leur propre façon de la calculer sans armure (le barbare et le moine).",
          ],
          "L'initiative est votre modificateur de Dextérité. La vitesse vient de votre espèce : 9 mètres pour la plupart.",
        ],
      ],
      [
        "Points de vie et dés de vie",
        [
          "Chaque classe a un dé de vie : d6 pour l'ensorceleur et le magicien ; d8 pour le barde, le clerc, le druide, le moine, le roublard et l'occultiste ; d10 pour le guerrier, le paladin et le rôdeur ; d12 pour le barbare. Au niveau 1, vos points de vie maximum sont la valeur la plus haute de ce dé plus votre modificateur de Constitution. À chaque niveau suivant, ajoutez un jet du dé (ou sa moyenne arrondie au supérieur : 4, 5, 6 ou 7) plus le modificateur de Constitution.",
          "Vous avez autant de dés de vie que votre niveau : écrivez-les par exemple 3d8. Les points de vie actuels et temporaires s'écrivent au crayon en jouant, et les cases des jets de sauvegarde contre la mort ne se cochent qu'à 0.",
        ],
      ],
      [
        "Attaques",
        [
          "Pour chaque arme, écrivez son bonus d'attaque et ses dégâts. Le bonus d'attaque est le modificateur de Force pour une arme de corps à corps ou de Dextérité pour une arme à distance (une arme de finesse vous laisse choisir), plus le bonus de maîtrise si votre classe ou espèce maîtrise cette arme. Les dégâts sont le dé de l'arme plus le même modificateur : une épée longue avec Force 16 au niveau 1 fait +5 pour toucher et 1d8+3 dégâts tranchants.",
          "Dans les règles de 2024, écrivez dans la colonne Maîtrise la propriété de maîtrise des armes avec lesquelles votre classe vous permet de l'utiliser.",
        ],
      ],
      [
        "Sorts",
        [
          "Si votre classe lance des sorts, sa caractéristique d'incantation est l'Intelligence pour le magicien, la Sagesse pour le clerc, le druide et le rôdeur, et le Charisme pour le barde, le paladin, l'ensorceleur et l'occultiste. Ensuite :",
          [
            "DD de sauvegarde des sorts = 8 + bonus de maîtrise + modificateur de la caractéristique ;",
            "bonus d'attaque des sorts = bonus de maîtrise + modificateur de la caractéristique ;",
            "les emplacements de chaque niveau viennent de la table de votre classe : écrivez-les, et cochez une case chaque fois que vous en utilisez un ;",
            "écrivez vos sorts mineurs et vos sorts sur les pages de sorts, et cochez ceux que vous avez préparés si votre classe les prépare.",
          ],
        ],
      ],
      [
        "Maîtrises, aptitudes et équipement",
        [
          "Écrivez les armures, les armes et les outils que vous maîtrisez et les langues que vous parlez (tout le monde parle le commun, plus celles de l'espèce et de l'historique). Dans aptitudes et traits, notez ce que vous donnent l'espèce, la classe et l'historique, avec les utilisations de ceux qui ont un nombre limité d'utilisations. Dans les règles de 2024, l'historique donne aussi un don d'origine.",
          "La classe et l'historique donnent un équipement de départ (ou de l'or pour l'acheter) : notez-le sur la page d'histoire et d'équipement, avec les pièces.",
        ],
      ],
      [
        "La page d'histoire",
        [
          "L'âge, la taille, l'apparence, les alliés et l'histoire du personnage sont libres. Dans les règles de 2014, l'historique propose des traits de personnalité, un idéal, un lien et un défaut : choisissez-les ou écrivez les vôtres. Ils aident à jouer le personnage, et le maître du jeu peut les récompenser par l'Inspiration.",
        ],
      ],
      [
        "Quand vous montez de niveau",
        [
          "Ajoutez des points de vie et un dé de vie, regardez la table de la classe pour les nouvelles aptitudes, les emplacements et les sorts, et augmentez le bonus de maîtrise aux niveaux 5, 9, 13 et 17. Un bonus de maîtrise plus élevé change les jets de sauvegarde, les compétences, les attaques et les nombres des sorts dont il fait partie : réécrivez-les.",
        ],
      ],
      [
        "Ou laissez Heroquill la remplir",
        [
          "Heroquill est un créateur de personnages gratuit qui fait tout cela pour vous : choisissez l'espèce, la classe et l'historique, et il calcule chaque nombre de ce guide, avec les dons, le multiclassage et les montées de niveau. Il imprime la même fiche déjà remplie, ou vous la donne en PDF modifiable, et vous pouvez jouer le personnage sur le même écran avec les points de vie, les emplacements de sorts, les repos et les dés. C'est gratuit, sans compte, et cela fonctionne hors ligne.",
        ],
      ],
    ],
  },

  de: {
    label: "Leerer Charakterbogen (PDF)",
    title:
      "Ausfüllbarer D&D 5e Charakterbogen als kostenloses PDF (2014 und 2024) und wie man ihn ausfüllt",
    desc: "Lade einen leeren D&D 5e Charakterbogen kostenlos als ausfüllbares PDF herunter, für die Regeln von 2014 oder 2024, und lerne Schritt für Schritt, wie man ihn ausfüllt: Attributswerte, Fertigkeiten, Rüstungsklasse, Trefferpunkte, Angriffe und Zauber.",
    h1: "Ausfüllbarer D&D 5e Charakterbogen, und wie man ihn ausfüllt",
    intro:
      "Ein kostenloser leerer Charakterbogen für Dungeons & Dragons, fünfte Edition, als PDF zum Ausfüllen am Computer oder zum Ausdrucken und Ausfüllen von Hand, für die Regeln von 2014 und die von 2024. Unter den Downloads eine Anleitung, wie man ihn Schritt für Schritt nach den Regeln des Spiels ausfüllt.",
    cta: "Lieber nicht rechnen? Heroquill füllt den Bogen für dich aus.",
    downloads: {
      heading: "Den leeren Bogen herunterladen",
      text: [
        "Fünf Seiten: der Charakterbogen, die Seite für Geschichte und Ausrüstung, eine Seite für Merkmale und Eigenschaften und zwei Seiten für Zauber (die Zauber nach Grad, mit Zauberplätzen und Kästchen für die vorbereiteten, dann Platz, um sechs Zauber abzuschreiben). Jede Zahl, jeder Name, jede Linie und jedes Kästchen ist ein Feld: Öffne die Datei in einem beliebigen PDF-Leser (deinem Browser, Acrobat, Vorschau), um hineinzuschreiben, oder drucke sie aus.",
      ],
      editions: {
        2014: {
          name: "Regeln von 2014",
          note: "Die fünfte Edition, wie sie zuerst erschien (Spielerhandbuch 2014, SRD 5.1): Volk und Untervolk, Hintergrund mit Persönlichkeitsmerkmalen.",
        },
        2024: {
          name: "Regeln von 2024",
          note: "Die überarbeitete fünfte Edition (Spielerhandbuch 2024, SRD 5.2.1): Spezies, ein Hintergrund, der die Attributserhöhungen und ein Herkunftstalent gibt, Waffenmeisterschaft, Heldische Inspiration.",
        },
      },
      papers: { a4: "PDF herunterladen (A4)", letter: "PDF herunterladen (US Letter)" },
    },
    sections: [
      [
        "Triff zuerst drei Entscheidungen",
        [
          "Ein Charakter ist eine Spezies (in den Regeln von 2014 ein Volk), eine Klasse und ein Hintergrund. Lies sie in den Regeln nach, bevor du etwas schreibst: Fast jede Zahl des Bogens kommt daher. Schreib in den Kopf den Namen, die Spezies, die Klasse mit der Stufe (ein neuer Charakter ist Stufe 1), den Hintergrund und die Gesinnung.",
        ],
      ],
      [
        "Attributswerte",
        [
          "Die sechs Attribute sind Stärke, Geschicklichkeit, Konstitution, Intelligenz, Weisheit und Charisma. Gib jedem einen Wert, auf eine dieser drei Arten, wie eure Runde es mag:",
          [
            "die Standardreihe: 15, 14, 13, 12, 10 und 8, je einer pro Attribut;",
            "Punktekauf: Jeder Wert beginnt bei 8, und du hast 27 Punkte, um sie bis 15 zu erhöhen (eine 9 kostet 1 Punkt, eine 13 kostet 5, eine 14 kostet 7, eine 15 kostet 9);",
            "Würfeln: Wirf vier sechsseitige Würfel, behalte die drei höchsten und zähle sie zusammen; mach das sechsmal und verteile die Ergebnisse.",
          ],
          "Dann kommen die Erhöhungen dazu: In den Regeln von 2014 kommen sie vom Volk (zum Beispiel +2 auf ein Attribut und +1 auf ein anderes), in denen von 2024 vom Hintergrund (+2 auf eines seiner drei Attribute und +1 auf ein anderes, oder +1 auf alle drei). Kein Wert steigt über 20.",
        ],
      ],
      [
        "Modifikatoren",
        [
          "Jeder Wert hat einen Modifikator, der unter das Oval kommt: Zieh 10 vom Wert ab, teile durch 2 und runde ab. 10 oder 11 ergibt +0, 12 oder 13 ergibt +1, 14 oder 15 ergibt +2, 16 oder 17 ergibt +3, 18 oder 19 ergibt +4, 20 ergibt +5; 8 oder 9 ergibt −1. Die Modifikatoren zählst du zu den Würfeln, deshalb baut fast der ganze Bogen auf ihnen auf.",
        ],
      ],
      [
        "Übungsbonus",
        [
          "Schreib den Übungsbonus in den ersten Kreis: +2 von Stufe 1 bis 4, +3 von 5 bis 8, +4 von 9 bis 12, +5 von 13 bis 16 und +6 von 17 bis 20. Du zählst ihn zu allem, worin dein Charakter geübt ist.",
        ],
      ],
      [
        "Rettungswürfe und Fertigkeiten",
        [
          "Deine Klasse gibt dir Übung in zwei Rettungswürfen, und Klasse und Hintergrund geben dir Fertigkeiten (der Hintergrund zwei, die Klasse zwei bis vier aus einer Liste). Kreuze das Kästchen jeder an, in der du geübt bist.",
          "Die Zahl neben einem Rettungswurf oder einer Fertigkeit ist der Modifikator des Attributs, plus der Übungsbonus, wenn das Kästchen angekreuzt ist. Manche Merkmale verdoppeln den Übungsbonus in einer gewählten Fertigkeit. Passive Wahrnehmung ist 10 plus dein Wahrnehmungsbonus; passives Motiv erkennen und passive Nachforschungen funktionieren genauso.",
        ],
      ],
      [
        "Rüstungsklasse, Initiative und Bewegungsrate",
        [
          "Die Rüstungsklasse sagt, wie schwer du zu treffen bist:",
          [
            "ohne Rüstung 10 plus dein Geschicklichkeitsmodifikator;",
            "leichte Rüstung: der Wert der Rüstung plus dein Geschicklichkeitsmodifikator;",
            "mittelschwere Rüstung: der Wert der Rüstung plus dein Geschicklichkeitsmodifikator, höchstens +2;",
            "schwere Rüstung: der Wert der Rüstung, Geschicklichkeit zählt nicht;",
            "ein Schild gibt +2; manche Klassen zählen sie ohne Rüstung auf eigene Weise (Barbar und Mönch).",
          ],
          "Die Initiative ist dein Geschicklichkeitsmodifikator. Die Bewegungsrate kommt von deiner Spezies: 9 Meter für die meisten.",
        ],
      ],
      [
        "Trefferpunkte und Trefferwürfel",
        [
          "Jede Klasse hat einen Trefferwürfel: W6 für Zauberer und Magier; W8 für Barde, Kleriker, Druide, Mönch, Schurke und Hexenmeister; W10 für Kämpfer, Paladin und Waldläufer; W12 für den Barbaren. Auf Stufe 1 sind deine maximalen Trefferpunkte die höchste Zahl dieses Würfels plus dein Konstitutionsmodifikator. Auf jeder weiteren Stufe kommen ein Wurf des Würfels (oder sein aufgerundeter Durchschnitt: 4, 5, 6 oder 7) plus der Konstitutionsmodifikator dazu.",
          "Du hast so viele Trefferwürfel wie deine Stufe: Schreib sie zum Beispiel als 3W8. Aktuelle und temporäre Trefferpunkte trägst du beim Spielen mit Bleistift ein, und die Kästchen der Todesrettungswürfe kreuzt du nur an, wenn du auf 0 fällst.",
        ],
      ],
      [
        "Angriffe",
        [
          "Schreib für jede Waffe ihren Angriffsbonus und ihren Schaden. Der Angriffsbonus ist der Stärkemodifikator für eine Nahkampfwaffe oder der Geschicklichkeitsmodifikator für eine Fernkampfwaffe (bei einer Finesse-Waffe hast du die Wahl), plus der Übungsbonus, wenn deine Klasse oder Spezies im Umgang mit dieser Waffe geübt ist. Der Schaden ist der Würfel der Waffe plus derselbe Modifikator: Ein Langschwert mit Stärke 16 auf Stufe 1 hat +5 zum Treffen und 1W8+3 Hiebschaden.",
          "In den Regeln von 2024 schreib in die Spalte Meisterschaft die Meisterschaftseigenschaft der Waffen, mit denen deine Klasse sie dich nutzen lässt.",
        ],
      ],
      [
        "Zauberwirken",
        [
          "Wenn deine Klasse Zauber wirkt, ist ihr Zauberattribut Intelligenz für den Magier, Weisheit für Kleriker, Druide und Waldläufer und Charisma für Barde, Paladin, Zauberer und Hexenmeister. Dann:",
          [
            "Zauber-SG = 8 + Übungsbonus + Modifikator des Attributs;",
            "Zauberangriffsbonus = Übungsbonus + Modifikator des Attributs;",
            "die Zauberplätze jedes Grades kommen aus der Tabelle deiner Klasse: Schreib sie auf und kreuze jedes Mal ein Kästchen an, wenn du einen verbrauchst;",
            "schreib deine Zaubertricks und Zauber auf die Zauberseiten und kreuze die vorbereiteten an, wenn deine Klasse Zauber vorbereitet.",
          ],
        ],
      ],
      [
        "Übungen, Merkmale und Ausrüstung",
        [
          "Schreib die Rüstungen, Waffen und Werkzeuge, in denen du geübt bist, und die Sprachen, die du sprichst (alle sprechen die Gemeinsprache, dazu die der Spezies und des Hintergrunds). Unter Merkmale und Eigenschaften notierst du, was dir Spezies, Klasse und Hintergrund geben, mit den Anwendungen derer, die nur begrenzt oft nutzbar sind. In den Regeln von 2024 gibt der Hintergrund außerdem ein Herkunftstalent.",
          "Klasse und Hintergrund geben eine Startausrüstung (oder Gold, um sie zu kaufen): Trag sie mit den Münzen auf der Seite für Geschichte und Ausrüstung ein.",
        ],
      ],
      [
        "Die Seite der Geschichte",
        [
          "Alter, Größe, Aussehen, Verbündete und die Geschichte deines Charakters sind frei. In den Regeln von 2014 schlägt der Hintergrund Persönlichkeitsmerkmale, ein Ideal, eine Bindung und einen Makel vor: Wähle sie oder schreib deine eigenen. Sie helfen beim Spielen des Charakters, und der Spielleiter kann sie mit Inspiration belohnen.",
        ],
      ],
      [
        "Wenn du eine Stufe aufsteigst",
        [
          "Füge Trefferpunkte und einen Trefferwürfel hinzu, sieh in der Tabelle der Klasse nach neuen Merkmalen, Zauberplätzen und Zaubern, und erhöhe den Übungsbonus auf den Stufen 5, 9, 13 und 17. Ein höherer Übungsbonus ändert die Rettungswürfe, Fertigkeiten, Angriffe und Zauberwerte, in denen er steckt: Schreib sie neu.",
        ],
      ],
      [
        "Oder lass Heroquill ihn ausfüllen",
        [
          "Heroquill ist ein kostenloser Charaktergenerator, der all das für dich übernimmt: Wähle Spezies, Klasse und Hintergrund, und er berechnet jede Zahl dieser Anleitung, mit Talenten, Mehrfachklassen und Stufenaufstiegen. Er druckt denselben Bogen schon ausgefüllt oder gibt ihn dir als ausfüllbares PDF, und du kannst den Charakter auf demselben Bildschirm spielen, mit Trefferpunkten, Zauberplätzen, Rasten und Würfeln. Kostenlos, ohne Konto und offline nutzbar.",
        ],
      ],
    ],
  },

  es: {
    label: "Hoja en blanco (PDF)",
    title: "Hoja de personaje D&D 5e rellenable en PDF gratis (2014 y 2024) y cómo rellenarla",
    desc: "Descarga gratis una hoja de personaje de D&D 5e en blanco como PDF rellenable, para las reglas de 2014 o de 2024, y aprende a rellenarla paso a paso: puntuaciones de característica, habilidades, clase de armadura, puntos de golpe, ataques y conjuros.",
    h1: "Hoja de personaje D&D 5e rellenable, y cómo se rellena",
    intro:
      "Una hoja de personaje en blanco y gratuita para Dungeons & Dragons quinta edición, en PDF para rellenar en el ordenador o para imprimir y rellenar a mano, para las reglas de 2014 y para las de 2024. Debajo de las descargas, una guía paso a paso para rellenarla según las reglas del juego.",
    cta: "¿Prefieres no hacer las cuentas? Heroquill rellena la hoja por ti.",
    downloads: {
      heading: "Descarga la hoja en blanco",
      text: [
        "Cinco páginas: la hoja de personaje, la página de historia y equipo, una página para rasgos y características, y dos páginas para conjuros (los conjuros por nivel, con los espacios y casillas para los preparados, y luego sitio para copiar seis). Cada número, nombre, línea y casilla es un campo: abre el archivo en cualquier lector de PDF (tu navegador, Acrobat, Vista Previa) para escribir en él, o imprímelo.",
      ],
      editions: {
        2014: {
          name: "Reglas de 2014",
          note: "La quinta edición tal como salió primero (Manual del jugador 2014, SRD 5.1): raza y subraza, trasfondo con rasgos de personalidad.",
        },
        2024: {
          name: "Reglas de 2024",
          note: "La quinta edición revisada (Manual del jugador 2024, SRD 5.2.1): especie, un trasfondo que da los aumentos de característica y una dote de origen, maestría con armas, Inspiración heroica.",
        },
      },
      papers: { a4: "Descargar el PDF (A4)", letter: "Descargar el PDF (US Letter)" },
    },
    sections: [
      [
        "Primero, tres elecciones",
        [
          "Un personaje es una especie (raza en las reglas de 2014), una clase y un trasfondo. Léelos en las reglas antes de escribir: casi todos los números de la hoja salen de ahí. En la cabecera escribe el nombre, la especie, la clase con el nivel (un personaje nuevo es de nivel 1), el trasfondo y el alineamiento.",
        ],
      ],
      [
        "Puntuaciones de característica",
        [
          "Las seis características son Fuerza, Destreza, Constitución, Inteligencia, Sabiduría y Carisma. Dale una puntuación a cada una de una de estas tres formas, como prefiera tu mesa:",
          [
            "la serie estándar: 15, 14, 13, 12, 10 y 8, una para cada característica;",
            "la compra de puntos: cada puntuación empieza en 8 y tienes 27 puntos para subirlas hasta 15 (un 9 cuesta 1 punto, un 13 cuesta 5, un 14 cuesta 7, un 15 cuesta 9);",
            "los dados: tira cuatro dados de seis caras, quédate con los tres más altos y súmalos; hazlo seis veces y reparte los resultados.",
          ],
          "Después suma los aumentos: en las reglas de 2014 vienen de la raza (por ejemplo +2 a una característica y +1 a otra), en las de 2024 del trasfondo (+2 a una de sus tres características y +1 a otra, o +1 a las tres). Ninguna puntuación pasa de 20.",
        ],
      ],
      [
        "Modificadores",
        [
          "Cada puntuación tiene un modificador, que se escribe bajo el óvalo: resta 10 a la puntuación, divide entre 2 y redondea hacia abajo. 10 u 11 es +0, 12 o 13 es +1, 14 o 15 es +2, 16 o 17 es +3, 18 o 19 es +4, 20 es +5; 8 o 9 es −1. Los modificadores son lo que sumas a los dados, por eso casi toda la hoja se basa en ellos.",
        ],
      ],
      [
        "Bonificador por competencia",
        [
          "Escribe el bonificador por competencia en el primer círculo: +2 de nivel 1 a 4, +3 de 5 a 8, +4 de 9 a 12, +5 de 13 a 16 y +6 de 17 a 20. Lo sumas a todo aquello en lo que tu personaje es competente.",
        ],
      ],
      [
        "Tiradas de salvación y habilidades",
        [
          "Tu clase te da competencia en dos tiradas de salvación, y la clase y el trasfondo te dan habilidades (el trasfondo dos, la clase de dos a cuatro de una lista). Marca la casilla de cada una en la que seas competente.",
          "El número junto a una tirada de salvación o una habilidad es el modificador de su característica, más el bonificador por competencia si la casilla está marcada. Algunos rasgos duplican el bonificador por competencia en una habilidad a elegir. La Percepción pasiva es 10 más tu bonificador de Percepción; la Perspicacia y la Investigación pasivas funcionan igual.",
        ],
      ],
      [
        "Clase de armadura, iniciativa y velocidad",
        [
          "La clase de armadura dice lo difícil que es golpearte:",
          [
            "sin armadura, 10 más tu modificador de Destreza;",
            "armadura ligera: el valor de la armadura más tu modificador de Destreza;",
            "armadura intermedia: el valor de la armadura más tu modificador de Destreza, como mucho +2;",
            "armadura pesada: el valor de la armadura, la Destreza no cuenta;",
            "un escudo suma 2; algunas clases tienen su propia forma de calcularla sin armadura (el bárbaro y el monje).",
          ],
          "La iniciativa es tu modificador de Destreza. La velocidad viene de tu especie: 9 metros para la mayoría.",
        ],
      ],
      [
        "Puntos de golpe y dados de golpe",
        [
          "Cada clase tiene un dado de golpe: d6 para el hechicero y el mago; d8 para el bardo, clérigo, druida, monje, pícaro y brujo; d10 para el guerrero, paladín y explorador; d12 para el bárbaro. A nivel 1, tus puntos de golpe máximos son el número más alto de ese dado más tu modificador de Constitución. En cada nivel siguiente suma una tirada del dado (o su media redondeada hacia arriba: 4, 5, 6 o 7) más el modificador de Constitución.",
          "Tienes tantos dados de golpe como tu nivel: escríbelos por ejemplo como 3d8. Los puntos de golpe actuales y temporales se escriben a lápiz mientras juegas, y las casillas de las salvaciones de muerte solo se marcan cuando caes a 0.",
        ],
      ],
      [
        "Ataques",
        [
          "Para cada arma escribe su bonificador de ataque y su daño. El bonificador de ataque es el modificador de Fuerza para un arma cuerpo a cuerpo o el de Destreza para un arma a distancia (un arma sutil te deja elegir), más el bonificador por competencia si tu clase o especie es competente con esa arma. El daño es el dado del arma más el mismo modificador: una espada larga con Fuerza 16 a nivel 1 tiene +5 para impactar y 1d8+3 de daño cortante.",
          "En las reglas de 2024, escribe en la columna Maestría la propiedad de maestría de las armas con las que tu clase te permite usarla.",
        ],
      ],
      [
        "Conjuros",
        [
          "Si tu clase lanza conjuros, su característica para lanzar conjuros es Inteligencia para el mago, Sabiduría para el clérigo, druida y explorador, y Carisma para el bardo, paladín, hechicero y brujo. Después:",
          [
            "CD de salvación de conjuros = 8 + bonificador por competencia + modificador de la característica;",
            "bonificador de ataque de conjuro = bonificador por competencia + modificador de la característica;",
            "los espacios de cada nivel vienen de la tabla de tu clase: escríbelos y marca una casilla cada vez que gastes uno;",
            "escribe tus trucos y conjuros en las páginas de conjuros, y marca los que tengas preparados si tu clase los prepara.",
          ],
        ],
      ],
      [
        "Competencias, rasgos y equipo",
        [
          "Escribe las armaduras, armas y herramientas con las que eres competente y los idiomas que hablas (todos hablan el común, más los de la especie y el trasfondo). En rasgos y características anota lo que te dan la especie, la clase y el trasfondo, con los usos de los que se pueden usar un número limitado de veces. En las reglas de 2024 el trasfondo también da una dote de origen.",
          "La clase y el trasfondo dan un equipo inicial (u oro para comprarlo): anótalo en la página de historia y equipo, con las monedas.",
        ],
      ],
      [
        "La página de historia",
        [
          "La edad, la altura, el aspecto, los aliados y la historia de tu personaje son libres. En las reglas de 2014, el trasfondo sugiere rasgos de personalidad, un ideal, un vínculo y un defecto: elígelos o escribe los tuyos. Ayudan a interpretar al personaje, y el Dungeon Master puede premiarlos con Inspiración.",
        ],
      ],
      [
        "Cuando subes de nivel",
        [
          "Suma puntos de golpe y un dado de golpe, mira en la tabla de la clase los nuevos rasgos, espacios y conjuros, y sube el bonificador por competencia en los niveles 5, 9, 13 y 17. Un bonificador por competencia más alto cambia las tiradas de salvación, las habilidades, los ataques y los números de los conjuros de los que forma parte: vuelve a escribirlos.",
        ],
      ],
      [
        "O deja que Heroquill la rellene",
        [
          "Heroquill es un creador de personajes gratuito que hace todo esto por ti: elige la especie, la clase y el trasfondo, y calcula cada número de esta guía, con dotes, multiclase y subidas de nivel. Imprime la misma hoja ya rellena, o te la da como PDF rellenable, y puedes jugar el personaje en la misma pantalla con puntos de golpe, espacios de conjuro, descansos y dados. Es gratis, no necesita cuenta y funciona sin conexión.",
        ],
      ],
    ],
  },
};
