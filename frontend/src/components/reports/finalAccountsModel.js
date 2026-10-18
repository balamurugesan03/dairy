/**
 * Final Accounts — one statement model shared by the screen grid, the A4
 * print and the Excel export, so all three always show the same rows.
 *
 * statement = {
 *   key, title, heading,
 *   left:  { title, caption, lines, total },
 *   right: { title, caption, lines, total },
 *   sideTitles,            // false → no Payment/Receipt title row (P&L, as in the reference PDF)
 *   note:  { tone: 'ok' | 'warn' | 'profit' | 'loss', text } | null
 * }
 * line = { type: 'group', sl, label }
 *      | { type: 'item', label, amount, total? }   // total = group total, on the group's last row
 *      | { type: 'carried', label, total }         // "Brought From Trading A/c" etc. — Total column only
 *
 * Trading and P&L sides are Payment / expenses (left) and Receipt / income
 * (right); the Balance Sheet keeps Liabilities (left) / Assets (right).
 */
import dayjs from 'dayjs';

const num = (v) => parseFloat(v || 0) || 0;
const sum = (arr, key = 'amount') => arr.reduce((s, x) => s + num(x[key]), 0);

/** Group header + its items; the group total sits on the last item row. */
const groupLines = (label, items, { always = false, emptyLabel } = {}) => {
  const rows = (items || []).filter(it => always || num(it.amount) !== 0);
  if (rows.length === 0) {
    if (!always) return [];
    rows.push({ label: emptyLabel || label, amount: 0 });
  }
  const total = sum(rows);
  return [
    { type: 'group', label },
    ...rows.map((it, i) => ({
      type: 'item',
      label: it.label,
      amount: num(it.amount),
      ...(i === rows.length - 1 ? { total } : {})
    }))
  ];
};

/** Group header + one carried-forward row (amount in the Total column only). */
const carried = (group, label, total) => [
  { type: 'group', label: group },
  { type: 'carried', label, total: num(total) }
];

/** Number the group headers 1, 2, 3… down one side. */
const numbered = (lines) => {
  let sl = 0;
  return lines.map(l => (l.type === 'group' ? { ...l, sl: ++sl } : l));
};

const side = (title, caption, lines, total) => ({ title, caption, lines: numbered(lines), total: num(total) });

const D = (d) => dayjs(d).format('DD-MMM-YYYY');
const forPeriod = (period) => (period ? ` FOR THE PERIOD : ${D(period.startDate)} - ${D(period.endDate)}` : '');

const fromLedgers = (ledgers) => (ledgers || []).map(l => ({ label: l.name, amount: l.amount ?? l.balance }));
const fromItems = (items) => (items || []).map(it => ({ label: it.ledgerName, amount: it.amount }));

/* ── Trading Account ───────────────────────────────────────────── */
/**
 * Fixed groups (reference PDF): Opening Stock / Purchases / Trade Expenses on
 * the left, Sales / Trade Income / Closing Stock on the right. A group with no
 * ledgers shows only its header; the group total is left blank when it is 0.
 */
const fixedGroup = (label, items, { keepZero = false } = {}) => {
  const rows = (items || []).filter(it => keepZero || num(it.amount) !== 0);
  if (rows.length === 0) return [{ type: 'group', label }];
  const total = sum(rows);
  return [
    { type: 'group', label },
    ...rows.map((it, i) => ({
      type: 'item',
      label: it.label,
      amount: num(it.amount),
      ...(i === rows.length - 1 && total !== 0 ? { total } : {})
    }))
  ];
};

/** Merge same-named ledgers (case-insensitive) and sort A→Z. */
const mergeSorted = (items) => {
  const map = new Map();
  items.forEach(it => {
    const label = String(it.label || '').trim();
    if (!label) return;
    const key = label.toUpperCase();
    const prev = map.get(key);
    map.set(key, { label: prev?.label || label, amount: num(prev?.amount) + num(it.amount) });
  });
  return [...map.values()].sort((a, b) => a.label.toUpperCase().localeCompare(b.label.toUpperCase()));
};

