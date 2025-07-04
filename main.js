  if (localStorage.getItem("darkMode") === "true") {
    document.documentElement.classList.add("dark-ready");
    document.body?.classList?.add("dark");
  }


// main.js - Versione completa con supporto bookmarklet per Safari iOS

// ============================================
// 1. INIZIALIZZAZIONE E COSTANTI
// ============================================

let undoData = null;
let undoTimeout = null;
let undoBtn, themeToggleWrapper;
let fontScale = 1;
let importFileDialogOpen = false;

const DEFAULT_CATEGORIES_URL = 'https://lumo250.github.io/LinkZen/categories.json';

const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];



// ============================================
// 2. GESTIONE STORAGE
// ============================================
const storage = {
  set: (data) => new Promise(resolve => {
    try {
      Object.keys(data).forEach(key => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
      resolve();
    } catch (error) {
      console.error("Errore salvataggio:", error);
      resolve();
    }
  }),
  
  get: (keys) => new Promise(resolve => {
    try {
      const result = {};
      const keysToGet = Array.isArray(keys) ? keys : Object.keys(keys);
      
      keysToGet.forEach(key => {
        const value = localStorage.getItem(key);
        result[key] = value ? JSON.parse(value) : keys[key];
      });
      resolve(result);
    } catch (error) {
      console.error("Errore lettura:", error);
      resolve(keys);
    }
  }),
  
  remove: (key) => new Promise(resolve => {
    localStorage.removeItem(key);
    resolve();
  })
};

// ============================================
// 3. GESTIONE BOOKMARKLET (NUOVA FUNZIONE)
// ============================================
async function processBookmarkletRequest() {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('url')) return;

  // Leggi prima i parametri
  const url = urlParams.get('url');
  const title = urlParams.get('title') || '';

  // Pulisci l'URL SOLO DOPO aver letto i valori
  window.history.replaceState({}, document.title, window.location.pathname);

  if (!url) return;

  try {
    const decodedUrl = decodeURIComponent(url);
    const decodedTitle = decodeURIComponent(title);

    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
    
    const alreadyExists = visitedUrls.some(item => 
      item.url === decodedUrl || 
      new URL(item.url).hostname === new URL(decodedUrl).hostname
    );

    if (alreadyExists) {
      await storage.set({
        lastAddedUrl: decodedUrl,
        highlightColor: "orange"
      });
    } else {
      categorizeByLearnedKeywords(decodedTitle, decodedUrl, async (category, isIA) => {
        visitedUrls.push({
          url: decodedUrl,
          title: decodedTitle,
          category,
          originalCategory: category
        });

        await storage.set({
          visitedUrls,
          lastAddedUrl: decodedUrl,
          highlightColor: "green"
        });
      });
    }

    await loadUrls();
  } catch (e) {
    console.error("Bookmarklet processing error:", e);
  }
}

// ============================================
// 4. FUNZIONI ORIGINALI (INALTERATE)
// ============================================
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
  // Salva il nuovo valore
  fontScale = scale;
  document.body.style.fontSize = `${scale}em`;
  
  // Applica solo alle finestre aperte (se presenti)
  const ctBox = document.getElementById("categories-box");
  const iaBox = document.getElementById("ia-knowledge-box");
  
  if (ctBox && !ctBox.classList.contains("hidden")) {
    ctBox.style.fontSize = `${scale}em`;
  }
  
  if (iaBox && !iaBox.classList.contains("hidden")) {
    iaBox.style.fontSize = `${scale}em`;
  }
  
  storage.set({ fontScale: scale });
}

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

function updateCategorySuggestions() {
  return new Promise(async (resolve) => {
    const { userCategories = [] } = await storage.get({ userCategories: [] });
    const datalist = document.getElementById("category-suggestions");
    datalist.innerHTML = "";
    
    userCategories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      datalist.appendChild(option);
    });
    resolve();
  });
}

function renderSelectedCategories() {
  return new Promise(async (resolve) => {
    const { userCategories = [] } = await storage.get({ userCategories: [] });
    const container = document.getElementById("selected-categories");
    container.innerHTML = "";
    
    userCategories.forEach(cat => {
      const chip = document.createElement("div");
      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.padding = "4px 8px";
      chip.style.backgroundColor = document.body.classList.contains("dark") ? "#444" : "#eee";
      chip.style.borderRadius = "12px";
      chip.style.fontSize = "12px";
      chip.style.gap = "4px";
      
      const name = document.createElement("span");
      name.textContent = cat;
      
      const removeBtn = document.createElement("span");
      removeBtn.textContent = "[x]";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.color = "red";
      removeBtn.style.fontWeight = "bold";
      removeBtn.style.fontSize = "14px";
      removeBtn.addEventListener("click", async () => {
        const { userCategories = [], visitedUrls = [] } = await storage.get({ 
          userCategories: [], 
          visitedUrls: [] 
        });
        
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
        
        await renderSelectedCategories();
        await updateCategorySuggestions();
        await loadUrls();
      });
      
      chip.appendChild(name);
      chip.appendChild(removeBtn);
      container.appendChild(chip);
    });
    
    resolve();
  });
}


