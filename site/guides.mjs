// The guides that go deeper into one part of the app, in every language: adding content from Aurora,
// automatic translation with a DeepL key, and translating Heroquill itself. Their addresses are in
// src/content/news.ts. Like the main guide (guide.mjs), a section is a heading and a list of blocks:
// a string is a paragraph, an array is a list of items.
import { SHEET_GUIDE } from "./sheet-guide.mjs";

export const MORE = {
  en: "More guides",
  it: "Altre guide",
  fr: "Autres guides",
  de: "Weitere Anleitungen",
  es: "Más guías",
};

export const GUIDES = {
  sheet: SHEET_GUIDE,
  aurora: {
    en: {
      label: "Add content from Aurora",
      title: "How to Import Aurora Content Packs into Heroquill",
      desc: "Add the Aurora Builder and Aurora Legacy content you already own to Heroquill: by file, by index file or by address, and what the report means.",
      h1: "How to import Aurora content",
      intro:
        "Heroquill reads the content files made for Aurora Builder and Aurora Legacy, so the species, classes, spells and items you already use can appear in your character. Here is how to add them, step by step.",
      cta: "Ready to add your own content?",
      sections: [
        [
          "What this does, and what it does not",
          [
            "Heroquill comes with the free rules of the SRD 5.1 and the SRD 5.2.1. Everything else you add yourself, from files you already have. Nothing from Aurora or from any publisher is bundled in the app, and the app never downloads content on its own: it fetches only from an address you type, or one listed in an index file you chose.",
            "What you add stays on your device, in your browser. A pack made from your own files can be removed at any time but never exported or shared: only add content you have the right to use.",
          ],
        ],
        [
          "Open the Content packs page",
          [
            "Open the ☰ menu and choose Content packs. The page lists what comes with the app and, under Your packs, what you have added. At the bottom, under Add content, are the three ways to bring Aurora files in.",
          ],
        ],
        [
          "Way 1: choose files from your computer",
          [
            "Press Add Aurora XML files and pick one or more files. They can be content files (.xml) or index files (.index). You can select many at once. This is the simplest way when you already have the files on the device.",
          ],
        ],
        [
          "Way 2: an index file brings a whole book",
          [
            "An index file lists every content file of a book or of a whole collection. When you choose one, Heroquill follows the list and fetches each file from the address written in it, up to 1500 files: enough for the whole Aurora Legacy collection, about 750 files and 8000 entries. A progress line shows how many files are done.",
          ],
        ],
        [
          "Way 3: type an address",
          [
            "Paste the address of an Aurora file or index in the box under the buttons and press Fetch from address. The address must start with https, and the site must allow web pages to read it. If you paste the address of a file shown on GitHub, Heroquill turns it into the address of the raw file by itself.",
          ],
        ],
        [
          "Read the report",
          [
            "When the import ends, a report says what happened:",
            [
              "how many entries were added to the pack;",
              "entries the app already has (the SRD) were left out, and whatever referred to them now points at the app’s own entry;",
              "entries that repeat another one, with the same name, text and effects, were merged into one;",
              "2024 versions are left out when the 2014 one is there, because the app follows the 2014 rules. A checkbox on the page keeps both;",
              "things that are not supported yet are listed (companions, background variants and stat blocks, for example);",
              "rules the app cannot apply by itself keep their text, and the report counts them: apply them by hand or with Free edit.",
            ],
          ],
        ],
        [
          "Use it in your character",
          [
            "The new species, classes, backgrounds, feats, spells and items now appear in the choices of the build steps, with the name of their source. Spells, languages, backgrounds, species, feats, classes, subclasses, magic items and deities are read; for magic items the bonuses to armor class, saving throws, speed, ability scores and similar are applied while the item is equipped.",
          ],
        ],
        [
          "Keep it up to date, and take it to another device",
          [
            "When the importer improves, a pack made with an older version shows Needs updating. Press Import again on it, or Update all the packs that need it. The pack keeps its place, so the characters that use it keep working.",
            "To use your packs on a phone or a second computer, use the transfer from the first device: it carries the addresses the packs came from, so on the new device you only press Import again. A pack made from files on disk needs its files again.",
          ],
        ],
        [
          "If something goes wrong",
          [
            [
              "“Nothing could be imported from those files”: the files are not Aurora content files, or are empty. Check that you chose .xml or .index files.",
              "“Files could not be fetched”: the address is wrong, is not https, or the site does not allow web pages to read it. Try the file from disk instead.",
              "“The index listed more files than the app follows at once”: add the rest with a second import.",
            ],
          ],
        ],
      ],
    },
    it: {
      label: "Aggiungere contenuti da Aurora",
      title: "Come importare i pacchetti di contenuti di Aurora in Heroquill",
      desc: "Aggiungi a Heroquill i contenuti di Aurora Builder e Aurora Legacy che già possiedi: da file, da file indice o da indirizzo, e cosa significa il rapporto.",
      h1: "Come importare i contenuti di Aurora",
      intro:
        "Heroquill legge i file di contenuto fatti per Aurora Builder e Aurora Legacy, così le specie, le classi, gli incantesimi e gli oggetti che già usi possono comparire nel tuo personaggio. Ecco come aggiungerli, passo per passo.",
      cta: "Pronto ad aggiungere i tuoi contenuti?",
      sections: [
        [
          "Cosa fa, e cosa non fa",
          [
            "Heroquill include le regole libere dell’SRD 5.1 e dell’SRD 5.2.1. Tutto il resto lo aggiungi tu, da file che hai già. Nell’app non c’è nulla di Aurora né di alcun editore, e l’app non scarica mai contenuti da sola: li prende solo da un indirizzo che scrivi tu, o elencato in un file indice che hai scelto.",
            "Ciò che aggiungi resta sul tuo dispositivo, nel browser. Un pacchetto fatto da file tuoi si può rimuovere in ogni momento ma non esportare né condividere: aggiungi solo contenuti che hai il diritto di usare.",
          ],
        ],
        [
          "Apri la pagina Pacchetti di contenuti",
          [
            "Apri il menu ☰ e scegli Pacchetti di contenuti. La pagina elenca ciò che arriva con l’app e, sotto I tuoi pacchetti, ciò che hai aggiunto. In fondo, sotto Aggiungi contenuti, ci sono i tre modi per portare dentro i file di Aurora.",
          ],
        ],
        [
          "Modo 1: scegli file dal computer",
          [
            "Premi Aggiungi file XML di Aurora e scegli uno o più file. Possono essere file di contenuto (.xml) o file indice (.index), anche molti insieme. È il modo più semplice quando hai già i file sul dispositivo.",
          ],
        ],
        [
          "Modo 2: un file indice porta un intero libro",
          [
            "Un file indice elenca tutti i file di contenuto di un libro o di un’intera raccolta. Quando ne scegli uno, Heroquill segue l’elenco e scarica ogni file dall’indirizzo scritto al suo interno, fino a 1500 file: abbastanza per tutta la raccolta Aurora Legacy, circa 750 file e 8000 voci. Una riga di avanzamento mostra quanti file sono pronti.",
          ],
        ],
        [
          "Modo 3: scrivi un indirizzo",
          [
            "Incolla l’indirizzo di un file o di un indice di Aurora nella casella sotto i pulsanti e premi Scarica dall’indirizzo. L’indirizzo deve iniziare con https e il sito deve permettere alle pagine web di leggerlo. Se incolli l’indirizzo di un file mostrato su GitHub, Heroquill lo trasforma da solo nell’indirizzo del file grezzo.",
          ],
        ],
        [
          "Leggi il rapporto",
          [
            "Alla fine un rapporto dice cos’è successo:",
            [
              "quante voci sono state aggiunte al pacchetto;",
              "le voci che l’app ha già (l’SRD) sono state lasciate fuori, e ciò che le richiamava ora punta alla voce dell’app;",
              "le voci che ne ripetono un’altra, con stesso nome, testo ed effetti, sono state unite in una sola;",
              "le versioni 2024 sono escluse quando c’è quella 2014, perché l’app segue le regole 2014. Una casella nella pagina le tiene entrambe;",
              "ciò che non è ancora supportato è elencato (compagni, varianti di background e schede mostro, per esempio);",
              "le regole che l’app non sa applicare da sola mantengono il loro testo, e il rapporto le conta: applicale a mano o con la Modifica libera.",
            ],
          ],
        ],
        [
          "Usali nel tuo personaggio",
          [
            "Le nuove specie, classi, background, talenti, incantesimi e oggetti compaiono ora nelle scelte dei passi di creazione, con il nome della loro fonte. Si leggono incantesimi, lingue, background, specie, talenti, classi, sottoclassi, oggetti magici e divinità; per gli oggetti magici i bonus a classe armatura, tiri salvezza, velocità, punteggi di caratteristica e simili si applicano quando l’oggetto è equipaggiato.",
          ],
        ],
        [
          "Tienili aggiornati e portali su un altro dispositivo",
          [
            "Quando l’importatore migliora, un pacchetto fatto con una versione più vecchia mostra Da aggiornare. Premi Reimporta, oppure Aggiorna tutti i pacchetti che ne hanno bisogno. Il pacchetto mantiene il suo posto, quindi i personaggi che lo usano continuano a funzionare.",
            "Per usare i pacchetti su un telefono o su un secondo computer, usa il trasferimento dal primo dispositivo: porta con sé gli indirizzi da cui i pacchetti arrivavano, quindi sul nuovo basta premere Reimporta. Un pacchetto fatto da file su disco richiede di nuovo i suoi file.",
          ],
        ],
        [
          "Se qualcosa va storto",
          [
            [
              "«Non è stato possibile importare nulla da quei file»: i file non sono file di contenuto di Aurora, oppure sono vuoti. Controlla di aver scelto file .xml o .index.",
              "«File non scaricati»: l’indirizzo è sbagliato, non è https, oppure il sito non permette alle pagine web di leggerlo. Prova con il file su disco.",
              "«L’indice elencava più file di quanti l’app ne segua in una volta»: aggiungi il resto con una seconda importazione.",
            ],
          ],
        ],
      ],
    },
    fr: {
      label: "Ajouter du contenu depuis Aurora",
      title: "Comment importer des paquets de contenu Aurora dans Heroquill",
      desc: "Ajoute à Heroquill le contenu d’Aurora Builder et d’Aurora Legacy que tu possèdes déjà : par fichier, par fichier d’index ou par adresse, et ce que dit le rapport.",
      h1: "Comment importer le contenu d’Aurora",
      intro:
        "Heroquill lit les fichiers de contenu faits pour Aurora Builder et Aurora Legacy : les espèces, classes, sorts et objets que tu utilises déjà peuvent ainsi apparaître dans ton personnage. Voici comment les ajouter, pas à pas.",
      cta: "Prêt à ajouter ton contenu ?",
      sections: [
        [
          "Ce que ça fait, et ce que ça ne fait pas",
          [
            "Heroquill est livré avec les règles libres du SRD 5.1 et du SRD 5.2.1. Tout le reste, tu l’ajoutes toi-même, à partir de fichiers que tu as déjà. Rien d’Aurora ni d’aucun éditeur n’est inclus dans l’app, et l’app ne télécharge jamais de contenu toute seule : elle ne va chercher qu’à une adresse que tu écris, ou listée dans un fichier d’index que tu as choisi.",
            "Ce que tu ajoutes reste sur ton appareil, dans ton navigateur. Un paquet fait de tes propres fichiers peut être retiré à tout moment, mais jamais exporté ni partagé : n’ajoute que du contenu que tu as le droit d’utiliser.",
          ],
        ],
        [
          "Ouvre la page Paquets de contenu",
          [
            "Ouvre le menu ☰ et choisis Paquets de contenu. La page liste ce qui est fourni avec l’app et, sous Tes paquets, ce que tu as ajouté. En bas, sous Ajouter du contenu, se trouvent les trois façons d’amener des fichiers Aurora.",
          ],
        ],
        [
          "Façon 1 : choisir des fichiers sur ton ordinateur",
          [
            "Appuie sur Ajouter des fichiers XML d’Aurora et choisis un ou plusieurs fichiers. Ce peuvent être des fichiers de contenu (.xml) ou d’index (.index), plusieurs à la fois. C’est le plus simple quand tu as déjà les fichiers sur l’appareil.",
          ],
        ],
        [
          "Façon 2 : un fichier d’index apporte tout un livre",
          [
            "Un fichier d’index liste tous les fichiers de contenu d’un livre ou d’une collection entière. Quand tu en choisis un, Heroquill suit la liste et récupère chaque fichier à l’adresse qui y est écrite, jusqu’à 1500 fichiers : de quoi couvrir toute la collection Aurora Legacy, environ 750 fichiers et 8000 entrées. Une ligne de progression montre combien de fichiers sont faits.",
          ],
        ],
        [
          "Façon 3 : écrire une adresse",
          [
            "Colle l’adresse d’un fichier ou d’un index Aurora dans la zone sous les boutons et appuie sur Récupérer depuis l’adresse. L’adresse doit commencer par https et le site doit permettre aux pages web de la lire. Si tu colles l’adresse d’un fichier affiché sur GitHub, Heroquill la transforme tout seul en adresse du fichier brut.",
          ],
        ],
        [
          "Lis le rapport",
          [
            "À la fin, un rapport dit ce qui s’est passé :",
            [
              "combien d’entrées ont été ajoutées au paquet ;",
              "les entrées que l’app a déjà (le SRD) sont laissées de côté, et ce qui y faisait référence pointe maintenant vers l’entrée de l’app ;",
              "les entrées qui en répètent une autre, avec le même nom, texte et effets, sont fusionnées en une seule ;",
              "les versions 2024 sont laissées de côté quand la version 2014 est là, car l’app suit les règles 2014. Une case sur la page garde les deux ;",
              "ce qui n’est pas encore géré est listé (compagnons, variantes d’historique et fiches de monstre, par exemple) ;",
              "les règles que l’app ne sait pas appliquer seule gardent leur texte, et le rapport les compte : applique-les à la main ou avec la Modification libre.",
            ],
          ],
        ],
        [
          "Utilise-les dans ton personnage",
          [
            "Les nouvelles espèces, classes, historiques, dons, sorts et objets apparaissent dans les choix des étapes de création, avec le nom de leur source. Sorts, langues, historiques, espèces, dons, classes, sous-classes, objets magiques et divinités sont lus ; pour les objets magiques, les bonus à la classe d’armure, aux jets de sauvegarde, à la vitesse, aux caractéristiques et autres s’appliquent quand l’objet est équipé.",
          ],
        ],
        [
          "Garde-les à jour et emmène-les sur un autre appareil",
          [
            "Quand l’importateur s’améliore, un paquet fait avec une ancienne version affiche À mettre à jour. Appuie sur Réimporter, ou sur Mettre à jour tous les paquets qui en ont besoin. Le paquet garde sa place, donc les personnages qui l’utilisent continuent de fonctionner.",
            "Pour utiliser tes paquets sur un téléphone ou un second ordinateur, utilise le transfert depuis le premier appareil : il emporte les adresses d’où venaient les paquets, donc sur le nouvel appareil il suffit d’appuyer sur Réimporter. Un paquet fait de fichiers sur disque demande ses fichiers de nouveau.",
          ],
        ],
        [
          "Si quelque chose ne va pas",
          [
            [
              "« Rien n’a pu être importé de ces fichiers » : ce ne sont pas des fichiers de contenu Aurora, ou ils sont vides. Vérifie que tu as choisi des fichiers .xml ou .index.",
              "« Des fichiers n’ont pas pu être récupérés » : l’adresse est fausse, n’est pas en https, ou le site ne permet pas aux pages web de la lire. Essaie avec le fichier sur disque.",
              "« L’index listait plus de fichiers que l’app n’en suit à la fois » : ajoute le reste avec une seconde importation.",
            ],
          ],
        ],
      ],
    },
    de: {
      label: "Inhalte aus Aurora hinzufügen",
      title: "So importierst du Aurora-Inhaltspakete in Heroquill",
      desc: "Füge die Inhalte von Aurora Builder und Aurora Legacy, die du schon besitzt, zu Heroquill hinzu: per Datei, Indexdatei oder Adresse, und was der Bericht bedeutet.",
      h1: "So importierst du Aurora-Inhalte",
      intro:
        "Heroquill liest die Inhaltsdateien für Aurora Builder und Aurora Legacy, sodass die Völker, Klassen, Zauber und Gegenstände, die du schon nutzt, in deinem Charakter erscheinen können. So fügst du sie hinzu, Schritt für Schritt.",
      cta: "Bereit, deine eigenen Inhalte hinzuzufügen?",
      sections: [
        [
          "Was das tut und was nicht",
          [
            "Heroquill bringt die freien Regeln des SRD 5.1 und des SRD 5.2.1 mit. Alles andere fügst du selbst hinzu, aus Dateien, die du schon hast. In der App steckt nichts von Aurora oder einem Verlag, und die App lädt nie von selbst Inhalte herunter: sie holt nur von einer Adresse, die du eingibst, oder die in einer von dir gewählten Indexdatei steht.",
            "Was du hinzufügst, bleibt auf deinem Gerät, in deinem Browser. Ein Paket aus eigenen Dateien lässt sich jederzeit entfernen, aber nie exportieren oder teilen: füge nur Inhalte hinzu, die du verwenden darfst.",
          ],
        ],
        [
          "Öffne die Seite Inhaltspakete",
          [
            "Öffne das Menü ☰ und wähle Inhaltspakete. Die Seite listet, was die App mitbringt, und unter Deine Pakete, was du hinzugefügt hast. Unten, unter Inhalte hinzufügen, stehen die drei Wege, Aurora-Dateien hereinzuholen.",
          ],
        ],
        [
          "Weg 1: Dateien vom Computer wählen",
          [
            "Tippe auf Aurora-XML-Dateien hinzufügen und wähle eine oder mehrere Dateien. Das können Inhaltsdateien (.xml) oder Indexdateien (.index) sein, auch viele auf einmal. Das ist der einfachste Weg, wenn die Dateien schon auf dem Gerät liegen.",
          ],
        ],
        [
          "Weg 2: Eine Indexdatei bringt ein ganzes Buch",
          [
            "Eine Indexdatei listet alle Inhaltsdateien eines Buchs oder einer ganzen Sammlung. Wählst du eine, folgt Heroquill der Liste und holt jede Datei von der darin stehenden Adresse, bis zu 1500 Dateien: genug für die ganze Sammlung Aurora Legacy, etwa 750 Dateien und 8000 Einträge. Eine Fortschrittszeile zeigt, wie viele Dateien fertig sind.",
          ],
        ],
        [
          "Weg 3: Eine Adresse eingeben",
          [
            "Füge die Adresse einer Aurora-Datei oder eines Index in das Feld unter den Schaltflächen ein und tippe auf Von Adresse laden. Die Adresse muss mit https beginnen, und die Seite muss Webseiten das Lesen erlauben. Fügst du die Adresse einer auf GitHub angezeigten Datei ein, macht Heroquill daraus selbst die Adresse der Rohdatei.",
          ],
        ],
        [
          "Den Bericht lesen",
          [
            "Am Ende sagt ein Bericht, was passiert ist:",
            [
              "wie viele Einträge dem Paket hinzugefügt wurden;",
              "Einträge, die die App schon hat (das SRD), bleiben draußen, und was auf sie verwies, zeigt jetzt auf den Eintrag der App;",
              "Einträge, die einen anderen wiederholen (gleicher Name, Text und gleiche Effekte), wurden zu einem verschmolzen;",
              "2024-Versionen bleiben draußen, wenn die 2014-Version da ist, weil die App die Regeln von 2014 befolgt. Ein Kästchen auf der Seite behält beide;",
              "noch nicht Unterstütztes wird aufgelistet (zum Beispiel Gefährten, Hintergrundvarianten und Werteblöcke);",
              "Regeln, die die App nicht selbst anwenden kann, behalten ihren Text, und der Bericht zählt sie: wende sie von Hand oder mit der freien Bearbeitung an.",
            ],
          ],
        ],
        [
          "In deinem Charakter verwenden",
          [
            "Die neuen Völker, Klassen, Hintergründe, Talente, Zauber und Gegenstände erscheinen nun in den Auswahlen der Erstellungsschritte, mit dem Namen ihrer Quelle. Gelesen werden Zauber, Sprachen, Hintergründe, Völker, Talente, Klassen, Unterklassen, magische Gegenstände und Gottheiten; bei magischen Gegenständen gelten Boni auf Rüstungsklasse, Rettungswürfe, Bewegungsrate, Attributswerte und Ähnliches, solange der Gegenstand getragen wird.",
          ],
        ],
        [
          "Aktuell halten und auf ein anderes Gerät mitnehmen",
          [
            "Wird der Import besser, zeigt ein mit einer älteren Version gemachtes Paket Aktualisierung nötig. Tippe auf Erneut importieren oder auf Alle Pakete aktualisieren, die es brauchen. Das Paket behält seinen Platz, die Charaktere, die es nutzen, funktionieren weiter.",
            "Um deine Pakete auf einem Handy oder zweiten Computer zu nutzen, nimm die Übertragung vom ersten Gerät: sie trägt die Adressen mit, von denen die Pakete kamen, auf dem neuen Gerät tippst du also nur auf Erneut importieren. Ein Paket aus Dateien auf der Festplatte braucht seine Dateien erneut.",
          ],
        ],
        [
          "Wenn etwas schiefgeht",
          [
            [
              "„Aus diesen Dateien konnte nichts importiert werden“: Die Dateien sind keine Aurora-Inhaltsdateien oder leer. Prüfe, ob du .xml- oder .index-Dateien gewählt hast.",
              "„Dateien konnten nicht geladen werden“: Die Adresse ist falsch, nicht https, oder die Seite erlaubt Webseiten das Lesen nicht. Versuche es mit der Datei von der Festplatte.",
              "„Der Index listete mehr Dateien, als die App auf einmal verfolgt“: Füge den Rest mit einem zweiten Import hinzu.",
            ],
          ],
        ],
      ],
    },
    es: {
      label: "Añadir contenido de Aurora",
      title: "Cómo importar paquetes de contenido de Aurora en Heroquill",
      desc: "Añade a Heroquill el contenido de Aurora Builder y Aurora Legacy que ya tienes: por archivo, por archivo de índice o por dirección, y qué significa el informe.",
      h1: "Cómo importar contenido de Aurora",
      intro:
        "Heroquill lee los archivos de contenido hechos para Aurora Builder y Aurora Legacy, así que las especies, clases, conjuros y objetos que ya usas pueden aparecer en tu personaje. Así se añaden, paso a paso.",
      cta: "¿Listo para añadir tu contenido?",
      sections: [
        [
          "Qué hace y qué no hace",
          [
            "Heroquill incluye las reglas libres del SRD 5.1 y del SRD 5.2.1. Todo lo demás lo añades tú, desde archivos que ya tienes. En la app no hay nada de Aurora ni de ninguna editorial, y la app nunca descarga contenido por su cuenta: solo lo busca en una dirección que escribes tú, o listada en un archivo de índice que elegiste.",
            "Lo que añades se queda en tu dispositivo, en el navegador. Un paquete hecho con tus propios archivos se puede quitar en cualquier momento, pero nunca exportar ni compartir: añade solo contenido que tengas derecho a usar.",
          ],
        ],
        [
          "Abre la página Paquetes de contenido",
          [
            "Abre el menú ☰ y elige Paquetes de contenido. La página lista lo que viene con la app y, en Tus paquetes, lo que has añadido. Abajo, en Añadir contenido, están las tres formas de traer archivos de Aurora.",
          ],
        ],
        [
          "Forma 1: elegir archivos del ordenador",
          [
            "Pulsa Añadir archivos XML de Aurora y elige uno o varios archivos. Pueden ser archivos de contenido (.xml) o de índice (.index), varios a la vez. Es lo más sencillo cuando ya tienes los archivos en el dispositivo.",
          ],
        ],
        [
          "Forma 2: un archivo de índice trae un libro entero",
          [
            "Un archivo de índice lista todos los archivos de contenido de un libro o de una colección entera. Cuando eliges uno, Heroquill sigue la lista y obtiene cada archivo de la dirección escrita en él, hasta 1500 archivos: suficiente para toda la colección Aurora Legacy, unos 750 archivos y 8000 entradas. Una línea de progreso muestra cuántos archivos van.",
          ],
        ],
        [
          "Forma 3: escribir una dirección",
          [
            "Pega la dirección de un archivo o índice de Aurora en el cuadro bajo los botones y pulsa Obtener desde la dirección. La dirección debe empezar por https y el sitio debe permitir que las páginas web la lean. Si pegas la dirección de un archivo mostrado en GitHub, Heroquill la convierte sola en la dirección del archivo en bruto.",
          ],
        ],
        [
          "Lee el informe",
          [
            "Al terminar, un informe dice qué ocurrió:",
            [
              "cuántas entradas se añadieron al paquete;",
              "las entradas que la app ya tiene (el SRD) se dejan fuera, y lo que las mencionaba ahora apunta a la entrada de la app;",
              "las entradas que repiten otra, con el mismo nombre, texto y efectos, se fusionan en una;",
              "las versiones de 2024 se dejan fuera cuando está la de 2014, porque la app sigue las reglas de 2014. Una casilla de la página conserva ambas;",
              "lo que aún no se admite se lista (compañeros, variantes de trasfondo y fichas de monstruo, por ejemplo);",
              "las reglas que la app no sabe aplicar sola conservan su texto, y el informe las cuenta: aplícalas a mano o con la Edición libre.",
            ],
          ],
        ],
        [
          "Úsalo en tu personaje",
          [
            "Las nuevas especies, clases, trasfondos, dotes, conjuros y objetos aparecen ya en las opciones de los pasos de creación, con el nombre de su fuente. Se leen conjuros, idiomas, trasfondos, especies, dotes, clases, subclases, objetos mágicos y deidades; en los objetos mágicos, los bonificadores a la clase de armadura, tiradas de salvación, velocidad, puntuaciones de característica y similares se aplican mientras el objeto está equipado.",
          ],
        ],
        [
          "Mantenlo al día y llévalo a otro dispositivo",
          [
            "Cuando el importador mejora, un paquete hecho con una versión anterior muestra Por actualizar. Pulsa Importar de nuevo, o Actualizar todos los paquetes que lo necesiten. El paquete conserva su lugar, así que los personajes que lo usan siguen funcionando.",
            "Para usar tus paquetes en un móvil o un segundo ordenador, usa la transferencia desde el primer dispositivo: lleva consigo las direcciones de donde venían los paquetes, así que en el nuevo basta con pulsar Importar de nuevo. Un paquete hecho con archivos del disco necesita de nuevo sus archivos.",
          ],
        ],
        [
          "Si algo sale mal",
          [
            [
              "«No se pudo importar nada de esos archivos»: no son archivos de contenido de Aurora, o están vacíos. Comprueba que elegiste archivos .xml o .index.",
              "«No se pudieron obtener archivos»: la dirección es incorrecta, no es https, o el sitio no permite que las páginas web la lean. Prueba con el archivo del disco.",
              "«El índice listaba más archivos de los que la app sigue de una vez»: añade el resto con una segunda importación.",
            ],
          ],
        ],
      ],
    },
  },

  autotranslate: {
    en: {
      label: "Turn on automatic translation",
      title: "How to Turn On Automatic Translation and Get a DeepL Key",
      desc: "Read Heroquill in your language: how the free automatic translation works, and how to get a free DeepL API key for better translations.",
      h1: "How to turn on automatic translation",
      intro:
        "Rules and descriptions that nobody has translated into your language yet can be translated as you read them. It works with nothing to set up, and a DeepL key makes the result better. Here is how both work.",
      cta: "Ready to read it in your language?",
      sections: [
        [
          "How it works",
          [
            "Choose your language from the ☰ menu. Texts that have no translation in it yet are translated as you read them, for free and with nothing to set up. A translated text says so, and can be switched back to the English original with one tap.",
            "Everything that is translated is kept on your device, so each text is translated only once, and it stays there when you are offline. There is nothing to translate while the app is in English.",
          ],
        ],
        [
          "Open the page",
          [
            "Open the ☰ menu and choose Automatic translation. There you can switch the translation on or off for the texts that are still in English, and choose how it behaves.",
          ],
        ],
        [
          "Choose how it behaves",
          [
            [
              "Translate descriptions, not names. Machine translation does well with sentences and badly with a name on its own: without context a name often comes out wrong. With this on, names stay in English and everything else is translated. It also uses fewer characters of your allowance.",
              "Improve translations over time: when you have a DeepL key, texts that were translated for free can be translated again with it.",
            ],
          ],
        ],
        [
          "Why a DeepL key",
          [
            "With your own DeepL key the translations are better. DeepL offers a free plan for its API, with a monthly allowance of characters that DeepL may change, and paid plans. A game’s texts use little of the free allowance, and what is translated is kept on your device, so nothing is paid for twice.",
          ],
        ],
        [
          "Get a DeepL key",
          [
            [
              "Make a free account for the DeepL API at deepl.com/pro-api. It is not the account of the ordinary DeepL translator app, and DeepL may ask for a payment card to check who you are.",
              "Open your account and go to the API Keys tab. There is a key; on the free plan it ends in :fx.",
              "Copy it.",
            ],
            "Never share the key with anyone: whoever has it uses your allowance.",
          ],
        ],
        [
          "Put it in Heroquill",
          [
            [
              "On the Automatic translation page, open Advanced: your own DeepL key and relay.",
              "Paste the key in the DeepL key box.",
              "Press Check the connection. If all is well, the page says how many characters you have used this month out of your allowance.",
            ],
            "The key stays on your device. It travels to DeepL, through the relay, only with each translation request.",
          ],
        ],
        [
          "What the relay is",
          [
            "DeepL does not accept requests straight from a web page, so they go through a small relay. The default one is run by the author of Heroquill; it keeps neither your key nor your texts, and its code is public in the repository. If you prefer, you can run your own relay and type its address in the Relay address box: the repository explains how, in docs/TRANSLATION_PROXY.md.",
          ],
        ],
        [
          "If something goes wrong",
          [
            [
              "The check says the key is not valid: copy it again, with no spaces, and make sure it is an API key and not an account password.",
              "The check says the allowance is over: wait for the next month, or use a paid plan. Until then the free translation takes over.",
              "Nothing is translated: make sure the app is not in English and that Translate the texts that are still in English is on.",
            ],
          ],
        ],
      ],
    },
    it: {
      label: "Attivare la traduzione automatica",
      title: "Come attivare la traduzione automatica e ottenere una chiave DeepL",
      desc: "Leggi Heroquill nella tua lingua: come funziona la traduzione automatica gratuita e come ottenere una chiave API DeepL gratuita per traduzioni migliori.",
      h1: "Come attivare la traduzione automatica",
      intro:
        "Regole e descrizioni che nessuno ha ancora tradotto nella tua lingua possono essere tradotte mentre le leggi. Funziona senza configurare nulla, e una chiave DeepL migliora il risultato. Ecco come funzionano entrambe.",
      cta: "Pronto a leggerlo nella tua lingua?",
      sections: [
        [
          "Come funziona",
          [
            "Scegli la lingua dal menu ☰. I testi che non hanno ancora una traduzione vengono tradotti mentre li leggi, gratis e senza configurare nulla. Un testo tradotto lo dice, e con un tocco si torna all’originale inglese.",
            "Tutto ciò che viene tradotto resta sul tuo dispositivo, quindi ogni testo si traduce una sola volta e resta disponibile anche offline. Se l’app è in inglese non c’è nulla da tradurre.",
          ],
        ],
        [
          "Apri la pagina",
          [
            "Apri il menu ☰ e scegli Traduzione automatica. Qui puoi accendere o spegnere la traduzione dei testi ancora in inglese e scegliere come si comporta.",
          ],
        ],
        [
          "Scegli come si comporta",
          [
            [
              "Traduci le descrizioni, non i nomi. La traduzione automatica è brava con le frasi e meno con un nome da solo: senza contesto un nome spesso esce sbagliato. Con questa opzione i nomi restano in inglese e tutto il resto viene tradotto. Usa anche meno caratteri della tua quota.",
              "Migliora le traduzioni nel tempo: se hai una chiave DeepL, i testi tradotti gratis possono essere tradotti di nuovo con la chiave.",
            ],
          ],
        ],
        [
          "Perché una chiave DeepL",
          [
            "Con la tua chiave DeepL le traduzioni sono migliori. DeepL offre un piano gratuito per la sua API, con una quota mensile di caratteri che DeepL può cambiare, e piani a pagamento. I testi di un gioco usano poco della quota gratuita, e ciò che viene tradotto resta sul tuo dispositivo, quindi non si paga due volte la stessa cosa.",
          ],
        ],
        [
          "Ottieni una chiave DeepL",
          [
            [
              "Crea un account gratuito per l’API di DeepL su deepl.com/pro-api. Non è l’account dell’app di traduzione DeepL di tutti i giorni, e DeepL può chiedere una carta di pagamento per verificare chi sei.",
              "Apri il tuo account e vai alla scheda Chiavi API. C’è una chiave; nel piano gratuito finisce con :fx.",
              "Copiala.",
            ],
            "Non condividere mai la chiave: chi la ha usa la tua quota.",
          ],
        ],
        [
          "Mettila in Heroquill",
          [
            [
              "Nella pagina Traduzione automatica apri Avanzate: la tua chiave DeepL e il relay.",
              "Incolla la chiave nella casella Chiave DeepL.",
              "Premi Verifica il collegamento. Se va tutto bene, la pagina dice quanti caratteri hai usato questo mese sulla tua quota.",
            ],
            "La chiave resta sul tuo dispositivo. Viaggia verso DeepL, attraverso il relay, solo con ogni richiesta di traduzione.",
          ],
        ],
        [
          "Cos’è il relay",
          [
            "DeepL non accetta richieste direttamente da una pagina web, quindi passano da un piccolo relay. Quello predefinito è gestito dall’autore di Heroquill; non conserva né la tua chiave né i tuoi testi, e il suo codice è pubblico nel repository. Se preferisci, puoi gestirne uno tuo e scrivere il suo indirizzo nella casella Indirizzo del relay: il repository spiega come, in docs/TRANSLATION_PROXY.md.",
          ],
        ],
        [
          "Se qualcosa va storto",
          [
            [
              "Il controllo dice che la chiave non è valida: copiala di nuovo, senza spazi, e verifica che sia una chiave API e non la password dell’account.",
              "Il controllo dice che la quota è finita: aspetta il mese successivo o usa un piano a pagamento. Nel frattempo subentra la traduzione gratuita.",
              "Non si traduce nulla: controlla che l’app non sia in inglese e che Traduci i testi ancora in inglese sia attivo.",
            ],
          ],
        ],
      ],
    },
    fr: {
      label: "Activer la traduction automatique",
      title: "Comment activer la traduction automatique et obtenir une clé DeepL",
      desc: "Lis Heroquill dans ta langue : comment marche la traduction automatique gratuite, et comment obtenir une clé API DeepL gratuite pour de meilleures traductions.",
      h1: "Comment activer la traduction automatique",
      intro:
        "Les règles et descriptions que personne n’a encore traduites dans ta langue peuvent l’être pendant que tu les lis. Ça marche sans rien régler, et une clé DeepL améliore le résultat. Voici comment les deux fonctionnent.",
      cta: "Prêt à le lire dans ta langue ?",
      sections: [
        [
          "Comment ça marche",
          [
            "Choisis ta langue dans le menu ☰. Les textes qui n’ont pas encore de traduction sont traduits pendant que tu les lis, gratuitement et sans rien régler. Un texte traduit l’indique, et un appui ramène à l’original anglais.",
            "Tout ce qui est traduit reste sur ton appareil : chaque texte n’est traduit qu’une fois, et il reste disponible hors ligne. Quand l’app est en anglais, il n’y a rien à traduire.",
          ],
        ],
        [
          "Ouvre la page",
          [
            "Ouvre le menu ☰ et choisis Traduction automatique. Tu peux y activer ou couper la traduction des textes encore en anglais, et choisir son comportement.",
          ],
        ],
        [
          "Choisis son comportement",
          [
            [
              "Traduire les descriptions, pas les noms. La traduction automatique se débrouille bien avec les phrases et mal avec un nom isolé : sans contexte, un nom sort souvent faux. Avec cette option, les noms restent en anglais et le reste est traduit. Ça consomme aussi moins de caractères de ton quota.",
              "Améliorer les traductions avec le temps : si tu as une clé DeepL, les textes traduits gratuitement peuvent être retraduits avec elle.",
            ],
          ],
        ],
        [
          "Pourquoi une clé DeepL",
          [
            "Avec ta propre clé DeepL, les traductions sont meilleures. DeepL propose un forfait gratuit pour son API, avec un quota mensuel de caractères que DeepL peut modifier, et des forfaits payants. Les textes d’un jeu en consomment peu, et ce qui est traduit reste sur ton appareil : rien n’est payé deux fois.",
          ],
        ],
        [
          "Obtenir une clé DeepL",
          [
            [
              "Crée un compte gratuit pour l’API DeepL sur deepl.com/pro-api. Ce n’est pas le compte de l’app de traduction DeepL habituelle, et DeepL peut demander une carte bancaire pour vérifier ton identité.",
              "Ouvre ton compte et va dans l’onglet Clés d’API. Il y a une clé ; avec le forfait gratuit, elle finit par :fx.",
              "Copie-la.",
            ],
            "Ne partage jamais la clé : qui l’a utilise ton quota.",
          ],
        ],
        [
          "Mets-la dans Heroquill",
          [
            [
              "Sur la page Traduction automatique, ouvre Avancé : ta clé DeepL et le relais.",
              "Colle la clé dans la case Clé DeepL.",
              "Appuie sur Vérifier la connexion. Si tout va bien, la page indique combien de caractères tu as utilisés ce mois-ci sur ton quota.",
            ],
            "La clé reste sur ton appareil. Elle ne part vers DeepL, via le relais, qu’avec chaque demande de traduction.",
          ],
        ],
        [
          "Ce qu’est le relais",
          [
            "DeepL n’accepte pas les requêtes directement depuis une page web : elles passent par un petit relais. Celui par défaut est géré par l’auteur de Heroquill ; il ne garde ni ta clé ni tes textes, et son code est public dans le dépôt. Si tu préfères, tu peux faire tourner le tien et écrire son adresse dans la case Adresse du relais : le dépôt explique comment, dans docs/TRANSLATION_PROXY.md.",
          ],
        ],
        [
          "Si quelque chose ne va pas",
          [
            [
              "La vérification dit que la clé n’est pas valide : copie-la de nouveau, sans espaces, et assure-toi que c’est une clé d’API et non le mot de passe du compte.",
              "La vérification dit que le quota est épuisé : attends le mois suivant ou prends un forfait payant. En attendant, la traduction gratuite prend le relais.",
              "Rien n’est traduit : vérifie que l’app n’est pas en anglais et que Traduire les textes encore en anglais est activé.",
            ],
          ],
        ],
      ],
    },
    de: {
      label: "Automatische Übersetzung aktivieren",
      title: "So aktivierst du die automatische Übersetzung und bekommst einen DeepL-Schlüssel",
      desc: "Lies Heroquill in deiner Sprache: wie die kostenlose automatische Übersetzung funktioniert und wie du einen kostenlosen DeepL-API-Schlüssel für bessere Übersetzungen bekommst.",
      h1: "So aktivierst du die automatische Übersetzung",
      intro:
        "Regeln und Beschreibungen, die noch niemand in deine Sprache übersetzt hat, können beim Lesen übersetzt werden. Das geht ohne Einrichtung, und ein DeepL-Schlüssel verbessert das Ergebnis. So funktioniert beides.",
      cta: "Bereit, es in deiner Sprache zu lesen?",
      sections: [
        [
          "So funktioniert es",
          [
            "Wähle deine Sprache im Menü ☰. Texte, die noch keine Übersetzung haben, werden beim Lesen übersetzt, kostenlos und ohne Einrichtung. Ein übersetzter Text sagt das, und mit einem Tippen geht es zurück zum englischen Original.",
            "Alles Übersetzte bleibt auf deinem Gerät, jeder Text wird also nur einmal übersetzt und ist auch offline da. Ist die App auf Englisch, gibt es nichts zu übersetzen.",
          ],
        ],
        [
          "Die Seite öffnen",
          [
            "Öffne das Menü ☰ und wähle Automatische Übersetzung. Dort schaltest du die Übersetzung der noch englischen Texte ein oder aus und legst fest, wie sie sich verhält.",
          ],
        ],
        [
          "Festlegen, wie sie sich verhält",
          [
            [
              "Beschreibungen übersetzen, keine Namen. Maschinelle Übersetzung ist gut bei Sätzen und schlecht bei einem einzelnen Namen: ohne Zusammenhang gerät ein Name oft falsch. Mit dieser Option bleiben Namen englisch und alles andere wird übersetzt. Es verbraucht auch weniger Zeichen deines Kontingents.",
              "Übersetzungen mit der Zeit verbessern: hast du einen DeepL-Schlüssel, können kostenlos übersetzte Texte damit erneut übersetzt werden.",
            ],
          ],
        ],
        [
          "Warum ein DeepL-Schlüssel",
          [
            "Mit deinem eigenen DeepL-Schlüssel sind die Übersetzungen besser. DeepL bietet für seine API einen kostenlosen Tarif mit einem monatlichen Zeichenkontingent, das DeepL ändern kann, und bezahlte Tarife. Die Texte eines Spiels verbrauchen wenig, und Übersetztes bleibt auf deinem Gerät, nichts wird doppelt bezahlt.",
          ],
        ],
        [
          "Einen DeepL-Schlüssel holen",
          [
            [
              "Erstelle ein kostenloses Konto für die DeepL-API auf deepl.com/pro-api. Es ist nicht das Konto der gewöhnlichen DeepL-Übersetzer-App, und DeepL kann eine Zahlungskarte zur Identitätsprüfung verlangen.",
              "Öffne dein Konto und gehe zum Reiter API-Schlüssel. Dort steht ein Schlüssel; im kostenlosen Tarif endet er auf :fx.",
              "Kopiere ihn.",
            ],
            "Gib den Schlüssel nie weiter: wer ihn hat, verbraucht dein Kontingent.",
          ],
        ],
        [
          "In Heroquill eintragen",
          [
            [
              "Öffne auf der Seite Automatische Übersetzung den Bereich Erweitert: dein DeepL-Schlüssel und das Relais.",
              "Füge den Schlüssel in das Feld DeepL-Schlüssel ein.",
              "Tippe auf Verbindung prüfen. Wenn alles passt, zeigt die Seite, wie viele Zeichen du diesen Monat von deinem Kontingent verbraucht hast.",
            ],
            "Der Schlüssel bleibt auf deinem Gerät. Er geht nur mit jeder Übersetzungsanfrage über das Relay zu DeepL.",
          ],
        ],
        [
          "Was das Relay ist",
          [
            "DeepL nimmt Anfragen nicht direkt von einer Webseite an, sie laufen deshalb über ein kleines Relay. Das vorgegebene betreibt der Autor von Heroquill; es speichert weder deinen Schlüssel noch deine Texte, und sein Code ist öffentlich im Repository. Wenn du magst, betreibst du ein eigenes und trägst dessen Adresse im Feld Relay-Adresse ein: das Repository erklärt es in docs/TRANSLATION_PROXY.md.",
          ],
        ],
        [
          "Wenn etwas schiefgeht",
          [
            [
              "Die Prüfung sagt, der Schlüssel ist ungültig: kopiere ihn erneut, ohne Leerzeichen, und achte darauf, dass es ein API-Schlüssel ist und nicht das Kontopasswort.",
              "Die Prüfung sagt, das Kontingent ist aufgebraucht: warte den nächsten Monat ab oder nimm einen bezahlten Tarif. Bis dahin übernimmt die kostenlose Übersetzung.",
              "Nichts wird übersetzt: prüfe, dass die App nicht auf Englisch steht und Noch englische Texte übersetzen eingeschaltet ist.",
            ],
          ],
        ],
      ],
    },
    es: {
      label: "Activar la traducción automática",
      title: "Cómo activar la traducción automática y conseguir una clave de DeepL",
      desc: "Lee Heroquill en tu idioma: cómo funciona la traducción automática gratuita y cómo conseguir una clave gratuita de la API de DeepL para mejores traducciones.",
      h1: "Cómo activar la traducción automática",
      intro:
        "Las reglas y descripciones que nadie ha traducido aún a tu idioma pueden traducirse mientras las lees. Funciona sin configurar nada, y una clave de DeepL mejora el resultado. Así funcionan ambas.",
      cta: "¿Listo para leerlo en tu idioma?",
      sections: [
        [
          "Cómo funciona",
          [
            "Elige tu idioma en el menú ☰. Los textos que aún no tienen traducción se traducen mientras los lees, gratis y sin configurar nada. Un texto traducido lo indica, y con un toque se vuelve al original en inglés.",
            "Todo lo que se traduce se queda en tu dispositivo, así que cada texto se traduce una sola vez y sigue ahí sin conexión. Si la app está en inglés, no hay nada que traducir.",
          ],
        ],
        [
          "Abre la página",
          [
            "Abre el menú ☰ y elige Traducción automática. Ahí puedes activar o desactivar la traducción de los textos que siguen en inglés y elegir cómo se comporta.",
          ],
        ],
        [
          "Elige cómo se comporta",
          [
            [
              "Traducir descripciones, no nombres. La traducción automática lo hace bien con frases y mal con un nombre suelto: sin contexto, un nombre suele salir mal. Con esta opción los nombres quedan en inglés y todo lo demás se traduce. También gasta menos caracteres de tu cupo.",
              "Mejorar las traducciones con el tiempo: si tienes una clave de DeepL, los textos traducidos gratis pueden traducirse de nuevo con ella.",
            ],
          ],
        ],
        [
          "Por qué una clave de DeepL",
          [
            "Con tu propia clave de DeepL las traducciones son mejores. DeepL ofrece un plan gratuito para su API, con un cupo mensual de caracteres que DeepL puede cambiar, y planes de pago. Los textos de un juego gastan poco, y lo traducido se queda en tu dispositivo: no se paga dos veces por lo mismo.",
          ],
        ],
        [
          "Consigue una clave de DeepL",
          [
            [
              "Crea una cuenta gratuita para la API de DeepL en deepl.com/pro-api. No es la cuenta de la app de traducción habitual de DeepL, y DeepL puede pedir una tarjeta de pago para comprobar quién eres.",
              "Abre tu cuenta y ve a la pestaña Claves de API. Hay una clave; en el plan gratuito termina en :fx.",
              "Cópiala.",
            ],
            "No compartas nunca la clave: quien la tiene gasta tu cupo.",
          ],
        ],
        [
          "Ponla en Heroquill",
          [
            [
              "En la página Traducción automática, abre Avanzado: tu clave DeepL y el relé.",
              "Pega la clave en el cuadro Clave de DeepL.",
              "Pulsa Comprobar la conexión. Si todo va bien, la página dice cuántos caracteres has usado este mes de tu cupo.",
            ],
            "La clave se queda en tu dispositivo. Viaja a DeepL, a través del relé, solo con cada petición de traducción.",
          ],
        ],
        [
          "Qué es el relé",
          [
            "DeepL no acepta peticiones directamente desde una página web, así que pasan por un pequeño relé. El predeterminado lo gestiona el autor de Heroquill; no guarda ni tu clave ni tus textos, y su código es público en el repositorio. Si prefieres, puedes gestionar uno propio y escribir su dirección en el cuadro Dirección del relé: el repositorio lo explica en docs/TRANSLATION_PROXY.md.",
          ],
        ],
        [
          "Si algo sale mal",
          [
            [
              "La comprobación dice que la clave no es válida: cópiala de nuevo, sin espacios, y asegúrate de que es una clave de API y no la contraseña de la cuenta.",
              "La comprobación dice que el cupo se agotó: espera al mes siguiente o usa un plan de pago. Mientras tanto toma el relevo la traducción gratuita.",
              "No se traduce nada: comprueba que la app no está en inglés y que Traducir los textos que siguen en inglés está activado.",
            ],
          ],
        ],
      ],
    },
  },

  weblate: {
    en: {
      label: "Translate Heroquill",
      title: "How to Translate Heroquill into Your Language on Weblate",
      desc: "Help translate Heroquill, the free D&D 5e character creator, in your browser with Weblate: no code and no GitHub account needed.",
      h1: "How to translate Heroquill",
      intro:
        "Heroquill speaks five languages and every one of them can be better, or a new one can join. You translate in the browser, with no code and no GitHub account. Here is how it works.",
      cta: "Ready to write your story?",
      sections: [
        [
          "What there is to translate",
          [
            "Two kinds of texts, kept apart so you can pick what you like:",
            [
              "the app: buttons, menus, messages and help (a few thousand short texts);",
              "the rules: names and descriptions of species, classes, spells, items and the rest of the SRD 5.1 and 5.2.1. For Italian, French, German and Spanish the official translations of the SRD are already in; what is missing is welcome, and so is any correction.",
            ],
            "A text with no translation in your language shows in English, so a language can grow little by little. Nothing has to be finished at once.",
          ],
        ],
        [
          "Open the project",
          [
            "Heroquill is on Weblate, a free site for translating together. Open the project from the Contribute page, make an account on the site (or sign in, if you have one), choose your language and then what to translate. If your language is not in the list, ask for it with the Start new translation button, or tell us in the Discussions on GitHub.",
          ],
        ],
        [
          "Translate a text",
          [
            "Weblate shows the English text, a box for yours, and, on the side, the other languages and similar texts you already translated. Type the translation, save it and the next one comes up. You can also look at the list of texts still missing and start from there.",
          ],
        ],
        [
          "Keep what is inside curly braces",
          [
            "Some texts contain words in braces, like {name} or {count}. They are filled in by the app (a name, a number): copy them exactly as they are, and move them where your language needs them. Weblate warns you if one is missing or changed.",
          ],
        ],
        [
          "Keep it simple and consistent",
          [
            [
              "Use the same word for the same thing everywhere: Weblate offers a glossary and shows how you translated a word before.",
              "Write as the official rulebooks of your language do, for the names of spells, classes and the like.",
              "Short texts stay short: they have to fit on a button or a phone screen.",
              "When a text is unclear, look for where it is used (Weblate shows the key and often a note) or ask in the Discussions.",
            ],
          ],
        ],
        [
          "What happens next",
          [
            "Weblate sends your work to the project on GitHub as a proposed change, which the author reads and merges. It reaches everyone with the next version of the app, and the News page lists it. You never have to touch the code.",
          ],
        ],
        [
          "Licence",
          [
            "Your translations are released under the same licence as the texts they translate: the interface texts under the MIT licence of the project, the rules under CC-BY-4.0, the licence of the SRD 5.1 and 5.2.1. By translating you agree to that.",
          ],
        ],
      ],
    },
    it: {
      label: "Tradurre Heroquill",
      title: "Come tradurre Heroquill nella tua lingua con Weblate",
      desc: "Aiuta a tradurre Heroquill, il creatore gratuito di personaggi D&D 5e, dal browser con Weblate: nessun codice e nessun account GitHub.",
      h1: "Come tradurre Heroquill",
      intro:
        "Heroquill parla cinque lingue e ognuna può migliorare, oppure se ne può aggiungere una nuova. Si traduce dal browser, senza codice e senza un account GitHub. Ecco come funziona.",
      cta: "Pronto a scrivere la tua storia?",
      sections: [
        [
          "Cosa c’è da tradurre",
          [
            "Due tipi di testi, separati così puoi scegliere quelli che preferisci:",
            [
              "l’app: pulsanti, menu, messaggi e aiuti (qualche migliaio di testi brevi);",
              "le regole: nomi e descrizioni di specie, classi, incantesimi, oggetti e il resto dell’SRD 5.1 e 5.2.1. Per italiano, francese, tedesco e spagnolo ci sono già le traduzioni ufficiali dell’SRD; ciò che manca è benvenuto, e lo sono anche le correzioni.",
            ],
            "Un testo senza traduzione nella tua lingua appare in inglese, quindi una lingua può crescere un po’ alla volta. Non serve finire tutto subito.",
          ],
        ],
        [
          "Apri il progetto",
          [
            "Heroquill è su Weblate, un sito gratuito per tradurre insieme. Apri il progetto dalla pagina Contribuisci, crea un account sul sito (o accedi, se ne hai già uno), scegli la tua lingua e poi cosa tradurre. Se la tua lingua non è nell’elenco, chiedila con il pulsante per iniziare una nuova traduzione, oppure scrivicelo nelle Discussions su GitHub.",
          ],
        ],
        [
          "Traduci un testo",
          [
            "Weblate mostra il testo inglese, una casella per il tuo, e di lato le altre lingue e i testi simili che hai già tradotto. Scrivi la traduzione, salvala e compare la successiva. Puoi anche guardare l’elenco dei testi ancora mancanti e partire da lì.",
          ],
        ],
        [
          "Mantieni ciò che sta tra parentesi graffe",
          [
            "Alcuni testi contengono parole tra graffe, come {name} o {count}. Le riempie l’app (un nome, un numero): copiale esattamente così e spostale dove serve nella tua lingua. Weblate ti avvisa se una manca o è cambiata.",
          ],
        ],
        [
          "Semplice e coerente",
          [
            [
              "Usa la stessa parola per la stessa cosa ovunque: Weblate offre un glossario e mostra come hai tradotto una parola prima.",
              "Scrivi come fanno i manuali ufficiali della tua lingua per i nomi di incantesimi, classi e simili.",
              "I testi brevi restano brevi: devono stare su un pulsante o sullo schermo di un telefono.",
              "Se un testo non è chiaro, cerca dove viene usato (Weblate mostra la chiave e spesso una nota) o chiedi nelle Discussions.",
            ],
          ],
        ],
        [
          "Cosa succede dopo",
          [
            "Weblate manda il tuo lavoro al progetto su GitHub come modifica proposta, che l’autore legge e unisce. Arriva a tutti con la versione successiva dell’app, e la pagina Novità lo elenca. Non devi mai toccare il codice.",
          ],
        ],
        [
          "Licenza",
          [
            "Le tue traduzioni escono con la stessa licenza dei testi che traducono: i testi dell’interfaccia con la licenza MIT del progetto, le regole con la CC-BY-4.0, la licenza degli SRD 5.1 e 5.2.1. Traducendo accetti questo.",
          ],
        ],
      ],
    },
    fr: {
      label: "Traduire Heroquill",
      title: "Comment traduire Heroquill dans ta langue avec Weblate",
      desc: "Aide à traduire Heroquill, le créateur gratuit de personnages D&D 5e, dans ton navigateur avec Weblate : ni code ni compte GitHub.",
      h1: "Comment traduire Heroquill",
      intro:
        "Heroquill parle cinq langues et chacune peut s’améliorer, ou une nouvelle peut s’ajouter. On traduit dans le navigateur, sans code et sans compte GitHub. Voici comment ça marche.",
      cta: "Prêt à écrire ton histoire ?",
      sections: [
        [
          "Ce qu’il y a à traduire",
          [
            "Deux sortes de textes, séparés pour que tu choisisses ceux que tu préfères :",
            [
              "l’app : boutons, menus, messages et aides (quelques milliers de textes courts) ;",
              "les règles : noms et descriptions des espèces, classes, sorts, objets et le reste des SRD 5.1 et 5.2.1. Pour l’italien, le français, l’allemand et l’espagnol, les traductions officielles du SRD sont déjà là ; ce qui manque est bienvenu, tout comme les corrections.",
            ],
            "Un texte sans traduction dans ta langue s’affiche en anglais : une langue peut donc grandir petit à petit. Rien n’a besoin d’être fini d’un coup.",
          ],
        ],
        [
          "Ouvre le projet",
          [
            "Heroquill est sur Weblate, un site gratuit pour traduire ensemble. Ouvre le projet depuis la page Contribuer, crée un compte sur le site (ou connecte-toi si tu en as un), choisis ta langue puis ce que tu veux traduire. Si ta langue n’est pas dans la liste, demande-la avec le bouton pour commencer une nouvelle traduction, ou dis-le-nous dans les Discussions sur GitHub.",
          ],
        ],
        [
          "Traduis un texte",
          [
            "Weblate montre le texte anglais, une zone pour le tien, et sur le côté les autres langues et les textes similaires que tu as déjà traduits. Écris la traduction, enregistre-la et la suivante apparaît. Tu peux aussi regarder la liste des textes encore manquants et partir de là.",
          ],
        ],
        [
          "Garde ce qui est entre accolades",
          [
            "Certains textes contiennent des mots entre accolades, comme {name} ou {count}. L’app les remplit (un nom, un nombre) : copie-les exactement tels quels et place-les où ta langue le demande. Weblate te prévient si l’un manque ou a changé.",
          ],
        ],
        [
          "Simple et cohérent",
          [
            [
              "Utilise le même mot pour la même chose partout : Weblate offre un glossaire et montre comment tu as traduit un mot avant.",
              "Écris comme les manuels officiels de ta langue pour les noms de sorts, de classes et autres.",
              "Les textes courts restent courts : ils doivent tenir sur un bouton ou un écran de téléphone.",
              "Si un texte n’est pas clair, regarde où il est utilisé (Weblate montre la clé et souvent une note) ou demande dans les Discussions.",
            ],
          ],
        ],
        [
          "Et ensuite",
          [
            "Weblate envoie ton travail au projet sur GitHub comme une modification proposée, que l’auteur lit et fusionne. Elle arrive chez tout le monde avec la prochaine version de l’app, et la page Nouveautés la liste. Tu n’as jamais à toucher au code.",
          ],
        ],
        [
          "Licence",
          [
            "Tes traductions sont publiées sous la même licence que les textes qu’elles traduisent : les textes de l’interface sous la licence MIT du projet, les règles sous CC-BY-4.0, la licence des SRD 5.1 et 5.2.1. En traduisant, tu l’acceptes.",
          ],
        ],
      ],
    },
    de: {
      label: "Heroquill übersetzen",
      title: "So übersetzt du Heroquill mit Weblate in deine Sprache",
      desc: "Hilf, Heroquill, den kostenlosen D&D-5e-Charaktergenerator, im Browser mit Weblate zu übersetzen: ohne Code und ohne GitHub-Konto.",
      h1: "So übersetzt du Heroquill",
      intro:
        "Heroquill spricht fünf Sprachen, und jede kann besser werden, oder eine neue kommt dazu. Übersetzt wird im Browser, ohne Code und ohne GitHub-Konto. So geht es.",
      cta: "Bereit, deine Geschichte zu schreiben?",
      sections: [
        [
          "Was es zu übersetzen gibt",
          [
            "Zwei Arten von Texten, getrennt, damit du wählen kannst, was dir liegt:",
            [
              "die App: Schaltflächen, Menüs, Meldungen und Hilfen (einige tausend kurze Texte);",
              "die Regeln: Namen und Beschreibungen von Völkern, Klassen, Zaubern, Gegenständen und dem Rest der SRD 5.1 und 5.2.1. Für Italienisch, Französisch, Deutsch und Spanisch sind die offiziellen Übersetzungen des SRD schon drin; was fehlt, ist willkommen, ebenso Korrekturen.",
            ],
            "Ein Text ohne Übersetzung in deiner Sprache erscheint auf Englisch, eine Sprache kann also nach und nach wachsen. Nichts muss auf einmal fertig sein.",
          ],
        ],
        [
          "Das Projekt öffnen",
          [
            "Heroquill ist auf Weblate, einer kostenlosen Seite zum gemeinsamen Übersetzen. Öffne das Projekt über die Seite Mitmachen, erstelle ein Konto auf der Seite (oder melde dich an, falls du eins hast), wähle deine Sprache und dann, was du übersetzen willst. Fehlt deine Sprache in der Liste, fordere sie mit der Schaltfläche für eine neue Übersetzung an oder sag es uns in den Discussions auf GitHub.",
          ],
        ],
        [
          "Einen Text übersetzen",
          [
            "Weblate zeigt den englischen Text, ein Feld für deinen und seitlich die anderen Sprachen und ähnliche Texte, die du schon übersetzt hast. Schreibe die Übersetzung, speichere sie, und der nächste erscheint. Du kannst auch die Liste der noch fehlenden Texte ansehen und dort beginnen.",
          ],
        ],
        [
          "Behalte, was in geschweiften Klammern steht",
          [
            "Manche Texte enthalten Wörter in Klammern, wie {name} oder {count}. Die füllt die App aus (ein Name, eine Zahl): kopiere sie genau so und setze sie dorthin, wo deine Sprache sie braucht. Weblate warnt dich, wenn eines fehlt oder verändert ist.",
          ],
        ],
        [
          "Einfach und einheitlich",
          [
            [
              "Nimm überall dasselbe Wort für dieselbe Sache: Weblate bietet ein Glossar und zeigt, wie du ein Wort schon übersetzt hast.",
              "Schreibe wie die offiziellen Regelbücher deiner Sprache, bei Namen von Zaubern, Klassen und Ähnlichem.",
              "Kurze Texte bleiben kurz: sie müssen auf eine Schaltfläche oder einen Handybildschirm passen.",
              "Ist ein Text unklar, sieh nach, wo er verwendet wird (Weblate zeigt den Schlüssel und oft eine Notiz) oder frag in den Discussions.",
            ],
          ],
        ],
        [
          "Wie es weitergeht",
          [
            "Weblate schickt deine Arbeit als Änderungsvorschlag an das Projekt auf GitHub, den der Autor liest und übernimmt. Sie kommt mit der nächsten Version der App bei allen an, und die Seite Neuigkeiten führt sie auf. Den Code musst du nie anfassen.",
          ],
        ],
        [
          "Lizenz",
          [
            "Deine Übersetzungen erscheinen unter derselben Lizenz wie die Texte, die sie übersetzen: die Oberflächentexte unter der MIT-Lizenz des Projekts, die Regeln unter CC-BY-4.0, der Lizenz der SRD 5.1 und 5.2.1. Mit dem Übersetzen stimmst du dem zu.",
          ],
        ],
      ],
    },
    es: {
      label: "Traducir Heroquill",
      title: "Cómo traducir Heroquill a tu idioma con Weblate",
      desc: "Ayuda a traducir Heroquill, el creador gratuito de personajes de D&D 5e, desde el navegador con Weblate: sin código ni cuenta de GitHub.",
      h1: "Cómo traducir Heroquill",
      intro:
        "Heroquill habla cinco idiomas y cada uno puede mejorar, o puede sumarse uno nuevo. Se traduce en el navegador, sin código y sin cuenta de GitHub. Así funciona.",
      cta: "¿Listo para escribir tu historia?",
      sections: [
        [
          "Qué hay que traducir",
          [
            "Dos tipos de textos, separados para que elijas lo que prefieras:",
            [
              "la app: botones, menús, mensajes y ayudas (unos miles de textos cortos);",
              "las reglas: nombres y descripciones de especies, clases, conjuros, objetos y el resto de los SRD 5.1 y 5.2.1. Para italiano, francés, alemán y español ya están las traducciones oficiales del SRD; lo que falta es bienvenido, y las correcciones también.",
            ],
            "Un texto sin traducción en tu idioma se muestra en inglés, así que un idioma puede crecer poco a poco. No hace falta terminarlo todo de golpe.",
          ],
        ],
        [
          "Abre el proyecto",
          [
            "Heroquill está en Weblate, un sitio gratuito para traducir en común. Abre el proyecto desde la página Colabora, crea una cuenta en el sitio (o inicia sesión si ya tienes una), elige tu idioma y luego qué traducir. Si tu idioma no está en la lista, pídelo con el botón para empezar una traducción nueva, o cuéntanoslo en las Discussions de GitHub.",
          ],
        ],
        [
          "Traduce un texto",
          [
            "Weblate muestra el texto en inglés, un cuadro para el tuyo y, al lado, los otros idiomas y los textos parecidos que ya has traducido. Escribe la traducción, guárdala y aparece la siguiente. También puedes mirar la lista de textos que faltan y empezar por ahí.",
          ],
        ],
        [
          "Conserva lo que va entre llaves",
          [
            "Algunos textos contienen palabras entre llaves, como {name} o {count}. Las rellena la app (un nombre, un número): cópialas exactamente como están y colócalas donde tu idioma lo necesite. Weblate te avisa si falta una o ha cambiado.",
          ],
        ],
        [
          "Sencillo y coherente",
          [
            [
              "Usa la misma palabra para lo mismo en todas partes: Weblate ofrece un glosario y muestra cómo tradujiste una palabra antes.",
              "Escribe como los manuales oficiales de tu idioma, en los nombres de conjuros, clases y similares.",
              "Los textos cortos siguen cortos: tienen que caber en un botón o en la pantalla de un móvil.",
              "Si un texto no está claro, mira dónde se usa (Weblate muestra la clave y a menudo una nota) o pregunta en las Discussions.",
            ],
          ],
        ],
        [
          "Qué pasa después",
          [
            "Weblate envía tu trabajo al proyecto en GitHub como un cambio propuesto, que el autor lee y fusiona. Llega a todos con la próxima versión de la app, y la página Novedades lo lista. Nunca tienes que tocar el código.",
          ],
        ],
        [
          "Licencia",
          [
            "Tus traducciones se publican con la misma licencia que los textos que traducen: los textos de la interfaz con la licencia MIT del proyecto, las reglas con CC-BY-4.0, la licencia de los SRD 5.1 y 5.2.1. Al traducir aceptas eso.",
          ],
        ],
      ],
    },
  },
};
