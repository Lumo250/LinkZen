if (localStorage.getItem("darkMode") === "true") {
  document.documentElement.classList.add("dark-ready");
  document.body.classList?.add("dark");
}

let undoData = null;
let undoTimeout = null;
let undoBtn, themeToggleWrapper;
let fontScale = 1;

const stopwords = ["the", "and", "with", "this", "from", "that", "have", "for", "your", "you", "are"];

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(word => word.length > 3 && !stopwords.includes(word));
}

function categorizeByLearnedKeywords(title, url, callback) {
  const map = loadData("keywordToCategory") || {};
  const text = (title + " " + url).toLowerCase();
  for (const keyword in map) {
    if (text.includes(keyword)) {
      callback(map[keyword], true);
      return;
    }
  }
  callback("Other", false);
}

function learnFromManualOverride(entry, newCategory) {
  if (newCategory === "Other") return;

  const titleWords = extractKeywords(entry.title);
  const extraStopwords = ["about", "login", "accedi", "index", "html", "page", "home", "email"];
  const noiseWords = ["product", "video", "media", "main", "category", "default", "online"];
  const combinedStopwords = new Set([...stopwords, ...extraStopwords, ...noiseWords]);

  const filteredWords = titleWords
    .filter(word => word.length >= 4 && !combinedStopwords.has(word) && !/^\d+$/.test(word));

  try {
    const hostname = new URL(entry.url).hostname.replace(/^www\./, "");
    if (hostname.length >= 5) filteredWords.unshift(hostname);
  } catch {}

  const finalWords = Array.from(new Set(filteredWords)).slice(0, 8);
  if (finalWords.length === 0) return;

  const keywordToCategory = loadData("keywordToCategory") || {};
  finalWords.forEach(word => { keywordToCategory[word] = newCategory });
  saveData("keywordToCategory", keywordToCategory);
}
function applyFontSize(scale) {
  document.body.style.fontSize = `${scale}em`;
  saveData("fontScale", scale);

  const box = document.getElementById("ia-knowledge-box");
  if (box) box.style.fontSize = `${scale}em`;
}

function showUndoButton() {
  if (!undoBtn) undoBtn = document.getElementById("undo-btn");
  if (!themeToggleWrapper) themeToggleWrapper = document.getElementById("theme-toggle-wrapper");
  undoBtn.style.display = "inline-block";
  themeToggleWrapper.style.display = "none";

  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    undoBtn.style.display = "none";
    themeToggleWrapper.style.display = "inline-block";
    undoData = null;
  }, 10000); // nasconde l'undo dopo 10 secondi
}

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

