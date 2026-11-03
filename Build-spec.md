# Build Specification: GST Invoice Generator

This document describes the app as currently built, so it can be maintained or rebuilt. For day-to-day use, see `README.md`.

## 1. Scope

A single-user app for creating Indian GST Tax Invoices on one computer.

**Included:** invoice creation and editing, automatic numbering, saved profiles, filtering and totals, PDF and Excel output, saving to a local MongoDB, and offline use.

**Not included:** login, online storage, multi-device sync, backup and restore buttons, part payments, credit notes, and e-invoicing.

## 2. Technical design

| Area | Decision |
|---|---|
| Stack | Plain HTML, CSS and JavaScript in one file, with no framework or build step |
| Storage | MongoDB (master copy) through `server.js`, with a working copy in browser `localStorage` |
| Navigation | Hash-based routes |
| Server | `server.js` on Node.js 20.19+, using the official `mongodb` driver; started with `npm start` on `127.0.0.1:8081` |
| Offline | Service worker, active only over HTTP or HTTPS (not `file://`) |
| Fonts | Inter and JetBrains Mono from Google Fonts, with system fallbacks |

### Files

| File | Role |
|---|---|
| `invoice-app.html` | All pages, styling and logic |
| `server.js` | Serves the app files and the MongoDB API |
| `package.json` | Server dependency (`mongodb`) and `npm start` |
| `.env.example` | Example settings; a private `.env` overrides them |
| `sw.js` | Offline caching |
| `manifest.webmanifest` | Install metadata |
| `icon-192.png`, `icon-512.png` | App icons |
| `README.md` | User guide |
| `Build-spec.md` | This specification |

The server serves only the app files listed above, never `.env` or `node_modules`. Do not add real invoices or spreadsheets to this folder, because a server or repository could expose them.

## 3. Routes

| Route | Page |
|---|---|
| `#/` | Invoices list |
| `#/new` | New invoice |
| `#/edit/<id>` | Edit invoice |
| `#/view/<id>` | Invoice preview and downloads |
| `#/settings` | Settings |

## 4. Data

### Storage keys

| Key | Type | Contents |
|---|---|---|
| `gst.invoices` | Array | Saved invoices |
| `gst.clients` | Array | Client profiles |
| `gst.businesses` | Array | Business profiles, including bank details |
| `gst.settings` | Object | `seller`, `bank`, `notes`, `theme`, `financialYears`, `activeFy` |
| `gst.wip` | Object | `{ key, inv }`: the one invoice with unsaved changes; never sent to MongoDB |
| `gst.unsynced` | Array | Storage keys changed but not yet saved in MongoDB |

### MongoDB

Database `gst_invoice` (setting `MONGODB_DB`) at `mongodb://127.0.0.1:27017` (setting `MONGODB_URI`).

| Collection | From key | Documents |
|---|---|---|
| `invoices` | `gst.invoices` | One per invoice, `_id` = the invoice `id`; unique index on `number` |
| `clients` | `gst.clients` | One per profile, `_id` = the profile `id` |
| `businesses` | `gst.businesses` | One per profile, `_id` = the profile `id` |
| `settings` | `gst.settings` | One document with `_id` = `settings` |

### API

| Request | Effect |
|---|---|
| `GET /api/data` | Returns `{ invoices, clients, businesses, settings }` |
| `PUT /api/invoices`, `/api/clients`, `/api/businesses` | Replaces the collection with the JSON array sent |
| `PUT /api/settings` | Replaces the settings document |

API requests are accepted only with the host `127.0.0.1:8081` or `localhost:8081`, and only from that origin.

### Sync rules
- Every `store()` of a synced key writes `localStorage`, adds the key to `gst.unsynced`, and queues a PUT. PUTs run one at a time.
- A key leaves `gst.unsynced` only when the copy sent is still the current one.
- On startup the app reads `/api/data` before showing a page. Each key not in `gst.unsynced` takes MongoDB's copy; when MongoDB's copy is empty, the browser copy is sent instead, which copies existing invoices across on first use.
- If the server cannot be reached, the app works from `localStorage` and retries on the next change, reload or window focus. A badge in the top bar shows the state.

### Invoice fields

