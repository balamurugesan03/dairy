# Business (Private Firm) Module — Complete Documentation

> DairysocietyERP | Business Type: **Private Firm** | Isolated from Dairy Cooperative modules

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow Diagram](#2-data-flow-diagram)
3. [API Endpoints](#3-api-endpoints)
4. [Database Models](#4-database-models)
5. [Controllers & Functions](#5-controllers--functions)
6. [Frontend API Service](#6-frontend-api-service)
7. [Frontend Routes](#7-frontend-routes)
8. [Reports Module — Data Sources](#8-reports-module--data-sources)
9. [Accounting Architecture](#9-accounting-architecture)
10. [Key Field Mapping (Dairy vs Business)](#10-key-field-mapping-dairy-vs-business)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    PRIVATE FIRM (Business)                       │
│                                                                  │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │  Inventory  │   │    Sales     │   │    Accounting      │   │
│  │─────────────│   │──────────────│   │────────────────────│   │
│  │BusinessItem │──▶│BusinessSales │──▶│BusinessVoucher     │   │
│  │BusinessStock│   │(INV/EST/DC)  │   │BusinessLedger      │   │
│  │Transaction  │   │              │   │                    │   │
│  └─────────────┘   └──────────────┘   └────────────────────┘   │
│          │                │                      │              │
│          │         ┌──────▼──────┐               │              │
│  ┌───────▼──────┐  │  Customers  │    ┌──────────▼─────────┐   │
│  │  Suppliers   │  │  Suppliers  │    │   Vyapar Reports   │   │
│  │BusinessSuppl.│  │BusinessCust.│    │  (23 report types) │   │
│  └──────────────┘  └─────────────┘    └────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Additional Modules                                      │   │
│  │  Quotation (EST) → Invoice | Warranty (WRT) | Machine   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Key isolation rule:** All business queries use `companyId` + business-specific models.
- Business inventory → `BusinessItem`, `BusinessStockTransaction`
- Business accounting → `BusinessLedger`, `BusinessVoucher`
- **Never** uses `Item`, `StockTransaction`, `Ledger`, `Voucher` (those are Dairy)

---

## 2. Data Flow Diagram

### Sales Invoice Flow

```
User creates invoice (BusinessBillingForm)
        │
        ▼
POST /api/business-sales
        │
        ▼
createBusinessSale()
  ├── Generate invoice number (INV/SRN/EST/DC/PI + YYMM + 4-digit seq)
  ├── Calculate totals (qty × rate, discounts, GST CGST/SGST/IGST)
  ├── Save BusinessSales document
  ├── Update BusinessItem.currentBalance (for Sale / Sale Return)
  ├── Create BusinessStockTransaction (Stock Out)
  └── Create BusinessVoucher (double-entry)
        ├── Dr: Cash/Bank/Debtor (who pays)
        ├── Cr: Sales Account (revenue)
        ├── Cr: CGST Output / SGST Output (tax)
        ├── Dr: Cost of Goods Sold
        └── Cr: Stock In Hand (COGS entry)
```

### Stock Purchase (Stock In) Flow

```
User records purchase (BusinessStockInModal)
        │
        ▼
POST /api/business-inventory/stock/in
        │
        ▼
businessStockIn()
  ├── Find BusinessItem by itemId
  ├── Update BusinessItem.currentBalance += qty
  ├── Save BusinessStockTransaction (Stock In, referenceType: Purchase)
  └── Create BusinessVoucher
        ├── Dr: Purchase Account (category-based ledger)
        ├── Dr: CGST Input / SGST Input (tax)
        └── Cr: Cash / Bank / Sundry Creditors
```

### Expense Voucher Flow

```
User enters expense (BusinessExpenseVoucher)
        │
        ▼
POST /api/business-accounting/expense-voucher
        │
        ▼
createExpenseVoucher()
  ├── Dr: Selected Expense Ledger (amount)
  └── Cr: Cash-in-Hand (amount)
  → Updates both ledger currentBalance values
  → Appears in Cashbook (paymentMode=Cash) on DEBIT (Dr) side
```

### Report Data Fetch Flow

```
Frontend (VyaparReportsHub) → User selects report
        │
        ▼
GET /api/reports/vyapar/<report-name>?startDate=&endDate=&companyId=
        │
        ▼
vyaparReportsController.<function>()
  ├── Queries: BusinessSales, BusinessStockTransaction, BusinessVoucher,
  │            BusinessLedger, BusinessItem, BusinessCustomer, BusinessSupplier
  ├── Filters by: companyId + date range
  └── Returns: formatted report data → Frontend renders
```

---

## 3. API Endpoints

### Business Sales — `/api/business-sales`

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| GET | `/` | `getAllBusinessSales` | List all invoices with filters |
| POST | `/` | `createBusinessSale` | Create invoice + update stock + create voucher |
| GET | `/summary` | `getBusinessSalesSummary` | Dashboard totals |
| GET | `/:id` | `getBusinessSaleById` | Single invoice details |
| PUT | `/:id` | `updateBusinessSale` | Edit invoice |
| DELETE | `/:id` | `deleteBusinessSale` | Delete invoice |
| GET | `/party/:partyId/history` | `getPartySalesHistory` | Customer purchase history |

### Business Inventory — `/api/business-inventory`

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| POST | `/items` | `createBusinessItem` | Create item |
| GET | `/items` | `getAllBusinessItems` | List items (search, status, category filters) |
| GET | `/items/:id` | `getBusinessItemById` | Item details |
| PUT | `/items/:id` | `updateBusinessItem` | Edit item |
| DELETE | `/items/:id` | `deleteBusinessItem` | Delete item |
| PATCH | `/items/:id/opening-balance` | `updateBusinessOpeningBalance` | Set opening stock |
| PATCH | `/items/:id/prices` | `updateBusinessSalesPrice` | Update price tiers |
| POST | `/stock/in` | `businessStockIn` | Record purchase/receipt |
| POST | `/stock/out` | `businessStockOut` | Record issue/sale |
| GET | `/stock/transactions` | `getBusinessStockTransactions` | Stock movement list |
| GET | `/stock/transactions/:id` | `getBusinessStockTransactionById` | Transaction detail |
| PUT | `/stock/transactions/:id` | `updateBusinessStockTransaction` | Edit transaction |
| DELETE | `/stock/transactions/:id` | `deleteBusinessStockTransaction` | Delete transaction |
| GET | `/stock/balance` | `getBusinessStockBalance` | Current stock levels |

### Business Accounting — `/api/business-accounting`

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| POST | `/ledgers` | `createBusinessLedger` | Create ledger account |
| GET | `/ledgers` | `getAllBusinessLedgers` | Chart of accounts |
| GET | `/ledgers/:id` | `getBusinessLedgerById` | Ledger + transaction history |
| PUT | `/ledgers/:id` | `updateBusinessLedger` | Edit ledger |
| DELETE | `/ledgers/:id` | `deleteBusinessLedger` | Delete ledger |
| POST | `/vouchers` | `createBusinessVoucher` | Journal entry (full double-entry) |
| GET | `/vouchers` | `getAllBusinessVouchers` | All vouchers |
| GET | `/vouchers/:id` | `getBusinessVoucherById` | Voucher details |
| DELETE | `/vouchers/:id` | `deleteBusinessVoucher` | Delete voucher |
| POST | `/income-voucher` | `createIncomeVoucher` | Simplified income entry |
| POST | `/expense-voucher` | `createExpenseVoucher` | Simplified expense entry |
| POST | `/journal-voucher` | `createJournalVoucher` | Journal adjustment |

### Business Customers — `/api/business-customers`

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| POST | `/` | `createBusinessCustomer` | Create customer |
| GET | `/` | `getAllBusinessCustomers` | Customer list |
| GET | `/search` | `searchBusinessCustomer` | Search by name/phone |
| GET | `/:id` | `getBusinessCustomerById` | Customer details |
| PUT | `/:id` | `updateBusinessCustomer` | Edit customer |
| DELETE | `/:id` | `deleteBusinessCustomer` | Delete customer |

### Business Suppliers — `/api/business-suppliers`

| Method | Path | Function | Description |
|--------|------|----------|-------------|
| POST | `/` | `createBusinessSupplier` | Create supplier |
| GET | `/` | `getAllBusinessSuppliers` | Supplier list |
| GET | `/search` | `searchBusinessSupplier` | Search by name/phone |
| GET | `/next-id` | (utility) | Generate next supplier ID |
| GET | `/:id` | `getBusinessSupplierById` | Supplier details |
| PUT | `/:id` | `updateBusinessSupplier` | Edit supplier |
| DELETE | `/:id` | `deleteBusinessSupplier` | Delete supplier |

### Vyapar Reports — `/api/reports/vyapar`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sale-report` | Sales transactions |
| GET | `/purchase-report` | Purchase transactions |
| GET | `/party-statement` | Customer/supplier ledger |
| GET | `/cashflow` | Cash in/out by mode |
| GET | `/cash-in-hand` | Cash balance |
| GET | `/all-transactions` | All voucher entries |
| GET | `/profit-loss` | P&L statement |
| GET | `/balance-sheet` | Balance sheet |
| GET | `/bill-profit` | Profit per invoice |
| GET | `/party-profit` | Profit by customer |
| GET | `/trial-balance` | Trial balance |
| GET | `/stock-summary` | Stock by category |
| GET | `/stock-statement` | Stock mutations |
| GET | `/item-by-party` | Items sold by customer |
| GET | `/item-profit` | Profit per item |
| GET | `/low-stock` | Low stock alerts |
| GET | `/bank-statement` | Bank transactions |
| GET | `/all-parties` | All party summary |
| GET | `/gstr1` | GST outward supplies |
| GET | `/gstr2` | GST inward purchases |
| GET | `/day-book` | Daily transaction log |
| GET | `/cash-book` | Daily cash movements |
| GET | `/trading-account` | Trading account |

---

## 4. Database Models

### BusinessSales

```
Collection: BusinessSales
Purpose   : Every sales invoice (Sale / Return / Estimate / DC / Proforma)
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| invoiceNumber | String | ✓ | Unique per company. INV/SRN/EST/DC/PI + YYMM + seq |
| invoiceDate | Date | ✓ | Default: now |
| invoiceType | Enum | – | Sale, Sale Return, Estimate, Delivery Challan, Proforma |
| partyId | ObjectId → BusinessCustomer | – | Nullable for walk-in |
| partyName / partyPhone / partyAddress / partyGstin / partyState | String | – | Denormalized |
| salesmanId / salesmanName | ObjectId / String | – | Salesman reference |
| items[] | Array | ✓ | itemId, itemName, hsnCode, qty, freeQty, unit, rate, discountPercent, discountAmount, taxableAmount, gstPercent, cgstAmount, sgstAmount, igstAmount, totalAmount |
| totalQty / grossAmount / itemDiscount | Number | – | Item-level aggregates |
| billDiscount / billDiscountPercent | Number | – | Invoice-level discount |
| taxableAmount / totalCgst / totalSgst / totalIgst / totalGst | Number | – | GST amounts |
| roundOff / grandTotal | Number | ✓ | Final billed amount |
| previousBalance / totalDue | Number | – | Credit party balances |
| paymentMode | Enum | – | Cash, Credit, Bank, UPI, Card, Cheque |
| paymentStatus | Enum | – | Paid, Partial, Unpaid |
| paidAmount / balanceAmount | Number | – | Payment tracking |
| bankName / chequeNumber / chequeDate / transactionId | String | – | Bank payment details |
| poNumber / poDate / ewaybillNumber / vehicleNumber / transportName / lrNumber | String | – | Logistics |
| notes / termsAndConditions | String | – | Remarks |
| voucherId | ObjectId → BusinessVoucher | – | Linked accounting entry |
| businessType | String | – | Default: "Private Firm" |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

---

### BusinessItem

```
Collection: BusinessItem
Purpose   : Item/product master for Private Firm inventory
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| itemCode | String | – | Unique per company (sparse) |
| itemName | String | ✓ | Product name |
| category | String | – | Links to category-based ledgers |
| measurement | String | ✓ | Primary unit (kg, litre, pcs…) |
| unit | String | – | Secondary unit |
| openingBalance / currentBalance | Number | – | Stock quantities |
| purchasePrice | Number | – | Cost price (used for COGS) |
| salesRate / wholesalePrice / retailPrice / mrp | Number | – | Selling price tiers |
| gstPercent | Number | – | 0-100 |
| hsnCode / barcode | String | – | Product codes |
| purchaseLedger / salesLedger | ObjectId → BusinessLedger | – | Category ledgers |
| supplier | ObjectId → Supplier | – | Default supplier (optional) |
| lowStockAlert | Number | – | Reorder level |
| status | Enum | – | Active / Inactive |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

---

### BusinessStockTransaction

```
Collection: BusinessStockTransaction
Purpose   : Every inventory movement (purchase, sale, return, adjustment)
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| itemId | ObjectId → BusinessItem | ✓ | Item reference |
| transactionType | Enum | ✓ | Stock In / Stock Out |
| quantity / freeQty | Number | ✓ / – | Quantities |
| rate | Number | – | Unit cost |
| referenceType | Enum | ✓ | Purchase, Sale, Opening, Adjustment, Return, Sales Return, Transfer |
| referenceId | ObjectId | – | Link to BusinessSales or purchase doc |
| balanceAfter | Number | ✓ | Stock balance after this transaction |
| date / purchaseDate / invoiceDate | Date | – | Transaction dates |
| invoiceNumber / supplierName / supplierId | String/ObjectId | – | Purchase invoice details |
| paymentMode | Enum | – | Credit, Cash, Bank, UPI, N/A |
| paidAmount / totalAmount / grossTotal / discount / gstAmount / netTotal | Number | – | Invoice financial fields |
| voucherId | ObjectId → BusinessVoucher | – | Linked accounting voucher |
| notes | String | – | Remarks |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

---

### BusinessVoucher

```
Collection: BusinessVoucher
Purpose   : Every double-entry accounting record for Private Firm
Pre-save  : Validates totalDebit == totalCredit (±0.01), sets financialYear
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| voucherNumber | String | ✓ | BIN/BEX/BJV/BCT/BRV/BPV/BSAL/BPUR/BCN/BDN + YYMM + seq |
| voucherType | Enum | ✓ | Receipt, Payment, Journal, Contra, Income, Expense, Sales, Purchase, CreditNote, DebitNote, FarmerPayment, LoanDisbursal, AdvancePayment, BulkBankTransfer, GSTPayment, TDSPayment, OpeningBalance |
| date | Date | ✓ | Voucher date |
| financialYear | String | – | Auto-calculated on pre-save |
| entries[] | Array | ✓ | ledgerId, type (debit/credit), amount, description, isGSTLine, gstComponent, gstRate, isStockLine, itemId, quantity, unitCost |
| totalDebit / totalCredit | Number | – | Must be equal (validated) |
| narration | String | – | Voucher description |
| paymentMode | Enum | – | Cash, Bank, UPI, Card, Cheque |
| bankName / chequeNumber / chequeDate / transactionId | String | – | Bank details |
| referenceType | Enum | – | BusinessSales, BusinessPurchase, Manual, Opening, MilkPurchase, MilkSales, FarmerPayment, etc. |
| referenceId / referenceNumber | ObjectId / String | – | Source document link |
| partyId / partyName | ObjectId / String | – | Party reference |
| status | Enum | – | Draft, Posted, Cancelled (default: Posted) |
| businessType | String | – | Default: "Private Firm" |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

---

### BusinessLedger

```
Collection: BusinessLedger
Purpose   : Chart of accounts for Private Firm (Tally-style groups)
Pre-save  : Auto-derives nature from GROUP_NATURE_MAP
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| name | String | ✓ | Account name |
| code | String | – | Auto-generated (B + group prefix + seq) |
| group | Enum | ✓ | Cash-in-Hand, Bank Accounts, Sundry Debtors, Sundry Creditors, Sales Accounts, Purchase Accounts, Direct/Indirect Expenses, Direct/Indirect Incomes, Fixed Assets, Current Assets, Current Liabilities, Capital Account, Loans & Advances, Duties & Taxes, Stock-in-Hand, etc. |
| nature | Enum | Auto | Asset, Liability, Income, Expense, Equity (derived from group) |
| type | Enum | ✓ | Asset, Liability, Income, Expense, Equity |
| openingBalance / currentBalance | Number | – | Balance amounts |
| openingBalanceType | Enum | – | Debit / Credit |
| partyDetails{} | Object | – | contactPerson, phone, email, address, gstNumber, panNumber, creditLimit, creditDays |
| bankDetails{} | Object | – | bankName, accountNumber, ifscCode, branch, accountType |
| status | Enum | – | Active / Inactive |
| businessType | String | – | Default: "Private Firm" |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

**Balance update rule (`applyLedgerBalanceChange`):**
- Debit-normal (Assets, Expenses): Debit → balance ↑, Credit → balance ↓
- Credit-normal (Liabilities, Income, Equity): Credit → balance ↑, Debit → balance ↓

---

### BusinessCustomer / BusinessSupplier

```
Collections: BusinessCustomer, BusinessSupplier
Purpose    : Party master for sales (customers) and purchases (suppliers)
```

| Field | Type | Req | Notes |
|-------|------|-----|-------|
| customerId / supplierId | String | ✓ | Unique per company |
| name | String | ✓ | Party name |
| phone | String | ✓ | Contact number |
| email / gstNumber / panNumber | String | – | Tax / contact details |
| address / state / district / pincode | String | – | Address |
| openingBalance | Number | – | Starting balance |
| creditLimit / creditDays | Number | – | Credit terms |
| bankName / accountNumber / ifscCode | String | – | Supplier only: bank details |
| active | Boolean | – | Status flag |
| companyId | ObjectId → Company | ✓ | Multi-tenant filter |

---

## 5. Controllers & Functions

### businessSalesController.js

| Function | Description |
|----------|-------------|
| `generateInvoiceNumber(prefix, companyId)` | Atomic counter: INV/SRN/EST/DC/PI + YYMM + 4-digit seq |
| `getOrCreateBusinessLedger(name, group, type, companyId)` | Find or auto-create a system ledger |
| `createBusinessSale(req, res)` | Create invoice → update stock → create double-entry voucher |
| `getAllBusinessSales(req, res)` | List invoices with date/party/type/status filters + pagination |
| `getBusinessSaleById(req, res)` | Single invoice |
| `updateBusinessSale(req, res)` | Edit invoice (re-adjusts stock + voucher) |
| `deleteBusinessSale(req, res)` | Delete invoice (reverses stock + voucher) |
| `getPartySalesHistory(req, res)` | All sales for a customer |
| `getBusinessSalesSummary(req, res)` | Dashboard totals (total, paid, pending, tax) |

### businessInventoryController.js

| Function | Description |
|----------|-------------|
| `findOrCreateCategoryLedger(category, companyId)` | Auto-create Purchase/Sales ledger per category |
| `createBusinessStockTransaction(data)` | Internal helper to record stock movement |
| `createBusinessItem(req, res)` | Create item with opening stock transaction |
| `getAllBusinessItems(req, res)` | List with search/category/status filters |
| `getBusinessItemById(req, res)` | Item details |
| `updateBusinessItem(req, res)` | Edit item |
| `deleteBusinessItem(req, res)` | Delete item |
| `businessStockIn(req, res)` | Record purchase: +stock, create voucher Dr Purchase/Cr Cash |
| `businessStockOut(req, res)` | Record issue: -stock, create voucher Dr COGS/Cr Stock |
| `getBusinessStockTransactions(req, res)` | Stock movements with filters |
| `getBusinessStockTransactionById(req, res)` | Single transaction |
| `updateBusinessStockTransaction(req, res)` | Edit transaction |
| `deleteBusinessStockTransaction(req, res)` | Delete transaction |
| `getBusinessStockBalance(req, res)` | Current stock levels per item |
| `updateBusinessOpeningBalance(req, res)` | Set opening stock |
| `updateBusinessSalesPrice(req, res)` | Update price tiers |

### businessAccountingController.js

| Function | Description |
|----------|-------------|
| `applyLedgerBalanceChange(ledger, entryType, amount)` | **Exported** — Nature-aware balance update |
| `generateBusinessVoucherNumber(voucherType, companyId)` | **Exported** — Atomic voucher number generator |
| `createBusinessLedger(req, res)` | Create ledger with duplicate name check |
| `getAllBusinessLedgers(req, res)` | List ledgers (search, group, type filters) |
| `getBusinessLedgerById(req, res)` | Ledger + running balance + transaction history |
| `updateBusinessLedger(req, res)` | Edit ledger name / opening balance |
| `deleteBusinessLedger(req, res)` | Delete ledger (checks for existing vouchers) |
| `createBusinessVoucher(req, res)` | Double-entry journal with balance validation |
| `getAllBusinessVouchers(req, res)` | Voucher list with date/type filters + pagination |
| `getBusinessVoucherById(req, res)` | Voucher with all entries |
| `deleteBusinessVoucher(req, res)` | Delete voucher + reverse ledger balances |
| `createIncomeVoucher(req, res)` | Simplified: Dr Cash / Cr Income Ledger |
| `createExpenseVoucher(req, res)` | Simplified: Dr Expense Ledger / Cr Cash |
| `createJournalVoucher(req, res)` | Free-form double-entry journal |

---

## 6. Frontend API Service

### api.js — Business APIs

```javascript
// Items
businessItemAPI.getAll(params)
businessItemAPI.getById(id)
businessItemAPI.create(data)
businessItemAPI.update(id, data)
businessItemAPI.delete(id)
businessItemAPI.updateOpeningBalance(id, data)
businessItemAPI.updatePrices(id, data)

// Stock
businessStockAPI.stockIn(data)
businessStockAPI.stockOut(data)
businessStockAPI.getTransactions(params)
businessStockAPI.getBalance(params)
businessStockAPI.getById(id)
businessStockAPI.update(id, data)
businessStockAPI.delete(id)

// Sales
businessSalesAPI.getAll(params)
businessSalesAPI.getById(id)
businessSalesAPI.create(data)
businessSalesAPI.update(id, data)
businessSalesAPI.delete(id)
businessSalesAPI.getPartyHistory(partyId)
businessSalesAPI.getSummary(params)

// Ledgers
businessLedgerAPI.getAll(params)
businessLedgerAPI.getById(id, params)
businessLedgerAPI.create(data)
businessLedgerAPI.update(id, data)
businessLedgerAPI.delete(id)

// Vouchers
businessVoucherAPI.getAll(params)
businessVoucherAPI.getById(id)
businessVoucherAPI.create(data)
businessVoucherAPI.delete(id)
businessVoucherAPI.createIncome(data)
businessVoucherAPI.createExpense(data)
businessVoucherAPI.createJournal(data)

// Customers
businessCustomerAPI.getAll(params)
businessCustomerAPI.getById(id)
businessCustomerAPI.create(data)
businessCustomerAPI.update(id, data)
businessCustomerAPI.delete(id)
businessCustomerAPI.search(query)

// Suppliers
businessSupplierAPI.getAll(params)
businessSupplierAPI.getById(id)
businessSupplierAPI.getNextId()
businessSupplierAPI.create(data)
businessSupplierAPI.update(id, data)
businessSupplierAPI.delete(id)
businessSupplierAPI.search(query)
```

### api.js — Vyapar Reports APIs

```javascript
reportAPI.vyaparSaleReport(params)        // Sales report
reportAPI.vyaparPurchaseReport(params)    // Purchase report
reportAPI.vyaparPartyStatement(params)    // Party ledger
reportAPI.vyaparCashflow(params)          // Cash flow
reportAPI.vyaparCashInHand(params)        // Cash balance
reportAPI.vyaparAllTransactions(params)   // All ledger entries
reportAPI.vyaparProfitLoss(params)        // P&L
reportAPI.vyaparBalanceSheet(params)      // Balance sheet
reportAPI.vyaparBillWiseProfit(params)    // Bill-wise profit
reportAPI.vyaparPartyWiseProfit(params)   // Party-wise profit
reportAPI.vyaparTrialBalance(params)      // Trial balance
reportAPI.vyaparStockSummary(params)      // Stock summary
reportAPI.vyaparStockStatement(params)    // Stock statement
reportAPI.vyaparItemByParty(params)       // Item by party
reportAPI.vyaparItemWiseProfit(params)    // Item-wise profit
reportAPI.vyaparLowStockSummary(params)   // Low stock
reportAPI.vyaparBankStatement(params)     // Bank statement
reportAPI.vyaparAllParties(params)        // All parties
reportAPI.vyaparGSTR1(params)             // GSTR-1
reportAPI.vyaparGSTR2(params)             // GSTR-2
reportAPI.vyaparDayBook(params)           // Day book
reportAPI.vyaparCashBook(params)          // Cash book
reportAPI.vyaparTradingAccount(params)    // Trading account
```

---

## 7. Frontend Routes

| Route Path | Component | Purpose |
|-----------|-----------|---------|
| `/business-customers` | BusinessCustomerList | Customer master |
| `/business-suppliers` | BusinessSupplierList | Supplier master |
| `/business-inventory` | BusinessItemList | Item master |
| `/business-inventory/stock-in` | BusinessStockInManagement | Record purchases |
| `/business-inventory/stock-out` | BusinessStockInManagement | Record stock issue |
| `/business-inventory/stock-report` | BusinessStockReport | Stock status |
| `/business-inventory/sales/new` | BusinessBillingForm | Create invoice |
| `/business-inventory/sales/list` | BusinessSalesList | View invoices |
| `/business-inventory/sales/edit/:id` | BusinessBillingForm | Edit invoice |
| `/business-inventory/sales/print/:id` | BusinessSalesInvoicePrint | Print invoice |
| `/business-inventory/purchase-returns/new` | PurchaseReturnForm | Debit note |
| `/business-inventory/purchase-returns/list` | PurchaseReturnList | Debit notes list |
| `/business-inventory/sales-returns/new` | PurchaseReturnForm | Credit note |
| `/business-inventory/sales-returns/list` | SalesReturnList | Credit notes list |
| `/business-inventory/salesman` | SalesmanList | Salesman master |
| `/business-accounting/ledgers` | BusinessLedgerList | Chart of accounts |
| `/business-accounting/income` | BusinessIncomeVoucher | Income entry |
| `/business-accounting/expense` | BusinessExpenseVoucher | Expense entry |
| `/business-accounting/journal` | BusinessJournalVoucher | Journal entry |
| `/business-accounting/vouchers` | BusinessVoucherList | All vouchers |
| `/reports/vyapar` | VyaparReportsHub | Reports hub |
| `/reports/vyapar/sale-report` | VyaparSaleReport | Sales report |
| `/reports/vyapar/purchase-report` | VyaparPurchaseReport | Purchase report |
| `/reports/vyapar/party-statement` | VyaparPartyStatement | Party ledger |
| `/reports/vyapar/profit-loss` | VyaparProfitLoss | P&L statement |
| `/reports/vyapar/balance-sheet` | VyaparBalanceSheet | Balance sheet |
| `/reports/vyapar/bill-profit` | VyaparBillWiseProfit | Invoice-wise profit |
| `/reports/vyapar/party-profit` | VyaparPartyWiseProfit | Party-wise profit |
| `/reports/vyapar/trial-balance` | VyaparTrialBalance | Trial balance |
| `/reports/vyapar/stock-summary` | VyaparStockSummary | Stock summary |
| `/reports/vyapar/stock-statement` | VyaparStockStatement | Stock mutations |
| `/reports/vyapar/item-by-party` | VyaparItemReportByParty | Items by customer |
| `/reports/vyapar/item-profit` | VyaparItemWiseProfit | Item-wise profit |
| `/reports/vyapar/low-stock` | VyaparLowStockSummary | Low stock alert |
| `/reports/vyapar/cash-in-hand` | VyaparCashInHand | Cash balance |
| `/reports/vyapar/bank-statement` | VyaparBankStatement | Bank transactions |
| `/reports/vyapar/cashflow` | VyaparCashflowReport | Cash flow |
| `/reports/vyapar/all-transactions` | VyaparAllTransactions | All entries |
| `/reports/vyapar/all-parties` | VyaparAllParties | Customer/supplier list |
| `/reports/vyapar/gstr1` | VyaparGSTR1 | GST outward |
| `/reports/vyapar/gstr2` | VyaparGSTR2 | GST inward |
| `/reports/vyapar/day-book` | VyaparDayBook | Day book |
| `/reports/vyapar/cash-book` | VyaparCashBook | Cash book |
| `/reports/vyapar/trading-account` | VyaparTradingAccount | Trading account |

---

## 8. Reports Module — Data Sources

Each Vyapar report queries specific models/collections:

| Report | Primary Data Source | Secondary |
|--------|--------------------|-----------|
| Sale Report | `BusinessSales` | `BusinessCustomer` |
| Purchase Report | `BusinessStockTransaction` (referenceType=Purchase) | `BusinessItem`, `BusinessSupplier` |
| Party Statement | `BusinessVoucher.entries` (by ledgerId) | `BusinessLedger` |
| Cashflow | `BusinessVoucher` (by paymentMode) | `BusinessLedger` |
| Cash In Hand | `BusinessVoucher` (Cash-in-Hand group) | `BusinessLedger` |
| Cash Book | `BusinessSales` (Cash) + `BusinessStockTransaction` (Cash) + `BusinessVoucher` (Expense/Income/Payment/Receipt, Cash) | |
| All Transactions | `BusinessVoucher` (all entries) | `BusinessLedger` |
| Profit & Loss | `BusinessVoucher.entries` (Income/Expense groups) | `BusinessLedger` |
| Balance Sheet | `BusinessLedger` (all, grouped by nature) | `BusinessVoucher` |
| Bill-wise Profit | `BusinessSales` + `BusinessItem.purchasePrice` | |
| Party-wise Profit | `BusinessSales` (grouped by party) | `BusinessItem` |
| Trial Balance | `BusinessLedger` (all active) | |
| Stock Summary | `BusinessItem` (grouped by category) | `BusinessStockTransaction` |
| Stock Statement | `BusinessItem` + `BusinessStockTransaction` | |
| Item by Party | `BusinessStockTransaction` (Purchase) + `BusinessSales` (Sale) | `BusinessItem`, parties |
| Item-wise Profit | `BusinessSales.items` vs `BusinessItem.purchasePrice` | |
| Low Stock | `BusinessItem` (currentBalance ≤ lowStockAlert) | |
| Bank Statement | `BusinessVoucher` (Bank Accounts group) | `BusinessLedger` |
| All Parties | `BusinessCustomer` + `BusinessSupplier` | `BusinessSales`, `BusinessStockTransaction` |
| GSTR-1 | `BusinessSales` (with GST) | `BusinessItem` (hsnCode, gstPercent) |
| GSTR-2 | `BusinessStockTransaction` (with GST) | `BusinessItem` |
| Day Book | `BusinessVoucher` (all, date range) | `BusinessLedger` |
| Trading Account | `BusinessStockTransaction` (purchases) + `BusinessSales` (sales) | `BusinessItem` |

### Report Query Pattern (all reports)

```javascript
// All reports follow this pattern:
const { filterType, customStart, customEnd } = req.query;
const { startDate, endDate } = getDateRange(filterType, customStart, customEnd);
const companyId = req.companyId;  // injected by auth middleware

Model.find({
  companyId,                           // always scoped to company
  dateField: { $gte: startDate, $lte: endDate }
})
```

---

## 9. Accounting Architecture

### Voucher Number Prefixes

| Voucher Type | Prefix | Example |
|-------------|--------|---------|
| Income | BIN | BIN260300001 |
| Expense | BEX | BEX260300001 |
| Journal | BJV | BJV260300001 |
| Contra | BCT | BCT260300001 |
| Receipt | BRV | BRV260300001 |
| Payment | BPV | BPV260300001 |
| Sales | BSAL | BSAL260300001 |
| Purchase | BPUR | BPUR260300001 |
| Credit Note | BCN | BCN260300001 |
| Debit Note | BDN | BDN260300001 |

### Auto-Created System Ledgers

These ledgers are auto-created on first use:

| Ledger Name | Group | Nature | Created By |
|------------|-------|--------|-----------|
| Business Sales | Sales Accounts | Income | createBusinessSale |
| Cost of Goods Sold | Direct Expenses | Expense | createBusinessSale |
| Stock In Hand | Stock-in-Hand | Asset | createBusinessSale |
| CGST Output | Duties & Taxes | Liability | createBusinessSale |
| SGST Output | Duties & Taxes | Liability | createBusinessSale |
| IGST Output | Duties & Taxes | Liability | createBusinessSale |
| CGST Input | Duties & Taxes | Liability | businessStockIn |
| SGST Input | Duties & Taxes | Liability | businessStockIn |
| Sundry Debtors | Sundry Debtors | Asset | createBusinessSale (credit) |
| Cash in Hand | Cash-in-Hand | Asset | createExpenseVoucher |

### Double-Entry for Key Transactions

**Cash Sale (paymentMode=Cash):**
```
Dr Cash in Hand         ₹grandTotal
  Cr Business Sales     ₹taxableAmount
  Cr CGST Output        ₹cgstAmount
  Cr SGST Output        ₹sgstAmount
Dr Cost of Goods Sold   ₹totalCOGS
  Cr Stock In Hand      ₹totalCOGS
```

**Credit Sale (paymentMode=Credit):**
```
Dr Sundry Debtors / Party Ledger   ₹grandTotal
  Cr Business Sales                ₹taxableAmount
  Cr CGST Output                   ₹cgstAmount
  Cr SGST Output                   ₹sgstAmount
Dr Cost of Goods Sold              ₹totalCOGS
  Cr Stock In Hand                 ₹totalCOGS
```

**Stock In (Purchase, Cash):**
```
Dr Purchase Account (category)   ₹netAmount
Dr CGST Input                    ₹cgstAmount
Dr SGST Input                    ₹sgstAmount
  Cr Cash in Hand                ₹totalPaid
  Cr Sundry Creditors            ₹balance (if partial)
```

**Expense Voucher (Cash):**
```
Dr [Expense Ledger]   ₹amount
  Cr Cash in Hand     ₹amount
```

**Income Voucher (Cash):**
```
Dr Cash in Hand       ₹amount
  Cr [Income Ledger]  ₹amount
```

---

## 10. Key Field Mapping (Dairy vs Business)

| Feature | Dairy (`Item`) | Business (`BusinessItem`) |
|---------|----------------|--------------------------|
| Selling price field | `sellingPrice` | `salesRate` |
| Reorder level field | `reorderLevel` | `lowStockAlert` |
| Cost price field | `costPrice` | `purchasePrice` |
| GST rate field | `gstRate` | `gstPercent` |
| Unit field | `unit` | `measurement` + `unit` |
| Inventory type | `inventoryType` (enum field) | **No field** — separate model |
| Stock model | `StockTransaction` | `BusinessStockTransaction` |
| Ledger model | `Ledger` | `BusinessLedger` |
| Voucher model | `Voucher` | `BusinessVoucher` |
| Report controller | `accountingReportsController` | `vyaparReportsController` |

---

## 11. Additional Modules

### Quotation (EST-YYMM-XXXX)

```
Flow: Create Quotation → Send to customer → Convert to Invoice
      convertQuotationToInvoice() → creates BusinessSales + updates stock
Auto-expires: 30 days after valid date
```

**Key endpoints:**
- `POST /api/additional/quotations` — Create
- `PUT /api/additional/quotations/:id/convert` — Convert to invoice

### Warranty (WRT-YYMM-XXXX)

```
Fields: itemName, customer, purchaseDate, warrantyPeriod, endDate, claims[]
Claims: claimDate, description, status (Pending/In Progress/Resolved/Rejected)
Auto-expires: endDate < today → status = 'Expired'
```

**Key endpoint:** `POST /api/additional/warranty/:id/claims`

### Machine (MCH-YYMM-XXXX)

```
Fields: machineName, machineCode, supplier, purchaseDate, warrantyId, maintenanceLogs[]
Maintenance: maintenanceDate, type, description, cost, nextDue
```

**Key endpoint:** `POST /api/additional/machines/:id/maintenance`

---

*Generated: 2026-03-21 | DairysocietyERP Business Module Documentation*
