// DATA STORAGE STRUCTURE
let data = {
  categories: {}, // categoryName: [ { url, date } ]
  learnedKeywords: [],
  undoStack: [],
  darkMode: false,
  zoomEnabled: false,
  sortBy: 'name' // 'name' or 'date'
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function addLinkFromQuery() {
  const url = getQueryParam('addurl');
  if (!url) return;

  const title = getQueryParam('addtitle') || url;
  const favicon = getQueryParam('addfavicon') || '';

  // Categoria semplice da titolo o 'Uncategorized'
  let category = 'Uncategorized';
  for (const kw of data.learnedKeywords) {
    if (title.toLowerCase().includes(kw.toLowerCase())) {
      category = kw;
      break;
    }
  }

  if (!data.categories[category]) {
    data.categories[category] = [];
  }

  // Evita duplicati
  const exists = data.categories[category].some(l => l.url === url);
  if (!exists) {
    pushUndo();
    data.categories[category].push({
      url,
      title,
      date: new Date().toISOString(),
      favicon
    });
    saveData();
    renderAll();
  }

  // Rimuove la query string
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Chiamala subito all’avvio
addLinkFromQuery();

// LOAD data from localStorage
function loadData() {
  const saved = localStorage.getItem('linkZenData');
  if (saved) {
    data = JSON.parse(saved);
  }
}

// SAVE data to localStorage
function saveData() {
  localStorage.setItem('linkZenData', JSON.stringify(data));
}

// UNDO management
function pushUndo() {
  const snapshot = JSON.stringify(data);
  data.undoStack.push(snapshot);
  if (data.undoStack.length > 20) data.undoStack.shift(); // max 20 undo
}

function undo() {
  if (data.undoStack.length === 0) return alert("Nessuna azione da annullare");
  const last = data.undoStack.pop();
  data = JSON.parse(last);
  renderAll();
  saveData();
}

// RENDER all interface
function renderAll() {
  renderCategories();
  renderLearnedKeywords();
  updateDarkMode();
  updateZoom();
  updateSortOptions();
}

// RENDER categories and links
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
    let links = data.categories[category];

    if (data.sortBy === 'name') {
      links = links.sort((a, b) => a.title.localeCompare(b.title));
    } else if (data.sortBy === 'date') {
      links = links.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    for (const linkObj of links) {
      const li = document.createElement('li');

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

// RENDER parole chiave apprese
function renderLearnedKeywords() {
  const ul = document.getElementById('learnedKeywordsList');
  ul.innerHTML = '';
  for (const kw of data.learnedKeywords) {
    const li = document.createElement('li');
    li.textContent = kw;

    // bottone rimuovi
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✖';
    removeBtn.title = 'Rimuovi parola chiave';
    removeBtn.addEventListener('click', () => {
      pushUndo();
      data.learnedKeywords = data.learnedKeywords.filter(k => k !== kw);
      saveData();
      renderAll();
    });
    li.appendChild(removeBtn);

    ul.appendChild(li);
  }
}

// Aggiungi categoria
function addCategory(name) {
  if (!name) return alert('Inserisci il nome della categoria');
  if (data.categories[name]) return alert('Categoria già esistente');
  pushUndo();
  data.categories[name] = [];
  saveData();
  renderAll();
}

// Aggiungi link manualmente (con data)
function addVisitedLinkManually(url) {
  if (!url) return;
  // prova a trovare categoria in base a parole chiave apprese
  let categoryFound = null;
  for (const kw of data.learnedKeywords) {
    if (url.includes(kw)) {
      categoryFound = kw;
      break;
    }
  }
  if (!categoryFound) categoryFound = 'Generale';

  if (!data.categories[categoryFound]) data.categories[categoryFound] = [];

  // evita duplicati
  if (data.categories[categoryFound].some(l => l.url === url)) {
    alert('Link già salvato in questa categoria');
    return;
  }

  pushUndo();
  data.categories[categoryFound].push({ url: url, date: new Date().toISOString() });
  saveData();
  renderAll();
}

// Cancella tutte parole chiave apprese
function clearLearnedKeywords() {
  if (!confirm('Sei sicuro di voler cancellare tutte le parole chiave apprese?')) return;
  pushUndo();
  data.learnedKeywords = [];
  saveData();
  renderAll();
}

// Dark Mode toggle
function updateDarkMode() {
  const app = document.getElementById('app');
  if (data.darkMode) {
    app.classList.add('dark-mode');
    app.classList.remove('light-mode');
  } else {
    app.classList.remove('dark-mode');
    app.classList.add('light-mode');
  }
}

function toggleDarkMode() {
  data.darkMode = !data.darkMode;
  saveData();
  renderAll();
}

// Zoom testo toggle
function updateZoom() {
  const app = document.getElementById('app');
  if (data.zoomEnabled) {
    app.style.fontSize = '1.2em';
  } else {
    app.style.fontSize = '1em';
  }
}

function toggleZoom() {
  data.zoomEnabled = !data.zoomEnabled;
  saveData();
  renderAll();
}

// Aggiorna radio ordinamento selezionata
function updateSortOptions() {
  const radios = document.querySelectorAll('input[name="sort"]');
  radios.forEach(radio => {
    radio.checked = (radio.value === data.sortBy);
  });
}

// EVENTI DOM READY

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderAll();

  // Controlla se c'è addLink da parametro GET
  const linkToAdd = getQueryParam('addLink');
  if (linkToAdd) {
    addVisitedLinkManually(linkToAdd);
    alert(`Link ${linkToAdd} aggiunto automaticamente!`);
    history.replaceState(null, '', window.location.pathname);
  }

  // bottoni header
  document.getElementById('undoButton').addEventListener('click', undo);
  document.getElementById('exportButton').addEventListener('click', () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linkzen_data.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importButton').addEventListener('click', () => {
    document.getElementById('importOverlay').classList.remove('hidden');
  });

  document.getElementById('closeImportOverlay').addEventListener('click', () => {
    document.getElementById('importOverlay').classList.add('hidden');
  });

  document.getElementById('importFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        pushUndo();
        data = imported;
        saveData();
        renderAll();
        alert('Dati importati con successo');
      } catch {
        alert('File JSON non valido');
      }
      document.getElementById('importOverlay').classList.add('hidden');
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Pulsante salva sito corrente (manuale)
  document.getElementById('saveCurrentButton').addEventListener('click', () => {
    const url = prompt("Inserisci l'URL da salvare:");
    if (url) addVisitedLinkManually(url.trim());
  });

  // Dark mode toggle
  document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);

  // Zoom toggle
  document.getElementById('toggleZoom').addEventListener('click', toggleZoom);

  // Aggiungi categoria
  document.getElementById('addCategoryButton').addEventListener('click', () => {
    const catInput = document.getElementById('categoryInput');
    const val = catInput.value.trim();
    if (val) {
      addCategory(val);
      catInput.value = '';
    }
  });

  // Ordinamento radio buttons
  document.getElementById('sortOptions').addEventListener('change', e => {
    if (e.target.name === 'sort') {
      data.sortBy = e.target.value;
      saveData();
      renderAll();
    }
  });

  // Cancella parole chiave apprese
  document.getElementById('clearLearnedKeywords').addEventListener('click', clearLearnedKeywords);
});
