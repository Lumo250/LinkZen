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

const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];


// Nuova funzione per processare il bookmarklet
function processaBookmarklet() {
    const params = new URLSearchParams(window.location.search);
    if(!params.has('bookmarklet')) return;
    
    const titolo = decodeURIComponent(params.get('titolo') || '');
    const url = decodeURIComponent(params.get('url') || '');
    
    if(!url) return;
    
    // Pulisce l'URL dopo aver letto i parametri
    history.replaceState({}, '', window.location.pathname);
    
    return { titolo, url };
}

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
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const title = urlParams.get('title');
    const url = urlParams.get('url');
    
    if (!url) return;

    // Pulisci l'URL dopo aver letto i parametri
    window.history.replaceState({}, document.title, window.location.pathname);

    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
    const alreadyExists = visitedUrls.some(item => item.url === url);

    if (alreadyExists) {
      await storage.set({
        lastAddedUrl: url,
        highlightColor: "orange"
      });
      await loadUrls();
      return;
    }

    categorizeByLearnedKeywords(decodeURIComponent(title), decodeURIComponent(url), async (category, isIA) => {
      visitedUrls.push({
        url: decodeURIComponent(url),
        title: decodeURIComponent(title),
        category: category,
        originalCategory: category
      });

      await storage.set({
        visitedUrls: visitedUrls,
        lastAddedUrl: url,
        highlightColor: "green"
      });

      await loadUrls();
    });
  } catch (e) {
    console.error("Errore elaborazione bookmarklet:", e);
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
  document.body.style.fontSize = `${scale}em`;
  storage.set({ fontScale: scale });

  const box = document.getElementById("ia-knowledge-box");
  if (box) {
    box.style.fontSize = `${scale}em`;
  }
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

// ============================================
// 5. EVENT LISTENERS E INIZIALIZZAZIONE
// ============================================
document.addEventListener("DOMContentLoaded", async () => {
    // Processa il bookmarklet se presente
    const bookmarkletData = processaBookmarklet();
    if(bookmarkletData) {
        const { titolo, url } = bookmarkletData;
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        
        if(!visitedUrls.some(item => item.url === url)) {
            categorizeByLearnedKeywords(titolo, url, async (category) => {
                visitedUrls.push({
                    url: url,
                    title: titolo,
                    category: category,
                    originalCategory: category
                });
                await storage.set({ visitedUrls });
                await loadUrls();
            });
        }
    }
    

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
  document.getElementById("zoom-in").addEventListener("click", () => {
    fontScale = Math.min(fontScale + 0.1, 2);
    applyFontSize(fontScale);
  });

  document.getElementById("zoom-out").addEventListener("click", () => {
    fontScale = Math.max(fontScale - 0.1, 0.6);
    applyFontSize(fontScale);
  });

  // IA Knowledge Box
  document.getElementById("ia-knowledge-btn").addEventListener("click", async () => {
    const iaBtn = document.getElementById("ia-knowledge-btn");
    const box = document.getElementById("ia-knowledge-box");
    const isVisible = !box.classList.contains("hidden");

    if (isVisible) {
      box.classList.add("hidden");
      iaBtn.classList.remove("active");
      return;
    }

    const { keywordToCategory = {} } = await storage.get({ keywordToCategory: {} });
    const map = keywordToCategory;
    const entries = Object.entries(map);
    box.innerHTML = "";

    if (entries.length === 0) {
      box.textContent = "Nessuna parola chiave appresa.";
    } else {
      const grouped = {};
      entries.forEach(([keyword, category]) => {
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(keyword);
      });

      for (const category in grouped) {
        const catBlock = document.createElement("div");
        catBlock.style.marginBottom = "12px";

        const catTitle = document.createElement("div");
        catTitle.textContent = `📁 ${category}`;
        catTitle.style.fontWeight = "bold";
        catTitle.style.marginBottom = "4px";
        catTitle.style.fontSize = "16px";
        catTitle.style.padding = "4px 8px";
        catTitle.style.borderRadius = "6px";
        catTitle.style.display = "inline-block";

        const isDark = document.body.classList.contains("dark");
        catTitle.style.backgroundColor = isDark ? "#2c2c2c" : "#f0f0f0";
        catTitle.style.color = isDark ? "#e0e0e0" : "#333333";
        catTitle.style.border = `1px solid ${isDark ? "#444" : "#ccc"}`;

        catBlock.appendChild(catTitle);

        const kwContainer = document.createElement("div");
        kwContainer.style.display = "flex";
        kwContainer.style.flexWrap = "wrap";
        kwContainer.style.gap = "6px";

        grouped[category].forEach((keyword) => {
          const chip = document.createElement("div");
          chip.textContent = keyword;
          chip.title = `Click to remove "${keyword}"`;
          chip.style.padding = "2px 6px";
          chip.style.border = "1px solid orange";
          chip.style.borderRadius = "4px";
          chip.style.cursor = "pointer";
          chip.style.fontSize = "inherit";

          chip.addEventListener("click", async () => {
            delete map[keyword];
            await storage.set({ keywordToCategory: map });
            chip.remove();
            if (Object.keys(map).length === 0) {
              box.textContent = "Nessuna parola chiave appresa.";
            }
          });

          kwContainer.appendChild(chip);
        });

        catBlock.appendChild(kwContainer);
        box.appendChild(catBlock);
      }
    }

    box.classList.remove("hidden");
    iaBtn.classList.add("active");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Export/Import
  const exportBtn = document.getElementById("export-btn");
  const exportDefault = document.getElementById("export-default");
  const exportOptions = document.getElementById("export-options");

  exportBtn.addEventListener("click", (e) => {
    exportDefault.style.display = "none";
    exportOptions.classList.remove("hidden");
    e.stopPropagation();
  });

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

  document.getElementById("export-full").addEventListener("click", async () => {
    const { visitedUrls = [], userCategories = [], keywordToCategory = {} } = await storage.get({ visitedUrls: [], userCategories: [], keywordToCategory: {} });
    const blob = new Blob([JSON.stringify({ visitedUrls, userCategories, keywordToCategory }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkzen_export_full.json";
    a.click();
    URL.revokeObjectURL(url);
    exportDefault.style.display = "flex";
    exportOptions.classList.add("hidden");
  });

  // Import
  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.visitedUrls && Array.isArray(data.visitedUrls)) {
          await storage.set(data);
          await loadUrls();
        } else {
          alert("File non valido. Nessuna lista trovata.");
        }
      } catch (err) {
        alert("Errore nel file: " + err.message);
      }
    };
    reader.readAsText(file);
  });

// Categorie - Versione migliorata con [x] e dropdown persistente
const input = document.getElementById("new-category-input");
const dropdown = document.getElementById("dropdown-category-list");

// Funzione per caricare le categorie
async function loadDropdownCategories() {
  const { userCategories = [] } = await storage.get({ userCategories: [] });
  dropdown.innerHTML = "";
  
  userCategories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "dropdown-item";
    
    // Nome categoria
    const nameSpan = document.createElement("span");
    nameSpan.textContent = cat;
    row.appendChild(nameSpan);
    
    // Pulsante [x]
    const remove = document.createElement("span");
    remove.innerHTML = "<span style='margin-left: 6px; color: red; cursor: pointer'>[x]</span>";
    remove.className = "remove";
    remove.title = "Elimina categoria";
    row.appendChild(remove);
    
    dropdown.appendChild(row);
  });
}

// Aggiungi categoria
document.getElementById("add-category-btn").addEventListener("click", async (e) => {
  e.stopPropagation(); // Impedisce la chiusura del dropdown
  
  const newCategory = input.value.trim();
  if (!newCategory) return;
  
  const { userCategories = [] } = await storage.get({ userCategories: [] });
  if (!userCategories.includes(newCategory)) {
    const updated = [...userCategories, newCategory];
    await storage.set({ userCategories: updated });
    input.value = "";
    await loadDropdownCategories(); // Aggiorna il dropdown
    
    // Mantieni il focus sull'input per continuare a inserire
    input.focus();
  }
});

// Mostra dropdown
input.addEventListener("focus", async () => {
  dropdown.classList.remove("hidden");
  await loadDropdownCategories();
});

// Gestione click esterno
document.addEventListener("click", (event) => {
  if (!input || !dropdown) return;

  const clickedRemove = event.target.closest(".remove");
  const clickedInside = input.contains(event.target) || dropdown.contains(event.target);
  
  if (clickedInside && !clickedRemove) {
    return; // Non chiudere se click interno (tranne che su [x])
  }
  dropdown.classList.add("hidden");
});

// Gestione cancellazione
dropdown.addEventListener("click", async (event) => {
  const removeBtn = event.target.closest(".remove");
  if (!removeBtn) return;
  
  event.stopPropagation();
  
  const catRow = removeBtn.closest(".dropdown-item");
  const cat = catRow.firstChild.textContent.trim(); // Prende il testo prima del [x]
  
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
  
  await loadDropdownCategories();
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

  // Reset
  document.getElementById("reset-btn").addEventListener("click", async () => {
    await storage.set({ clickedUrls: [] });
    await loadUrls();
  });

  // Sort
  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener("change", async () => {
      await storage.set({ sortOrder: radio.value });
      await loadUrls();
    });
  });


// Nuova funzione Save (sostituisci completamente il blocco esistente)
document.getElementById("save-btn").addEventListener("click", async function() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (!isIOS) {
    try {
      const mockTab = {
        url: window.location.href,
        title: document.title || ""
      };
      categorizeByLearnedKeywords(mockTab.title, mockTab.url, async (category, isIA) => {
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        const index = visitedUrls.findIndex(item => item.url === mockTab.url);
        if (index === -1) {
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
        await loadUrls();
      });
    } catch (err) {
      console.error("Errore nel salvataggio:", err);
    }
    return;
  }

  // Modal per iOS
  const modalHTML = `
    <div id="linkzen-save-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;">
      <div style="background:#2c2c2c;padding:20px;border-radius:10px;max-width:90%;width:400px;">
        <h2 style="margin-top:0;">Aggiungi Link</h2>
        <div style="display:flex;gap:10px;margin-bottom:15px;">
          <button id="manual-input-btn" style="flex:1;padding:10px;background:#4CAF50;color:white;border:none;border-radius:5px;">
            <i class="fas fa-keyboard"></i> Manuale
          </button>
          <button id="scan-qr-btn" style="flex:1;padding:10px;background:#2196F3;color:white;border:none;border-radius:5px;">
            <i class="fas fa-qrcode"></i> Scansiona
          </button>
        </div>
        <div id="input-container" style="display:none;">
          <input type="text" id="manual-url-input" placeholder="Incolla URL qui" style="width:100%;padding:10px;margin-bottom:10px;border-radius:5px;border:none;">
          <input type="text" id="manual-title-input" placeholder="Titolo (opzionale)" style="width:100%;padding:10px;margin-bottom:10px;border-radius:5px;border:none;">
          <div style="display:flex;gap:10px;">
            <button id="cancel-input-btn" style="flex:1;padding:10px;background:#f44336;color:white;border:none;border-radius:5px;">Annulla</button>
            <button id="confirm-save-btn" style="flex:1;padding:10px;background:#4CAF50;color:white;border:none;border-radius:5px;">Salva</button>
          </div>
        </div>
        <div id="scanner-container" style="display:none;position:relative;">
          <video id="qr-scanner" style="width:100%;border-radius:5px;"></video>
          <button id="cancel-scan-btn" style="position:absolute;top:10px;right:10px;padding:5px 10px;background:#f44336;color:white;border:none;border-radius:5px;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div style="margin-top:15px;text-align:center;">
          <button id="use-bookmarklet-btn" style="padding:10px;background:#9C27B0;color:white;border:none;border-radius:5px;width:100%;">
            <i class="fas fa-bookmark"></i> Usa Bookmarklet
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = document.getElementById('linkzen-save-modal');

  // Gestione input manuale
  document.getElementById('manual-input-btn').addEventListener('click', () => {
    document.getElementById('input-container').style.display = 'block';
    document.getElementById('scanner-container').style.display = 'none';
    document.getElementById('manual-url-input').focus();
  });

  // Gestione scan QR
  document.getElementById('scan-qr-btn').addEventListener('click', () => {
    document.getElementById('input-container').style.display = 'none';
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.style.display = 'block';
    
    const scanner = new Instascan.Scanner({
      video: document.getElementById('qr-scanner'),
      mirror: false
    });
    
    scanner.addListener('scan', function(content) {
      try {
        new URL(content); // Verifica se è un URL valido
        document.getElementById('manual-url-input').value = content;
        document.getElementById('input-container').style.display = 'block';
        scannerContainer.style.display = 'none';
        scanner.stop();
        document.getElementById('manual-title-input').focus();
      } catch(e) {
        alert("QR code non valido. Deve contenere un URL.");
      }
    });
    
    Instascan.Camera.getCameras().then(function(cameras) {
      if (cameras.length > 0) {
        scanner.start(cameras[0]);
      } else {
        alert("Nessuna fotocamera trovata");
        scannerContainer.style.display = 'none';
      }
    });
  });

  // Conferma salvataggio
  document.getElementById('confirm-save-btn').addEventListener('click', async () => {
    const url = document.getElementById('manual-url-input').value.trim();
    const title = document.getElementById('manual-title-input').value.trim() || url;
    
    try {
      new URL(url); // Validazione URL
      
      categorizeByLearnedKeywords(title, url, async (category, isIA) => {
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        const index = visitedUrls.findIndex(item => item.url === url);
        
        if (index === -1) {
          visitedUrls.push({ 
            url, 
            category, 
            originalCategory: category, 
            title 
          });
          await storage.set({
            visitedUrls,
            lastAddedUrl: url,
            highlightColor: "green"
          });
          modal.remove();
          await loadUrls();
        } else {
          await storage.set({
            lastAddedUrl: url,
            highlightColor: "orange"
          });
          modal.remove();
          await loadUrls();
        }
      });
    } catch(e) {
      alert("Inserisci un URL valido (es: https://esempio.com)");
    }
  });

  // Pulsante annulla
  document.getElementById('cancel-input-btn').addEventListener('click', () => {
    modal.remove();
  });

  // Pulsante annulla scan
  document.getElementById('cancel-scan-btn').addEventListener('click', () => {
    modal.remove();
  });

  // Bookmarklet
  document.getElementById('use-bookmarklet-btn').addEventListener('click', () => {
    modal.remove();
    alert(`Per salvare pagine da altre schede:
1. Apri la pagina che vuoi salvare
2. Tocca il bookmarklet "Save to LinkZen"
3. Torna a questa app`);
  });
});

  
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
    new URL(string);
    return true;
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
    del.textContent = "[x]";
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
      remove.textContent = "x";
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
