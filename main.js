/**
 * LINKZEN BOOKMARK MANAGER
 * 
 * A complete bookmark management solution with:
 * - AI-powered categorization
 * - Cross-device sync
 * - QR code scanning
 * - Bookmarklet support
 * - Dark/light theme
 */

// ============================================
// 1. INITIALIZATION AND CONSTANTS
// ============================================

// Initialize global variables
let undoData = null; // Stores deleted item for undo functionality
let undoTimeout = null; // Timeout reference for undo
let undoBtn, themeToggleWrapper; // DOM element references
let fontScale = 1; // Current font scale factor
let importFileDialogOpen = false; // Flag for import file dialog state

// Common words to ignore when extracting keywords
const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];

// Initialize dark mode if previously enabled
if (localStorage.getItem("darkMode") === "true") {
    document.documentElement.classList.add("dark-ready");
    document.body?.classList?.add("dark");
}

// ============================================
// 2. BOOKMARKLET PROCESSING FUNCTIONS
// ============================================

/**
 * Processes bookmarklet parameters from URL
 * @returns {Object|null} Bookmarklet data or null if not present
 */
function processaBookmarklet() {
    const params = new URLSearchParams(window.location.search);
    if(!params.has('bookmarklet')) return null;
    
    const titolo = decodeURIComponent(params.get('titolo') || '');
    const url = decodeURIComponent(params.get('url') || '');
    
    if(!url) return null;
    
    // Clean URL after reading parameters
    history.replaceState({}, '', window.location.pathname);
    
    return { titolo, url };
}

/**
 * Processes bookmarklet request and adds new link
 */
async function processBookmarkletRequest() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const title = urlParams.get('title');
        const url = urlParams.get('url');
        
        if (!url) return;

        // Clean URL after reading parameters
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
        console.error("Bookmarklet processing error:", e);
    }
}

// ============================================
// 3. STORAGE MANAGEMENT
// ============================================

const storage = {
    /**
     * Saves data to localStorage
     * @param {Object} data Key-value pairs to store
     * @returns {Promise} Resolves when save is complete
     */
    set: (data) => new Promise(resolve => {
        try {
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, JSON.stringify(data[key]));
            });
            resolve();
        } catch (error) {
            console.error("Save error:", error);
            resolve();
        }
    }),
    
    /**
     * Retrieves data from localStorage
     * @param {Object|Array} keys Keys to retrieve with default values
     * @returns {Promise} Resolves with retrieved data
     */
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
            console.error("Read error:", error);
            resolve(keys);
        }
    }),
    
    /**
     * Removes item from localStorage
     * @param {string} key Key to remove
     * @returns {Promise} Resolves when removal is complete
     */
    remove: (key) => new Promise(resolve => {
        localStorage.removeItem(key);
        resolve();
    })
};

// ============================================
// 4. CORE FUNCTIONS
// ============================================

/**
 * Extracts keywords from text
 * @param {string} text Input text
 * @returns {Array} Filtered keywords
 */
function extractKeywords(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(" ")
        .filter(word => word.length > 3 && !stopwords.includes(word));
}

/**
 * Categorizes content based on learned keywords
 * @param {string} title Page title
 * @param {string} url Page URL
 * @param {Function} callback Receives category and AI flag
 */
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

/**
 * Learns from manual category overrides
 * @param {Object} entry Bookmark entry
 * @param {string} newCategory Selected category
 */
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

/**
 * Creates AI indicator tooltip
 * @returns {HTMLElement} Tooltip element
 */
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

/**
 * Appends AI tooltip if needed
 * @param {HTMLElement} container Parent element
 * @param {boolean} isIA Whether to show tooltip
 */
function appendIATooltipIfNeeded(container, isIA) {
    if (isIA) {
        const tooltip = createIATooltip();
        container.appendChild(tooltip);
    }
}

/**
 * Applies font size scaling
 * @param {number} scale Font scale factor
 */
