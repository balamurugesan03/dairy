import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box, Paper, Title, Text, Button, Radio, Group, Stack,
  Slider, TextInput, Badge, Tooltip, Drawer, SimpleGrid,
  Card, ThemeIcon, Divider, ScrollArea, Table, LoadingOverlay,
  ActionIcon, Flex, rem
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DataTable } from 'mantine-datatable';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconFileTypePdf, IconFileTypeXls, IconPrinter,
  IconDroplet, IconFlame, IconScale, IconUserX, IconUserPlus,
  IconBuildingStore, IconMilk, IconActivity, IconX, IconEye,
  IconCurrencyRupee, IconChartBar
} from '@tabler/icons-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title as CTitle, Tooltip as CTooltip, Legend, Filler
} from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { intelligentQueryAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, CTitle, CTooltip, Legend, Filler);

const PAGE_SIZE = 50;

const REPORT_OPTIONS = [
  { value: 'abnormalQty',        label: 'Abnormal Qty',         Icon: IconDroplet,      color: 'orange' },
  { value: 'abnormalFat',        label: 'Abnormal FAT',         Icon: IconFlame,        color: 'red'    },
  { value: 'abnormalSnf',        label: 'Abnormal SNF',         Icon: IconScale,        color: 'violet' },
  { value: 'missingProducers',   label: 'Missing Producers',    Icon: IconUserX,        color: 'gray'   },
  { value: 'newComers',          label: 'New Comers',           Icon: IconUserPlus,     color: 'green'  },
  { value: 'pouringOtherCenter', label: 'Pouring Other Center', Icon: IconBuildingStore, color: 'blue'  },
];
const REPORT_MAP = Object.fromEntries(REPORT_OPTIONS.map(o => [o.value, o]));

// ── Small analytics card ──────────────────────────────────────────────────────
const AnalyticCard = ({ label, value, color, Icon }) => (
  <Card withBorder p="sm" radius="md">
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon size={36} variant="light" color={color} radius="md">
        <Icon size={18} />
      </ThemeIcon>
      <Box>
        <Text size="xs" c="dimmed" fw={500}>{label}</Text>
        <Text fw={800} size="md" lh={1.2}>{value}</Text>
      </Box>
    </Group>
  </Card>
);

