// main.js - Versione completa con supporto bookmarklet per Safari iOS

// ============================================
// 1. INIZIALIZZAZIONE E COSTANTI
// ============================================

let undoData = null;
let undoTimeout = null;
let undoBtn, themeToggleWrapper;
let fontScale = 1;
let importFileDialogOpen = false;

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
// 3. FUNZIONI CORE
// ============================================

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

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// ============================================
// 4. FUNZIONI UI
// ============================================

async function showSaveOptionsDialog() {
  return new Promise((resolve) => {
    const template = document.getElementById('save-options-dialog-template');
    const clone = document.importNode(template.content, true);
    const dialog = clone.querySelector('.dialog-overlay');
    
    document.body.appendChild(clone);
    
    // Animazione di entrata
    setTimeout(() => {
      dialog.style.opacity = "1";
      dialog.querySelector(".dialog-container").style.transform = "translateY(0)";
    }, 10);

    // Gestione click sulle opzioni
    dialog.querySelectorAll("button[data-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        // Animazione di uscita
        dialog.style.opacity = "0";
        dialog.querySelector(".dialog-container").style.transform = "translateY(20px)";
        
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(btn.dataset.choice);
        }, 300);
      });
    });

    // Chiudi al click fuori dal dialog
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.style.opacity = "0";
        dialog.querySelector(".dialog-container").style.transform = "translateY(20px)";
        
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(null);
        }, 300);
      }
    });
  });
}

async function showManualInputDialog() {
  return new Promise((resolve) => {
    const template = document.getElementById('manual-input-dialog-template');
    const clone = document.importNode(template.content, true);
    const dialog = clone.querySelector('.dialog-overlay');
    const urlInput = clone.querySelector('#manual-url');
    const titleInput = clone.querySelector('#manual-title');
    
    document.body.appendChild(clone);
    
    // Animazione di entrata
    setTimeout(() => {
      dialog.style.opacity = "1";
      dialog.querySelector(".dialog-container").style.transform = "translateY(0)";
      urlInput.focus();
    }, 10);

    const confirm = () => {
      const url = urlInput.value.trim();
      if (!url) {
        urlInput.style.borderColor = "#e53e3e";
        urlInput.style.boxShadow = "0 0 0 2px rgba(229, 62, 62, 0.2)";
        setTimeout(() => {
          urlInput.style.borderColor = "#e2e8f0";
          urlInput.style.boxShadow = "none";
        }, 1000);
        return;
      }
      
      resolve({
        url: url,
        title: titleInput.value.trim() || url
      });
      
      // Animazione di uscita
      dialog.style.opacity = "0";
      dialog.querySelector(".dialog-container").style.transform = "translateY(20px)";
      setTimeout(() => {
        document.body.removeChild(dialog);
      }, 300);
    };

    clone.querySelector("#manual-confirm").addEventListener("click", confirm);
    
    // Conferma con Enter
    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") confirm();
    });
    titleInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") confirm();
    });

    clone.querySelector("#manual-cancel").addEventListener("click", () => {
      dialog.style.opacity = "0";
      dialog.querySelector(".dialog-container").style.transform = "translateY(20px)";
      setTimeout(() => {
        document.body.removeChild(dialog);
        resolve(null);
      }, 300);
    });

    // Chiudi al click fuori dal dialog
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.style.opacity = "0";
        dialog.querySelector(".dialog-container").style.transform = "translateY(20px)";
        setTimeout(() => {
          document.body.removeChild(dialog);
          resolve(null);
        }, 300);
      }
    });
  });
}

async function scanQRCode() {
  // Carica jsQR dinamicamente se necessario
  if (!window.jsQR) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  return new Promise((resolve) => {
    const template = document.getElementById('qr-scanner-template');
    const clone = document.importNode(template.content, true);
    const scanner = clone.querySelector('.qr-scanner');
    const video = scanner.querySelector('video');
    const cancelBtn = scanner.querySelector('#cancel-scan');
    
    document.body.appendChild(clone);
    
    let scanActive = true;

    const scanFrame = () => {
      if (!scanActive) return;
      
      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
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
            
            if (navigator.vibrate) {
              navigator.vibrate([100, 30, 100]);
            }
            
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
            scanner.appendChild(feedbackDiv);

            const isUrl = isValidUrl(code.data);
            
            setTimeout(() => {
              if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
              }
              document.body.removeChild(scanner);
              
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

    // Configura la camera
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }).then(stream => {
      video.srcObject = stream;
      video.onplaying = scanFrame;
    }).catch(error => {
      document.body.removeChild(scanner);
      showAlert("Camera Error", "Could not access camera: " + error.message);
      resolve(null);
    });

    cancelBtn.addEventListener('click', () => {
      scanActive = false;
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      document.body.removeChild(scanner);
      resolve(null);
    });
  });
}

