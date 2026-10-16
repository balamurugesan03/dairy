import { useState, useMemo } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Select,
  Table, ScrollArea, Stack, SimpleGrid, Loader, Center,
  Badge, SegmentedControl, ThemeIcon, Divider, Modal, NumberInput
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconBook2, IconCalendar, IconRefresh, IconPrinter,
  IconFileExport, IconInbox
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI, ledgerAPI } from '../../services/api';
import { openA4Print, a4Header, a4Signatures, escapeHtml } from '../../utils/printA4';
import { useCompany } from '../../context/CompanyContext';

// ── Helpers ───────────────────────────────────────────────────────────────
const f2 = (n) => parseFloat(n || 0).toFixed(2);
const fz = (n) => { const v = parseFloat(n || 0); return v === 0 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

// ── Presets ───────────────────────────────────────────────────────────────
const PRESETS = [
  { value: 'thisMonth',     label: 'This Month' },
  { value: 'lastMonth',     label: 'Last Month' },
  { value: 'thisQuarter',   label: 'This Quarter' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom',        label: 'Custom Range' }
];

const getPresetRange = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'thisMonth':     return [now.startOf('month').toDate(), now.endOf('month').toDate()];
    case 'lastMonth':     return [now.subtract(1,'month').startOf('month').toDate(), now.subtract(1,'month').endOf('month').toDate()];
    case 'thisQuarter':   return [now.startOf('quarter').toDate(), now.endOf('quarter').toDate()];
    case 'financialYear': {
      const fy = now.month() >= 3 ? now.year() : now.year() - 1;
      return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
    }
    default: return [null, null];
  }
};

// ── Report views — same names as the R&D Statement ────────────────────────
const VIEW_OPTS = [
  { value: 'accountGroup', label: 'Account Group Wise' },
  { value: 'flat',         label: 'Ledger Wise' },
  { value: 'grouped',      label: 'Category Wise' }
];
const viewLabelOf = (v) => (VIEW_OPTS.find(o => o.value === v) || VIEW_OPTS[0]).label;

// ── Category display config (for the "Category Wise" view) ─────────────────
const CATEGORY_CONFIG = {
  ASSETS:      { label: 'Assets' },
  LIABILITIES: { label: 'Liabilities' },
  INCOME:      { label: 'Income' },
  EXPENSES:    { label: 'Expenses' },
  CAPITAL:     { label: 'Capital & Reserves' },
  OTHER:       { label: 'Other' }
};

const getCatConf = (cat) => CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER;

