import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Title, Text, Button, Group, Stack, TextInput, Select,
  NumberInput, Checkbox, ActionIcon, Tooltip, Divider, Badge, Collapse,
  Table, Pagination, Loader, Center, ScrollArea, Radio
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconFilter, IconDownload, IconPrinter, IconChevronDown,
  IconChevronUp, IconRefresh, IconUsers, IconX, IconFileTypeXls,
  IconChevronLeft, IconChevronRight, IconAlertCircle
} from '@tabler/icons-react';
import { farmerAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const COND_OPTIONS = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '=', label: '=' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
];

const HAS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'yes', label: 'Has' },
  { value: 'no', label: "Hasn't" },
];

const INIT_FILTERS = {
  collectionCenter: '', memberType: '', farmerNumberFrom: '', farmerNumberTo: '',
  activeOnly: false, localLanguage: false, gender: '', caste: '', farmerType: '',
  dbtHas: '', welfareHas: '', mobileHas: '', bankHas: '',
  localBody: '', ward: '',
  fromDate: null, toDate: null,
  daysCondition: '>=', daysValue: '', qtyCondition: '>=', qtyValue: '', daysQtyLogic: 'AND',
};

function SectionHeader({ label, sKey, sections, toggle, color }) {
  return (
    <Box
      onClick={() => toggle(sKey)}
      style={{
        background: color,
        borderRadius: sections[sKey] ? '6px 6px 0 0' : 6,
        padding: '6px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text fw={600} c="white" size="xs">{label}</Text>
      {sections[sKey] ? <IconChevronUp size={13} color="white" /> : <IconChevronDown size={13} color="white" />}
    </Box>
  );
}

export default function ProducerReport() {
  const { selectedCompany } = useCompany();

  const [filters, setFilters] = useState(INIT_FILTERS);
  const [centers, setCenters] = useState([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sections, setSections] = useState({ basic: true, advanced: true, localBody: true, pouring: true });
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 50 });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 500 })
      .then(res => {
        const list = res?.data || res || [];
        setCenters([{ value: '', label: 'All Centres' }, ...list.map(c => ({ value: c._id, label: c.centerName }))]);
      })
      .catch(() => {});
  }, [selectedCompany]);

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const toggleSection = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  const buildParams = useCallback(() => {
    // Always fetch all records — pagination handled client-side
    const p = { page: 1, limit: 9999 };
    if (filters.collectionCenter) p.collectionCenter = filters.collectionCenter;
    if (filters.memberType) p.memberType = filters.memberType;
    if (filters.farmerNumberFrom) p.farmerNumberFrom = filters.farmerNumberFrom;
    if (filters.farmerNumberTo) p.farmerNumberTo = filters.farmerNumberTo;
    if (filters.activeOnly) p.activeOnly = 'true';
    if (filters.gender) p.gender = filters.gender;
    if (filters.caste) p.caste = filters.caste;
    if (filters.farmerType) p.farmerType = filters.farmerType;
    if (filters.dbtHas) p.dbtHas = filters.dbtHas;
    if (filters.welfareHas) p.welfareHas = filters.welfareHas;
    if (filters.mobileHas) p.mobileHas = filters.mobileHas;
    if (filters.bankHas) p.bankHas = filters.bankHas;
    if (filters.localBody) p.localBody = filters.localBody;
    if (filters.ward) p.ward = filters.ward;
    if (filters.fromDate) p.fromDate = dayjs(filters.fromDate).format('YYYY-MM-DD');
    if (filters.toDate) p.toDate = dayjs(filters.toDate).format('YYYY-MM-DD');
    if (filters.daysCondition) p.daysCondition = filters.daysCondition;
    if (filters.daysValue !== '') p.daysValue = filters.daysValue;
    if (filters.qtyCondition) p.qtyCondition = filters.qtyCondition;
    if (filters.qtyValue !== '') p.qtyValue = filters.qtyValue;
    p.daysQtyLogic = filters.daysQtyLogic;
    return p;
  }, [filters]);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await farmerAPI.getProducerReport(buildParams());
      const rows = res?.data || [];
      setData(rows);
      setPagination({ total: rows.length, page: 1, pages: 1, limit: 9999 });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Failed to load report' });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters(INIT_FILTERS);
    setData([]);
    setSearched(false);
    setSearch('');
  };

  const filteredData = search
    ? data.filter(r => {
        const s = search.toLowerCase();
        return (r.farmerNumber || '').toLowerCase().includes(s) ||
               (r.personalDetails?.name || '').toLowerCase().includes(s) ||
               (r.memberId || '').toLowerCase().includes(s) ||
               (r.address?.place || '').toLowerCase().includes(s);
      })
    : data;

  // Whether pouring data (Days / Qty) was returned for this fetch
  const hasPouringCols = data.some(r => r._pouringDays != null || r._totalQty != null);

  const handleExport = () => {
    if (!data.length) return notifications.show({ message: 'No data to export', color: 'yellow' });

    const rows = data.map((r, i) => {
      const row = {
        'Sr.':                 i + 1,
        'Status':              r.status || 'Active',
        'Pro No':              r.farmerNumber || '',
        'Mem No':              r.memberId || '',
        'Name':                r.personalDetails?.name || '',
        'Father/Husband Name': r.personalDetails?.fatherName || '',
        'House Name':          r.address?.houseName || '',
        'Post':                r.address?.post || '',
        'Place':               r.address?.place || '',
        'Panchayat':           r.address?.panchayat || '',
        'Ward':                r.address?.ward || '',
        'Sex':                 r.personalDetails?.gender || '',
        'Mobile No':           r.personalDetails?.phone || '',
        'DBT Enroll No':       r.identityDetails?.ksheerasreeId || '',
        'Collection Centre':   r._center?.centerName || '',
      };
      if (hasPouringCols) {
        row['Pouring Days']   = r._pouringDays ?? '';
        row['Total Qty (L)']  = r._totalQty != null ? Number(r._totalQty).toFixed(2) : '';
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto column widths
    const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 12) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producer Report');
    XLSX.writeFile(wb, `producer_report_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Excel file downloaded successfully', color: 'green' });
  };

  const handlePrint = () => {
    if (!data.length) return notifications.show({ message: 'No data to print', color: 'yellow' });

    const companyName = selectedCompany?.companyName || selectedCompany?.name || 'Dairy Cooperative Society';
    const today = dayjs().format('DD/MM/YYYY HH:mm');
    const dateRange = filters.fromDate && filters.toDate
      ? `${dayjs(filters.fromDate).format('DD/MM/YYYY')} – ${dayjs(filters.toDate).format('DD/MM/YYYY')}`
      : '';

    const extraCols = hasPouringCols ? '<th>Days</th><th>Qty (L)</th>' : '';

    const rows = filteredData.map((r, i) => {
      const extra = hasPouringCols
        ? `<td style="text-align:center">${r._pouringDays ?? '—'}</td>
           <td style="text-align:right">${r._totalQty != null ? Number(r._totalQty).toFixed(2) : '—'}</td>`
        : '';
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="color:${r.status === 'Active' ? '#166534' : '#991b1b'};font-weight:700">${r.status || 'Active'}</td>
        <td>${r.farmerNumber || '—'}</td>
        <td>${r.memberId || '—'}</td>
        <td>${r.personalDetails?.name || '—'}</td>
        <td>${r.personalDetails?.fatherName || '—'}</td>
        <td>${r.address?.houseName || '—'}</td>
        <td>${r.address?.post || '—'}</td>
        <td>${r.address?.place || '—'}</td>
        <td>${r.personalDetails?.gender || '—'}</td>
        <td>${r.personalDetails?.phone || '—'}</td>
        <td>${r.identityDetails?.ksheerasreeId || '—'}</td>
        ${extra}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Producer Report</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 8px; color: #111;
             -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .hdr { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
      .hdr h1 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
      .hdr h2 { font-size: 10px; font-weight: 600; margin-top: 3px; letter-spacing: 2px; text-transform: uppercase; }
      .hdr p  { font-size: 8px; color: #555; margin-top: 3px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a237e; color: #fff; padding: 3px 4px; font-size: 7.5px;
           text-align: left; border: 0.5pt solid #666; text-transform: uppercase; }
      td { padding: 2.5px 4px; border: 0.5pt solid #ccc; font-size: 8px; }
      tr:nth-child(even) td { background: #f5f7ff; }
    </style>
    </head><body>
    <div class="hdr">
      <h1>${companyName}</h1>
      <h2>Producer Report</h2>
      ${dateRange ? `<p>Period: ${dateRange}</p>` : ''}
      <p>Total: ${filteredData.length} producers &nbsp;|&nbsp; Printed: ${today}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Sr.</th><th>Status</th><th>Pro No</th><th>Mem No</th><th>Name</th>
          <th>Father/Husband</th><th>House Name</th><th>Post</th><th>Place</th>
          <th>Sex</th><th>Mobile</th><th>DBT No</th>
          ${extraCols}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up blocked — please allow pop-ups and try again.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const inputSz = 'xs';

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#f0f2f8' }}>

      {/* ===== LEFT FILTER PANEL ===== */}
      {panelOpen && (
        <Box style={{
          width: 288, minWidth: 288, display: 'flex', flexDirection: 'column',
          background: '#fff', borderRight: '1px solid #dde1ef', boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        }}>
          {/* Panel header */}
          <Box style={{
            background: 'linear-gradient(135deg,#1565c0,#1a237e)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Group gap={6}>
              <IconFilter size={15} color="white" />
              <Text fw={700} c="white" size="sm">Filter Producers</Text>
            </Group>
            <ActionIcon variant="transparent" c="white" size="sm" onClick={() => setPanelOpen(false)}>
              <IconChevronLeft size={15} />
            </ActionIcon>
          </Box>

          {/* Scrollable filter sections */}
          <Box style={{ flex: 1, overflowY: 'auto', padding: 8 }}>

            {/* ── Section 1: Collection Center ── */}
            <Paper withBorder mb={8} style={{ borderRadius: 6, overflow: 'hidden' }}>
              <SectionHeader label="Collection Center" sKey="basic" sections={sections} toggle={toggleSection} color="#1565c0" />
              <Collapse in={sections.basic}>
                <Stack gap={7} p={10}>
                  <Select
                    label="Collection Centre"
                    data={centers}
                    value={filters.collectionCenter}
                    onChange={v => setFilter('collectionCenter', v || '')}
                    clearable size={inputSz}
                  />
                  <Select
                    label="Member Type"
                    data={[{ value: '', label: 'All' }, { value: 'Member', label: 'Member' }, { value: 'NonMember', label: 'Non-Member' }]}
                    value={filters.memberType}
                    onChange={v => setFilter('memberType', v || '')}
                    clearable size={inputSz}
                  />
                  <Group gap={6} grow>
                    <TextInput
                      label="Pro No From"
                      placeholder="1"
                      value={filters.farmerNumberFrom}
                      onChange={e => setFilter('farmerNumberFrom', e.currentTarget.value)}
                      size={inputSz}
                    />
                    <TextInput
                      label="Pro No To"
                      placeholder="9999"
                      value={filters.farmerNumberTo}
                      onChange={e => setFilter('farmerNumberTo', e.currentTarget.value)}
                      size={inputSz}
                    />
                  </Group>
                  <Group gap={20} mt={2}>
                    <Checkbox
                      label="Active Only"
                      checked={filters.activeOnly}
                      onChange={e => setFilter('activeOnly', e.currentTarget.checked)}
                      size={inputSz}
                    />
                    <Checkbox
                      label="Local Language"
                      checked={filters.localLanguage}
                      onChange={e => setFilter('localLanguage', e.currentTarget.checked)}
                      size={inputSz}
                    />
                  </Group>
                </Stack>
              </Collapse>
            </Paper>

            {/* ── Section 2: Advanced Filter ── */}
            <Paper withBorder mb={8} style={{ borderRadius: 6, overflow: 'hidden' }}>
              <SectionHeader label="Advanced Filter" sKey="advanced" sections={sections} toggle={toggleSection} color="#2e7d32" />
              <Collapse in={sections.advanced}>
                <Stack gap={7} p={10}>
                  <Select
                    label="Sex"
                    data={[{ value: '', label: 'All' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]}
                    value={filters.gender}
                    onChange={v => setFilter('gender', v || '')}
                    clearable size={inputSz}
                  />
                  <Select
                    label="Caste"
                    data={[{ value: '', label: 'All' }, { value: 'OC', label: 'OC' }, { value: 'OBC', label: 'OBC' }, { value: 'SC', label: 'SC' }, { value: 'ST', label: 'ST' }]}
                    value={filters.caste}
                    onChange={v => setFilter('caste', v || '')}
                    clearable size={inputSz}
                  />
                  <Select
                    label="Category"
                    data={[{ value: '', label: 'All' }, { value: 'Regular', label: 'Regular' }, { value: 'Seasonal', label: 'Seasonal' }]}
                    value={filters.farmerType}
                    onChange={v => setFilter('farmerType', v || '')}
                    clearable size={inputSz}
                  />
                  <Select label="DBT (Ksheerasree)" data={HAS_OPTIONS} value={filters.dbtHas} onChange={v => setFilter('dbtHas', v || '')} size={inputSz} />
                  <Select label="Welfare Fund" data={HAS_OPTIONS} value={filters.welfareHas} onChange={v => setFilter('welfareHas', v || '')} size={inputSz} />
                  <Select label="Mobile Number" data={HAS_OPTIONS} value={filters.mobileHas} onChange={v => setFilter('mobileHas', v || '')} size={inputSz} />
                  <Select label="Bank A/C" data={HAS_OPTIONS} value={filters.bankHas} onChange={v => setFilter('bankHas', v || '')} size={inputSz} />
                </Stack>
              </Collapse>
            </Paper>

            {/* ── Section 3: Local Body & Wards ── */}
            <Paper withBorder mb={8} style={{ borderRadius: 6, overflow: 'hidden' }}>
              <SectionHeader label="Local Body & Wards" sKey="localBody" sections={sections} toggle={toggleSection} color="#2e7d32" />
              <Collapse in={sections.localBody}>
                <Stack gap={7} p={10}>
                  <TextInput
                    label="Local Body / Panchayat"
                    placeholder="Search panchayat..."
                    value={filters.localBody}
                    onChange={e => setFilter('localBody', e.currentTarget.value)}
                    size={inputSz}
                  />
                  <TextInput
                    label="Ward"
                    placeholder="Ward name or number"
                    value={filters.ward}
                    onChange={e => setFilter('ward', e.currentTarget.value)}
                    size={inputSz}
                  />
                </Stack>
              </Collapse>
            </Paper>

            {/* ── Section 4: Pouring Days & Quantity ── */}
            <Paper withBorder mb={8} style={{ borderRadius: 6, overflow: 'hidden' }}>
              <SectionHeader label="Pouring Days & Quantity" sKey="pouring" sections={sections} toggle={toggleSection} color="#c62828" />
              <Collapse in={sections.pouring}>
                <Stack gap={7} p={10}>
                  <Group gap={6} grow>
                    <DatePickerInput
                      label="From Date"
                      placeholder="DD/MM/YYYY"
                      value={filters.fromDate}
                      onChange={v => setFilter('fromDate', v)}
                      valueFormat="DD/MM/YYYY"
                      size={inputSz}
                      clearable
                    />
                    <DatePickerInput
                      label="To Date"
                      placeholder="DD/MM/YYYY"
                      value={filters.toDate}
                      onChange={v => setFilter('toDate', v)}
                      valueFormat="DD/MM/YYYY"
                      size={inputSz}
                      clearable
                    />
                  </Group>

                  <Divider label="Pouring Days" labelPosition="center" my={2} styles={{ label: { fontSize: 10, color: '#888' } }} />
                  <Group gap={6} align="flex-end">
                    <Select
                      label="Condition"
                      data={COND_OPTIONS}
                      value={filters.daysCondition}
                      onChange={v => setFilter('daysCondition', v || '')}
                      clearable size={inputSz}
                      style={{ flex: 1 }}
                    />
                    <NumberInput
                      label="Days"
                      placeholder="0"
                      value={filters.daysValue}
                      onChange={v => setFilter('daysValue', v)}
                      min={0}
                      size={inputSz}
                      style={{ flex: 1 }}
                    />
                  </Group>

                  <Divider label="Quantity (Litres)" labelPosition="center" my={2} styles={{ label: { fontSize: 10, color: '#888' } }} />
                  <Group gap={6} align="flex-end">
                    <Select
                      label="Condition"
                      data={COND_OPTIONS}
                      value={filters.qtyCondition}
                      onChange={v => setFilter('qtyCondition', v || '')}
                      clearable size={inputSz}
                      style={{ flex: 1 }}
                    />
                    <NumberInput
                      label="Qty (L)"
                      placeholder="0"
                      value={filters.qtyValue}
                      onChange={v => setFilter('qtyValue', v)}
                      min={0}
                      size={inputSz}
                      style={{ flex: 1 }}
                    />
                  </Group>

                  <Radio.Group value={filters.daysQtyLogic} onChange={v => setFilter('daysQtyLogic', v)} label={<Text size="xs" c="dimmed">Days &amp; Qty Logic</Text>}>
                    <Group mt={4} gap={16}>
                      <Radio value="AND" label="AND" size="xs" />
                      <Radio value="OR" label="OR" size="xs" />
                    </Group>
                  </Radio.Group>
                </Stack>
              </Collapse>
            </Paper>
          </Box>

          {/* Action buttons */}
          <Box style={{ borderTop: '1px solid #e8eaf0', padding: '10px 12px', background: '#fafafa' }}>
            <Stack gap={6}>
              <Button fullWidth leftSection={<IconSearch size={14} />} onClick={() => handleSearch()} loading={loading} size="sm">
                Generate Report
              </Button>
              <Button fullWidth variant="light" color="gray" leftSection={<IconRefresh size={14} />} onClick={handleReset} size="sm">
                Reset Filters
              </Button>
            </Stack>
          </Box>
        </Box>
      )}

      {/* ===== RIGHT CONTENT AREA ===== */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Toolbar */}
        <Box style={{ background: '#fff', borderBottom: '1px solid #dde1ef', padding: '8px 16px', flexShrink: 0 }}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap={8} wrap="nowrap">
              {!panelOpen && (
                <Tooltip label="Show Filters">
                  <ActionIcon variant="subtle" onClick={() => setPanelOpen(true)}>
                    <IconChevronRight size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <IconUsers size={20} color="#1565c0" />
              <Title order={5} c="#1a237e" style={{ whiteSpace: 'nowrap' }}>Producer Report</Title>
              {searched && (
                <Badge color="blue" variant="light" size="sm">{pagination.total} producers</Badge>
              )}
            </Group>
            <Group gap={8} wrap="nowrap">
              <TextInput
                placeholder="Search name, pro no, place..."
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={13} />}
                rightSection={search ? (
                  <ActionIcon size="xs" variant="transparent" onClick={() => setSearch('')}>
                    <IconX size={11} />
                  </ActionIcon>
                ) : null}
                size="xs"
                style={{ width: 220 }}
              />
              <Tooltip label="Export to Excel">
                <ActionIcon variant="light" color="green" onClick={handleExport} disabled={!data.length} size="md">
                  <IconFileTypeXls size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Print">
                <ActionIcon variant="light" color="blue" onClick={handlePrint} disabled={!data.length} size="md">
                  <IconPrinter size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>

        {/* Table area */}
        <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Center style={{ flex: 1 }}>
              <Stack align="center" gap={10}>
                <Loader size="lg" />
                <Text size="sm" c="dimmed">Loading producers...</Text>
              </Stack>
            </Center>
          ) : !searched ? (
            <Center style={{ flex: 1 }}>
              <Stack align="center" gap={10}>
                <IconUsers size={56} color="#c5cae9" />
                <Text c="dimmed" size="sm">Set filters and click "Generate Report"</Text>
                <Text c="dimmed" size="xs">Use the left panel to apply filters</Text>
              </Stack>
            </Center>
          ) : filteredData.length === 0 ? (
            <Center style={{ flex: 1 }}>
              <Stack align="center" gap={10}>
                <IconAlertCircle size={48} color="#ef9a9a" />
                <Text c="dimmed" size="sm">No producers found matching the criteria</Text>
                <Button variant="subtle" size="xs" onClick={handleReset} leftSection={<IconRefresh size={13} />}>
                  Reset Filters
                </Button>
              </Stack>
            </Center>
          ) : (
            <ScrollArea style={{ flex: 1 }}>
              <Table
                id="producer-print-table"
                striped
                highlightOnHover
                withColumnBorders
                withTableBorder
                style={{ fontSize: 12 }}
              >
                <Table.Thead>
                  <Table.Tr style={{ background: '#1a237e' }}>
                    <Table.Th style={{ color: '#fff', width: 44, textAlign: 'center', padding: '8px 6px' }}>Sr.</Table.Th>
                    <Table.Th style={{ color: '#fff', width: 80, padding: '8px 10px' }}>Status</Table.Th>
                    <Table.Th style={{ color: '#fff', padding: '8px 10px' }}>Pro No</Table.Th>
                    <Table.Th style={{ color: '#fff', padding: '8px 10px' }}>Mem No</Table.Th>
                    <Table.Th style={{ color: '#fff', minWidth: 150, padding: '8px 10px' }}>Name</Table.Th>
                    <Table.Th style={{ color: '#fff', minWidth: 140, padding: '8px 10px' }}>Father/Husband Name</Table.Th>
                    <Table.Th style={{ color: '#fff', minWidth: 120, padding: '8px 10px' }}>House Name</Table.Th>
                    <Table.Th style={{ color: '#fff', padding: '8px 10px' }}>Post</Table.Th>
                    <Table.Th style={{ color: '#fff', padding: '8px 10px' }}>Place</Table.Th>
                    <Table.Th style={{ color: '#fff', padding: '8px 10px' }}>Sex</Table.Th>
                    <Table.Th style={{ color: '#fff', minWidth: 110, padding: '8px 10px' }}>Mobile No</Table.Th>
                    <Table.Th style={{ color: '#fff', minWidth: 130, padding: '8px 10px' }}>DBT Enroll No</Table.Th>
                    {hasPouringCols && <>
                      <Table.Th style={{ color: '#fff', width: 70, textAlign: 'right', padding: '8px 10px' }}>Days</Table.Th>
                      <Table.Th style={{ color: '#fff', width: 90, textAlign: 'right', padding: '8px 10px' }}>Qty (L)</Table.Th>
                    </>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredData.map((r, i) => (
                    <Table.Tr key={r._id || i}>
                      <Table.Td ta="center" c="dimmed" style={{ padding: '6px', fontSize: 11 }}>{i + 1}</Table.Td>
                      <Table.Td style={{ padding: '6px 8px' }}>
                        <Badge size="xs" color={r.status === 'Active' ? 'teal' : 'red'} variant="light" radius="sm">
                          {r.status || 'Active'}
                        </Badge>
                      </Table.Td>
                      <Table.Td fw={600} c="blue.7" style={{ padding: '6px 10px' }}>{r.farmerNumber || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.memberId || '-'}</Table.Td>
                      <Table.Td fw={500} style={{ padding: '6px 10px' }}>{r.personalDetails?.name || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.personalDetails?.fatherName || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.address?.houseName || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.address?.post || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.address?.place || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.personalDetails?.gender || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.personalDetails?.phone || '-'}</Table.Td>
                      <Table.Td style={{ padding: '6px 10px' }}>{r.identityDetails?.ksheerasreeId || '-'}</Table.Td>
                      {hasPouringCols && <>
                        <Table.Td ta="right" fw={600} c="cyan.8" style={{ padding: '6px 10px' }}>
                          {r._pouringDays ?? '—'}
                        </Table.Td>
                        <Table.Td ta="right" fw={600} c="green.8" style={{ padding: '6px 10px' }}>
                          {r._totalQty != null ? Number(r._totalQty).toFixed(2) : '—'}
                        </Table.Td>
                      </>}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Box>

        {/* Pagination footer */}
        {searched && data.length > 0 && (
          <Box style={{
            background: '#fff', borderTop: '1px solid #dde1ef',
            padding: '8px 16px', flexShrink: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <Text size="xs" c="dimmed">
              Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} producers
            </Text>
            {pagination.pages > 1 && (
              <Pagination
                value={pagination.page}
                onChange={handlePageChange}
                total={pagination.pages}
                size="sm"
                siblings={1}
                boundaries={1}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