| Field | Notes |
|---|---|
| `id`, `createdAt`, `updatedAt` | Set when saved |
| `status` | `draft`, `unpaid` or `paid`; new invoices start as `draft` |
| `number` | For example `SAI/001/26-27` |
| `fyMonth` | `apr-mar` or `jan-dec`; stored only |
| `date`, `dcNo`, `dcDate`, `poNo`, `poDate` | Dates stored as `YYYY-MM-DD` |
| `state` | Place of supply, for example `Tamil Nadu / 33` |
| `seller` | `name`, `address`, `email`, `phone`, `gstin`, `state` |
| `client` | `name`, `address`, `phone`, `gstin`, `email`, `state` |
| `items[]` | `desc`, `hsn`, `qty`, `rate` |
| `gstType` | `intra`, `inter` or `exempt` |
| `gstRate` | `5`, `12`, `18` or `28` |
| `discount` | Percentage |
| `roundAuto`, `roundOff` | Automatic or manual rounding |
| `bank` | `company`, `name`, `branch`, `account`, `ifsc` |
| `notes` | Printed when not empty |

Older saved invoices may still contain removed fields (`dueDate`, `bank.type`). They are ignored.

## 5. Business rules

### Calculations
All amounts are rounded to 2 decimal places at each step.

1. Line amount = quantity × rate
2. Subtotal = sum of line amounts
3. Discount = subtotal × discount %, with the percentage limited to 0–100
4. Taxable amount = subtotal − discount
5. Tax:
   - Intra-State: CGST and SGST are each taxable × rate ÷ 2
   - Inter-State: IGST is taxable × rate
   - Exempt: no tax
6. Round-off = nearest rupee − amount, or the manual value when automatic rounding is off
7. Grand total = taxable + tax + round-off

The amount in words uses the Indian system (Thousand, Lakh, Crore), for example `INR One Crore Twenty Three Lakh ... only`.

### Financial year
- The year runs from April to March and is written as `26-27`.
- The current year changes automatically on 1 April.
- A year chosen on the Invoices page is saved in `activeFy` and does not change automatically.
- `fyMonth` does not affect the year calculation.

### Invoice numbers
- The format is `SAI/<serial>/<year>`, with the serial padded to 3 digits. The `SAI` prefix is fixed in the code.
- The next serial is one above the highest `SAI` serial in that year. Each year starts at 001.
- New invoices use `activeFy`, or the current year when it is unset or `all`.
- Numbers can be edited by hand.
- Numbers in other formats are ignored when calculating the next serial.

### Validation when saving
- Required: invoice number, invoice date, seller name, client name, and at least one item with a description.
- Duplicate invoice numbers are rejected.
- Completely blank item rows are removed.
- A warning, which does not block saving, appears for an invalid GSTIN format or a tax type that does not match the seller and client states.
- Quantity and rate accept digits and one decimal point only, so `1,000` becomes `1000`.

### Unsaved changes
- Every edit in the invoice form is saved to `gst.wip`.
- Only one invoice can have unsaved changes. Opening another asks for confirmation before discarding them.
- Saving or discarding clears `gst.wip`.

## 6. Pages

### Invoices
Controls, from top to bottom:

1. **Unsaved changes banner**, with Resume and Discard.
2. **Year buttons:** current and next two years, years from Settings, years found in invoice numbers, the selected year, and All.
3. **Client filter:** case-insensitive partial match.
4. **Month filter:** months with invoices in the selected year, from `date`.
5. **Status buttons:** All, Draft, Unpaid and Paid, each with a count and total.
6. **Invoice list:** newest first, showing client, number, date, amount and status.

Rules:
- The year matches the end of the invoice number. The month matches the invoice date.
- Status totals respect the year, month and client filters, but not the selected status.
- The client, month and status filters last until the page is reloaded. Changing the year resets the month.

### Invoice form
Sections: Invoice Details, From (Seller), Bill To, Line Items, Tax & Discount, Bank Details, and Notes / Terms. A summary panel shows live totals, Discard, and Save & Preview.

- Choosing a Financial Year replaces the number with the next one for that year. It does not change the date.
- Year options are the current and next two years, years from Settings, and the year in the number.
- Selecting a client profile also sets the place of supply when the profile has a state.
- Selecting a business profile also fills the bank details.

### Preview
Contains Back, a status selector, PDF, Excel, Edit, Delete, and the invoice. The status selector saves immediately.

### Settings
Contains the theme, financial years, default business and bank details, default notes, and an install button when the browser offers one. Theme and year changes save immediately; the other details save with **Save Defaults**.

## 7. Invoice layout

From top to bottom:

