/**
 * User tiers + module permissions (User Management).
 *
 *   Super Admin — the company login created at company setup, a platform
 *                 superadmin / admin account, or a User Management user of
 *                 type "Super Admin" (superuser). Sees everything, including
 *                 the Super Admin-only options.
 *   Admin       — User Management user of type "Admin": the modules assigned to
 *                 them + User Management + Collection Centre.
 *   Others      — only the modules assigned to them.
 *
 * Same rules as backend/src/utils/userTier.js — keep the two in step.
 */

// Super Admin-only screens: hidden from everybody else and never assignable
export const SUPER_ADMIN_ONLY_ROUTES = ['/daily-collections/rate-chart-settings', '/openlyssa-merge'];
// Screens decided by tier, not by assigned modules
export const USER_MANAGEMENT_ROUTE = '/user-management';

export const isSuperAdminAccount = (u) => !!u && u.loginType !== 'centre' && (
  u.loginType === 'company' || u.role === 'superadmin' || u.role === 'admin' || u.userType === 'superuser'
);
export const isAdminTierAccount = (u) => !!u && u.loginType === 'user' && !isSuperAdminAccount(u) && u.userType === 'admin';
// Super Admin + Admin may open User Management, create users and assign permissions
export const canManageUsersAccount = (u) => isSuperAdminAccount(u) || isAdminTierAccount(u);

// Old screens checked these keys; they now live under the grouped keys
const LEGACY_KEYS = { collectionCenters: 'farmers.collectionCenters' };

const anyFlag = (p) => !!p && (p.read || p.write || p.edit || p.delete);

/** Permission check for a module key ('farmers', 'farmers.collectionCenters', …) and action (or 'any'). */
export const hasModulePermission = (u, key, action = 'any') => {
  if (!u) return false;
  if (isSuperAdminAccount(u)) return true;
  const k = LEGACY_KEYS[key] || key;
  // Admins can always add / manage Collection Centres
  if (k === 'farmers.collectionCenters' && isAdminTierAccount(u)) return true;
  const perms = u.permissionsObject || {};
  const ok = (p) => (action === 'any' ? anyFlag(p) : !!p?.[action]);
  if (ok(perms[k])) return true;
  const dot = k.indexOf('.');
  if (dot > 0) return ok(perms[k.slice(0, dot)]);            // granted on the whole module
  // Module key: any of its screens counts as access to the module
  if (action === 'any') return Object.keys(perms).some((m) => m.startsWith(`${k}.`) && anyFlag(perms[m]));
  return false;
};

// Top-level menu → module key
export const MENU_MODULE = {
  '/': 'dashboard',
  'party-menu': 'farmers',
  'customer-menu': 'farmers',
  'sales-menu': 'milkCollection',
  'inventory-menu': 'inventory',
  'business-inventory-menu': 'businessInventory',
  'vyapar-reports-menu': 'businessReports',
  'payments-menu': 'payments',
  'accounting-menu': 'accounting',
  'dairy-reports-menu': 'reports',
  'quotations-menu': 'quotations',
  'machines-menu': 'machines',
  'warranty-menu': 'warranty',
  'business-promotions-menu': 'promotions',
  'hrm-menu': 'hrm',
  'settings-menu': 'settings',
};