// ============================================
// 5. EVENT LISTENERS E INIZIALIZZAZIONE
// ============================================
document.addEventListener("DOMContentLoaded", async () => {

const { defaultCategories } = await getDefaultCategories();
localStorage.setItem("defaultCategories", JSON.stringify(defaultCategories));


  // ✅ Gestione centralizzata del bookmarklet
  await processBookmarkletRequest();

  // Inizializzazione originale
  const { fontScale: savedScale = 1 } = await storage.get({ fontScale: 1 });
  fontScale = savedScale;
  applyFontSize(fontScale);

  undoBtn = document.getElementById("undo-btn");
  themeToggleWrapper = document.getElementById("theme-toggle");

  // Tema dark
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

  // Zoom

const fontSlider = document.getElementById("font-slider");
if (fontSlider) {
  // Imposta il valore iniziale dallo storage
  storage.get({ fontScale: 1 }).then(({ fontScale }) => {
    fontSlider.value = fontScale;
    document.body.style.fontSize = `${fontScale}em`;
  });

  // Gestisci il cambiamento
  fontSlider.addEventListener("input", (e) => {
    const scale = parseFloat(e.target.value);
    document.body.style.fontSize = `${scale}em`;
    storage.set({ fontScale: scale });
    
    // Aggiorna finestre aperte
    document.querySelectorAll('#ia-knowledge-box:not(.hidden), #categories-box:not(.hidden)')
      .forEach(box => {
        box.style.fontSize = `${scale}em`;
      });
  });
}



// === Apertura IA ===
document.getElementById("ia-knowledge-btn").addEventListener("click", async function () {
  preventBodyScroll(true);
  document.body.classList.add('modal-open');

  const iaBtn = this;
  const iaBox = document.getElementById("ia-knowledge-box");
  const ctBox = document.getElementById("categories-box");

  // Chiudi CT box se aperta
  if (!ctBox.classList.contains("hidden")) {
    ctBox.classList.add("hidden");
    document.getElementById("categories-btn").classList.remove("active");
  }

  // Toggle IA box
  if (iaBox.classList.contains("hidden")) {
    await renderIAKeywords();
    iaBox.classList.remove("hidden");
    iaBtn.classList.add("active");
    iaBox.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    iaBox.classList.add("hidden");
    iaBtn.classList.remove("active");
  }

  preventBodyScroll(false);
  document.body.classList.remove('modal-open');
});

// === Apertura CT ===
document.getElementById("categories-btn").addEventListener("click", async function() {
  
  preventBodyScroll(true);
  document.body.classList.add('modal-open');

const ctBtn = this;
  const ctBox = document.getElementById("categories-box");
  const iaBox = document.getElementById("ia-knowledge-box");
  
  // Chiudi IA box se aperta
  if (!iaBox.classList.contains("hidden")) {
    iaBox.classList.add("hidden");
    document.getElementById("ia-knowledge-btn").classList.remove("active");
  }
  
  // Toggle CT box
  if (ctBox.classList.contains("hidden")) {
    await showCategories();
    ctBox.classList.remove("hidden");
    ctBtn.classList.add("active");
    ctBox.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    ctBox.classList.add("hidden");
    ctBtn.classList.remove("active");
  }
  preventBodyScroll(false);
  document.body.classList.remove('modal-open');
});


function preventBodyScroll(prevent) {
  if (prevent) {
    document.body.addEventListener('touchmove', preventDefault, { passive: false });
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  } else {
    document.body.removeEventListener('touchmove', preventDefault);
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
}

function preventDefault(e) {
  e.preventDefault();
}

// === Blocca lo scroll solo del body (non delle finestre modali) ===
function lockBodyScroll() {
  // Imposta proprietà per evitare espansione e mantenere posizione
  const scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.dataset.scrollY = scrollY; // salva posizione per dopo
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  const scrollY = document.body.dataset.scrollY || '0';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.removeAttribute('data-scroll-y');
  document.body.classList.remove('modal-open');
  window.scrollTo(0, parseInt(scrollY)); // ripristina scroll originale
}



// Funzione helper per ottenere le categorie predefinite
async function getDefaultCategories() {
  const stored = localStorage.getItem("defaultCategories");
  if (stored) {
    return { defaultCategories: JSON.parse(stored) };
  }
  try {
    const response = await fetch(DEFAULT_CATEGORIES_URL);
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("defaultCategories", JSON.stringify(data));
      return { defaultCategories: data };
    }
  } catch (error) {
    console.error("Error fetching default categories:", error);
  }
  return { defaultCategories: [] };
}  



const main = document.getElementById('main-buttons');
const alt = document.getElementById('alt-buttons');
let showingAlt = false;

document.getElementById('toggle-menu-btn').addEventListener('click', () => {
  if (!showingAlt) {
    // Passaggio da main → alt (scorrimento sinistra)
    main.classList.remove('to-center');
    main.classList.add('from-left');
    main.classList.remove('active');

    alt.classList.remove('from-right');
    alt.classList.add('to-center', 'active');
  } else {
    // Passaggio da alt → main (scorrimento destra)
    alt.classList.remove('to-center');
    alt.classList.add('from-right');
    alt.classList.remove('active');

    main.classList.remove('from-left');
    main.classList.add('to-center', 'active');
  }

  showingAlt = !showingAlt;
});




// ✅ Funzione centralizzata per aggiornare UI dopo import
async function refreshUIAfterImport() {
  await showCategories();
  await renderIAKeywords();
  await loadUrls();
}


function resetFileInput() {
  const fileInput = document.getElementById("import-file");
  fileInput.value = ''; // Resetta il valore dell'input
  importFileDialogOpen = false; // Assicura che lo stato sia consistente
}

// ===========================
// Export/Import
// ===========================

const exportBtn = document.getElementById("export-btn");
const exportDefault = document.getElementById("export-default");
const exportOptions = document.getElementById("export-options");

exportBtn.addEventListener("click", (e) => {
  exportDefault.style.display = "none";
  exportOptions.classList.remove("hidden");
  e.stopPropagation();
});

// Chiudi menu Export/Import se clicchi fuori
document.addEventListener("click", (e) => {
  if (!e.target.closest("#export-container")) {
    exportDefault.style.display = "flex";
    exportOptions.classList.add("hidden");
  }

  if (!e.target.closest("#import-container") && !importFileDialogOpen) {
    importDefault.style.display = "flex";
    importOptions.classList.add("hidden");
  }
});

// ===========================
// Export Basic
// ===========================

document.getElementById("export-basic").addEventListener("click", async () => {
  const { visitedUrls = [], userCategories = [] } = await storage.get({ visitedUrls: [], userCategories: [] });

  const blob = new Blob([JSON.stringify({ visitedUrls, userCategories }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "linkzen_export_basic.json";
  a.click();

  URL.revokeObjectURL(url);
  exportDefault.style.display = "flex";
  exportOptions.classList.add("hidden");
});

// ===========================
// Export Full
// ===========================

document.getElementById("export-full").addEventListener("click", async () => {
  const { visitedUrls = [], userCategories = [], keywordToCategory = {} } = await storage.get({
    visitedUrls: [],
    userCategories: [],
    keywordToCategory: {}
  });

  const blob = new Blob([JSON.stringify({ visitedUrls, userCategories, keywordToCategory }, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "linkzen_export_full.json";
  a.click();

  URL.revokeObjectURL(url);
  exportDefault.style.display = "flex";
  exportOptions.classList.add("hidden");
});

// ===========================
// Import
// ===========================

const importBtn = document.getElementById("import-btn");
const importDefault = document.getElementById("import-default");
const importOptions = document.getElementById("import-options");

importBtn.addEventListener("click", (e) => {
  importDefault.style.display = "none";
  importOptions.classList.remove("hidden");
  e.stopPropagation();
});

// Import custom file


document.getElementById("import-custom").addEventListener("click", () => {
  importFileDialogOpen = true;
  resetFileInput(); // Resetta prima di aprire il dialog
  document.getElementById("import-file").click();
});

const importFileInput = document.getElementById("import-file");


importFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Salva SOLO lo stato attuale (senza chiudere nulla)
  const wasIaOpen = !document.getElementById("ia-knowledge-box").classList.contains("hidden");
  const wasCtOpen = !document.getElementById("categories-box").classList.contains("hidden");

  try {
    const data = JSON.parse(await file.text());
    if (!data.visitedUrls) throw new Error("File non valido");

    await storage.set(data);
    await Promise.all([loadUrls(), showCategories(), renderIAKeywords()]);

    // Ripristina lo stato PRECEDENTE
    document.getElementById("ia-knowledge-box").classList.toggle("hidden", !wasIaOpen);
    document.getElementById("categories-box").classList.toggle("hidden", !wasCtOpen);
    
  } catch (err) {
    alert("Errore: " + err.message);
  } finally {
    event.target.value = ''; // Reset pulito
  }
});

importFileInput.addEventListener("blur", () => {
  importFileDialogOpen = false;
});

// Import default config
document.getElementById("import-default-btn").addEventListener("click", async () => {
  try {
    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });

    if (visitedUrls.length > 0) {
      const proceed = confirm("This will overwrite your current links. You may want to export them first");
      if (!proceed) {
        importDefault.style.display = "flex";
        importOptions.classList.add("hidden");
        return;
      }
    }

    const response = await fetch("https://lumo250.github.io/LinkZen/default-config.json");
    if (!response.ok) throw new Error("Failed to download default config.");

    const data = await response.json();

    if (data.visitedUrls && Array.isArray(data.visitedUrls)) {
      await storage.set(data);
      await refreshUIAfterImport();
    } else {
      alert("Invalid default config file.");
    }

  } catch (err) {
    alert("Error importing default config: " + err.message);
  } finally {
    importDefault.style.display = "flex";
    importOptions.classList.add("hidden");
  }
});


  // Undo
  document.getElementById("undo-btn").addEventListener("click", async () => {
    if (!undoData) return;
    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
    const updated = [...visitedUrls];
    updated.splice(undoData.index, 0, undoData.entry);
    await storage.set({ visitedUrls: updated });
    undoData = null;
    undoBtn.style.display = "none";
    themeToggleWrapper.style.display = "inline-block";
    clearTimeout(undoTimeout);
    await loadUrls();
  });

//  Reset lista link letti
  document.getElementById("reset-btn").addEventListener("click", async () => {
    await storage.set({ clickedUrls: [] });
    await loadUrls();
   });

// Reset nuovo
// document.getElementById("reset-btn").addEventListener("click", async () => {
// localStorage.removeItem("defaultCategories");
// localStorage.removeItem("userCategories");
//  await loadUrls();
//  location.reload(); // forza il ricaricamento e reset dell'app
// });

const sortToggle = document.getElementById("sort-toggle");

sortToggle.addEventListener("click", async () => {
  
  // Chiudi le finestre ia e CT se aperte  
const iaBox = document.getElementById("ia-knowledge-box");
  const ctBox = document.getElementById("categories-box");
  
  if (!iaBox.classList.contains("hidden")) {
    iaBox.classList.add("hidden");
    document.getElementById("ia-knowledge-btn").classList.remove("active");
  }
  
  if (!ctBox.classList.contains("hidden")) {
    ctBox.classList.add("hidden");
    document.getElementById("categories-btn").classList.remove("active");
  }


const currentSort = await storage.get({ sortOrder: "default" });
  let newSort, newText, newClass;

  if (currentSort.sortOrder === "default") {
    newSort = "category";
    newText = "By Category";
    newClass = "active";
  } else if (currentSort.sortOrder === "category") {
    newSort = "custom";
    newText = "By Custom";
    newClass = "custom";
  } else {
    newSort = "default";
    newText = "By Input";
    newClass = ""; // Rimuovi la classe per lo stile grigio
  }

  await storage.set({ sortOrder: newSort });
  sortToggle.textContent = newText;

  // Aggiorna classi
  sortToggle.classList.remove("active", "custom");
  if (newClass) sortToggle.classList.add(newClass);

  if (newSort !== "custom") {
    await loadUrls();
  }
});



// Funzione che aggiorna il contenuto visuale della IA Knowledge Box

async function renderIAKeywords() {
  const iaBox = document.getElementById("ia-knowledge-box");
  if (!iaBox) return;

  // Pulisci il contenuto esistente
  iaBox.innerHTML = '<div class="ia-content"></div>';
  
  // Ora possiamo selezionare con sicurezza il contenitore
  const content = iaBox.querySelector(".ia-content");

  const { keywordToCategory = {} } = await storage.get({ keywordToCategory: {} });
  const map = keywordToCategory;
  const entries = Object.entries(map);

  if (entries.length === 0) {
    content.textContent = "Nessuna parola chiave appresa.";
    return;
  }

  const grouped = {};
  entries.forEach(([keyword, category]) => {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(keyword);
  });

  for (const category in grouped) {
    const catBlock = document.createElement("div");
    catBlock.className = "ia-category-block";

    const catTitle = document.createElement("div");
    catTitle.className = "ia-category-title";
    catTitle.textContent = `📁 ${category}`;

    const kwContainer = document.createElement("div");
    kwContainer.className = "ia-keyword-container";

    grouped[category].forEach((keyword) => {
      const chip = document.createElement("div");
      chip.className = "ia-keyword-chip";
      chip.textContent = keyword;
      chip.title = `Click per rimuovere \"${keyword}\"`;

      chip.addEventListener("click", async () => {
        delete map[keyword];
        await storage.set({ keywordToCategory: map });
        await renderIAKeywords();
      });

      kwContainer.appendChild(chip);
    });

    catBlock.appendChild(catTitle);
    catBlock.appendChild(kwContainer);
    content.appendChild(catBlock);
  }
}



// ✅ Versione finale e pulita della funzione showCategories()
// con stile delegato al file CSS o tag <style> dell'HTML

async function showCategories() {
  const ctBox = document.getElementById("categories-box");
  if (!ctBox) return;
  ctBox.innerHTML = '';

  const { userCategories = [] } = await storage.get({ userCategories: [] });
  const { defaultCategories = [] } = await getDefaultCategories();

  const defaultContainer = document.createElement("div");
  defaultContainer.className = "categories-container";
  defaultContainer.id = "default-categories";
defaultContainer.style.margin = "0"; // Aggiungi questa linea
defaultContainer.style.padding = "0px 0px"; // Imposta esplicitamente

  const customContainer = document.createElement("div");
  customContainer.className = "categories-container";
  customContainer.id = "custom-categories";
customContainer.style.margin = "0"; // Aggiungi questa linea
customContainer.style.padding = "0px 0px"; // Imposta esplicitamente

const defaultTitleWrapper = document.createElement("div");
defaultTitleWrapper.className = "custom-title-wrapper";

const defaultTitle = document.createElement("h3");
defaultTitle.className = "category-section-title";
defaultTitle.textContent = "📁 Default Categories";

const resetBtn = document.createElement("button");
resetBtn.className = "reset-defaults-btn";
resetBtn.textContent = "Reset";
resetBtn.title = "Restore default categories and remove all custom ones";


resetBtn.addEventListener("click", async () => {
  const confirmed = confirm("Are you sure you want to reset all customizations?\nThis will restore the default category list.");
  if (!confirmed) return;

  try {
    const response = await fetch(DEFAULT_CATEGORIES_URL);
    if (!response.ok) throw new Error("Could not fetch default categories.");
    const data = await response.json();
    localStorage.setItem("defaultCategories", JSON.stringify(data));
  } catch (e) {
    // fallback: encoded defaults
    console.warn("Falling back to encoded default categories.");
    const fallback = [ "General", "Work", "Ideas", "Archive" ]; // o quello che hai hardcoded
    localStorage.setItem("defaultCategories", JSON.stringify(fallback));
  }

  await storage.set({ userCategories: [] });
  await showCategories();
  await loadUrls?.();
});



defaultTitleWrapper.appendChild(defaultTitle);
defaultTitleWrapper.appendChild(resetBtn);


  const customTitleWrapper = document.createElement("div");
  customTitleWrapper.className = "custom-title-wrapper";

  const customTitle = document.createElement("h3");
  customTitle.className = "category-section-title";
  customTitle.textContent = "📁 Custom Categories";

  const addBtn = document.createElement("button");
  addBtn.className = "add-category-btn";
  addBtn.innerHTML = "[+]";
  addBtn.title = "Add new category";


addBtn.addEventListener("click", () => {
  
 // Salva la posizione corrente dello scroll prima di aggiungere la nuova categoria
  const scrollPosition = window.scrollY;

const newChip = document.createElement("span");
  newChip.className = "category-chip custom-category editable";
  newChip.contentEditable = "true";
  newChip.textContent = "New Category";
  newChip.draggable = false; // disabilita drag durante edit

  // Quando si tocca il chip, attiva subito l’editor e seleziona il testo
  const activateEditing = () => {
    newChip.focus();
    const range = document.createRange();
    range.selectNodeContents(newChip);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  newChip.addEventListener("click", activateEditing);
  newChip.addEventListener("touchend", activateEditing);

  const saveCategory = async () => {
    const name = newChip.textContent.trim();
    if (name && name !== "New Category") {
      const { userCategories = [] } = await storage.get({ userCategories: [] });
      if (!userCategories.includes(name)) {
        await storage.set({ userCategories: [...userCategories, name] });
        await showCategories();
        await loadUrls?.(); // safe call
 // Ripristina la posizione dello scroll dopo il salvataggio
        window.scrollTo(0, scrollPosition);

      } else {
        newChip.remove();
 // Ripristina la posizione dello scroll dopo il salvataggio
        window.scrollTo(0, scrollPosition);
      }
    } else {
      newChip.remove();
 // Ripristina la posizione dello scroll dopo il salvataggio
        window.scrollTo(0, scrollPosition);
    }
  };

  newChip.addEventListener("blur", saveCategory);
  newChip.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      newChip.blur();
    }
  });

  customContainer.prepend(newChip);

  // Attiva editing subito
  activateEditing();
});





  customTitleWrapper.appendChild(customTitle);
  customTitleWrapper.appendChild(addBtn);

  const createCategoryChip = (name, isCustom) => {
    const chip = document.createElement("span");
    chip.className = `category-chip ${isCustom ? 'custom-category' : 'default-category'}`;
    chip.draggable = true;

    const label = document.createElement("span");
    label.textContent = name;
    chip.appendChild(label);

    if (isCustom) {
      const closeBtn = document.createElement("span");
      closeBtn.className = "delete-chip-btn";
      closeBtn.textContent = "×";
      closeBtn.title = "Delete category";

      closeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const { userCategories = [] } = await storage.get({ userCategories: [] });
        const updated = userCategories.filter(c => c !== name);
        await storage.set({ userCategories: updated });
        await showCategories();
        await loadUrls?.();
      });

      chip.appendChild(closeBtn);
    }

chip.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', JSON.stringify({ name, isCustom }));
  chip.classList.add('dragging');

  // Disattiva i link durante il drag
  document.querySelectorAll('a.link').forEach(link => {
    link.style.pointerEvents = 'none';
  });
});

