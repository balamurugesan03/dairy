import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Group, Text, Button, TextInput, Select, Checkbox, Radio,
  Accordion, Badge, ActionIcon, Paper, ScrollArea, Divider,
  Table, Pagination, Tooltip, Stack, Loader, Center, NumberInput,
  ThemeIcon, Card
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch, IconDownload, IconFileTypePdf, IconRefresh, IconFilter,
  IconUsers, IconPrinter, IconFileSpreadsheet,
  IconChevronUp, IconChevronDown,
  IconUserCheck, IconCalendar, IconBuilding,
  IconArrowsSort, IconX, IconListDetails, IconAdjustmentsHorizontal
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const REPORT_TYPE_OPTIONS = [
  { value: 'active', label: 'Active Member Register' },
  { value: 'address', label: 'Address Label' },
  { value: 'voters', label: 'Voters List' },
  { value: 'voters_photo', label: 'Voters List With Photo' },
  { value: 'share_upto', label: 'Share List Enrolled Upto Year' },
  { value: 'share_during', label: 'Share List Enrolled During Year' }
];

const SEX_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' }
];

const CASTE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'OC', label: 'OC' },
  { value: 'BC', label: 'BC' },
  { value: 'MBC', label: 'MBC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' }
];

const QTY_COND = [
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' }
];

const DAYS_COND = [
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' }
];

const SECTION_COLORS = {
  center:   { bg: '#e8f4fd', border: '#3b82f6', icon: '#2563eb', label: '#1e40af' },
  advanced: { bg: '#f0fdf4', border: '#22c55e', icon: '#16a34a', label: '#166534' },
  pouring:  { bg: '#fefce8', border: '#eab308', icon: '#ca8a04', label: '#854d0e' },
  age:      { bg: '#fdf4ff', border: '#a855f7', icon: '#9333ea', label: '#6b21a8' },
  report:   { bg: '#fff7ed', border: '#f97316', icon: '#ea580c', label: '#9a3412' }
};

const COND_MAP = { gte: '>=', lte: '<=', eq: '=' };

const calcAge = (dob) => {
  if (!dob) return '-';
  const d = dayjs(dob);
  if (!d.isValid()) return '-';
  return dayjs().diff(d, 'year');
};

const fmtAddress = (a) =>
  [a?.place, a?.post, a?.village, a?.panchayat, a?.pin].filter(Boolean).join(', ');

const getReportTitle = (reportType) => {
  const titles = {
    active:        'Active Member Register',
    address:       'Address Labels',
    voters:        'Voters List',
    voters_photo:  'Voters List (With Photo)',
    share_upto:    'Share List — Enrolled Upto Year',
    share_during:  'Share List — Enrolled During Year'
  };
  return titles[reportType] || 'Member Register';
};

const SectionHeader = ({ color, icon: Icon, label }) => (
  <Group gap={8}>
    <ThemeIcon size={22} radius="sm" color="blue" variant="light" style={{
      background: color.bg, color: color.icon, border: `1px solid ${color.border}`
    }}>
      <Icon size={13} />
    </ThemeIcon>
    <Text fw={600} size="sm" c={color.label}>{label}</Text>
  </Group>
);

// ── Print HTML generators ─────────────────────────────────────────────────────

const buildPrintHeader = (companyName, reportType, filters) => {
  const title = getReportTitle(reportType);
  const today = dayjs().format('DD/MM/YYYY');
  const hasRange = filters.pourFrom && filters.pourTo;
  const dateRange = hasRange
    ? `${dayjs(filters.pourFrom).format('DD/MM/YYYY')} – ${dayjs(filters.pourTo).format('DD/MM/YYYY')}`
    : '';
  return `
    <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">
      <div style="font-size:17px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">${companyName || 'DAIRY COOPERATIVE SOCIETY'}</div>
      <div style="font-size:13px;font-weight:700;margin-top:4px;letter-spacing:2px;text-transform:uppercase">${title}</div>
      ${dateRange ? `<div style="font-size:10px;color:#555;margin-top:3px">Period: ${dateRange}</div>` : ''}
      <div style="font-size:10px;color:#555;margin-top:2px">Printed: ${today}</div>
    </div>`;
};

const TABLE_CSS = `
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #111; background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #e8e8e8; font-weight: 700; padding: 4px 5px; border: 1px solid #888;
       text-align: center; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 3px 5px; border: 1px solid #bbb; vertical-align: middle; }
  tr:nth-child(even) td { background: #f7f7f7; }
  .total-row td { font-weight: 700; background: #e0e0e0; }
`;