function showQRContentDialog(content) {
  const template = document.getElementById('alert-template');
  const clone = document.importNode(template.content, true);
  const alertDiv = clone.querySelector('.custom-alert');
  
  alertDiv.querySelector('h4').textContent = 'QR Code Content';
  alertDiv.querySelector('div').textContent = content;
  
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy to Clipboard';
  copyBtn.style.cssText = 'padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:4px;margin-top:10px;cursor:pointer;';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(content).then(() => {
      copyBtn.textContent = '✓ Copied!';
      copyBtn.style.backgroundColor = '#388E3C';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
        copyBtn.style.backgroundColor = '#4CAF50';
      }, 2000);
    });
  });
  
  alertDiv.querySelector('div').appendChild(document.createElement('br'));
  alertDiv.querySelector('div').appendChild(copyBtn);
  
  document.body.appendChild(clone);
  
  const closeAlert = () => {
    document.body.removeChild(alertDiv);
  };
  
  alertDiv.querySelector('.alert-close-btn').addEventListener('click', closeAlert);
}

function showAlert(title, message, showCopyButton = false) {
  const template = document.getElementById('alert-template');
  const clone = document.importNode(template.content, true);
  const alertDiv = clone.querySelector('.custom-alert');
  
  alertDiv.querySelector('h4').textContent = title;
  alertDiv.querySelector('div').innerHTML = message;
  
  if (showCopyButton) {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Code';
    copyBtn.style.cssText = 'padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:4px;margin-top:10px;cursor:pointer;';
    
    const codeBlock = alertDiv.querySelector('code');
    if (codeBlock) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Code';
          }, 2000);
        });
      });
      alertDiv.querySelector('div').appendChild(document.createElement('br'));
      alertDiv.querySelector('div').appendChild(copyBtn);
    }
  }
  
  document.body.appendChild(clone);
  
  const closeAlert = () => {
    document.body.removeChild(alertDiv);
  };
  
  alertDiv.querySelector('.alert-close-btn').addEventListener('click', closeAlert);
  
  // Chiudi automaticamente dopo 5 secondi
  setTimeout(closeAlert, 5000);
}

function showBookmarkletInstructions() {
  const getBaseUrl = () => {
    const url = new URL(window.location.href);
    return `${url.origin}${url.pathname.split('/').slice(0, 2).join('/')}/`;
  };

  const rawBookmarklet = `javascript:(function(){
    var titolo=encodeURIComponent(document.title);
    var url=encodeURIComponent(window.location.href);
    window.location.href='${getBaseUrl()}?bookmarklet&titolo='+titolo+'&url='+url;
  })();`;

  const bookmarkletCode = rawBookmarklet
    .replace(/ /g, '%20')
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

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
// 5. GESTIONE DEI LINK
// ============================================

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

async function saveCurrentTab() {
  try {
    const mockTab = {
      url: window.location.href,
      title: document.title || ""
    };
    await processNewLink(mockTab.url, mockTab.title);
  } catch (err) {
    console.error("Errore salvataggio:", err);
    alert("Errore durante il salvataggio");
  }
}

// ============================================
// 6. GESTIONE DELLA LISTA URL
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

// ============================================
// 7. INIZIALIZZAZIONE DELL'APP
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
    
    // Inizializzazione
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

    document.addEventListener("click", (e) => {
      // Export
      if (!e.target.closest("#export-container")) {
        exportDefault.style.display = "flex";
        exportOptions.classList.add("hidden");
      }

      // Import
      if (!e.target.closest("#import-container") && !importFileDialogOpen) {
        importDefault.style.display = "flex";
        importOptions.classList.add("hidden");
      }
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
    const importBtn = document.getElementById("import-btn");
    const importDefault = document.getElementById("import-default");
    const importOptions = document.getElementById("import-options");

    importBtn.addEventListener("click", (e) => {
      importDefault.style.display = "none";
      importOptions.classList.remove("hidden");
      e.stopPropagation();
    });

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
            alert("File non valido. Nessuna lista trovata.");
          }
        } catch (err) {
          alert("Errore nel file: " + err.message);
        }
      };
      reader.readAsText(file);
    });

    importFileInput.addEventListener("blur", () => {
      importFileDialogOpen = false;
    });

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

    // Categorie
    const input = document.getElementById("new-category-input");
    const dropdown = document.getElementById("dropdown-category-list");

    async function loadDropdownCategories() {
      const { userCategories = [] } = await storage.get({ userCategories: [] });
      dropdown.innerHTML = "";
      
      userCategories.forEach((cat) => {
        const row = document.createElement("div");
        row.className = "dropdown-item";
        
        const nameSpan = document.createElement("span");
        nameSpan.textContent = cat;
        row.appendChild(nameSpan);
        
        const remove = document.createElement("span");
        remove.innerHTML = "<span style='margin-left: 6px; color: red; cursor: pointer'>[x]</span>";
        remove.className = "remove";
        remove.title = "Elimina categoria";
        row.appendChild(remove);
        
        dropdown.appendChild(row);
      });
    }

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

    input.addEventListener("focus", async () => {
      dropdown.classList.remove("hidden");
      await loadDropdownCategories();
    });

    document.addEventListener("click", (event) => {
      if (!input || !dropdown) return;

      const clickedRemove = event.target.closest(".remove");
      const clickedInside = input.contains(event.target) || dropdown.contains(event.target);
      
      if (clickedInside && !clickedRemove) {
        return;
      }
      dropdown.classList.add("hidden");
    });

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

    // Save Button
    document.getElementById("save-btn").addEventListener("click", async function() {
      try {
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

    // Caricamento iniziale
    await loadUrls();
});
         