chip.addEventListener('dragend', () => {
  chip.classList.remove('dragging');

  // Riattiva i link
  document.querySelectorAll('a.link').forEach(link => {
    link.style.pointerEvents = 'auto';
  });
});


    return chip;
  };

  defaultCategories.forEach(cat => {
    if (!userCategories.includes(cat)) {
      defaultContainer.appendChild(createCategoryChip(cat, false));
    }
  });

  userCategories.forEach(cat => {
    customContainer.appendChild(createCategoryChip(cat, true));
  });

  const setupDropZone = (element, willBecomeCustom) => {
    element.addEventListener('dragover', e => {
      e.preventDefault();
      element.classList.add('drop-target');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('drop-target');
    });

    element.addEventListener('drop', async e => {
      e.preventDefault();
      element.classList.remove('drop-target');

      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { name, isCustom } = data;
      if (isCustom === willBecomeCustom) return;

      const { userCategories = [] } = await storage.get({ userCategories: [] });
      const stored = localStorage.getItem("defaultCategories");
      const defaults = stored ? JSON.parse(stored) : [];

      let updatedUser, updatedDefaults;
      if (willBecomeCustom) {
        updatedUser = [...userCategories, name];
        updatedDefaults = defaults.filter(c => c !== name);
      } else {
        updatedUser = userCategories.filter(c => c !== name);
        updatedDefaults = [...defaults, name];
      }

      await storage.set({ userCategories: updatedUser });
      localStorage.setItem("defaultCategories", JSON.stringify(updatedDefaults));
      await showCategories();
      await loadUrls?.(); // safe call
    });
  };

  setupDropZone(defaultContainer, false);
  setupDropZone(customContainer, true);

  ctBox.appendChild(defaultTitleWrapper);
  ctBox.appendChild(defaultContainer);
  ctBox.appendChild(customTitleWrapper);
  ctBox.appendChild(customContainer);
}






