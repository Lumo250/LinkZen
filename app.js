(() => {
  // DOM elements
  const urlInput = document.getElementById("url-input");
  const titleInput = document.getElementById("title-input");
  const saveBtn = document.getElementById("save-btn");
  const urlList = document.getElementById("url-list");
  const undoBtn = document.getElementById("undo-btn");
  const toggleTheme = document.getElementById("toggle-theme");
  const body = document.body;
  const zoomRange = document.getElementById("zoom-range");
  const zoomLabel = document.getElementById("zoom-label");
  const categorySelect = document.getElementById("category-select");
  const newCategoryInput = document.getElementById("new-category-input");
  const addCategoryBtn = document.getElementById("add-category-btn");
  const filterCategorySelect = document.getElementById("filter-category-select");
  const sortBtn = document.getElementById("sort-btn");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");

  let undoData = null;
  let isSortedAsc = true;



  // --- Tema ---
  function loadTheme() {
    const dark = localStorage.getItem("darkMode") === "true";
    if (dark) {
      body.classList.add("dark");
      toggleTheme.checked = true;
    } else {
      body.classList.remove("dark");
      toggleTheme.checked = false;
    }
  }
  toggleTheme.addEventListener("change", () => {
    const enabled = toggleTheme.checked;
    body.classList.toggle("dark", enabled);
    localStorage.setItem("darkMode", enabled);
  });
  loadTheme();

  // --- Zoom ---
  function loadZoom() {
    const zoom = localStorage.getItem("zoom") || "100";
    zoomRange.value = zoom;
    zoomLabel.textContent = zoom + "%";
    body.style.fontSize = zoom + "%";
  }
  zoomRange.addEventListener("input", () => {
    const zoom = zoomRange.value;
    zoomLabel.textContent = zoom + "%";
    body.style.fontSize = zoom + "%";
    localStorage.setItem("zoom", zoom);
  });
  loadZoom();

  // --- Gestione categorie ---
  function getCategories() {
    const saved = localStorage.getItem("categories");
    return saved ? JSON.parse(saved) : [];
  }
  function saveCategories(cats) {
    localStorage.setItem("categories", JSON.stringify(cats));
  }
  function renderCategories() {
    const cats = getCategories();
    // dropdown for new link
    categorySelect.innerHTML = `<option value="">Nessuna</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
    // dropdown for filter
    filterCategorySelect.innerHTML = `<option value="">Tutte</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
  }
  addCategoryBtn.addEventListener("click", () => {
    const newCat = newCategoryInput.value.trim();
    if (!newCat) return alert("Inserisci il nome della categoria");
    const cats = getCategories();
    if (cats.includes(newCat)) {
      alert("Categoria già esistente");
      return;
    }
    cats.push(newCat);
    saveCategories(cats);
    renderCategories();
    newCategoryInput.value = "";
  });
  renderCategories();

  // --- Gestione link ---
  function getLinks() {
    const saved = localStorage.getItem("links");
    return saved ? JSON.parse(saved) : [];
  }
  function saveLinks(links) {
    localStorage.setItem("links", JSON.stringify(links));
  }

  function renderLinks() {
    const links = getLinks();
    const filterCat = filterCategorySelect.value;
    let filtered = filterCat ? links.filter(l => l.category === filterCat) : links;
    if (isSortedAsc) {
      filtered.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
    } else {
      filtered.sort((a, b) => (b.title || b.url).localeCompare(a.title || a.url));
    }
    urlList.innerHTML = "";
    filtered.forEach((item, idx) => {
      const li = document.createElement("li");

      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.textContent = item.title ? `${item.title} (${item.url})` : item.url;
      a.style.marginRight = "1rem";

      const catSpan = document.createElement("span");
      catSpan.textContent = item.category ? `[${item.category}]` : "";
      catSpan.style.fontStyle = "italic";
      catSpan.style.color = "#666";
      catSpan.style.marginRight = "1rem";

      const delBtn = document.createElement("button");
      delBtn.textContent = "x";
      delBtn.style.color = "red";
      delBtn.addEventListener("click", () => {
        undoData = { item, index: idx };
        const allLinks = getLinks();
        // Remove from allLinks using url (because filtered is subset)
        const realIndex = allLinks.findIndex(l => l.url === item.url);
        if (realIndex >= 0) {
          allLinks.splice(realIndex, 1);
          saveLinks(allLinks);
          renderLinks();
          undoBtn.style.display = "inline-block";
        }
      });

      li.appendChild(a);
      li.appendChild(catSpan);
      li.appendChild(delBtn);
      urlList.appendChild(li);
    });

    if (!undoData) undoBtn.style.display = "none";
  }

  // --- Undo delete ---
  undoBtn.addEventListener("click", () => {
    if (!undoData) return;
    const links = getLinks();
    links.push(undoData.item); // add back at end
    saveLinks(links);
    undoData = null;
    undoBtn.style.display = "none";
    renderLinks();
  });

  // --- Salva nuovo link ---
  saveBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return alert("Inserisci un URL valido");
    let title = titleInput.value.trim();

    // Check if already present
    const links = getLinks();
    if (links.find(l => l.url === url)) {
      alert("Link già presente");
      return;
    }

    // Save link with selected category
    const category = categorySelect.value || "";

    if (!title) {
      // Try to fetch title from URL
      fetch(url).then(resp => resp.text()).then(html => {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const fetchedTitle = titleMatch ? titleMatch[1] : "";
        addLink(url, fetchedTitle, category);
      }).catch(() => {
        addLink(url, "", category);
      });
    } else {
      addLink(url, title, category);
    }
  });

  function addLink(url, title, category) {
    const links = getLinks();
    links.push({ url, title, category });
    saveLinks(links);
    urlInput.value = "";
    titleInput.value = "";
    categorySelect.value = "";
    renderLinks();
  }

  // --- Filtri e ordinamento ---
  filterCategorySelect.addEventListener("change", renderLinks);
  sortBtn.addEventListener("click", () => {
    isSortedAsc = !isSortedAsc;
    sortBtn.textContent = isSortedAsc ? "Ordina per titolo (A-Z)" : "Ordina per titolo (Z-A)";
    renderLinks();
  });
  sortBtn.textContent = "Ordina per titolo (A-Z)";

  // --- Export JSON ---
  exportBtn.addEventListener("click", () => {
    const data = {
      categories: getCategories(),
      links: getLinks()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkzen_export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- Import JSON ---
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.categories && Array.isArray(data.categories)) {
          saveCategories(data.categories);
          renderCategories();
        }
        if (data.links && Array.isArray(data.links)) {
          saveLinks(data.links);
          renderLinks();
        }
        alert("Importazione completata!");
      } catch {
        alert("File JSON non valido");
      }
      importFile.value = "";
    };
    reader.readAsText(file);
  });

  // --- Easter egg ---
  body.addEventListener("dblclick", () => {
    alert("👾 LinkZen PWA - Keep your links zen!");
  });



function tryAddFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const addurl = params.get("addurl");
  const title = params.get("title") || "";
  if (addurl) {
    try {
      const decodedUrl = decodeURIComponent(addurl);
      const decodedTitle = decodeURIComponent(title);
      addLink(decodedUrl, decodedTitle);
      // Pulisce la query string per evitare duplicati
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error("Errore decodifica URL:", e);
    }
  }
}

  // Avvio
  tryAddFromQuery();
  renderLinks();
})();
