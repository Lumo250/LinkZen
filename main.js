// main.js - Versione completa e verificata
'use strict';

// 1. GESTIONE DROPDOWN (NUOVA VERSIONE ROBUSTA)
class DropdownManager {
  constructor() {
    this.dropdowns = [];
    document.addEventListener('click', this.handleGlobalClick.bind(this));
  }

  register(dropdownId, triggerId, ignoreClass = 'no-close') {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    
    if (!dropdown || !trigger) {
      console.error(`Elemento non trovato: ${dropdownId} o ${triggerId}`);
      return null;
    }

    const handler = {
      dropdown,
      trigger,
      ignoreClass,
      isOpen: false,
      toggle: function() {
        this.isOpen ? this.close() : this.open();
      },
      open: function() {
        this.dropdown.classList.remove('hidden');
        this.isOpen = true;
      },
      close: function() {
        this.dropdown.classList.add('hidden');
        this.isOpen = false;
      }
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      handler.toggle();
    });

    dropdown.addEventListener('click', (e) => {
      if (e.target.classList.contains(ignoreClass)) {
        e.stopPropagation();
      }
    });

    this.dropdowns.push(handler);
    return handler;
  }

  handleGlobalClick(e) {
    this.dropdowns.forEach(handler => {
      if (!handler.isOpen) return;
      
      const isClickInside = handler.dropdown.contains(e.target) || 
                          e.target === handler.trigger ||
                          (handler.ignoreClass && e.target.closest(`.${handler.ignoreClass}`));
      
      if (!isClickInside) {
        handler.close();
      }
    });
  }
}

// 2. GESTIONE STORAGE
const storage = {
  set: function(data) {
    return new Promise((resolve) => {
      try {
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, JSON.stringify(data[key]));
        });
        resolve(true);
      } catch (error) {
        console.error("Errore nel salvataggio:", error);
        resolve(false);
      }
    });
  },
  
  get: function(keys) {
    return new Promise((resolve) => {
      try {
        const result = {};
        const keysToGet = Array.isArray(keys) ? keys : Object.keys(keys);
        
        keysToGet.forEach(key => {
          const value = localStorage.getItem(key);
          result[key] = value ? JSON.parse(value) : (Array.isArray(keys) ? null : keys[key];
        });
        resolve(result);
      } catch (error) {
        console.error("Errore nella lettura:", error);
        resolve(Array.isArray(keys) ? {} : keys);
      }
    });
  },
  
  remove: function(key) {
    return new Promise((resolve) => {
      localStorage.removeItem(key);
      resolve(true);
    });
  }
};

// 3. COSTANTI GLOBALI
const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];
let undoData = null;
let undoTimeout = null;
let fontScale = 1;

// 4. FUNZIONI DI UTILITÀ
function processaBookmarklet() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('bookmarklet')) return null;
    
    return {
      titolo: decodeURIComponent(params.get('titolo') || '',
      url: decodeURIComponent(params.get('url') || ''
    };
  } catch (error) {
    console.error("Errore nel processare il bookmarklet:", error);
    return null;
  }
}

function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(word => word.length > 3 && !stopwords.includes(word));
}

function categorizeByLearnedKeywords(title, url, callback) {
  storage.get({ keywordToCategory: {} })
    .then((data) => {
      try {
        const text = (title + " " + url).toLowerCase();
        for (const keyword in data.keywordToCategory) {
          if (text.includes(keyword)) {
            callback(data.keywordToCategory[keyword], true);
            return;
          }
        }
        callback("Other", false);
      } catch (error) {
        console.error("Errore nella categorizzazione:", error);
        callback("Other", false);
      }
    });
}

function createIATooltip() {
  const tooltip = document.createElement("span");
  tooltip.textContent = "IA";
  tooltip.style.cssText = `
    background: #ccc;
    color: #333;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 4px;
    margin-left: 6px;
    opacity: 1;
    transition: opacity 0.5s ease;
  `;
  
  setTimeout(() => {
    tooltip.style.opacity = "0";
    setTimeout(() => tooltip.remove(), 1000);
  }, 3000);
  
  return tooltip;
}

function appendIATooltipIfNeeded(container, isIA) {
  if (isIA && container) {
    const tooltip = createIATooltip();
    container.appendChild(tooltip);
  }
}

function applyFontSize(scale) {
  try {
    fontScale = Math.max(0.6, Math.min(scale, 2));
    document.body.style.fontSize = `${fontScale}em`;
    storage.set({ fontScale });
    
    const box = document.getElementById("ia-knowledge-box");
    if (box) {
      box.style.fontSize = `${fontScale}em`;
    }
  } catch (error) {
    console.error("Errore nell'applicare la dimensione del font:", error);
  }
}

function openLinkSafari(url) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  } catch (error) {
    console.error("Errore nell'apertura del link:", error);
    window.open(url, '_blank');
  }
}

