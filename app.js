// app.js

// Stato globale dati
let data = {
  categories: {
    "Uncategorized": []
  },
  sortBy: 'date', // 'date' o 'name'
  undoStack: [],
  redoStack: []
};

const MAX_UNDO = 20;

// --- Utility ---

function saveData() {
  localStorage.setItem('linkZenData', JSON.stringify(data));
}

function loadData() {
  const saved = localStorage.getItem('linkZenData');
  if (saved) {
    try {
      data = JSON.parse(saved);
      if (!data.categories) data.categories = { "Uncategorized": [] };
      if (!data.sortBy) data.sortBy = 'date';
      if (!data.undoStack) data.undoStack = [];
      if (!data.redoStack) data.redoStack = [];
    } catch {
      data = { categories: { "Uncategorized": [] }, sortBy: 'date', undoStack: [], redoStack: [] };
    }
  }
}

function pushUndo() {
  if (data.undoStack.length >= MAX_UNDO) data.undoStack.shift();
  data.undoStack.push(JSON.stringify(data.categories));
  data.redoStack = [];
}

function undo() {
  if (data.undoStack.length === 0) return;
  data.redoStack.push(JSON.stringify(data.categories));
  const prev = data.undoStack.pop();
  data.categories = JSON.parse(prev);
  saveData();
  renderAll();
}

function redo() {
  if (data.redoStack.length === 0) return;
  data.undoStack.push(JSON.stringify(data.categories));
  const next = data.redoStack.pop();
  data.categories = JSON.parse(next);
  saveData();
  renderAll();
}

// --- Rendering ---

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';

  for (const category of Object.keys(data.categories)) {
    const section = document.createElement('section');
    section.classList.add('category-section');

    const h3 = document.createElement('h3');
    h3.textContent = category;
    section.appendChild(h3);

    const ul = document.createElement('ul');
    let links = [...data.categories[category]];

    if (data.sortBy === 'name') {
      links.sort((a, b) => a.title.localeCompare(b.title));
    } else if (data.sortBy === 'date') {
      links.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    for (const linkObj of links) {
      const li = document.createElement('li');
      li.classList.add('link-item');

      const faviconImg = document.createElement('img');
      faviconImg.className = 'favicon';
      faviconImg.src = linkObj.favicon || 'default-favicon.png';
      faviconImg.onerror = () => faviconImg.style.display = 'none';
      li.appendChild(faviconImg);

      const a = document.createElement('a');
      a.href = linkObj.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = linkObj.title;
      li.appendChild(a);

      // Select categoria modificabile
      const select = document.createElement('select');
      for (const cat of Object.keys(data.categories)) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === category) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', (e) => {
        const newCat = e.target.value;
        if (!data.categories[newCat]) data.categories[newCat] = [];
        pushUndo();
        data.categories[category] = data.categories[category].filter(l => l.url !== linkObj.url);
        data.categories[newCat].push(linkObj);
        if (data.categories[category].length === 0) delete data.categories[category];
        saveData();
        renderAll();
      });
      li.appendChild(select);

      // Pulsante rimuovi
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✖';
      removeBtn.title = 'Rimuovi link';
      removeBtn.addEventListener('click', () => {
        pushUndo();
        data.categories[category] = data.categories[category].filter(l => l.url !== linkObj.url);
        if (data.categories[category].length === 0) delete data.categories[category];
        saveData();
        renderAll();
      });
      li.appendChild(removeBtn);

      ul.appendChild(li);
    }

    section.appendChild(ul);
    container.appendChild(section);
  }
}

function renderAll() {
  renderCategories();
  // Puoi aggiungere qui altre funzioni di rendering (es: update UI stato undo/redo)
}

// --- Aggiunta link ---

function addLink(url, title, favicon, category = 'Uncategorized') {
  if (!data.categories[category]) data.categories[category] = [];
  // Check duplicati
  for (const cat of Object.keys(data.categories)) {
    if (data.categories[cat].some(l => l.url === url)) {
      alert('Link già presente');
      return false;
    }
  }
  pushUndo();
  data.categories[category].push({
    url,
    title,
    favicon,
    date: new Date().toISOString()
  });
  saveData();
  renderAll();
  return true;
}

function addLinkFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const addurl = params.get('addurl');
  const addtitle = params.get('addtitle') || addurl;
  if (addurl) {
    // Potresti voler estrarre favicon con API esterna o placeholder
    addLink(addurl, addtitle, '', 'Uncategorized');
    // Puliamo la query per non riaggiungere
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// --- Init ---

function init() {
  loadData();
  addLinkFromQuery();
  renderAll();

  // Bind undo/redo
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);

  // Sort selector
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    data.sortBy = e.target.value;
    saveData();
    renderAll();
  });
}

// Avvia app
window.addEventListener('DOMContentLoaded', init);
// --- Gestione Categorie ---

function addCategory(name) {
  if (!name || data.categories[name]) {
    alert('Categoria già esistente o nome non valido');
    return false;
  }
  pushUndo();
  data.categories[name] = [];
  saveData();
  renderAll();
  updateCategoryOptions();
  return true;
}

function removeCategory(name) {
  if (name === 'Uncategorized') {
    alert('La categoria "Uncategorized" non può essere rimossa.');
    return;
  }
  if (!data.categories[name]) return;
  if (data.categories[name].length > 0) {
    alert('La categoria non è vuota, sposta prima i link.');
    return;
  }
  pushUndo();
  delete data.categories[name];
  saveData();
  renderAll();
  updateCategoryOptions();
}

function updateCategoryOptions() {
  // Aggiorna le select categorie nella UI (es. select di aggiunta link, filtri)
  const categorySelects = document.querySelectorAll('.category-select');
  categorySelects.forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = '';
    for (const cat of Object.keys(data.categories)) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentVal) opt.selected = true;
      sel.appendChild(opt);
    }
  });
}

// --- Esportazione e Importazione ---

function exportData() {
  const json = JSON.stringify(data.categories, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'linkzen_data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (typeof imported !== 'object') throw new Error('File non valido');
      pushUndo();
      data.categories = imported;
      saveData();
      renderAll();
      updateCategoryOptions();
    } catch (err) {
      alert('Errore nell\'importazione: file JSON non valido');
    }
  };
  reader.readAsText(file);
}

// --- Zoom del testo ---

let currentZoom = 1;

function setZoom(zoom) {
  currentZoom = Math.min(Math.max(zoom, 0.5), 3);
  document.documentElement.style.setProperty('--zoom-scale', currentZoom);
  localStorage.setItem('linkZenZoom', currentZoom);
}

function zoomIn() {
  setZoom(currentZoom + 0.1);
}

function zoomOut() {
  setZoom(currentZoom - 0.1);
}

function resetZoom() {
  setZoom(1);
}

function loadZoom() {
  const saved = localStorage.getItem('linkZenZoom');
  if (saved) {
    setZoom(parseFloat(saved));
  }
}

// --- Dark Mode ---

function toggleDarkMode(enable) {
  if (enable === undefined) {
    enable = !document.body.classList.contains('dark-mode');
  }
  if (enable) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  localStorage.setItem('linkZenDarkMode', enable ? '1' : '0');
}

function loadDarkMode() {
  const saved = localStorage.getItem('linkZenDarkMode');
  if (saved === '1') {
    toggleDarkMode(true);
  }
}

// --- Easter Egg Visivo ---

function setupEasterEgg() {
  // Semplice esempio: se premi sequenza di tasti "linkzen", cambia sfondo temporaneamente
  const sequence = ['l','i','n','k','z','e','n'];
  let pos = 0;
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === sequence[pos]) {
      pos++;
      if (pos === sequence.length) {
        pos = 0;
        triggerEasterEgg();
      }
    } else {
      pos = 0;
    }
  });
}

function triggerEasterEgg() {
  const body = document.body;
  const originalBg = body.style.backgroundColor;
  body.style.backgroundColor = '#FFD700'; // oro brillante
  setTimeout(() => {
    body.style.backgroundColor = originalBg;
  }, 2000);
}

// --- Event listeners per pulsanti ---

function bindUI() {
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const name = prompt('Nome nuova categoria:');
    if (name) addCategory(name.trim());
  });

  document.getElementById('exportBtn').addEventListener('click', exportData);

  document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    importData(file);
    e.target.value = ''; // reset input
  });

  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);

  document.getElementById('darkModeToggle').addEventListener('click', () => {
    toggleDarkMode();
  });
}

// --- Init esteso ---

function extendedInit() {
  loadZoom();
  loadDarkMode();
  setupEasterEgg();
  bindUI();
}

window.addEventListener('DOMContentLoaded', () => {
  init();
  extendedInit();
  updateCategoryOptions();
});

