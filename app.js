// app.js

// Stato globale
let data = {
  categories: {}, // { categoria: [link1, link2, ...] }
  learnedKeywords: [], // parole chiave usate per IA
  visitedLinks: new Set(), // link marcati come visitati
  undoStack: []
};

// Elementi DOM
const categoriesContainer = document.getElementById('categoriesContainer');
const categoryInput = document.getElementById('categoryInput');
const addCategoryButton = document.getElementById('addCategoryButton');
const learnedKeywordsList = document.getElementById('learnedKeywordsList');
const clearLearnedKeywordsButton = document.getElementById('clearLearnedKeywords');
const zoomToggle = document.getElementById('zoomToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const exportButton = document.getElementById('exportButton');
const importButton = document.getElementById('importButton');
const importOverlay = document.getElementById('importOverlay');
const importTextarea = document.getElementById('importTextarea');
const closeImportOverlay = document.getElementById('closeImportOverlay');
const undoButton = document.getElementById('undoButton');

// Caricamento dati da storage
function loadData() {
  if ('localStorage' in window) {
    const saved = localStorage.getItem('linkZenData');
    if (saved) {
      data = JSON.parse(saved);
      if (Array.isArray(data.visitedLinks)) {
        data.visitedLinks = new Set(data.visitedLinks);
      }
    }
  }
  renderAll();
}

// Salvataggio dati su storage
function saveData() {
  if ('localStorage' in window) {
    const toSave = {...data, visitedLinks: Array.from(data.visitedLinks)};
    localStorage.setItem('linkZenData', JSON.stringify(toSave));
  }
}

// Renderizza tutte le categorie e link
function renderAll() {
  renderCategories();
  renderLearnedKeywords();
}

// Render categorie e link
function renderCategories() {
  categoriesContainer.innerHTML = '';
  for (const category of Object.keys(data.categories)) {
    const catDiv = document.createElement('div');
    catDiv.className = 'category';
    
    // Header categoria con titolo e bottone rimuovi
    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = category;

    const removeCatBtn = document.createElement('button');
    removeCatBtn.className = 'category-remove';
    removeCatBtn.textContent = '×';
    removeCatBtn.title = 'Rimuovi categoria';
    removeCatBtn.addEventListener('click', () => {
      undoStackPush();
      delete data.categories[category];
      saveData();
      renderAll();
    });

    header.appendChild(title);
    header.appendChild(removeCatBtn);
    catDiv.appendChild(header);

    // Lista link
    const ul = document.createElement('ul');
    ul.className = 'link-list';

    data.categories[category].forEach(link => {
      const li = document.createElement('li');
      li.textContent = link;
      li.tabIndex = 0;
      if (data.visitedLinks.has(link)) {
        li.classList.add('visited');
      }

      // Click apre link e marca visitato
      li.addEventListener('click', () => {
        window.open(link, '_blank');
        data.visitedLinks.add(link);
        saveData();
        renderAll();
      });

      // Rimuovi singolo link
      const removeLinkBtn = document.createElement('button');
      removeLinkBtn.className = 'link-remove';
      removeLinkBtn.textContent = '×';
      removeLinkBtn.title = 'Rimuovi link';
      removeLinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        undoStackPush();
        const idx = data.categories[category].indexOf(link);
        if (idx > -1) {
          data.categories[category].splice(idx, 1);
          data.visitedLinks.delete(link);
          saveData();
          renderAll();
        }
      });

      li.appendChild(removeLinkBtn);
      ul.appendChild(li);
    });

    catDiv.appendChild(ul);
    categoriesContainer.appendChild(catDiv);
  }
}

// Render parole chiave apprese
function renderLearnedKeywords() {
  learnedKeywordsList.innerHTML = '';
  data.learnedKeywords.forEach(keyword => {
    const li = document.createElement('li');
    li.textContent = keyword;
    learnedKeywordsList.appendChild(li);
  });
}

