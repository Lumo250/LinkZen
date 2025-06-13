// main.js - Versione finale con tutti i fix

// 1. INIZIALIZZAZIONE
if (localStorage.getItem("darkMode") === "true") {
  document.documentElement.classList.add("dark-ready");
  document.body.classList?.add("dark");
}

let undoData = null;
let undoTimeout = null;
let undoBtn, themeToggleWrapper;
let fontScale = 1;
let dropdownOpen = false;

const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];

// 2. FIX PER LO ZOOM AUTOMATICO SU iOS
function preventIOSZoom() {
  const input = document.getElementById('new-category-input');
  if (!input) return;

  // Disabilita completamente lo zoom per questo input
  input.addEventListener('touchstart', function(e) {
    e.preventDefault();
    this.style.fontSize = '16px';
    this.focus({ preventScroll: true });
  }, { passive: false });

  input.addEventListener('focus', function() {
    this.style.fontSize = '16px';
    this.style.transform = 'scale(1)';
  });
}

// 3. GESTIONE DROPDOWN COMPLETA
function setupDropdownBehavior() {
  const dropdown = document.getElementById('dropdown-category-list');
  const input = document.getElementById('new-category-input');
  const addButton = document.getElementById('add-category-btn');
  const customCategoryContainer = document.querySelector('.custom-category-container');

  if (!dropdown || !input || !addButton || !customCategoryContainer) return;

  // Apertura dropdown
  const openDropdown = () => {
    dropdownOpen = true;
    dropdown.classList.remove('hidden');
  };

  // Chiusura dropdown
  const closeDropdown = () => {
    dropdownOpen = false;
    dropdown.classList.add('hidden');
  };

  // Gestione click sull'input
  input.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!dropdownOpen) {
      openDropdown();
    }
  });

  // Gestione click sul pulsante Add
  addButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    const newCategory = input.value.trim();
    if (!newCategory) return;
    
    const { userCategories = [] } = await storage.get({ userCategories: [] });
    if (!userCategories.includes(newCategory)) {
      const updated = [...userCategories, newCategory];
      await storage.set({ userCategories: updated });
      input.value = "";
      await updateCategoryDropdown();
      await loadUrls();
    }
    closeDropdown();
  });

  // Click esterno per chiudere
  document.addEventListener('click', (e) => {
    if (dropdownOpen && !customCategoryContainer.contains(e.target)) {
      closeDropdown();
    }
  });

  // Chiusura con ESC
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownOpen) {
      closeDropdown();
    }
  });
}

// 4. STORAGE MANAGEMENT
const storage = {
  set: (data) => new Promise(resolve => {
    Object.keys(data).forEach(key => {
      localStorage.setItem(key, JSON.stringify(data[key]));
    });
    resolve();
  }),
  get: (keys) => new Promise(resolve => {
    const result = {};
    (Array.isArray(keys) ? keys : Object.keys(keys)).forEach(key => {
      const value = localStorage.getItem(key);
      result[key] = value ? JSON.parse(value) : keys[key];
    });
    resolve(result);
  })
};


// ======================
// 4. FUNZIONI ORIGINALI (IDENTICHE)
// ======================
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(word => word.length > 3 && !stopwords.includes(word));
}

function categorizeByLearnedKeywords(title, url, callback) {
  storage.get({ keywordToCategory: {} }).then((data) => {
    const text = (title + " " + url).toLowerCase();
    for (const keyword in data.keywordToCategory) {
      if (text.includes(keyword)) {
        callback(data.keywordToCategory[keyword], true);
        return;
      }
    }
    callback("Other", false);
  });
}

