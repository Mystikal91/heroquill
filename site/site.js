// The welcome page: language links, the colour sets and the small animations. The texts are not
// here: the build writes one page of plain HTML per language (scripts/build-site.mjs), so that
// search engines and people read each one in its own language.
// It shares two things with the app, which lives on the same address: the language
// ("dnd-maker.language") and the colours ("theme"), so what is chosen here carries into the app.
(() => {
  const LANGUAGES = ["en", "it", "fr", "de", "es"];
  const PALETTES = [
    "notte",
    "classico",
    "bordeaux",
    "foresta",
    "arcano",
    "ghiaccio",
    "rame",
    "ossidiana",
  ];
  const root = document.documentElement;
  const here = root.lang;

  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered: the page still works.
    }
  };

  // ---- The Guide menu of the bar: opens on a tap, closes on a tap outside, on Escape or on a link ----
  const menu = document.querySelector(".nav-menu");
  const menuButton = menu?.querySelector(".nav-menu-button");
  const menuList = menu?.querySelector(".nav-menu-list");
  if (menu && menuButton && menuList) {
    const setOpen = (open) => {
      menuButton.setAttribute("aria-expanded", String(open));
      menuList.hidden = !open;
    };
    menuButton.addEventListener("click", () => setOpen(menuList.hidden));
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menuList.hidden) {
        setOpen(false);
        menuButton.focus();
      }
    });
  }

  // ---- The side menu of a phone: opens from the burger, closes on the backdrop, on Escape, on a link ----
  const burger = document.querySelector(".nav-burger");
  const side = document.getElementById("side-menu");
  if (burger && side) {
    const setSide = (open) => {
      side.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      document.documentElement.classList.toggle("side-open", open);
      if (open) side.querySelector(".side-close")?.focus();
      else if (document.activeElement && side.contains(document.activeElement)) burger.focus();
    };
    burger.addEventListener("click", () => setSide(side.hidden));
    side.addEventListener("click", (e) => {
      if (e.target.closest("[data-close], a")) setSide(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !side.hidden) setSide(false);
    });
    matchMedia("(min-width: 42.01rem)").addEventListener("change", (e) => {
      if (e.matches && !side.hidden) setSide(false);
    });
  }

  // ---- Language: one page for each, reached by a link (each option knows its page) ----
  const picker = document.getElementById("lang");
  const pageOf = (code) => {
    const option = picker?.querySelector(`option[value="${code}"]`);
    return option?.dataset.href || (code === "en" ? "/" : `/${code}/`);
  };
  const stored = read("dnd-maker.language");

  // A person who chose a language before (here, or in the app) finds it again on the English
  // page. This only moves people; the pages themselves stay as they are for everyone else.
  // A page that exists in English only (the technical pages) leads every language to itself: it
  // stays where it is instead of moving to the page it is already on, again and again.
  if (
    here === "en" &&
    LANGUAGES.includes(stored) &&
    stored !== "en" &&
    !location.hash &&
    pageOf(stored) !== location.pathname
  ) {
    location.replace(pageOf(stored));
    return;
  }
  // Opening the app from a page in another language than English opens it in that language.
  if (here !== "en" && stored !== here) write("dnd-maker.language", here);

  if (picker) {
    picker.value = here;
    picker.addEventListener("change", () => {
      write("dnd-maker.language", picker.value);
      location.href = pageOf(picker.value);
    });
  }

  // ---- Colour sets: the same choice the app keeps ----
  const savedTheme = () => {
    try {
      return JSON.parse(read("theme") || "null") || {};
    } catch {
      return {};
    }
  };
  const startPalette = () => {
    const saved = savedTheme();
    if (PALETTES.includes(saved.palette)) return saved.palette;
    // A choice saved before the colour sets keeps the look it had.
    return !("palette" in saved) && ("style" in saved || "scheme" in saved) ? "classico" : "notte";
  };

  const swatches = document.querySelectorAll(".swatch");
  function setPalette(name, remember) {
    root.dataset.palette = name;
    for (const swatch of swatches)
      swatch.setAttribute("aria-pressed", String(swatch.dataset.palette === name));
    if (remember) {
      const saved = savedTheme();
      write(
        "theme",
        JSON.stringify({
          palette: name,
          scheme: saved.scheme === "light" || saved.scheme === "dark" ? saved.scheme : "auto",
        }),
      );
    }
  }
  for (const swatch of swatches)
    swatch.addEventListener("click", () => setPalette(swatch.dataset.palette, true));
  setPalette(startPalette(), false);

  // ---- A text drawn in a picture that is longer than its room in some language is squeezed ----
  function fitTexts() {
    for (const text of document.querySelectorAll("text[data-fit]")) {
      text.removeAttribute("textLength");
      const room = Number(text.dataset.fit);
      if (text.getComputedTextLength && text.getComputedTextLength() > room) {
        text.setAttribute("textLength", String(room));
        text.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
    }
  }
  fitTexts();
  if (document.fonts?.ready) document.fonts.ready.then(fitTexts);

  // ---- Small animations, all off for those who ask for less motion ----
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = document.querySelectorAll(".reveal");
  if (calm || !("IntersectionObserver" in window)) {
    for (const node of reveals) node.classList.add("in");
  } else {
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            seen.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    for (const node of reveals) seen.observe(node);
  }

  // The sheet in the first screen leans towards the pointer.
  const stage = document.querySelector(".sheet-stage");
  if (stage && !calm) {
    stage.addEventListener("pointermove", (event) => {
      const box = stage.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      stage.style.setProperty("--ry", `${x * 10}deg`);
      stage.style.setProperty("--rx", `${-y * 8}deg`);
    });
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--ry", "0deg");
      stage.style.setProperty("--rx", "0deg");
    });
  }
})();