// ==============================================
// 1. FUNZIONE PRINCIPALE DI SALVATAGGIO (COMPLETA)
// ==============================================
document.getElementById("save-btn").addEventListener("click", async function() {
  try {
    // Mostra il menu di scelta
    const choice = await showSaveOptionsDialog();
    
    if (choice === 'bookmarklet') {
      showBookmarkletInstructions();
    } 
    else if (choice === 'manual') {
      const manualData = await showManualInputDialog();
      if (manualData) {
        await processNewLink(manualData.url, manualData.title);
      }
    } 
    else if (choice === 'qr') {
      const qrData = await scanQRCode();
      if (qrData) {
        await processNewLink(qrData.url, qrData.title);
        
      }
    }
  } catch (error) {
    console.error("Save error:", error);
    showAlert("Error", "Failed to save: " + error.message);
  }
});

// ==============================================
// 2. DIALOG DI SCELTA (COMPLETA)
// ==============================================
function showSaveOptionsDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.top = "0";
    dialog.style.left = "0";
    dialog.style.right = "0";
    dialog.style.bottom = "0";
    dialog.style.backgroundColor = "rgba(0,0,0,0.5)";
    dialog.style.zIndex = "1000";
    dialog.style.display = "flex";
    dialog.style.justifyContent = "center";
    dialog.style.alignItems = "center";
    dialog.style.backdropFilter = "blur(4px)";
    dialog.style.opacity = "0";
    dialog.style.transition = "opacity 0.3s ease";
    
    const isDark = document.body.classList.contains("dark");
    const bgColor = isDark ? "#2d3748" : "#ffffff";
    const textColor = isDark ? "#f7fafc" : "#1a202c";
    const borderColor = isDark ? "#4a5568" : "#e2e8f0";
    
    // Nuova palette di colori per i pulsanti
    const buttonColors = {
      manual: { 
        bg: isDark ? '#38a169' : '#48bb78',
        hover: isDark ? '#2f855a' : '#38a169',
        icon: '#f0fff4'
      },
      qr: { 
        bg: isDark ? '#9f7aea' : '#9f7aea',
        hover: isDark ? '#805ad5' : '#805ad5',
        icon: '#faf5ff'
      },
      bookmarklet: { 
        bg: isDark ? '#2b6cb0' : '#3182ce',
        hover: isDark ? '#2c5282' : '#2b6cb0',
        icon: '#ebf8ff'
      }
    };
    
    dialog.innerHTML = `
      <div style="
        background: ${bgColor};
        color: ${textColor};
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 320px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        border: 1px solid ${borderColor};
        transform: translateY(20px);
        transition: transform 0.3s ease;
      ">
        <h3 style="
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${isDark ? '#a0aec0' : '#4a5568'};
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Link
        </h3>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Modificato l'ordine dei pulsanti -->
          <button data-choice="manual" style="
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 12px 16px;
            background: ${buttonColors.manual.bg};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
          ">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 6px;
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${buttonColors.manual.icon}" stroke-width="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                <path d="M2 2l7.586 7.586"></path>
                <circle cx="11" cy="11" r="2"></circle>
              </svg>
            </div>
            <span>Enter Manually</span>
          </button>
          
          <button data-choice="qr" style="
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 12px 16px;
            background: ${buttonColors.qr.bg};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
          ">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 6px;
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${buttonColors.qr.icon}" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <span>Scan QR Code</span>
          </button>
          
          <button data-choice="bookmarklet" style="
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 12px 16px;
            background: ${buttonColors.bookmarklet.bg};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
          ">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 6px;
              background: rgba(255,255,255,0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${buttonColors.bookmarklet.icon}" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </div>
            <span>Use Bookmarklet</span>
          </button>
        </div>
      </div>
    `;
    

    document.body.appendChild(dialog);
    
    // Animazione di entrata
    setTimeout(() => {
      dialog.style.opacity = "1";
      dialog.querySelector("div").style.transform = "translateY(0)";
    }, 10);
    
    // Gestione hover
    const buttons = dialog.querySelectorAll("button[data-choice]");
    buttons.forEach(btn => {
      const choice = btn.dataset.choice;
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = buttonColors[choice].hover;
        btn.style.transform = "translateY(-1px)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = buttonColors[choice].bg;
        btn.style.transform = "translateY(0)";
      });
    });
    
    // Chiudi al click su un'opzione
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        // Animazione di uscita
        dialog.style.opacity = "0";
        dialog.querySelector("div").style.transform = "translateY(20px)";
        
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(btn.dataset.choice);
        }, 300);
      });
    });
    
    // Chiudi al click fuori dal menu
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        // Animazione di uscita
        dialog.style.opacity = "0";
        dialog.querySelector("div").style.transform = "translateY(20px)";
        
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(null);
        }, 300);
      }
    });
  });
}