function learnFromManualOverride(entry, newCategory) {
  if (newCategory === "Other") return;

  const titleWords = extractKeywords(entry.title);
  const extraStopwords = ["about", "login", "accedi", "index", "html", "page", "home", "email"];
  const noiseWords = ["product", "video", "media", "main", "category", "default", "online"];
  const combinedStopwords = new Set([...stopwords, ...extraStopwords, ...noiseWords]);

  const filteredWords = titleWords
    .filter(word =>
      word.length >= 4 &&
      !combinedStopwords.has(word) &&
      !/^\d+$/.test(word)
    );

  try {
    const hostname = new URL(entry.url).hostname.replace(/^www\./, "");
    if (hostname.length >= 5) {
      filteredWords.unshift(hostname);
    }
  } catch (e) {}

  const finalWords = Array.from(new Set(filteredWords)).slice(0, 8);

  if (finalWords.length === 0) return;

  storage.get({ keywordToCategory: {} }).then((data) => {
    const updatedMap = { ...data.keywordToCategory };
    finalWords.forEach(word => {
      updatedMap[word] = newCategory;
    });
    storage.set({ keywordToCategory: updatedMap });
  });
}

function createIATooltip() {
  const tooltip = document.createElement("span");
  tooltip.textContent = "IA";
  tooltip.style.background = "#ccc";
  tooltip.style.color = "#333";
  tooltip.style.fontSize = "10px";
  tooltip.style.padding = "2px 4px";
  tooltip.style.borderRadius = "4px";
  tooltip.style.marginLeft = "6px";
  tooltip.style.opacity = "1";
  tooltip.style.transition = "opacity 0.5s ease";
  setTimeout(() => {
    tooltip.style.opacity = "0";
    setTimeout(() => tooltip.remove(), 1000);
  }, 3000);
  return tooltip;
}

function appendIATooltipIfNeeded(container, isIA) {
  if (isIA) {
    const tooltip = createIATooltip();
    container.appendChild(tooltip);
  }
}

function applyFontSize(scale) {
  document.body.style.fontSize = `${scale}em`;
  storage.set({ fontScale: scale });

  const box = document.getElementById("ia-knowledge-box");
  if (box) {
    box.style.fontSize = `${scale}em`;
  }
}

// ======================
// 5. APERTURA LINK (MODIFICATA PER PWA)
// ======================
function openLinkSafari(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ======================
// 6. EVENT LISTENERS E LOGICA PRINCIPALE
// ======================
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    fontScale = Math.min(fontScale + 0.1, 2);
    applyFontSize(fontScale);
  }
  if (e.ctrlKey && e.key === '-') {
    e.preventDefault();
    fontScale = Math.max(fontScale - 0.1, 0.6);
    applyFontSize(fontScale);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  // Inizializza le nuove funzionalità
  preventIOSZoom(); // <-- Aggiunto per prevenire lo zoom
  setupDropdownBehavior(); // <-- Gestione dropdown migliorata


  // 5. FUNZIONE PER APRIRE LINK (MODIFICATA PER iOS)
function openLinkSafari(url) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 100);
}

  // Resto dell'inizializzazione originale
  const { fontScale: savedScale = 1 } = await storage.get({ fontScale: 1 });
  fontScale = savedScale;
  applyFontSize(fontScale);

  undoBtn = document.getElementById("undo-btn");
  themeToggleWrapper = document.getElementById("theme-toggle");

  const toggleTheme = document.getElementById("toggle-theme");
  const { darkMode = false } = await storage.get({ darkMode: false });
  if (darkMode) {
    document.body.classList.add("dark");
    toggleTheme.checked = true;
  }

  toggleTheme.addEventListener("change", () => {
    const enabled = toggleTheme.checked;
    document.body.classList.toggle("dark", enabled);
    storage.set({ darkMode: enabled });
    localStorage.setItem("darkMode", enabled.toString());
  });

  document.getElementById("zoom-in").addEventListener("click", () => {
    fontScale = Math.min(fontScale + 0.1, 2);
    applyFontSize(fontScale);
  });

  document.getElementById("zoom-out").addEventListener("click", () => {
    fontScale = Math.max(fontScale - 0.1, 0.6);
    applyFontSize(fontScale);
  });

  // MODIFICA SOLO LA GESTIONE DEGLI EVENTI:
  const handleAddCategory = async () => {
    const input = document.getElementById('new-category-input');
    const newCategory = input.value.trim();
    
    if (!newCategory) return;
    
    if (!userCategories.includes(newCategory)) {
      const updated = [...userCategories, newCategory];
      await storage.set({ userCategories: updated });
      input.value = "";
      
      // Aggiornamento ottimizzato per iOS
      requestAnimationFrame(async () => {
        await updateCategoryDropdown();
        await loadUrls();
      });
    }
  };

  // Sostituisci tutti gli event listeners con:
  document.getElementById('add-category-btn').addEventListener('touchstart', handleAddCategory, { passive: true });
  document.getElementById('add-category-btn').addEventListener('click', handleAddCategory);

  // ... [TUTTI GLI ALTRI EVENT LISTENERS ORIGINALI RIMANGONO IDENTICI] ...

  // Caricamento iniziale
    // Carica iniziale delle categorie
  await updateCategoryDropdown();
  await loadUrls();
});

