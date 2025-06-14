// main.js - Versione completa e verificata
'use strict';

// ============================================
// 1. CLASSI E COSTANTI
// ============================================

class DropdownManager {
    constructor() {
        this.dropdowns = [];
        this.initGlobalListener();
    }

    register(dropdownId, triggerId, options = {}) {
        const dropdown = document.getElementById(dropdownId);
        const trigger = document.getElementById(triggerId);
        const ignoreClass = options.ignoreClass || 'no-close';

        if (!dropdown || !trigger) {
            console.error(`Elementi non trovati per dropdown: ${dropdownId}, ${triggerId}`);
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
            e.preventDefault();
            e.stopPropagation();
            handler.toggle();
        });

        this.dropdowns.push(handler);
        return handler;
    }

    initGlobalListener() {
        document.addEventListener('click', (e) => {
            this.dropdowns.forEach(handler => {
                const isClickInside = handler.dropdown.contains(e.target) || 
                                    e.target === handler.trigger ||
                                    (handler.ignoreClass && e.target.closest(`.${handler.ignoreClass}`));

                if (handler.isOpen && !isClickInside) {
                    handler.close();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.dropdowns.forEach(handler => {
                    if (handler.isOpen) handler.close();
                });
            }
        });
    }
}

const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];

// ============================================
// 2. GESTIONE STORAGE
// ============================================

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
                    result[key] = value ? JSON.parse(value) : keys[key];
                });
                resolve(result);
            } catch (error) {
                console.error("Errore nella lettura:", error);
                resolve(keys);
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

// ============================================
// 3. FUNZIONI CORE
// ============================================

function processaBookmarklet() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('bookmarklet')) return null;

        return {
            titolo: decodeURIComponent(params.get('titolo') || ''),
            url: decodeURIComponent(params.get('url') || '')
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
            const text = (title + " " + url).toLowerCase();
            let category = "Other";
            let isIA = false;

            for (const keyword in data.keywordToCategory) {
                if (text.includes(keyword)) {
                    category = data.keywordToCategory[keyword];
                    isIA = true;
                    break;
                }
            }
            callback(category, isIA);
        })
        .catch(error => {
            console.error("Errore nella categorizzazione:", error);
            callback("Other", false);
        });
}

function learnFromManualOverride(entry, newCategory) {
    if (newCategory === "Other") return;

    const titleWords = extractKeywords(entry.title);
    const extraStopwords = ["about", "login", "accedi", "index", "html", "page", "home", "email"];
    const noiseWords = ["product", "video", "media", "main", "category", "default", "online"];
    const combinedStopwords = new Set([...stopwords, ...extraStopwords, ...noiseWords]);

    const filteredWords = titleWords.filter(word => (
        word.length >= 4 &&
        !combinedStopwords.has(word) &&
        !/^\d+$/.test(word)
    ));

    try {
        const hostname = new URL(entry.url).hostname.replace(/^www\./, "");
        if (hostname.length >= 5) {
            filteredWords.unshift(hostname);
        }
    } catch (e) {
        console.error("Errore nell'analisi dell'URL:", e);
    }

    const finalWords = Array.from(new Set(filteredWords)).slice(0, 8);
    if (finalWords.length === 0) return;

    storage.get({ keywordToCategory: {} })
        .then(data => {
            const updatedMap = { ...data.keywordToCategory };
            finalWords.forEach(word => {
                updatedMap[word] = newCategory;
            });
            return storage.set({ keywordToCategory: updatedMap });
        })
        .catch(error => {
            console.error("Errore nell'apprendimento:", error);
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
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 1000);
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
        document.body.style.fontSize = `${scale}em`;
        storage.set({ fontScale: scale });
        
        const box = document.getElementById("ia-knowledge-box");
        if (box) {
            box.style.fontSize = `${scale}em`;
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
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);
    } catch (error) {
        console.error("Errore nell'apertura del link:", error);
        window.open(url, '_blank');
    }
}

// ============================================
// 4. INIZIALIZZAZIONE APPLICAZIONE
// ============================================

let undoData = null;
let undoTimeout = null;
let fontScale = 1;