function applyFontSize(scale) {
    document.body.style.fontSize = `${scale}em`;
    storage.set({ fontScale: scale });

    const box = document.getElementById("ia-knowledge-box");
    if (box) {
        box.style.fontSize = `${scale}em`;
    }
}

/**
 * Opens link in Safari-compatible way
 * @param {string} url URL to open
 */
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

/**
 * Validates URL format
 * @param {string} string URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}


// Aggiungere queste funzioni nella sezione 4. CORE FUNCTIONS

/**
 * Abilita il drag & drop per gli elementi della lista
 */
function enableDragAndDrop() {
  const list = document.getElementById("url-list");
  
  list.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("link-row")) {
      e.target.classList.add("dragging");
      e.dataTransfer.setData("text/plain", e.target.dataset.index);
      e.dataTransfer.effectAllowed = "move";
    }
  });
  
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector(".dragging");
    if (!draggingItem) return;
    
    const afterElement = getDragAfterElement(list, e.clientY);
    if (afterElement) {
      list.insertBefore(draggingItem, afterElement);
    } else {
      list.appendChild(draggingItem);
    }
  });
  
  list.addEventListener("dragend", (e) => {
    const draggedItem = document.querySelector(".dragging");
    if (draggedItem) {
      draggedItem.classList.remove("dragging");
      saveCustomOrder();
    }
  });
}

/**
 * Trova la posizione corretta per l'elemento trascinato
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".link-row:not(.dragging)")];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Salva l'ordine personalizzato
 */
async function saveCustomOrder() {
  const list = document.getElementById("url-list");
  const items = [...list.querySelectorAll(".link-row")];
  const customOrder = items.map(item => item.dataset.url);
  
  await storage.set({ customOrder });
  
  // Imposta automaticamente l'ordinamento su "custom"
  document.querySelector('input[value="custom"]').checked = true;
  await storage.set({ sortOrder: "custom" });
}




