import { useState, useMemo } from 'react';
import {
  Box, Paper, Group, Text, Button, Select, ScrollArea, Stack, Loader, Center,
  Badge, SegmentedControl, Modal, NumberInput
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
import { openA4Print, escapeHtml } from '../../utils/printA4';
import { useCompany } from '../../context/CompanyContext';

// General Ledger abstract — laid out exactly as the reference PDF: a
// 3-line heading, Ledger | Opening Dr./Cr. | Receipt/Payment | Closing
// Asset (Dr.)/Liability (Cr.), dotted grid lines, a solid line under each
// group heading, no fills, no subtotal / grand total rows.

// ── Helpers ───────────────────────────────────────────────────────────────
const f2 = (n) => parseFloat(n || 0).toFixed(2);
// Amounts: 2 decimals, no thousand separators, blank when zero.
const fz = (n) => { const v = parseFloat(n || 0); return Math.abs(v) < 0.005 ? '' : v.toFixed(2); };
const fmtDate = (d) => d ? dayjs(d).format('DD/MM/YYYY') : '';

const financialYearRange = () => {
  const now = dayjs();
  const fy = now.month() >= 3 ? now.year() : now.year() - 1;
  return [new Date(fy, 3, 1), new Date(fy + 1, 2, 31)];
};

// ── Report views ──────────────────────────────────────────────────────────
// Ledger-wise   = ledgers under their Account Group ("Advance due by Society (LIABILITY)")
// Category-wise = ledgers under their category (Liabilities, Assets …)
// All Ledger    = one A→Z list, no headings
const VIEW_OPTS = [
  { value: 'accountGroup', label: 'Ledger-wise' },
  { value: 'grouped',      label: 'Category-wise' },
  { value: 'flat',         label: 'All Ledger' }
];

const CATEGORY_LABEL = {
  LIABILITIES: 'Liabilities', CAPITAL: 'Capital & Reserves', ASSETS: 'Assets',
  INCOME: 'Income', EXPENSES: 'Expenses', OTHER: 'Other'
};

// Liability side first, then Asset, then the revenue groups.
const PG_ORDER  = ['LIABILITY', 'ASSET', 'INCOME', 'EXPENSE', 'OTHER'];
const CAT_ORDER = ['LIABILITIES', 'CAPITAL', 'ASSETS', 'INCOME', 'EXPENSES', 'OTHER'];

// ── Opening / Closing Balance visibility ──────────────────────────────────
// Only balance-sheet groups (Liability, Asset, Grants and Subsidies …) carry
// an Opening and Closing Balance. Revenue groups — Income, Sales, Expense,
// Establishment Charges, Purchases, Trade Expenses — show Receipt / Payment only.
const GRANT_TYPES = ['Grants and Subsidies', 'Grants & Aid', 'Subsidies'];
const hidesBalance = (ledgerType, parentGroup, category) =>
  !GRANT_TYPES.includes(ledgerType) &&
  (['INCOME', 'EXPENSE'].includes(parentGroup) || ['INCOME', 'EXPENSES'].includes(category));
const stripBalance = (item) => ({ ...item, noBal: true, openingBalance: 0, closingBalance: 0 });

// One grid row's figures. Opening and Closing sit on one side only.
const rowValues = (item) => {
  const ob = item.noBal ? 0 : item.openingBalance;
  const cl = item.noBal ? 0 : item.closingBalance;
  return {
    obDr: item.openingBalanceType === 'Dr' ? ob : 0,
    obCr: item.openingBalanceType === 'Cr' ? ob : 0,
    // grouped endpoint: receipt / payment; flat endpoint: totalReceipt / totalPayment
    rec:  item.receipt ?? item.totalReceipt ?? item.debit ?? item.totalDebits,
    pay:  item.payment ?? item.totalPayment ?? item.credit ?? item.totalCredits,
    clDr: item.closingBalanceType === 'Dr' ? cl : 0,
    clCr: item.closingBalanceType === 'Cr' ? cl : 0
  };
};

// ── Layout — shared by screen (scoped under .gla) and print ──────────────
const GRID_CSS = `
  .gla { font-family: 'Times New Roman', Times, serif; color: #000; }
  .gla-head { text-align: center; line-height: 1.25; margin-bottom: 2px; }
  .gla-head__org { font-size: 14pt; text-transform: uppercase; font-weight: 400; }
  .gla-head__title { font-size: 18pt; font-weight: 700; text-decoration: underline; text-transform: uppercase; }
  .gla-head__period { font-size: 13pt; font-weight: 400; }
  .gla table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff;
    font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; border: 1px dotted #000; }
  .gla th, .gla td { border: 1px dotted #000; padding: 2px 4px; vertical-align: top; }
  .gla th { font-weight: 700; text-align: center; vertical-align: middle; }
  .gla td.name { text-transform: uppercase; overflow-wrap: anywhere; }
  .gla td.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .gla tr.grp td { border: none; border-bottom: 1px solid #000; font-size: 13pt; font-weight: 700;
    text-align: left; padding: 6px 2px 2px; }
  .gla thead { display: table-header-group; }
  .gla tbody.keep { break-inside: avoid; page-break-inside: avoid; }
`;

const COLS = [26, 12.33, 12.33, 12.33, 12.33, 12.34, 12.34];

const theadHtml = `
  <colgroup>${COLS.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
  <thead>
    <tr>
      <th rowspan="2">Ledger</th>
      <th colspan="2">Opening Balance</th>
      <th colspan="2">During the Year</th>
      <th colspan="2">Closing Balance</th>
    </tr>
    <tr><th>Dr.</th><th>Cr.</th><th>Receipt</th><th>Payment</th><th>Asset (Dr.)</th><th>Liability (Cr.)</th></tr>
  </thead>`;

const headingHtml = (orgName, range) => `
  <div class="gla-head">
    <div class="gla-head__org">${escapeHtml(orgName)}</div>
    <div class="gla-head__title">General Ledger</div>
    <div class="gla-head__period">Abstract for the period of ${fmtDate(range[0])} to ${fmtDate(range[1])}</div>
  </div>`;

// ── Main component ────────────────────────────────────────────────────────
const LedgerAbstract = () => {
  const { selectedCompany } = useCompany();
  const orgName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [loading, setLoading]         = useState(false);
  const [reportData, setReportData]   = useState(null);
  const [groupedData, setGroupedData] = useState(null);
  const [dateRange, setDateRange]     = useState(financialYearRange);
  const [loadedRange, setLoadedRange] = useState(null);
  const [view, setView]               = useState('accountGroup'); // accountGroup | grouped | flat

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

  const fetchReport = async () => {
    const [start, end] = dateRange;
    if (!start || !end) {
      notifications.show({ title: 'Error', message: 'Select From and To dates', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(start).format('YYYY-MM-DD'),
        endDate:   dayjs(end).format('YYYY-MM-DD')
      };
      const [res, resG] = await Promise.all([
        reportAPI.ledgerAbstract(params),
        reportAPI.ledgerAbstractGrouped(params)
      ]);
      setReportData(res?.data || res);
      setGroupedData(resG?.data || resG);
      setLoadedRange([start, end]);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── Report data with Opening / Closing blanked for revenue groups ───────
  const abstract = useMemo(() =>
    (reportData?.abstract || []).map(it =>
      hidesBalance(it.ledgerType, it.parentGroup, it.category) ? stripBalance(it) : it),
  [reportData]);

  // Account groups — Liability side first, then Asset (A→Z within each).
  const groups = useMemo(() =>
    (groupedData?.groups || [])
      .map(g => hidesBalance(g.accountGroup, g.parentGroup) ? { ...g, ledgers: g.ledgers.map(stripBalance) } : g)
      .sort((a, b) => {
        const ai = PG_ORDER.indexOf(a.parentGroup), bi = PG_ORDER.indexOf(b.parentGroup);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
  [groupedData]);

  // The view on screen as sections: { title | null, items }.
  const sections = useMemo(() => {
    if (view === 'accountGroup') {
      return groups.map(g => ({ title: `${g.accountGroup} (${g.parentGroup || 'OTHER'})`, items: g.ledgers }));
    }
    if (view === 'grouped') {
      const map = {};
      abstract.forEach(it => { (map[it.category || 'OTHER'] ||= []).push(it); });
      return CAT_ORDER.filter(c => map[c]?.length).map(c => ({ title: CATEGORY_LABEL[c], items: map[c] }));
    }
    return [{ title: null, items: abstract }];
  }, [view, groups, abstract]);

  // ── Export — the view on screen, same columns as the grid ──────────────
  const handleExport = () => {
    if (!abstract.length) return;
    const num = (v) => (Math.abs(v || 0) < 0.005 ? '' : Math.round(v * 100) / 100);
    const aoa = [
      ['Ledger', 'Opening Balance', '', 'During the Year', '', 'Closing Balance', ''],
      ['', 'Dr.', 'Cr.', 'Receipt', 'Payment', 'Asset (Dr.)', 'Liability (Cr.)']
    ];
    sections.forEach(sec => {
      if (sec.title) aoa.push([sec.title]);
      sec.items.forEach(item => {
        const v = rowValues(item);
        aoa.push([item.ledgerName.toUpperCase(), num(v.obDr), num(v.obCr), num(v.rec), num(v.pay), num(v.clDr), num(v.clCr)]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 0, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 0, c: 6 } }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger');
    XLSX.writeFile(wb, `general_ledger_abstract_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'General Ledger abstract exported to Excel', color: 'green' });
  };

  // ── Print — A4 portrait, heading on page 1, header rows repeat. Each
  // group heading shares an unbreakable block with its first two ledgers, so
  // it never sits alone at the foot of a page. ─────────────────────────────
  const handlePrint = () => {
    if (!abstract.length) return;
    const rowHtml = (item) => {
      const v = rowValues(item);
      return `<tr><td class="name">${escapeHtml(item.ledgerName)}</td>${
        [v.obDr, v.obCr, v.rec, v.pay, v.clDr, v.clCr].map(n => `<td class="amt">${fz(n)}</td>`).join('')}</tr>`;
    };
    const body = sections.map(sec => {
      if (!sec.title) return `<tbody>${sec.items.map(rowHtml).join('')}</tbody>`;
      const head = sec.items.slice(0, 2), rest = sec.items.slice(2);
      return `<tbody class="keep"><tr class="grp"><td colspan="7">${escapeHtml(sec.title)}</td></tr>${head.map(rowHtml).join('')}</tbody>`
        + (rest.length ? `<tbody>${rest.map(rowHtml).join('')}</tbody>` : '');
    }).join('');
    openA4Print({
      title: 'General Ledger',
      orientation: 'portrait',
      css: `${GRID_CSS} body { font-family: 'Times New Roman', Times, serif; }`,
      bodyHtml: `<div class="gla">${headingHtml(orgName, loadedRange)}<table>${theadHtml}${body}</table></div>`
    });
  };

  // ── Screen grid ─────────────────────────────────────────────────────────
  const renderRow = (item, key) => {
    const v = rowValues(item);
    // Opening Dr / Cr cells — click to edit the Ledger's opening balance.
    const obProps = item.noBal ? {} : {
      className: 'amt gla-ob', onClick: () => openObEditor(item), title: 'Click to edit this ledger\'s Opening Balance'
    };
    return (
      <tr key={key}>
        <td className="name">{item.ledgerName}</td>
        <td className="amt" {...obProps}>{fz(v.obDr)}</td>
        <td className="amt" {...obProps}>{fz(v.obCr)}</td>
        <td className="amt">{fz(v.rec)}</td>
        <td className="amt">{fz(v.pay)}</td>
        <td className="amt">{fz(v.clDr)}</td>
        <td className="amt">{fz(v.clCr)}</td>
      </tr>
    );
  };

  const groupCount = groups.length;

  return (
    <Box p="md">
      {/* ── Top bar — view selector beside the Ledgers / Groups count ──── */}
      <Group gap="sm" align="center" wrap="wrap" mb="md" data-no-print>
        <Badge size="lg" variant="light" color="indigo" radius="sm">
          {reportData
            ? <>{abstract.length} Ledger{abstract.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {groupCount} Group{groupCount !== 1 ? 's' : ''}</>
            : 'Ledgers · Groups'}
        </Badge>
        <SegmentedControl value={view} onChange={setView} data={VIEW_OPTS} size="xs" />
      </Group>

      {/* ── Filter bar — From Date, To Date, Generate ─────────────────── */}
      <Paper radius="sm" p="sm" mb="md" withBorder data-no-print>
        <Group gap="sm" wrap="nowrap" align="flex-end">
          <DatePickerInput
            label="From Date" value={dateRange[0]}
            onChange={(val) => setDateRange([val, dateRange[1]])}
            leftSection={<IconCalendar size={12} />} leftSectionWidth={24}
            w={112} size="xs"
          />
          <DatePickerInput
            label="To Date" value={dateRange[1]}
            onChange={(val) => setDateRange([dateRange[0], val])}
            leftSection={<IconCalendar size={12} />} leftSectionWidth={24}
            w={112} size="xs"
          />
          <Button leftSection={<IconRefresh size={14} />} onClick={fetchReport} loading={loading} size="xs">
            Generate
          </Button>
          {abstract.length > 0 && (
            <Group gap="xs" ml="auto" wrap="nowrap">
              <Button leftSection={<IconFileExport size={14} />} variant="light" color="gray" onClick={handleExport} size="xs">
                Export Excel
              </Button>
              <Button leftSection={<IconPrinter size={14} />} variant="light" color="gray" onClick={handlePrint} size="xs">
                Print
              </Button>
            </Group>
          )}
        </Group>
      </Paper>

      {loading ? (
        <Center py="xl"><Loader size="md" /></Center>
      ) : !reportData ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconBook2 size={48} color="#bdbdbd" />
            <Text c="dimmed" size="sm">Select From / To dates and click Generate</Text>
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
        <Paper radius="sm" p="md" withBorder style={{ background: '#fff' }}>
          <style>{`${GRID_CSS} .gla .gla-ob { cursor: pointer; } .gla .gla-ob:hover { text-decoration: underline; }`}</style>
          <ScrollArea type="auto">
            <div className="gla" style={{ minWidth: 820 }}>
              <div dangerouslySetInnerHTML={{ __html: headingHtml(orgName, loadedRange) }} />
              <table>
                <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
                <thead>
                  <tr>
                    <th rowSpan={2}>Ledger</th>
                    <th colSpan={2}>Opening Balance</th>
                    <th colSpan={2}>During the Year</th>
                    <th colSpan={2}>Closing Balance</th>
                  </tr>
                  <tr>
                    <th>Dr.</th><th>Cr.</th><th>Receipt</th><th>Payment</th><th>Asset (Dr.)</th><th>Liability (Cr.)</th>
                  </tr>
                </thead>
                {sections.map((sec, si) => (
                  <tbody key={si}>
                    {sec.title && <tr className="grp"><td colSpan={7}>{sec.title}</td></tr>}
                    {sec.items.map((item, ii) => renderRow(item, `${si}-${ii}`))}
                  </tbody>
                ))}
              </table>
            </div>
          </ScrollArea>
        </Paper>
      )}

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
              <Button onClick={saveOpeningBalance} loading={obSaving}>Save</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  );
};

export default LedgerAbstract;