/** Item stock categories → the three Closing Stock rows, always shown. */
const CLOSING_STOCK_ROWS = ['CATTLE FEED', 'MINERALS', 'OTHERS'];
const stockBucket = (category) => {
  const c = String(category || '').toLowerCase();
  if (c.includes('feed')) return 'CATTLE FEED';
  if (c.includes('mineral')) return 'MINERALS';
  return 'OTHERS';
};

const TR_LEFT  = { 'Opening Stock': 'Opening Stock', 'Purchases': 'Purchases', 'Purchases A/c': 'Purchases', 'Trade Expenses': 'Trade Expenses' };
const TR_RIGHT = { 'Sales': 'Sales', 'Sales A/c': 'Sales', 'Trade Income': 'Trade Income', 'Closing Stock (Trading)': 'Closing Stock' };

export const buildTrading = (data, source, period) => {
  if (!data) return null;
  const { debitSide: d = {}, creditSide: c = {}, totals = {} } = data;
  const dynamic = source === 'dynamic';

  // Ledger groups → the fixed buckets; anything else keeps its own group after them.
  const bucketize = (groups, map, buckets, extra) => (groups || []).forEach(g => {
    const target = map[g.accountGroup];
    if (target) buckets[target].push(...fromItems(g.items));
    else extra.push(g);
  });

  const L = { 'Opening Stock': [], 'Purchases': [], 'Trade Expenses': [] };
  const R = { 'Sales': [], 'Trade Income': [], 'Closing Stock': [] };
  const extraL = [];
  const extraR = [];

  L['Opening Stock'].push({ label: 'OPENING STOCK', amount: d.openingStock?.total });
  L['Purchases'].push({ label: 'MILK PURCHASE', amount: d.milkPurchase?.total });
  R['Sales'].push({ label: 'MILK SALES', amount: c.milkSales?.total });
  R['Sales'].push({ label: 'UNION SALES', amount: c.unionSales?.total });

  if (dynamic) {
    bucketize(d.purchaseGroups, TR_LEFT, L, extraL);
    bucketize(c.salesGroups, TR_RIGHT, R, extraR);
  } else {
    L['Purchases'].push(...fromItems(d.purchases?.items));
    L['Trade Expenses'].push(...fromItems(d.tradeExpenses?.items));
    R['Sales'].push(...fromItems(c.sales?.items));
    R['Trade Income'].push(...fromItems(c.tradeIncome?.items));
  }

  // Closing Stock: item categories + any closing-stock ledgers, folded into CATTLE FEED / MINERALS / OTHERS
  const stock = Object.fromEntries(CLOSING_STOCK_ROWS.map(k => [k, 0]));
  (c.closingStock?.items || []).forEach(it => { stock[stockBucket(it.category)] += num(it.amount); });
  R['Closing Stock'].forEach(it => { stock[stockBucket(it.label)] += num(it.amount); });
  const closingRows = CLOSING_STOCK_ROWS.map(k => ({ label: k, amount: stock[k] }));

  const left = [
    ...Object.entries(L).flatMap(([g, items]) => fixedGroup(g, mergeSorted(items))),
    ...extraL.flatMap(g => groupLines(g.accountGroup, fromItems(g.items))),
    ...(num(d.grossProfit) > 0 ? carried('Gross Profit', 'Carried to Profit & Loss A/c', d.grossProfit) : [])
  ];
  const right = [
    ...fixedGroup('Sales', mergeSorted(R['Sales'])),
    ...fixedGroup('Trade Income', mergeSorted(R['Trade Income'])),
    ...extraR.flatMap(g => groupLines(g.accountGroup, fromItems(g.items))),
    ...fixedGroup('Closing Stock', closingRows, { keepZero: true }),
    ...(num(c.grossLoss) > 0 ? carried('Gross Loss', 'Carried to Profit & Loss A/c', c.grossLoss) : [])
  ];

  return {
    key: 'trading',
    title: 'Trading Account',
    heading: `TRADING ACCOUNT${forPeriod(period || data.period)}`,
    sideTitles: false,
    left:  side('Payment', 'Expenditure / Purchases', left, totals.debitTotal),
    right: side('Receipt', 'Sales / Income', right, totals.creditTotal),
    note: null
  };
};