// ============================================
// 5. MAIN EVENT LISTENERS AND INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    // Process bookmarklet if present in URL
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
    
    // Initialize settings
    const { fontScale: savedScale = 1 } = await storage.get({ fontScale: 1 });
    fontScale = savedScale;
    applyFontSize(fontScale);

    // Get DOM references
    undoBtn = document.getElementById("undo-btn");
    themeToggleWrapper = document.getElementById("theme-toggle");

    // Initialize dark mode toggle
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

    // Zoom controls
    document.getElementById("zoom-in").addEventListener("click", () => {
        fontScale = Math.min(fontScale + 0.1, 2);
        applyFontSize(fontScale);
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
        fontScale = Math.max(fontScale - 0.1, 0.6);
        applyFontSize(fontScale);
    });

    // AI Knowledge Box
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
            box.textContent = "No keywords learned yet.";
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
                            box.textContent = "No keywords learned yet.";
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

    // Export functionality
    const exportBtn = document.getElementById("export-btn");
    const exportDefault = document.getElementById("export-default");
    const exportOptions = document.getElementById("export-options");

    exportBtn.addEventListener("click", (e) => {
        exportDefault.style.display = "none";
        exportOptions.classList.remove("hidden");
        e.stopPropagation();
    });

    // Close export/import menus when clicking outside
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

    // Basic export (links only)
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

    // Full export (links + learned keywords)
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

    // Import functionality
    const importBtn = document.getElementById("import-btn");
    const importDefault = document.getElementById("import-default");
    const importOptions = document.getElementById("import-options");

    importBtn.addEventListener("click", (e) => {
        importDefault.style.display = "none";
        importOptions.classList.remove("hidden");
        e.stopPropagation();
    });

    // Custom file import
    document.getElementById("import-custom").addEventListener("click", () => {
        importFileDialogOpen = true;
        document.getElementById("import-file").click();
    });

    const importFileInput = document.getElementById("import-file");

    importFileInput.addEventListener("change", async (event) => {
        importFileDialogOpen = false;
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
                    alert("Invalid file. No link list found.");
                }
            } catch (err) {
                alert("File error: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Handle file dialog cancel
    importFileInput.addEventListener("blur", () => {
        importFileDialogOpen = false;
    });

    // Default config import
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
                await loadUrls();
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

    // Category management
    const input = document.getElementById("new-category-input");
    const dropdown = document.getElementById("dropdown-category-list");

    /**
     * Loads categories into dropdown
     */
    async function loadDropdownCategories() {
        const { userCategories = [] } = await storage.get({ userCategories: [] });
        dropdown.innerHTML = "";
        
        userCategories.forEach((cat) => {
            const row = document.createElement("div");
            row.className = "dropdown-item";
            
            // Category name
            const nameSpan = document.createElement("span");
            nameSpan.textContent = cat;
            row.appendChild(nameSpan);
            
            // Delete button [x]
            const remove = document.createElement("span");
            remove.innerHTML = "<span style='margin-left: 6px; color: red; cursor: pointer'>[x]</span>";
            remove.className = "remove";
            remove.title = "Delete category";
            row.appendChild(remove);
            
            dropdown.appendChild(row);
        });
    }

    // Add new category
    document.getElementById("add-category-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        const newCategory = input.value.trim();
        if (!newCategory) return;
        
        const { userCategories = [] } = await storage.get({ userCategories: [] });
        if (!userCategories.includes(newCategory)) {
            const updated = [...userCategories, newCategory];
            await storage.set({ userCategories: updated });
            input.value = "";
            await loadDropdownCategories();
            input.focus();
        }
    });

    // Show dropdown on focus
    input.addEventListener("focus", async () => {
        dropdown.classList.remove("hidden");
        await loadDropdownCategories();
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
        if (!input || !dropdown) return;

        const clickedRemove = event.target.closest(".remove");
        const clickedInside = input.contains(event.target) || dropdown.contains(event.target);
        
        if (clickedInside && !clickedRemove) {
            return;
        }
        dropdown.classList.add("hidden");
    });

    // Handle category deletion
    dropdown.addEventListener("click", async (event) => {
        const removeBtn = event.target.closest(".remove");
        if (!removeBtn) return;
        
        event.stopPropagation();
        
        const catRow = removeBtn.closest(".dropdown-item");
        const cat = catRow.firstChild.textContent.trim();
        
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
        
    // Undo functionality
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

    // Reset clicked links
    document.getElementById("reset-btn").addEventListener("click", async () => {
        await storage.set({ clickedUrls: [] });
        await loadUrls();
    });

    // Sort functionality
    document.querySelectorAll('input[name="sort"]').forEach(radio => {
        radio.addEventListener("change", async () => {
            await storage.set({ sortOrder: radio.value });
            await loadUrls();
        });
    });

    // Save button functionality
    document.getElementById("save-btn").addEventListener("click", async function() {
        try {
            // Show save options dialog
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
                    showAlert("Success", "QR code scanned successfully!");
                }
            }
        } catch (error) {
            console.error("Save error:", error);
            showAlert("Error", "Failed to save: " + error.message);
        }
    });

    // Initial load
    await loadUrls();
});

// ============================================
// 6. SAVE LINK FUNCTIONS
// ============================================