// Screen → the sub-module that grants it (screens not listed need the whole module)
export const ROUTE_PERM = {
  '/farmers': 'farmers.producers',
  '/farmers/member-register': 'farmers.producers',
  '/farmers/report': 'farmers.producers',
  '/farmer-bank-details': 'farmers.producers',
  '/daily-collections/producer-report': 'farmers.producers',
  '/collection-centers': 'farmers.collectionCenters',
  '/agents': 'farmers.agents',
  '/customers': 'farmers.milkSalesCustomers',

  '/daily-collections/milk-purchase': 'milkCollection.purchase',
  '/daily-collections/list': 'milkCollection.dailyList',
  '/daily-collections/milk-sales': 'milkCollection.sales',
  '/daily-collections/union-sales-slip': 'milkCollection.unionSales',
  '/daily-collections/farmer-wise-summary': 'milkCollection.farmerSummary',
  '/daily-collections/milk-purchase-settings': 'milkCollection.machineConfig',
  '/daily-collections/milk-sales-rate': 'milkCollection.milkSalesRate',
  '/daily-collections/shift-incentive': 'milkCollection.shiftIncentive',
  '/daily-collections/time-incentive': 'milkCollection.timeIncentive',
  '/daily-collections/producer-openings': 'milkCollection.producerOpenings',
  '/reports/milk-purchase-report': 'milkCollection.purchase',
  '/reports/milk-sales-report': 'milkCollection.sales',
  '/reports/union-sales-report': 'milkCollection.unionSales',
  '/reports/union-sale-quality-comparison': 'milkCollection.unionSales',
  '/reports/dairy-register': 'reports.dairyRegister',
  '/reports/dairy-abstract': 'reports.dairyAbstract',

  '/suppliers': 'inventory.suppliers',
  '/inventory/items': 'inventory.items',
  '/inventory/stock-in': 'inventory.stockIn',
  '/sales/new': 'inventory.sales',
  '/sales/list': 'inventory.sales',
  '/inventory/stock-out': 'inventory.stockOut',
  '/inventory/purchase-returns': 'inventory.purchaseReturns',
  '/inventory/sales-returns': 'inventory.salesReturns',
  '/subsidies': 'inventory.subsidies',

  '/payments/receipts': 'payments.receipts',
  '/payments/creditor-bill': 'payments.register',
  '/payments/register-ledger': 'payments.register',
  '/payments/producer-payment': 'payments.register',
  '/payments/payment-register-report': 'payments.register',
  '/payments/bank-transfer': 'payments.bankTransfer',
  '/payments/payment-to-producer': 'payments.paymentToProducer',
  '/payments/loans': 'payments.loans',
  '/payments/cash-advance': 'payments.cashAdvance',
  '/payments/cattle-feed-advance': 'payments.cattleFeed',
  '/payments/earning-deduction-master': 'payments.earningDeduction',
  '/payments/individual-deduction-earning': 'payments.earningDeduction',
  '/payments/historical-deduction-earning': 'payments.earningDeduction',
  '/payments/periodical-deduction-earning': 'payments.earningDeduction',
  '/payments/producer-register': 'payments.producerRegister',
  '/payments/producer-register-summary': 'payments.producerRegister',
  '/payments/farmer-ledger': 'payments.farmerLedger',

  '/accounting/ledgers': 'accounting.ledgers',
  '/accounting/receipt': 'accounting.receipt',
  '/accounting/payment': 'accounting.payment',
  '/accounting/journal': 'accounting.journal',
  '/accounting/vouchers': 'accounting.vouchers',
  '/accounting/cash-book-entry': 'accounting.cashBook',
  '/reports/daybook': 'accounting.dayBook',
  '/reports/cash-book': 'accounting.cashBook',
  '/reports/general-ledger': 'accounting.generalLedger',
  '/reports/ledger-abstract': 'accounting.generalLedger',
  '/reports/final-accounts': 'accounting.finalAccounts',
  '/accounting/outstanding': 'accounting.outstanding',
  '/reports/rd-enhanced': 'reports.rdStatement',
  '/reports/milk-bill-abstract': 'reports.milkBillAbstract',

  '/reports/mis-report': 'reports.misReport',
  '/reports/monthly-mis-report': 'reports.monthlyMIS',
  '/reports/inspection-report': 'reports.inspectionReport',
  '/reports/milk-statement': 'reports.milkStatement',
  '/farmers/crop-statements': 'reports.cropStatements',
  '/farmers/agri-stats': 'reports.agriStats',
  '/farmers/lsgd/milk-subsidy': 'reports.lsgdMilkSubsidy',
  '/farmers/lsgd/milk-incentive': 'reports.lsgdMilkIncentive',
  '/farmers/lsgd/mithram-statement': 'reports.lsgdMithram',

  '/hrm/employees': 'hrm.employees',
  '/hrm/attendance': 'hrm.attendance',
  '/hrm/leaves': 'hrm.leaves',
  '/hrm/salary': 'hrm.salary',
  '/hrm/loans': 'hrm.loans',

  '/society-info': 'settings.societyInfo',
  '/financial-year': 'settings.financialYear',
  '/payment-settings': 'settings.paymentSettings',
};

