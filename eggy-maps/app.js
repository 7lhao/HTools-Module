(() => {
  "use strict";

  // ===== State =====
  const state = {
    mainCat: 0,
    subCat: "all",
    data: [],
    images: [],
    lbIndex: -1,
    theme: "dark",
    switching: false,
  };

  // ===== Config =====
  const CAT_NAMES = ["旧版地图", "画室地图"];
  const JSON_FILES = ["1.json", "2.json"];
  const IMG_DIR = "images/";
  const STORAGE_KEY = "gallery-theme";

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);
  const el = {
    mainCats: $("mainCats"),
    subCats: $("subCats"),
    grid: $("grid"),
    emptyState: $("emptyState"),
    lightbox: $("lightbox"),
    lbImg: $("lightboxImg"),
    lbClose: $("lightboxClose"),
    lbPrev: $("lightboxPrev"),
    lbNext: $("lightboxNext"),
    lbCounter: $("lightboxCounter"),
    themeToggle: $("themeToggle"),
    loading: $("loading"),
    backTop: $("backTop"),
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ===== Data =====
  async function loadData() {
    const results = await Promise.all(
      JSON_FILES.map((f) =>
        fetch(f).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${f}: ${r.status}`);
          return r.json();
        })
      )
    );
    state.data = results;
  }

  function getSubCats() {
    return Object.keys(state.data[state.mainCat]);
  }

  function getCurrentImages() {
    const data = state.data[state.mainCat];
    if (state.subCat === "all") {
      return Object.values(data).flat();
    }
    return data[state.subCat] || [];
  }

  // ===== Theme =====
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      state.theme = saved;
    } else {
      state.theme = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, state.theme);
    applyTheme();
  }

  // ===== Render: Main categories =====
  function renderMainCats() {
    el.mainCats.innerHTML =
      `<div class="main-cat-indicator"></div>` +
      CAT_NAMES.map(
        (name, i) =>
          `<button class="main-cat${i === state.mainCat ? " active" : ""}" data-i="${i}" role="tab">${name}</button>`
      ).join("");
    updateMainCatIndicator();
  }

  function updateMainCatActive() {
    el.mainCats.querySelectorAll(".main-cat").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.dataset.i, 10) === state.mainCat);
    });
    updateMainCatIndicator();
  }

  function updateMainCatIndicator() {
    requestAnimationFrame(() => {
      const activeBtn = el.mainCats.querySelector(".main-cat.active");
      const indicator = el.mainCats.querySelector(".main-cat-indicator");
      if (!activeBtn || !indicator) return;
      indicator.style.width = `${activeBtn.offsetWidth}px`;
      indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    });
  }

  // ===== Render: Sub categories =====
  function renderSubCats() {
    const data = state.data[state.mainCat];
    const cats = getSubCats().filter((cat) => data[cat].length > 0);
    const total = Object.values(data).flat().length;

    let html = `<button class="sub-cat${state.subCat === "all" ? " active" : ""}" data-cat="all" role="tab">全部<span class="sub-cat-count">${total}</span></button>`;

    html += cats
      .map((cat) => {
        const count = data[cat].length;
        return `<button class="sub-cat${state.subCat === cat ? " active" : ""}" data-cat="${cat}" role="tab">${cat}<span class="sub-cat-count">${count}</span></button>`;
      })
      .join("");

    el.subCats.innerHTML = html;
  }

  // ===== Render: Images =====
  async function renderImages() {
    if (state.switching) return;
    state.switching = true;

    const items = [...el.grid.querySelectorAll(".image-item")];

    // Phase 1: exit animation
    if (items.length > 0) {
      items.forEach((item, i) => {
        item.style.setProperty("--i", i);
        item.classList.remove("show");
        item.classList.add("hide");
      });
      await sleep(240);
    }

    // Phase 2: rebuild
    state.images = getCurrentImages();
    el.grid.innerHTML = "";

    if (state.images.length === 0) {
      el.emptyState.classList.remove("hidden");
      state.switching = false;
      return;
    }

    el.emptyState.classList.add("hidden");

    const frag = document.createDocumentFragment();
    state.images.forEach((img, i) => {
      const div = document.createElement("div");
      div.className = "image-item";
      div.style.setProperty("--i", i);
      div.dataset.index = i;

      const im = document.createElement("img");
      im.loading = "lazy";
      im.alt = img;
      im.src = IMG_DIR + img;
      im.addEventListener("load", () => im.classList.add("loaded"));
      im.addEventListener("error", () => {
        im.classList.add("loaded");
        im.style.opacity = "0.3";
      });

      const label = document.createElement("span");
      label.className = "image-name";
      label.textContent = img.replace(/\.webp$/, "");

      div.appendChild(im);
      div.appendChild(label);
      div.addEventListener("click", () => openLightbox(i));
      frag.appendChild(div);
    });
    el.grid.appendChild(frag);

    // Phase 3: enter animation (double rAF for paint)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.grid.querySelectorAll(".image-item").forEach((item) =>
          item.classList.add("show")
        );
      });
    });

    state.switching = false;
  }

  // ===== Switch category =====
  async function switchMainCat(i) {
    if (i === state.mainCat || state.switching) return;
    state.mainCat = i;
    state.subCat = "all";

    updateMainCatActive();
    renderSubCats();
    await renderImages();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function switchSubCat(cat) {
    if (cat === state.subCat || state.switching) return;
    state.subCat = cat;

    // Update active pill
    el.subCats.querySelectorAll(".sub-cat").forEach((p) => {
      p.classList.toggle("active", p.dataset.cat === cat);
    });

    await renderImages();
  }

  // ===== Lightbox =====
  function openLightbox(index) {
    state.lbIndex = index;
    el.lbImg.src = IMG_DIR + state.images[index];
    el.lbImg.alt = state.images[index];
    updateCounter();
    el.lightbox.classList.add("active");
    el.lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    preloadAdjacent();
  }

  function closeLightbox() {
    el.lightbox.classList.remove("active");
    el.lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.lbIndex = -1;
    el.lbImg.src = "";
  }

  function navigateLightbox(dir) {
    const len = state.images.length;
    if (len === 0) return;
    let next = (state.lbIndex + dir + len) % len;

    const img = el.lbImg;
    const offset = dir > 0 ? 30 : -30;

    // Exit current
    el.lightbox.classList.add("stage-leaving");
    img.style.transition = "opacity 0.2s var(--ease-in), transform 0.2s var(--ease-in)";
    img.style.opacity = "0";
    img.style.transform = `translateX(${offset}px) scale(0.95)`;

    setTimeout(() => {
      state.lbIndex = next;
      img.src = IMG_DIR + state.images[next];
      img.alt = state.images[next];
      updateCounter();

      // Reset position
      img.style.transition = "none";
      img.style.opacity = "0";
      img.style.transform = `translateX(${-offset}px) scale(0.95)`;
      el.lightbox.classList.remove("stage-leaving");

      const onLoad = () => {
        img.removeEventListener("load", onLoad);
        img.style.transition = "opacity 0.35s var(--ease), transform 0.35s var(--ease)";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            img.style.opacity = "1";
            img.style.transform = "translateX(0) scale(1)";
          });
        });
      };
      img.addEventListener("load", onLoad);

      // Fallback if cached
      if (img.complete) {
        onLoad();
      }

      preloadAdjacent();
    }, 200);
  }

  function preloadAdjacent() {
    const len = state.images.length;
    if (len === 0) return;
    const next = (state.lbIndex + 1) % len;
    const prev = (state.lbIndex - 1 + len) % len;
    const i1 = new Image();
    i1.src = IMG_DIR + state.images[next];
    const i2 = new Image();
    i2.src = IMG_DIR + state.images[prev];
  }

  function updateCounter() {
    el.lbCounter.textContent = `${state.lbIndex + 1} / ${state.images.length}`;
  }

  // ===== Touch / Swipe =====
  let touchStartX = 0;
  let touchStartY = 0;
  let touchMoved = false;

  function onTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
    touchMoved = false;
  }

  function onTouchMove(e) {
    touchMoved = true;
  }

  function onTouchEnd(e) {
    if (!touchMoved) return;
    const dx = touchStartX - e.changedTouches[0].screenX;
    const dy = touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      navigateLightbox(dx > 0 ? 1 : -1);
    }
  }

  // ===== Events =====
  function bindEvents() {
    // Main category
    el.mainCats.addEventListener("click", (e) => {
      const btn = e.target.closest(".main-cat");
      if (btn) switchMainCat(parseInt(btn.dataset.i, 10));
    });

    // Sub category
    el.subCats.addEventListener("click", (e) => {
      const btn = e.target.closest(".sub-cat");
      if (btn) switchSubCat(btn.dataset.cat);
    });

    // Theme
    el.themeToggle.addEventListener("click", toggleTheme);

    // Lightbox — click anywhere to close
    el.lightbox.addEventListener("click", closeLightbox);
    el.lbClose.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
    el.lbPrev.addEventListener("click", (e) => { e.stopPropagation(); navigateLightbox(-1); });
    el.lbNext.addEventListener("click", (e) => { e.stopPropagation(); navigateLightbox(1); });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      if (!el.lightbox.classList.contains("active")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateLightbox(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navigateLightbox(1); }
      else if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
    });

    // Touch
    el.lightbox.addEventListener("touchstart", onTouchStart, { passive: true });
    el.lightbox.addEventListener("touchmove", onTouchMove, { passive: true });
    el.lightbox.addEventListener("touchend", onTouchEnd, { passive: true });

    // System theme change
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        state.theme = e.matches ? "dark" : "light";
        applyTheme();
      }
    });

    // Reposition indicator on resize
    window.addEventListener("resize", updateMainCatIndicator);

    // Back to top
    el.backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", () => {
      el.backTop.classList.toggle("show", window.scrollY > 400);
    }, { passive: true });
  }

  // ===== Init =====
  async function init() {
    try {
      initTheme();
      await loadData();
      renderMainCats();
      renderSubCats();
      await renderImages();
      bindEvents();
    } catch (err) {
      console.error(err);
      el.loading.innerHTML = `<p style="color:var(--text-2);font-size:14px;">加载失败，请通过本地服务器访问</p>`;
      return;
    }
    // Hide loading
    el.loading.classList.add("hide");
    setTimeout(() => el.loading.remove(), 500);
  }

  init();
})();