/**
 * Shows save options dialog
 * @returns {Promise<string>} User's choice
 */
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
        
        // Button color scheme
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
            <!-- Dialog content with styled buttons -->
            <div style="background: ${bgColor}; color: ${textColor}; padding: 24px; border-radius: 12px; width: 90%; max-width: 320px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border: 1px solid ${borderColor}; transform: translateY(20px); transition: transform 0.3s ease;">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; color: ${isDark ? '#a0aec0' : '#4a5568'};">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save Link
                </h3>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Manual entry button -->
                    <button data-choice="manual" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; background: ${buttonColors.manual.bg}; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);">
                        <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${buttonColors.manual.icon}" stroke-width="2">
                                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                                <path d="M2 2l7.586 7.586"></path>
                                <circle cx="11" cy="11" r="2"></circle>
                            </svg>
                        </div>
                        <span>Enter Manually</span>
                    </button>
                    
                    <!-- QR scan button -->
                    <button data-choice="qr" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; background: ${buttonColors.qr.bg}; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);">
                        <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${buttonColors.qr.icon}" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </div>
                        <span>Scan QR Code</span>
                    </button>
                    
                    <!-- Bookmarklet button -->
                    <button data-choice="bookmarklet" style="display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; background: ${buttonColors.bookmarklet.bg}; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);">
                        <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
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
        
        // Animate in
        setTimeout(() => {
            dialog.style.opacity = "1";
            dialog.querySelector("div").style.transform = "translateY(0)";
        }, 10);
        
        // Add hover effects
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
        
        // Handle option selection
        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                // Animate out
                dialog.style.opacity = "0";
                dialog.querySelector("div").style.transform = "translateY(20px)";
                
                setTimeout(() => {
                    document.body.removeChild(dialog);
                    resolve(btn.dataset.choice);
                }, 300);
            });
        });
        
        // Close when clicking outside
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
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

/**
 * Scans QR code using camera
 * @returns {Promise<Object|null>} Scanned data or null
 */