/** Can this user open the menu item / screen `route` that sits under the module `moduleKey`? */
export const canOpenRoute = (u, route, moduleKey) => {
  if (isSuperAdminAccount(u)) return true;
  if (SUPER_ADMIN_ONLY_ROUTES.includes(route)) return false;
  if (route === USER_MANAGEMENT_ROUTE) return canManageUsersAccount(u);
  const sub = ROUTE_PERM[route];
  if (sub && hasModulePermission(u, sub)) return true;
  // Granted on the whole module (the module row itself, not just one screen of it)
  const perms = u?.permissionsObject || {};
  return !!moduleKey && anyFlag(perms[moduleKey]);
};

/** Menu items the user may see: unassigned screens removed, empty groups dropped. */
export const filterMenuForUser = (u, items) => {
  if (isSuperAdminAccount(u)) return items;
  const walk = (list, moduleKey) => list.flatMap((it) => {
    if (it.children) {
      const children = walk(it.children, moduleKey);
      return children.length ? [{ ...it, children }] : [];
    }
    return canOpenRoute(u, it.key, moduleKey) ? [it] : [];
  });
  return items.flatMap((item) => {
    const moduleKey = MENU_MODULE[item.key];
    if (!item.children) return canOpenRoute(u, item.key, moduleKey) ? [item] : [];
    const children = walk(item.children, moduleKey);
    return children.length ? [{ ...item, children }] : [];
  });
};

/**
 * Direct URL access: the menu entry with the longest matching path decides
 * (/farmers/add → /farmers). Paths outside the menu (profile, …) stay open.
 * `menuItems` = the full, unfiltered menu.
 */
export const canOpenPath = (u, path, menuItems) => {
  if (isSuperAdminAccount(u)) return true;
  if (SUPER_ADMIN_ONLY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))) return false;
  if (path === USER_MANAGEMENT_ROUTE || path.startsWith(`${USER_MANAGEMENT_ROUTE}/`)) return canManageUsersAccount(u);
  let best = null;
  const visit = (list, moduleKey) => list.forEach((it) => {
    if (it.children) { visit(it.children, moduleKey); return; }
    const r = it.key;
    if (typeof r !== 'string' || !r.startsWith('/')) return;
    const match = r === '/' ? path === '/' : (path === r || path.startsWith(`${r}/`));
    if (match && (!best || r.length > best.route.length)) best = { route: r, moduleKey };
  });
  menuItems.forEach((item) => {
    const moduleKey = MENU_MODULE[item.key];
    if (item.children) visit(item.children, moduleKey);
    else visit([item], moduleKey);
  });
  // Screens not in the menu but named in ROUTE_PERM (e.g. /inventory/purchase-returns/new)
  if (!best) {
    const r = Object.keys(ROUTE_PERM).filter((k) => path === k || path.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0];
    if (r) best = { route: r, moduleKey: ROUTE_PERM[r].split('.')[0] };
  }
  if (!best) return true;
  return canOpenRoute(u, best.route, best.moduleKey);
};