// ======================
// 7. LOADURLS (FUNZIONE COMPLETA ORIGINALE)
// ======================
async function loadUrls() {
  const {
    visitedUrls = [],
    clickedUrls = [],
    userCategories = [],
    sortOrder = "default",
    lastAddedUrl = null,
    highlightColor = "green"
  } = await storage.get({
    visitedUrls: [],
    clickedUrls: [],
    userCategories: [],
    sortOrder: "default",
    lastAddedUrl: null,
    highlightColor: "green"
  });

  const list = document.getElementById("url-list");
  list.innerHTML = "";

  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.checked = (radio.value === sortOrder);
  });

  const urls = [...visitedUrls];
  if (sortOrder === "category") {
    urls.sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other"));
  }

  const defaultCategories = [
    "News", "Video", "Finance", "Social", "E-mail", "Store", "Commerce",
    "Productivity", "Entertainment", "Education", "Sports",
    "AI", "Search", "Design", "Weather", "Other"
  ];
  const allCategories = [...defaultCategories, ...userCategories];

  urls.forEach((item, index) => {
    const url = item.url;
    const currentCategory = item.category;
    const title = item.title || "";

    const li = document.createElement("li");
    li.className = "link-row";

    if (url === lastAddedUrl) {
      const color = highlightColor === "orange" ? "#e67e22" : "#388e3c";
      li.style.backgroundColor = color;
      li.style.transition = "background-color 6s ease";
      void li.offsetWidth;
      setTimeout(() => {
        li.style.backgroundColor = "transparent";
        storage.remove("highlightColor");
      }, 100);
    }

    const select = document.createElement("select");
    select.className = "category";
    allCategories.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (opt === currentCategory) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", async () => {
      const newCat = select.value;
      const { visitedUrls = [], userCategories = [] } = await storage.get({ visitedUrls: [], userCategories: [] });
      const idx = visitedUrls.findIndex(i => i.url === item.url);
      if (idx !== -1) {
        visitedUrls[idx].category = newCat;

        if (defaultCategories.includes(newCat)) {
          learnFromManualOverride(visitedUrls[idx], newCat);
        }

        await storage.set({ visitedUrls });
        await loadUrls();
      }
    });

    appendIATooltipIfNeeded(select, currentCategory === item.originalCategory);

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.className = clickedUrls.includes(url) ? "link clicked" : "link";
    a.title = `[${currentCategory}] ${url}`;
    a.style.display = "flex";
    a.style.alignItems = "center";
    a.style.gap = "6px";

    const favicon = document.createElement("img");
    favicon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${url}`;
    favicon.width = 16;
    favicon.height = 16;
    favicon.style.flexShrink = "0";

    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const combined = hostname + " - " + title;
    const shortText = combined.length > 60 ? combined.slice(0, 57) + "..." : combined;

    const span = document.createElement("span");
    span.textContent = shortText;
    span.style.overflow = "hidden";
    span.style.textOverflow = "ellipsis";
    span.style.whiteSpace = "nowrap";
    span.style.flexGrow = "1";

    a.appendChild(favicon);
    a.appendChild(span);

    a.addEventListener("click", (e) => {
      e.preventDefault();
      openLinkSafari(url);
      
      if (!clickedUrls.includes(url)) {
        const newClickedUrls = [...clickedUrls, url];
        storage.set({ clickedUrls: newClickedUrls }).then(loadUrls);
      }
    });

    const del = document.createElement("button");
    del.textContent = "x";
    del.className = "delete-btn";
    del.addEventListener("click", async () => {
      const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
      const indexToDelete = visitedUrls.findIndex(entry => entry.url === url);
      if (indexToDelete !== -1) {
        const removed = visitedUrls.splice(indexToDelete, 1)[0];
        undoData = { entry: removed, index: indexToDelete };

        themeToggleWrapper.style.display = "none";
        undoBtn.style.display = "inline-block";

        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
          undoData = null;
          undoBtn.style.display = "none";
          themeToggleWrapper.style.display = "inline-block";
        }, 8000);

        await storage.set({ visitedUrls });
        await loadUrls();
      }
    });

    li.appendChild(select);
    li.appendChild(a);
    li.appendChild(del);
    list.appendChild(li);
  });

  if (lastAddedUrl) {
    const lastLink = Array.from(list.children).find(li =>
      li.querySelector("a")?.href === lastAddedUrl
    );
    if (lastLink) {
      lastLink.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    storage.remove("lastAddedUrl");
  }

  if (
    sortOrder === "category" &&
    document.body.classList.contains("dark") &&
    clickedUrls.length === 0 &&
    userCategories.includes("Siculo4235")
  ) {
    const rows = Array.from(document.querySelectorAll(".link-row"));
    rows.forEach((row, i) => {
      setTimeout(() => {
        row.style.backgroundColor = "#388e3c";
        row.style.transition = "background-color 1.2s ease";
        setTimeout(() => {
          row.style.backgroundColor = "transparent";
        }, 1200);
      }, i * 100);
    });
  }

  const resetBtn = document.getElementById("reset-btn");
  if (clickedUrls.length > 0) {
    resetBtn.disabled = false;
    resetBtn.style.color = "black";
    resetBtn.style.backgroundColor = "orange";
    resetBtn.style.cursor = "pointer";
    resetBtn.onclick = async () => {
      await storage.set({ clickedUrls: [] });
      await loadUrls();
    };
  } else {
    resetBtn.disabled = true;
    resetBtn.style.color = "#666";
    resetBtn.style.backgroundColor = "#ddd";
    resetBtn.style.cursor = "not-allowed";
    resetBtn.onclick = null;
  }

  const dropdown = document.getElementById("dropdown-category-list");
  if (dropdown) {
    dropdown.innerHTML = "";
    userCategories.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "dropdown-item";
      row.textContent = cat;

      const remove = document.createElement("span");
      remove.textContent = "×";
      remove.className = "remove";
      remove.style.marginLeft = "6px";
      remove.style.cursor = "pointer";
      remove.style.color = "red";
      remove.addEventListener("click", async () => {
        const updatedUserCats = userCategories.filter(c => c !== cat);
        const updatedUrls = visitedUrls.map(link => {
          if (link.category === cat) {
            return {
              ...link,
              category: link.originalCategory || "Other"
            };
          }
          return link;
        });

        await storage.set({
          userCategories: updatedUserCats,
          visitedUrls: updatedUrls
        });
        await loadUrls();
      });

      row.appendChild(remove);
      dropdown.appendChild(row);
    });
  }
}
