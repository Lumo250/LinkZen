(() => {
  const urlInput = document.getElementById("url-input");
  const saveBtn = document.getElementById("save-btn");
  const urlList = document.getElementById("url-list");
  const undoBtn = document.getElementById("undo-btn");
  const toggleTheme = document.getElementById("toggle-theme");
  const body = document.body;

  let undoData = null;

  // --- Gestione tema ---
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

  // --- Storage ---
  function getLinks() {
    const saved = localStorage.getItem("links");
    return saved ? JSON.parse(saved) : [];
  }

  function saveLinks(links) {
    localStorage.setItem("links", JSON.stringify(links));
  }

  function getCategory(url, title) {
    const text = `${url} ${title}`.toLowerCase();
    if (text.includes("youtube") || text.includes("video")) return "Video";
    if (text.includes("news") || text.includes("nyt")) return "Notizie";
    if (text.includes("chatgpt") || text.includes("ai")) return "AI";
    if (text.includes("github")) return "Dev";
    return "Altro";
  }

  // --- Rendering lista con categorie e pulsanti ---
  function renderLinks() {
    const links = getLinks();
    urlList.innerHTML = "";

    // Raggruppa link per categoria
    const grouped = links.reduce((acc, item) => {
      const cat = item.category || "Altro";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    // Ordina categorie alfabeticamente
    const categories = Object.keys(grouped).sort();

    categories.forEach(cat => {
      const catHeader = document.createElement("h3");
      catHeader.textContent = cat;
      urlList.appendChild(catHeader);

      grouped[cat].forEach((item, idx) => {
        const li = document.createElement("li");

        const a = document.createElement("a");
        a.href = item.url;
        a.target = "_blank";
        a.textContent = item.title ? `${item.title} (${item.url})` : item.url;
        a.style.marginRight = "1rem";

        const delBtn = document.createElement("button");
        delBtn.textContent = "x";
        delBtn.style.color = "red";
        delBtn.addEventListener("click", () => {
          undoData = { item, index: links.indexOf(item) };
          links.splice(links.indexOf(item), 1);
          saveLinks(links);
          renderLinks();
          undoBtn.style.display = "inline-block";
        });

        li.appendChild(a);
        li.appendChild(delBtn);
        urlList.appendChild(li);
      });
    });

    if (!undoData) undoBtn.style.display = "none";
  }

  // --- Undo delete ---
  undoBtn.addEventListener("click", () => {
    if (!undoData) return;
    const links = getLinks();
    links.splice(undoData.index, 0, undoData.item);
    saveLinks(links);
    undoData = null;
    undoBtn.style.display = "none";
    renderLinks();
  });

  // --- Aggiunta link con fetch titolo e categoria ---
  saveBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return alert("Inserisci un URL valido");

    // Controlla duplicati
    const links = getLinks();
    if (links.find(l => l.url === url)) {
      alert("Link già presente");
      return;
    }

    fetch(url).then(resp => resp.text()).then(html => {
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : "";
      const category = getCategory(url, title);
      addLink(url, title, category);
    }).catch(() => {
      // Se fetch fallisce, salva senza titolo ma con categoria generica
      const category = getCategory(url, "");
      addLink(url, "", category);
    });
  });

  function addLink(url, title, category) {
    const links = getLinks();
    links.push({ url, title, category });
    saveLinks(links);
    urlInput.value = "";
    renderLinks();
  }

  // --- IA locale per categorizzazione semplice ---
  // Puoi migliorare con regole più complesse o NLP locale
  function getCategory(url, title) {
    const text = (title + " " + url).toLowerCase();

    if (text.includes("news") || text.includes("blog")) return "News";
    if (text.includes("shop") || text.includes("store") || text.includes("buy")) return "Shopping";
    if (text.includes("github") || text.includes("code") || text.includes("repo")) return "Code";
    if (text.includes("video") || text.includes("youtube") || text.includes("vimeo")) return "Video";
    if (text.includes("forum") || text.includes("discussion") || text.includes("community")) return "Forum";
    if (text.includes("docs") || text.includes("manual") || text.includes("guide")) return "Documentazione";

    return "Altro";
  }

  // --- Gestione aggiunta da query string (bookmarklet) ---
  function tryAddFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const addurl = params.get("addurl");
    if (addurl) {
      try {
        const decodedUrl = decodeURIComponent(addurl);
        // Evita duplicati con getLinks
        const links = getLinks();
        if (!links.find(l => l.url === decodedUrl)) {
          const category = getCategory(decodedUrl, "");
          addLink(decodedUrl, "", category);
        }
        // Rimuove la query per evitare duplicati futuri
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}
    }
  }

  // --- Esportazione lista link in JSON ---
  function exportLinks() {
    const data = JSON.stringify(getLinks(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "linkzen_links.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  // --- Aggiungi bottone export in popup.html e gestisci evento ---
  const exportBtn = document.getElementById("export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportLinks);
  }

  // --- Avvio ---
  tryAddFromQuery();
  renderLinks();
