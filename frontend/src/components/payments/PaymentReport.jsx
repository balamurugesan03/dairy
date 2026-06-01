import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Select, Button, Loader, Center, Stack,
  Modal, Grid, Radio, Checkbox, Badge, ScrollArea, Divider,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconReportMoney, IconFilter, IconPrinter, IconX, IconArrowLeft,
  IconBuildingBank, IconCash, IconSearch, IconFileExport, IconMail,
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { bankTransferAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';
import { useCompany } from '../../context/CompanyContext';

const fmt  = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtI = (v) => new Intl.NumberFormat('en-IN').format(parseFloat(v) || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtDateShort = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ── HTML escape ───────────────────────────────────────────────────────────────
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ── Shared print CSS ──────────────────────────────────────────────────────────
const PRINT_BASE_STYLE = `
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;margin:14px;color:#000;font-size:12px}
  h2{margin:0 0 4px;text-align:center}
  .meta{font-size:11px;color:#444;margin-bottom:8px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th,td{border:1px solid #888;padding:4px 5px;text-align:left;vertical-align:top}
  thead th{background:#1a365d;color:#fff}
  .bank-head td{background:#1a365d;color:#fff;font-weight:700;font-size:11px;padding:5px 8px;border:1px solid #2d4a7a}
  .date-head td{background:#dbeafe;font-weight:700;font-size:11px;padding:5px 8px;border:1px solid #bfdbfe;border-left:4px solid #2563eb}
  .sub-tot td{background:#dbeafe;font-weight:700}
  .tot-row td{background:#f0fdf4;font-weight:700}
  tfoot th{background:#f3f3f3;font-weight:700}
  .right{text-align:right}
  @page{size:A4 landscape;margin:10mm}
`;

// ── iframe print ──────────────────────────────────────────────────────────────
function printHtml(html) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const cleanup = () => setTimeout(() => iframe.remove(), 500);
  iframe.onload = () => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } finally { cleanup(); } };
  setTimeout(() => { if (document.body.contains(iframe)) { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch {} cleanup(); } }, 300);
}

// ── Collect all bank rows from groups, grouped by bank name ──────────────────
function getBankGrouped(groups) {
  const bankMap = {};
  for (const g of groups) {
    for (const r of g.bankRows) {
      const key = r.bankName?.trim() || 'Unknown Bank';
      if (!bankMap[key]) bankMap[key] = [];
      bankMap[key].push({ ...r, _date: g.date });
    }
  }
  return Object.keys(bankMap).sort().map(bankName => ({
    bankName,
    rows: bankMap[bankName],
    total: bankMap[bankName].reduce((s, r) => s + (r.amount || 0), 0),
  }));
}