// 5. FUNZIONI PRINCIPALI
async function loadUrls() {
  try {
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
    if (!list) return;
    
    list.innerHTML = "";

    // Gestione ordinamento
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

    // Renderizzazione URL
    urls.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "link-row";

      if (item.url === lastAddedUrl) {
        const color = highlightColor === "orange" ? "#e67e22" : "#388e3c";
        li.style.backgroundColor = color;
        li.style.transition = "background-color 6s ease";
        void li.offsetWidth;
        setTimeout(() => {
          li.style.backgroundColor = "transparent";
        }, 100);
      }

      // Creazione elementi DOM per ogni URL
      const select = document.createElement("select");
      select.className = "category";
      
      allCategories.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if (opt === (item.category || "Other")) option.selected = true;
        select.appendChild(option);
      });

      select.addEventListener("change", async () => {
        const newCat = select.value;
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        const idx = visitedUrls.findIndex(i => i.url === item.url);
        
        if (idx !== -1) {
          visitedUrls[idx].category = newCat;
          await storage.set({ visitedUrls });
          await loadUrls();
        }
      });

      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.className = clickedUrls.includes(item.url) ? "link clicked" : "link";
      a.title = `[${item.category}] ${item.url}`;
      a.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      const favicon = document.createElement("img");
      favicon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${item.url}`;
      favicon.width = 16;
      favicon.height = 16;
      favicon.style.flexShrink = "0";

      const hostname = new URL(item.url).hostname.replace(/^www\./, "");
      const combined = hostname + " - " + (item.title || "");
      const shortText = combined.length > 60 ? combined.slice(0, 57) + "..." : combined;

      const span = document.createElement("span");
      span.textContent = shortText;
      span.style.cssText = `
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex-grow: 1;
      `;

      a.appendChild(favicon);
      a.appendChild(span);

      a.addEventListener("click", (e) => {
        e.preventDefault();
        openLinkSafari(item.url);
        
        if (!clickedUrls.includes(item.url)) {
          storage.set({ clickedUrls: [...clickedUrls, item.url] })
            .then(loadUrls);
        }
      });

      const del = document.createElement("button");
      del.textContent = "X";
      del.className = "delete-btn";
      del.addEventListener("click", async () => {
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        const indexToDelete = visitedUrls.findIndex(entry => entry.url === item.url);
        
        if (indexToDelete !== -1) {
          const removed = visitedUrls.splice(indexToDelete, 1)[0];
          undoData = { entry: removed, index: indexToDelete };
          
          document.getElementById("theme-toggle").style.display = "none";
          document.getElementById("undo-btn").style.display = "inline-block";
          
          clearTimeout(undoTimeout);
          undoTimeout = setTimeout(() => {
            undoData = null;
            document.getElementById("undo-btn").style.display = "none";
            document.getElementById("theme-toggle").style.display = "inline-block";
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

    // Gestione ultimo URL aggiunto
    if (lastAddedUrl) {
      storage.remove("lastAddedUrl");
    }

    // Gestione reset button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
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
    }

    // Gestione dropdown categorie
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
        remove.style.cssText = `
          margin-left: 6px;
          cursor: pointer;
          color: red;
        `;

        remove.addEventListener("click", async (e) => {
          e.stopPropagation();
          const updatedUserCats = userCategories.filter(c => c !== cat);
          const updatedUrls = visitedUrls.map(link => ({
            ...link,
            category: link.category === cat ? (link.originalCategory || "Other") : link.category
          }));

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

  } catch (error) {
    console.error("Errore nel caricamento degli URL:", error);
  }
}

// 6. INIZIALIZZAZIONE DELL'APP
async function initApp() {
  try {
    // Inizializza dropdown manager
    const dropdownManager = new DropdownManager();
    dropdownManager.register('dropdown-category-list', 'new-category-input', 'remove');
    dropdownManager.register('export-options', 'export-btn');

    // Configurazione tema
    const toggleTheme = document.getElementById("toggle-theme");
    if (toggleTheme) {
      const { darkMode = false } = await storage.get({ darkMode: false });
      document.body.classList.toggle("dark", darkMode);
      toggleTheme.checked = darkMode;

      toggleTheme.addEventListener("change", () => {
        const enabled = toggleTheme.checked;
        document.body.classList.toggle("dark", enabled);
        storage.set({ darkMode: enabled });
      });
    }

    // Configurazione zoom
    document.getElementById("zoom-in")?.addEventListener("click", () => {
      applyFontSize(Math.min(fontScale + 0.1, 2));
    });

    document.getElementById("zoom-out")?.addEventListener("click", () => {
      applyFontSize(Math.max(fontScale - 0.1, 0.6));
    });

    // Caricamento iniziale
    const { fontScale: savedScale = 1 } = await storage.get({ fontScale: 1 });
    applyFontSize(savedScale);

    // Processa bookmarklet se presente
    const bookmarkletData = processaBookmarklet();
    if (bookmarkletData?.url) {
      const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
      
      if (!visitedUrls.some(item => item.url === bookmarkletData.url)) {
        categorizeByLearnedKeywords(bookmarkletData.titolo, bookmarkletData.url, async (category) => {
          await storage.set({
            visitedUrls: [
              ...visitedUrls,
              {
                url: bookmarkletData.url,
                title: bookmarkletData.titolo,
                category: category,
                originalCategory: category
              }
            ]
          });
          await loadUrls();
        });
      }
    }

    // Mostra l'interfaccia
    document.body.style.opacity = '1';
    await loadUrls();

  } catch (error) {
    console.error("Errore nell'inizializzazione dell'app:", error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Errore di caricamento</h2>
        <p>${error.message}</p>
        <button onclick="window.location.reload()">Ricarica</button>
      </div>
    `;
  }
}

// 7. AVVIO DELL'APPLICAZIONE
document.addEventListener("DOMContentLoaded", () => {
  // Nascondi l'interfaccia durante il caricamento
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.3s ease';
  
  // Avvia l'app
  setTimeout(initApp, 50);
});

// Gestione errori non catturati
window.addEventListener('error', (event) => {
  console.error("Errore non catturato:", event.error);
  document.body.style.opacity = '1';
});
