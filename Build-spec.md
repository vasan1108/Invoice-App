# Build Specification: GST Invoice Generator

This document describes the app as currently built, so it can be maintained or rebuilt. For day-to-day use, see `README.md`.

## 1. Scope

A single-user app for creating Indian GST Tax Invoices on one computer.

**Included:** invoice creation and editing, automatic numbering, saved profiles, filtering and totals, PDF and Excel output, and offline use.

**Not included:** login, online storage or sync, backup and restore, part payments, credit notes, and e-invoicing.

## 2. Technical design

| Area | Decision |
|---|---|
| Stack | Plain HTML, CSS and JavaScript in one file, with no framework or build step |
| Storage | Browser `localStorage`, saved as JSON |
| Navigation | Hash-based routes |
| Hosting | Any static file server; locally `python -m http.server 8081 --bind 127.0.0.1` |
| Offline | Service worker, active only over HTTP or HTTPS (not `file://`) |
| Fonts | Inter and JetBrains Mono from Google Fonts, with system fallbacks |

### Files

| File | Role |
|---|---|
| `invoice-app.html` | All pages, styling and logic |
| `sw.js` | Offline caching |
| `manifest.webmanifest` | Install metadata |
| `icon-192.png`, `icon-512.png` | App icons |
| `README.md` | User guide |
| `Build-spec.md` | This specification |

The app needs no other files. Do not add real invoices or spreadsheets to this folder, because a server or repository could expose them.

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
| `gst.wip` | Object | `{ key, inv }`: the one invoice with unsaved changes |

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
- Other requests, including fonts, use the cache first and are cached on first use.
- When cached files need refreshing, change the `CACHE` version in `sw.js`.

## 10. Security and privacy

- Data stays in the browser, and the app sends no invoice data anywhere. Google Fonts is the only external request.
- User text is escaped before being placed in the page or Excel file.
- Data in `localStorage` is not encrypted, so it relies on the protection of the Windows account.
- Bind the local server to `127.0.0.1`.
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

## 12. Known limitations

- There is no backup or restore, so clearing browser data can lose everything.
- GST rates are fixed in the code and need checking against current notifications.
- The Excel export has no signature block, and opening it can show a format warning.
- Tax can be off by one paisa in rare exact half-paisa cases.
- Resuming an old unsaved edit can overwrite a newer status or bring back a deleted invoice.
- Financial Month is stored but has no effect.
- The `SAI` prefix cannot be changed from Settings.
- Only general GSTIN format is checked, and the 16-character GST limit on invoice numbers is not enforced.
- Navigating to another page in this folder through the server could replace the cached offline app.

## 13. Planned work

1. Automatic saving to a chosen local folder, with Backup and Restore buttons.
2. A review of the GST rate list.
3. A signature block in the Excel export.
