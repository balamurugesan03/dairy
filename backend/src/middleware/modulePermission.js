import { isSuperAdminReq, isAdminTierReq, hasModuleAction } from '../utils/userTier.js';

// ════════════════════════════════════════════════════════════════
//  Server-side module permissions (User Management)
//
//  Runs from addCompanyFilter on every company-scoped API call.
//  Super Admin: everything. Other User Management users: a write
//  (POST → write, PUT/PATCH → edit, DELETE → delete) needs that
//  action on the module (or one of its screens) assigned to them.
//  Reads are not blocked here — screens of one module read lookups
//  of others (farmers, centres, ledgers…); the menu and route guard
//  keep unassigned screens closed.
//
//  Super Admin-only API (imports, rate charts, Day Book / Cash Book
//  delete) is refused for everybody else, whatever was assigned.
// ════════════════════════════════════════════════════════════════

// First path segment after /api → module key
const MODULE_OF = {
  farmers: 'farmers', 'farmer-settings': 'farmers', agents: 'farmers', customers: 'farmers',
  'collection-centers': 'farmers', 'business-customers': 'farmers',

  'milk-collections': 'milkCollection', 'milk-sales': 'milkCollection', 'union-sales-slips': 'milkCollection',
  'milk-purchase-settings': 'milkCollection', 'milk-sales-rates': 'milkCollection',
  'transport-routes': 'milkCollection', 'milk-receipts': 'milkCollection', 'milk-cans': 'milkCollection',
  'shift-incentives': 'milkCollection', 'time-incentives': 'milkCollection', 'machine-config': 'milkCollection',
  'milma-charts': 'milkCollection', 'producer-openings': 'milkCollection',

  suppliers: 'inventory', items: 'inventory', stock: 'inventory', sales: 'inventory', subsidies: 'inventory',
  'dairy-purchase-returns': 'inventory', 'dairy-sales-returns': 'inventory',
  'business-suppliers': 'businessInventory', 'business-inventory': 'businessInventory',
  'business-sales': 'businessInventory', 'purchase-returns': 'businessInventory', 'sales-returns': 'businessInventory',

  advances: 'payments', 'farmer-payments': 'payments', 'producer-loans': 'payments', 'producer-receipts': 'payments',
  'bank-transfers': 'payments', 'producer-payments': 'payments', 'payment-register': 'payments',
  'milk-bill': 'payments', 'earning-deductions': 'payments', 'individual-transactions': 'payments',
  'historical-rules': 'payments', 'periodical-rules': 'payments', 'cattle-feed-advance': 'payments',
  'producer-register': 'payments',

  ledgers: 'accounting', vouchers: 'accounting', 'business-accounting': 'accounting',

  'incentive-register': 'reports', 'bonus-register': 'reports', 'crop-statements': 'reports',
  'agri-stats': 'reports', 'inspection-report': 'reports', 'bmcc-operating-cost': 'reports',

  employees: 'hrm', attendance: 'hrm', salary: 'hrm', leaves: 'hrm', loans: 'hrm',
  departments: 'hrm', designations: 'hrm',

  'society-info': 'settings', 'financial-years': 'settings',

  machines: 'machines', quotations: 'quotations', warranty: 'warranty',
  promotions: 'promotions', 'business-promotions': 'promotions',
};

// Super Admin-only writes: [path regex (after /api), methods]
const SUPER_ADMIN_ONLY = [
  // Milk Purchase / Milk Sales / Union Sales import (+ the Day Book re-sync next to them)
  /^\/milk-collections\/(file-import|bulk-import|zibitt-import|linza-import|openlyssa-import|dairysoft-import)\/?$/,
  /^\/milk-sales\/(bulk-import|zibitt-raw-import|openlyssa-import|backfill-vouchers)\/?$/,
  /^\/union-sales-slips\/(file-import|bulk-import|zibitt-raw-import|backfill-vouchers)\/?$/,
  // Rate Chart Settings
  /^\/rate-charts(\/|$)/,
  // Day Book / Cash Book report Delete
  /^\/reports\/day-book-entry\/?$/,
];

const ACTION_OF = { POST: 'write', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' };

export const enforceModulePermission = (req, res, next) => {
  const action = ACTION_OF[req.method];
  if (!action) return next();                      // GET / HEAD / OPTIONS
  if (isSuperAdminReq(req)) return next();

  const path = (req.originalUrl || '').split('?')[0].replace(/^\/api(?=\/)/, '');

  if (SUPER_ADMIN_ONLY.some((re) => re.test(path))) {
    return res.status(403).json({ success: false, message: 'Only the Super Admin can use this option' });
  }

  // Centre logins keep their own allowedModules rules
  if (req.userType !== 'user') return next();

  const seg = path.split('/')[1] || '';
  const moduleKey = MODULE_OF[seg];
  if (!moduleKey) return next();

  // Admins can always add / manage Collection Centres
  if (seg === 'collection-centers' && isAdminTierReq(req)) return next();

  // POST is also used to save edits / run actions, so write or edit both pass it
  const ok = action === 'write'
    ? hasModuleAction(req.user, moduleKey, 'write') || hasModuleAction(req.user, moduleKey, 'edit')
    : hasModuleAction(req.user, moduleKey, action);
  if (ok) return next();
  return res.status(403).json({
    success: false,
    message: `You don't have ${action} permission for this module. Ask your Admin to assign it in User Management.`
  });
};