const generateActiveMemberPrint = (data, companyName, filters) => {
  const rows = data.map((f, i) => {
    const age = calcAge(f.personalDetails?.dob);
    const totalShares = f.financialDetails?.totalShares || 0;
    const shareVal = totalShares * (f.financialDetails?.shareValue || 0);
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${f.memberId || '—'}</td>
      <td>${f.farmerNumber || '—'}</td>
      <td>${f.personalDetails?.name || '—'}</td>
      <td>${f.address?.houseName || ''}<br/><span style="color:#444">${fmtAddress(f.address)}</span></td>
      <td style="text-align:center">${f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—'}</td>
      <td style="text-align:center">${age !== '-' ? age : '—'}</td>
      <td style="text-align:center">${f.personalDetails?.gender?.[0] || '—'}</td>
      <td style="text-align:center">${f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—'}</td>
      <td style="text-align:center">${totalShares || '—'}</td>
      <td style="text-align:right">${shareVal > 0 ? shareVal.toFixed(2) : '—'}</td>
      <td>${f.financialDetails?.resolutionNo || '—'}</td>
      <td style="text-align:center">${f.financialDetails?.resolutionDate ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY') : '—'}</td>
      <td style="text-align:right">${f._totalQty != null ? f._totalQty.toFixed(2) : '—'}</td>
      <td style="text-align:center">${f._pouringDays != null ? f._pouringDays : '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Active Member Register</title>
  <style>${TABLE_CSS}</style></head><body>
  ${buildPrintHeader(companyName, 'active', filters)}
  <p style="font-size:9px;margin-bottom:6px">Total Records: <b>${data.length}</b></p>
  <table><thead><tr>
    <th>S.No</th><th>Member No</th><th>Farmer No</th><th>Name</th><th>House / Address</th>
    <th>Date of Birth</th><th>Age</th><th>Sex</th><th>Date of Admission</th>
    <th>Share Nos</th><th>Share Value (₹)</th><th>Resolution No</th><th>Resolution Date</th>
    <th>Qty (L)</th><th>Days</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
  </body></html>`;
};

const generateVotersPrint = (data, companyName, filters, withPhoto) => {
  const rows = data.map((f, i) => {
    const age = calcAge(f.personalDetails?.dob);
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${f.memberId || '—'}</td>
      <td>${f.farmerNumber || '—'}</td>
      <td>${f.personalDetails?.name || '—'}</td>
      <td>${f.address?.houseName || ''}<br/><span style="color:#444;font-size:8px">${fmtAddress(f.address)}</span></td>
      <td style="text-align:center">${f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—'}</td>
      <td style="text-align:center">${age !== '-' ? age : '—'}</td>
      <td style="text-align:center">${f.personalDetails?.gender || '—'}</td>
      ${withPhoto ? `<td style="width:45px;height:50px;text-align:center;vertical-align:top">
        <div style="border:1px solid #aaa;width:40px;height:45px;margin:auto"></div></td>` : ''}
      <td style="width:60px"></td>
    </tr>`;
  }).join('');

  const photoHeader = withPhoto ? '<th style="width:50px">Photo</th>' : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Voters List</title>
  <style>${TABLE_CSS} td,th{font-size:8.5px;}</style></head><body>
  ${buildPrintHeader(companyName, withPhoto ? 'voters_photo' : 'voters', filters)}
  <p style="font-size:9px;margin-bottom:6px">Total Voters: <b>${data.length}</b></p>
  <table><thead><tr>
    <th>S.No</th><th>Member No</th><th>Farmer No</th><th>Name</th><th>House Name / Address</th>
    <th>Date of Birth</th><th>Age</th><th>Sex</th>${photoHeader}<th>Signature</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
  </body></html>`;
};

const generateShareListPrint = (data, companyName, filters) => {
  const rows = data.map((f, i) => {
    const totalShares = f.financialDetails?.totalShares || 0;
    const shareVal = totalShares * (f.financialDetails?.shareValue || 0);
    return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${f.memberId || '—'}</td>
      <td>${f.farmerNumber || '—'}</td>
      <td>${f.personalDetails?.name || '—'}</td>
      <td style="text-align:center">${f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—'}</td>
      <td style="text-align:center">${totalShares || '—'}</td>
      <td style="text-align:right">${shareVal > 0 ? shareVal.toFixed(2) : '—'}</td>
      <td>${f.financialDetails?.resolutionNo || '—'}</td>
      <td style="text-align:center">${f.financialDetails?.resolutionDate ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY') : '—'}</td>
    </tr>`;
  }).join('');

  const totShares = data.reduce((s, f) => s + (f.financialDetails?.totalShares || 0), 0);
  const totVal    = data.reduce((s, f) => s + (f.financialDetails?.totalShares || 0) * (f.financialDetails?.shareValue || 0), 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Share List</title>
  <style>${TABLE_CSS}</style></head><body>
  ${buildPrintHeader(companyName, filters.reportType, filters)}
  <p style="font-size:9px;margin-bottom:6px">Total Members: <b>${data.length}</b></p>
  <table><thead><tr>
    <th>S.No</th><th>Member No</th><th>Farmer No</th><th>Name</th>
    <th>Date of Admission</th><th>Share Nos</th><th>Share Value (₹)</th>
    <th>Resolution No</th><th>Resolution Date</th>
  </tr></thead><tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="5" style="text-align:right">TOTAL</td>
      <td style="text-align:center">${totShares}</td>
      <td style="text-align:right">${totVal.toFixed(2)}</td>
      <td colspan="2"></td>
    </tr>
  </tbody></table>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
  </body></html>`;
};

const generateAddressLabelPrint = (data, companyName, filters) => {
  const labels = data.map((f) => `
    <div style="border:1px solid #aaa;padding:8px 10px;break-inside:avoid;font-size:10px;line-height:1.5">
      <div style="font-size:9px;color:#555">${f.farmerNumber}${f.memberId ? ' / ' + f.memberId : ''}</div>
      <div style="font-weight:700;font-size:11px">${f.personalDetails?.name || ''}</div>
      ${f.address?.houseName ? `<div>${f.address.houseName}</div>` : ''}
      <div>${[f.address?.place, f.address?.post, f.address?.village, f.address?.panchayat].filter(Boolean).join(', ')}</div>
      ${f.address?.pin ? `<div>PIN: ${f.address.pin}</div>` : ''}
      ${f.personalDetails?.phone ? `<div>Ph: ${f.personalDetails.phone}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Address Labels</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  </style></head><body>
  ${buildPrintHeader(companyName, 'address', filters)}
  <div class="grid">${labels}</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
  </body></html>`;
};

const generatePrintHTML = (data, reportType, companyName, filters) => {
  if (reportType === 'voters' || reportType === 'voters_photo')
    return generateVotersPrint(data, companyName, filters, reportType === 'voters_photo');
  if (reportType === 'share_upto' || reportType === 'share_during')
    return generateShareListPrint(data, companyName, filters);
  if (reportType === 'address')
    return generateAddressLabelPrint(data, companyName, filters);
  return generateActiveMemberPrint(data, companyName, filters);
};

// ── Main Component ────────────────────────────────────────────────────────────

const MemberRegister = () => {
  const { selectedCompany } = useCompany();

  const [centers, setCenters] = useState([]);
  const [centerLoading, setCenterLoading] = useState(true);

  const INIT_FILTERS = {
    collectionCenter: '', pouringMembers: false, retiredMembers: false,
    prodFrom: '', prodTo: '', nameSearch: '', localLanguage: false,
    sex: '', caste: '', occupation: '', category: '', localBody: '',
    pourFrom: null, pourTo: null, daysCond: 'gte', daysVal: '', qtyCond: 'gte', qtyVal: '',
    ageMin: '', ageMax: '', reportType: 'active'
  };

  const [filters, setFilters] = useState(INIT_FILTERS);
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [printing, setPrinting] = useState(false);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const PAGE_SIZE = 15;

  const [sortField, setSortField] = useState('farmerNumber');
  const [sortDir, setSortDir]     = useState('asc');

  const debounceTimer = useRef(null);

  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 200 })
      .then(res => {
        const list = res.data || res;
        setCenters([
          { value: '', label: 'ALL' },
          ...(Array.isArray(list) ? list : []).map(c => ({
            value: c._id,
            label: c.centerName || c.name
          }))
        ]);
      })
      .catch(() => setCenters([{ value: '', label: 'ALL' }]))
      .finally(() => setCenterLoading(false));
  }, []);

  const buildParams = (overridePage, overrideLimit) => ({
    page:             overridePage ?? page,
    limit:            overrideLimit ?? PAGE_SIZE,
    memberType:       'Member',
    activeOnly:       filters.retiredMembers ? undefined : 'true',
    collectionCenter: filters.collectionCenter || undefined,
    gender:           filters.sex || undefined,
    caste:            filters.caste || undefined,
    farmerNumberFrom: filters.prodFrom || undefined,
    farmerNumberTo:   filters.prodTo   || undefined,
    nameSearch:       filters.nameSearch || undefined,
    fromDate: filters.pourFrom ? dayjs(filters.pourFrom).format('YYYY-MM-DD') : undefined,
    toDate:   filters.pourTo   ? dayjs(filters.pourTo).format('YYYY-MM-DD')   : undefined,
    daysCondition: filters.daysVal !== '' ? COND_MAP[filters.daysCond] : undefined,
    daysValue:     filters.daysVal !== '' ? filters.daysVal             : undefined,
    qtyCondition:  filters.qtyVal  !== '' ? COND_MAP[filters.qtyCond]  : undefined,
    qtyValue:      filters.qtyVal  !== '' ? filters.qtyVal              : undefined,
  });

  const fetchMembers = useCallback(async (overridePage) => {
    setLoading(true);
    try {
      const res = await farmerAPI.getProducerReport(buildParams(overridePage));
      const farmers = res.data || [];
      setData(farmers);
      setTotal(res.pagination?.total ?? farmers.length);
    } catch (e) {
      notifications.show({ title: 'Error', message: e.message || 'Failed to load members', color: 'red' });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortField, sortDir, search, filters]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setPage(1), 400);
  };

  const handleDisplay = () => { setPage(1); fetchMembers(1); };

  const handleClear = () => {
    setFilters(INIT_FILTERS);
    setSearch('');
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  // ── Fetch all records for print / PDF ──────────────────────────────────────
  const fetchAllRecords = async () => {
    const res = await farmerAPI.getProducerReport(buildParams(1, 9999));
    return res.data || [];
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    setPrinting(true);
    try {
      notifications.show({ id: 'print-load', message: 'Preparing print…', color: 'blue', loading: true, autoClose: false });
      const allData = await fetchAllRecords();
      notifications.hide('print-load');

      const html = generatePrintHTML(allData, filters.reportType, selectedCompany?.companyName, filters);
      const pw = window.open('', '_blank');
      if (!pw) { alert('Pop-up blocked. Please allow pop-ups and try again.'); return; }
      pw.document.write(html);
      pw.document.close();
    } catch (e) {
      notifications.hide('print-load');
      notifications.show({ title: 'Error', message: 'Failed to prepare print', color: 'red' });
    } finally {
      setPrinting(false);
    }
  };

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setPrinting(true);
    try {
      notifications.show({ id: 'pdf-load', message: 'Generating PDF…', color: 'blue', loading: true, autoClose: false });
      const allData = await fetchAllRecords();
      notifications.hide('pdf-load');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const companyName = selectedCompany?.companyName || 'Dairy Cooperative Society';
      const reportTitle = getReportTitle(filters.reportType);
      const today = dayjs().format('DD/MM/YYYY');

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(companyName.toUpperCase(), 105, 14, { align: 'center' });
      doc.setFontSize(10);
      doc.text(reportTitle.toUpperCase(), 105, 20, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      if (filters.pourFrom && filters.pourTo) {
        doc.text(`Period: ${dayjs(filters.pourFrom).format('DD/MM/YYYY')} – ${dayjs(filters.pourTo).format('DD/MM/YYYY')}`, 105, 25, { align: 'center' });
      }
      doc.text(`Printed: ${today}  |  Total: ${allData.length}`, 105, 29, { align: 'center' });

      const rtype = filters.reportType;

      if (rtype === 'voters' || rtype === 'voters_photo') {
        autoTable(doc, {
          startY: 34,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
          head: [['S.No', 'Member No', 'Farmer No', 'Name', 'Address', 'DOB', 'Age', 'Sex', 'Signature']],
          body: allData.map((f, i) => [
            i + 1,
            f.memberId || '—',
            f.farmerNumber || '—',
            f.personalDetails?.name || '—',
            [f.address?.houseName, fmtAddress(f.address)].filter(Boolean).join('\n'),
            f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—',
            calcAge(f.personalDetails?.dob),
            f.personalDetails?.gender || '—',
            ''
          ])
        });
      } else if (rtype === 'share_upto' || rtype === 'share_during') {
        const totShares = allData.reduce((s, f) => s + (f.financialDetails?.totalShares || 0), 0);
        const totVal    = allData.reduce((s, f) => s + (f.financialDetails?.totalShares || 0) * (f.financialDetails?.shareValue || 0), 0);
        autoTable(doc, {
          startY: 34,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
          head: [['S.No', 'Member No', 'Farmer No', 'Name', 'Date of Admission', 'Shares', 'Share Value (₹)', 'Resolution No', 'Resolution Date']],
          body: [
            ...allData.map((f, i) => {
              const totalShares = f.financialDetails?.totalShares || 0;
              const shareVal = totalShares * (f.financialDetails?.shareValue || 0);
              return [
                i + 1,
                f.memberId || '—',
                f.farmerNumber || '—',
                f.personalDetails?.name || '—',
                f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—',
                totalShares || '—',
                shareVal > 0 ? shareVal.toFixed(2) : '—',
                f.financialDetails?.resolutionNo || '—',
                f.financialDetails?.resolutionDate ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY') : '—'
              ];
            }),
            ['', '', '', '', 'TOTAL', totShares, totVal.toFixed(2), '', '']
          ]
        });
      } else if (rtype === 'address') {
        autoTable(doc, {
          startY: 34,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
          head: [['Farmer No', 'Member No', 'Name', 'House Name', 'Address', 'Phone']],
          body: allData.map(f => [
            f.farmerNumber || '—',
            f.memberId || '—',
            f.personalDetails?.name || '—',
            f.address?.houseName || '—',
            fmtAddress(f.address) || '—',
            f.personalDetails?.phone || '—'
          ])
        });
      } else {
        autoTable(doc, {
          startY: 34,
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
          head: [['S.No', 'Member No', 'Farmer No', 'Name', 'Address', 'DOB', 'Age', 'Sex',
                  'Adm. Date', 'Shares', 'Share Val.', 'Res. No', 'Res. Date', 'Qty(L)', 'Days']],
          body: allData.map((f, i) => {
            const totalShares = f.financialDetails?.totalShares || 0;
            const shareVal = totalShares * (f.financialDetails?.shareValue || 0);
            return [
              i + 1,
              f.memberId || '—',
              f.farmerNumber || '—',
              f.personalDetails?.name || '—',
              [f.address?.houseName, fmtAddress(f.address)].filter(Boolean).join(', '),
              f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—',
              calcAge(f.personalDetails?.dob),
              f.personalDetails?.gender?.[0] || '—',
              f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—',
              totalShares || '—',
              shareVal > 0 ? shareVal.toFixed(2) : '—',
              f.financialDetails?.resolutionNo || '—',
              f.financialDetails?.resolutionDate ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY') : '—',
              f._totalQty != null ? f._totalQty.toFixed(2) : '—',
              f._pouringDays != null ? f._pouringDays : '—'
            ];
          })
        });
      }

      doc.save(`${reportTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      notifications.show({ title: 'PDF Downloaded', message: `${reportTitle} saved successfully`, color: 'green' });
    } catch (e) {
      notifications.hide('pdf-load');
      notifications.show({ title: 'Error', message: 'Failed to generate PDF', color: 'red' });
    } finally {
      setPrinting(false);
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!data.length) return notifications.show({ message: 'No data to export', color: 'yellow' });
    const headers = [
      'Farmer Number','Member No','Name','House Name','Address',
      'Date of Birth','Age','Sex','Date of Admission',
      'Total Share Nos','Total Share Value','Resolution No','Resolution Date',
      'Quantity (L)','Days'
    ];
    const rows = data.map(f => [
      f.farmerNumber,
      f.memberId || '',
      f.personalDetails?.name || '',
      f.address?.houseName || '',
      fmtAddress(f.address),
      f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '',
      calcAge(f.personalDetails?.dob),
      f.personalDetails?.gender || '',
      f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '',
      f.financialDetails?.totalShares || 0,
      ((f.financialDetails?.totalShares || 0) * (f.financialDetails?.shareValue || 0)).toFixed(2),
      f.financialDetails?.resolutionNo || '',
      f.financialDetails?.resolutionDate ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY') : '',
      f._totalQty ?? '',
      f._pouringDays ?? ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'member-register.csv'; a.click();
    URL.revokeObjectURL(url);
    notifications.show({ title: 'Exported', message: 'CSV downloaded successfully', color: 'green' });
  };

  // ── Sort Icon ──────────────────────────────────────────────────────────────
  const SortIcon = ({ field }) => {
    if (sortField !== field) return <IconArrowsSort size={12} style={{ opacity: 0.35 }} />;
    return sortDir === 'asc'
      ? <IconChevronUp size={12} style={{ color: '#3b82f6' }} />
      : <IconChevronDown size={12} style={{ color: '#3b82f6' }} />;
  };

  const thStyle = {
    background: '#f8fafc', color: '#475569', fontWeight: 700,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '10px 12px', whiteSpace: 'nowrap', cursor: 'pointer',
    userSelect: 'none', borderBottom: '2px solid #e2e8f0'
  };

  const SIDEBAR_W = 300;

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f1f5f9' }}>

      {/* ══ LEFT FILTER PANEL ═════════════════════════════════════════════ */}
      <Box style={{
        width: SIDEBAR_W, minWidth: SIDEBAR_W, height: '100%',
        background: '#fff', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)'
      }}>
        <Box style={{ padding: '14px 16px 10px', borderBottom: '1px solid #e2e8f0', background: '#1e3a5f' }}>
          <Group gap={6}>
            <IconFilter size={16} color="#93c5fd" />
            <Text fw={700} size="sm" c="white">Filter Panel</Text>
          </Group>
        </Box>

        <ScrollArea style={{ flex: 1 }} p={0} scrollbarSize={4}>
          <Accordion multiple defaultValue={['center','advanced']} styles={{
            item: { border: 'none', borderBottom: '1px solid #f1f5f9' },
            control: { padding: '9px 12px' },
            content: { padding: '4px 12px 12px' },
            chevron: { color: '#94a3b8' }
          }}>

            {/* ── Collection Center ─────────────────────────────────── */}
            <Accordion.Item value="center">
              <Accordion.Control>
                <SectionHeader color={SECTION_COLORS.center} icon={IconBuilding} label="Collection Center" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={8}>
                  <Select
                    size="xs" placeholder="ALL" data={centers}
                    value={filters.collectionCenter}
                    onChange={v => setFilters(f => ({ ...f, collectionCenter: v || '' }))}
                    disabled={centerLoading} searchable clearable
                    styles={{ input: { fontSize: 12 }, option: { fontSize: 12 } }}
                  />
                  <Checkbox size="xs" label={<Text size="xs" fw={500}>Pouring Members</Text>}
                    checked={filters.pouringMembers}
                    onChange={e => setFilters(f => ({ ...f, pouringMembers: e.target.checked }))} />
                  <Checkbox size="xs" label={<Text size="xs" fw={500}>Retired Members</Text>}
                    checked={filters.retiredMembers}
                    onChange={e => setFilters(f => ({ ...f, retiredMembers: e.target.checked }))} />
                  <Divider my={2} />
                  <Group gap={6}>
                    <TextInput size="xs" label="Farmer No From" placeholder="001"
                      value={filters.prodFrom}
                      onChange={e => setFilters(f => ({ ...f, prodFrom: e.target.value }))}
                      style={{ flex: 1 }}
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                    <TextInput size="xs" label="To" placeholder="999"
                      value={filters.prodTo}
                      onChange={e => setFilters(f => ({ ...f, prodTo: e.target.value }))}
                      style={{ flex: 1 }}
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  </Group>
                  <TextInput size="xs" label="Farmer Name" placeholder="Search by name…"
                    value={filters.nameSearch}
                    onChange={e => setFilters(f => ({ ...f, nameSearch: e.target.value }))}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  <Checkbox size="xs" label={<Text size="xs" fw={500}>Local Language</Text>}
                    checked={filters.localLanguage}
                    onChange={e => setFilters(f => ({ ...f, localLanguage: e.target.checked }))} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* ── Advanced Filter ───────────────────────────────────── */}
            <Accordion.Item value="advanced">
              <Accordion.Control>
                <SectionHeader color={SECTION_COLORS.advanced} icon={IconAdjustmentsHorizontal} label="Advanced Filter" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={8}>
                  <Select size="xs" label="Sex" data={SEX_OPTIONS} value={filters.sex}
                    onChange={v => setFilters(f => ({ ...f, sex: v || '' }))} clearable
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' }, input: { fontSize: 12 }, option: { fontSize: 12 } }} />
                  <Select size="xs" label="Caste" data={CASTE_OPTIONS} value={filters.caste}
                    onChange={v => setFilters(f => ({ ...f, caste: v ?? '' }))} clearable
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' }, input: { fontSize: 12 }, option: { fontSize: 12 } }} />
                  <TextInput size="xs" label="Occupation" placeholder="e.g. Farmer"
                    value={filters.occupation}
                    onChange={e => setFilters(f => ({ ...f, occupation: e.target.value }))}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  <TextInput size="xs" label="Category" placeholder="e.g. A / B / C"
                    value={filters.category}
                    onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  <TextInput size="xs" label="Local Body" placeholder="Panchayat / Municipality"
                    value={filters.localBody}
                    onChange={e => setFilters(f => ({ ...f, localBody: e.target.value }))}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* ── Pouring Days & Quantity ───────────────────────────── */}
            <Accordion.Item value="pouring">
              <Accordion.Control>
                <SectionHeader color={SECTION_COLORS.pouring} icon={IconCalendar} label="Pouring Days & Qty" />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={8}>
                  <Group gap={4} grow>
                    <DatePickerInput size="xs" label="From Date" placeholder="From"
                      value={filters.pourFrom}
                      onChange={(from) => setFilters(f => ({ ...f, pourFrom: from }))}
                      clearable valueFormat="DD/MM/YYYY"
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                    <DatePickerInput size="xs" label="To Date" placeholder="To"
                      value={filters.pourTo}
                      onChange={(to) => setFilters(f => ({ ...f, pourTo: to }))}
                      clearable valueFormat="DD/MM/YYYY"
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  </Group>
                  <Group gap={4} align="flex-end">
                    <Select size="xs" label="Days" data={DAYS_COND} value={filters.daysCond}
                      onChange={v => setFilters(f => ({ ...f, daysCond: v }))}
                      style={{ width: 64 }}
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                    <NumberInput size="xs" placeholder="0" value={filters.daysVal}
                      onChange={v => setFilters(f => ({ ...f, daysVal: v }))}
                      min={0} style={{ flex: 1 }} />
                  </Group>
                  <Group gap={4} align="flex-end">
                    <Select size="xs" label="Qty (L)" data={QTY_COND} value={filters.qtyCond}
                      onChange={v => setFilters(f => ({ ...f, qtyCond: v }))}
                      style={{ width: 64 }}
                      styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                    <NumberInput size="xs" placeholder="0" value={filters.qtyVal}
                      onChange={v => setFilters(f => ({ ...f, qtyVal: v }))}
                      min={0} style={{ flex: 1 }} />
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* ── Age Filter ────────────────────────────────────────── */}
            <Accordion.Item value="age">
              <Accordion.Control>
                <SectionHeader color={SECTION_COLORS.age} icon={IconUserCheck} label="Age Filter" />
              </Accordion.Control>
              <Accordion.Panel>
                <Group gap={6}>
                  <NumberInput size="xs" label="Min Age" placeholder="18" value={filters.ageMin}
                    onChange={v => setFilters(f => ({ ...f, ageMin: v }))}
                    min={0} max={120} style={{ flex: 1 }}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                  <NumberInput size="xs" label="Max Age" placeholder="80" value={filters.ageMax}
                    onChange={v => setFilters(f => ({ ...f, ageMax: v }))}
                    min={0} max={120} style={{ flex: 1 }}
                    styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }} />
                </Group>
              </Accordion.Panel>
            </Accordion.Item>

            {/* ── Report Type ───────────────────────────────────────── */}
            <Accordion.Item value="report">
              <Accordion.Control>
                <SectionHeader color={SECTION_COLORS.report} icon={IconListDetails} label="Voters List & Share List" />
              </Accordion.Control>
              <Accordion.Panel>
                <Radio.Group value={filters.reportType}
                  onChange={v => setFilters(f => ({ ...f, reportType: v }))}>
                  <Stack gap={6}>
                    {REPORT_TYPE_OPTIONS.map(opt => (
                      <Radio key={opt.value} value={opt.value}
                        label={<Text size="xs">{opt.label}</Text>} size="xs" />
                    ))}
                  </Stack>
                </Radio.Group>
              </Accordion.Panel>
            </Accordion.Item>

          </Accordion>
        </ScrollArea>

        {/* Sidebar Footer */}
        <Box style={{ padding: '12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <Stack gap={6}>
            <Group gap={6}>
              <Button size="xs" variant="filled" color="blue" style={{ flex: 1 }}
                leftSection={<IconSearch size={13} />} onClick={handleDisplay} loading={loading}>
                Display
              </Button>
              <Button size="xs" variant="light" color="gray" onClick={handleClear}
                leftSection={<IconRefresh size={13} />}>
                Clear
              </Button>
            </Group>
            <Group gap={6}>
              <Button size="xs" variant="light" color="green" style={{ flex: 1 }}
                leftSection={<IconFileSpreadsheet size={13} />} onClick={handleExportCSV}>
                Export
              </Button>
              <Button size="xs" variant="light" color="violet" style={{ flex: 1 }}
                leftSection={<IconPrinter size={13} />}
                onClick={handlePrint} loading={printing}>
                Print
              </Button>
            </Group>
            <Button size="xs" variant="light" color="red" fullWidth
              leftSection={<IconFileTypePdf size={13} />}
              onClick={handleExportPDF} loading={printing}>
              Export PDF
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* ══ RIGHT CONTENT AREA ════════════════════════════════════════════ */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top Bar ──────────────────────────────────────────────────── */}
        <Box style={{
          background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 20px',
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <Group gap={8}>
            <ThemeIcon size={32} radius="md" color="blue" variant="light">
              <IconUsers size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="md" lh={1.2} c="#1e293b">Members Register</Text>
              <Text size="xs" c="dimmed" lh={1}>
                {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
              </Text>
            </Box>
          </Group>

          <Group gap={8}>
            <TextInput size="sm" placeholder="Search by name, ID, phone…"
              leftSection={<IconSearch size={14} />}
              value={search} onChange={e => handleSearchChange(e.target.value)}
              style={{ width: 240 }} styles={{ input: { borderRadius: 8 } }}
              rightSection={search ? (
                <ActionIcon size="xs" variant="subtle"
                  onClick={() => { setSearch(''); setPage(1); }}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null} />
            <Tooltip label="Export CSV">
              <ActionIcon size="lg" variant="light" color="green" onClick={handleExportCSV} radius="md">
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Print Report">
              <ActionIcon size="lg" variant="light" color="violet" radius="md"
                onClick={handlePrint} loading={printing}>
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Export PDF">
              <ActionIcon size="lg" variant="light" color="red" radius="md"
                onClick={handleExportPDF} loading={printing}>
                <IconFileTypePdf size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh">
              <ActionIcon size="lg" variant="light" color="blue" radius="md"
                onClick={() => fetchMembers(page)}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>

        {/* ── Summary Strip ─────────────────────────────────────────────── */}
        <Box style={{ padding: '10px 20px 0', display: 'flex', gap: 12 }}>
          {[
            { label: 'Total Members', value: total, color: '#3b82f6', bg: '#eff6ff' },
            { label: 'Active', value: data.filter(d => d.status === 'Active').length, color: '#22c55e', bg: '#f0fdf4' },
            { label: 'Male', value: data.filter(d => d.personalDetails?.gender === 'Male').length, color: '#6366f1', bg: '#eef2ff' },
            { label: 'Female', value: data.filter(d => d.personalDetails?.gender === 'Female').length, color: '#ec4899', bg: '#fdf2f8' }
          ].map(s => (
            <Card key={s.label} padding="8px 14px" radius="md"
              style={{ background: s.bg, border: `1px solid ${s.color}22`, minWidth: 110 }}>
              <Text size="xs" c="dimmed" fw={500}>{s.label}</Text>
              <Text size="lg" fw={800} c={s.color} lh={1.2}>{s.value}</Text>
            </Card>
          ))}
        </Box>

        {/* ── Data Table ────────────────────────────────────────────────── */}
        <Box style={{ flex: 1, overflow: 'hidden', padding: '10px 20px 0' }}>
          <Paper radius="lg" withBorder style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
          }}>
            <ScrollArea style={{ flex: 1 }} scrollbarSize={6} type="always">
              <Table highlightOnHover verticalSpacing={0} style={{ fontSize: 12, minWidth: 1350 }}>
                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <Table.Tr>
                    {[
                      { label: '#',                 field: null },
                      { label: 'Farmer Number',     field: 'farmerNumber' },
                      { label: 'Member No',         field: 'memberId' },
                      { label: 'Name',              field: 'personalDetails.name' },
                      { label: 'House Name',        field: null },
                      { label: 'Address',           field: null },
                      { label: 'Date of Birth',     field: null },
                      { label: 'Age',               field: null },
                      { label: 'Sex',               field: 'personalDetails.gender' },
                      { label: 'Date of Admission', field: 'admissionDate' },
                      { label: 'Total Share Nos',   field: 'financialDetails.totalShares' },
                      { label: 'Total Share Value', field: null },
                      { label: 'Resolution No',     field: null },
                      { label: 'Resolution Date',   field: null },
                      { label: 'Quantity (L)',      field: null },
                      { label: 'Days',              field: null }
                    ].map(({ label, field }) => (
                      <Table.Th key={label} style={thStyle}
                        onClick={field ? () => handleSort(field) : undefined}>
                        <Group gap={4} wrap="nowrap">
                          <span>{label}</span>
                          {field && <SortIcon field={field} />}
                        </Group>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>

                <Table.Tbody>
                  {loading ? (
                    <Table.Tr>
                      <Table.Td colSpan={16}>
                        <Center py={60}>
                          <Stack align="center" gap={8}>
                            <Loader size="md" color="blue" />
                            <Text size="sm" c="dimmed">Loading members…</Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : data.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={16}>
                        <Center py={60}>
                          <Stack align="center" gap={8}>
                            <IconUsers size={36} color="#cbd5e1" />
                            <Text size="sm" c="dimmed">No members found</Text>
                            <Text size="xs" c="dimmed">Try adjusting your filters</Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  ) : data.map((f, i) => {
                    const age = calcAge(f.personalDetails?.dob);
                    const isEven = i % 2 === 0;
                    const totalShares    = f.financialDetails?.totalShares || 0;
                    const totalShareValue = totalShares * (f.financialDetails?.shareValue || 0);

                    return (
                      <Table.Tr key={f._id} style={{ background: isEven ? '#fff' : '#f8fafc' }}>

                        <Table.Td style={{ padding: '7px 10px', color: '#94a3b8', fontWeight: 500, minWidth: 36 }}>
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 100 }}>
                          <Badge size="sm" variant="light" color="blue" radius="sm"
                            style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {f.farmerNumber}
                          </Badge>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 90 }}>
                          {f.memberId
                            ? <Badge size="sm" variant="dot" color="teal" radius="sm">{f.memberId}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        {/* Name */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 130 }}>
                          <Text size="xs" fw={500} c="#1e293b">{f.personalDetails?.name || '—'}</Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 110 }}>
                          <Text size="xs" c="#374151">{f.address?.houseName || '—'}</Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 150 }}>
                          <Text size="xs" c="#374151" lineClamp={2} style={{ maxWidth: 160 }}>
                            {fmtAddress(f.address) || '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 100 }}>
                          <Text size="xs" c="#374151">
                            {f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 50 }}>
                          {age !== '-'
                            ? <Badge size="sm" variant="light"
                                color={age < 30 ? 'green' : age < 60 ? 'yellow' : 'orange'}
                                radius="xl">{age}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 70 }}>
                          {f.personalDetails?.gender
                            ? <Badge size="xs" variant="outline"
                                color={f.personalDetails.gender === 'Female' ? 'pink' : 'indigo'}
                                radius="sm">{f.personalDetails.gender}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 108 }}>
                          <Text size="xs" c="#374151">
                            {f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 90, textAlign: 'right' }}>
                          <Badge size="sm" variant="filled"
                            color={totalShares > 0 ? 'blue' : 'gray'} radius="sm">
                            {totalShares || 0}
                          </Badge>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 110, textAlign: 'right' }}>
                          <Text size="xs" fw={600} c={totalShareValue > 0 ? '#1e3a5f' : '#94a3b8'}>
                            {totalShareValue > 0 ? `₹ ${totalShareValue.toFixed(2)}` : '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 110 }}>
                          <Text size="xs" c="#374151">
                            {f.financialDetails?.resolutionNo || '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 108 }}>
                          <Text size="xs" c="#374151">
                            {f.financialDetails?.resolutionDate
                              ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY')
                              : '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 90, textAlign: 'right' }}>
                          <Text size="xs" fw={600} c={f._totalQty > 0 ? '#166534' : '#94a3b8'}>
                            {f._totalQty != null ? f._totalQty.toFixed(2) : '—'}
                          </Text>
                        </Table.Td>

                        <Table.Td style={{ padding: '7px 10px', minWidth: 60, textAlign: 'center' }}>
                          {f._pouringDays != null
                            ? <Badge size="sm" variant="light" color="cyan" radius="sm">{f._pouringDays}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {/* ── Pagination Bar ─────────────────────────────────────────── */}
            <Box style={{
              borderTop: '1px solid #e2e8f0', padding: '10px 16px', background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap'
            }}>
              <Text size="xs" c="dimmed">
                {loading ? 'Loading…' : (
                  total > 0
                    ? `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()} members`
                    : 'No records'
                )}
              </Text>
              {total > PAGE_SIZE && (
                <Pagination value={page}
                  onChange={p => { setPage(p); fetchMembers(p); }}
                  total={Math.ceil(total / PAGE_SIZE)} size="sm" radius="md" withEdges color="blue" />
              )}
              <Text size="xs" c="dimmed" style={{ textAlign: 'right' }}>
                {PAGE_SIZE} per page
              </Text>
            </Box>
          </Paper>
        </Box>

        <Box style={{ height: 12 }} />
      </Box>
    </Box>
  );
};

export default MemberRegister;
