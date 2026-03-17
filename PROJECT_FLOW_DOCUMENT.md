# DairySociety ERP — Full Project Flow Document

**Version:** 1.0 | **Date:** March 2026
**Stack:** React + Vite (Frontend) | Express.js + MongoDB (Backend)
**Architecture:** Multi-tenant, Company-based isolation, JWT Auth

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Authentication & Company Flow](#3-authentication--company-flow)
4. [Business Types](#4-business-types)
5. [Dairy Cooperative Society — Module Flow](#5-dairy-cooperative-society--module-flow)
6. [Private Firm (Vyapar) — Module Flow](#6-private-firm-vyapar--module-flow)
7. [Shared Modules](#7-shared-modules)
8. [Accounting Flow (Final Accounts)](#8-accounting-flow-final-accounts)
9. [Database Models Reference](#9-database-models-reference)
10. [API Routes Reference](#10-api-routes-reference)
11. [Frontend Routes Reference](#11-frontend-routes-reference)
12. [File Structure](#12-file-structure)

---

## 1. SYSTEM OVERVIEW

DairySociety ERP is a complete enterprise management system for dairy operations. It supports **two parallel business types** under a single login:

```
DairySociety ERP
├── Dairy Cooperative Society    ← Milk purchase, producer payments, dairy inventory
└── Private Firm (Vyapar)        ← Shop/business billing, GST invoicing, business reports
```

Both types run under the same user account but maintain **completely separate** data, ledgers, and reports.

---

## 2. TECH STACK & ARCHITECTURE

### Backend
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB with Mongoose ODM |
| Auth | JWT (JSON Web Tokens) |
| Port | 5000 |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 |
| Build Tool | Vite |
| UI Library | Mantine UI |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Icons | Tabler Icons |
| Port | 5173 (dev) |

### Multi-Tenant Architecture
```
Company A (Dairy Co-op)  ─┐
Company B (Private Firm)  ─┼─→  Same MongoDB  →  companyId field isolates all data
Company C (Both Types)   ─┘
```
Every document in MongoDB has a `companyId` field. The backend middleware `addCompanyFilter` automatically scopes all queries to the logged-in user's company.

---

## 3. AUTHENTICATION & COMPANY FLOW

### Login Flow
```
User opens app
    ↓
Login Page (/login)
    ↓
Select Company from dropdown  ← GET /api/companies/public
    ↓
Enter username + password     ← POST /api/auth/login
    ↓
JWT Token stored in localStorage
Company ID stored in localStorage
    ↓
Redirect to Dashboard (/)
```

### User Roles
| Role | Access |
|------|--------|
| `superadmin` | All companies, all data, user management |
| `admin` | Own company, all modules |
| `user` | Own company, limited based on permissions |

### Auth Middleware Chain
```
Request → protect (validate JWT) → addCompanyFilter (inject companyId) → Controller
```

### Token Storage
```javascript
localStorage.getItem('authToken')         // JWT token
localStorage.getItem('selectedCompanyId') // Active company
localStorage.getItem('selectedBusinessType') // 'Dairy Cooperative Society' or 'Private Firm'
```

---

## 4. BUSINESS TYPES

### Switching Business Types
The `CompanySwitcher` component (top-right of header) lets users toggle between:
- **Dairy Cooperative Society** → Shows dairy menus
- **Private Firm** → Shows Vyapar/business menus

Each business type has its own:
- Navigation menu
- Inventory system (Item vs BusinessItem)
- Accounting system (Ledger/Voucher vs BusinessLedger/BusinessVoucher)
- Reports

---

## 5. DAIRY COOPERATIVE SOCIETY — MODULE FLOW

### 5.1 FARMER / PRODUCER MANAGEMENT

```
Add Farmer (/farmers)
├── Personal Details (name, phone, age, gender)
├── Address & Identity (Aadhaar, PAN, ration card)
├── Bank Details (for payment transfer)
├── Share Details (membership shares)
├── Attach to Collection Center
└── Farmer gets unique farmerNumber (auto-generated)
```

**Farmer Membership:**
- Farmer starts as member on joining
- Can be terminated (status: Inactive)
- Share purchase history tracked
- Each farmer can have a linked Ledger for accounting

**Key APIs:**
```
POST   /api/farmers              → Create farmer
GET    /api/farmers              → List all (paginated + search)
GET    /api/farmers/:id/shares   → Share history
POST   /api/farmers/:id/shares   → Add shares
PATCH  /api/farmers/:id/membership → Toggle membership
```

---

### 5.2 COLLECTION CENTER & AGENT MANAGEMENT

```
Collection Center (/collection-centers)
├── Center Name, Code, Phone
├── Incharge / Manager
├── Address
└── Status (Active/Inactive)

Agent (/agents)
├── Agent Name, Phone, Area
├── Commission %
├── Linked Ledger
└── Status
```

**Flow:** Farmer → belongs to → Collection Center → managed by → Agent

---

### 5.3 DAILY MILK PURCHASE (COLLECTION)

This is the core daily operation for dairy cooperatives.

```
Milk Purchase Form (/daily-collections/milk-purchase)
│
├── Header: Date | Shift (AM/PM) | Collection Center | Agent
│
├── Entry:
│   ├── Scan/Enter Producer Number (farmerNumber)
│   ├── Auto-lookup: producer name, last readings, 10-day average
│   ├── Enter: Qty (Litres), FAT %, CLR, SNF %
│   ├── Rate auto-calculated from Rate Chart
│   ├── Incentive auto-added (qty-based)
│   └── Amount = (Qty × Rate) + Incentive
│
├── Save → MilkCollection record created
│       → Thermal print (ESC/POS via USB)
│       → Journal Voucher created:
│           Dr: PRODUCERS DUES
│           Cr: MILK PURCHASE
│
└── History table shows today's entries (shift-wise)
```

**Rate Chart Logic:**
```
Rate Chart Types:
├── ApplyFormula    → Rate = FAT × fatRate + SNF × snfRate
├── SlabRate        → Fixed rate regardless of quality
├── ManualEntry     → FAT/CLR table lookup (nearest match)
├── LowChart        → Low-quality rate table
└── GoldLessChart   → Base rate ± adjustment value
```

**Machine Integration (Milk Analyzer):**
```
Milk Analyzer device connected via COM port
    ↓
MachineConfig → port, baudRate settings
    ↓
MilkAnalyzerReading → fat, protein, snf, ts, acidity
    ↓
Auto-fills FAT/CLR/SNF fields in purchase form
```

**Accounting Entry (Auto):**
| Dr/Cr | Ledger | Amount |
|-------|--------|--------|
| Dr | PRODUCERS DUES | Sale amount |
| Cr | MILK PURCHASE | Sale amount |

---

### 5.4 DAILY MILK SALES

```
Milk Sales Form (/daily-collections/milk-sales)
│
├── Sale Types:
│   ├── LOCAL SALE    → Cash/Bank payment to collection center
│   ├── CREDIT SALE   → Against creditor (customer account)
│   └── SAMPLE SALE   → Sample/donation (cash)
│
├── LOCAL / SAMPLE entry:
│   ├── Select Collection Center + Agent
│   ├── Enter Litres + Rate
│   ├── Payment Type: Cash or Bank
│   └── Accounting: Dr Cash/Bank → Cr LOCAL SALES / SAMPLE SALES
│
└── CREDIT entry:
    ├── Select Category (School/Anganwadi/Hospital/Booth/Hotel/etc.)
    ├── Select Creditor (Customer)
    ├── Opening Credit balance shown
    ├── Enter Litres + Rate
    └── Accounting:
        ├── School/Anganwadi → Dr Creditor → Cr SCHOOL MILK SALES
        └── Others          → Dr Creditor → Cr MILK CREDIT SALES
```

**Milk Sales Rate Module (/daily-collections/milk-sales-rate):**
```
Manage per-customer/agent rates with WEF (With Effect From) dates
├── partyType: Customer or Agent
├── salesItem: Customer Sale / Local Sale
├── category: School / Local Sale (auto-derived)
├── wefDate: effective from date
└── rate: price per litre

Latest rate query: GET /api/milk-sales-rates/latest?partyId=&salesItem=&date=
```

---

### 5.5 PRODUCER PAYMENT SYSTEM

This is the payment cycle for milk producers.

```
Payment Cycle Flow:
│
├── 1. Daily milk collection (FAT × rate = amount)
│
├── 2. Deductions applied:
│   ├── Loan EMI recovery
│   ├── Advance recovery
│   ├── Individual deductions (master-driven)
│   └── Historical / Periodical deductions
│
├── 3. Payment Register (/payments/register)
│   ├── Shows all farmers with their dues
│   ├── Date range filter
│   └── Bulk payment option
│
├── 4. Individual Payment (/payments/individual)
│   ├── Per-farmer payment entry
│   ├── Cash / Bank / Transfer modes
│   └── Creates FarmerPayment record + Voucher
│
├── 5. Bank Transfer (/payments/bank-transfer)
│   ├── Bulk NEFT/RTGS transfer
│   └── Linked to bank account details from farmer profile
│
└── 6. Producer Register (/payments/producer-register)
    ├── Date-wise: Opening → Milk Purchase → Deductions → Net → Closing
    └── Summary view per farmer
```

**Advances & Loans:**
```
Cash Advance (/payments/cash-advance)
├── Advance amount given to farmer
├── Recovery deducted from future payments
└── Status: Active → auto-closes when fully recovered

Producer Loan (/payments/loans)
├── Loan amount, rate of interest, tenure
├── EMI auto-calculated
├── Monthly EMI recording
└── Status: Active → Closed when paid off

Producer Receipt (/payments/receipts)
└── Manual receipts from producers (cash received)
```

**Earnings & Deductions Master:**
```
/payments/earning-deduction-master
├── Define earning/deduction heads (bonus, welfare, etc.)
├── Apply to: Employee or Producer
└── Types:
    ├── Individual → per-farmer specific amount
    ├── Historical → past date adjustments
    └── Periodical → recurring (daily/weekly/monthly)
```

---

### 5.6 DAIRY INVENTORY

```
Item Master (/inventory/items)
├── Item Code, Name, Category
├── Unit, Measurement
├── Opening Balance
├── Rates: Sales, Wholesale, Retail
├── GST %, HSN Code
├── Purchase Ledger link
├── Sales Ledger link
├── Supplier link
└── Subsidy link (if subsidized item)

Stock In (Purchase) (/inventory/stock-in)
├── Select Supplier
├── Add items (qty, rate)
├── GST calculation
├── Payment mode: Cash / Bank / Adjustment (credit)
└── Creates: StockTransaction(In) + Journal Voucher

Stock Out (/inventory/stock-out)
└── Manual stock reduction (returns, damage)

Sales (/sales/new)
├── Select Customer (type: Member/Non-member/Other)
├── Add items
├── Apply subsidies
├── GST
└── Creates: Sales record + updates stock + creates Voucher
```

---

### 5.7 SUBSIDY MODULE

```
Subsidy (/subsidies)
├── Linked to specific Item
├── Subsidy % or fixed amount per unit
├── Valid From / Valid To dates
└── Applied automatically in Dairy Sales billing
```

---

## 6. PRIVATE FIRM (VYAPAR) — MODULE FLOW

### 6.1 BUSINESS CUSTOMER MANAGEMENT

```
Business Customers (/business-customers)
├── Customer Name, Phone, Email
├── GST Number, PAN
├── Address: city, state, pincode
├── Party Type (Retail/Wholesale/etc.)
└── Linked Ledger (for accounting)
```

---

### 6.2 BUSINESS INVENTORY

```
Item Master (/business-inventory/items)
├── Item Code, Name, Category
├── Measurement, Unit
├── Opening Balance, Current Balance
├── Purchase Price, Sales Rate
├── Wholesale Price, Retail Price, MRP
├── GST %, HSN Code
├── Barcode
├── Low Stock Alert level
└── Supplier link

Purchase / Stock In (/business-inventory/stock-in)
├── Select Supplier
├── Invoice Number, Purchase Date
├── Add items: qty, free qty, rate, GST%
├── Payment: Cash / Bank / Credit (Adjustment)
└── Creates: BusinessStockTransaction + BusinessVoucher

Sales Invoice (/business-inventory/sales/new)
├── Select Party (Customer/Supplier/Walk-in)
├── Invoice number auto-generated
├── Add items: qty, free qty, rate, discount%, GST
├── CGST + SGST (intra-state) or IGST (inter-state)
├── Bill-level discount
├── Round off
├── Payment status: Paid / Partial / Unpaid
└── Creates: BusinessSales + updates stock + BusinessVoucher

Purchase Return (/business-inventory/purchase-returns/new)
└── Debit Note against supplier

Sales Return (/business-inventory/sales-returns/list)
└── Credit Note against customer
```

**Invoice Print:**
```
/business-inventory/sales/print/:id   ← Full GST tax invoice (no layout chrome)
```

---

### 6.3 BUSINESS ACCOUNTING (VYAPAR)

```
Ledgers (/business-accounting/ledgers)
└── Maintain separate BusinessLedger collection

Voucher Types:
├── Income Voucher  (/business-accounting/income)
│   └── Dr Cash/Bank → Cr Income ledger
│
├── Expense Voucher (/business-accounting/expense)
│   └── Dr Expense ledger → Cr Cash/Bank
│
└── Journal/Adjustment (/business-accounting/journal)
    └── Manual double-entry
```

---

### 6.4 BUSINESS PROMOTIONS

```
Promotions Dashboard (/business-promotions)
│
├── Discount Coupons (/business-promotions/coupons)
│   ├── Coupon code (e.g., SAVE10)
│   ├── Discount: % or flat amount
│   ├── Min bill amount
│   └── Max redemptions / per-customer limit
│
├── Offers & Schemes (/business-promotions/offers)
│   ├── Buy X Get Y free
│   ├── Item-level discount
│   └── Valid dates
│
├── Campaigns (/business-promotions/campaigns)
│   └── Bulk promotional campaigns
│
└── Message Templates (/business-promotions/templates)
    └── SMS/WhatsApp templates with variables
```

**Validation & Redemption:**
```
POST /api/business-promotions/validate-coupon  → Check if coupon valid
POST /api/business-promotions/redeem           → Record redemption
GET  /api/business-promotions/analytics        → Redemption stats
```

---

### 6.5 VYAPAR REPORTS

All Vyapar reports are under `/reports/vyapar/` and only appear for Private Firm business type.

```
Sales Reports:
├── Sale Report        → All sales with item/party/date filters
├── Purchase Report    → All purchases
└── All Transactions   → Combined sales + purchases

Profit Analysis:
├── Bill Wise Profit   → Profit per invoice
├── Party Wise Profit  → Profit per customer/supplier
├── Item Wise Profit   → Profit per item
└── Trading Account    → Gross profit calculation

Party Reports:
├── Party Statement    → Individual party ledger
├── All Parties        → Outstanding for all parties
└── Item by Party      → Which party bought which items

Financial Reports:
├── Profit & Loss     → Income – Expenses
├── Balance Sheet     → Assets = Liabilities + Capital
├── Trial Balance     → All ledger balances
├── Cashflow Report   → Cash in/out over period
└── Cash in Hand      → Current cash position

Cash & Bank:
├── Day Book          → All vouchers date-wise
├── Cash Book         → Only cash transactions
└── Bank Statement    → Per-bank-account statement

Stock Reports:
├── Stock Summary     → Current stock value
├── Stock Statement   → Movement history
└── Low Stock Alert   → Items below reorder level

GST Reports:
├── GSTR-1            → Outward supplies (sales)
└── GSTR-2            → Inward supplies (purchases)
```

---

## 7. SHARED MODULES

These modules work for **both** business types.

### 7.1 QUOTATION MODULE

```
Quotation Flow:
│
├── Create Quotation (/quotations/add)
│   ├── EST-YYMM-XXXX (auto number)
│   ├── Party details
│   ├── Items with qty, rate, GST
│   └── Valid Until date
│
├── Status: Draft → Sent → Accepted / Rejected
│
├── Convert to Invoice (/quotations/:id/convert)
│   ├── Creates BusinessSales record
│   ├── Updates stock
│   └── Quotation status → Converted
│
└── Print Options:
    ├── Standard Print (/quotations/print/:id)
    ├── Proposal Letter (/quotations/proposal-letter/:id)
    └── GTech Template (/quotations/gtech-template/:id)
```

---

### 7.2 WARRANTY MODULE

```
Warranty (/warranty)
├── WRT-YYMM-XXXX (auto number)
├── Party name, item description
├── Purchase date, Warranty valid until
└── Claims tracking:
    ├── Claim date, description
    ├── Claim amount
    ├── Status: Pending / In Progress / Resolved / Rejected
    └── Remarks
```

---

### 7.3 MACHINE MODULE

```
Machine (/machines)
├── MCH-YYMM-XXXX (auto number)
├── Machine Type, Manufacturer
├── Purchase Date, Location
├── Status: Active / Under Maintenance / Decommissioned
└── Maintenance Logs:
    ├── Service Date, Service Type
    ├── Description, Cost
    └── Next Service Date
```

---

### 7.4 HUMAN RESOURCES (HRM)

```
HRM Flow:

Employees (/hrm/employees)
├── Name, Mobile, Address
├── Department, Designation, Role
├── Basic Salary
├── Joining Date
└── Status: Active / Inactive

Attendance (/hrm/attendance)
├── Per-employee, per-day
├── Status: Present / Absent / Leave / Half-day
└── Bulk mark for a date

Leave Management (/hrm/leaves)
├── Apply: employee, from-date, to-date, type, reason
└── Approve/Reject by admin

Payroll (/hrm/salary)
├── Month + Year
├── Basic Salary (from employee master)
├── + Overtime
├── − Deductions
├── = Net Salary (auto-computed)
└── Status: Processed / Paid

Loans / Advance (HRM) (/hrm/loans)
├── Total Amount, Paid Amount
├── Remaining Amount (auto)
└── Status: Active → auto-closes when remaining ≤ 0
```

---

### 7.5 SUPPLIER MODULE

```
Suppliers (/suppliers)
├── Supplier ID (auto: SUP-001)
├── Name, Phone, Email, GST
├── Address: state, city, pincode
├── Opening Balance, Credit Limit
├── Payment Terms (days)
└── Linked Ledger (for accounting)
```

---

## 8. ACCOUNTING FLOW (FINAL ACCOUNTS)

### 8.1 DAIRY COOPERATIVE ACCOUNTING

**Voucher Types:**
| Type | Dr Side | Cr Side | Use |
|------|---------|---------|-----|
| Receipt | Cash/Bank | Income/Party | Money received |
| Payment | Expense/Party | Cash/Bank | Money paid |
| Journal | Any | Any | Adjustments |

**Ledger Types (Dairy):**
```
Income:    Sales A/c, Trade Income, Miscellaneous Income, Other Revenue, Grants & Aid, Subsidies
Expense:   Purchases A/c, Trade Expenses, Establishment Charges, Miscellaneous Expenses
Liability: Accounts Due To (Sundry Creditors), Other Payable, Other Liabilities,
           Deposit A/c, Contingency Fund, Education Fund
Asset:     Fixed Assets, Movable Assets, Immovable Assets, Other Assets, Other Receivable
Cash/Bank: Cash, Bank
Capital:   Share Capital, Profit & Loss A/c
Investment:Investment A/c, Other Investment, Government Securities
Party:     Party (generic)
```

**Auto-Voucher Creation:**
```
Milk Purchase saved    → Journal: Dr PRODUCERS DUES / Cr MILK PURCHASE
Milk Sale (Cash)       → Receipt: Dr Cash/Bank / Cr LOCAL SALES or SAMPLE SALES
Milk Sale (Credit)     → Journal: Dr Creditor / Cr MILK CREDIT SALES or SCHOOL MILK SALES
Stock Purchase         → Journal: Dr Purchase Ledger / Cr Supplier / Cr Cash
Dairy Sales            → Journal: Dr Customer / Cr Sales Ledger
Farmer Payment         → Payment: Dr Farmer Ledger / Cr Cash or Bank
```

**Reports Flow:**
```
All Vouchers
    ↓
Day Book         → All vouchers date-wise (Dr/Cr columns)
Cash Book        → Only Cash/Bank vouchers
General Ledger   → Per-ledger running balance
Ledger Abstract  → Summary of all ledger balances
    ↓
Trial Balance    → All Dr/Cr balances balanced
    ↓
Trading Account  → Gross Profit = Sales − Cost of Goods
Profit & Loss    → Net Profit = Gross Profit − Expenses
Balance Sheet    → Assets = Liabilities + Capital
    ↓
R&D Statement    → Receipts & Disbursements (cooperative-specific)
Dairy Abstract   → Milk-specific financial summary
Dairy Register   → Detailed daily register
```

### 8.2 BALANCE SHEET STRUCTURE (DAIRY)

```
LIABILITIES SIDE              ASSETS SIDE
─────────────────             ──────────────────
Share Capital                 Fixed Assets
Contingency Fund              Movable Assets
Education Fund                Immovable Assets
Reserve Fund                  Investments
Other Liabilities             Cash in Hand
Sundry Creditors              Cash at Bank
Deposits                      Stock in Hand
Loans                         Sundry Debtors
                              Other Assets
```

---

## 9. DATABASE MODELS REFERENCE

### Core Models

| Model | Collection | Key Fields |
|-------|-----------|-----------|
| **Company** | companies | companyName, businessTypes[], address, status |
| **User** | users | username, password(hashed), role, company |
| **Farmer** | farmers | farmerNumber, personalDetails, bankDetails, shares[], status |
| **Customer** | customers | customerId, name, phone, category, ledgerId |
| **BusinessCustomer** | businesscustomers | customerName, phone, gstNumber, partyType, ledgerId |
| **Supplier** | suppliers | supplierId, name, phone, gstNumber, openingBalance |
| **Agent** | agents | name, phone, area, commission, ledgerId |
| **CollectionCenter** | collectioncenters | centerName, code, manager, status |

### Inventory Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **Item** | items | Dairy inventory items |
| **StockTransaction** | stocktransactions | Dairy stock in/out (has inventoryType) |
| **BusinessItem** | businessitems | Private firm items |
| **BusinessStockTransaction** | businessstocktransactions | Business stock in/out (NO inventoryType) |
| **Sales** | sales | Dairy sales invoices |
| **BusinessSales** | businesssales | Private firm GST invoices |

### Accounting Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **Ledger** | ledgers | Dairy cooperative ledger accounts |
| **Voucher** | vouchers | Dairy vouchers (Receipt/Payment/Journal) |
| **BusinessLedger** | businessledgers | Private firm ledger accounts |
| **BusinessVoucher** | businessvouchers | Private firm vouchers |

### Daily Operations Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **MilkCollection** | milkcollections | Daily milk purchase records |
| **MilkSales** | milksales | Daily milk sales records |
| **MilkSalesRate** | milksalesrates | Per-party WEF-dated milk sales rates |
| **RateChart** | ratecharts | FAT/CLR based rate calculation tables |
| **MilkPurchaseSettings** | milkpurchasesettings | Machine/analyzer settings |
| **UnionSalesSlip** | unionsalesslips | Union sales documentation |
| **MilkAnalyzerReading** | milkanalyzerreadings | Analyzer device readings |
| **MachineConfig** | machineconfigs | COM port / device settings |

### Payment Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **FarmerPayment** | farmerpayments | Producer payment records |
| **Advance** | advances | Cash advances to producers |
| **ProducerLoan** | producerloans | Loans with EMI tracking |
| **ProducerReceipt** | producerreceipts | Receipts from producers |
| **BankTransfer** | banktransfers | Bulk bank transfer records |
| **EarningDeduction** | earningdeductions | Earning/deduction heads master |

### Additional Module Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **Quotation** | quotations | EST-YYMM-XXXX estimates |
| **Warranty** | warranties | WRT-YYMM-XXXX warranty cards |
| **Machine** | machines | MCH-YYMM-XXXX machine records |
| **Subsidy** | subsidies | Item subsidy configuration |
| **BusinessPromotion** | businesspromotions | Coupons, offers, campaigns |
| **PromotionRedemption** | promotionredemptions | Redemption tracking |

### HRM Models

| Model | Collection | Description |
|-------|-----------|-------------|
| **Employee** | employees | Staff records |
| **Attendance** | attendances | Daily attendance |
| **Payroll** | payrolls | Monthly salary processing |
| **Leave** | leaves | Leave applications |
| **Loan** | loans | Employee loans/advances |
| **Department** | departments | Department master |
| **Designation** | designations | Designation master |

---

## 10. API ROUTES REFERENCE

**Base URL:** `http://localhost:5000/api`

### Auth
```
POST   /auth/login                         Public - Login
GET    /auth/me                            Get current user
PATCH  /auth/change-password              Change password
GET    /auth/users                         List users (superadmin)
POST   /auth/users                         Create user (superadmin)
PUT    /auth/users/:id                     Update user
DELETE /auth/users/:id                     Delete user
```

### Farmers
```
GET    /farmers                            List farmers
POST   /farmers                            Create farmer
GET    /farmers/search                     Search farmers
GET    /farmers/:id                        Get farmer
PUT    /farmers/:id                        Update farmer
DELETE /farmers/:id                        Deactivate farmer
POST   /farmers/:id/shares                 Add shares
PATCH  /farmers/:id/membership            Toggle membership
POST   /farmers/bulk-import               Bulk import
```

### Daily Collections
```
POST   /milk-collections                   Save milk purchase
GET    /milk-collections                   List (filter: date, shift, center)
PUT    /milk-collections/:id              Update
DELETE /milk-collections/:id              Delete (reverses voucher)

POST   /milk-sales                         Save milk sale
GET    /milk-sales                         List
GET    /milk-sales/summary/daily           Daily totals by shift/mode
GET    /milk-sales/balance-report          Creditor balance report
PUT    /milk-sales/:id                     Update
DELETE /milk-sales/:id                     Delete (reverses voucher)

GET    /milk-sales-rates                   List rates
POST   /milk-sales-rates                   Create rate
GET    /milk-sales-rates/latest            Latest rate (WEF logic)
GET    /milk-sales-rates/history/:partyId  Rate history
```

### Inventory (Dairy)
```
GET    /items                              List items
POST   /items                              Create item
PUT    /items/:id                          Update item
PATCH  /items/:id/opening-balance         Update opening stock
POST   /stock/in                           Purchase (stock in)
POST   /stock/out                          Stock out
GET    /stock/transactions                 Transaction history
GET    /stock/balance                      Current stock balance
```

### Business Inventory
```
GET    /business-inventory/items           List items
POST   /business-inventory/items           Create item
POST   /business-inventory/stock/in        Purchase
POST   /business-inventory/stock/out       Stock out
GET    /business-inventory/stock/balance   Stock balance

GET    /business-sales                     List invoices
POST   /business-sales                     Create invoice
GET    /business-sales/:id                 Get invoice
PUT    /business-sales/:id                 Update invoice
DELETE /business-sales/:id                Delete invoice
```

### Accounting
```
GET    /ledgers                            List ledgers
POST   /ledgers                            Create ledger
PUT    /ledgers/:id                        Update ledger
GET    /ledgers/:id/outstanding            Outstanding balance

GET    /vouchers                           List vouchers
POST   /vouchers                           Create voucher
DELETE /vouchers/:id                       Delete voucher

GET    /business-accounting/ledgers        Business ledgers
POST   /business-accounting/income-voucher  Income entry
POST   /business-accounting/expense-voucher Expense entry
POST   /business-accounting/journal-voucher Journal entry
```

### Payments
```
POST   /farmer-payments                    Create payment
POST   /farmer-payments/bulk              Bulk payments
GET    /farmer-payments/farmer/:id/ledger  Farmer ledger
GET    /farmer-payments/farmer/:id/summary Farmer summary
POST   /producer-loans                     Create loan
POST   /producer-loans/:id/emi             Record EMI
POST   /advances                           Create advance
POST   /advances/:id/adjust               Adjust advance
POST   /bank-transfers                     Create bank transfer
```

### Reports (Dairy)
```
GET    /reports/day-book                   Day book
GET    /reports/cash-book                  Cash book
GET    /reports/general-ledger             Ledger-wise transactions
GET    /reports/ledger-abstract            All ledger balances
GET    /reports/trading-account            Trading account
GET    /reports/profit-loss                Profit & loss
GET    /reports/balance-sheet              Balance sheet
GET    /reports/rd-enhanced                R&D statement
GET    /reports/milk-bill-abstract         Milk bill summary
GET    /reports/dairy-abstract             Dairy abstract
GET    /reports/dairy-register             Dairy register
GET    /reports/stock-register             Stock register
GET    /reports/subsidy                    Subsidy report
```

### Reports (Vyapar)
```
GET    /reports/vyapar/sale-report         Sales
GET    /reports/vyapar/purchase-report     Purchases
GET    /reports/vyapar/party-statement     Party ledger
GET    /reports/vyapar/profit-loss         P&L
GET    /reports/vyapar/balance-sheet       Balance sheet
GET    /reports/vyapar/trial-balance       Trial balance
GET    /reports/vyapar/trading-account     Trading account
GET    /reports/vyapar/gstr1               GSTR-1 (sales GST)
GET    /reports/vyapar/gstr2               GSTR-2 (purchase GST)
GET    /reports/vyapar/day-book            Day book
GET    /reports/vyapar/cash-book           Cash book
GET    /reports/vyapar/stock-summary       Stock summary
GET    /reports/vyapar/stock-statement     Stock movement
GET    /reports/vyapar/low-stock           Low stock alert
```

### Additional Modules
```
GET/POST       /quotations                 Quotation list / create
POST           /quotations/:id/convert     Convert to invoice
GET/POST       /warranty                   Warranty
POST           /warranty/:id/claims        Add claim
GET/POST       /machines                   Machine
POST           /machines/:id/maintenance   Add maintenance log
GET/POST       /subsidies                  Subsidies
GET/POST/PUT   /business-promotions        Promotions
POST           /business-promotions/validate-coupon  Validate
POST           /business-promotions/redeem   Redeem
```

### HRM
```
GET/POST       /employees                  Employees
GET/POST       /attendance                 Attendance
POST           /attendance/bulk           Bulk mark
GET/POST       /salary                     Payroll
GET/POST       /leaves                     Leaves
GET/POST       /loans                      HRM Loans
GET/POST       /departments                Departments
GET/POST       /designations               Designations
```

---

## 11. FRONTEND ROUTES REFERENCE

```
/                              Dashboard

── FARMER MANAGEMENT ──
/farmers                       Farmer List
/farmers/view/:id              View Farmer
/farmers/members               Member List
/customers                     Customer List
/business-customers            Business Customer List
/suppliers                     Supplier List
/collection-centers            Collection Centers
/agents                        Agent Management

── DAILY COLLECTIONS ──
/daily-collections/milk-purchase         Milk Purchase (F2)
/daily-collections/milk-sales            Milk Sales (F3)
/daily-collections/list                  Collection List
/daily-collections/farmer-wise-summary   Farmer Summary
/daily-collections/milk-sales-rate       Sales Rate Management
/daily-collections/rate-chart-settings   Rate Chart
/daily-collections/milk-purchase-settings Machine Config
/daily-collections/union-sales-slip      Union Sales Slip
/daily-collections/shift-incentive       Shift Incentive
/daily-collections/time-incentive        Time Incentive
/milk-analyzer                           Milk Analyzer

── DAIRY INVENTORY ──
/inventory/items               Item Master
/inventory/stock-in            Purchase/Stock In
/inventory/stock-out           Stock Out
/inventory/report              Stock Report
/inventory/purchase-returns/*  Purchase Returns
/inventory/sales-returns/*     Sales Returns
/sales/new                     Create Sale
/sales/list                    Sales History
/subsidies                     Subsidy Management

── BUSINESS INVENTORY ──
/business-inventory/items                Item Master
/business-inventory/stock-in             Purchase
/business-inventory/sales/new            Create Invoice
/business-inventory/sales/list           Invoice List
/business-inventory/sales/print/:id      Print Invoice
/business-inventory/stock-out            Stock Out
/business-inventory/purchase-returns/*   Purchase Returns
/business-inventory/sales-returns/*      Sales Returns
/business-inventory/stock-report         Stock Report
/business-inventory/salesman             Salesman

── PAYMENTS ──
/payments/register             Payment Register
/payments/individual           Individual Payment
/payments/loans                Loan Management
/payments/loans/:id            Loan Detail
/payments/cash-advance         Cash Advance
/payments/receipts             Producer Receipts
/payments/farmer-ledger        Farmer Ledger
/payments/producer-register    Producer Register
/payments/bank-transfer        Bank Transfer
/payments/earning-deduction-master       Earning/Deduction Master
/payments/individual-deduction-earning   Individual D/E
/payments/historical-deduction-earning   Historical D/E
/payments/periodical-deduction-earning   Periodical D/E

── ACCOUNTING (DAIRY) ──
/accounting/ledgers            Ledger List
/accounting/receipt            Receipt Voucher
/accounting/payment            Payment Voucher
/accounting/journal            Journal/Adjustment Entry
/accounting/vouchers           Vouchers List
/accounting/outstanding        Outstanding Report

── ACCOUNTING (BUSINESS) ──
/business-accounting/ledgers   Ledger List
/business-accounting/income    Income Voucher
/business-accounting/expense   Expense Voucher
/business-accounting/journal   Journal Entry
/business-accounting/vouchers  Vouchers List

── REPORTS (DAIRY) ──
/reports/daybook               Day Book
/reports/cash-book             Cash Book
/reports/general-ledger        General Ledger
/reports/ledger-abstract       Ledger Abstract
/reports/rd-enhanced           R&D Statement
/reports/final-accounts        Final Accounts
/reports/balance-sheet         Balance Sheet
/reports/stock-register        Stock Register
/reports/purchase-register     Purchase Register
/reports/milk-bill-abstract    Milk Bill Abstract
/reports/dairy-abstract        Dairy Abstract
/reports/dairy-register        Dairy Register
/reports/subsidy               Subsidy Report

── REPORTS (VYAPAR) ──
/reports/vyapar/sale-report    Sale Report
/reports/vyapar/purchase-report Purchase Report
/reports/vyapar/party-statement Party Statement
/reports/vyapar/all-parties    All Parties
/reports/vyapar/profit-loss    Profit & Loss
/reports/vyapar/balance-sheet  Balance Sheet
/reports/vyapar/trial-balance  Trial Balance
/reports/vyapar/trading-account Trading Account
/reports/vyapar/cashflow       Cashflow
/reports/vyapar/cash-in-hand   Cash in Hand
/reports/vyapar/all-transactions All Transactions
/reports/vyapar/bill-profit    Bill Wise Profit
/reports/vyapar/party-profit   Party Wise Profit
/reports/vyapar/item-profit    Item Wise Profit
/reports/vyapar/bank-statement Bank Statement
/reports/vyapar/gstr1          GSTR-1
/reports/vyapar/gstr2          GSTR-2
/reports/vyapar/stock-summary  Stock Summary
/reports/vyapar/stock-statement Stock Statement
/reports/vyapar/low-stock      Low Stock Alert
/reports/vyapar/day-book       Day Book
/reports/vyapar/cash-book      Cash Book
/reports/cooperative-rd        Cooperative R&D

── ADDITIONAL MODULES ──
/quotations                    Quotation List
/quotations/add                Add Quotation
/quotations/print/:id          Print Quotation
/quotations/proposal-letter/:id  Proposal Letter
/quotations/gtech-template/:id   GTech Template
/warranty                      Warranty List
/warranty/add                  Add Warranty
/machines                      Machine List
/machines/add                  Add Machine
/promotions                    Dairy Promotions
/business-promotions           Business Promotions

── HRM ──
/hrm/employees                 Employee List
/hrm/attendance                Attendance
/hrm/leaves                    Leave Management
/hrm/salary                    Payroll
/hrm/loans                     Loans

── ADMIN ──
/user-management               User Management
```

---

## 12. FILE STRUCTURE

```
DairysocietyERP/
│
├── backend/
│   └── src/
│       ├── server.js                  ← Express app, middleware, route mounting
│       ├── controllers/               ← Business logic (one per module)
│       │   ├── milkCollectionController.js
│       │   ├── milkSalesController.js
│       │   ├── farmerController.js
│       │   ├── accountingController.js
│       │   ├── dayBookController.js
│       │   ├── reportController.js
│       │   ├── vyaparReportsController.js
│       │   └── ... (30+ controllers)
│       ├── models/                    ← Mongoose schemas
│       │   ├── MilkCollection.js
│       │   ├── MilkSales.js
│       │   ├── Farmer.js
│       │   ├── Ledger.js
│       │   ├── Voucher.js
│       │   └── ... (40+ models)
│       ├── routes/                    ← Express routers
│       │   ├── farmerRoutes.js
│       │   ├── collectionCenterRoutes.js
│       │   ├── reportRoutes.js
│       │   └── ... (20+ route files)
│       ├── middleware/
│       │   └── auth.js                ← JWT protect, addCompanyFilter, restrictTo
│       └── utils/
│           ├── accountingHelper.js    ← generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances
│           └── stockHelper.js         ← Stock balance calculations
│
├── frontend/
│   └── src/
│       ├── App.jsx                    ← All route definitions
│       ├── main.jsx                   ← React entry point
│       ├── services/
│       │   └── api.js                 ← All Axios API calls (milkCollectionAPI, milkSalesAPI, etc.)
│       ├── components/
│       │   ├── Layout/
│       │   │   └── MainLayout.jsx     ← Navigation menu (sidebar + header)
│       │   ├── daily-collections/
│       │   │   ├── MilkPurchase.jsx
│       │   │   ├── MilkSales.jsx
│       │   │   ├── MilkSalesRateList.jsx
│       │   │   └── ...
│       │   ├── accounting/
│       │   ├── business-inventory/
│       │   ├── reports/
│       │   │   ├── DayBook.jsx
│       │   │   ├── CashBook.jsx
│       │   │   └── vyapar/            ← All Vyapar-specific reports
│       │   ├── payments/
│       │   ├── additional/            ← Quotation, Warranty, Machine
│       │   └── hrm/
│       ├── pages/
│       │   └── Dashboard.jsx
│       └── utils/
│           └── printReport.js         ← Common print utility
│
└── super-admin/                       ← Super admin panel (separate app)
```

---

## IMPORTANT NOTES FOR DEVELOPERS

### 1. Company Filter
Always ensure `companyId` is scoped in all queries. The `addCompanyFilter` middleware injects `req.companyId`. Never query without it.

### 2. Two Inventory Systems
```
Dairy:    Item + StockTransaction (has inventoryType field)
Business: BusinessItem + BusinessStockTransaction (NO inventoryType field)
```
Never mix them. Vyapar reports must use BusinessStockTransaction.

### 3. API Response Pattern
```javascript
// Backend returns:
res.json({ success: true, data: {...} })

// Frontend api.js does: .then(res => res.data)
// So frontend receives: { success: true, data: {...} }
// To get actual data: response.data  (not response.data.data)
```

### 4. Ledgers for Milk Accounting
These ledgers **must be created** in Accounts for auto-vouchers to work:
- `PRODUCERS DUES` — type: Accounts Due To (Sundry Creditors)
- `MILK PURCHASE` — type: Purchases A/c
- `LOCAL SALES` — type: Sales A/c
- `SAMPLE SALES` — type: Sales A/c
- `MILK CREDIT SALES` — type: Sales A/c
- `SCHOOL MILK SALES` — type: Sales A/c

### 5. Auto-Numbering Formats
```
Milk Collection:  MC-YYMM-XXXXX
Milk Sales:       MS-YYMM-XXXX
Quotation:        EST-YYMM-XXXX
Warranty:         WRT-YYMM-XXXX
Machine:          MCH-YYMM-XXXX
Receipt Voucher:  RVYYMM0001
Payment Voucher:  PVYYMM0001
Journal Voucher:  JVYYMM0001
```

---

*Document generated from codebase analysis — DairySociety ERP v1.0 — March 2026*