document.addEventListener("DOMContentLoaded", () => {
  fontScale = loadData("fontScale") || 1;
  applyFontSize(fontScale);

const params = new URLSearchParams(window.location.search);
  const title = params.get("title");
  const url = params.get("url");

  if (title && url) {
    categorizeByLearnedKeywords(title, url, (category, isIA) => {
      const visitedUrls = loadData("visitedUrls") || [];
      const exists = visitedUrls.find(u => u.url === url);

      if (!exists) {
        visitedUrls.unshift({ url, title, category, originalCategory: category });
        saveData("visitedUrls", visitedUrls);
        saveData("lastAddedUrl", url);
        saveData("highlightColor", "green");
      } else {
        saveData("lastAddedUrl", url);
        saveData("highlightColor", "orange");
      }

      // Rimuove i parametri dalla URL dopo il salvataggio
      window.history.replaceState({}, document.title, window.location.pathname);
      loadUrls();
    });
  }

undoBtn = document.getElementById("undo-btn");
themeToggleWrapper = document.getElementById("theme-toggle-wrapper");

undoBtn.addEventListener("click", () => {
if (!undoData) return;

  const urls = loadData("visitedUrls") || [];
  urls.splice(undoData.index, 0, undoData.entry);
  saveData("visitedUrls", urls);
  loadUrls();

  undoBtn.style.display = "none";
  themeToggleWrapper.style.display = "inline-block";
  undoData = null;
});
  
  const darkMode = loadData("darkMode");
  const toggleTheme = document.getElementById("toggle-theme");
  if (darkMode) {
    document.body.classList.add("dark");
    if (toggleTheme) toggleTheme.checked = true;
  }

  toggleTheme?.addEventListener("change", () => {
    const enabled = toggleTheme.checked;
    document.body.classList.toggle("dark", enabled);
    saveData("darkMode", enabled);
    localStorage.setItem("darkMode", enabled);
  });

  document.getElementById("zoom-in").addEventListener("click", () => {
    fontScale = Math.min(fontScale + 0.1, 2);
    applyFontSize(fontScale);
  });

  document.getElementById("zoom-out").addEventListener("click", () => {
    fontScale = Math.max(fontScale - 0.1, 0.6);
    applyFontSize(fontScale);
  });

  document.getElementById("ia-knowledge-btn").addEventListener("click", () => {
    const iaBtn = document.getElementById("ia-knowledge-btn");
    const box = document.getElementById("ia-knowledge-box");
    const map = loadData("keywordToCategory") || {};
    const entries = Object.entries(map);

    box.innerHTML = "";
    if (entries.length === 0) {
      box.textContent = "Nessuna parola chiave appresa.";
    } else {
      const grouped = {};
      entries.forEach(([k, cat]) => {
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(k);
      });

      for (const cat in grouped) {
        const catBlock = document.createElement("div");
        const title = document.createElement("div");
        title.textContent = `📁 ${cat}`;
        title.style.fontWeight = "bold";
        title.style.marginBottom = "4px";
        catBlock.appendChild(title);

        const kwContainer = document.createElement("div");
        kwContainer.style.display = "flex";
        kwContainer.style.flexWrap = "wrap";
        kwContainer.style.gap = "6px";

        grouped[cat].forEach((kw) => {
          const chip = document.createElement("div");
          chip.textContent = kw;
          chip.title = `Click to remove \"${kw}\"`;
          chip.style.padding = "2px 6px";
          chip.style.border = "1px solid orange";
          chip.style.borderRadius = "4px";
          chip.style.cursor = "pointer";

          chip.addEventListener("click", () => {
            delete map[kw];
            saveData("keywordToCategory", map);
            chip.remove();
            if (Object.keys(map).length === 0) box.textContent = "Nessuna parola chiave appresa.";
          });

          kwContainer.appendChild(chip);
        });

        catBlock.appendChild(kwContainer);
        box.appendChild(catBlock);
      }
    }

    box.classList.toggle("hidden");
    iaBtn.classList.toggle("active");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data.visitedUrls)) {
          Object.keys(data).forEach(k => saveData(k, data[k]));
          loadUrls();
        } else {
          alert("File non valido.");
        }
      } catch (err) {
        alert("Errore: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("export-basic").addEventListener("click", () => {
    const data = {
      visitedUrls: loadData("visitedUrls") || [],
      userCategories: loadData("userCategories") || []
    };
    downloadJSON(data, "linkzen_export_basic.json");
  });

  document.getElementById("export-full").addEventListener("click", () => {
    const data = {
      visitedUrls: loadData("visitedUrls") || [],
      userCategories: loadData("userCategories") || [],
      keywordToCategory: loadData("keywordToCategory") || {}
    };
    downloadJSON(data, "linkzen_export_full.json");
  });

  document.getElementById("export-btn").addEventListener("click", (e) => {
    document.getElementById("export-default").style.display = "none";
    document.getElementById("export-options").classList.remove("hidden");
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (!document.getElementById("export-container").contains(e.target)) {
      document.getElementById("export-default").style.display = "flex";
      document.getElementById("export-options").classList.add("hidden");
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    saveData("clickedUrls", []);
    loadUrls();
  });

  document.getElementById("undo-btn").addEventListener("click", () => {
    if (!undoData) return;
    const urls = loadData("visitedUrls") || [];
    urls.splice(undoData.index, 0, undoData.entry);
    saveData("visitedUrls", urls);
    undoData = null;
    undoBtn.style.display = "none";
    themeToggleWrapper.style.display = "inline-block";
    clearTimeout(undoTimeout);
    loadUrls();
  });

  document.getElementById("add-category-btn").addEventListener("click", () => {
    const input = document.getElementById("new-category-input");
    const newCategory = input.value.trim();
    if (!newCategory) return;

    const userCategories = loadData("userCategories") || [];
    if (!userCategories.includes(newCategory)) {
      userCategories.push(newCategory);
      saveData("userCategories", userCategories);
      input.value = "";
      loadUrls();
    }
  });

  loadUrls();
});
function loadUrls() {
  const result = {
    visitedUrls: loadData("visitedUrls") || [],
    clickedUrls: loadData("clickedUrls") || [],
    userCategories: loadData("userCategories") || [],
    sortOrder: loadData("sortOrder") || "default",
    lastAddedUrl: loadData("lastAddedUrl") || null,
    highlightColor: loadData("highlightColor") || "green"
  };

  const list = document.getElementById("url-list");
  list.innerHTML = "";

  const sortOrder = result.sortOrder;
  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.checked = (radio.value === sortOrder);
    radio.addEventListener("change", () => {
      saveData("sortOrder", radio.value);
      loadUrls();
    });
  });

  const urls = [...result.visitedUrls];
  if (sortOrder === "category") {
    urls.sort((a, b) => (a.category || "Other").localeCompare(b.category || "Other"));
  }

  const defaultCategories = [
    "News", "Video", "Finance", "Social", "E-mail", "Store", "Commerce",
    "Productivity", "Entertainment", "Education", "Sports",
    "AI", "Search", "Design", "Weather", "Other"
  ];
  const allCategories = [...defaultCategories, ...result.userCategories];

  urls.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "link-row";

    if (item.url === result.lastAddedUrl) {
      li.style.backgroundColor = result.highlightColor === "orange" ? "#e67e22" : "#388e3c";
      li.style.transition = "background-color 6s ease";
      void li.offsetWidth;
      setTimeout(() => {
        li.style.backgroundColor = "transparent";
        removeData("highlightColor");
      }, 100);
    }

    const select = document.createElement("select");
    select.className = "category";
    allCategories.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (opt === item.category) option.selected = true;
      select.appendChild(option);
    });

    
    select.addEventListener("change", () => {
      const newCat = select.value;
      const idx = result.visitedUrls.findIndex(i => i.url === item.url);
      if (idx !== -1) {
        result.visitedUrls[idx].category = newCat;
        if (defaultCategories.includes(newCat)) {
          learnFromManualOverride(result.visitedUrls[idx], newCat);
        }
        saveData("visitedUrls", result.visitedUrls);
        loadUrls();
      }
    });

    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.className = result.clickedUrls.includes(item.url) ? "link clicked" : "link";
    a.title = `[${item.category}] ${item.url}`;
    a.style.display = "flex";
    a.style.alignItems = "center";
    a.style.gap = "6px";

    const favicon = document.createElement("img");
    favicon.src = "https://www.google.com/s2/favicons?sz=16&domain_url=" + item.url;
    favicon.width = 16;
    favicon.height = 16;
    favicon.style.flexShrink = "0";

    const hostname = new URL(item.url).hostname.replace(/^www\./, "");
    const combined = hostname + " - " + item.title;
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
      if (!result.clickedUrls.includes(item.url)) {
        result.clickedUrls.push(item.url);
        saveData("clickedUrls", result.clickedUrls);
        loadUrls();
      }
      window.open(item.url, "_blank");
    });

    const del = document.createElement("button");
    del.textContent = "x";
    del.className = "delete-btn";
    del.addEventListener("click", () => {
      const indexToDelete = result.visitedUrls.findIndex(entry => entry.url === item.url);
      if (indexToDelete !== -1) {
        const removed = result.visitedUrls.splice(indexToDelete, 1)[0];
        undoData = { entry: removed, index: indexToDelete };

        themeToggleWrapper.style.display = "none";
        undoBtn.style.display = "inline-block";

        clearTimeout(undoTimeout);
        undoTimeout = setTimeout(() => {
          undoData = null;
          undoBtn.style.display = "none";
          themeToggleWrapper.style.display = "inline-block";
        }, 8000);

        saveData("visitedUrls", result.visitedUrls);
        loadUrls();
      }
    });

    li.appendChild(select);
    li.appendChild(a);
    li.appendChild(del);
    list.appendChild(li);
  });

  if (result.lastAddedUrl) {
    const lastLink = Array.from(list.children).find(li =>
      li.querySelector("a")?.href === result.lastAddedUrl
    );
    if (lastLink) lastLink.scrollIntoView({ behavior: "smooth", block: "end" });
    removeData("lastAddedUrl");
  }

  const dropdown = document.getElementById("dropdown-category-list");
  dropdown.innerHTML = "";
  result.userCategories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "dropdown-item";
    row.textContent = cat;

    const remove = document.createElement("span");
    remove.textContent = "×";
    remove.className = "remove";
    remove.style.marginLeft = "6px";
    remove.style.cursor = "pointer";
    remove.style.color = "red";
    remove.addEventListener("click", () => {
      const updatedUserCats = result.userCategories.filter(c => c !== cat);
      const updatedUrls = result.visitedUrls.map(link => {
        if (link.category === cat) {
          return { ...link, category: link.originalCategory || "Other" };
        }
        return link;
      });
      saveData("userCategories", updatedUserCats);
      saveData("visitedUrls", updatedUrls);
      loadUrls();
    });

    row.appendChild(remove);
    dropdown.appendChild(row);
  });
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
