# GST Invoice Generator

A private invoicing app for one person on one computer. It creates GST Tax Invoices and saves them as PDF or Excel. There is no login and no online storage: invoices stay in the browser on this computer.

## Files

| File | Purpose |
|---|---|
| `invoice-app.html` | The whole app: pages, styling and logic |
| `sw.js` | Service worker that lets the app open offline once it has been loaded from the server |
| `manifest.webmanifest` | Name, colours and icons used when the app is installed |
| `icon-192.png`, `icon-512.png` | App icons |
| `README.md` | This file |
| `Build-spec.md` | How the app is built: data, rules, layout and test checklist |

## Start the app

Run this in PowerShell and keep the window open:

```powershell
python -m http.server 8081 --bind 127.0.0.1 --directory "C:\Users\DELL\Desktop\invoice-app"
```

Then open <http://127.0.0.1:8081/invoice-app.html>. Close the window when finished; invoices stay saved.

Always use the same browser and this exact address. The browser stores invoices separately for each address, so `localhost` or another port opens an empty app. If the folder moves, update the path in the command.

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

Data is in the browser's `localStorage`, not in this folder:

| Key | Contents |
|---|---|
| `gst.invoices` | Saved invoices |
| `gst.clients` | Saved client profiles |
| `gst.businesses` | Saved business profiles, including bank details |
| `gst.settings` | Defaults, theme, added years and the selected year |
| `gst.wip` | The invoice currently being edited but not saved |

**Clearing browser data for this site can permanently delete all of it.** Copying this folder does not back up invoices.

## Backup

The app has no backup or restore feature yet.

For now, save a PDF of every invoice to a folder that is also copied to a USB drive, OneDrive or Google Drive. The app cannot load those files back in. If browser data is lost, the invoices disappear from the app and the next number has to be typed by hand.

The planned solution is automatic saving to a chosen local folder, Backup and Restore buttons, and a regular copy to a USB drive.

## Known issues

- **GST rates:** the options are 5, 12, 18 and 28%. Check them against current GST notifications, because 40%, 3% and 0% are not available.
- **Excel export:** it has no signature block and contains fixed values, not formulas. The file is XML saved as `.xls`, which causes the warning above.
- **Rounding:** tax can be off by one paisa in rare exact half-paisa cases. Rounding to the rupee usually hides this.
- **Resuming old edits:** resuming an unsaved edit can overwrite a status changed since then, and saving it can bring back a deleted invoice.
- **Year and date:** changing the year updates only the number, so set the Invoice Date separately. Changing the year while editing a saved invoice gives it a new number.
- **Year changeover:** a year clicked on the Invoices page stays selected after 1 April until another is chosen.
- **Invoice numbers:** nothing enforces the 16-character GST limit. A number without a year at the end appears only under **All**.
- **GSTIN check:** only the general format is checked, not whether the code matches the state.
- **Offline copy:** opening another page in this folder through the server could replace the saved offline copy of the app.
