// app.js - Funzionalità principali di LinkZen

document.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  const undoButton = document.getElementById("undoButton");
  const exportButton = document.getElementById("exportButton");
  const importButton = document.getElementById("importButton");
  const toggleDarkMode = document.getElementById("toggleDarkMode");
  const toggleZoom = document.getElementById("toggleZoom");
  const importOverlay = document.getElementById("importOverlay");
  const closeImportOverlay = document.getElementById("closeImportOverlay");
  const importFileInput = document.getElementById("importFileInput");
  const addCategoryButton = document.getElementById("addCategoryButton");
  const categoryInput = document.getElementById("categoryInput");
  const categoriesContainer = document.getElementById("categoriesContainer");
  const learnedKeywordsList = document.getElementById("learnedKeywordsList");
  const clearLearnedKeywords = document.getElementById("clearLearnedKeywords");

  let historyStack = [];
  let data = {
    categories: {},
    learnedKeywords: []
  };

  function saveState() {
    historyStack.push(JSON.stringify(data));
    if (historyStack.length > 50) historyStack.shift();
  }

  function undoLastAction() {
    if (historyStack.length > 0) {
      const lastState = historyStack.pop();
      data = JSON.parse(lastState);
      renderAll();
    }
  }

  function toggleTheme() {
    app.classList.toggle("dark-mode");
    app.classList.toggle("light-mode");
  }

  function toggleTextZoom() {
    app.classList.toggle("zoomed");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkzen_data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImportOverlay() {
    importOverlay.classList.remove("hidden");
  }

  function closeOverlay() {
    importOverlay.classList.add("hidden");
  }

  function importDataFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.categories && imported.learnedKeywords) {
          saveState();
          data = imported;
          renderAll();
        } else {
          alert("Dati non validi.");
        }
      } catch {
        alert("Errore durante l'importazione.");
      }
    };
    reader.readAsText(file);
  }

  function addCategory() {
    const categoryName = categoryInput.value.trim();
    if (categoryName && !data.categories[categoryName]) {
      saveState();
      data.categories[categoryName] = [];
      categoryInput.value = "";
      renderCategories();
    }
  }

  function renderCategories() {
    categoriesContainer.innerHTML = "";
    Object.entries(data.categories).forEach(([name, links]) => {
      const section = document.createElement("section");
      const h3 = document.createElement("h3");
      h3.textContent = name;
      section.appendChild(h3);
      const ul = document.createElement("ul");
      links.forEach((link) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = link;
        a.textContent = link;
        a.target = "_blank";
        li.appendChild(a);
        ul.appendChild(li);
      });
      section.appendChild(ul);
      categoriesContainer.appendChild(section);
    });
  }

  function renderLearnedKeywords() {
    learnedKeywordsList.innerHTML = "";
    data.learnedKeywords.forEach((keyword) => {
      const li = document.createElement("li");
      li.textContent = keyword;
      learnedKeywordsList.appendChild(li);
    });
  }

  function renderAll() {
    renderCategories();
    renderLearnedKeywords();
  }

  // Event listeners
  undoButton.addEventListener("click", undoLastAction);
  toggleDarkMode.addEventListener("click", toggleTheme);
  toggleZoom.addEventListener("click", toggleTextZoom);
  exportButton.addEventListener("click", exportData);
  importButton.addEventListener("click", openImportOverlay);
  closeImportOverlay.addEventListener("click", closeOverlay);
  importFileInput.addEventListener("change", importDataFromFile);
  addCategoryButton.addEventListener("click", addCategory);
  clearLearnedKeywords.addEventListener("click", () => {
    saveState();
    data.learnedKeywords = [];
    renderLearnedKeywords();
  });

  // Inizializzazione
  renderAll();
});