// ==============================================
// 3. SCANNER QR CODE (VERSIONE DEFINITIVA)
// ==============================================

// Costanti per la configurazione dello scanner
const QR_SCAN_TIMEOUT = 30000; // 30 secondi
const SCAN_INTERVAL = 200; // 200ms tra scansioni

let qrScannerReady = false;

// Funzione per precaricare la libreria QR scanner
function preloadQRScanner() {
    if (!qrScannerReady && !window.jsQR) {
        return loadJSQRLibrary().then(() => {
            qrScannerReady = true;
        });
    }
    return Promise.resolve();
}

// Funzione per caricare la libreria JSQR
function loadJSQRLibrary() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        script.onload = () => {
            qrScannerReady = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Funzione principale per la scansione QR
async function scanQRCode() {
    const loader = showAlert("Loading", "Preparing QR scanner...", false);
    
    try {
        if (!window.jsQR) {
            try {
                await loadJSQRLibrary();
            } catch (error) {
                loader();
                showAlert("Error", "Failed to load QR scanner library");
                return null;
            }
        }
        
        loader();

        // Creazione dell'interfaccia dello scanner
        const scannerDiv = document.createElement('div');
        scannerDiv.style.position = 'fixed';
        scannerDiv.style.top = '0';
        scannerDiv.style.left = '0';
        scannerDiv.style.width = '100%';
        scannerDiv.style.height = '100%';
        scannerDiv.style.backgroundColor = 'black';
        scannerDiv.style.zIndex = '10000';
        
        scannerDiv.innerHTML = `
            <video autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
            <div style="position:absolute;top:20px;left:0;right:0;text-align:center;color:white;padding:10px">
                <h3 style="margin:0">Scan QR Code</h3>
                <p id="scan-timer" style="margin:4px 0 0 0">Time remaining: ${QR_SCAN_TIMEOUT/1000}s</p>
                <div style="width:100%;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin-top:8px;overflow:hidden">
                    <div id="scan-progress" style="width:100%;height:100%;background:#4285F4;transition:width 1s linear"></div>
                </div>
            </div>
            <div style="position:absolute;bottom:20px;left:0;right:0;text-align:center">
                <button id="cancel-scan" style="padding:12px 24px;background:#f44336;color:white;border:none;border-radius:20px">Cancel</button>
            </div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                        width:70%;height:200px;border:4px dashed rgba(255,255,255,0.7);pointer-events:none"></div>
        `;

        document.body.appendChild(scannerDiv);
        const video = scannerDiv.querySelector('video');
        const cancelBtn = scannerDiv.querySelector('#cancel-scan');
        const timerElement = scannerDiv.querySelector('#scan-timer');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            video.srcObject = stream;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            return new Promise((resolve) => {
                let scanActive = true;
                let lastScanTime = 0;
                const startTime = Date.now();
                
                // Timeout automatico
                const timeoutId = setTimeout(() => {
                    if (scanActive) {
                        stopScanning();
                        showAlert("Timeout", "QR scan timed out after 30 seconds");
                        resolve(null);
                    }
                }, QR_SCAN_TIMEOUT);

                // Funzione per aggiornare il timer e la barra di progresso
                const updateTimer = () => {
                    if (!scanActive) return;
                    const elapsed = Date.now() - startTime;
                    const remaining = Math.ceil((QR_SCAN_TIMEOUT - elapsed) / 1000);
                    const progressPercent = ((QR_SCAN_TIMEOUT - elapsed) / QR_SCAN_TIMEOUT) * 100;
                    
                    timerElement.textContent = `Time remaining: ${remaining}s`;
                    const progressBar = scannerDiv.querySelector('#scan-progress');
                    progressBar.style.width = `${progressPercent}%`;
                    
                    if (remaining <= 5) {
                        timerElement.style.color = '#ff4444';
                        timerElement.style.fontWeight = 'bold';
                        progressBar.style.background = '#ff4444';
                    }
                    
                    if (remaining > 0) {
                        setTimeout(updateTimer, 1000);
                    }
                };
                
                // Avvia il timer
                updateTimer();

                // Funzione per fermare la scansione
                const stopScanning = () => {
                    scanActive = false;
                    clearTimeout(timeoutId);
                    stream.getTracks().forEach(track => track.stop());
                    if (document.body.contains(scannerDiv)) {
                        document.body.removeChild(scannerDiv);
                    }
                };

                // Funzione per analizzare il frame corrente
                const scanFrame = (timestamp) => {
                    if (!scanActive) return;
                    
                    if (timestamp - lastScanTime < SCAN_INTERVAL) {
                        requestAnimationFrame(scanFrame);
                        return;
                    }
                    lastScanTime = timestamp;

                    try {
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const code = window.jsQR(
                                imageData.data,
                                imageData.width,
                                imageData.height,
                                { inversionAttempts: "attemptBoth" }
                            );
                            
                            if (code) {
                                scanActive = false;
                                clearTimeout(timeoutId);
                                
                                // Feedback vibrazione (se supportato)
                                if (navigator.vibrate) {
                                    navigator.vibrate([100, 30, 100]);
                                }
                                
                                // Mostra feedback visivo di successo
                                const feedbackDiv = document.createElement('div');
                                feedbackDiv.style.position = 'absolute';
                                feedbackDiv.style.top = '0';
                                feedbackDiv.style.left = '0';
                                feedbackDiv.style.width = '100%';
                                feedbackDiv.style.height = '100%';
                                feedbackDiv.style.backgroundColor = 'rgba(76, 175, 80, 0.5)';
                                feedbackDiv.style.display = 'flex';
                                feedbackDiv.style.justifyContent = 'center';
                                feedbackDiv.style.alignItems = 'center';
                                feedbackDiv.innerHTML = `
                                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                        <path d="M20 6L9 17l-5-5"/>
                                    </svg>
                                `;
                                scannerDiv.appendChild(feedbackDiv);

                                setTimeout(() => {
                                    stopScanning();
                                    if (isValidUrl(code.data)) {
                                        resolve({ url: code.data, title: "Scanned QR Code" });
                                    } else {
                                        showQRContentDialog(code.data);
                                        resolve(null);
                                    }
                                }, 500);
                                return;
                            }
                        }
                        
                        requestAnimationFrame(scanFrame);
                    } catch (error) {
                        console.error("Scan error:", error);
                        stopScanning();
                        resolve(null);
                    }
                };
                
                video.onplaying = () => requestAnimationFrame(scanFrame);
                
                cancelBtn.addEventListener('click', () => {
                    stopScanning();
                    resolve(null);
                });
            });
            
        } catch (error) {
            document.body.removeChild(scannerDiv);
            showAlert("Camera Error", "Could not access camera: " + error.message);
            return null;
        }
    } catch (error) {
        loader();
        showAlert("Error", "Failed to start QR scanner: " + error.message);
        return null;
    }
}