async function scanQRCode() {
    // Load jsQR library if not present
    if (!window.jsQR) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Create scanner interface
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
            <p>Point your camera at the QR code</p>
        </div>
        <div style="position:absolute;bottom:20px;left:0;right:0;text-align:center">
            <button id="cancel-scan" style="padding:12px 24px;background:#f44336;color:white;border:none;border-radius:20px">Cancel</button>
        </div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%); width:70%;height:200px;border:4px dashed rgba(255,255,255,0.7);pointer-events:none"></div>
    `;

    document.body.appendChild(scannerDiv);
    const video = scannerDiv.querySelector('video');
    const cancelBtn = scannerDiv.querySelector('#cancel-scan');

    try {
        // Configure camera
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        
        // Create canvas for analysis
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        return new Promise((resolve) => {
            let scanActive = true;
            
            // Scan function
            const scanFrame = () => {
                if (!scanActive) return;
                
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
                            
                            // Add haptic feedback
                            if (navigator.vibrate) {
                                navigator.vibrate([100, 30, 100]);
                            }
                            
                            // Add visual feedback
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

                            // Verify if it's a valid URL
                            const isUrl = isValidUrl(code.data);
                            
                            // Close after short delay
                            setTimeout(() => {
                                stream.getTracks().forEach(track => track.stop());
                                document.body.removeChild(scannerDiv);
                                
                                if (isUrl) {
                                    resolve({ url: code.data, title: "Scanned QR Code" });
                                } else {
                                    showQRContentDialog(code.data);
                                    resolve(null);
                                }
                            }, 500);
                            return;
                        }
                    }
                    
                    if (scanActive) requestAnimationFrame(scanFrame);
                } catch (error) {
                    console.error("Scan error:", error);
                }
            };
            
            // Start scanning
            video.onplaying = () => scanFrame();
            
            // Handle cancel
            cancelBtn.addEventListener('click', () => {
                scanActive = false;
                stream.getTracks().forEach(track => track.stop());
                document.body.removeChild(scannerDiv);
                resolve(null);
            });
        });
        
    } catch (error) {
        document.body.removeChild(scannerDiv);
        showAlert("Camera Error", "Could not access camera: " + error.message);
        return null;
    }
}

/**
 * Shows dialog with QR code content
 * @param {string} content QR code content
 */
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
        <div style="background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 8px; width: 100%; max-width: 400px; max-height: 80vh; overflow: auto; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h3 style="margin-top:0;color:#ffffff">QR Code Content</h3>
            <div style="padding: 12px; background: #4a5568; border-radius: 4px; word-break: break-all; font-family: monospace; color: #f7fafc;">
                ${content}
            </div>
            <div style="display:flex;gap:10px;margin-top:15px">
                <button id="copy-content-btn" style="padding: 8px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; flex-grow:1;">
                    Copy to Clipboard
                </button>
                <button style="padding: 8px 12px; background: #2b6cb0; color: white; border: none; border-radius: 4px; flex-grow:1;">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add copy functionality
    dialog.querySelector("#copy-content-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(content).then(() => {
            const btn = dialog.querySelector("#copy-content-btn");
            btn.textContent = "✓ Copied!";
            btn.style.backgroundColor = "#388E3C";
            setTimeout(() => {
                btn.textContent = "Copy to Clipboard";
                btn.style.backgroundColor = "#4CAF50";
            }, 2000);
        });
    });
    
    // Close on button click
    dialog.querySelector("button:not(#copy-content-btn)").addEventListener("click", () => {
        document.body.removeChild(dialog);
    });
}

/**
 * Processes new link addition
 * @param {string} url URL to add
 * @param {string} title Title for the link
 */
async function processNewLink(url, title) {
    if (!url) throw new Error("No URL provided");
    
    if (!isValidUrl(url)) {
        throw new Error("Invalid URL format");
    }
    
    const mockTab = { url, title: title || url };
    
    try {
        const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
        const existingIndex = visitedUrls.findIndex(item => item.url === mockTab.url);
        
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
                
                await loadUrls();
                resolve();
            });
        });
    } catch (error) {
        console.error("Error saving link:", error);
        throw error;
    }
}

/**
 * Shows bookmarklet installation instructions
 */
function showBookmarkletInstructions() {
    // Generate bookmarklet URL
    const getBaseUrl = () => {
        const url = new URL(window.location.href);
        return `${url.origin}${url.pathname.split('/').slice(0, 2).join('/')}/`;
    };

    // Create bookmarklet code
    const rawBookmarklet = `javascript:(function(){
        var titolo=encodeURIComponent(document.title);
        var url=encodeURIComponent(window.location.href);
        window.location.href='${getBaseUrl()}?bookmarklet&titolo='+titolo+'&url='+url;
    })();`;

    // Encode for HTML display
    const bookmarkletCode = rawBookmarklet
        .replace(/ /g, '%20')
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');

    // Show instructions with copy button
    showAlert("How to Use Bookmarklet", `
        1. Copy this code:<br><br>
        <code id="bookmarklet-code" style="background:#4A5568; padding:10px; border-radius:6px; color:#F7FAFC; display:block; margin:10px 0; font-family:monospace; word-break:break-all; border:1px solid #718096; user-select:all; -webkit-user-select:all;">
            ${bookmarkletCode}
        </code>
        
        <button onclick="
            navigator.clipboard.writeText(document.getElementById('bookmarklet-code').innerText);
            this.textContent = '✓ Copied!';
            setTimeout(() => this.textContent = 'Copy Code', 2000);
        " style="padding:8px 16px; background:#4CAF50; color:white; border:none; border-radius:4px; font-size:14px; cursor:pointer; margin-top:5px;">
            Copy Code
        </button><br>
        
        2. Create a new bookmark in Safari<br>
        3. Paste as URL<br>
        4. Use from any page by tapping the bookmark
    `, true);
}

/**
 * Shows manual input dialog for adding links
 * @returns {Promise<Object|null>} URL and title or null
 */
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
            <div style="background: ${bgColor}; color: ${textColor}; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border: 1px solid ${borderColor}; transform: translateY(20px); transition: transform 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: ${accentColor}20; display: flex; align-items: center; justify-content: center;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2">
                            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
                            <path d="M2 2l7.586 7.586"></path>
                            <circle cx="11" cy="11" r="2"></circle>
                        </svg>
                    </div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: ${textColor};">
                        Add Link Manually
                    </h3>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: ${isDark ? '#a0aec0' : '#4a5568'};">
                        URL
                    </label>
                    <input type="url" id="manual-url" placeholder="https://example.com" 
                            style="width: 100%; padding: 12px 14px; font-size: 14px; background: ${inputBg}; color: ${inputText}; border: 1px solid ${borderColor}; border-radius: 8px; outline: none; transition: all 0.2s ease;"
                            required>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 14px; font-weight: 500; color: ${isDark ? '#a0aec0' : '#4a5568'};">
                        Title (optional)
                    </label>
                    <input type="text" id="manual-title" placeholder="My Awesome Website" 
                            style="width: 100%; padding: 12px 14px; font-size: 14px; background: ${inputBg}; color: ${inputText}; border: 1px solid ${borderColor}; border-radius: 8px; outline: none; transition: all 0.2s ease;">
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="manual-cancel" style="padding: 10px 16px; font-size: 14px; font-weight: 500; background: transparent; color: ${isDark ? '#a0aec0' : '#718096'}; border: 1px solid ${borderColor}; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">
                        Cancel
                    </button>
                    <button id="manual-confirm" style="padding: 10px 20px; font-size: 14px; font-weight: 500; background: ${accentColor}; color: white; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1);">
                        Save Link
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Animate in
        setTimeout(() => {
            dialog.style.opacity = "1";
            dialog.querySelector("div").style.transform = "translateY(0)";
            document.getElementById("manual-url").focus();
        }, 10);

        // Add hover effects
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
                // Show validation error
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
            
            // Animate out
            dialog.style.opacity = "0";
            dialog.querySelector("div").style.transform = "translateY(20px)";
            setTimeout(() => {
                document.body.removeChild(dialog);
            }, 300);
        };

        confirmBtn.addEventListener("click", confirm);
        
        // Confirm on Enter key
        dialog.querySelector("#manual-url").addEventListener("keypress", (e) => {
            if (e.key === "Enter") confirm();
        });
        dialog.querySelector("#manual-title").addEventListener("keypress", (e) => {
            if (e.key === "Enter") confirm();
        });

        cancelBtn.addEventListener("click", () => {
            // Animate out
            dialog.style.opacity = "0";
            dialog.querySelector("div").style.transform = "translateY(20px)";
            setTimeout(() => {
                document.body.removeChild(dialog);
                resolve(null);
            }, 300);
        });

        // Close when clicking outside
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
                // Animate out
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

/**
 * Shows alert dialog
 * @param {string} title Alert title
 * @param {string} message Alert message
 * @param {boolean} showCopyButton Whether to show copy button
 * @returns {Function} Close function
 */
function showAlert(title, message, showCopyButton = false) {
    const alertDiv = document.createElement("div");
    const overlay = document.createElement("div");
    
    // Create semi-transparent overlay
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
    overlay.style.zIndex = "1000";
    overlay.style.backdropFilter = "blur(2px)";
    
    // Style main container
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

    // Close button (X in top right)
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

    // Inner content
    alertDiv.innerHTML = `
        <h4 style="margin:0 25px 12px 0; font-size:18px; color:#FFFFFF; font-weight:600">${title}</h4>
        <div style="font-size:15px; line-height:1.5; color:#E2E8F0">${message}</div>
    `;

    // Close function
    const closeAlert = () => {
        document.body.removeChild(overlay);
        document.body.removeChild(alertDiv);
    };

    // Handle close
    closeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAlert();
    });

    // Close when clicking outside
    overlay.addEventListener("click", closeAlert);
    
    // Prevent closing when clicking the alert itself
    alertDiv.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Add elements to DOM
    document.body.appendChild(overlay);
    alertDiv.appendChild(closeButton);
    document.body.appendChild(alertDiv);

    // Return close function for external control
    return closeAlert;
}

// ============================================
// 7. CORE BOOKMARK FUNCTIONS
// ============================================

/**
 * Saves link to storage
 * @param {string} url URL to save
 * @param {string} title Title for the URL
 * @returns {Promise} Resolves when save is complete
 */
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

/**
 * Saves current tab as bookmark
 */
async function saveCurrentTab() {
    try {
        const mockTab = {
            url: window.location.href,
            title: document.title || ""
        };
        await saveLink(mockTab.url, mockTab.title);
    } catch (err) {
        console.error("Save error:", err);
        alert("Error during save");
    }
}

// ============================================
// 8. MAIN URL LOADING FUNCTION
// ============================================

/**
 * Loads and displays bookmarks from storage
 */
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

    // Set current sort order
    document.querySelectorAll('input[name="sort"]').forEach(radio => {
        radio.checked = (radio.value === sortOrder);
    });

    // Sort URLs if needed
    const urls = [...visitedUrls];
    if (sortOrder === "category") {
        urls.sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other"));
    }

    // Define categories
    const defaultCategories = [
        "News", "Video", "Finance", "Social", "E-mail", "Store", "Commerce",
        "Productivity", "Entertainment", "Education", "Sports",
        "AI", "Search", "Design", "Weather", "Other"
    ];
    const allCategories = [...defaultCategories, ...userCategories];

    // Create list items for each URL
    urls.forEach((item, index) => {
        const url = item.url;
        const currentCategory = item.category;
        const title = item.title || "";

        const li = document.createElement("li");
        li.className = "link-row";

        // Highlight newly added items
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

        // Create category dropdown
        const select = document.createElement("select");
        select.className = "category";
        allCategories.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt;
            option.textContent = opt;
            if (opt === currentCategory) option.selected = true;
            select.appendChild(option);
        });

        // Handle category changes
        select.addEventListener("change", async () => {
            const newCat = select.value;
            const { visitedUrls = [], userCategories = [] } = await storage.get({ visitedUrls: [], userCategories: [] });
            const idx = visitedUrls.findIndex(i => i.url === item.url);
            if (idx !== -1) {
                visitedUrls[idx].category = newCat;

                // Learn from manual overrides of default categories
                if (defaultCategories.includes(newCat)) {
                    learnFromManualOverride(visitedUrls[idx], newCat);
                }

                await storage.set({ visitedUrls });
                await loadUrls();
            }
        });

        // Add AI indicator if needed
        appendIATooltipIfNeeded(select, currentCategory === item.originalCategory);

        // Create link element
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.className = clickedUrls.includes(url) ? "link clicked" : "link";
        a.title = `[${currentCategory}] ${url}`;
        a.style.display = "flex";
        a.style.alignItems = "center";
        a.style.gap = "6px";

        // Add favicon
        const favicon = document.createElement("img");
        favicon.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${url}`;
        favicon.width = 16;
        favicon.height = 16;
        favicon.style.flexShrink = "0";

        // Create combined hostname + title text
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

        // Handle link clicks
        a.addEventListener("click", (e) => {
            e.preventDefault();
            openLinkSafari(url);
            
            // Mark as clicked if not already
            if (!clickedUrls.includes(url)) {
                const newClickedUrls = [...clickedUrls, url];
                storage.set({ clickedUrls: newClickedUrls }).then(loadUrls);
            }
        });

        // Create delete button
        const del = document.createElement("button");
        del.textContent = "[x]";
        del.className = "delete-btn";
        del.addEventListener("click", async () => {
            const { visitedUrls = [] } = await storage.get({ visitedUrls: [] });
            const indexToDelete = visitedUrls.findIndex(entry => entry.url === url);
            if (indexToDelete !== -1) {
                const removed = visitedUrls.splice(indexToDelete, 1)[0];
                undoData = { entry: removed, index: indexToDelete };

                // Show undo button
                themeToggleWrapper.style.display = "none";
                undoBtn.style.display = "inline-block";

                // Set undo timeout
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

        // Assemble list item
        li.appendChild(select);
        li.appendChild(a);
        li.appendChild(del);
        list.appendChild(li);
    });

    // Scroll to last added item if exists
    if (lastAddedUrl) {
        const lastLink = Array.from(list.children).find(li =>
            li.querySelector("a")?.href === lastAddedUrl
        );
        if (lastLink) {
            lastLink.scrollIntoView({ behavior: "smooth", block: "end" });
        }
        storage.remove("lastAddedUrl");
    }

    // Easter egg for specific user in dark mode
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

    // Update reset button state
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

    // Update category dropdown
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