async function initApp() {
    try {
        // Inizializzazione dropdown
        const dropdownManager = new DropdownManager();
        dropdownManager.register('dropdown-category-list', 'new-category-input', { ignoreClass: 'remove' });
        dropdownManager.register('export-options', 'export-btn');

        // Configurazione tema
        const toggleTheme = document.getElementById("toggle-theme");
        const { darkMode = false, fontScale: savedScale = 1 } = await storage.get({ 
            darkMode: false, 
            fontScale: 1 
        });

        fontScale = savedScale;
        applyFontSize(fontScale);

        if (darkMode) {
            document.body.classList.add("dark");
            if (toggleTheme) toggleTheme.checked = true;
        }

        if (toggleTheme) {
            toggleTheme.addEventListener("change", () => {
                const enabled = toggleTheme.checked;
                document.body.classList.toggle("dark", enabled);
                storage.set({ darkMode: enabled });
            });
        }

        // Configurazione zoom
        document.getElementById("zoom-in")?.addEventListener("click", () => {
            fontScale = Math.min(fontScale + 0.1, 2);
            applyFontSize(fontScale);
        });

        document.getElementById("zoom-out")?.addEventListener("click", () => {
            fontScale = Math.max(fontScale - 0.1, 0.6);
            applyFontSize(fontScale);
        });

        // Processa bookmarklet
        const bookmarkletData = processaBookmarklet();
        if (bookmarkletData?.url) {
            const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
            
            if (!visitedUrls.some(item => item.url === bookmarkletData.url)) {
                categorizeByLearnedKeywords(bookmarkletData.titolo, bookmarkletData.url, async (category) => {
                    visitedUrls.push({
                        url: bookmarkletData.url,
                        title: bookmarkletData.titolo,
                        category: category,
                        originalCategory: category
                    });
                    await storage.set({ visitedUrls });
                    await loadUrls();
                });
            }
        }

        // Caricamento iniziale
        await loadUrls();

    } catch (error) {
        console.error("Errore nell'inizializzazione:", error);
        // Fallback visivo
        document.body.innerHTML = `
            <div style="padding:20px;color:red">
                Errore di inizializzazione. Ricarica la pagina.
                <button onclick="window.location.reload()">Ricarica</button>
            </div>
        `;
    } finally {
        // Mostra l'applicazione
        document.body.style.opacity = '1';
    }
}