// ==============================================
// FUNZIONE PER MOSTRARE CONTENUTI NON-URL
// ==============================================
function showQRContentDialog(content) {
  const dialog = document.createElement("div");
  dialog.style.position = "fixed";
  dialog.style.top = "0";
  dialog.style.left = "0";
  dialog.style.right = "0";
  dialog.style.bottom = "0";
  dialog.style.backgroundColor = "rgba(0,0,0,0.8)";
  dialog.style.zIndex = "1000";
  dialog.style.display = "flex";
  dialog.style.justifyContent = "center";
  dialog.style.alignItems = "center";
  dialog.style.padding = "20px";
  
  dialog.innerHTML = `
    <div style="
      background: #2d3748;
      color: #e2e8f0;
      padding: 20px;
      border-radius: 8px;
      width: 100%;
      max-width: 400px;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    ">
      <h3 style="margin-top:0;color:#ffffff">QR Code Content</h3>
      <div style="
        padding: 12px;
        background: #4a5568;
        border-radius: 4px;
        word-break: break-all;
        font-family: monospace;
        color: #f7fafc;
      ">
        ${content}
      </div>
      <div style="display:flex;gap:10px;margin-top:15px">
        <button id="copy-content-btn" style="
          padding: 8px 12px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          flex-grow:1;
        ">
          Copy to Clipboard
        </button>
        <button id="close-qr-dialog" style="
          padding: 8px 12px;
          background: #2b6cb0;
          color: white;
          border: none;
          border-radius: 4px;
          flex-grow:1;
        ">
          Close
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Aggiungi funzionalità di copia
  dialog.querySelector("#copy-content-btn").addEventListener("click", () => {
    navigator.clipboard.writeText(content).then(() => {
      const btn = dialog.querySelector("#copy-content-btn");
      btn.textContent = "Copied!";
      btn.style.backgroundColor = "#388E3C";
      setTimeout(() => {
        btn.textContent = "Copy to Clipboard";
        btn.style.backgroundColor = "#4CAF50";
      }, 2000);
    });
  });
  
  // Chiudi al click
  dialog.querySelector("#close-qr-dialog").addEventListener("click", () => {
    document.body.removeChild(dialog);
  });
}

  
 // ==============================================
  // 4. FUNZIONE DI SALVATAGGIO LINK (VERSIONE MIGLIORATA)
  // ==============================================
async function processNewLink(url, title) {
  // 1. Controllo duplicati in sessionStorage
  const lastProcessed = sessionStorage.getItem('lastProcessedUrl');
  if (lastProcessed === url) {
    console.log('URL già processato in questa sessione');
    return;
  }

  // 2. Validazioni di base
  if (!url) throw new Error("No URL provided");
  if (!isValidUrl(url)) throw new Error("Invalid URL format");
  
  const mockTab = { 
    url, 
    title: title || url,
    cleanUrl: url.split('?')[0].split('#')[0] // Normalizza l'URL
  };

  try {
    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
    
    // 3. Controllo duplicati nello storage con URL normalizzato
    const existingIndex = visitedUrls.findIndex(item => 
      item.url === mockTab.url || 
      item.url.startsWith(mockTab.cleanUrl)
    );

    return new Promise((resolve) => {
      categorizeByLearnedKeywords(mockTab.title, mockTab.url, async (category, isIA) => {
        if (existingIndex === -1) {
          visitedUrls.push({
            url: mockTab.url,
            category,
            originalCategory: category,
            title: mockTab.title
          });
          
          await storage.set({
            visitedUrls,
            lastAddedUrl: mockTab.url,
            highlightColor: "green"
          });
        } else {
          await storage.set({
            lastAddedUrl: mockTab.url,
            highlightColor: "orange"
          });
        }

        // 4. Aggiorna sessionStorage PRIMA di risolvere
        sessionStorage.setItem('lastProcessedUrl', mockTab.url);
        await loadUrls();
        resolve();
      });
    });
  } catch (error) {
    console.error("Error saving link:", error);
    // 5. Pulisci il sessionStorage in caso di errore
    sessionStorage.removeItem('lastProcessedUrl');
    throw error;
  }
}


// ==============================================
// 5. FUNZIONI AUSILIARIE (COMPLETE)
// ==============================================


async function showManualInputDialog() {
  return new Promise((resolve) => {
    const isDark = document.body.classList.contains("dark");
    const bgColor = isDark ? "#2d3748" : "#ffffff";
    const textColor = isDark ? "#f7fafc" : "#1a202c";
    const borderColor = isDark ? "#4a5568" : "#e2e8f0";
    const accentColor = isDark ? "#4299e1" : "#3182ce";
    const inputBg = isDark ? "#4a5568" : "#edf2f7";
    const inputText = isDark ? "#f7fafc" : "#2d3748";

    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.top = "0";
    dialog.style.left = "0";
    dialog.style.right = "0";
    dialog.style.bottom = "0";
    dialog.style.backgroundColor = "rgba(0,0,0,0.5)";
    dialog.style.zIndex = "1000";
    dialog.style.display = "flex";
    dialog.style.justifyContent = "center";
    dialog.style.alignItems = "center";
    dialog.style.backdropFilter = "blur(4px)";
    dialog.style.opacity = "0";
    dialog.style.transition = "opacity 0.3s ease";

    dialog.innerHTML = `
      <div style="
        background: ${bgColor};
        color: ${textColor};
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        border: 1px solid ${borderColor};
        transform: translateY(20px);
        transition: transform 0.3s ease;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        ">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: ${accentColor}20;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
          </div>
          <h3 style="
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: ${textColor};
          ">
            Add Link Manually
          </h3>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            font-weight: 500;
            color: ${isDark ? '#a0aec0' : '#4a5568'};
          ">
            URL
          </label>
          <input type="url" id="manual-url" placeholder="https://example.com" 
                 style="
                   width: 100%;
                   padding: 12px 14px;
                   font-size: 14px;
                   background: ${inputBg};
                   color: ${inputText};
                   border: 1px solid ${borderColor};
                   border-radius: 8px;
                   outline: none;
                   transition: all 0.2s ease;
                 "
                 required>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            font-weight: 500;
            color: ${isDark ? '#a0aec0' : '#4a5568'};
          ">
            Title (optional)
          </label>
          <input type="text" id="manual-title" placeholder="My Awesome Website" 
                 style="
                   width: 100%;
                   padding: 12px 14px;
                   font-size: 14px;
                   background: ${inputBg};
                   color: ${inputText};
                   border: 1px solid ${borderColor};
                   border-radius: 8px;
                   outline: none;
                   transition: all 0.2s ease;
                 ">
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="manual-cancel" style="
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 500;
            background: transparent;
            color: ${isDark ? '#a0aec0' : '#718096'};
            border: 1px solid ${borderColor};
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            Cancel
          </button>
          <button id="manual-confirm" style="
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            background: ${accentColor};
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);
          ">
            Save Link
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Animazione di entrata
    setTimeout(() => {
      dialog.style.opacity = "1";
      dialog.querySelector("div").style.transform = "translateY(0)";
      document.getElementById("manual-url").focus();
    }, 10);

    // Aggiungi effetti hover
    const confirmBtn = document.getElementById("manual-confirm");
    const cancelBtn = document.getElementById("manual-cancel");
    
    confirmBtn.addEventListener("mouseenter", () => {
      confirmBtn.style.transform = "translateY(-1px)";
      confirmBtn.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)";
    });
    confirmBtn.addEventListener("mouseleave", () => {
      confirmBtn.style.transform = "translateY(0)";
      confirmBtn.style.boxShadow = "0 1px 3px 0 rgba(0,0,0,0.1)";
    });
    
    cancelBtn.addEventListener("mouseenter", () => {
      cancelBtn.style.backgroundColor = isDark ? "rgba(160, 174, 192, 0.1)" : "rgba(113, 128, 150, 0.1)";
    });
    cancelBtn.addEventListener("mouseleave", () => {
      cancelBtn.style.backgroundColor = "transparent";
    });

    // Focus styles
    const inputs = dialog.querySelectorAll("input");
    inputs.forEach(input => {
      input.addEventListener("focus", () => {
        input.style.borderColor = accentColor;
        input.style.boxShadow = `0 0 0 2px ${accentColor}40`;
      });
      input.addEventListener("blur", () => {
        input.style.borderColor = borderColor;
        input.style.boxShadow = "none";
      });
    });

    const confirm = () => {
      const url = dialog.querySelector("#manual-url").value.trim();
      if (!url) {
        // Aggiungi feedback visivo per campo obbligatorio
        const urlInput = dialog.querySelector("#manual-url");
        urlInput.style.borderColor = "#e53e3e";
        urlInput.style.boxShadow = "0 0 0 2px rgba(229, 62, 62, 0.2)";
        setTimeout(() => {
          urlInput.style.borderColor = borderColor;
          urlInput.style.boxShadow = "none";
        }, 1000);
        return;
      }
      
      resolve({
        url: url,
        title: dialog.querySelector("#manual-title").value.trim() || url
      });
      
      // Animazione di uscita
      dialog.style.opacity = "0";
      dialog.querySelector("div").style.transform = "translateY(20px)";
      setTimeout(() => {
        document.body.removeChild(dialog);
      }, 300);
    };

    confirmBtn.addEventListener("click", confirm);
    
    // Conferma con Enter
    dialog.querySelector("#manual-url").addEventListener("keypress", (e) => {
      if (e.key === "Enter") confirm();
    });
    dialog.querySelector("#manual-title").addEventListener("keypress", (e) => {
      if (e.key === "Enter") confirm();
    });

    cancelBtn.addEventListener("click", () => {
      // Animazione di uscita
      dialog.style.opacity = "0";
      dialog.querySelector("div").style.transform = "translateY(20px)";
      setTimeout(() => {
        document.body.removeChild(dialog);
        resolve(null);
      }, 300);
    });

    // Chiudi al click fuori dal dialogo
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        // Animazione di uscita
        dialog.style.opacity = "0";
        dialog.querySelector("div").style.transform = "translateY(20px)";
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(null);
        }, 300);
      }
    });
  });
}

