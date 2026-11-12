// The guide "how to create a D&D 5e character", in every language. The build
// (scripts/build-site.mjs) writes one page of plain HTML from each. A section is a heading and a list
// of blocks: a string is a paragraph, an array is a list of items.
export const GUIDE = {
  en: {
    title: "How to Create a D&D 5e Character, Step by Step",
    desc: "A step-by-step guide to creating a Dungeons & Dragons 5th edition character: species, class, ability scores, background, equipment and spells.",
    h1: "How to create a D&D 5e character",
    intro:
      "Making a character for D&D 5th edition takes about half an hour once you know the steps. Here they are in order, with what each choice changes, and how Heroquill works the numbers out for you.",
    sections: [
      [
        "Start with an idea",
        [
          "Before any number, picture the hero: a stubborn dwarf cleric, a curious elf wizard, a rogue who is bad at lying. A one-line concept makes every later choice easier, and it is the thing you will still remember in a year.",
        ],
      ],
      [
        "Choose a species",
        [
          "Your species (called race in older books) gives your character a size, a speed, languages and a few traits, and in the 2014 rules (SRD 5.1) it also adds to some ability scores, while in the 2024 rules (SRD 5.2.1) the increase comes from the background. The 2014 SRD includes the dwarf, elf, halfling, human, dragonborn, gnome, half-elf, half-orc and tiefling, some with a subrace such as the high elf or the hill dwarf; the 2024 SRD has the dragonborn, dwarf, elf, gnome, goliath, halfling, human, orc and tiefling, with lineages instead of subraces.",
        ],
      ],
      [
        "Choose a class",
        [
          "The class is what your character does: fighter, rogue, wizard, cleric and the rest of the twelve classes of the SRD. It sets your hit die, the saving throws you are good at, the armor and weapons you can use, how many skills you pick, and the features you gain at each level.",
          "Some classes choose a subclass right away (a cleric picks a domain at level 1), others at level 2 or 3 (a wizard picks a school at 2, a fighter an archetype at 3).",
        ],
      ],
      [
        "Assign your ability scores",
        [
          "There are three usual ways to get the six scores:",
          [
            "Standard array: 15, 14, 13, 12, 10 and 8, in the order you like.",
            "Point buy: 27 points to spend on scores between 8 and 15, before the species bonuses.",
            "Rolling: four six-sided dice, drop the lowest, six times.",
          ],
          "Put your best scores where your class needs them: Strength for a fighter, Intelligence for a wizard, Dexterity for a rogue. The modifier of a score is the score minus 10, divided by 2, rounded down.",
        ],
      ],
      [
        "Pick a background",
        [
          "A background gives two skills, some tool proficiencies or languages, starting equipment and a feature, and it tells where the hero comes from. The SRD includes one, the Acolyte. Other backgrounds come from other books: in Heroquill you can import the content files you already own, or write your own with the homebrew editor.",
        ],
      ],
      [
        "Skills, proficiencies and equipment",
        [
          "Choose the skills your class allows, and take the equipment your class and background offer. Your armor class comes from the armor you wear plus your Dexterity modifier (with some limits), and every weapon you carry has an attack bonus made of your ability modifier and, if you are proficient, your proficiency bonus, which is +2 at level 1.",
        ],
      ],
      [
        "Spells, if your class casts",
        [
          "Casters choose cantrips (spells you can cast at will) and, depending on the class, spells known or spells prepared each day. Spell slots limit how many leveled spells you can cast before resting. The save DC of your spells is 8 + your proficiency bonus + your spellcasting ability modifier, and a spell attack is your proficiency bonus + that modifier.",
        ],
      ],
      [
        "Hit points and the finishing touches",
        [
          "At level 1 your hit points are the highest number of your hit die plus your Constitution modifier. Then give the hero a name, an alignment, personality traits, ideals, bonds and flaws, and a few words on how they look. They cost nothing and make the character come alive at the table.",
        ],
      ],
      [
        "Level up",
        [
          "Each new level brings hit points (roll your hit die or take the average), new class features and sometimes new spells. At levels 4, 8, 12, 16 and 19 most classes can raise their ability scores or take a feat. You may also multiclass, if your scores meet the requirements of both classes.",
        ],
      ],
      [
        "How Heroquill helps",
        [
          "Heroquill follows these steps one at a time and works out every number for you: modifiers, saving throws, skills, armor class, hit points, spell slots and save DCs, with feats and multiclassing applied. You can override any value by hand, play the character on the same screen with hit points, spell slots, rests and dice, print the sheet and the spell cards, or share the character with a link. It is free, needs no account and works offline.",
        ],
      ],
    ],
    cta: "Want to see a finished character? Open Aria, a level 5 elf wizard, or start your own.",
  },
  it: {
    title: "Come creare un personaggio di D&D 5e, passo per passo",
    desc: "Una guida passo per passo per creare un personaggio di Dungeons & Dragons 5a edizione: specie, classe, punteggi, background, equipaggiamento e incantesimi.",
    h1: "Come creare un personaggio di D&D 5e",
    intro:
      "Creare un personaggio di D&D 5a edizione richiede circa mezz’ora, una volta che si conoscono i passi. Eccoli in ordine, con quello che cambia ogni scelta e come Heroquill calcola i numeri al posto tuo.",
    sections: [
      [
        "Parti da un’idea",
        [
          "Prima di ogni numero, immagina l’eroe: una chierica nana testarda, un mago elfo curioso, un ladro pessimo a mentire. Un concetto in una riga rende più facile ogni scelta successiva, ed è la cosa che ricorderai ancora fra un anno.",
        ],
      ],
      [
        "Scegli una specie",
        [
          "La specie (nei libri più vecchi si chiamava razza) dà al personaggio taglia, velocità, linguaggi e qualche tratto, e nelle regole 2014 (SRD 5.1) aumenta anche alcuni punteggi di caratteristica, mentre nelle regole 2024 (SRD 5.2.1) l’aumento viene dal background. L’SRD 2014 comprende nano, elfo, halfling, umano, dragonide, gnomo, mezzelfo, mezzorco e tiefling, alcuni con una sottorazza come l’elfo alto o il nano delle colline; l’SRD 2024 ha dragonide, nano, elfo, gnomo, goliath, halfling, umano, orco e tiefling, con lignaggi al posto delle sottorazze.",
        ],
      ],
      [
        "Scegli una classe",
        [
          "La classe è ciò che il personaggio sa fare: guerriero, ladro, mago, chierico e le altre dodici classi dell’SRD. Stabilisce il dado vita, i tiri salvezza in cui sei bravo, le armature e le armi che puoi usare, quante abilità scegli e i privilegi che ottieni a ogni livello.",
          "Alcune classi scelgono subito una sottoclasse (il chierico sceglie un dominio al 1° livello), altre al 2° o al 3° (il mago sceglie una scuola al 2°, il guerriero un archetipo al 3°).",
        ],
      ],
      [
        "Assegna i punteggi di caratteristica",
        [
          "Ci sono tre modi usuali per ottenere i sei punteggi:",
          [
            "Serie standard: 15, 14, 13, 12, 10 e 8, nell’ordine che preferisci.",
            "Acquisto a punti: 27 punti da spendere in punteggi fra 8 e 15, prima dei bonus della specie.",
            "Tiro dei dadi: quattro dadi a sei facce, scartando il più basso, per sei volte.",
          ],
          "Metti i punteggi migliori dove la tua classe ne ha bisogno: Forza per un guerriero, Intelligenza per un mago, Destrezza per un ladro. Il modificatore di un punteggio è il punteggio meno 10, diviso per 2, arrotondato per difetto.",
        ],
      ],
      [
        "Scegli un background",
        [
          "Un background dà due abilità, qualche competenza in strumenti o linguaggi, equipaggiamento iniziale e un privilegio, e racconta da dove viene l’eroe. L’SRD ne comprende uno, l’Accolito. Gli altri vengono da altri libri: in Heroquill puoi importare i file di contenuto che già possiedi, o scriverne di tuoi con l’editor homebrew.",
        ],
      ],
      [
        "Abilità, competenze ed equipaggiamento",
        [
          "Scegli le abilità che la tua classe permette e prendi l’equipaggiamento che offrono classe e background. La Classe Armatura viene dall’armatura che indossi più il modificatore di Destrezza (con alcuni limiti), e ogni arma che porti ha un bonus di attacco fatto del modificatore di caratteristica e, se sei competente, del bonus di competenza, che al 1° livello è +2.",
        ],
      ],
      [
        "Incantesimi, se la tua classe lancia incantesimi",
        [
          "Chi lancia incantesimi sceglie i trucchetti (incantesimi che si possono lanciare a volontà) e, a seconda della classe, gli incantesimi conosciuti o preparati ogni giorno. Gli slot incantesimo limitano quanti incantesimi di livello si possono lanciare prima di riposare. La CD del tiro salvezza dei tuoi incantesimi è 8 + bonus di competenza + modificatore della caratteristica da incantatore, e l’attacco con incantesimo è il bonus di competenza + quel modificatore.",
        ],
      ],
      [
        "Punti ferita e ultimi ritocchi",
        [
          "Al 1° livello i punti ferita sono il valore massimo del dado vita più il modificatore di Costituzione. Poi dai all’eroe un nome, un allineamento, tratti della personalità, ideali, legami e difetti, e due parole su come appare. Non costano nulla e al tavolo fanno vivere il personaggio.",
        ],
      ],
      [
        "Sali di livello",
        [
          "Ogni nuovo livello porta punti ferita (tira il dado vita o prendi la media), nuovi privilegi di classe e a volte nuovi incantesimi. Ai livelli 4, 8, 12, 16 e 19 la maggior parte delle classi può aumentare i punteggi di caratteristica o scegliere un talento. Si può anche fare multiclasse, se i punteggi rispettano i requisiti di entrambe le classi.",
        ],
      ],
      [
        "Come ti aiuta Heroquill",
        [
          "Heroquill segue questi passi uno alla volta e calcola ogni numero per te: modificatori, tiri salvezza, abilità, Classe Armatura, punti ferita, slot incantesimo e CD, con talenti e multiclasse applicati. Puoi modificare a mano qualsiasi valore, giocare il personaggio sulla stessa schermata con punti ferita, slot, riposi e dadi, stampare la scheda e le carte degli incantesimi, o condividere il personaggio con un link. È gratis, non richiede un account e funziona offline.",
        ],
      ],
    ],
    cta: "Vuoi vedere un personaggio finito? Apri Aria, una maga elfa di livello 5, oppure inizia il tuo.",
  },
  fr: {
    title: "Comment créer un personnage de D&D 5e, pas à pas",
    desc: "Un guide pas à pas pour créer un personnage de Donjons & Dragons 5e édition : espèce, classe, caractéristiques, historique, équipement et sorts.",
    h1: "Comment créer un personnage de D&D 5e",
    intro:
      "Créer un personnage de D&D 5e édition prend environ une demi-heure quand on connaît les étapes. Les voici dans l’ordre, avec ce que chaque choix change et comment Heroquill calcule les nombres à ta place.",
    sections: [
      [
        "Pars d’une idée",
        [
          "Avant tout nombre, imagine le héros : une clerc naine têtue, un magicien elfe curieux, un voleur qui ment très mal. Un concept en une ligne rend chaque choix suivant plus facile, et c’est ce dont tu te souviendras encore dans un an.",
        ],
      ],
      [
        "Choisis une espèce",
        [
          "Ton espèce (appelée race dans les anciens livres) donne à ton personnage une taille, une vitesse, des langues et quelques traits, et dans les règles de 2014 (SRD 5.1) elle augmente aussi certaines caractéristiques, alors que dans celles de 2024 (SRD 5.2.1) l’augmentation vient de l’historique. Le SRD 2014 comprend le nain, l’elfe, le halfelin, l’humain, le drakéide, le gnome, le demi-elfe, le demi-orque et le tieffelin, certains avec une sous-race comme le haut-elfe ou le nain des collines ; le SRD 2024 a le drakéide, le nain, l’elfe, le gnome, le goliath, le halfelin, l’humain, l’orc et le tieffelin, avec des lignages à la place des sous-races.",
        ],
      ],
      [
        "Choisis une classe",
        [
          "La classe est ce que fait ton personnage : guerrier, roublard, magicien, clerc et les autres des douze classes du SRD. Elle fixe ton dé de vie, les jets de sauvegarde où tu es bon, les armures et les armes que tu peux utiliser, le nombre de compétences à choisir et les aptitudes gagnées à chaque niveau.",
          "Certaines classes choisissent tout de suite une sous-classe (un clerc choisit un domaine au niveau 1), d’autres au niveau 2 ou 3 (un magicien choisit une école au niveau 2, un guerrier un archétype au niveau 3).",
        ],
      ],
      [
        "Répartis tes caractéristiques",
        [
          "Il y a trois façons usuelles d’obtenir les six valeurs :",
          [
            "Tableau standard : 15, 14, 13, 12, 10 et 8, dans l’ordre de ton choix.",
            "Achat de points : 27 points à dépenser sur des valeurs entre 8 et 15, avant les bonus d’espèce.",
            "Tirage : quatre dés à six faces, on retire le plus bas, six fois.",
          ],
          "Mets tes meilleures valeurs là où ta classe en a besoin : Force pour un guerrier, Intelligence pour un magicien, Dextérité pour un roublard. Le modificateur d’une valeur est la valeur moins 10, divisée par 2, arrondie à l’inférieur.",
        ],
      ],
      [
        "Choisis un historique",
        [
          "Un historique donne deux compétences, quelques maîtrises d’outils ou de langues, de l’équipement de départ et une aptitude, et dit d’où vient le héros. Le SRD en comprend un, l’Acolyte. Les autres viennent d’autres livres : dans Heroquill tu peux importer les fichiers de contenu que tu possèdes déjà, ou écrire les tiens avec l’éditeur homebrew.",
        ],
      ],
      [
        "Compétences, maîtrises et équipement",
        [
          "Choisis les compétences que ta classe permet et prends l’équipement que proposent ta classe et ton historique. Ta classe d’armure vient de l’armure portée plus ton modificateur de Dextérité (avec quelques limites), et chaque arme a un bonus d’attaque fait du modificateur de caractéristique et, si tu la maîtrises, du bonus de maîtrise, qui est de +2 au niveau 1.",
        ],
      ],
      [
        "Sorts, si ta classe en lance",
        [
          "Les lanceurs de sorts choisissent des sorts mineurs (qu’on peut lancer à volonté) et, selon la classe, des sorts connus ou préparés chaque jour. Les emplacements de sorts limitent le nombre de sorts à niveau qu’on lance avant de se reposer. Le DD de sauvegarde de tes sorts est 8 + ton bonus de maîtrise + le modificateur de ta caractéristique d’incantation, et l’attaque de sort est le bonus de maîtrise + ce modificateur.",
        ],
      ],
      [
        "Points de vie et dernières touches",
        [
          "Au niveau 1, tes points de vie sont la valeur maximale de ton dé de vie plus ton modificateur de Constitution. Donne ensuite au héros un nom, un alignement, des traits de personnalité, des idéaux, des liens et des défauts, et quelques mots sur son apparence. Cela ne coûte rien et fait vivre le personnage à la table.",
        ],
      ],
      [
        "Monte de niveau",
        [
          "Chaque nouveau niveau apporte des points de vie (lance ton dé de vie ou prends la moyenne), de nouvelles aptitudes de classe et parfois de nouveaux sorts. Aux niveaux 4, 8, 12, 16 et 19, la plupart des classes peuvent augmenter leurs caractéristiques ou prendre un don. On peut aussi faire du multiclassage, si les valeurs respectent les prérequis des deux classes.",
        ],
      ],
      [
        "Comment Heroquill t’aide",
        [
          "Heroquill suit ces étapes une à la fois et calcule chaque nombre pour toi : modificateurs, jets de sauvegarde, compétences, classe d’armure, points de vie, emplacements de sorts et DD, avec dons et multiclassage appliqués. Tu peux modifier toute valeur à la main, jouer le personnage sur le même écran avec points de vie, emplacements, repos et dés, imprimer la fiche et les cartes de sorts, ou partager le personnage avec un lien. C’est gratuit, sans compte, et ça marche hors ligne.",
        ],
      ],
    ],
    cta: "Envie de voir un personnage terminé ? Ouvre Aria, une magicienne elfe de niveau 5, ou crée le tien.",
  },
  de: {
    title: "D&D-5e-Charakter erstellen: Anleitung Schritt für Schritt",
    desc: "Eine Schritt-für-Schritt-Anleitung, um einen Dungeons-&-Dragons-Charakter der 5. Edition zu erstellen: Volk, Klasse, Attributswerte, Hintergrund, Ausrüstung und Zauber.",
    h1: "So erstellst du einen D&D-5e-Charakter",
    intro:
      "Einen Charakter für D&D 5. Edition zu erstellen dauert etwa eine halbe Stunde, wenn man die Schritte kennt. Hier sind sie der Reihe nach, mit dem, was jede Wahl ändert, und wie Heroquill die Zahlen für dich berechnet.",
    sections: [
      [
        "Beginne mit einer Idee",
        [
          "Stell dir vor jeder Zahl den Helden vor: einen sturen Zwergenkleriker, eine neugierige Elfenmagierin, einen Schurken, der schlecht lügt. Ein Konzept in einem Satz erleichtert jede spätere Wahl, und an das erinnerst du dich auch in einem Jahr noch.",
        ],
      ],
      [
        "Wähle ein Volk",
        [
          "Dein Volk (in älteren Büchern Rasse genannt) gibt deinem Charakter Größe, Geschwindigkeit, Sprachen und ein paar Merkmale, und in den Regeln von 2014 (SRD 5.1) erhöht es auch einige Attributswerte, während in den Regeln von 2024 (SRD 5.2.1) die Erhöhung aus dem Hintergrund kommt. Das SRD 2014 enthält Zwerg, Elf, Halbling, Mensch, Drachenblütiger, Gnom, Halbelf, Halbork und Tiefling, einige mit einem Untervolk wie dem Hochelfen oder dem Hügelzwerg; das SRD 2024 hat Drachenblütiger, Zwerg, Elf, Gnom, Goliath, Halbling, Mensch, Ork und Tiefling, mit Abstammungen statt Untervölkern.",
        ],
      ],
      [
        "Wähle eine Klasse",
        [
          "Die Klasse ist das, was dein Charakter tut: Kämpfer, Schurke, Magier, Kleriker und die übrigen der zwölf Klassen des SRD. Sie legt deinen Trefferwürfel fest, die Rettungswürfe, in denen du gut bist, die Rüstungen und Waffen, die du nutzen kannst, wie viele Fertigkeiten du wählst und die Merkmale, die du auf jeder Stufe bekommst.",
          "Manche Klassen wählen sofort eine Unterklasse (ein Kleriker wählt auf Stufe 1 eine Domäne), andere auf Stufe 2 oder 3 (ein Magier wählt auf Stufe 2 eine Schule, ein Kämpfer auf Stufe 3 einen Archetyp).",
        ],
      ],
      [
        "Verteile deine Attributswerte",
        [
          "Es gibt drei übliche Wege zu den sechs Werten:",
          [
            "Standardreihe: 15, 14, 13, 12, 10 und 8, in der Reihenfolge, die du willst.",
            "Punktekauf: 27 Punkte für Werte zwischen 8 und 15, vor den Volksboni.",
            "Würfeln: vier sechsseitige Würfel, der niedrigste fällt weg, sechsmal.",
          ],
          "Setze deine besten Werte dorthin, wo deine Klasse sie braucht: Stärke für einen Kämpfer, Intelligenz für einen Magier, Geschicklichkeit für einen Schurken. Der Modifikator eines Werts ist der Wert minus 10, geteilt durch 2, abgerundet.",
        ],
      ],
      [
        "Wähle einen Hintergrund",
        [
          "Ein Hintergrund gibt zwei Fertigkeiten, einige Werkzeug- oder Sprachkenntnisse, Startausrüstung und ein Merkmal, und er erzählt, woher der Held kommt. Das SRD enthält einen, den Akolythen. Andere stammen aus anderen Büchern: In Heroquill kannst du die Inhaltsdateien importieren, die du schon besitzt, oder mit dem Homebrew-Editor eigene schreiben.",
        ],
      ],
      [
        "Fertigkeiten, Kenntnisse und Ausrüstung",
        [
          "Wähle die Fertigkeiten, die deine Klasse erlaubt, und nimm die Ausrüstung, die Klasse und Hintergrund bieten. Deine Rüstungsklasse ergibt sich aus der getragenen Rüstung plus deinem Geschicklichkeitsmodifikator (mit einigen Grenzen), und jede Waffe hat einen Angriffsbonus aus dem Attributsmodifikator und, wenn du geübt bist, dem Übungsbonus, der auf Stufe 1 +2 beträgt.",
        ],
      ],
      [
        "Zauber, wenn deine Klasse zaubert",
        [
          "Zauberwirker wählen Zaubertricks (Zauber, die man beliebig oft wirken kann) und, je nach Klasse, bekannte oder täglich vorbereitete Zauber. Zauberplätze begrenzen, wie viele Zauber mit Grad man vor der nächsten Rast wirken kann. Der Rettungswurf-SG deiner Zauber ist 8 + Übungsbonus + Modifikator deines Zauberattributs, und der Zauberangriff ist Übungsbonus + dieser Modifikator.",
        ],
      ],
      [
        "Trefferpunkte und der letzte Schliff",
        [
          "Auf Stufe 1 sind deine Trefferpunkte der höchste Wert deines Trefferwürfels plus dein Konstitutionsmodifikator. Gib dem Helden dann einen Namen, eine Gesinnung, Persönlichkeitsmerkmale, Ideale, Bindungen und Schwächen und ein paar Worte zum Aussehen. Das kostet nichts und lässt den Charakter am Tisch lebendig werden.",
        ],
      ],
      [
        "Stufenaufstieg",
        [
          "Jede neue Stufe bringt Trefferpunkte (würfle deinen Trefferwürfel oder nimm den Durchschnitt), neue Klassenmerkmale und manchmal neue Zauber. Auf den Stufen 4, 8, 12, 16 und 19 können die meisten Klassen Attributswerte erhöhen oder ein Talent wählen. Auch Multiclassing ist möglich, wenn die Werte die Voraussetzungen beider Klassen erfüllen.",
        ],
      ],
      [
        "Wie Heroquill hilft",
        [
          "Heroquill folgt diesen Schritten nacheinander und berechnet jede Zahl für dich: Modifikatoren, Rettungswürfe, Fertigkeiten, Rüstungsklasse, Trefferpunkte, Zauberplätze und SG, mit angewandten Talenten und Multiclassing. Du kannst jeden Wert von Hand überschreiben, den Charakter auf demselben Bildschirm mit Trefferpunkten, Zauberplätzen, Rasten und Würfeln spielen, den Bogen und die Zauberkarten drucken oder den Charakter per Link teilen. Es ist kostenlos, braucht kein Konto und funktioniert offline.",
        ],
      ],
    ],
    cta: "Willst du einen fertigen Charakter sehen? Öffne Aria, eine Elfenmagierin der Stufe 5, oder beginne deinen eigenen.",
  },
  es: {
    title: "Cómo crear un personaje de D&D 5e, paso a paso",
    desc: "Una guía paso a paso para crear un personaje de Dungeons & Dragons 5.ª edición: especie, clase, puntuaciones, trasfondo, equipo y conjuros.",
    h1: "Cómo crear un personaje de D&D 5e",
    intro:
      "Crear un personaje de D&D 5.ª edición lleva media hora más o menos cuando se conocen los pasos. Aquí están en orden, con lo que cambia cada elección y cómo Heroquill calcula los números por ti.",
    sections: [
      [
        "Empieza por una idea",
        [
          "Antes de cualquier número, imagina al héroe: una clériga enana terca, un mago elfo curioso, un pícaro que miente fatal. Un concepto en una línea hace más fáciles todas las elecciones siguientes, y es lo que recordarás dentro de un año.",
        ],
      ],
      [
        "Elige una especie",
        [
          "Tu especie (en los libros antiguos, raza) da a tu personaje un tamaño, una velocidad, idiomas y algunos rasgos, y en las reglas de 2014 (SRD 5.1) también aumenta algunas puntuaciones de característica, mientras que en las de 2024 (SRD 5.2.1) el aumento viene del trasfondo. El SRD 2014 incluye el enano, el elfo, el mediano, el humano, el dracónido, el gnomo, el semielfo, el semiorco y el tiefling, algunos con una subraza como el alto elfo o el enano de las colinas; el SRD 2024 tiene el dracónido, el enano, el elfo, el gnomo, el goliat, el mediano, el humano, el orco y el tiefling, con linajes en lugar de subrazas.",
        ],
      ],
      [
        "Elige una clase",
        [
          "La clase es lo que hace tu personaje: guerrero, pícaro, mago, clérigo y el resto de las doce clases del SRD. Fija tu dado de golpe, las salvaciones en las que eres bueno, las armaduras y armas que puedes usar, cuántas habilidades eliges y los rasgos que ganas en cada nivel.",
          "Algunas clases eligen enseguida una subclase (un clérigo elige un dominio en el nivel 1), otras en el nivel 2 o 3 (un mago elige una escuela en el nivel 2, un guerrero un arquetipo en el 3).",
        ],
      ],
      [
        "Asigna tus puntuaciones de característica",
        [
          "Hay tres maneras habituales de obtener las seis puntuaciones:",
          [
            "Conjunto estándar: 15, 14, 13, 12, 10 y 8, en el orden que quieras.",
            "Compra de puntos: 27 puntos para gastar en puntuaciones entre 8 y 15, antes de los bonificadores de especie.",
            "Tirada: cuatro dados de seis caras, descartando el más bajo, seis veces.",
          ],
          "Pon tus mejores puntuaciones donde tu clase las necesita: Fuerza para un guerrero, Inteligencia para un mago, Destreza para un pícaro. El modificador de una puntuación es la puntuación menos 10, dividida entre 2, redondeada hacia abajo.",
        ],
      ],
      [
        "Elige un trasfondo",
        [
          "Un trasfondo da dos habilidades, algunas competencias con herramientas o idiomas, equipo inicial y un rasgo, y cuenta de dónde viene el héroe. El SRD incluye uno, el Acólito. Los demás vienen de otros libros: en Heroquill puedes importar los archivos de contenido que ya tienes, o escribir los tuyos con el editor homebrew.",
        ],
      ],
      [
        "Habilidades, competencias y equipo",
        [
          "Elige las habilidades que permite tu clase y toma el equipo que ofrecen la clase y el trasfondo. Tu Clase de Armadura viene de la armadura que llevas más tu modificador de Destreza (con algunos límites), y cada arma tiene un bonificador de ataque hecho del modificador de característica y, si eres competente, del bonificador de competencia, que en el nivel 1 es +2.",
        ],
      ],
      [
        "Conjuros, si tu clase lanza conjuros",
        [
          "Los lanzadores de conjuros eligen trucos (conjuros que se lanzan a voluntad) y, según la clase, conjuros conocidos o preparados cada día. Los espacios de conjuro limitan cuántos conjuros con nivel se lanzan antes de descansar. La CD de salvación de tus conjuros es 8 + tu bonificador de competencia + el modificador de tu característica de lanzamiento, y el ataque de conjuro es el bonificador de competencia + ese modificador.",
        ],
      ],
      [
        "Puntos de golpe y últimos retoques",
        [
          "En el nivel 1 tus puntos de golpe son el valor máximo de tu dado de golpe más tu modificador de Constitución. Luego dale al héroe un nombre, un alineamiento, rasgos de personalidad, ideales, vínculos y defectos, y unas palabras sobre su aspecto. No cuesta nada y hace que el personaje cobre vida en la mesa.",
        ],
      ],
      [
        "Sube de nivel",
        [
          "Cada nivel nuevo trae puntos de golpe (tira tu dado de golpe o toma la media), nuevos rasgos de clase y a veces conjuros nuevos. En los niveles 4, 8, 12, 16 y 19 la mayoría de las clases pueden aumentar sus puntuaciones de característica o elegir una dote. También se puede multiclasear, si las puntuaciones cumplen los requisitos de ambas clases.",
        ],
      ],
      [
        "Cómo te ayuda Heroquill",
        [
          "Heroquill sigue estos pasos uno a uno y calcula cada número por ti: modificadores, salvaciones, habilidades, Clase de Armadura, puntos de golpe, espacios de conjuro y CD, con dotes y multiclase aplicados. Puedes cambiar a mano cualquier valor, jugar el personaje en la misma pantalla con puntos de golpe, espacios, descansos y dados, imprimir la hoja y las cartas de conjuros, o compartir el personaje con un enlace. Es gratis, no necesita cuenta y funciona sin conexión.",
        ],
      ],
    ],
    cta: "¿Quieres ver un personaje terminado? Abre a Aria, una maga elfa de nivel 5, o empieza el tuyo.",
  },
};