// Full grouped module structure — main modules + sub-modules. Super Admin-only
// options (Rate Chart Settings, OpenLyssa Merge Tool) and User Management are
// NOT assignable, so they are not in this list.
export const MODULE_GROUPS = [
  {
    key: 'dashboard', label: 'Dashboard', color: '#4dabf7',
    subModules: []
  },
  {
    key: 'farmers', label: 'Farmers Management', color: '#51cf66',
    subModules: [
      { key: 'farmers.producers',          label: 'Producer Management'   },
      { key: 'farmers.collectionCenters',  label: 'Collection Centre'     },
      { key: 'farmers.agents',             label: 'Agent Management'      },
      { key: 'farmers.milkSalesCustomers', label: 'Customer (Milk Sales)' },
    ]
  },
  {
    key: 'milkCollection', label: 'Milk Purchase & Sales', color: '#74c0fc',
    subModules: [
      { key: 'milkCollection.purchase',        label: 'Milk Purchase'         },
      { key: 'milkCollection.dailyList',        label: 'Daily Collection List' },
      { key: 'milkCollection.sales',            label: 'Milk Sales'            },
      { key: 'milkCollection.unionSales',       label: 'Union Sales'           },
      { key: 'milkCollection.farmerSummary',    label: 'Farmer-Wise Summary'   },
      { key: 'milkCollection.machineConfig',    label: 'Machine Configuration' },
      { key: 'milkCollection.milkSalesRate',    label: 'Milk Sales Rate'       },
      { key: 'milkCollection.shiftIncentive',   label: 'Shift Incentive'       },
      { key: 'milkCollection.timeIncentive',    label: 'Time Incentive'        },
      { key: 'milkCollection.producerOpenings', label: 'Producer Openings'     },
    ]
  },
  {
    key: 'inventory', label: 'Dairy Inventory', color: '#ffa94d',
    subModules: [
      { key: 'inventory.suppliers',        label: 'Supplier'                        },
      { key: 'inventory.items',            label: 'Items'                           },
      { key: 'inventory.stockIn',          label: 'Inventory Purchase'              },
      { key: 'inventory.sales',            label: 'Inventory Sales'                 },
      { key: 'inventory.stockOut',         label: 'Stock Returns'                   },
      { key: 'inventory.purchaseReturns',  label: 'Purchase Return (Debit Note)'    },
      { key: 'inventory.salesReturns',     label: 'Sales Return'                    },
      { key: 'inventory.subsidies',        label: 'Subsidy'                         },
    ]
  },
  {
    key: 'payments', label: 'Producers Dues', color: '#69db7c',
    subModules: [
      { key: 'payments.receipts',           label: 'Producer Receipts'      },
      { key: 'payments.register',           label: 'Payment Register'       },
      { key: 'payments.bankTransfer',       label: 'Bank Transfer'          },
      { key: 'payments.paymentToProducer',  label: 'Payment to Producer'    },
      { key: 'payments.loans',              label: 'Loans'                  },
      { key: 'payments.cashAdvance',        label: 'Cash Advance'           },
      { key: 'payments.cattleFeed',         label: 'Cattle Feed Advance'    },
      { key: 'payments.earningDeduction',   label: 'Earnings / Deductions'  },
      { key: 'payments.producerRegister',   label: 'Producer Register'      },
      { key: 'payments.farmerLedger',       label: 'Producer Ledger'        },
    ]
  },
  {
    key: 'accounting', label: 'Accounts', color: '#a9e34b',
    subModules: [
      { key: 'accounting.ledgers',   label: 'Ledgers'                  },
      { key: 'accounting.receipt',   label: 'Receipt Voucher'          },
      { key: 'accounting.payment',   label: 'Payment Voucher'          },
      { key: 'accounting.journal',   label: 'Adjustment / Journal'     },
      { key: 'accounting.vouchers',  label: 'Vouchers Management'      },
      { key: 'accounting.cashBook',  label: 'Cash Book'                },
      { key: 'accounting.dayBook',   label: 'Day Book'                 },
      { key: 'accounting.generalLedger', label: 'General Ledger'       },
      { key: 'accounting.finalAccounts', label: 'Final Accounts'       },
      { key: 'accounting.outstanding',   label: 'Outstanding Report'   },
    ]
  },
  {
    key: 'reports', label: 'Dairy Reports', color: '#f783ac',
    subModules: [
      { key: 'reports.dairyAbstract',   label: 'Dairy Abstract'           },
      { key: 'reports.dairyRegister',   label: 'Dairy Register'           },
      { key: 'reports.misReport',       label: 'MIS Report'               },
      { key: 'reports.monthlyMIS',      label: 'Monthly MIS Report'       },
      { key: 'reports.milkPurchase',    label: 'Milk Purchase Report'     },
      { key: 'reports.milkStatement',   label: 'Milk Statement'           },
      { key: 'reports.milkBillAbstract',label: 'Milk Bill Abstract'       },
      { key: 'reports.rdStatement',     label: 'Receipt and Disbursements' },
      { key: 'reports.inspectionReport',label: 'Inspection Report'        },
      { key: 'reports.cropStatements',  label: 'Crop Damage Statements'   },
      { key: 'reports.agriStats',       label: 'Monthly Agri Statistics'  },
      { key: 'reports.lsgdMilkSubsidy',   label: "LSGD: Panchayath People's Planning Milk Subsidy" },
      { key: 'reports.lsgdMilkIncentive', label: 'LSGD: Panchayath Annual Plan Milk Incentive' },
      { key: 'reports.lsgdMithram',      label: 'LSGD: Mithram Statement' },
    ]
  },
  {
    key: 'businessInventory', label: 'Business Inventory', color: '#da77f2',
    subModules: [
      { key: 'businessInventory.suppliers',       label: 'Supplier'            },
      { key: 'businessInventory.items',           label: 'Item Master'         },
      { key: 'businessInventory.stockIn',         label: 'Purchase / Stock In' },
      { key: 'businessInventory.sales',           label: 'Sales Invoices'      },
      { key: 'businessInventory.stockOut',        label: 'Stock Out / Returns' },
      { key: 'businessInventory.purchaseReturns', label: 'Purchase Return'     },
      { key: 'businessInventory.salesReturns',    label: 'Sales Return'        },
    ]
  },
  {
    key: 'businessReports', label: 'Business Reports', color: '#4cc9f0',
    subModules: [
      { key: 'businessReports.saleReport',     label: 'Sale Report'       },
      { key: 'businessReports.purchaseReport', label: 'Purchase Report'   },
      { key: 'businessReports.partyStatement', label: 'Party Statement'   },
      { key: 'businessReports.allParties',     label: 'All Parties'       },
      { key: 'businessReports.gstr1',          label: 'GSTR-1'            },
      { key: 'businessReports.gstr2',          label: 'GSTR-2'            },
      { key: 'businessReports.profitLoss',     label: 'Profit & Loss'     },
      { key: 'businessReports.tradingAccount', label: 'Trading Account'   },
      { key: 'businessReports.balanceSheet',   label: 'Balance Sheet'     },
      { key: 'businessReports.trialBalance',   label: 'Trial Balance'     },
    ]
  },
  {
    key: 'quotations', label: 'Quotations', color: '#63e6be',
    subModules: [
      { key: 'quotations.add',  label: 'Add Quotation'   },
      { key: 'quotations.list', label: 'Quotation List'  },
    ]
  },
  {
    key: 'machines', label: 'Machines', color: '#ffd43b',
    subModules: [
      { key: 'machines.add',  label: 'Add Machine'  },
      { key: 'machines.list', label: 'Machine List' },
    ]
  },
  {
    key: 'warranty', label: 'Warranty', color: '#ff8787',
    subModules: [
      { key: 'warranty.add',  label: 'Add Warranty'   },
      { key: 'warranty.list', label: 'Warranty List'  },
    ]
  },
  {
    key: 'promotions', label: 'Promotions', color: '#f08c00',
    subModules: [
      { key: 'promotions.dashboard', label: 'Dashboard'        },
      { key: 'promotions.coupons',   label: 'Discount Coupons' },
      { key: 'promotions.offers',    label: 'Offers & Schemes' },
      { key: 'promotions.campaigns', label: 'Campaigns'        },
    ]
  },
  {
    key: 'hrm', label: 'Human Resources', color: '#748ffc',
    subModules: [
      { key: 'hrm.employees',   label: 'Employees'         },
      { key: 'hrm.attendance',  label: 'Attendance'        },
      { key: 'hrm.leaves',      label: 'Leave Management'  },
      { key: 'hrm.salary',      label: 'Payroll'           },
      { key: 'hrm.loans',       label: 'Loans / Advance'   },
    ]
  },
  {
    key: 'settings', label: 'Settings', color: '#94d82d',
    subModules: [
      { key: 'settings.societyInfo',      label: 'Society Info'        },
      { key: 'settings.financialYear',    label: 'Financial Year'      },
      { key: 'settings.paymentSettings',  label: 'Payment Settings'    },
    ]
  },
];

export const BUSINESS_ONLY_GROUPS = new Set(['businessInventory', 'businessReports', 'quotations', 'machines', 'warranty', 'promotions']);

// Flat list of ALL module keys (main + sub) for permission initialisation
export const MODULES = MODULE_GROUPS.flatMap(g => [g.key, ...g.subModules.map(s => s.key)]);