function showAlert(title, message, showCopyButton = false) {
  const alertDiv = document.createElement("div");
  const overlay = document.createElement("div");
  
  // Creazione overlay semi-trasparente
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
  overlay.style.zIndex = "1000";
  overlay.style.backdropFilter = "blur(2px)";
  
  // Stile del contenitore principale (come prima)
  alertDiv.style.position = "fixed";
  alertDiv.style.top = "20px";
  alertDiv.style.left = "50%";
  alertDiv.style.transform = "translateX(-50%)";
  alertDiv.style.backgroundColor = "#2D3748";
  alertDiv.style.color = "#F7FAFC";
  alertDiv.style.padding = "15px";
  alertDiv.style.borderRadius = "8px";
  alertDiv.style.zIndex = "1001";
  alertDiv.style.width = "max-content";
  alertDiv.style.maxWidth = "min(90%, 500px)";
  alertDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  alertDiv.style.border = "1px solid #4A5568";
  alertDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";

  // Pulsante di chiusura (X in alto a destra)
  const closeButton = document.createElement("button");
  closeButton.innerHTML = "&times;";
  closeButton.style.position = "absolute";
  closeButton.style.top = "5px";
  closeButton.style.right = "5px";
  closeButton.style.background = "transparent";
  closeButton.style.border = "none";
  closeButton.style.color = "#E2E8F0";
  closeButton.style.fontSize = "20px";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "0 8px";
  closeButton.style.lineHeight = "1";

  // Contenuto interno
  alertDiv.innerHTML = `
    <h4 style="margin:0 25px 12px 0; font-size:18px; color:#FFFFFF; font-weight:600">${title}</h4>
    <div style="font-size:15px; line-height:1.5; color:#E2E8F0">${message}</div>
  `;


  // Funzione di chiusura
  const closeAlert = () => {
    document.body.removeChild(overlay);
    document.body.removeChild(alertDiv);
  };

  // Gestione chiusura
  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAlert();
  });

  // Chiudi quando si clicca sull'overlay (fuori dall'alert)
  overlay.addEventListener("click", closeAlert);
  
  // Previeni la chiusura quando si clicca sull'alert stesso
  alertDiv.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Aggiungi elementi al DOM
  document.body.appendChild(overlay);
  alertDiv.appendChild(closeButton);
  document.body.appendChild(alertDiv);

  // Ritorna funzione di chiusura per controllo esterno
  return closeAlert;
}