// ── Print: Bank List (All Banks = bank-wise sub-totals; specific bank = date-wise) ──
function buildBankListHtml(groups, societyName, fromDate, toDate, isML, selectedBank) {
  const allBanks = !selectedBank || selectedBank === 'all';

  if (allBanks) {
    const bankGroups = getBankGrouped(groups);
    const grandTotal = bankGroups.reduce((s, bg) => s + bg.total, 0);
    let rows = '';
    let sn   = 0;

    for (const bg of bankGroups) {
      rows += `<tr class="bank-head"><td colspan="8">
        ${isML ? 'ബാങ്ക്' : 'Bank'}: ${esc(bg.bankName)}
        &nbsp;&nbsp;(${bg.rows.length} ${isML ? 'ഉൽ.' : 'producers'})
      </td></tr>`;

      bg.rows.forEach(r => {
        sn++;
        rows += `<tr>
          <td>${sn}</td>
          <td>${esc(r.producerId)}</td>
          <td>${esc(r.producerName)}</td>
          <td>${esc(r.center)}</td>
          <td>${esc(r.accountNumber)}</td>
          <td>${esc(r.ifscCode)}</td>
          <td>${esc(r.branch || '')}</td>
          <td class="right">₹${esc(fmt(r.amount))}</td>
        </tr>`;
      });

      rows += `<tr class="sub-tot">
        <td colspan="7" style="text-align:right">
          ${isML ? 'ബാങ്ക് ആകെ' : 'Bank Sub-total'} — ${esc(bg.bankName)} (${bg.rows.length}):
        </td>
        <td class="right">₹${esc(fmt(bg.total))}</td>
      </tr><tr><td colspan="8" style="border:none;padding:3px"></td></tr>`;
    }

    return `<!doctype html><html><head><meta charset="utf-8"><title>Bank Transfer List</title>
<style>${PRINT_BASE_STYLE}</style></head><body>
<div style="text-align:center;font-size:16px;font-weight:700;margin-bottom:2px">${esc(societyName)}</div>
<h2>${isML ? 'ബാങ്ക് ട്രാൻസ്ഫർ ലിസ്റ്റ്' : 'Bank Transfer Statement — All Banks'}</h2>
<div class="meta">
  <span>${isML ? 'തീയതി' : 'From'}: <strong>${fmtDate(fromDate)}</strong></span>
  <span>${isML ? 'വരെ' : 'To'}: <strong>${fmtDate(toDate)}</strong></span>
  <span>${isML ? 'ആകെ' : 'Total'}: <strong>₹${esc(fmt(grandTotal))}</strong></span>
</div>
<table>
  <thead><tr>
    <th style="width:36px">SN</th>
    <th style="width:80px">${isML ? 'ഉൽ. നം.' : 'Prod No'}</th>
    <th>${isML ? 'ഉൽ. പേര്' : 'Producer Name'}</th>
    <th>${isML ? 'കേന്ദ്രം' : 'Center'}</th>
    <th>${isML ? 'A/C നം.' : 'Account No'}</th>
    <th>IFSC</th>
    <th>${isML ? 'ശാഖ' : 'Branch'}</th>
    <th class="right">${isML ? 'തുക (₹)' : 'Amount (₹)'}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <th colspan="7" style="text-align:right">${isML ? 'ആകെ' : 'GRAND TOTAL'} (${sn} ${isML ? 'ഉൽ.' : 'producers'})</th>
    <th class="right">₹${esc(fmt(grandTotal))}</th>
  </tr></tfoot>
</table></body></html>`;
  }

  // ── Specific bank: existing date-grouped layout ───────────────────────────
  let rows = '';
  let sn = 0;
  let grandTotal = 0;

  for (const g of groups) {
    if (!g.bankRows.length) continue;
    rows += `<tr class="date-head"><td colspan="8">${isML ? 'തീയതി' : 'Date of Payment'}: ${fmtDate(g.date)}</td></tr>`;
    g.bankRows.forEach(r => {
      sn++;
      grandTotal += r.amount || 0;
      rows += `<tr>
        <td>${sn}</td>
        <td>${esc(r.producerId)}</td>
        <td>${esc(r.producerName)}</td>
        <td>${esc(r.center)}</td>
        <td>${esc(r.accountNumber)}</td>
        <td>${esc(r.ifscCode)}</td>
        <td>${esc(r.bankName)}</td>
        <td class="right">₹${esc(fmt(r.amount))}</td>
      </tr>`;
    });
    rows += `<tr class="tot-row">
      <td colspan="7" style="text-align:right">${isML ? 'ദിവസ ആകെ' : 'Date Total'}:</td>
      <td class="right">₹${esc(fmt(g.totalBank))}</td>
    </tr>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Bank Transfer List</title>
<style>${PRINT_BASE_STYLE}</style></head><body>
<div style="text-align:center;font-size:16px;font-weight:700;margin-bottom:2px">${esc(societyName)}</div>
<h2>${isML ? 'ബാങ്ക് ട്രാൻസ്ഫർ ലിസ്റ്റ്' : `Bank Transfer Statement — ${selectedBank}`}</h2>
<div class="meta">
  <span>${isML ? 'തീയതി' : 'From'}: <strong>${fmtDate(fromDate)}</strong></span>
  <span>${isML ? 'വരെ' : 'To'}: <strong>${fmtDate(toDate)}</strong></span>
  <span>${isML ? 'ആകെ' : 'Total'}: <strong>₹${esc(fmt(grandTotal))}</strong></span>
</div>
<table>
  <thead><tr>
    <th style="width:36px">SN</th>
    <th style="width:80px">${isML ? 'ഉൽ. നം.' : 'Prod No'}</th>
    <th>${isML ? 'ഉൽ. പേര്' : 'Producer Name'}</th>
    <th>${isML ? 'കേന്ദ്രം' : 'Center'}</th>
    <th>${isML ? 'A/C നം.' : 'Account No'}</th>
    <th>IFSC</th>
    <th>${isML ? 'ബാങ്ക്' : 'Bank'}</th>
    <th class="right">${isML ? 'തുക (₹)' : 'Amount (₹)'}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <th colspan="7" style="text-align:right">${isML ? 'ആകെ' : 'GRAND TOTAL'}</th>
    <th class="right">₹${esc(fmt(grandTotal))}</th>
  </tr></tfoot>
</table></body></html>`;
}

// ── Print: Detail Report ──────────────────────────────────────────────────────
function buildDetailHtml(groups, societyName, fromDate, toDate, isBankMode, isML) {
  const title = isBankMode ? 'Bank Transfer Statement' : 'Payment Report';
  const cols   = isBankMode ? 8 : 7;
  let rows = '';

  for (const g of groups) {
    const allRows = [...g.bankRows.map(r => ({ ...r, _type: 'bank' })), ...g.cashRows.map(r => ({ ...r, _type: 'cash' }))];
    if (!allRows.length) continue;

    rows += `<tr class="date-head"><td colspan="${cols}">${isML ? 'പേമെന്‍റ് തീയതി' : 'Date of Payment'}: ${fmtDate(g.date)}</td></tr>`;

    allRows.forEach((r, i) => {
      rows += `<tr>
        <td>${i + 1}</td>
        <td>${esc(r.producerId)}</td>
        <td>${esc(r.producerName)}</td>
        <td>${esc(r.center)}</td>
        ${isBankMode ? `<td>${esc(r.bankName)}</td><td>${esc(r.accountNumber)}</td>` : ''}
        <td class="right">₹${esc(fmt(r.amount))}</td>
        <td>${esc(r.paymentMode)}</td>
      </tr>`;
    });

    rows += `<tr class="tot-row">
      <td colspan="${cols - 2}" style="text-align:right">${isML ? 'ദിവസ ആകെ' : 'Date Total'}:</td>
      <td class="right">₹${esc(fmt(g.grandTotal))}</td>
      <td style="font-size:9px">Bank:₹${esc(fmt(g.totalBank))} Cash:₹${esc(fmt(g.totalCash))}</td>
    </tr>`;
  }

  const grandTotal = groups.reduce((s, g) => s + g.grandTotal, 0);
  const grandBank  = groups.reduce((s, g) => s + g.totalBank, 0);
  const grandCash  = groups.reduce((s, g) => s + g.totalCash, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${PRINT_BASE_STYLE}</style></head><body>
<div style="text-align:center;font-size:16px;font-weight:700;margin-bottom:2px">${esc(societyName)}</div>
<h2>${esc(isML ? 'പേമെന്‍റ് റിപ്പോർട്ട്' : title)}</h2>
<div class="meta">
  <span>${isML ? 'തീയതി' : 'From'}: <strong>${fmtDate(fromDate)}</strong></span>
  <span>${isML ? 'വരെ' : 'To'}: <strong>${fmtDate(toDate)}</strong></span>
</div>
<table>
  <thead><tr>
    <th style="width:36px">SN</th>
    <th style="width:80px">${isML ? 'ഉൽ. നം.' : 'Prod No'}</th>
    <th>${isML ? 'ഉൽ. പേര്' : 'Producer Name'}</th>
    <th>${isML ? 'കേന്ദ്രം' : 'Center'}</th>
    ${isBankMode ? `<th>${isML ? 'ബാങ്ക്' : 'Bank'}</th><th>${isML ? 'A/C' : 'Account No'}</th>` : ''}
    <th class="right">${isML ? 'തുക' : 'Amount (₹)'}</th>
    <th>${isML ? 'രീതി' : 'Mode'}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <th colspan="${cols - 2}" style="text-align:right">${isML ? 'ആകെ' : 'GRAND TOTAL'}</th>
    <th class="right">₹${esc(fmt(grandTotal))}</th>
    <th style="font-size:9px">Bank:₹${esc(fmt(grandBank))} Cash:₹${esc(fmt(grandCash))}</th>
  </tr></tfoot>
</table></body></html>`;
}

// ── Print: Summary ────────────────────────────────────────────────────────────
function buildSummaryHtml(groups, societyName, fromDate, toDate, isML) {
  const rows = groups.map((g, i) => `<tr>
    <td>${i + 1}</td>
    <td>${fmtDateShort(g.date)}</td>
    <td class="right">${g.bankRows.length}</td>
    <td class="right">₹${esc(fmt(g.totalBank))}</td>
    <td class="right">${g.cashRows.length}</td>
    <td class="right">₹${esc(fmt(g.totalCash))}</td>
    <td class="right"><strong>₹${esc(fmt(g.grandTotal))}</strong></td>
  </tr>`).join('');

  const totBank = groups.reduce((s, g) => s + g.totalBank, 0);
  const totCash = groups.reduce((s, g) => s + g.totalCash, 0);
  const totAll  = totBank + totCash;
  const cntBank = groups.reduce((s, g) => s + g.bankRows.length, 0);
  const cntCash = groups.reduce((s, g) => s + g.cashRows.length, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>Payment Summary</title>
<style>${PRINT_BASE_STYLE}</style></head><body>
<div style="text-align:center;font-size:16px;font-weight:700;margin-bottom:2px">${esc(societyName)}</div>
<h2>${isML ? 'പേമെന്‍റ് സംഗ്രഹം' : 'Payment Report — Date-wise Summary'}</h2>
<div class="meta">
  <span>${isML ? 'തീയതി' : 'From'}: <strong>${fmtDate(fromDate)}</strong></span>
  <span>${isML ? 'വരെ' : 'To'}: <strong>${fmtDate(toDate)}</strong></span>
</div>
<table>
  <thead><tr>
    <th>SN</th><th>${isML ? 'തീയതി' : 'Date'}</th>
    <th class="right">${isML ? 'ബാങ്ക് (എണ്ണം)' : 'Bank Count'}</th>
    <th class="right">${isML ? 'ബാങ്ക് (₹)' : 'Bank Amount'}</th>
    <th class="right">${isML ? 'ക്യാഷ് (എണ്ണം)' : 'Cash Count'}</th>
    <th class="right">${isML ? 'ക്യാഷ് (₹)' : 'Cash Amount'}</th>
    <th class="right">${isML ? 'ആകെ (₹)' : 'Total (₹)'}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <th colspan="2" style="text-align:right">${isML ? 'ആകെ' : 'TOTAL'}</th>
    <th class="right">${cntBank}</th><th class="right">₹${esc(fmt(totBank))}</th>
    <th class="right">${cntCash}</th><th class="right">₹${esc(fmt(totCash))}</th>
    <th class="right">₹${esc(fmt(totAll))}</th>
  </tr></tfoot>
</table></body></html>`;
}

// ── Print: Cash List ──────────────────────────────────────────────────────────
function buildCashListHtml(groups, societyName, fromDate, toDate, isML) {
  let rows = '';
  let sn = 0;
  let grandTotal = 0;

  for (const g of groups) {
    if (!g.cashRows.length) continue;
    rows += `<tr class="date-head"><td colspan="6">${isML ? 'തീയതി' : 'Date of Payment'}: ${fmtDate(g.date)}</td></tr>`;
    g.cashRows.forEach(r => {
      sn++;
      grandTotal += r.amount || 0;
      rows += `<tr>
        <td>${sn}</td><td>${esc(r.producerId)}</td><td>${esc(r.producerName)}</td>
        <td>${esc(r.center)}</td><td class="right">₹${esc(fmt(r.amount))}</td><td></td>
      </tr>`;
    });
    rows += `<tr class="tot-row">
      <td colspan="4" style="text-align:right">${isML ? 'ദിവസ ആകെ' : 'Date Total'}:</td>
      <td class="right">₹${esc(fmt(g.totalCash))}</td><td></td>
    </tr>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Cash Payment List</title>
<style>${PRINT_BASE_STYLE}</style></head><body>
<div style="text-align:center;font-size:16px;font-weight:700;margin-bottom:2px">${esc(societyName)}</div>
<h2>${isML ? 'ക്യാഷ് പേമെന്‍റ് ലിസ്റ്റ്' : 'Cash Payment List'}</h2>
<div class="meta">
  <span>${isML ? 'തീയതി' : 'From'}: <strong>${fmtDate(fromDate)}</strong></span>
  <span>${isML ? 'വരെ' : 'To'}: <strong>${fmtDate(toDate)}</strong></span>
  <span>${isML ? 'ആകെ' : 'Total'}: <strong>₹${esc(fmt(grandTotal))}</strong></span>
</div>
<table>
  <thead><tr>
    <th>SN</th><th>${isML ? 'ഉൽ. നം.' : 'Prod No'}</th>
    <th>${isML ? 'ഉൽ. പേര്' : 'Producer Name'}</th>
    <th>${isML ? 'കേന്ദ്രം' : 'Center'}</th>
    <th class="right">${isML ? 'തുക (₹)' : 'Amount (₹)'}</th>
    <th>${isML ? 'ഒപ്പ്' : 'Signature'}</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <th colspan="4" style="text-align:right">${isML ? 'ആകെ' : 'GRAND TOTAL'}</th>
    <th class="right">₹${esc(fmt(grandTotal))}</th><th></th>
  </tr></tfoot>
</table></body></html>`;
}

// ── Mantine table helpers ─────────────────────────────────────────────────────
const TH = ({ children, right, span }) => (
  <th colSpan={span} style={{
    fontSize: 9, fontWeight: 800, background: '#1a365d', color: '#fff',
    padding: '5px 7px', textAlign: right ? 'right' : 'center',
    border: '1px solid #2d4a7a', whiteSpace: 'nowrap',
  }}>{children}</th>
);
const TD = ({ children, right, bold, c, bg, span }) => (
  <td colSpan={span} style={{
    fontSize: 11, padding: '4px 6px', border: '1px solid #e2e8f0',
    textAlign: right ? 'right' : 'center', verticalAlign: 'middle',
    fontWeight: bold ? 700 : 400, color: c, background: bg,
  }}>{children}</td>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function PaymentReport() {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const societyName = selectedCompany?.companyName || 'Dairy Society';

  const [modalOpen,   setModalOpen]   = useState(true);
  const [centers,     setCenters]     = useState([{ value: 'all', label: 'All Centers' }]);
  const [banks,       setBanks]       = useState([{ value: 'all', label: 'All Banks' }]);

  // filters
  const [fromDate,              setFromDate]              = useState(null);
  const [toDate,                setToDate]                = useState(null);
  const [center,                setCenter]                = useState('all');
  const [displayType,           setDisplayType]           = useState('detail');
  const [orderByProdNo,         setOrderByProdNo]         = useState(true);
  const [bankTransferStatement, setBankTransferStatement] = useState(false);
  const [selectedBank,          setSelectedBank]          = useState('all');
  const [malayalam,             setMalayalam]             = useState(false);

  // report data
  const [groups,        setGroups]        = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [generated,     setGenerated]     = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({});

  useEffect(() => {
    bankTransferAPI.getCollectionCenters().then(res => {
      const list = (res?.data || []).map(c => ({ value: String(c._id), label: c.name || c.centerName || 'Center' }));
      setCenters([{ value: 'all', label: 'All Centers' }, ...list]);
    }).catch(() => {});
    bankTransferAPI.getBanks().then(res => {
      const list = (res?.data || []).filter(b => b.name).map(b => ({ value: b.name, label: `${b.name} (${b.count || 0})` }));
      setBanks([{ value: 'all', label: 'All Banks' }, ...list]);
    }).catch(() => {});
  }, []);

  const handleViewReport = async () => {
    if (!fromDate || !toDate) { notifications.show({ color: 'orange', message: 'Please select Date From and To' }); return; }
    if (new Date(fromDate) > new Date(toDate)) { notifications.show({ color: 'orange', message: '"Date From" must be before "To"' }); return; }

    setGenerating(true);
    setModalOpen(false);
    const fd = localDateStr(fromDate);
    const td = localDateStr(toDate);

    try {
      const res = await bankTransferAPI.getPaymentReport({
        fromDate: fd, toDate: td,
        centerId:   center,
        bankFilter: bankTransferStatement ? selectedBank : 'all',
        reportType: bankTransferStatement ? 'bankOnly' : 'all',
      });

      let grps = res?.data?.groups || [];
      if (orderByProdNo) {
        grps = grps.map(g => ({
          ...g,
          bankRows: [...g.bankRows].sort((a, b) => (a.producerId || '').localeCompare(b.producerId || '')),
          cashRows: [...g.cashRows].sort((a, b) => (a.producerId || '').localeCompare(b.producerId || '')),
        }));
      }

      setGroups(grps);
      setSummary(res?.data?.summary || null);
      setGenerated(true);
      setAppliedFilters({ fromDate: fd, toDate: td, center, displayType, bankTransferStatement, selectedBank, malayalam });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to generate report' });
      setModalOpen(true);
    } finally {
      setGenerating(false);
    }
  };

  const handleCancel  = () => { setGroups([]); setSummary(null); setGenerated(false); setModalOpen(false); };
  const reopenFilters = () => setModalOpen(true);

  const isML       = appliedFilters.malayalam;
  const isBankMode = appliedFilters.bankTransferStatement;
  const viewType   = appliedFilters.displayType || displayType;
  const selBank    = appliedFilters.selectedBank || 'all';
  const allBanks   = selBank === 'all';

  // ── Print ───────────────────────────────────────────────────────────────────
  const printDetail   = () => printHtml(buildDetailHtml(groups, societyName, appliedFilters.fromDate, appliedFilters.toDate, isBankMode, isML));
  const printSummary  = () => printHtml(buildSummaryHtml(groups, societyName, appliedFilters.fromDate, appliedFilters.toDate, isML));
  const printBankList = () => printHtml(buildBankListHtml(groups, societyName, appliedFilters.fromDate, appliedFilters.toDate, isML, selBank));
  const printCashList = () => printHtml(buildCashListHtml(groups, societyName, appliedFilters.fromDate, appliedFilters.toDate, isML));

  // ── Export (xlsx) ───────────────────────────────────────────────────────────
  const doExport = () => {
    const title    = isBankMode ? 'Bank Transfer Statement' : 'Payment Report';
    const fileName = `${title.replace(/\s+/g, '_')}_${appliedFilters.fromDate}_${appliedFilters.toDate}.xlsx`;

    const HDRS = ['SN', 'Prod No', 'Producer Name', 'Center', 'Account No', 'IFSC', 'Bank / Branch', 'Amount (₹)'];
    const aoa  = [];

    aoa.push([societyName]);
    aoa.push([title]);
    aoa.push(['From', fmtDate(appliedFilters.fromDate), 'To', fmtDate(appliedFilters.toDate)]);
    aoa.push([]);

    if (isBankMode && allBanks) {
      // Bank-wise grouped export
      const bankGroups = getBankGrouped(groups);
      const grandTotal = bankGroups.reduce((s, bg) => s + bg.total, 0);
      let sn = 0;

      for (const bg of bankGroups) {
        aoa.push([`Bank: ${bg.bankName} (${bg.rows.length} producers)`]);
        aoa.push(HDRS);
        bg.rows.forEach(r => {
          sn++;
          aoa.push([sn, r.producerId, r.producerName, r.center, r.accountNumber, r.ifscCode, r.branch || r.bankName || '', parseFloat(fmt(r.amount))]);
        });
        aoa.push(['', '', '', '', '', '', `Sub-total (${bg.bankName}):`, parseFloat(fmt(bg.total))]);
        aoa.push([]);
      }

      aoa.push(['', '', '', '', '', '', 'GRAND TOTAL:', parseFloat(fmt(grandTotal))]);
    } else {
      // Date-wise export
      let sn = 0;
      aoa.push(HDRS);
      for (const g of groups) {
        const rows = isBankMode ? g.bankRows : [...g.bankRows, ...g.cashRows];
        if (!rows.length) continue;
        aoa.push([`Date of Payment: ${fmtDate(g.date)}`]);
        rows.forEach(r => {
          sn++;
          aoa.push([sn, r.producerId, r.producerName, r.center, r.accountNumber || '', r.ifscCode || '', r.bankName || '', parseFloat(fmt(r.amount))]);
        });
        aoa.push(['', '', '', '', '', '', 'Date Total:', parseFloat(fmt(g.grandTotal))]);
        aoa.push([]);
      }
      const grand = groups.reduce((s, g) => s + g.grandTotal, 0);
      aoa.push(['', '', '', '', '', '', 'GRAND TOTAL:', parseFloat(fmt(grand))]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 28));
    XLSX.writeFile(wb, fileName);
    return fileName;
  };

  // ── Share via Mail ──────────────────────────────────────────────────────────
  const doShareEmail = () => {
    const title    = isBankMode ? 'Bank Transfer Statement' : 'Payment Report';
    const period   = `${fmtDate(appliedFilters.fromDate)} — ${fmtDate(appliedFilters.toDate)}`;
    const grand    = groups.reduce((s, g) => s + g.grandTotal, 0);
    const fileName = doExport();

    const subject = `${societyName} — ${title} (${period})`;
    const body = [
      societyName, title, '',
      `From : ${fmtDate(appliedFilters.fromDate)}`,
      `To   : ${fmtDate(appliedFilters.toDate)}`,
      `Total: ₹${fmtI(grand)}`,
      '',
      `Please find attached: ${fileName}`,
      '(File has been downloaded — please attach it to this email.)',
    ].join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    notifications.show({ title: 'File downloaded', message: `${fileName} — attach it to the email that just opened.`, color: 'teal', autoClose: 7000 });
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalBank  = summary?.totalBank  || 0;
  const totalCash  = summary?.totalCash  || 0;
  const grandTotal = summary?.grandTotal || 0;
  const bankCount  = summary?.bankCount  || 0;
  const cashCount  = summary?.cashCount  || 0;

  return (
    <Box style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef4fb' }}>

      {/* ── FILTER MODAL ─────────────────────────────────────────────────────── */}
      <Modal
        opened={modalOpen}
        onClose={() => generated ? setModalOpen(false) : navigate(-1)}
        title={
          <Group gap={10} align="center">
            <Box style={{ background: '#dbeafe', borderRadius: 8, padding: '6px 8px', display: 'flex' }}>
              <IconReportMoney size={18} color="#2563eb" />
            </Box>
            <Box>
              <Text fw={800} size="15px" c="#1e3a8a">Payment Report</Text>
              <Text size="10px" c="#64748b">Configure report parameters</Text>
            </Box>
          </Group>
        }
        size="md" centered radius="lg"
        styles={{
          header: { background: '#f0f9ff', borderBottom: '1px solid #bfdbfe', padding: '14px 20px' },
          body:   { padding: '20px' },
        }}
      >
        <Stack gap={16}>
          {/* Date From / To */}
          <Grid gutter="sm">
            <Grid.Col span={6}>
              <Text size="11px" fw={700} c="#374151" mb={4}>Date From</Text>
              <DatePickerInput placeholder="dd/mm/yyyy" value={fromDate} onChange={setFromDate}
                valueFormat="DD/MM/YYYY" clearable size="sm" radius="md"
                styles={{ input: { border: '1.5px solid #cbd5e1' } }} />
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="11px" fw={700} c="#374151" mb={4}>To</Text>
              <DatePickerInput placeholder="dd/mm/yyyy" value={toDate} onChange={setToDate}
                valueFormat="DD/MM/YYYY" clearable size="sm" radius="md"
                styles={{ input: { border: '1.5px solid #cbd5e1' } }} />
            </Grid.Col>
          </Grid>

          {/* Center */}
          <Box>
            <Text size="11px" fw={700} c="#374151" mb={4}>Center</Text>
            <Select data={centers} value={center} onChange={v => setCenter(v || 'all')}
              size="sm" radius="md" searchable styles={{ input: { border: '1.5px solid #cbd5e1' } }} />
          </Box>

          <Divider labelPosition="left" label={<Text size="11px" fw={600} c="#6b7280">Options</Text>} />

          {/* Display Type */}
          <Box>
            <Text size="11px" fw={700} c="#374151" mb={8}>Display Type</Text>
            <Radio.Group value={displayType} onChange={setDisplayType}>
              <Group gap={20}>
                <Radio value="detail"  label={<Text size="12px">Detail</Text>}  size="sm" />
                <Radio value="summary" label={<Text size="12px">Summary</Text>} size="sm" />
              </Group>
            </Radio.Group>
          </Box>

          {/* Order By */}
          <Box>
            <Text size="11px" fw={700} c="#374151" mb={8}>Order By</Text>
            <Checkbox checked={orderByProdNo} onChange={e => setOrderByProdNo(e.currentTarget.checked)}
              label={<Text size="12px">Producer No</Text>} size="sm" />
          </Box>

          {/* Report Type — Bank Transfer Statement */}
          <Box>
            <Text size="11px" fw={700} c="#374151" mb={8}>Report Type</Text>
            <Group gap={12} align="flex-end" wrap="nowrap">
              <Checkbox checked={bankTransferStatement} onChange={e => setBankTransferStatement(e.currentTarget.checked)}
                label={<Text size="12px">Bank Transfer Statement</Text>} size="sm" />
              {bankTransferStatement && (
                <Select data={banks} value={selectedBank} onChange={v => setSelectedBank(v || 'all')}
                  size="xs" radius="md" searchable style={{ minWidth: 160 }}
                  styles={{ input: { border: '1.5px solid #cbd5e1' } }} />
              )}
            </Group>
          </Box>

          {/* Language */}
          <Box>
            <Text size="11px" fw={700} c="#374151" mb={8}>Language</Text>
            <Checkbox checked={malayalam} onChange={e => setMalayalam(e.currentTarget.checked)}
              label={<Text size="12px">Malayalam (മലയാളം)</Text>} size="sm" />
          </Box>

          <Divider />

          <Group justify="center" gap={12}>
            <Button onClick={handleViewReport} loading={generating} leftSection={<IconSearch size={15} />}
              size="sm" radius="md" style={{ background: '#2563eb', fontWeight: 700, minWidth: 130 }}>
              View Report
            </Button>
            <Button onClick={handleCancel} variant="default" size="sm" radius="md" leftSection={<IconX size={15} />} style={{ fontWeight: 700 }}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <Box style={{ background: 'white', borderBottom: '1px solid #dbeafe', padding: '8px 20px', flexShrink: 0, boxShadow: '0 1px 6px rgba(37,99,235,0.08)' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap={12} align="center" wrap="nowrap">
            <Box style={{ background: '#dbeafe', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center' }}>
              <IconReportMoney size={22} color="#2563eb" />
            </Box>
            <Box>
              <Text size="16px" fw={800} c="#1e3a8a" style={{ lineHeight: 1.1 }}>Payment Report</Text>
              <Text size="10px" c="#64748b">
                {generated
                  ? `${fmtDate(appliedFilters.fromDate)} — ${fmtDate(appliedFilters.toDate)}${isBankMode ? ` · Bank Statement${allBanks ? ' (All Banks)' : ` — ${selBank}`}` : ''}`
                  : 'Configure filters and click View Report'}
              </Text>
            </Box>
          </Group>

          <Group gap={6} wrap="nowrap">
            <Button leftSection={<IconFilter size={14} />} onClick={reopenFilters} size="sm" radius="md" variant="light" color="blue">
              Filters
            </Button>

            {generated && (
              <>
                <Button leftSection={<IconPrinter size={14} />} onClick={printDetail}
                  size="sm" radius="md" style={{ background: '#1d4ed8', fontWeight: 700 }}>
                  {isML ? 'വിശദ' : 'Print Detail'}
                </Button>
                <Button leftSection={<IconPrinter size={14} />} onClick={printSummary}
                  size="sm" radius="md" style={{ background: '#0369a1', fontWeight: 700 }}>
                  {isML ? 'സംഗ്രഹം' : 'Print Summary'}
                </Button>

                {isBankMode && (
                  <>
                    <Button leftSection={<IconBuildingBank size={14} />} onClick={printBankList}
                      size="sm" radius="md" style={{ background: '#6d28d9', fontWeight: 700 }}>
                      {isML ? 'ബാങ്ക് ലിസ്റ്റ്' : allBanks ? 'Print Bank List (All)' : 'Print Bank List'}
                    </Button>
                    <Button leftSection={<IconCash size={14} />} onClick={printCashList}
                      size="sm" radius="md" style={{ background: '#b45309', fontWeight: 700 }}>
                      {isML ? 'ക്യാഷ് ലിസ്റ്റ്' : 'Print Cash List'}
                    </Button>
                  </>
                )}

                <Button leftSection={<IconFileExport size={14} />} onClick={doExport}
                  size="sm" radius="md" color="teal" variant="filled" style={{ fontWeight: 700 }}>
                  Export
                </Button>
                <Button leftSection={<IconMail size={14} />} onClick={doShareEmail}
                  size="sm" radius="md" color="grape" variant="filled" style={{ fontWeight: 700 }}>
                  Share Mail
                </Button>
              </>
            )}

            <Button leftSection={<IconArrowLeft size={14} />} onClick={() => navigate(-1)}
              size="sm" radius="md" variant="default" style={{ fontWeight: 700 }}>
              Close
            </Button>
          </Group>
        </Group>
      </Box>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <Box style={{ flex: 1, overflow: 'hidden', padding: '12px 20px', display: 'flex', flexDirection: 'column' }}>

        {generating && (
          <Center style={{ flex: 1 }}>
            <Stack align="center"><Loader size="md" color="blue" /><Text c="dimmed" size="sm">Generating report…</Text></Stack>
          </Center>
        )}

        {!generating && !generated && (
          <Center style={{ flex: 1 }}>
            <Stack align="center" gap={8}>
              <IconReportMoney size={56} color="#bfdbfe" />
              <Text c="dimmed" fw={600}>Configure filters and click "View Report"</Text>
              <Text c="dimmed" size="xs">Select date range, center, and display options</Text>
              <Button leftSection={<IconFilter size={15} />} onClick={reopenFilters} variant="light" color="blue" size="sm" radius="md" mt={4}>
                Open Filters
              </Button>
            </Stack>
          </Center>
        )}

        {!generating && generated && (
          <>
            {/* Summary stats bar */}
            <Box style={{ background: '#1e3a8a', borderRadius: '10px 10px 0 0', padding: '8px 16px' }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8}>
                  <Text fw={700} size="13px" c="white">{isML ? 'പേമെന്‍റ് റിപ്പോർട്ട്' : 'Payment Report'}</Text>
                  {isBankMode && (
                    <Badge color="blue" variant="filled" size="sm">
                      Bank Statement{allBanks ? ' — All Banks' : ` — ${selBank}`}
                    </Badge>
                  )}
                  <Badge color="teal" variant="light" size="sm">{viewType === 'detail' ? 'Detail' : 'Summary'}</Badge>
                </Group>
                <Group gap={20}>
                  {[
                    { label: isML ? 'ദിവസങ്ങൾ' : 'Dates',        val: summary?.dateCount || groups.length, c: '#7dd3fc' },
                    { label: isML ? 'ബാങ്ക് (എണ്ണം)' : 'Bank Count', val: bankCount,                        c: '#93c5fd' },
                    { label: isML ? 'ബാങ്ക് (₹)' : 'Bank Amt',    val: `₹${fmtI(totalBank)}`,              c: '#86efac' },
                    { label: isML ? 'ക്യാഷ് (₹)' : 'Cash Amt',    val: `₹${fmtI(totalCash)}`,              c: '#fde68a' },
                    { label: isML ? 'ആകെ (₹)' : 'Grand Total',   val: `₹${fmtI(grandTotal)}`,             c: '#a7f3d0' },
                  ].map(({ label, val, c }) => (
                    <Box key={label} style={{ textAlign: 'center' }}>
                      <Text size="9px" c="rgba(255,255,255,0.6)" tt="uppercase">{label}</Text>
                      <Text size="13px" fw={800} c={c}>{val}</Text>
                    </Box>
                  ))}
                </Group>
              </Group>
            </Box>

            <Box style={{ flex: 1, overflow: 'hidden', background: 'white', borderRadius: '0 0 10px 10px', border: '1px solid #bfdbfe', borderTop: 'none' }}>
              <ScrollArea h="100%" type="auto">

                {/* ── SUMMARY VIEW ─────────────────────────────────────────── */}
                {viewType === 'summary' && (
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
                    <thead>
                      <tr>
                        <TH>SN</TH>
                        <TH>{isML ? 'തീയതി' : 'Date'}</TH>
                        <TH right>{isML ? 'ബാങ്ക് (എണ്ണം)' : 'Bank Count'}</TH>
                        <TH right>{isML ? 'ബാങ്ക് (₹)' : 'Bank Amount (₹)'}</TH>
                        <TH right>{isML ? 'ക്യാഷ് (എണ്ണം)' : 'Cash Count'}</TH>
                        <TH right>{isML ? 'ക്യാഷ് (₹)' : 'Cash Amount (₹)'}</TH>
                        <TH right>{isML ? 'ആകെ (₹)' : 'Total (₹)'}</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 12 }}>No payment data found for this date range</td></tr>
                      ) : groups.map((g, i) => (
                        <tr key={g.date} style={{ background: i % 2 === 0 ? '#fff' : '#f8faff' }}>
                          <TD>{i + 1}</TD>
                          <TD bold c="#1e3a8a">{fmtDate(g.date)}</TD>
                          <TD right>{g.bankRows.length}</TD>
                          <TD right bold={g.totalBank > 0} c={g.totalBank > 0 ? '#1d4ed8' : '#94a3b8'}>
                            {g.totalBank > 0 ? fmt(g.totalBank) : '—'}
                          </TD>
                          <TD right>{g.cashRows.length}</TD>
                          <TD right bold={g.totalCash > 0} c={g.totalCash > 0 ? '#b45309' : '#94a3b8'}>
                            {g.totalCash > 0 ? fmt(g.totalCash) : '—'}
                          </TD>
                          <TD right bold c="#166534">{fmt(g.grandTotal)}</TD>
                        </tr>
                      ))}
                    </tbody>
                    {groups.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#dbeafe' }}>
                          <td colSpan={2} style={{ padding: '6px 8px', fontWeight: 700, color: '#1e3a8a', border: '1px solid #93c5fd', textAlign: 'right', fontSize: 11 }}>
                            {isML ? 'ആകെ' : 'TOTAL'} ({groups.length} {isML ? 'ദിവസം' : 'dates'})
                          </td>
                          <TD right bold c="#1e3a8a">{bankCount}</TD>
                          <TD right bold c="#1d4ed8">{fmt(totalBank)}</TD>
                          <TD right bold c="#1e3a8a">{cashCount}</TD>
                          <TD right bold c="#b45309">{fmt(totalCash)}</TD>
                          <TD right bold c="#166534">{fmt(grandTotal)}</TD>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}

                {/* ── DETAIL VIEW ──────────────────────────────────────────── */}
                {viewType === 'detail' && (() => {
                  // When allBanks + bankMode: show bank-wise grouping in the on-screen detail view too
                  if (isBankMode && allBanks) {
                    const bankGroups = getBankGrouped(groups);
                    const grandBank  = bankGroups.reduce((s, bg) => s + bg.total, 0);
                    return (
                      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                        <thead>
                          <tr>
                            <TH>SN</TH>
                            <TH>{isML ? 'ഉൽ. നം.' : 'Prod No'}</TH>
                            <TH>{isML ? 'ഉൽ. പേര്' : 'Producer Name'}</TH>
                            <TH>{isML ? 'കേന്ദ്രം' : 'Center'}</TH>
                            <TH>{isML ? 'A/C നം.' : 'Account No'}</TH>
                            <TH>IFSC</TH>
                            <TH>{isML ? 'ശാഖ' : 'Branch'}</TH>
                            <TH right>{isML ? 'തുക (₹)' : 'Amount (₹)'}</TH>
                          </tr>
                        </thead>
                        <tbody>
                          {bankGroups.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>No bank transfer data</td></tr>
                          ) : bankGroups.map((bg, bi) => (
                            <>
                              {/* Bank sub-heading */}
                              <tr key={`bank-${bi}`}>
                                <td colSpan={8} style={{
                                  background: '#1a365d', color: '#fff', fontWeight: 700, fontSize: 12,
                                  padding: '7px 12px', border: '1px solid #2d4a7a',
                                }}>
                                  {isML ? 'ബാങ്ക്' : 'Bank'}: {bg.bankName}
                                  <span style={{ marginLeft: 12, fontSize: 10, fontWeight: 500, opacity: 0.8 }}>
                                    ({bg.rows.length} {isML ? 'ഉൽ.' : 'producers'})
                                  </span>
                                </td>
                              </tr>

                              {/* Rows */}
                              {bg.rows.map((r, i) => (
                                <tr key={`${bi}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#f8faff' }}>
                                  <TD>{i + 1}</TD>
                                  <TD>{r.producerId || '—'}</TD>
                                  <TD>{r.producerName || '—'}</TD>
                                  <TD>{r.center || '—'}</TD>
                                  <TD c="#475569">{r.accountNumber || '—'}</TD>
                                  <TD c="#475569">{r.ifscCode || '—'}</TD>
                                  <TD c="#475569">{r.branch || '—'}</TD>
                                  <TD right bold c="#1d4ed8">{fmt(r.amount)}</TD>
                                </tr>
                              ))}

                              {/* Bank sub-total */}
                              <tr key={`sub-${bi}`} style={{ background: '#dbeafe' }}>
                                <td colSpan={7} style={{ padding: '5px 8px', fontWeight: 700, color: '#1e3a8a', border: '1px solid #93c5fd', textAlign: 'right', fontSize: 11 }}>
                                  {isML ? 'ബാങ്ക് ആകെ' : 'Bank Sub-total'} — {bg.bankName}
                                </td>
                                <TD right bold c="#1e3a8a">{fmt(bg.total)}</TD>
                              </tr>
                              <tr key={`gap-${bi}`}><td colSpan={8} style={{ border: 'none', padding: 4 }} /></tr>
                            </>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#1e3a8a' }}>
                            <td colSpan={7} style={{ padding: '7px 8px', fontWeight: 700, color: '#93c5fd', border: '1px solid #2d4a7a', textAlign: 'right', fontSize: 11 }}>
                              {isML ? 'ആകെ' : 'GRAND TOTAL'} ({bankGroups.reduce((s, bg) => s + bg.rows.length, 0)} {isML ? 'ഉൽ.' : 'producers'})
                            </td>
                            <td style={{ padding: '7px 8px', fontWeight: 900, color: '#86efac', border: '1px solid #2d4a7a', textAlign: 'right', fontSize: 14 }}>
                              {fmt(grandBank)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    );
                  }

                  // Default date-grouped detail view
                  return (
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: isBankMode ? 1000 : 700 }}>
                      <thead>
                        <tr>
                          <TH>SN</TH>
                          <TH>{isML ? 'ഉൽ. നം.' : 'Prod No'}</TH>
                          <TH>{isML ? 'ഉൽ. പേര്' : 'Producer Name'}</TH>
                          <TH>{isML ? 'കേന്ദ്രം' : 'Center'}</TH>
                          {isBankMode && <><TH>{isML ? 'ബാങ്ക്' : 'Bank'}</TH><TH>{isML ? 'A/C' : 'Account No'}</TH></>}
                          <TH right>{isML ? 'തുക (₹)' : 'Amount (₹)'}</TH>
                          <TH>{isML ? 'രീതി' : 'Mode'}</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.length === 0 ? (
                          <tr><td colSpan={isBankMode ? 8 : 6} style={{ textAlign: 'center', padding: 24, color: '#64748b', fontSize: 12 }}>No payment data found for this date range</td></tr>
                        ) : groups.map(g => {
                          const allRows = [...g.bankRows.map(r => ({ ...r, _t: 'bank' })), ...g.cashRows.map(r => ({ ...r, _t: 'cash' }))];
                          if (!allRows.length) return null;
                          return (
                            <>
                              <tr key={`hd-${g.date}`}>
                                <td colSpan={isBankMode ? 8 : 6} style={{
                                  background: '#dbeafe', borderLeft: '4px solid #2563eb',
                                  padding: '6px 12px', fontWeight: 700, fontSize: 12, color: '#1e3a8a', border: '1px solid #bfdbfe',
                                }}>
                                  {isML ? 'പേമെന്‍റ് തീയതി' : 'Date of Payment'}: {fmtDate(g.date)}
                                </td>
                              </tr>
                              {allRows.map((r, i) => (
                                <tr key={`${g.date}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#f8faff' }}>
                                  <TD>{i + 1}</TD>
                                  <TD>{r.producerId || '—'}</TD>
                                  <TD>{r.producerName || '—'}</TD>
                                  <TD>{r.center || '—'}</TD>
                                  {isBankMode && (<><TD c={r._t === 'bank' ? '#1d4ed8' : '#64748b'}>{r.bankName || '—'}</TD><TD c="#475569">{r.accountNumber || '—'}</TD></>)}
                                  <TD right bold c={r._t === 'bank' ? '#1d4ed8' : '#b45309'}>{fmt(r.amount)}</TD>
                                  <TD><Badge size="xs" color={r._t === 'bank' ? 'blue' : 'orange'} variant="light">{r.paymentMode || (r._t === 'bank' ? 'Bank' : 'Cash')}</Badge></TD>
                                </tr>
                              ))}
                              <tr key={`tot-${g.date}`} style={{ background: '#f0fdf4' }}>
                                <td colSpan={isBankMode ? 6 : 4} style={{ padding: '5px 8px', fontWeight: 700, color: '#14532d', border: '1px solid #86efac', textAlign: 'right', fontSize: 11 }}>
                                  {isML ? 'ദിവസ ആകെ' : 'Date Total'} — Bank: ₹{fmt(g.totalBank)} | Cash: ₹{fmt(g.totalCash)}
                                </td>
                                <TD right bold c="#166534">{fmt(g.grandTotal)}</TD>
                                <TD />
                              </tr>
                            </>
                          );
                        })}
                      </tbody>
                      {groups.length > 0 && (
                        <tfoot>
                          <tr style={{ background: '#dbeafe' }}>
                            <td colSpan={isBankMode ? 6 : 4} style={{ padding: '6px 8px', fontWeight: 700, color: '#1e3a8a', border: '1px solid #93c5fd', textAlign: 'right', fontSize: 11 }}>
                              {isML ? 'ആകെ' : 'GRAND TOTAL'} — Bank: ₹{fmt(totalBank)} | Cash: ₹{fmt(totalCash)}
                            </td>
                            <TD right bold c="#1e3a8a">{fmt(grandTotal)}</TD>
                            <TD />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  );
                })()}

              </ScrollArea>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
