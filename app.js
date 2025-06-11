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

  // --- Funzioni gestione lista ---
  function getLinks() {
    const saved = localStorage.getItem("links");
    return saved ? JSON.parse(saved) : [];
  }
  function saveLinks(links) {
    localStorage.setItem("links", JSON.stringify(links));
  }

  function renderLinks() {
    const links = getLinks();
    urlList.innerHTML = "";
    links.forEach((item, idx) => {
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
        undoData = { item, index: idx };
        links.splice(idx, 1);
        saveLinks(links);
        renderLinks();
        undoBtn.style.display = "inline-block";
      });

      li.appendChild(a);
      li.appendChild(delBtn);
      urlList.appendChild(li);
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

  // --- Aggiunta link ---
  saveBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url) return alert("Inserisci un URL valido");

    // Prova a prendere il titolo via fetch (opzionale)
    fetch(url).then(resp => resp.text()).then(html => {
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : "";
      addLink(url, title);
    }).catch(() => {
      addLink(url, "");
    });
  });

  function addLink(url, title) {
    const links = getLinks();
    if (links.find(l => l.url === url)) {
      alert("Link già presente");
      return;
    }
    links.push({ url, title });
    saveLinks(links);
    urlInput.value = "";
    renderLinks();
  }

  // --- Gestione parametri URL (bookmarklet) ---
  function tryAddFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const addurl = params.get("addurl");
    if (addurl) {
      try {
        const decodedUrl = decodeURIComponent(addurl);
        addLink(decodedUrl, "");
        // Pulisco la query string per evitare duplicati
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}
    }
  }

  // Avvio
  tryAddFromQuery();
  renderLinks();
})();