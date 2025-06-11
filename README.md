# LinkZen PWA

**LinkZen PWA** è una Progressive Web App per salvare manualmente link visitati, organizzarli per categorie, ed esportarli. È una versione adattata della Chrome Extension originale.

---

## 🔧 Funzionalità attuali

- ✅ Salvataggio manuale dei link
- ✅ Organizzazione per categoria
- ✅ Modalità scura
- ✅ Esportazione dei link salvati
- ✅ Funziona offline (grazie allo storage locale)
- ✅ Installabile come app su iOS e Android

---

## 📱 Come installarla

1. Apri `index.html` da un server (es. GitHub Pages)
2. Su **Safari iOS** o **Chrome Android**, premi **Condividi > Aggiungi alla schermata Home**
3. L'app sarà accessibile come qualsiasi altra app nativa

---

## 🗂 Struttura dei file

```
📁 linkzen-pwa/
├── index.html             # Interfaccia principale
├── app.js                 # Logica dell'app
├── manifest.webmanifest   # Configurazione PWA
├── icon.png               # Icona dell'app
```

---

## 📤 Esportazione dei link

Puoi esportare tutti i link salvati come file `.txt` per salvarli o condividerli.

---

## ⚠️ Limitazioni rispetto all'estensione

- ❌ Non può accedere direttamente all'URL della tab attiva (limitazione del web)
- ✅ Ma puoi incollare manualmente i link, e salvarli con un clic

---

## 📦 Deployment su GitHub Pages

1. Carica tutti i file su GitHub in una repository pubblica
2. Vai su `Settings > Pages`
3. Scegli `main` come branch e `root` come cartella
4. L'app sarà accessibile da `https://tuo-username.github.io/nome-repo/`

---

## ✍️ Autore

Realizzato da AG Design — basato su LinkZen Chrome Extension.