1. **Header:** `TAX INVOICE`, phone numbers at the top right, business name, address, email, GSTIN, and `State: <name>  Code: <code>`.
2. **Two columns:** `To.` with the client's name, address, cell, email and GSTIN on the left. On the right, level with the client name: invoice number and date, D.C and P.O references with dates, and place-of-supply state and code.
3. **Items table:** SI, Particulars, HSN / SAC, Qty, Rate, Amount.
4. **Two columns:** bank details on the left, and totals with the grand total on the right.
5. **Amount in words**, then notes if present.
6. **Signature:** `For <business>`, 30 mm of clear space for a seal and signature, then `Authorised Signatory`.

Dates print as `DD-MM-YYYY`. Financial Year and Financial Month have no separate line; the year appears only within the invoice number.

## 8. Output

### Screen preview
- The invoice is shown as a full A4 sheet: 794 px wide, with the same 10 mm padding and minimum height as the print. It is scaled down to fit narrower screens.
- It always uses black on white, whatever the theme.

### PDF
Uses the browser's print window, with these print rules:
- A4 with a zero page margin, which prevents browser date, title and URL lines from printing.
- 10 mm of padding inside the invoice, repeated on each page.
- A minimum invoice height of 276 mm, with the items table taking the spare height.
- Light colours forced, which prevents black page margins in dark mode.
- App controls hidden, and table headings repeated on each page.
- Suggested file name: the invoice number with `/` replaced by `-`.

### Excel
- SpreadsheetML (XML) with an `.xls` extension and one sheet named `Tax Invoice`.
- Chrome and Edge use a Save window. Other browsers use a normal download.
- Contains fixed values, with no formulas or signature block.

## 9. Offline behaviour

- The service worker pre-caches the app page, manifest and icons.
- Page loads try the network first, and use the cached copy when offline.
- `/api/` requests are never cached.
- Other requests, including fonts, use the cache first and are cached on first use.
- When cached files need refreshing, change the `CACHE` version in `sw.js`.

## 10. Security and privacy

- Data stays on this computer, in the browser and the local MongoDB. Google Fonts is the only external request.
- User text is escaped before being placed in the page or Excel file.
- Data in `localStorage` and MongoDB is not encrypted, so it relies on the protection of the Windows account.
- The server listens only on `127.0.0.1`, and the API rejects other hosts and origins.
- `.env` can hold a database password; it is in `.gitignore` and never served.
- Do not publish real invoices, spreadsheets or exports.

## 11. Test checklist

- [ ] A new invoice with no earlier invoices shows `SAI/001/<year>`.
- [ ] After saving 001, the next new invoice shows 002.
- [ ] Each year keeps its own serial numbers.
- [ ] 7 × 400 + 3 × 300 at 18% Intra-State totals ₹4,366.00.
- [ ] A duplicate invoice number is rejected.
- [ ] Year, month, client and status filters work together, and the totals are correct.
- [ ] A one-item invoice prints on one full A4 page without browser header lines.
- [ ] The preview matches the printed A4 page, with 30 mm of clear space above `Authorised Signatory`.
- [ ] Printing in dark mode has no black margins.
- [ ] A 45-item invoice continues onto a second page with repeated headings.
- [ ] Excel asks for a save location in Chrome or Edge, and the file opens correctly.
- [ ] On first connection, invoices already in the browser appear in MongoDB.
- [ ] Saving, changing status and deleting update MongoDB, and the badge shows `MongoDB ✓`.
- [ ] With the server stopped, a save shows `MongoDB ✕` and reaches MongoDB after the server restarts and the app is reloaded.
- [ ] After clearing browser data, the app loads every invoice from MongoDB.

## 12. Known limitations

- MongoDB is on the same disk, so it needs regular exports or `mongodump` copies elsewhere. The app has no backup buttons.
- Each save sends the whole list for that key.
- Edits made in Compass while the app is open are overwritten by the app's next save.
- GST rates are fixed in the code and need checking against current notifications.
- The Excel export has no signature block, and opening it can show a format warning.
- Tax can be off by one paisa in rare exact half-paisa cases.
- Resuming an old unsaved edit can overwrite a newer status or bring back a deleted invoice.
- Financial Month is stored but has no effect.
- The `SAI` prefix cannot be changed from Settings.
- Only general GSTIN format is checked, and the 16-character GST limit on invoice numbers is not enforced.
- Navigating to another page in this folder through the server could replace the cached offline app.

## 13. Planned work

1. Backup and Restore buttons.
2. A review of the GST rate list.
3. A signature block in the Excel export.
