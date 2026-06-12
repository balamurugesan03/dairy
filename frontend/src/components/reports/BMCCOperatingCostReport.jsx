import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Paper, Title, Text, Button, Group, Stack, Grid, Table,
  NumberInput, TextInput, Textarea, Select, Badge, Divider,
  ThemeIcon, LoadingOverlay, ActionIcon, Menu, Tooltip,
  SimpleGrid, Card, rem
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy, IconPrinter, IconFileTypePdf, IconFileTypeXls,
  IconRefresh, IconShare, IconBrandWhatsapp, IconMail,
  IconBuildingFactory2, IconDroplet, IconFlame, IconScale,
  IconChartBar, IconCurrencyRupee, IconAlertCircle
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { bmccAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

const YEAR_OPTIONS = (() => {
  const cy = dayjs().year();
  return [cy - 2, cy - 1, cy, cy + 1].map(y => ({ value: String(y), label: String(y) }));
})();

const EXPENSE_FIELDS = [
  { key: 'buildingRent',           label: 'Building Rent' },
  { key: 'officeExpenses',         label: 'Office Expenses' },
  { key: 'electricityCharges',     label: 'Electricity Charges' },
  { key: 'telephoneCharges',       label: 'Telephone Charges' },
  { key: 'generatorFuelExpense',   label: 'Generator Fuel Expense' },
  { key: 'generatorOperatorWages', label: 'Generator Operator Wages' },
  { key: 'dieselExpense',          label: 'Diesel Expense' },
  { key: 'vehicleExpense',         label: 'Vehicle Expense' },
  { key: 'labourCharge',           label: 'Labour Charge' },
  { key: 'stationery',             label: 'Stationery' },
  { key: 'computerMaintenance',    label: 'Computer Maintenance' },
  { key: 'waterCharges',           label: 'Water Charges' },
  { key: 'internetCharges',        label: 'Internet Charges' },
  { key: 'auditExpense',           label: 'Audit Expense' },
  { key: 'otherExpense',           label: 'Other Expense' },
];

const EQUIP_FIELDS = [
  { key: 'motorRepair',          label: 'Motor Repair' },
  { key: 'pumpMaintenance',      label: 'Pump Maintenance' },
  { key: 'generatorMaintenance', label: 'Generator Maintenance' },
  { key: 'serviceCharges',       label: 'Service Charges' },
];

const BLANK_EXPENSES = Object.fromEntries(EXPENSE_FIELDS.map(f => [f.key, 0]));
const BLANK_EQUIP    = Object.fromEntries(EQUIP_FIELDS.map(f => [f.key, 0]));

const fmt = (n) => (parseFloat(n) || 0).toFixed(2);
const fmtRs = (n) => `₹ ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ── Section header row component ─────────────────────────────────────────────
const SectionHead = ({ title, color = '#1a3c6e' }) => (
  <tr>
    <td colSpan={10} style={{
      background: color, color: 'white', fontWeight: 700,
      fontSize: 11, padding: '5px 10px', textAlign: 'center',
      letterSpacing: '0.5px'
    }}>
      {title}
    </td>
  </tr>
);

// ── Main Component ────────────────────────────────────────────────────────────
const BMCCOperatingCostReport = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef(null);

  const now = dayjs();
  const [month, setMonth]   = useState(String(now.month() + 1));
  const [year,  setYear]    = useState(String(now.year()));
  const [reportId, setReportId] = useState(null);

  const [expenses, setExpenses]   = useState(BLANK_EXPENSES);
  const [milkData, setMilkData]   = useState({
    totalMilkProcured: 0, avgDailyProcurement: 0,
    procurementDays: 0, totalProducerCount: 0,
    avgFAT: 0, avgSNF: 0,
  });
  const [dgMeter, setDgMeter] = useState({ openingReading: 0, closingReading: 0 });
  const [diesel,  setDiesel]  = useState({ openingStock: 0, purchasedQty: 0, consumedQty: 0 });
  const [equipment, setEquipment] = useState(BLANK_EQUIP);
  const [remarks,  setRemarks]    = useState('');
  const [approvals, setApprovals] = useState({
    supervisorName: '', recommendedAmount: 0,
    ampo: '', mpo: '', amPI: '',
  });

  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [syncing,  setSyncing]  = useState(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalExpenses = useMemo(
    () => EXPENSE_FIELDS.reduce((s, f) => s + (parseFloat(expenses[f.key]) || 0), 0),
    [expenses]
  );
  const totalEquipment = useMemo(
    () => EQUIP_FIELDS.reduce((s, f) => s + (parseFloat(equipment[f.key]) || 0), 0),
    [equipment]
  );
  const totalOperatingCost  = totalExpenses + totalEquipment;
  const dgTotalHours        = Math.max(0, (parseFloat(dgMeter.closingReading) || 0) - (parseFloat(dgMeter.openingReading) || 0));
  const dieselClosingStock  = (parseFloat(diesel.openingStock) || 0) + (parseFloat(diesel.purchasedQty) || 0) - (parseFloat(diesel.consumedQty) || 0);
  const costPerLitre        = milkData.totalMilkProcured > 0
    ? (totalOperatingCost / milkData.totalMilkProcured).toFixed(4) : '0.0000';

  const companyName = selectedCompany?.companyName || selectedCompany?.name || 'Dairy Cooperative Society';
  const periodLabel = `${MONTHS[parseInt(month) - 1].toUpperCase()} ${year}`;

  // ── Load saved report ─────────────────────────────────────────────────────
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bmccAPI.getReport({ month, year });
      if (res?.data) {
        const d = res.data;
        setReportId(d._id);
        setExpenses({ ...BLANK_EXPENSES, ...(d.expenses || {}) });
        setDgMeter({ openingReading: 0, closingReading: 0, ...(d.dgHourMeter || {}) });
        setDiesel({ openingStock: 0, purchasedQty: 0, consumedQty: 0, ...(d.dieselConsumption || {}) });
        setEquipment({ ...BLANK_EQUIP, ...(d.equipmentExpenses || {}) });
        setRemarks(d.remarks || '');
        setApprovals({ supervisorName: '', recommendedAmount: 0, ampo: '', mpo: '', amPI: '', ...(d.approvals || {}) });
        if (d.milkProcurement) setMilkData(d.milkProcurement);
      } else {
        setReportId(null);
        setExpenses(BLANK_EXPENSES);
        setDgMeter({ openingReading: 0, closingReading: 0 });
        setDiesel({ openingStock: 0, purchasedQty: 0, consumedQty: 0 });
        setEquipment(BLANK_EQUIP);
        setRemarks('');
        setApprovals({ supervisorName: '', recommendedAmount: 0, ampo: '', mpo: '', amPI: '' });
      }
    } catch { /* no saved data */ setReportId(null); }
    finally { setLoading(false); }
  }, [month, year]);

  // ── Sync milk data from collections ─────────────────────────────────────
  const syncMilkData = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await bmccAPI.getMonthlySummary({ month, year });
      if (res?.data) {
        setMilkData(res.data);
        notifications.show({ color: 'teal', message: 'Milk data synced from collections' });
      }
    } catch {
      notifications.show({ color: 'red', message: 'Failed to sync milk data' });
    } finally { setSyncing(false); }
  }, [month, year]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveReport = async () => {
    setSaving(true);
    const payload = {
      month: parseInt(month), year: parseInt(year),
      expenses, milkProcurement: milkData,
      dgHourMeter: dgMeter, dieselConsumption: diesel,
      equipmentExpenses: equipment, remarks, approvals,
    };
    try {
      let res;
      if (reportId) {
        res = await bmccAPI.updateReport(reportId, payload);
      } else {
        res = await bmccAPI.saveReport(payload);
        if (res?.data?._id) setReportId(res.data._id);
      }
      notifications.show({ color: 'green', message: 'CC Operating Cost report saved' });
    } catch {
      notifications.show({ color: 'red', message: 'Failed to save report' });
    } finally { setSaving(false); }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const milkRows = [
      ['Total Milk Procured',    `${milkData.totalMilkProcured} L`],
      ['Avg Daily Procurement',  `${milkData.avgDailyProcurement} L`],
      ['Procurement Days',       `${milkData.procurementDays} Days`],
      ['Total Producer Count',   milkData.totalProducerCount],
      ['Average FAT',            `${milkData.avgFAT}%`],
      ['Average SNF',            `${milkData.avgSNF}%`],
    ];

    const expRows = EXPENSE_FIELDS.map((f, i) =>
      `<tr>
        <td style="text-align:center;width:30px">${i + 1}</td>
        <td>${f.label}</td>
        <td style="text-align:right">${fmtRs(expenses[f.key])}</td>
      </tr>`
    ).join('');

    const milkHtml = milkRows.map(([lbl, val]) =>
      `<tr><td>${lbl}</td><td style="text-align:right;font-weight:600">${val}</td></tr>`
    ).join('');

    const equipRows = EQUIP_FIELDS.map(f =>
      `<tr><td>${f.label}</td><td style="text-align:right">${fmtRs(equipment[f.key])}</td></tr>`
    ).join('');

    const approvalBlock = `
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <tr>
          <td style="width:33%;padding:6px">
            <div style="border-bottom:1px solid #333;padding-bottom:2px;margin-bottom:4px">Supervisor Name</div>
            <strong>${approvals.supervisorName || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>
          </td>
          <td style="width:33%;padding:6px">
            <div style="border-bottom:1px solid #333;padding-bottom:2px;margin-bottom:4px">Verified & Recommended for Rs</div>
            <strong>${fmtRs(approvals.recommendedAmount)}</strong>
          </td>
          <td style="width:33%;padding:6px">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:6px">
            <div style="border-bottom:1px solid #333;padding-bottom:2px;margin-bottom:4px">AMPO</div>
            <strong>${approvals.ampo || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>
          </td>
          <td style="padding:6px">
            <div style="border-bottom:1px solid #333;padding-bottom:2px;margin-bottom:4px">MPO</div>
            <strong>${approvals.mpo || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>
          </td>
          <td style="padding:6px">
            <div style="border-bottom:1px solid #333;padding-bottom:2px;margin-bottom:4px">AM (P&amp;I)</div>
            <strong>${approvals.amPI || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>
          </td>
        </tr>
      </table>`;

    const html = `<!DOCTYPE html>
<html><head><title>CC Operating Cost - ${periodLabel}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0 }
  h2 { font-size: 15px; font-weight: 700; text-align: center; margin: 0 0 2px; color: #1a3c6e }
  h3 { font-size: 12px; font-weight: 600; text-align: center; margin: 0 0 2px }
  .sub { text-align: center; font-size: 10px; color: #555; margin-bottom: 6px }
  hr { border: 1px solid #1a3c6e; margin: 6px 0 }
  table { border-collapse: collapse; width: 100% }
  td, th { border: 1px solid #aaa; padding: 3px 6px }
  .hdr { background: #1a3c6e; color: white; font-weight: 700; text-align: center; font-size: 11px; padding: 4px 6px; letter-spacing: 0.3px }
  .hdr2 { background: #2f6e44; color: white; font-weight: 700; text-align: center; font-size: 11px; padding: 4px 6px }
  .hdr3 { background: #6e2f2f; color: white; font-weight: 700; text-align: center; font-size: 11px; padding: 4px 6px }
  .hdr4 { background: #4a2f6e; color: white; font-weight: 700; text-align: center; font-size: 11px; padding: 4px 6px }
  .total { background: #e8f0fe; font-weight: 700 }
  .wrap { display: flex; gap: 8px; margin-bottom: 6px }
  .col-l { flex: 0 0 52% }
  .col-r { flex: 1 }
  .cost-box { background: #f0fff4; border: 1px solid #aaa; padding: 4px 8px; margin: 2px 0; display:flex; justify-content:space-between }
  .sig-lbl { font-size: 10px; color: #555; border-bottom: 1px solid #333; margin-bottom: 3px }
  .sig-val { font-weight: 600; min-height: 16px }
</style></head>
<body>
<h2>PAYMENT OF OPERATING COST OF BMCC</h2>
<h3>FOR THE MONTH OF ${periodLabel}</h3>
<div class="sub">${companyName}</div>
<hr>

<div class="wrap">
  <div class="col-l">
    <table>
      <tr><td colspan="3" class="hdr">OPERATING EXPENSES</td></tr>
      <tr style="background:#e8f0fe;font-weight:700">
        <td style="width:30px;text-align:center">Sl.</td>
        <td>Description</td>
        <td style="width:110px;text-align:right">Amount (₹)</td>
      </tr>
      ${expRows}
      <tr class="total">
        <td colspan="2" style="text-align:right">TOTAL EXPENSE</td>
        <td style="text-align:right">${fmtRs(totalExpenses)}</td>
      </tr>
    </table>
  </div>
  <div class="col-r">
    <table>
      <tr><td colspan="2" class="hdr2">MILK PROCUREMENT SUMMARY</td></tr>
      <tr style="background:#e8f6ef;font-weight:700"><td>Field</td><td style="text-align:right">Value</td></tr>
      ${milkHtml}
    </table>

    <br>

    <div style="display:flex;gap:6px">
      <table style="flex:1">
        <tr><td colspan="2" class="hdr3">DG HOUR METER</td></tr>
        <tr><td>Opening Reading</td><td style="text-align:right">${dgMeter.openingReading} Hrs</td></tr>
        <tr><td>Closing Reading</td><td style="text-align:right">${dgMeter.closingReading} Hrs</td></tr>
        <tr class="total"><td>Total Hours</td><td style="text-align:right">${dgTotalHours} Hrs</td></tr>
      </table>
      <table style="flex:1">
        <tr><td colspan="2" class="hdr3">DIESEL CONSUMPTION</td></tr>
        <tr><td>Opening Stock</td><td style="text-align:right">${diesel.openingStock} L</td></tr>
        <tr><td>Purchased Qty</td><td style="text-align:right">${diesel.purchasedQty} L</td></tr>
        <tr><td>Consumed Qty</td><td style="text-align:right">${diesel.consumedQty} L</td></tr>
        <tr class="total"><td>Closing Stock</td><td style="text-align:right">${fmt(dieselClosingStock)} L</td></tr>
      </table>
    </div>

    <br>

    <div style="display:flex;gap:6px">
      <table style="flex:1">
        <tr><td colspan="2" class="hdr4">EQUIPMENT EXPENSES</td></tr>
        ${equipRows}
        <tr class="total"><td>Total Equipment</td><td style="text-align:right">${fmtRs(totalEquipment)}</td></tr>
      </table>
      <table style="flex:1">
        <tr><td colspan="2" class="hdr4">COST ANALYSIS</td></tr>
        <tr><td>Operating Expense</td><td style="text-align:right">${fmtRs(totalExpenses)}</td></tr>
        <tr><td>Equipment Expense</td><td style="text-align:right">${fmtRs(totalEquipment)}</td></tr>
        <tr class="total"><td>Total Operating Cost</td><td style="text-align:right">${fmtRs(totalOperatingCost)}</td></tr>
        <tr class="total" style="background:#fff3e0"><td>Cost Per Litre</td><td style="text-align:right">₹ ${costPerLitre}</td></tr>
      </table>
    </div>
  </div>
</div>

<table style="margin-bottom:6px">
  <tr><td class="hdr" style="background:#555">SPECIAL REMARKS / BMCC OFFICER COMMENTS</td></tr>
  <tr><td style="min-height:40px;height:40px">${remarks || '&nbsp;'}</td></tr>
</table>

<table>
  <tr><td class="hdr" colspan="3">APPROVAL SECTION</td></tr>
</table>
${approvalBlock}

<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const buildPDFBlob = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.width;   // 297
    let y = 8;

    // Header
    doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(26, 60, 110);
    doc.text('PAYMENT OF OPERATING COST OF BMCC', pw / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(11);
    doc.text(`FOR THE MONTH OF ${periodLabel}`, pw / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(80);
    doc.text(companyName, pw / 2, y, { align: 'center' }); y += 4;
    doc.setLineWidth(0.4); doc.setDrawColor(26, 60, 110);
    doc.line(10, y, 287, y); y += 3;

    const expBody = [
      ...EXPENSE_FIELDS.map((f, i) => [i + 1, f.label, fmtRs(expenses[f.key])]),
      [{ content: '', styles: {} }, { content: 'TOTAL EXPENSE', styles: { fontStyle: 'bold', halign: 'right' } }, { content: fmtRs(totalExpenses), styles: { fontStyle: 'bold' } }]
    ];

    // Left: expense table
    autoTable(doc, {
      startY: y, margin: { left: 10 }, tableWidth: 130,
      head: [['Sl.', 'Operating Expense', 'Amount (₹)']],
      body: expBody,
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 60, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 32, halign: 'right' }
      },
      didParseCell: (d) => {
        if (d.row.index === EXPENSE_FIELDS.length)
          d.cell.styles.fillColor = [232, 240, 254];
      }
    });
    const expEndY = doc.lastAutoTable.finalY;

    // Right: milk summary
    autoTable(doc, {
      startY: y, margin: { left: 150 }, tableWidth: 137,
      head: [['Milk Procurement Summary', 'Value']],
      body: [
        ['Total Milk Procured',   `${milkData.totalMilkProcured} L`],
        ['Avg Daily Procurement', `${milkData.avgDailyProcurement} L`],
        ['Procurement Days',      `${milkData.procurementDays} Days`],
        ['Total Producer Count',  milkData.totalProducerCount],
        ['Average FAT',           `${milkData.avgFAT}%`],
        ['Average SNF',           `${milkData.avgSNF}%`],
      ],
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [47, 110, 68], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 50 } },
    });

    y = Math.max(expEndY, doc.lastAutoTable.finalY) + 5;

    // DG Meter (left half)
    autoTable(doc, {
      startY: y, margin: { left: 10 }, tableWidth: 63,
      head: [['DG Hour Meter Reading', 'Value']],
      body: [
        ['Opening Reading', `${dgMeter.openingReading} Hrs`],
        ['Closing Reading', `${dgMeter.closingReading} Hrs`],
        [{ content: 'Total Hours', styles: { fontStyle: 'bold' } }, { content: `${dgTotalHours} Hrs`, styles: { fontStyle: 'bold' } }],
      ],
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [110, 47, 47], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 30 } },
      didParseCell: (d) => { if (d.row.index === 2) d.cell.styles.fillColor = [232, 240, 254]; }
    });
    const dgEndY = doc.lastAutoTable.finalY;

    // Diesel (right of DG)
    autoTable(doc, {
      startY: y, margin: { left: 80 }, tableWidth: 63,
      head: [['Diesel Consumption', 'Litres']],
      body: [
        ['Opening Stock', `${diesel.openingStock} L`],
        ['Purchased Qty', `${diesel.purchasedQty} L`],
        ['Consumed Qty',  `${diesel.consumedQty} L`],
        [{ content: 'Closing Stock', styles: { fontStyle: 'bold' } }, { content: `${fmt(dieselClosingStock)} L`, styles: { fontStyle: 'bold' } }],
      ],
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [110, 47, 47], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 30 } },
      didParseCell: (d) => { if (d.row.index === 3) d.cell.styles.fillColor = [232, 240, 254]; }
    });
    const dieselEndY = doc.lastAutoTable.finalY;

    // Equipment (right-left)
    autoTable(doc, {
      startY: y, margin: { left: 150 }, tableWidth: 63,
      head: [['Equipment Expenses', 'Amount']],
      body: [
        ...EQUIP_FIELDS.map(f => [f.label, fmtRs(equipment[f.key])]),
        [{ content: 'Total Equipment', styles: { fontStyle: 'bold' } }, { content: fmtRs(totalEquipment), styles: { fontStyle: 'bold' } }],
      ],
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [74, 47, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 30 } },
      didParseCell: (d) => { if (d.row.index === EQUIP_FIELDS.length) d.cell.styles.fillColor = [232, 240, 254]; }
    });

    // Cost Analysis (far right)
    autoTable(doc, {
      startY: y, margin: { left: 220 }, tableWidth: 67,
      head: [['Cost Analysis', 'Value']],
      body: [
        ['Operating Expense',   fmtRs(totalExpenses)],
        ['Equipment Expense',   fmtRs(totalEquipment)],
        [{ content: 'Total Operating Cost', styles: { fontStyle: 'bold' } }, { content: fmtRs(totalOperatingCost), styles: { fontStyle: 'bold' } }],
        [{ content: 'Cost Per Litre', styles: { fontStyle: 'bold', textColor: [180, 70, 0] } }, { content: `₹ ${costPerLitre}`, styles: { fontStyle: 'bold', textColor: [180, 70, 0] } }],
      ],
      styles:     { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [74, 47, 110], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 34 } },
      didParseCell: (d) => { if (d.row.index >= 2) d.cell.styles.fillColor = [232, 240, 254]; }
    });

    y = Math.max(dgEndY, dieselEndY, doc.lastAutoTable.finalY) + 4;

    // Remarks
    autoTable(doc, {
      startY: y, margin: { left: 10 }, tableWidth: 277,
      head: [['SPECIAL REMARKS / BMCC OFFICER COMMENTS']],
      body: [[remarks || ' ']],
      styles:     { fontSize: 7.5, cellPadding: 2, minCellHeight: 12 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' },
    });
    y = doc.lastAutoTable.finalY + 4;

    // Approvals
    autoTable(doc, {
      startY: y, margin: { left: 10 }, tableWidth: 277,
      head: [['APPROVAL SECTION', '', '', '', '']],
      body: [
        ['Supervisor Name', 'Recommended Amount (Rs)', '', '', ''],
        [approvals.supervisorName || '__________________', fmtRs(approvals.recommendedAmount), '', '', ''],
        ['AMPO', 'MPO', 'AM (P&I)', '', ''],
        [approvals.ampo || '__________________', approvals.mpo || '__________________', approvals.amPI || '__________________', '', ''],
      ],
      styles:       { fontSize: 7.5, cellPadding: 2 },
      headStyles:   { fillColor: [26, 60, 110], textColor: 255, fontStyle: 'bold', colSpan: 5 },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 55 }, 2: { cellWidth: 55 } },
    });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Page ${i} of ${totalPages}  |  Generated: ${dayjs().format('DD-MM-YYYY HH:mm')}`, pw / 2, 205, { align: 'center' });
    }

    return doc;
  };

  const exportPDF = () => {
    const doc = buildPDFBlob();
    doc.save(`CC_Operating_Cost_${MONTHS[parseInt(month)-1]}_${year}.pdf`);
    notifications.show({ message: 'PDF exported', color: 'green' });
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    const rows = [];
    rows.push(['PAYMENT OF OPERATING COST OF BMCC FOR THE MONTH OF ' + periodLabel]);
    rows.push([companyName]);
    rows.push([]);
    rows.push(['OPERATING EXPENSES', '', '', 'MILK PROCUREMENT SUMMARY', '']);
    rows.push(['Sl.', 'Description', 'Amount (₹)', 'Field', 'Value']);

    const milkRows = [
      ['Total Milk Procured',   milkData.totalMilkProcured + ' L'],
      ['Avg Daily Procurement', milkData.avgDailyProcurement + ' L'],
      ['Procurement Days',      milkData.procurementDays + ' Days'],
      ['Total Producer Count',  milkData.totalProducerCount],
      ['Average FAT',           milkData.avgFAT + '%'],
      ['Average SNF',           milkData.avgSNF + '%'],
    ];

    EXPENSE_FIELDS.forEach((f, i) => {
      const mRow = milkRows[i] || ['', ''];
      rows.push([i + 1, f.label, parseFloat(expenses[f.key]) || 0, mRow[0], mRow[1]]);
    });
    // Remaining milk rows beyond 15
    for (let i = EXPENSE_FIELDS.length; i < milkRows.length; i++) {
      rows.push(['', '', '', milkRows[i][0], milkRows[i][1]]);
    }
    rows.push(['', 'TOTAL EXPENSE', totalExpenses, '', '']);
    rows.push([]);

    rows.push(['DG HOUR METER', '', 'DIESEL CONSUMPTION', '', '']);
    rows.push(['Opening Reading', parseFloat(dgMeter.openingReading) || 0, 'Opening Stock', parseFloat(diesel.openingStock) || 0, '']);
    rows.push(['Closing Reading', parseFloat(dgMeter.closingReading) || 0, 'Purchased Qty', parseFloat(diesel.purchasedQty) || 0, '']);
    rows.push(['Total Hours',     dgTotalHours,                             'Consumed Qty',  parseFloat(diesel.consumedQty)  || 0, '']);
    rows.push(['',                '',                                        'Closing Stock', parseFloat(dieselClosingStock) || 0, '']);
    rows.push([]);

    rows.push(['EQUIPMENT EXPENSES', '', 'COST ANALYSIS', '', '']);
    rows.push(['Motor Repair',          parseFloat(equipment.motorRepair)          || 0, 'Operating Expense',   totalExpenses,        '']);
    rows.push(['Pump Maintenance',      parseFloat(equipment.pumpMaintenance)      || 0, 'Equipment Expense',   totalEquipment,       '']);
    rows.push(['Generator Maintenance', parseFloat(equipment.generatorMaintenance) || 0, 'Total Operating Cost',totalOperatingCost,   '']);
    rows.push(['Service Charges',       parseFloat(equipment.serviceCharges)       || 0, 'Cost Per Litre (₹)', parseFloat(costPerLitre), '']);
    rows.push(['TOTAL EQUIPMENT',       totalEquipment,                             '',                         '', '']);
    rows.push([]);

    rows.push(['REMARKS / BMCC OFFICER COMMENTS:']);
    rows.push([remarks || '']);
    rows.push([]);

    rows.push(['APPROVAL SECTION']);
    rows.push(['Supervisor Name:', approvals.supervisorName]);
    rows.push(['Recommended Amount (Rs):', parseFloat(approvals.recommendedAmount) || 0]);
    rows.push(['AMPO:', approvals.ampo]);
    rows.push(['MPO:', approvals.mpo]);
    rows.push(['AM (P&I):', approvals.amPI]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    ws['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 28 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CC Operating Cost');
    XLSX.writeFile(wb, `CC_Operating_Cost_${MONTHS[parseInt(month)-1]}_${year}.xlsx`);
    notifications.show({ message: 'Excel exported', color: 'green' });
  };

  // ── Share helpers ─────────────────────────────────────────────────────────
  const shareFile = async (type) => {
    const doc  = buildPDFBlob();
    const blob = doc.output('blob');
    const file = new File([blob], `CC_Operating_Cost_${MONTHS[parseInt(month)-1]}_${year}.pdf`, { type: 'application/pdf' });
    const text = `CC Operating Cost Report — ${periodLabel}\n${companyName}`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `CC Operating Cost ${periodLabel}`, text });
        return;
      } catch { /* user dismissed */ return; }
    }

    // Fallback: text-only share
    if (type === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent('CC Operating Cost Report - ' + periodLabel)}&body=${encodeURIComponent(text)}`;
    }
  };

  // ── Number input helper ───────────────────────────────────────────────────
  const numInput = (val, onChange) => (
    <NumberInput
      size="xs"
      value={parseFloat(val) || 0}
      onChange={(v) => onChange(v || 0)}
      min={0}
      decimalScale={2}
      hideControls
      styles={{ input: { textAlign: 'right', fontWeight: 600, fontSize: 12 } }}
    />
  );

  // ── Table header cell style ──────────────────────────────────────────────
  const TH = ({ children, align = 'left', bg = '#1a3c6e' }) => (
    <Table.Th style={{ background: bg, color: 'white', fontSize: 11, padding: '5px 8px', textAlign: align }}>
      {children}
    </Table.Th>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box p="md" style={{ background: '#f4f6fb', minHeight: '100vh' }}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group gap="xs" wrap="wrap">
            <Select
              size="sm" w={140} label="Month"
              data={MONTH_OPTIONS} value={month} onChange={v => v && setMonth(v)}
            />
            <Select
              size="sm" w={90} label="Year"
              data={YEAR_OPTIONS} value={year} onChange={v => v && setYear(v)}
            />
            <Box mt={24}>
              <Tooltip label="Sync milk procurement data from collections">
                <Button
                  size="sm" variant="light" color="teal"
                  leftSection={<IconRefresh size={15} />}
                  onClick={syncMilkData} loading={syncing}
                >
                  Sync Milk Data
                </Button>
              </Tooltip>
            </Box>
            {reportId && (
              <Box mt={24}>
                <Badge variant="light" color="green" size="lg">Saved</Badge>
              </Box>
            )}
          </Group>

          <Group gap="xs" mt={24} wrap="wrap">
            <Button
              size="sm" color="blue"
              leftSection={<IconDeviceFloppy size={15} />}
              onClick={saveReport} loading={saving}
            >
              Save
            </Button>
            <Button
              size="sm" variant="light" color="gray"
              leftSection={<IconPrinter size={15} />}
              onClick={handlePrint}
            >
              Print
            </Button>
            <Button
              size="sm" variant="light" color="red"
              leftSection={<IconFileTypePdf size={15} />}
              onClick={exportPDF}
            >
              PDF
            </Button>
            <Button
              size="sm" variant="light" color="green"
              leftSection={<IconFileTypeXls size={15} />}
              onClick={exportExcel}
            >
              Excel
            </Button>
            <Menu shadow="md" width={170}>
              <Menu.Target>
                <Button size="sm" variant="light" color="violet" leftSection={<IconShare size={15} />}>
                  Share
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconBrandWhatsapp size={16} color="#25d366" />}
                  onClick={() => shareFile('whatsapp')}
                >
                  Share via WhatsApp
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconMail size={16} color="#1a73e8" />}
                  onClick={() => shareFile('email')}
                >
                  Share via Email
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* ── Report Body ───────────────────────────────────────────────────── */}
      <Paper withBorder radius="md" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
        <Box ref={printRef}>

          {/* Report header */}
          <Box
            p="md"
            style={{ textAlign: 'center', borderBottom: '2px solid #1a3c6e', background: '#f0f4ff' }}
          >
            <Title order={4} c="blue.9" lh={1.2}>
              PAYMENT OF OPERATING COST OF BMCC
            </Title>
            <Title order={5} c="blue.7" fw={500} mt={2}>
              FOR THE MONTH OF {periodLabel}
            </Title>
            <Text size="xs" c="dimmed" mt={2}>{companyName}</Text>
          </Box>

          <Box p="md">

            {/* ── Row 1: Operating Expenses + Milk Summary ─────────────── */}
            <Grid gutter="md" mb="md">

              {/* Expense Table */}
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
                  <Box py={6} px={10} bg="blue.8" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Operating Expenses</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <TH align="center">Sl.</TH>
                        <TH>Description</TH>
                        <TH align="right">Amount (₹)</TH>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {EXPENSE_FIELDS.map((f, i) => (
                        <Table.Tr key={f.key} style={{ background: i % 2 === 0 ? 'white' : '#f8faff' }}>
                          <Table.Td style={{ textAlign: 'center', width: 36, fontSize: 11, color: '#555' }}>{i + 1}</Table.Td>
                          <Table.Td style={{ fontSize: 12 }}>{f.label}</Table.Td>
                          <Table.Td style={{ width: 130, padding: '3px 6px' }}>
                            {numInput(expenses[f.key], (v) => setExpenses(p => ({ ...p, [f.key]: v })))}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr style={{ background: '#e8f0fe', fontWeight: 700 }}>
                        <Table.Td colSpan={2} style={{ textAlign: 'right', paddingRight: 12, fontSize: 12, fontWeight: 700 }}>
                          TOTAL EXPENSE
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1a3c6e', paddingRight: 8 }}>
                          {fmtRs(totalExpenses)}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Grid.Col>

              {/* Milk Procurement Summary */}
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden', height: '100%' }}>
                  <Box py={6} px={10} bg="green.8" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Milk Procurement Summary</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <TH bg="#2f6e44">Field</TH>
                        <TH bg="#2f6e44" align="right">Value</TH>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[
                        ['Total Milk Procured',   `${milkData.totalMilkProcured} L`],
                        ['Avg Daily Procurement', `${milkData.avgDailyProcurement} L`],
                        ['Procurement Days',      `${milkData.procurementDays} Days`],
                        ['Total Producer Count',  milkData.totalProducerCount],
                        ['Average FAT',           `${milkData.avgFAT}%`],
                        ['Average SNF',           `${milkData.avgSNF}%`],
                      ].map(([lbl, val], i) => (
                        <Table.Tr key={lbl} style={{ background: i % 2 === 0 ? 'white' : '#f0fff4' }}>
                          <Table.Td style={{ fontSize: 12 }}>{lbl}</Table.Td>
                          <Table.Td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: '#1a6e3c' }}>{val}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>

                  <Box p="xs" mt="xs">
                    <Text size="11px" c="dimmed" ta="center">
                      Click <strong>Sync Milk Data</strong> to auto-fetch from milk collections
                    </Text>
                  </Box>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* ── Row 2: DG Meter + Diesel ─────────────────────────────── */}
            <Grid gutter="md" mb="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
                  <Box py={6} px={10} bg="#6e2f2f" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>DG Hour Meter Reading</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <TH bg="#8b3a3a">Reading Type</TH>
                        <TH bg="#8b3a3a" align="right">Value (Hours)</TH>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>Opening Reading</Table.Td>
                        <Table.Td style={{ width: 140, padding: '3px 6px' }}>
                          {numInput(dgMeter.openingReading, (v) => setDgMeter(p => ({ ...p, openingReading: v })))}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>Closing Reading</Table.Td>
                        <Table.Td style={{ width: 140, padding: '3px 6px' }}>
                          {numInput(dgMeter.closingReading, (v) => setDgMeter(p => ({ ...p, closingReading: v })))}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr style={{ background: '#e8f0fe' }}>
                        <Table.Td style={{ fontWeight: 700 }}>Total Hours</Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1a3c6e', paddingRight: 8 }}>
                          {dgTotalHours} Hrs
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
                  <Box py={6} px={10} bg="#6e2f2f" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Diesel Consumption</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <TH bg="#8b3a3a">Type</TH>
                        <TH bg="#8b3a3a" align="right">Litres</TH>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[
                        ['Opening Stock', 'openingStock'],
                        ['Purchased Qty', 'purchasedQty'],
                        ['Consumed Qty',  'consumedQty'],
                      ].map(([lbl, key]) => (
                        <Table.Tr key={key}>
                          <Table.Td>{lbl}</Table.Td>
                          <Table.Td style={{ width: 140, padding: '3px 6px' }}>
                            {numInput(diesel[key], (v) => setDiesel(p => ({ ...p, [key]: v })))}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr style={{ background: '#e8f0fe' }}>
                        <Table.Td style={{ fontWeight: 700 }}>Closing Stock</Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1a3c6e', paddingRight: 8 }}>
                          {fmt(dieselClosingStock)} L
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* ── Row 3: Equipment + Cost Analysis ────────────────────── */}
            <Grid gutter="md" mb="md">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
                  <Box py={6} px={10} bg="#4a2f6e" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Equipment Expenses</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        <TH bg="#5c3a8e">Description</TH>
                        <TH bg="#5c3a8e" align="right">Amount (₹)</TH>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {EQUIP_FIELDS.map((f, i) => (
                        <Table.Tr key={f.key} style={{ background: i % 2 === 0 ? 'white' : '#faf5ff' }}>
                          <Table.Td>{f.label}</Table.Td>
                          <Table.Td style={{ width: 140, padding: '3px 6px' }}>
                            {numInput(equipment[f.key], (v) => setEquipment(p => ({ ...p, [f.key]: v })))}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr style={{ background: '#e8f0fe' }}>
                        <Table.Td style={{ fontWeight: 700 }}>Total Equipment</Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#4a2f6e', paddingRight: 8 }}>
                          {fmtRs(totalEquipment)}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Grid.Col>

              {/* Cost Analysis */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
                  <Box py={6} px={10} bg="#4a2f6e" style={{ textAlign: 'center' }}>
                    <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Cost Analysis</Text>
                  </Box>
                  <Table withTableBorder={false} withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Tbody>
                      {[
                        ['Operating Expense',   fmtRs(totalExpenses),       'white'],
                        ['Equipment Expense',   fmtRs(totalEquipment),      '#faf5ff'],
                      ].map(([lbl, val, bg]) => (
                        <Table.Tr key={lbl} style={{ background: bg }}>
                          <Table.Td style={{ fontSize: 12 }}>{lbl}</Table.Td>
                          <Table.Td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, paddingRight: 8 }}>{val}</Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr style={{ background: '#e8f0fe' }}>
                        <Table.Td style={{ fontWeight: 700, fontSize: 13 }}>Total Operating Cost</Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#1a3c6e', paddingRight: 8 }}>
                          {fmtRs(totalOperatingCost)}
                        </Table.Td>
                      </Table.Tr>
                      <Table.Tr style={{ background: '#fff3e0' }}>
                        <Table.Td style={{ fontWeight: 700, fontSize: 13, color: '#b44000' }}>Cost Per Litre</Table.Td>
                        <Table.Td style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#b44000', paddingRight: 8 }}>
                          ₹ {costPerLitre}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  <Box p="sm" pt={0}>
                    <SimpleGrid cols={2} spacing="xs" mt="xs">
                      <Card withBorder p="xs" radius="sm" style={{ background: '#e8f0fe' }}>
                        <Text size="10px" c="dimmed">Total Milk Procured</Text>
                        <Text fw={700} size="sm" c="blue.8">{milkData.totalMilkProcured} L</Text>
                      </Card>
                      <Card withBorder p="xs" radius="sm" style={{ background: '#e8f0fe' }}>
                        <Text size="10px" c="dimmed">Procurement Days</Text>
                        <Text fw={700} size="sm" c="blue.8">{milkData.procurementDays}</Text>
                      </Card>
                    </SimpleGrid>
                  </Box>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* ── Remarks ──────────────────────────────────────────────── */}
            <Paper withBorder radius="sm" mb="md" style={{ overflow: 'hidden' }}>
              <Box py={6} px={10} bg="#555" style={{ textAlign: 'center' }}>
                <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>
                  Special Remarks / BMCC Officer Comments
                </Text>
              </Box>
              <Box p="sm">
                <Textarea
                  autosize
                  minRows={3}
                  maxRows={8}
                  placeholder="Enter special remarks or BMCC officer comments here…"
                  value={remarks}
                  onChange={(e) => setRemarks(e.currentTarget.value)}
                  styles={{ input: { fontFamily: 'Arial, sans-serif', fontSize: 13 } }}
                />
              </Box>
            </Paper>

            {/* ── Approvals ─────────────────────────────────────────────── */}
            <Paper withBorder radius="sm" style={{ overflow: 'hidden' }}>
              <Box py={6} px={10} bg="#1a3c6e" style={{ textAlign: 'center' }}>
                <Text size="sm" fw={700} c="white" tt="uppercase" ls={0.5}>Approval Section</Text>
              </Box>
              <Box p="md">
                <Grid gutter="md" mb="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <TextInput
                      label="Supervisor Name"
                      placeholder="Name of supervisor"
                      value={approvals.supervisorName}
                      onChange={(e) => setApprovals(p => ({ ...p, supervisorName: e.currentTarget.value }))}
                      styles={{ input: { fontWeight: 600 } }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <NumberInput
                      label="Verified & Recommended for (Rs)"
                      placeholder="0.00"
                      value={parseFloat(approvals.recommendedAmount) || 0}
                      onChange={(v) => setApprovals(p => ({ ...p, recommendedAmount: v || 0 }))}
                      min={0}
                      decimalScale={2}
                      hideControls
                      styles={{ input: { fontWeight: 600 } }}
                    />
                  </Grid.Col>
                </Grid>

                <Divider label="Digital Signatures" mb="md" />

                <Grid gutter="md">
                  {[
                    ['ampo', 'AMPO'],
                    ['mpo',  'MPO'],
                    ['amPI', 'AM (P&I)'],
                  ].map(([key, label]) => (
                    <Grid.Col key={key} span={{ base: 12, sm: 4 }}>
                      <Paper withBorder radius="sm" p="sm" style={{ borderStyle: 'dashed', borderColor: '#aaa' }}>
                        <Text size="11px" c="dimmed" mb={4} tt="uppercase">{label}</Text>
                        <TextInput
                          placeholder={`${label} name / signature`}
                          value={approvals[key]}
                          onChange={(e) => setApprovals(p => ({ ...p, [key]: e.currentTarget.value }))}
                          variant="unstyled"
                          styles={{
                            input: {
                              borderBottom: '1px solid #aaa', borderRadius: 0,
                              fontWeight: 600, fontSize: 13, paddingLeft: 0
                            }
                          }}
                        />
                      </Paper>
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            </Paper>

          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default BMCCOperatingCostReport;