// ── Main component ────────────────────────────────────────────────────────────
const IntelligentQuery = () => {
  const { selectedCompany } = useCompany();

  // Filter state
  const [date,        setDate]        = useState(new Date());
  const [shift,       setShift]       = useState('AM');
  const [pouringDays, setPouringDays] = useState(20);
  const [reportType,  setReportType]  = useState('abnormalQty');

  // Report data
  const [records,       setRecords]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [hasLoaded,     setHasLoaded]     = useState(false);
  const [activeFilters, setActiveFilters] = useState(null); // filters used for current data

  // Table state
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [sortStatus, setSortStatus] = useState({ columnAccessor: 'farmerNumber', direction: 'asc' });

  // Drawer state
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [producerDetail, setProducerDetail] = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!date) return notifications.show({ color: 'red', message: 'Please select a date' });
    setLoading(true);
    setSearch('');
    setPage(1);
    try {
      const filters = {
        date:        dayjs(date).format('YYYY-MM-DD'),
        shift,
        pouringDays,
        reportType,
      };
      const res = await intelligentQueryAPI.getReport(filters);
      setRecords(res?.data || []);
      setActiveFilters(filters);
      setHasLoaded(true);
    } catch {
      notifications.show({ color: 'red', message: 'Failed to fetch report data' });
    } finally {
      setLoading(false);
    }
  }, [date, shift, pouringDays, reportType]);

  // ── Filtered & sorted records ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = records;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.farmerNumber?.toLowerCase().includes(q) ||
        r.farmerName?.toLowerCase().includes(q) ||
        r.memberId?.toLowerCase().includes(q) ||
        r.houseName?.toLowerCase().includes(q) ||
        r.center?.toLowerCase().includes(q) ||
        r.agent?.toLowerCase().includes(q)
      );
    }
    const { columnAccessor: col, direction } = sortStatus;
    if (col) {
      list = [...list].sort((a, b) => {
        const av = a[col] ?? '', bv = b[col] ?? '';
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return direction === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [records, search, sortStatus]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const activeType = activeFilters?.reportType || reportType;

  // ── Column definitions (dynamic by report type) ─────────────────────────────
  const columns = useMemo(() => {
    const cols = [
      { accessor: 'farmerNumber', title: 'Producer ID',    sortable: true, width: 105 },
      { accessor: 'memberId',     title: 'Member No',      sortable: true, width: 95  },
      { accessor: 'farmerName',   title: 'Producer Name',  sortable: true             },
      { accessor: 'houseName',    title: 'House Name',     sortable: true             },
      {
        accessor: 'shift', title: 'Shift', width: 68, sortable: true,
        render: r => (
          <Badge size="sm" variant="light" color={r.shift === 'AM' ? 'blue' : 'orange'}>
            {r.shift}
          </Badge>
        )
      },
      {
        accessor: 'qty', title: 'Qty (L)', sortable: true, width: 78, textAlign: 'right',
        render: r => <Text size="sm" fw={600}>{r.qty?.toFixed(2)}</Text>
      },
      { accessor: 'clr', title: 'CLR', sortable: true, width: 58, textAlign: 'right', render: r => r.clr?.toFixed(1)  },
      { accessor: 'fat', title: 'FAT', sortable: true, width: 58, textAlign: 'right', render: r => r.fat?.toFixed(1)  },
      { accessor: 'snf', title: 'SNF', sortable: true, width: 62, textAlign: 'right', render: r => r.snf?.toFixed(2)  },
      { accessor: 'rate', title: 'Rate', sortable: true, width: 65, textAlign: 'right', render: r => r.rate?.toFixed(2) },
      { accessor: 'center', title: 'Center', sortable: true },
      { accessor: 'agent',  title: 'Agent',  sortable: true },
    ];

    if (activeType === 'abnormalQty') {
      cols.push(
        { accessor: 'avgQty', title: 'Avg Qty', sortable: true, width: 80, textAlign: 'right',
          render: r => r.avgQty != null ? r.avgQty.toFixed(2) : '—' },
        {
          accessor: 'qtyDev', title: 'Deviation', sortable: true, width: 95,
          render: r => r.qtyDev != null ? (
            <Badge size="sm" variant="light" color={r.qtyDev > 0 ? 'teal' : 'red'}>
              {r.qtyDev > 0 ? '+' : ''}{r.qtyDev.toFixed(2)} L
            </Badge>
          ) : '—'
        },
        { accessor: 'pouringCount', title: 'Days', sortable: true, width: 58, textAlign: 'right' }
      );
    }

    if (activeType === 'abnormalFat') {
      cols.push(
        { accessor: 'avgFat', title: 'Avg FAT', sortable: true, width: 80, textAlign: 'right',
          render: r => r.avgFat != null ? r.avgFat.toFixed(2) : '—' },
        {
          accessor: 'fatDev', title: 'Deviation', sortable: true, width: 95,
          render: r => r.fatDev != null ? (
            <Badge size="sm" variant="light" color={r.fatDev > 0 ? 'teal' : 'red'}>
              {r.fatDev > 0 ? '+' : ''}{r.fatDev.toFixed(2)}%
            </Badge>
          ) : '—'
        },
        { accessor: 'pouringCount', title: 'Days', sortable: true, width: 58, textAlign: 'right' }
      );
    }

    if (activeType === 'abnormalSnf') {
      cols.push(
        { accessor: 'avgSnf', title: 'Avg SNF', sortable: true, width: 80, textAlign: 'right',
          render: r => r.avgSnf != null ? r.avgSnf.toFixed(2) : '—' },
        {
          accessor: 'snfDev', title: 'Deviation', sortable: true, width: 95,
          render: r => r.snfDev != null ? (
            <Badge size="sm" variant="light" color={r.snfDev > 0 ? 'teal' : 'red'}>
              {r.snfDev > 0 ? '+' : ''}{r.snfDev.toFixed(2)}%
            </Badge>
          ) : '—'
        },
        { accessor: 'pouringCount', title: 'Days', sortable: true, width: 58, textAlign: 'right' }
      );
    }

    if (activeType === 'missingProducers') {
      cols.push(
        {
          accessor: 'lastPouringDate', title: 'Last Poured', sortable: true, width: 108,
          render: r => r.lastPouringDate ? dayjs(r.lastPouringDate).format('DD-MM-YYYY') : '—'
        },
        { accessor: 'avgQty',       title: 'Avg Qty', sortable: true, width: 80, textAlign: 'right',
          render: r => r.avgQty != null ? r.avgQty.toFixed(2) : '—' },
        { accessor: 'pouringCount', title: 'Days',    sortable: true, width: 58, textAlign: 'right' }
      );
    }

    if (activeType === 'pouringOtherCenter') {
      cols.push(
        { accessor: 'usualCenter', title: 'Usual Center', sortable: true }
      );
    }

    cols.push({
      accessor: '_action', title: '', width: 36, textAlign: 'center',
      render: r => (
        <Tooltip label="View details" withArrow position="left">
          <ActionIcon
            size="sm" variant="subtle" color="blue"
            onClick={(e) => { e.stopPropagation(); openProducerDetail(r); }}
          >
            <IconEye size={14} />
          </ActionIcon>
        </Tooltip>
      )
    });

    return cols;
  }, [activeType]);

  // ── Producer detail drawer ──────────────────────────────────────────────────
  const openProducerDetail = useCallback(async (record) => {
    setDrawerOpen(true);
    setProducerDetail(null);
    setDetailLoading(true);
    try {
      const res = await intelligentQueryAPI.getProducerDetail(record.farmerNumber);
      setProducerDetail(res?.data || null);
    } catch {
      notifications.show({ color: 'red', message: 'Failed to load producer details' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const hist = producerDetail?.history;
    if (!hist?.length) return null;
    const rev = [...hist].reverse();
    return {
      labels: rev.map(h => dayjs(h.date).format('DD MMM') + ' ' + h.shift),
      datasets: [
        {
          label: 'Qty (L)',
          data: rev.map(h => h.qty),
          borderColor: '#1971c2',
          backgroundColor: 'rgba(25,113,194,0.08)',
          fill: true, tension: 0.35, pointRadius: 3,
        },
        {
          label: 'FAT %',
          data: rev.map(h => h.fat),
          borderColor: '#e03131',
          backgroundColor: 'transparent',
          tension: 0.35, pointRadius: 3,
        },
        {
          label: 'SNF %',
          data: rev.map(h => h.snf),
          borderColor: '#2f9e44',
          backgroundColor: 'transparent',
          tension: 0.35, pointRadius: 3,
        }
      ]
    };
  }, [producerDetail]);

  // ── PDF Export ──────────────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!filtered.length) return;
    const opt    = REPORT_MAP[activeType];
    const title  = `${opt?.label || activeType} — Based on Last ${activeFilters?.pouringDays ?? pouringDays} Days`;
    const sub    = `Date: ${activeFilters ? dayjs(activeFilters.date).format('DD-MM-YYYY') : ''}  |  Shift: ${activeFilters?.shift}  |  ${filtered.length} records`;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw  = doc.internal.pageSize.width;

    doc.setFontSize(13); doc.setTextColor(26, 60, 110); doc.setFont(undefined, 'bold');
    doc.text(title, pw / 2, 12, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(80); doc.setFont(undefined, 'normal');
    doc.text(sub, pw / 2, 18, { align: 'center' });

    const head = ['ID', 'Member', 'Name', 'House', 'Shift', 'Qty', 'CLR', 'FAT', 'SNF', 'Rate', 'Center', 'Agent'];
    const body = filtered.map(r => [
      r.farmerNumber, r.memberId, r.farmerName, r.houseName, r.shift,
      r.qty?.toFixed(2), r.clr?.toFixed(1), r.fat?.toFixed(1),
      r.snf?.toFixed(2), r.rate?.toFixed(2), r.center, r.agent
    ]);

    autoTable(doc, {
      startY: 22,
      head: [head],
      body,
      styles:         { fontSize: 7, cellPadding: 1.8 },
      headStyles:     { fillColor: [26, 60, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 248, 255] },
    });

    doc.save(`IQ_${activeType}_${activeFilters?.date || 'report'}.pdf`);
    notifications.show({ message: 'PDF exported', color: 'green' });
  };

  // ── Excel Export ────────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!filtered.length) return;
    const opt   = REPORT_MAP[activeType];
    const rows = [
      [`${opt?.label} — Based on Last ${activeFilters?.pouringDays} Days`],
      [`Date: ${activeFilters?.date}  Shift: ${activeFilters?.shift}  Total: ${filtered.length}`],
      [],
      ['Producer ID', 'Member No', 'Name', 'House Name', 'Shift', 'Qty', 'CLR', 'FAT', 'SNF', 'Rate', 'Amount', 'Center', 'Agent'],
      ...filtered.map(r => [
        r.farmerNumber, r.memberId, r.farmerName, r.houseName, r.shift,
        r.qty, r.clr, r.fat, r.snf, r.rate, r.amount, r.center, r.agent
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 6 },
      { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Intelligent Query');
    XLSX.writeFile(wb, `IQ_${activeType}_${activeFilters?.date || 'report'}.xlsx`);
    notifications.show({ message: 'Excel exported', color: 'green' });
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!filtered.length) return;
    const opt   = REPORT_MAP[activeType];
    const title = `${opt?.label} — Based on Last ${activeFilters?.pouringDays} Days`;
    const rows  = filtered.map(r => `
      <tr>
        <td>${r.farmerNumber}</td><td>${r.memberId}</td><td>${r.farmerName}</td>
        <td>${r.houseName}</td><td>${r.shift}</td>
        <td>${r.qty?.toFixed(2)}</td><td>${r.clr?.toFixed(1)}</td>
        <td>${r.fat?.toFixed(1)}</td><td>${r.snf?.toFixed(2)}</td>
        <td>${r.rate?.toFixed(2)}</td><td>${r.center}</td><td>${r.agent}</td>
      </tr>`).join('');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:16px}
        h2{color:#1a3c6e;margin-bottom:4px;font-size:14px}
        p{color:#555;margin:0 0 10px;font-size:9px}
        table{width:100%;border-collapse:collapse}
        th{background:#1a3c6e;color:white;padding:4px 6px;text-align:left;font-size:9px}
        td{padding:3px 6px;border-bottom:1px solid #eee;font-size:9px}
        tr:nth-child(even){background:#f5f8ff}
      </style></head><body>
      <h2>${title}</h2>
      <p>Date: ${activeFilters?.date} | Shift: ${activeFilters?.shift} | Total: ${filtered.length} records</p>
      <table><thead><tr>
        <th>Producer ID</th><th>Member No</th><th>Name</th><th>House</th>
        <th>Shift</th><th>Qty</th><th>CLR</th><th>FAT</th><th>SNF</th>
        <th>Rate</th><th>Center</th><th>Agent</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`);
    w.document.close();
  };

  const currentOpt = REPORT_MAP[reportType];
  const activeOpt  = REPORT_MAP[activeType];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Flex style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#f3f6fb' }}>

      {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
      <Paper
        w={272}
        style={{
          flexShrink: 0,
          overflowY: 'auto',
          borderRadius: 0,
          borderRight: '1px solid #dde3ec',
          display: 'flex',
          flexDirection: 'column',
        }}
        p="md"
      >
        {/* Header */}
        <Group gap="sm" mb="md" pb="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Box
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #1971c2, #0ea5e9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconActivity size={22} color="white" />
          </Box>
          <Box>
            <Title order={5} lh={1.1} c="blue.8">Intelligent</Title>
            <Title order={5} lh={1.1} c="blue.5">Query</Title>
          </Box>
        </Group>

        {/* Collection Date */}
        <Text size="11px" fw={700} c="dimmed" tt="uppercase" mb={4} ls="0.6px">
          Collection Date
        </Text>
        <DatePickerInput
          value={date}
          onChange={setDate}
          maxDate={new Date()}
          size="sm"
          mb="sm"
          placeholder="Pick date"
          valueFormat="DD MMM YYYY"
        />

        {/* Time Shift */}
        <Text size="11px" fw={700} c="dimmed" tt="uppercase" mb={6} ls="0.6px">
          Time Shift
        </Text>
        <Radio.Group value={shift} onChange={setShift} mb="sm">
          <Stack gap={5}>
            <Radio value="AM" label="Morning (AM)" size="sm" />
            <Radio value="PM" label="Evening (PM)" size="sm" />
          </Stack>
        </Radio.Group>

        {/* Pouring Days */}
        <Text size="11px" fw={700} c="dimmed" tt="uppercase" mb={8} ls="0.6px">
          Pouring Days
        </Text>
        <Box px={4} mb={4}>
          <Slider
            min={1} max={30}
            value={pouringDays}
            onChange={setPouringDays}
            size="sm"
            color="blue"
            marks={[
              { value: 1,  label: '1' },
              { value: 10, label: '10' },
              { value: 20, label: '20' },
              { value: 30, label: '30' },
            ]}
          />
        </Box>
        <Text size="xs" ta="center" c="blue.7" fw={700} mb="md" mt={16}>
          {pouringDays} {pouringDays === 1 ? 'day' : 'days'} selected
        </Text>

        {/* Preview Button */}
        <Button
          fullWidth
          color="green"
          leftSection={<IconSearch size={15} />}
          onClick={fetchReport}
          loading={loading}
          mb="lg"
          size="sm"
          radius="md"
        >
          Preview Report
        </Button>

        <Divider mb="sm" />

        {/* Report Type Selection */}
        <Text size="11px" fw={700} c="dimmed" tt="uppercase" mb={8} ls="0.6px">
          Select Report
        </Text>
        <Stack gap={5} style={{ flex: 1 }}>
          {REPORT_OPTIONS.map(({ value, label, Icon, color }) => {
            const sel = reportType === value;
            return (
              <Paper
                key={value}
                p={8}
                radius="md"
                withBorder
                style={{
                  cursor: 'pointer',
                  borderColor: sel ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-gray-2)',
                  background:  sel ? 'var(--mantine-color-blue-0)' : 'white',
                  transition:  'all 0.12s',
                  userSelect:  'none',
                }}
                onClick={() => setReportType(value)}
              >
                <Group gap={8} wrap="nowrap">
                  <ThemeIcon
                    size={26} variant="light" radius="sm"
                    color={sel ? 'blue' : color}
                  >
                    <Icon size={14} />
                  </ThemeIcon>
                  <Text size="xs" fw={sel ? 700 : 400} c={sel ? 'blue.8' : 'dark'} lh={1.3}>
                    {label}
                  </Text>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

        {/* Page header */}
        <Group justify="space-between" align="flex-start" mb="sm">
          <Box>
            <Group gap="xs" mb={2}>
              {activeOpt && (
                <ThemeIcon size={28} radius="md" color={activeOpt.color} variant="light">
                  <activeOpt.Icon size={16} />
                </ThemeIcon>
              )}
              <Title order={4} c="blue.9">
                {activeOpt?.label || 'Intelligent Query'}
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              {activeFilters
                ? `Based on Last ${activeFilters.pouringDays} Days — ${dayjs(activeFilters.date).format('DD MMM YYYY')} · ${activeFilters.shift} Shift`
                : 'Select filters and click Preview to load data'}
            </Text>
          </Box>
          {hasLoaded && (
            <Badge size="lg" variant="filled" color={activeOpt?.color || 'blue'} radius="sm">
              {filtered.length} Producers
            </Badge>
          )}
        </Group>

        {/* Toolbar */}
        <Paper withBorder radius="md" px="sm" py={8} mb="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Button
                size="xs" variant="light" color="red"
                leftSection={<IconFileTypePdf size={14} />}
                onClick={exportPDF}
                disabled={!filtered.length}
              >
                PDF
              </Button>
              <Button
                size="xs" variant="light" color="green"
                leftSection={<IconFileTypeXls size={14} />}
                onClick={exportExcel}
                disabled={!filtered.length}
              >
                Excel
              </Button>
              <Button
                size="xs" variant="light" color="gray"
                leftSection={<IconPrinter size={14} />}
                onClick={handlePrint}
                disabled={!filtered.length}
              >
                Print
              </Button>
            </Group>
            <TextInput
              size="xs"
              placeholder="Search by name, ID, center..."
              leftSection={<IconSearch size={13} />}
              value={search}
              onChange={e => { setSearch(e.currentTarget.value); setPage(1); }}
              w={230}
              rightSection={
                search
                  ? <ActionIcon size="xs" variant="subtle" onClick={() => setSearch('')}><IconX size={12} /></ActionIcon>
                  : null
              }
            />
          </Group>
        </Paper>

        {/* Data Table */}
        <Paper withBorder radius="md" style={{ position: 'relative' }}>
          <LoadingOverlay visible={loading} overlayProps={{ blur: 2, backgroundOpacity: 0.4 }} />
          {!hasLoaded ? (
            <Box py={90} style={{ textAlign: 'center' }}>
              <Box
                style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e7f0fd, #cce4f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <IconMilk size={30} color="#1971c2" />
              </Box>
              <Text fw={600} c="blue.7" mb={4}>Ready to Analyze</Text>
              <Text size="sm" c="dimmed">
                Select your filters on the left and click <strong>Preview Report</strong>
              </Text>
            </Box>
          ) : (
            <DataTable
              columns={columns}
              records={paged}
              totalRecords={filtered.length}
              recordsPerPage={PAGE_SIZE}
              page={page}
              onPageChange={p => setPage(p)}
              sortStatus={sortStatus}
              onSortStatusChange={s => { setSortStatus(s); setPage(1); }}
              striped
              highlightOnHover
              withTableBorder={false}
              onRowClick={({ record }) => openProducerDetail(record)}
              noRecordsText={`No ${activeOpt?.label?.toLowerCase() || 'records'} found`}
              minHeight={300}
              styles={{
                header: {
                  backgroundColor: '#1a3c6e',
                  color: 'white',
                },
              }}
            />
          )}
        </Paper>
      </Box>

      {/* ═══════════════ PRODUCER DETAIL DRAWER ═══════════════ */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size={520}
        padding="md"
        title={
          <Group gap="xs">
            <ThemeIcon size={32} radius="md" color="blue" variant="light">
              <IconMilk size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="sm" lh={1.2}>Producer Details</Text>
              <Text size="xs" c="dimmed" lh={1.2}>Last 30-Day Analysis</Text>
            </Box>
          </Group>
        }
        overlayProps={{ blur: 3, backgroundOpacity: 0.2 }}
      >
        {detailLoading ? (
          <Box py={80} style={{ textAlign: 'center' }}>
            <Text c="dimmed" size="sm">Loading producer details…</Text>
          </Box>
        ) : producerDetail ? (
          <ScrollArea h="calc(100vh - 100px)" pr={4}>
            <Stack gap="md">

              {/* Producer profile */}
              <Paper withBorder radius="md" p="md" bg="blue.0">
                <Text size="xs" fw={700} c="blue.7" tt="uppercase" mb="xs">Profile</Text>
                <SimpleGrid cols={2} spacing={8}>
                  {[
                    ['Producer ID',  producerDetail.farmer?.farmerNumber],
                    ['Member No',    producerDetail.farmer?.memberId],
                    ['Name',         producerDetail.farmer?.personalDetails?.name],
                    ['Phone',        producerDetail.farmer?.personalDetails?.phone],
                    ['House Name',   producerDetail.farmer?.address?.houseName],
                    ['Village',      producerDetail.farmer?.address?.village || producerDetail.farmer?.address?.place],
                    ['Center',       producerDetail.farmer?.collectionCenter?.centerName],
                    ['Status',       producerDetail.farmer?.status],
                  ].map(([lbl, val]) => (
                    <Box key={lbl}>
                      <Text size="10px" c="dimmed" fw={500} tt="uppercase">{lbl}</Text>
                      <Text size="xs" fw={600} c={val ? 'dark' : 'dimmed'}>{val || '—'}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Paper>

              {/* Analytics cards */}
              <Box>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">Last 30 Days Analytics</Text>
                <SimpleGrid cols={2} spacing="xs">
                  <AnalyticCard label="Avg Quantity"     value={`${producerDetail.analytics.avgQty} L`}    color="blue"   Icon={IconDroplet} />
                  <AnalyticCard label="Avg FAT"          value={`${producerDetail.analytics.avgFat}%`}     color="red"    Icon={IconFlame} />
                  <AnalyticCard label="Avg SNF"          value={`${producerDetail.analytics.avgSnf}%`}     color="green"  Icon={IconScale} />
                  <AnalyticCard label="Total Sessions"   value={producerDetail.analytics.totalCollections} color="violet" Icon={IconMilk} />
                </SimpleGrid>
              </Box>

              {/* Trend chart */}
              {chartData && (
                <Box>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">30-Day Trend</Text>
                  <Paper withBorder radius="md" p="sm">
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                          legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
                        },
                        scales: {
                          x: { ticks: { font: { size: 8 }, maxRotation: 50, autoSkip: true, maxTicksLimit: 10 } },
                          y: { ticks: { font: { size: 9 } } }
                        }
                      }}
                    />
                  </Paper>
                </Box>
              )}

              {/* History table */}
              <Box>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
                  Collection History ({producerDetail.history.length} sessions)
                </Text>
                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                  <Table withTableBorder={false} style={{ fontSize: 11 }}>
                    <Table.Thead style={{ background: '#1a3c6e' }}>
                      <Table.Tr>
                        {['Date', 'Shift', 'Qty', 'FAT', 'SNF', 'Rate', 'Amount'].map(h => (
                          <Table.Th key={h} style={{ color: 'white', fontSize: 10, padding: '6px 8px', fontWeight: 600 }}>
                            {h}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {producerDetail.history.slice(0, 30).map((h, i) => (
                        <Table.Tr key={h._id} style={{ background: i % 2 === 0 ? 'white' : '#f5f8ff' }}>
                          <Table.Td style={{ padding: '5px 8px' }}>{dayjs(h.date).format('DD-MM-YY')}</Table.Td>
                          <Table.Td style={{ padding: '5px 8px' }}>
                            <Badge size="xs" variant="light" color={h.shift === 'AM' ? 'blue' : 'orange'}>
                              {h.shift}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ padding: '5px 8px', fontWeight: 600 }}>{h.qty?.toFixed(2)}</Table.Td>
                          <Table.Td style={{ padding: '5px 8px' }}>{h.fat?.toFixed(1)}</Table.Td>
                          <Table.Td style={{ padding: '5px 8px' }}>{h.snf?.toFixed(2)}</Table.Td>
                          <Table.Td style={{ padding: '5px 8px' }}>{h.rate?.toFixed(2)}</Table.Td>
                          <Table.Td style={{ padding: '5px 8px' }}>{h.amount?.toFixed(2)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Box>

            </Stack>
          </ScrollArea>
        ) : (
          <Box py={60} style={{ textAlign: 'center' }}>
            <Text c="dimmed" size="sm">No detail data available</Text>
          </Box>
        )}
      </Drawer>
    </Flex>
  );
};

export default IntelligentQuery;