// ============================================
// 5. FUNZIONALITÀ PRINCIPALI
// ============================================

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

        // Imposta l'ordinamento
        document.querySelectorAll('input[name="sort"]').forEach(radio => {
            if (radio.value === sortOrder) radio.checked = true;
        });

        // Ordina gli URL
        const urls = [...visitedUrls];
        if (sortOrder === "category") {
            urls.sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other"));
        }

        // Categorie disponibili
        const defaultCategories = [
            "News", "Video", "Finance", "Social", "E-mail", "Store", "Commerce",
            "Productivity", "Entertainment", "Education", "Sports",
            "AI", "Search", "Design", "Weather", "Other"
        ];
        const allCategories = [...defaultCategories, ...userCategories];

        // Genera la lista
        urls.forEach((item, index) => {
            const li = document.createElement("li");
            li.className = "link-row";

            // Highlight per nuovo elemento
            if (item.url === lastAddedUrl) {
                li.style.backgroundColor = highlightColor === "orange" ? "#e67e22" : "#388e3c";
                li.style.transition = "background-color 6s ease";
                setTimeout(() => {
                    li.style.backgroundColor = "transparent";
                }, 100);
            }

            // Dropdown categoria
            const select = document.createElement("select");
            select.className = "category";
            allCategories.forEach(opt => {
                const option = document.createElement("option");
                option.value = opt;
                option.textContent = opt;
                if (opt === item.category) option.selected = true;
                select.appendChild(option);
            });

            select.addEventListener("change", async () => {
                const newCat = select.value;
                const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
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

            appendIATooltipIfNeeded(select, item.category === item.originalCategory);

            // Link principale
            const a = document.createElement("a");
            a.href = item.url;
            a.target = "_blank";
            a.className = clickedUrls.includes(item.url) ? "link clicked" : "link";
            a.style.display = "flex";
            a.style.alignItems = "center";
            a.style.gap = "6px";

            // Favicon
            const favicon = document.createElement("img");
            favicon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${item.url}`;
            favicon.width = 16;
            favicon.height = 16;
            favicon.style.flexShrink = "0";

            // Testo
            const span = document.createElement("span");
            try {
                const hostname = new URL(item.url).hostname.replace(/^www\./, "");
                span.textContent = `${hostname} - ${item.title || ''}`.slice(0, 60) + (item.title?.length > 60 ? '...' : '');
            } catch {
                span.textContent = item.title || item.url;
            }
            span.style.overflow = "hidden";
            span.style.textOverflow = "ellipsis";
            span.style.whiteSpace = "nowrap";

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

            // Pulsante elimina
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
                    const undoBtn = document.getElementById("undo-btn");
                    if (undoBtn) {
                        undoBtn.style.display = "inline-block";
                        clearTimeout(undoTimeout);
                        undoTimeout = setTimeout(() => {
                            undoData = null;
                            undoBtn.style.display = "none";
                            document.getElementById("theme-toggle").style.display = "inline-block";
                        }, 8000);
                    }
                    
                    await storage.set({ visitedUrls });
                    await loadUrls();
                }
            });

            li.appendChild(select);
            li.appendChild(a);
            li.appendChild(del);
            list.appendChild(li);
        });

        // Scroll all'ultimo elemento aggiunto
        if (lastAddedUrl) {
            const lastLink = [...list.children].find(li => 
                li.querySelector("a")?.href === lastAddedUrl
            );
            if (lastLink) lastLink.scrollIntoView({ behavior: "smooth", block: "end" });
            storage.remove("lastAddedUrl");
        }

        // Gestione reset
        const resetBtn = document.getElementById("reset-btn");
        if (resetBtn) {
            if (clickedUrls.length > 0) {
                resetBtn.disabled = false;
                resetBtn.style.color = "black";
                resetBtn.style.backgroundColor = "orange";
                resetBtn.onclick = async () => {
                    await storage.set({ clickedUrls: [] });
                    await loadUrls();
                };
            } else {
                resetBtn.disabled = true;
                resetBtn.style.color = "#666";
                resetBtn.style.backgroundColor = "#ddd";
                resetBtn.onclick = null;
            }
        }

        // Aggiorna dropdown categorie
        const dropdown = document.getElementById("dropdown-category-list");
        if (dropdown) {
            dropdown.innerHTML = "";
            userCategories.forEach((cat) => {
                const row = document.createElement("div");
                row.className = "dropdown-item";
                row.textContent = cat;

                const remove = document.createElement("span");
                remove.className = "remove";
                remove.textContent = "x";
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

// ============================================
// 6. AVVIO APPLICAZIONE
// ============================================

// Gestione undo
document.getElementById("undo-btn")?.addEventListener("click", async () => {
    if (!undoData) return;
    
    const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
    const updated = [...visitedUrls];
    updated.splice(undoData.index, 0, undoData.entry);
    
    await storage.set({ visitedUrls: updated });
    undoData = null;
    document.getElementById("undo-btn").style.display = "none";
    document.getElementById("theme-toggle").style.display = "inline-block";
    clearTimeout(undoTimeout);
    
    await loadUrls();
});

// Gestione aggiunta categoria
document.getElementById("add-category-btn")?.addEventListener("click", async () => {
    const input = document.getElementById("new-category-input");
    const newCategory = input?.value.trim();
    if (!newCategory) return;

    const { userCategories = [] } = await storage.get({ userCategories: [] });
    if (!userCategories.includes(newCategory)) {
        await storage.set({ userCategories: [...userCategories, newCategory] });
        input.value = "";
        await loadUrls();
    }
});

// Export/Import
document.getElementById("export-basic")?.addEventListener("click", async () => {
    const { visitedUrls = [], userCategories = [] } = await storage.get({ 
        visitedUrls: [], 
        userCategories: [] 
    });
    
    const blob = new Blob([JSON.stringify({ visitedUrls, userCategories }, null, 2)], { 
        type: "application/json" 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkzen_export_basic.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
});

document.getElementById("export-full")?.addEventListener("click", async () => {
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
    setTimeout(() => URL.revokeObjectURL(url), 100);
});

document.getElementById("import-btn")?.addEventListener("click", () => {
    document.getElementById("import-file")?.click();
});

document.getElementById("import-file")?.addEventListener("change", async (event) => {
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

// Avvia l'applicazione
document.addEventListener("DOMContentLoaded", initApp);