/* ── Profit & Loss Account ─────────────────────────────────────── */
export const buildProfitLoss = (data, source, period) => {
  if (!data) return null;
  const dynamic = source === 'dynamic';
  const tradeProfit = num(data.tradeProfit);
  const tradeLoss = num(data.tradeLoss);
  const netProfit = num(data.netProfit);
  const totalExpense = num(data.totalExpense);
  const totalIncome = num(data.totalIncome);
  const isProfit = netProfit >= 0;

  const left = [
    ...(tradeLoss > 0 ? carried('Gross Loss', 'Brought From Trading A/c', tradeLoss) : []),
    ...(dynamic
      ? (data.expenseGroups || []).flatMap(g => groupLines(g.accountGroup, fromLedgers(g.ledgers)))
      : groupLines('Expenses', fromLedgers(data.expenses))),
    ...(isProfit && netProfit !== 0 ? carried('Net Profit', 'Carried to Balance Sheet', netProfit) : [])
  ];
  const right = [
    ...(tradeProfit > 0 ? carried('Gross Profit', 'Brought From Trading A/c', tradeProfit) : []),
    ...(dynamic
      ? (data.incomeGroups || []).flatMap(g => groupLines(g.accountGroup, fromLedgers(g.ledgers)))
      : groupLines('Income', fromLedgers(data.income))),
    ...(!isProfit ? carried('Net Loss', 'Carried to Balance Sheet', Math.abs(netProfit)) : [])
  ];

  return {
    key: 'pl',
    title: 'Profit & Loss Account',
    heading: `PROFIT AND LOSS ACCOUNT${forPeriod(period)}`,
    sideTitles: false,
    left:  side('Payment', 'Expenses', left, totalExpense + tradeLoss + (isProfit ? netProfit : 0)),
    right: side('Receipt', 'Income', right, totalIncome + tradeProfit + (!isProfit ? Math.abs(netProfit) : 0)),
    note: { tone: isProfit ? 'profit' : 'loss', text: `${isProfit ? 'Net Profit' : 'Net Loss'} : ${fmtAmount(Math.abs(netProfit))}` }
  };
};

/* ── Balance Sheet ─────────────────────────────────────────────── */
/**
 * Liabilities (left) / Assets (right). Ledgers are indented; contra-balance
 * ledgers (flag from the backend) print red; Net Profit / Net Loss is a normal
 * single-ledger group ("Profit" / "Loss") kept in title case; Closing Stock
 * always lists CATTLE FEED / MINERALS / OTHERS; a "Grand Total" row closes it.
 */
const bsLedgers = (ledgers) => (ledgers || []).map(l => ({
  label: l.name, amount: l.amount ?? l.balance, contra: !!l.contra
}));

const bsGroup = (label, items) => {
  const rows = (items || []).filter(it => num(it.amount) !== 0);
  if (rows.length === 0) return [];
  const total = sum(rows);
  return [
    { type: 'group', label },
    ...rows.map((it, i) => ({
      type: 'item',
      label: it.label,
      amount: num(it.amount),
      ...(it.contra ? { contra: true } : {}),
      ...(it.keepCase ? { keepCase: true } : {}),
      ...(i === rows.length - 1 ? { total } : {})
    }))
  ];
};

