// The contribute page: where to help, in every language. A way of helping appears on the page only
// while its address is set here, so a section is never a dead end (donations are left out for now).
export const COMMUNITY = {
  repo: "https://github.com/Mystikal91/heroquill",
  issues: "https://github.com/Mystikal91/heroquill/issues",
  discussions: "https://github.com/Mystikal91/heroquill/discussions",
  discord: "https://discord.gg/k6utY79gYs",
  weblate: "https://weblate.mystikal.it/projects/heroquill/",
  email: "hello@heroquill.app",
};

// Each text has its words in `heading` and `body`; `link` is the label of the button, and
// `note` a line under it.
export const CONTRIBUTE = {
  en: {
    title: "Contribute to Heroquill – Code, Translations and Feedback",
    desc: "Heroquill is free and open source. Help with the code, translate it into your language, report a problem, or just say you like it.",
    h1: "Make Heroquill better",
    intro:
      "Heroquill is free, open source and made in spare time. Here is how you can help, from a minute to a weekend.",
    cta: "Ready to write your story?",
    like: {
      heading: "Tell me you like it",
      body: "The easiest way to help, and the one that keeps this going: say that you use it. A message about a character you made, or a table you played at, is a good day.",
      discussions: "Say hello in Discussions",
      discord: "Join the Discord server",
      email: "Write an email",
    },
    translate: {
      heading: "Translate it",
      body: "The app, the guide and the rules of the SRD speak five languages, and every language can be better or new. Translations are done in the browser on Weblate, with no code and no account on GitHub. Proofreading what is already there helps just as much as adding new texts.",
      link: "Open Heroquill on Weblate",
      guide: "How translating works, step by step",
    },
    report: {
      heading: "Report a problem or suggest something",
      body: "Something broken, unclear or missing? Tell me what you did, what you expected and what happened; the browser and the device help. A screenshot or an exported character, with nothing private in it, makes it much faster to find.",
      issues: "Open an issue on GitHub",
      email: "or write to",
    },
    code: {
      heading: "Help with the code",
      body: "Heroquill is under the MIT licence: read it, use it, change it, share it. It is written in TypeScript with Preact, and runs with no server. The README explains how to run it on your computer, and CONTRIBUTING.md how to propose a change. Small, focused changes are the easiest to review.",
      link: "See the code on GitHub",
    },
    privacy:
      "Messages sent to the address above are forwarded to a private mailbox through Cloudflare Email Routing. They are used only to answer you, and are never shared or used for anything else.",
  },
  it: {
    title: "Contribuisci a Heroquill – codice, traduzioni e segnalazioni",
    desc: "Heroquill è gratuito e open source. Dai una mano col codice, traducilo nella tua lingua, segnala un problema o dimmi semplicemente che ti piace.",
    h1: "Aiutaci a migliorare Heroquill",
    intro:
      "Heroquill è gratuito, open source e nasce nel tempo libero. Ecco come puoi aiutare, da un minuto a un fine settimana.",
    cta: "Pronto a scrivere la tua storia?",
    like: {
      heading: "Fammi sapere che ti piace",
      body: "È l’aiuto più semplice, e quello che mantiene vivo il progetto: dimmi che lo usi. Un messaggio su un personaggio che hai creato o su un tavolo a cui hai giocato rende la giornata migliore.",
      discussions: "Saluta nelle Discussions",
      discord: "Entra nel server Discord",
      email: "Scrivi una mail",
    },
    translate: {
      heading: "Traducilo",
      body: "L’app, la guida e le regole dell’SRD parlano cinque lingue, e ogni lingua può migliorare o essere nuova. Si traduce dal browser su Weblate, senza codice e senza un account GitHub. Rileggere ciò che c’è già aiuta quanto aggiungere testi nuovi.",
      link: "Apri Heroquill su Weblate",
      guide: "Come funziona la traduzione, passo per passo",
    },
    report: {
      heading: "Segnala un problema o proponi qualcosa",
      body: "Qualcosa non funziona, non è chiaro o manca? Raccontami cosa hai fatto, cosa ti aspettavi e cosa è successo; browser e dispositivo aiutano. Uno screenshot o un personaggio esportato, senza nulla di privato, rende la ricerca molto più veloce.",
      issues: "Apri una segnalazione su GitHub",
      email: "oppure scrivi a",
    },
    code: {
      heading: "Dai una mano col codice",
      body: "Heroquill è sotto licenza MIT: leggilo, usalo, modificalo, condividilo. È scritto in TypeScript con Preact e funziona senza server. Il README spiega come avviarlo sul tuo computer, CONTRIBUTING.md come proporre una modifica. Le modifiche piccole e mirate sono le più facili da rivedere.",
      link: "Vedi il codice su GitHub",
    },
    privacy:
      "I messaggi inviati all’indirizzo qui sopra arrivano a una casella privata tramite Cloudflare Email Routing. Servono solo per risponderti e non vengono condivisi né usati per altro.",
  },
  fr: {
    title: "Contribuer à Heroquill – code, traductions et retours",
    desc: "Heroquill est gratuit et open source. Aide pour le code, traduis-le dans ta langue, signale un problème ou dis simplement qu’il te plaît.",
    h1: "Aide à améliorer Heroquill",
    intro:
      "Heroquill est gratuit, open source et fait sur le temps libre. Voici comment aider, d’une minute à un week-end.",
    cta: "Prêt à écrire ton histoire ?",
    like: {
      heading: "Dis-moi que ça te plaît",
      body: "C’est l’aide la plus simple, et celle qui fait durer le projet : dis-moi que tu t’en sers. Un message sur un personnage que tu as créé ou une table où tu as joué fait une belle journée.",
      discussions: "Dis bonjour dans Discussions",
      discord: "Rejoins le serveur Discord",
      email: "Écrire un e-mail",
    },
    translate: {
      heading: "Traduis-le",
      body: "L’app, le guide et les règles du SRD parlent cinq langues, et chaque langue peut être améliorée ou ajoutée. On traduit depuis le navigateur sur Weblate, sans code ni compte GitHub. Relire ce qui existe déjà aide autant qu’ajouter de nouveaux textes.",
      link: "Ouvrir Heroquill sur Weblate",
      guide: "Comment marche la traduction, pas à pas",
    },
    report: {
      heading: "Signale un problème ou propose une idée",
      body: "Quelque chose cloche, n’est pas clair ou manque ? Dis-moi ce que tu as fait, ce que tu attendais et ce qui s’est passé ; le navigateur et l’appareil aident. Une capture ou un personnage exporté, sans rien de privé, accélère beaucoup la recherche.",
      issues: "Ouvrir un ticket sur GitHub",
      email: "ou écris à",
    },
    code: {
      heading: "Aide avec le code",
      body: "Heroquill est sous licence MIT : lis-le, utilise-le, modifie-le, partage-le. Il est écrit en TypeScript avec Preact et tourne sans serveur. Le README explique comment le lancer sur ton ordinateur, et CONTRIBUTING.md comment proposer un changement. Les changements petits et ciblés sont les plus faciles à relire.",
      link: "Voir le code sur GitHub",
    },
    privacy:
      "Les messages envoyés à l’adresse ci-dessus sont transmis à une boîte privée via Cloudflare Email Routing. Ils servent seulement à te répondre et ne sont ni partagés ni utilisés autrement.",
  },
  de: {
    title: "Zu Heroquill beitragen – Code, Übersetzungen und Rückmeldungen",
    desc: "Heroquill ist kostenlos und Open Source. Hilf beim Code, übersetze es in deine Sprache, melde ein Problem oder sag einfach, dass es dir gefällt.",
    h1: "Hilf, Heroquill besser zu machen",
    intro:
      "Heroquill ist kostenlos, Open Source und entsteht in der Freizeit. So kannst du helfen, von einer Minute bis zu einem Wochenende.",
    cta: "Bereit, deine Geschichte zu schreiben?",
    like: {
      heading: "Sag mir, dass es dir gefällt",
      body: "Die einfachste Hilfe, und die, die das Projekt am Leben hält: sag, dass du es benutzt. Eine Nachricht über einen Charakter, den du gebaut hast, oder eine Runde, die du gespielt hast, macht den Tag besser.",
      discussions: "Sag Hallo in den Discussions",
      discord: "Tritt dem Discord-Server bei",
      email: "E-Mail schreiben",
    },
    translate: {
      heading: "Übersetze es",
      body: "Die App, die Anleitung und die SRD-Regeln sprechen fünf Sprachen, und jede Sprache kann besser oder neu sein. Übersetzt wird im Browser auf Weblate, ohne Code und ohne GitHub-Konto. Das Gegenlesen vorhandener Texte hilft genauso wie neue Texte.",
      link: "Heroquill auf Weblate öffnen",
      guide: "So funktioniert das Übersetzen, Schritt für Schritt",
    },
    report: {
      heading: "Ein Problem melden oder etwas vorschlagen",
      body: "Etwas kaputt, unklar oder fehlt? Schreib, was du getan hast, was du erwartet hast und was passiert ist; Browser und Gerät helfen. Ein Screenshot oder ein exportierter Charakter, ohne Privates, macht die Suche viel schneller.",
      issues: "Ein Issue auf GitHub öffnen",
      email: "oder schreib an",
    },
    code: {
      heading: "Beim Code helfen",
      body: "Heroquill steht unter der MIT-Lizenz: lesen, nutzen, ändern, teilen. Es ist in TypeScript mit Preact geschrieben und läuft ohne Server. Die README erklärt, wie du es auf deinem Rechner startest, und CONTRIBUTING.md, wie du eine Änderung vorschlägst. Kleine, gezielte Änderungen lassen sich am leichtesten prüfen.",
      link: "Den Code auf GitHub ansehen",
    },
    privacy:
      "Nachrichten an die obige Adresse werden über Cloudflare Email Routing an ein privates Postfach weitergeleitet. Sie dienen nur dazu, dir zu antworten, und werden weder weitergegeben noch anderweitig genutzt.",
  },
  es: {
    title: "Colabora con Heroquill – código, traducciones y opiniones",
    desc: "Heroquill es gratuito y de código abierto. Ayuda con el código, tradúcelo a tu idioma, avisa de un problema o di simplemente que te gusta.",
    h1: "Ayuda a mejorar Heroquill",
    intro:
      "Heroquill es gratuito, de código abierto y nace en el tiempo libre. Así puedes ayudar, desde un minuto hasta un fin de semana.",
    cta: "¿Listo para escribir tu historia?",
    like: {
      heading: "Dime que te gusta",
      body: "Es la ayuda más sencilla, y la que mantiene vivo el proyecto: dime que lo usas. Un mensaje sobre un personaje que has creado o una mesa en la que has jugado alegra el día.",
      discussions: "Saluda en Discussions",
      discord: "Únete al servidor de Discord",
      email: "Escribir un correo",
    },
    translate: {
      heading: "Tradúcelo",
      body: "La app, la guía y las reglas del SRD hablan cinco idiomas, y cada idioma puede mejorar o ser nuevo. Se traduce desde el navegador en Weblate, sin código y sin cuenta de GitHub. Revisar lo que ya existe ayuda tanto como añadir textos nuevos.",
      link: "Abrir Heroquill en Weblate",
      guide: "Cómo funciona la traducción, paso a paso",
    },
    report: {
      heading: "Avisa de un problema o propón algo",
      body: "¿Algo falla, no se entiende o falta? Cuéntame qué hiciste, qué esperabas y qué pasó; el navegador y el dispositivo ayudan. Una captura o un personaje exportado, sin nada privado, acelera mucho la búsqueda.",
      issues: "Abrir una incidencia en GitHub",
      email: "o escribe a",
    },
    code: {
      heading: "Ayuda con el código",
      body: "Heroquill tiene licencia MIT: léelo, úsalo, modifícalo, compártelo. Está escrito en TypeScript con Preact y funciona sin servidor. El README explica cómo ejecutarlo en tu ordenador, y CONTRIBUTING.md cómo proponer un cambio. Los cambios pequeños y concretos son los más fáciles de revisar.",
      link: "Ver el código en GitHub",
    },
    privacy:
      "Los mensajes enviados a la dirección de arriba se reenvían a un buzón privado mediante Cloudflare Email Routing. Solo sirven para responderte y no se comparten ni se usan para otra cosa.",
  },
};