// ESEMPIO DI USO
function showBookmarkletInstructions() {
  const getBaseUrl = () => {
    const url = new URL(window.location.href);
    return `${url.origin}${url.pathname.split('/').slice(0, 2).join('/')}/`;
  };

  // 2. Crea il bookmarklet con la sintassi che funziona
  const rawBookmarklet = `javascript:(function(){
    var title=encodeURIComponent(document.title);
    var url=encodeURIComponent(window.location.href);
    window.location.href='${getBaseUrl()}?title='+title+'&url='+url;
  })();`;

  // 3. Codifica correttamente per l'uso in HTML
  const bookmarkletCode = rawBookmarklet
    .replace(/ /g, '%20')
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

    // 4. Mostra la finestra con pulsante di copia
  showAlert("How to Use Bookmarklet", `
    1. Copy this code:<br><br>
    <code id="bookmarklet-code" style="
      background:#4A5568;
      padding:10px;
      border-radius:6px;
      color:#F7FAFC;
      display:block;
      margin:10px 0;
      font-family:monospace;
      word-break:break-all;
      border:1px solid #718096;
      user-select:all;
      -webkit-user-select:all;
    ">${bookmarkletCode}</code>
    
    <button onclick="
      navigator.clipboard.writeText(document.getElementById('bookmarklet-code').innerText);
      this.textContent = '✓ Copied!';
      setTimeout(() => this.textContent = 'Copy Code', 2000);
    " style="
      padding:8px 16px;
      background:#4CAF50;
      color:white;
      border:none;
      border-radius:4px;
      font-size:14px;
      cursor:pointer;
      margin-top:5px;
    ">
      Copy Code
    </button><br>
    
    2. Create a new bookmark in Safari<br>
    3. Paste as URL<br>
    4. Use from any page by tapping the bookmark
  `, true);
}
  
// ============================================
// FUNZIONI CORE (rimangono identiche)
// ============================================

async function saveLink(url, title) {
  return new Promise((resolve) => {
    categorizeByLearnedKeywords(title, url, async (category) => {
      const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
      
      if (!visitedUrls.some(item => item.url === url)) {
        visitedUrls.push({ 
          url, 
          title,
          category, 
          originalCategory: category 
        });
        
        await storage.set({
          visitedUrls,
          lastAddedUrl: url,
          highlightColor: "green"
        });
        
        await loadUrls();
      } else {
        await storage.set({
          lastAddedUrl: url,
          highlightColor: "orange"
        });
      }
      resolve();
    });
  });
}

async function saveCurrentTab() {
  try {
    const mockTab = {
      url: window.location.href,
      title: document.title || ""
    };
    await saveLink(mockTab.url, mockTab.title);
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio");
  }
}

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }
 
  // Caricamento iniziale
  await loadUrls();
});

// ============================================
// 6. FUNZIONE LOADURLS COMPLETA
// ============================================
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

 // Imposta lo stile iniziale del sortToggle
  const sortToggle = document.getElementById("sort-toggle");
  sortToggle.textContent = sortOrder === "default" ? "By Input" : 
                         sortOrder === "category" ? "By Category" : "By Custom";
  sortToggle.classList.remove("active", "custom");
  if (sortOrder === "category") {
    sortToggle.classList.add("active");
  } else if (sortOrder === "custom") {
    sortToggle.classList.add("custom");
  }
  // Per "default" non aggiungiamo classi, quindi sarà grigio

  const list = document.getElementById("url-list");
  list.innerHTML = "";

  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.checked = (radio.value === sortOrder);
  });

  const urls = [...visitedUrls];
  if (sortOrder === "category") {
    urls.sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other"));
  }

  let defaultCategories = [];

try {
    // Prova a caricare dal localStorage
    const storedCategories = localStorage.getItem('defaultCategories');
    if (storedCategories) {
      defaultCategories = JSON.parse(storedCategories);
    } else {
      // Se non in localStorage, scarica da GitHub
      const response = await fetch(DEFAULT_CATEGORIES_URL);
      if (response.ok) {
        defaultCategories = await response.json();
        localStorage.setItem('defaultCategories', JSON.stringify(defaultCategories));
      } else {
        throw new Error('Failed to fetch categories');
      }
    }
  } catch (error) {
    console.error('Using fallback categories', error);
    // Fallback hardcoded
    defaultCategories = [
      "News", "Video", "Finance", "Social", "E-mail", "Store", "Commerce",
      "Productivity", "Entertainment", "Education", "Sports",
      "AI", "Search", "Design", "Weather", "Other"
    ];
  }

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
  
  // Aggiungi classe in base al tipo di categoria
  if (userCategories.includes(opt)) {
    option.classList.add("custom-category");
  } else {
    option.classList.add("default-category");
  }
  
  select.appendChild(option);
});


select.addEventListener("change", async () => {
  const newCat = select.value;
  const { visitedUrls = [], userCategories = [] } = await storage.get({ visitedUrls: [], userCategories: [] });
  const idx = visitedUrls.findIndex(i => i.url === item.url);
  if (idx !== -1) {
    visitedUrls[idx].category = newCat;

    // 🔁 Ricarica le default categories aggiornate dal localStorage
    const storedDefaults = localStorage.getItem("defaultCategories");
    const defaultCategories = storedDefaults ? JSON.parse(storedDefaults) : [];

    // Attiva l'apprendimento solo se la nuova categoria è ancora default
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
      remove.textContent = "[x]";
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
