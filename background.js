// Quando l'estensione viene installata o aggiornata
chrome.runtime.onInstalled.addListener(() => {
  // Crea la voce nel menu contestuale
  chrome.contextMenus.create({
    id: "saveToKnowledge",
    title: "✨ Add in LinkZen",
    contexts: ["page"]
  });
});

// Logica di apprendimento IA filtrata
function extractKeywords(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\d\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function learnFromManualOverride(entry, newCategory) {
  if (newCategory === "Other") return;
  const titleWords = extractKeywords(entry.title);
  const urlWords = extractKeywords(entry.url);
  const uniqueWords = titleWords.filter(w => !urlWords.includes(w));

  const extraStopwords = ["about", "login", "index", "html", "page", "home", "email"];
  const noiseWords = ["product", "video", "media", "main", "category", "default"];
  const stopwords = [
    "the", "and", "you", "for", "are", "with", "that", "have", "this", "but", "not",
    "from", "they", "your", "all", "was", "can", "has", "will", "their", "there"
  ];
  const combinedStopwords = new Set([...stopwords, ...extraStopwords, ...noiseWords]);

  const filteredWords = uniqueWords
    .filter(w =>
      w.length >= 5 &&
      !combinedStopwords.has(w) &&
      !/^\d+$/.test(w)
    );

  try {
    const hostname = new URL(entry.url).hostname.replace(/^www\./, "");
    if (hostname.length >= 5) {
      filteredWords.unshift(hostname);
    }
  } catch (e) {}

  const finalWords = Array.from(new Set(filteredWords)).slice(0, 5);
  if (finalWords.length === 0) return;

  chrome.storage.local.get({ keywordToCategory: {} }, (data) => {
    const updatedMap = { ...data.keywordToCategory };
    finalWords.forEach(word => {
      updatedMap[word] = newCategory;
    });
    chrome.storage.local.set({ keywordToCategory: updatedMap });
  });
}

// Quando l'utente clicca sul menu contestuale
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "saveToKnowledge" && tab?.url && tab?.title) {
    const entry = {
      title: tab.title,
      url: tab.url,
      category: "Other",
      originalCategory: "Other"
    };

    chrome.storage.local.get({ visitedUrls: [] }, (data) => {
      const existing = data.visitedUrls;
      const alreadySaved = existing.some(i => i.url === entry.url);
      if (!alreadySaved) {
        existing.unshift(entry);
        chrome.storage.local.set({ visitedUrls: existing });
        learnFromManualOverride(entry, "Other");
      }
    });
  }
});