function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Errore nel loadData:", key, e);
    return null;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Errore nel saveData:", key, e);
  }
}

function removeData(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Errore nel removeData:", key, e);
  }
}