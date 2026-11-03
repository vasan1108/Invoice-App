# GST Invoice Generator

A private invoicing app for one person on one computer. It creates GST Tax Invoices and saves them as PDF or Excel. There is no login and no online storage: invoices are saved in MongoDB on this computer, with a working copy in the browser.

## Files

| File | Purpose |
|---|---|
| `invoice-app.html` | The whole app: pages, styling and logic |
| `server.js` | Small Node.js server that opens the app and saves its data in MongoDB |
| `package.json` | Lists the MongoDB driver the server needs |
| `.env.example` | Example settings: MongoDB address, database name and port |
| `sw.js` | Service worker that lets the app open offline once it has been loaded from the server |
| `manifest.webmanifest` | Name, colours and icons used when the app is installed |
| `icon-192.png`, `icon-512.png` | App icons |
| `README.md` | This file |
| `Build-spec.md` | How the app is built: data, rules, layout and test checklist |

## Start the app

Needs Node.js 20.19 or later and MongoDB Server running on this computer (installed as the Windows service "MongoDB").

The first time only, install the MongoDB driver:

```powershell
cd "C:\Users\DELL\Desktop\IYYANAR ANNA\invoice-app"
npm install
```

Then, each time, run this in PowerShell and keep the window open:

```powershell
cd "C:\Users\DELL\Desktop\IYYANAR ANNA\invoice-app"
npm start
```

It prints `Connected to MongoDB` when ready. Open <http://127.0.0.1:8081/invoice-app.html>. Press Ctrl+C or close the window when finished; invoices stay saved.

Use this exact address. The browser keeps its working copy separately for each address.

If the server says it cannot connect, start the MongoDB service (Windows Services, "MongoDB") and try again.

### Settings

The server uses local MongoDB at `mongodb://127.0.0.1:27017`, database `gst_invoice`, port 8081. To change them, copy `.env.example` to `.env` and edit it. For MongoDB Atlas, put its `mongodb+srv://` connection string in `MONGODB_URI`. Keep `.env` private: it can contain the database password, and it is kept off GitHub.

## First-time setup

1. In **Settings**, enter the business and bank details and click **Save Defaults**.
2. On the **Invoices** page, click the financial year to work in.
3. To continue an existing series, type the next number by hand on the first invoice, for example `SAI/087/26-27`. Later numbers follow from it.

## Features

### Invoices page
- **Year buttons:** show the current and next two financial years, any year added in Settings or used by an invoice, and **All**. The choice is remembered and sets the year for new invoices. **All** lists every invoice, and new invoices then use the current year.
- **Client filter:** matches any part of the client name, ignoring capitals.
- **Month filter:** lists months that have invoices in the selected year, based on the Invoice Date.
- **Status buttons:** All, Draft, Unpaid and Paid each show a count and total amount for the selected year, month and client. Click one to list only those invoices. The status resets to All when the page is reloaded.
- **Unsaved work:** a banner offers **Resume** or **Discard** for an invoice that was not saved.

### Invoice form
- **Financial Year:** fills in the next number for that year.
- **Financial Month:** April to March or January to December. It is saved with the invoice but is not printed and does not change anything else.
- **Invoice Number:** the format is `SAI/001/26-27`. The serial is one above the highest in that year, and each year starts at 001. It can be edited by hand, and duplicates are rejected.
- **Seller and client profiles:** saved details can be reused on later invoices.
- **Tax:** Intra-State (CGST + SGST), Inter-State (IGST) or Exempt, with a percentage discount and rounding to the nearest rupee. A warning appears if the tax type does not match the seller and client states.

### Preview and downloads
- **Status:** Draft, Unpaid or Paid.
- **PDF:** choose **Save as PDF** in the print window, then pick a folder. The invoice is made for A4 only. It fills one page, or continues onto more pages if it is long, and the preview shows the same A4 sheet. There is 30 mm of clear space above **Authorised Signatory** for a seal and signature. Browser date, title and web address lines do not print.
- **Excel:** Chrome and Edge ask where to save. Other browsers follow their own download setting. Excel may show a file format warning when opening the file; click **Yes** to open it.

### Settings
- Theme (Light, Dark or System). Printing always uses light colours.
- Default business details, bank details, and notes for new invoices.
- Financial years: add or remove years. Accepted formats are `27-28`, `27/28` and `2027-28`.

## Where the data is stored

The master copy is in MongoDB, database `gst_invoice`. Open it in MongoDB Compass with `mongodb://127.0.0.1:27017`.

| MongoDB collection | Browser key | Contents |
|---|---|---|
| `invoices` | `gst.invoices` | Saved invoices, one document each |
| `clients` | `gst.clients` | Saved client profiles |
| `businesses` | `gst.businesses` | Saved business profiles, including bank details |
| `settings` | `gst.settings` | One document: defaults, theme, added years and the selected year |
| (not saved) | `gst.wip` | The invoice currently being edited but not saved |
| (not saved) | `gst.unsynced` | Changes not yet saved in MongoDB |

How saving works:
- Every change is saved in the browser and sent to MongoDB straight away.
- The badge at the top shows **MongoDB ✓** when everything is saved in MongoDB. **MongoDB ✕** means the server or MongoDB is not reachable. Changes are then kept in the browser and sent on the next change, reload, or when you return to the window.
- When the app opens, it loads everything from MongoDB, so clearing browser data no longer loses invoices.
- The first time the app connects, invoices already in the browser are copied into MongoDB.
- Edit data in Compass only while the app is closed, then reload the app. The app's next save replaces the whole collection with its own copy.
- Deleting every invoice in Compass does not clear the app: an empty collection is filled again from the browser copy.

## Backup

MongoDB keeps the invoices on this computer's disk, so a disk failure still loses them. Back them up regularly to a USB drive, OneDrive or Google Drive:
- In Compass, open each collection and use **Export Data** to save it as JSON.
- Or use `mongodump --db gst_invoice` from the MongoDB Database Tools, and `mongorestore` to load it back.

Saving a PDF of every invoice is still a good extra copy.

## Known issues

- **GST rates:** the options are 5, 12, 18 and 28%. Check them against current GST notifications, because 40%, 3% and 0% are not available.
- **Excel export:** it has no signature block and contains fixed values, not formulas. The file is XML saved as `.xls`, which causes the warning above.
- **Rounding:** tax can be off by one paisa in rare exact half-paisa cases. Rounding to the rupee usually hides this.
- **Resuming old edits:** resuming an unsaved edit can overwrite a status changed since then, and saving it can bring back a deleted invoice.
- **Year and date:** changing the year updates only the number, so set the Invoice Date separately. Changing the year while editing a saved invoice gives it a new number.
- **Year changeover:** a year clicked on the Invoices page stays selected after 1 April until another is chosen.
- **Invoice numbers:** nothing enforces the 16-character GST limit. A number without a year at the end appears only under **All**.
- **GSTIN check:** only the general format is checked, not whether the code matches the state.
- **Offline copy:** opening another page through the server could replace the saved offline copy of the app.
- **Saving to MongoDB:** each save sends the whole list of invoices, which is fine for thousands of invoices but slower for very large numbers.