// Aggiungi categoria nuova
addCategoryButton.addEventListener('click', () => {
  const newCat = categoryInput.value.trim();
  if (newCat && !data.categories[newCat]) {
    undoStackPush();
    data.categories[newCat] = [];
    categoryInput.value = '';
    saveData();
    renderAll();
  }
});

// Undo stack
function undoStackPush() {
  const snapshot = JSON.stringify(data);
  data.undoStack = data.undoStack || [];
  data.undoStack.push(snapshot);
  if (data.undoStack.length > 20) data.undoStack.shift();
}

// Undo funzione
undoButton.addEventListener('click', () => {
  if (data.undoStack && data.undoStack.length > 0) {
    const prevState = data.undoStack.pop();
    data = JSON.parse(prevState);
    saveData();
    renderAll();
  }
});

// Toggle zoom testo
zoomToggle.addEventListener('change', (e) => {
  if (e.target.checked) {
    document.body.classList.add('zoom-text');
  } else {
    document.body.classList.remove('zoom-text');
  }
});

// Toggle dark mode
darkModeToggle.addEventListener('change', (e) => {
  const isDark = e.target.checked;
  document.body.classList.toggle('dark-mode', isDark);
  localStorage.setItem('darkMode', isDark ? 'true' : 'false');
});

// Esporta dati JSON
exportButton.addEventListener('click', () => {
  const exportData = JSON.stringify(data, null, 2);
  const blob = new Blob([exportData], {type: 'application/json'});
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'linkzen-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

// Mostra overlay import
importButton.addEventListener('click', () => {
  importOverlay.classList.remove('hidden');
  importTextarea.value = '';
  importTextarea.focus();
});

// Chiudi overlay import
closeImportOverlay.addEventListener('click', () => {
  importOverlay.classList.add('hidden');
});

// Importa dati JSON
importTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    try {
      const imported = JSON.parse(importTextarea.value);
      if (imported.categories && typeof imported.categories === 'object') {
        undoStackPush();
        data = imported;
        // Converti visitedLinks in Set se necessario
        if (Array.isArray(data.visitedLinks)) {
          data.visitedLinks = new Set(data.visitedLinks);
        }
        saveData();
        renderAll();
        importOverlay.classList.add('hidden');
      } else {
        alert('Dati importati non validi.');
      }
    } catch {
      alert('Errore parsing JSON.');
    }
  }
});

// Funzione IA semplice per categorizzazione automatica basata su parole chiave apprese
function categorizeLink(link) {
  for (const keyword of data.learnedKeywords) {
    if (link.includes(keyword)) {
      // Trova categoria con parola chiave o crea categoria se non esiste
      if (data.categories[keyword]) {
        data.categories[keyword].push(link);
      } else {
        data.categories[keyword] = [link];
      }
      saveData();
      return true;
    }
  }
  return false;
}

// Aggiungi link visitato manualmente (esempio da background o altro)
function addVisitedLinkManually(link) {
  undoStackPush();
  if (!categorizeLink(link)) {
    // Se non categorizzato automaticamente, aggiungi in categoria 'Uncategorized'
    if (!data.categories['Uncategorized']) data.categories['Uncategorized'] = [];
    data.categories['Uncategorized'].push(link);
  }
  data.visitedLinks.add(link);
  saveData();
  renderAll();
}

// Tooltip base (esempio semplice)
document.body.addEventListener('mouseover', e => {
  const target = e.target;
  if (target.matches('.category-title')) {
    target.title = 'Clicca su × per rimuovere categoria';
  } else if (target.matches('.link-remove')) {
    target.title = 'Rimuovi link';
  } else if (target.matches('.category-remove')) {
    target.title = 'Rimuovi categoria';
  }
});

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


// Inizializza
tryAddFromQuery();
loadData();

// Applica dark mode in base a localStorage
const savedDark = localStorage.getItem("darkMode") === "true";
darkModeToggle.checked = savedDark;
document.body.classList.toggle("dark-mode", savedDark);