// ── Account Group filter options ──────────────────────────────────────────
const LEDGER_TYPE_OPTS = [
  { value: '', label: 'All Account Groups' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank', label: 'Bank' },
  { value: 'Asset', label: 'Asset' },
  { value: 'Liability', label: 'Liability' },
  { value: 'Income', label: 'Income' },
  { value: 'Expense', label: 'Expense' },
  { value: 'Capital', label: 'Capital' },
  { value: 'Purchases A/c', label: 'Purchases A/c' },
  { value: 'Sales A/c', label: 'Sales A/c' },
  { value: 'Trade Expenses', label: 'Trade Expenses' },
  { value: 'Trade Income', label: 'Trade Income' }
];

// ── Design tokens ─────────────────────────────────────────────────────────
const INDIGO  = '#312e81';
const INDIGO2 = '#4338ca';

// One text colour for every value and label in the grid; sections are told
// apart by weight and a single neutral row shade, not by colour.
const INK     = '#1a1a1a';
const LINE    = '1px solid #ced4da';
const GROUP_BG = '#f1f3f5';
const FONT    = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const thBase = {
  padding: '8px 10px', fontSize: 12, fontWeight: 700, fontFamily: FONT,
  color: INK, background: '#e9ecef',
  border: LINE, whiteSpace: 'nowrap', textAlign: 'center'
};
const thLeft = { ...thBase, textAlign: 'left' };
const tdBase = { padding: '6px 10px', fontSize: 13, fontFamily: FONT, color: INK, border: LINE };
const tdRight = { ...tdBase, textAlign: 'right', fontSize: 13.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// ── Parent-group labels ────────────────────────────────────────────────────
const PG_CONFIG = {
  ASSET:     { label: 'Assets' },
  LIABILITY: { label: 'Liabilities' },
  INCOME:    { label: 'Income' },
  EXPENSE:   { label: 'Expenses' },
  OTHER:     { label: 'Other' }
};

// ── Main component ────────────────────────────────────────────────────────
const LedgerAbstract = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [loading, setLoading]           = useState(false);
  const [reportData, setReportData]     = useState(null);
  const [groupedData, setGroupedData]   = useState(null);
  const [preset, setPreset]             = useState('financialYear');
  const [dateRange, setDateRange]       = useState(getPresetRange('financialYear'));
  const [ledgerType, setLedgerType]     = useState('');
  // Account Group Wise is the preferred/default view; Ledger Wise and
  // Category Wise remain available as additional options.
  const [view, setView]                 = useState('accountGroup'); // accountGroup | flat | grouped

  // Opening balance editor. The abstract's Opening Balance comes straight
  // from the Ledger master (Ledger.openingBalance / openingBalanceType), so
  // editing it here saves to that same Ledger record — the Ledger screen and
  // this report always show the same figure.
  const [obEdit, setObEdit]     = useState(null); // { ledgerId, ledgerName, amount, type, periodOpening, periodType }
  const [obLoading, setObLoading] = useState(false);
  const [obSaving, setObSaving]   = useState(false);

  const openObEditor = async (item) => {
    if (!item?.ledgerId) return;
    setObEdit({
      ledgerId: item.ledgerId, ledgerName: item.ledgerName, amount: 0, type: 'Dr',
      periodOpening: item.openingBalance, periodType: item.openingBalanceType
    });
    setObLoading(true);
    try {
      const res = await ledgerAPI.getById(item.ledgerId);
      const ledger = res?.data || res;
      setObEdit(prev => prev && ({
        ...prev,
        amount: ledger?.openingBalance || 0,
        type: ledger?.openingBalanceType || 'Dr'
      }));
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load ledger', color: 'red' });
      setObEdit(null);
    } finally {
      setObLoading(false);
    }
  };

  const saveOpeningBalance = async () => {
    if (!obEdit) return;
    setObSaving(true);
    try {
      await ledgerAPI.update(obEdit.ledgerId, {
        openingBalance: parseFloat(obEdit.amount) || 0,
        openingBalanceType: obEdit.type
      });
      notifications.show({ title: 'Saved', message: `Opening balance of ${obEdit.ledgerName} updated in Ledger`, color: 'green' });
      setObEdit(null);
      fetchReport();
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to update opening balance', color: 'red' });
    } finally {
      setObSaving(false);
    }
  };

  // Opening Dr / Cr cells of a ledger row — click to edit the Ledger's opening balance.
  const openingCells = (item) => {
    const cellProps = {
      onClick: () => openObEditor(item),
      title: 'Click to edit this ledger\'s Opening Balance',
      style: { ...tdRight, cursor: 'pointer' }
    };
    return (
      <>
        <Table.Td {...cellProps} className="la-ob-cell">{item.openingBalanceType === 'Dr' ? fz(item.openingBalance) : ''}</Table.Td>
        <Table.Td {...cellProps} className="la-ob-cell">{item.openingBalanceType === 'Cr' ? fz(item.openingBalance) : ''}</Table.Td>
      </>
    );
  };

  const handlePresetChange = (val) => {
    setPreset(val);
    if (val !== 'custom') setDateRange(getPresetRange(val));
  };

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      };
      if (ledgerType) params.ledgerType = ledgerType;
      const [res, resG] = await Promise.all([
        reportAPI.ledgerAbstract(params),
        reportAPI.ledgerAbstractGrouped(params)
      ]);
      setReportData(res?.data || res);
      setGroupedData(resG?.data || resG);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── Group abstract by category (for the "Category Wise" view) ───────────
  const grouped = useMemo(() => {
    if (!reportData?.abstract) return {};
    const map = {};
    reportData.abstract.forEach(item => {
      const cat = item.category || 'OTHER';
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [reportData]);

  const catOrder = ['ASSETS', 'LIABILITIES', 'INCOME', 'EXPENSES', 'CAPITAL', 'OTHER'];
  const sortedCats = catOrder.filter(c => grouped[c]?.length);

  // ── Category subtotals ──────────────────────────────────────────────────
  const catTotals = (items) =>
    items.reduce((acc, it) => {
      if (it.openingBalanceType === 'Dr') acc.obDr += it.openingBalance;
      else                                 acc.obCr += it.openingBalance;
      acc.debit   += it.totalReceipt ?? it.totalDebits;
      acc.credit  += it.totalPayment ?? it.totalCredits;
      if (it.closingBalanceType === 'Dr') acc.clDr += it.closingBalance;
      else                                 acc.clCr += it.closingBalance;
      return acc;
    }, { obDr: 0, obCr: 0, debit: 0, credit: 0, clDr: 0, clCr: 0 });

  // ── Export — Account Group → ledgers, same hierarchy as the default view ─
  const handleExport = () => {
    if (!groupedData?.groups?.length) return;
    const rows = [];
    groupedData.groups.forEach(g => {
      g.ledgers.forEach(item => {
        rows.push({
          'Account Group':  g.accountGroup,
          'Ledger Name':    item.ledgerName,
          'Opening Dr':     item.openingBalanceType === 'Dr' ? f2(item.openingBalance) : '',
          'Opening Cr':     item.openingBalanceType === 'Cr' ? f2(item.openingBalance) : '',
          'Total Receipt':  f2(item.receipt ?? item.debit),
          'Total Payment':  f2(item.payment ?? item.credit),
          'Closing Dr':     item.closingBalanceType === 'Dr' ? f2(item.closingBalance) : '',
          'Closing Cr':     item.closingBalanceType === 'Cr' ? f2(item.closingBalance) : ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger Abstract');
    XLSX.writeFile(wb, `ledger_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Ledger Abstract exported to Excel', color: 'green' });
  };

  // ── Print — dedicated A4 layout built from the data of the view on
  // screen (Ledger Wise / Category Wise / All Ledgers): one header, a plain
  // 7-column table with the column header repeated on every page, and the
  // grand total once at the end. Receipt / Payment already include every
  // Cash and Adjustment entry, so no separate Adjustment figure is printed.
  const handlePrint = () => {
    if (!abstract.length) return;
    const cells = (obDr, obCr, rec, pay, clDr, clCr, blank) => {
      const v = (n) => (blank ? fz(n) : f2(n));
      return `<td class="amt">${v(obDr)}</td><td class="amt">${v(obCr)}</td>`
        + `<td class="amt">${v(rec)}</td><td class="amt">${v(pay)}</td>`
        + `<td class="amt">${v(clDr)}</td><td class="amt">${v(clCr)}</td>`;
    };
    const ledgerRow = (item, rec, pay, indent) => `<tr>
        <td class="${indent ? 'indent' : ''}">${escapeHtml(item.ledgerName)}</td>
        ${cells(
          item.openingBalanceType === 'Dr' ? item.openingBalance : 0,
          item.openingBalanceType === 'Cr' ? item.openingBalance : 0,
          rec, pay,
          item.closingBalanceType === 'Dr' ? item.closingBalance : 0,
          item.closingBalanceType === 'Cr' ? item.closingBalance : 0,
          true
        )}
      </tr>`;

    let body = '';
    if (view === 'accountGroup') {
      let currentPG = null;
      (groupedData?.groups || []).forEach(group => {
        const pg = group.parentGroup || 'OTHER';
        if (pg !== currentPG) {
          currentPG = pg;
          body += `<tr class="row-sec"><td colspan="7">${escapeHtml((PG_CONFIG[pg] || PG_CONFIG.OTHER).label)}</td></tr>`;
        }
        const t = group.totals;
        body += `<tr class="row-sub"><td>${escapeHtml(group.accountGroup)}</td>${cells(t.obDr, t.obCr, t.receipt ?? t.debit, t.payment ?? t.credit, t.clDr, t.clCr, false)}</tr>`;
        group.ledgers.forEach(item => { body += ledgerRow(item, item.receipt ?? item.debit, item.payment ?? item.credit, true); });
      });
    } else if (view === 'grouped') {
      sortedCats.forEach(cat => {
        const items = grouped[cat];
        const tot = catTotals(items);
        body += `<tr class="row-sec"><td colspan="7">${escapeHtml(getCatConf(cat).label)}</td></tr>`;
        items.forEach(item => { body += ledgerRow(item, item.totalReceipt ?? item.totalDebits, item.totalPayment ?? item.totalCredits, true); });
        body += `<tr class="row-sub"><td class="amt">Sub-total — ${escapeHtml(getCatConf(cat).label)}</td>${cells(tot.obDr, tot.obCr, tot.debit, tot.credit, tot.clDr, tot.clCr, false)}</tr>`;
      });
    } else {
      abstract.forEach(item => { body += ledgerRow(item, item.totalReceipt ?? item.totalDebits, item.totalPayment ?? item.totalCredits, false); });
    }
    if (s) {
      body += `<tr class="row-grand"><td>GRAND TOTAL — ${s.totalLedgers} Ledger${s.totalLedgers !== 1 ? 's' : ''}</td>${cells(
        s.totalOpeningDebit, s.totalOpeningCredit, s.totalReceipt ?? s.totalDebits, s.totalPayment ?? s.totalCredits,
        s.totalClosingDebit, s.totalClosingCredit, false
      )}</tr>`;
    }

    const viewLabel = viewLabelOf(view);
    openA4Print({
      title: 'Ledger Abstract',
      orientation: 'portrait',
      bodyHtml: a4Header({
        orgName: companyName,
        title: 'Ledger Abstract',
        period: `${fmtDate(dateRange[0])} to ${fmtDate(dateRange[1])}`,
        extra: `${viewLabel} &nbsp;|&nbsp; Printed: ${dayjs().format('DD-MM-YYYY')}`
      }) + `
        <table class="a4">
          <colgroup>
            <col style="width:31%"><col style="width:11.5%"><col style="width:11.5%">
            <col style="width:11.5%"><col style="width:11.5%"><col style="width:11.5%"><col style="width:11.5%">
          </colgroup>
          <thead>
            <tr>
              <th rowspan="2">Ledger Name</th>
              <th colspan="2">Opening Balance</th>
              <th colspan="2">During Period</th>
              <th colspan="2">Closing Balance</th>
            </tr>
            <tr><th>Dr.</th><th>Cr.</th><th>Receipt</th><th>Payment</th><th>Dr.</th><th>Cr.</th></tr>
          </thead>
          <tbody>${body}</tbody>
        </table>` + a4Signatures(['President', 'Secretary'])
    });
  };

  const s = reportData?.summary;
  const abstract = reportData?.abstract || [];

  // ── Render account-group rows ("Account Group Wise" view) — Account Group
  // → its heads/ledgers, groups and ledgers A→Z (sorted server-side in
  // getLedgerAbstractGrouped). ─────────────────────────────────────────────
  const renderAccountGroup = () => {
    if (!groupedData?.groups?.length) return (
      <Table.Tr><Table.Td colSpan={7} style={{ ...tdBase, textAlign: 'center', padding: 24, color: '#777' }}>No grouped data</Table.Td></Table.Tr>
    );
    const rows = [];
    let currentPG = null;
    groupedData.groups.forEach((group, gi) => {
      const pg   = group.parentGroup || 'OTHER';
      const conf = PG_CONFIG[pg] || PG_CONFIG.OTHER;

      // Parent-group separator
      if (pg !== currentPG) {
        currentPG = pg;
        rows.push(
          <Table.Tr key={`pg-${pg}`}>
            <Table.Td colSpan={7} style={{ ...tdBase, fontWeight: 800, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase', borderTop: '2px solid #495057' }}>
              {conf.label}
            </Table.Td>
          </Table.Tr>
        );
      }

      // Account-group header
      const t = group.totals;
      rows.push(
        <Table.Tr key={`ag-${gi}`}>
          <Table.Td style={{ ...tdBase, fontWeight: 700, paddingLeft: 20, background: GROUP_BG }}>
            {group.accountGroup} <Text span size="xs" c="dimmed" fw={600}>({group.ledgers.length})</Text>
          </Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(t.obDr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(t.obCr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(t.receipt ?? t.debit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(t.payment ?? t.credit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{t.clDr > 0 ? f2(t.clDr) : ''}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{t.clCr > 0 ? f2(t.clCr) : ''}</Table.Td>
        </Table.Tr>
      );

      // Ledger rows inside the group — alphabetical by ledgerName
      group.ledgers.forEach((item, ii) => {
        rows.push(
          <Table.Tr key={`ag-${gi}-${ii}`}>
            <Table.Td style={{ ...tdBase, paddingLeft: 36 }}>{item.ledgerName}</Table.Td>
            {openingCells(item)}
            <Table.Td style={tdRight}>{fz(item.receipt ?? item.debit)}</Table.Td>
            <Table.Td style={tdRight}>{fz(item.payment ?? item.credit)}</Table.Td>
            <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Dr' ? fz(item.closingBalance) : ''}</Table.Td>
            <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Cr' ? fz(item.closingBalance) : ''}</Table.Td>
          </Table.Tr>
        );
      });
    });
    return rows;
  };

  // ── Render grouped-by-category rows ("Category Wise" view) ─────────────
  const renderGrouped = () => {
    const rows = [];
    sortedCats.forEach((cat, ci) => {
      const items = grouped[cat];
      const conf  = getCatConf(cat);
      const tot   = catTotals(items);

      // Category header
      rows.push(
        <Table.Tr key={`cat-${ci}`}>
          <Table.Td colSpan={7} style={{ ...tdBase, fontWeight: 800, fontSize: 13.5, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 14, borderTop: '2px solid #495057' }}>
            {conf.label} <Text span size="xs" c="dimmed" fw={600} tt="none">({items.length})</Text>
          </Table.Td>
        </Table.Tr>
      );

      // Ledger rows (A→Z)
      items.forEach((item, ii) => {
        rows.push(
          <Table.Tr key={`item-${ci}-${ii}`}>
            <Table.Td style={{ ...tdBase, paddingLeft: 28 }}>{item.ledgerName}</Table.Td>
            {openingCells(item)}
            <Table.Td style={tdRight}>{fz(item.totalReceipt ?? item.totalDebits)}</Table.Td>
            <Table.Td style={tdRight}>{fz(item.totalPayment ?? item.totalCredits)}</Table.Td>
            <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Dr' ? fz(item.closingBalance) : ''}</Table.Td>
            <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Cr' ? fz(item.closingBalance) : ''}</Table.Td>
          </Table.Tr>
        );
      });

      // Category sub-total
      rows.push(
        <Table.Tr key={`tot-${ci}`}>
          <Table.Td style={{ ...tdBase, fontWeight: 700, textAlign: 'right', paddingRight: 12, background: GROUP_BG }}>
            Sub-total — {conf.label}
          </Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(tot.obDr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(tot.obCr)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(tot.debit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{f2(tot.credit)}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{tot.clDr > 0 ? f2(tot.clDr) : ''}</Table.Td>
          <Table.Td style={{ ...tdRight, fontWeight: 700, background: GROUP_BG }}>{tot.clCr > 0 ? f2(tot.clCr) : ''}</Table.Td>
        </Table.Tr>
      );
    });

    return rows;
  };

  // ── Render flat table rows ("Ledger Wise" view, A→Z) ────────────────────
  const renderFlat = () =>
    abstract.map((item, idx) => (
      <Table.Tr key={idx}>
        <Table.Td style={tdBase}>{item.ledgerName}</Table.Td>
        {openingCells(item)}
        <Table.Td style={tdRight}>{fz(item.totalReceipt ?? item.totalDebits)}</Table.Td>
        <Table.Td style={tdRight}>{fz(item.totalPayment ?? item.totalCredits)}</Table.Td>
        <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Dr' ? fz(item.closingBalance) : ''}</Table.Td>
        <Table.Td style={{ ...tdRight, fontWeight: 600 }}>{item.closingBalanceType === 'Cr' ? fz(item.closingBalance) : ''}</Table.Td>
      </Table.Tr>
    ));

  const groupCount = groupedData?.groups?.length || 0;

  return (
    <Box p="md">
      <style>{`.la-ob-cell:hover { text-decoration: underline; background: #f8f9fa !important; }`}</style>

      {/* ── Page Header — title, counts and the report view selector ──── */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #c7d2fe' }}>
        <Box style={{ background: `linear-gradient(90deg, ${INDIGO} 0%, ${INDIGO2} 60%, #6366f1 100%)`, padding: '12px 20px' }}>
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <IconBook2 size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>General Ledger — Abstract</Title>
                <Text size="xs" c="rgba(255,255,255,0.75)">
                  {dateRange[0] && dateRange[1]
                    ? `${fmtDate(dateRange[0])} to ${fmtDate(dateRange[1])}`
                    : 'All ledger balances with opening, movement and closing'}
                </Text>
              </Box>
            </Group>
            <Group gap="sm" wrap="wrap">
              {reportData && (
                <Badge size="lg" variant="white" color="indigo">
                  {abstract.length} Ledger{abstract.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {groupCount} Group{groupCount !== 1 ? 's' : ''}
                </Badge>
              )}
              <SegmentedControl
                value={view}
                onChange={setView}
                data={VIEW_OPTS}
                size="xs"
                style={{ background: 'rgba(255,255,255,0.15)' }}
                styles={{ label: { color: '#fff', fontSize: 11.5, fontWeight: 600 }, indicator: { background: 'rgba(255,255,255,0.3)' } }}
              />
            </Group>
          </Group>
        </Box>
      </Paper>

      {/* ── Period / filters ───────────────────────────────────────────── */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <Select label="Period" value={preset} onChange={handlePresetChange} data={PRESETS} style={{ flex: '1 1 140px' }} size="sm" />
          <DatePickerInput
            label="From Date" value={dateRange[0]}
            onChange={(val) => { setDateRange([val, dateRange[1]]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            valueFormat="DD/MM/YYYY"
            style={{ flex: '1 1 140px' }} size="sm"
          />
          <DatePickerInput
            label="To Date" value={dateRange[1]}
            onChange={(val) => { setDateRange([dateRange[0], val]); setPreset('custom'); }}
            leftSection={<IconCalendar size={16} />}
            valueFormat="DD/MM/YYYY"
            style={{ flex: '1 1 140px' }} size="sm"
          />
          <Select
            label="Account Group"
            value={ledgerType}
            onChange={setLedgerType}
            data={LEDGER_TYPE_OPTS}
            style={{ flex: '1 1 160px' }}
            size="sm"
            clearable
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} size="sm" style={{ background: INDIGO2 }}>
            Generate
          </Button>
          {abstract.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="gray" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={handlePrint} size="sm">
                Print
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* ── Totals — below the Period section ─────────────────────────── */}
      {s && (
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm" mb="md">
          {[
            { label: 'Total Ledgers',  value: s.totalLedgers },
            { label: 'Opening Dr',     value: f2(s.totalOpeningDebit) },
            { label: 'Opening Cr',     value: f2(s.totalOpeningCredit) },
            { label: 'Total Receipt',  value: f2(s.totalReceipt ?? s.totalDebits) },
            { label: 'Total Payment',  value: f2(s.totalPayment ?? s.totalCredits) }
          ].map(stat => (
            <Paper key={stat.label} withBorder radius="md" p="xs" ta="center">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">{stat.label}</Text>
              <Text fw={700} size="md" c={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{stat.value}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" color="indigo" /></Center>
          ) : !reportData ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconBook2 size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">Select a period and click Generate to view the ledger abstract</Text>
              </Stack>
            </Center>
          ) : abstract.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={48} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No ledger data found for this period</Text>
              </Stack>
            </Center>
          ) : (
            <Table style={{ borderCollapse: 'collapse', background: '#fff' }}>
              {/* Double-row header */}
              <Table.Thead>
                <Table.Tr>
                  <Table.Th rowSpan={2} style={{ ...thLeft, minWidth: 220, verticalAlign: 'middle' }}>Ledger Name</Table.Th>
                  <Table.Th colSpan={2} style={thBase}>Opening Balance</Table.Th>
                  <Table.Th colSpan={2} style={thBase}>During Period (Receipt / Payment)</Table.Th>
                  <Table.Th colSpan={2} style={thBase}>Closing Balance</Table.Th>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Dr.</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Cr.</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Receipt</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Payment</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Dr.</Table.Th>
                  <Table.Th style={{ ...thBase, minWidth: 105 }}>Cr.</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {view === 'accountGroup' ? renderAccountGroup() : view === 'grouped' ? renderGrouped() : renderFlat()}
              </Table.Tbody>

              {/* Grand total footer */}
              {s && (
                <Table.Tfoot>
                  <Table.Tr>
                    {[
                      `GRAND TOTAL — ${s.totalLedgers} Ledger${s.totalLedgers !== 1 ? 's' : ''}`,
                      f2(s.totalOpeningDebit), f2(s.totalOpeningCredit),
                      f2(s.totalReceipt ?? s.totalDebits), f2(s.totalPayment ?? s.totalCredits),
                      f2(s.totalClosingDebit), f2(s.totalClosingCredit)
                    ].map((v, i) => (
                      <Table.Td
                        key={i}
                        style={{
                          ...(i === 0 ? { ...tdBase, textAlign: 'right', paddingRight: 12 } : tdRight),
                          fontWeight: 800, background: '#e9ecef',
                          borderTop: '2px solid #495057', borderBottom: '3px double #495057'
                        }}
                      >
                        {v}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                </Table.Tfoot>
              )}
            </Table>
          )}
        </ScrollArea>

        {/* Legend */}
        {abstract.length > 0 && (
          <Box p="sm" style={{ borderTop: LINE, background: '#f8f9fa' }}>
            <Group gap="sm" wrap="wrap" mb={6}>
              {[...(groupedData?.groups || [])]
                .sort((a, b) => a.accountGroup.localeCompare(b.accountGroup, 'en', { sensitivity: 'base' }))
                .map(g => (
                  <Badge key={g.accountGroup} size="sm" color="gray" variant="light">
                    {g.accountGroup}: {g.ledgers.length}
                  </Badge>
                ))}
            </Group>
            <Divider mb={6} />
            <Group gap="xl" wrap="wrap">
              <Text size="xs" c="dimmed">Dr = Debit balance (Asset/Expense nature)</Text>
              <Text size="xs" c="dimmed">Cr = Credit balance (Liability/Income nature)</Text>
              <Text size="xs" c="dimmed">Click an Opening Balance to edit it — it is saved to the Ledger</Text>
            </Group>
          </Box>
        )}
      </Paper>

      {/* ── Opening Balance editor — reads and writes the Ledger master ── */}
      <Modal
        opened={!!obEdit}
        onClose={() => !obSaving && setObEdit(null)}
        title={<Text fw={600}>Opening Balance — {obEdit?.ledgerName}</Text>}
        centered
        size="sm"
      >
        {obLoading ? (
          <Center py="lg"><Loader size="sm" /></Center>
        ) : obEdit && (
          <Stack gap="sm">
            <Group grow align="flex-end">
              <NumberInput
                label="Opening Balance (Ledger)"
                value={obEdit.amount}
                onChange={(v) => setObEdit(prev => ({ ...prev, amount: v }))}
                min={0}
                decimalScale={2}
                fixedDecimalScale
                hideControls
                data-autofocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveOpeningBalance(); }}
              />
              <Select
                label="Type"
                value={obEdit.type}
                onChange={(v) => setObEdit(prev => ({ ...prev, type: v || 'Dr' }))}
                data={['Dr', 'Cr']}
                allowDeselect={false}
                maw={90}
              />
            </Group>
            <Text size="xs" c="dimmed">
              This is the same Opening Balance shown in the Ledger. Saving here updates the Ledger, and changes made in the Ledger appear here.
            </Text>
            {(Math.abs((parseFloat(obEdit.amount) || 0) - (obEdit.periodOpening || 0)) > 0.005 || obEdit.type !== obEdit.periodType) && (obEdit.periodOpening || 0) > 0 && (
              <Text size="xs" c="dimmed">
                Opening for the selected period ({f2(obEdit.periodOpening)} {obEdit.periodType}) also includes entries posted before the From Date.
              </Text>
            )}
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => setObEdit(null)} disabled={obSaving}>Cancel</Button>
              <Button onClick={saveOpeningBalance} loading={obSaving} style={{ background: INDIGO2 }}>Save</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
};

export default LedgerAbstract;