export const buildBalanceSheet = (data, source, period) => {
  if (!data) return null;
  const dynamic = source === 'dynamic';
  const netProfit = num(data.netProfit);
  // The selected date string first — the backend's end-of-day timestamp can roll to the next day in IST
  const asOn = period?.endDate || data.asOn || data.toDate;
  const profitRows = netProfit > 0
    ? bsGroup('Profit', [{ label: 'Net Profit Brought From P&L A/c', amount: netProfit, keepCase: true }]) : [];
  const lossRows = netProfit < 0
    ? bsGroup('Loss', [{ label: 'Net Loss Brought From P&L A/c', amount: -netProfit, keepCase: true }]) : [];

  // Closing Stock: item categories + any "Closing Stock" ledgers → three fixed rows
  const stock = Object.fromEntries(CLOSING_STOCK_ROWS.map(k => [k, 0]));
  (data.closingStockItems || []).forEach(it => { stock[stockBucket(it.category)] += num(it.amount); });

  let left, right, leftTotal, rightTotal;
  if (dynamic) {
    const assetGroups = (data.assetGroups || []).filter(g => {
      if (g.accountGroup !== 'Closing Stock') return true;
      (g.ledgers || []).forEach(l => { stock[stockBucket(l.name)] += num(l.amount); });
      return false;
    });
    left = (data.liabilityGroups || []).flatMap(g => bsGroup(g.accountGroup, bsLedgers(g.ledgers)));
    right = assetGroups.flatMap(g => bsGroup(g.accountGroup, bsLedgers(g.ledgers)));
    leftTotal = num(data.totalLiabilities) + Math.max(netProfit, 0);
    rightTotal = num(data.totalAssets) + num(data.closingStock) + Math.max(-netProfit, 0);
  } else {
    left = [
      ...bsGroup('Liabilities', bsLedgers(data.liabilities)),
      ...bsGroup('Capital', bsLedgers(data.capital))
    ];
    right = bsGroup('Assets', bsLedgers(data.assets));
    leftTotal = num(data.totalLiabilitiesAndCapital) - Math.min(netProfit, 0);
    rightTotal = num(data.totalAssets) + Math.max(-netProfit, 0);
  }
  left = [...left, ...profitRows];
  right = [
    ...right,
    ...fixedGroup('Closing Stock', CLOSING_STOCK_ROWS.map(k => ({ label: k, amount: stock[k] })), { keepZero: true }),
    ...lossRows
  ];

  const diff = Math.abs(num(leftTotal) - num(rightTotal));
  return {
    key: 'bs',
    title: 'Balance Sheet',
    heading: `BALANCE SHEET${asOn ? ` AS ON ${D(asOn)}` : ''}`,
    sideTitles: false,
    indentLedgers: true,
    blankRowsBeforeTotal: 3,
    grandLabel: 'Grand Total',
    left:  { ...side('Liabilities', '', left, leftTotal), colTitle: 'Liabilities' },
    right: { ...side('Assets', '', right, rightTotal), colTitle: 'Assets' },
    note: diff < 1
      ? { tone: 'ok', text: `Balance Sheet tallied — Liabilities = Assets = ${fmtAmount(rightTotal)}` }
      : { tone: 'warn', text: `Not balanced — Liabilities ${fmtAmount(leftTotal)} ≠ Assets ${fmtAmount(rightTotal)} (Difference ${fmtAmount(diff)})` }
  };
};

/* ── formatting / pairing ──────────────────────────────────────── */
/** 150,750.00 — thousand separators, 2 decimals, negatives with a leading minus. */
export const fmtAmount = (v) => {
  const n = num(v);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 && s !== '0.00' ? `-${s}` : s;
};

/** Left/right lines zipped into aligned rows (the shorter side gets blank rows). */
export const pairRows = (st) => {
  const n = Math.max(st.left.lines.length, st.right.lines.length);
  return Array.from({ length: n }, (_, i) => [st.left.lines[i] || null, st.right.lines[i] || null]);
};
