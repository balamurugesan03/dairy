import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Group, Text, Button, TextInput, Select, Checkbox, Radio,
  Accordion, Badge, ActionIcon, Paper, ScrollArea, Divider,
  Table, Pagination, Tooltip, Stack, Loader, Center, NumberInput,
  ThemeIcon, Card
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch, IconDownload, IconFileTypePdf, IconRefresh, IconFilter,
  IconUsers, IconEye, IconEdit, IconPrinter, IconFileSpreadsheet,
  IconChevronUp, IconChevronDown,
  IconUserCheck, IconCalendar, IconBuilding,
  IconArrowsSort, IconX, IconListDetails, IconAdjustmentsHorizontal
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { farmerAPI, collectionCenterAPI } from '../../services/api';

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

const calcAge = (dob) => {
  if (!dob) return '-';
  const d = dayjs(dob);
  if (!d.isValid()) return '-';
  return dayjs().diff(d, 'year');
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

const MemberRegister = () => {
  const navigate = useNavigate();

  // ── Collection Centers ─────────────────────────────────────────────────────
  const [centers, setCenters] = useState([]);
  const [centerLoading, setCenterLoading] = useState(true);

  // ── Filter State ───────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    collectionCenter: '',
    pouringMembers:   false,
    retiredMembers:   false,
    prodFrom:         '',
    prodTo:           '',
    localLanguage:    false,
    sex:              '',
    caste:            '',
    occupation:       '',
    category:         '',
    localBody:        '',
    pourFrom:         null,
    pourTo:           null,
    daysCond:         'gte',
    daysVal:          '',
    qtyCond:          'gte',
    qtyVal:           '',
    ageMin:           '',
    ageMax:           '',
    reportType:       'active'
  });

  // ── Table State ────────────────────────────────────────────────────────────
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const PAGE_SIZE = 15;

  const [sortField, setSortField] = useState('farmerNumber');
  const [sortDir, setSortDir]     = useState('asc');


  const searchRef = useRef(null);
  const debounceTimer = useRef(null);

  // ── Load Centers ───────────────────────────────────────────────────────────
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

  // ── Fetch Members ──────────────────────────────────────────────────────────
  const COND_MAP = { gte: '>=', lte: '<=', eq: '=' };

  const fetchMembers = useCallback(async (overridePage) => {
    setLoading(true);
    try {
      const params = {
        page:             overridePage ?? page,
        limit:            PAGE_SIZE,
        memberType:       'Member',
        activeOnly:       filters.retiredMembers ? undefined : 'true',
        collectionCenter: filters.collectionCenter || undefined,
        gender:           filters.sex || undefined,
        caste:            filters.caste || undefined,
        farmerNumberFrom: filters.prodFrom || undefined,
        farmerNumberTo:   filters.prodTo   || undefined,
        fromDate: filters.pourFrom ? dayjs(filters.pourFrom).format('YYYY-MM-DD') : undefined,
        toDate:   filters.pourTo   ? dayjs(filters.pourTo).format('YYYY-MM-DD')   : undefined,
        daysCondition: filters.daysVal !== '' ? COND_MAP[filters.daysCond] : undefined,
        daysValue:     filters.daysVal !== '' ? filters.daysVal             : undefined,
        qtyCondition:  filters.qtyVal  !== '' ? COND_MAP[filters.qtyCond]  : undefined,
        qtyValue:      filters.qtyVal  !== '' ? filters.qtyVal              : undefined,
      };

      const res = await farmerAPI.getProducerReport(params);
      const farmers = res.data || [];
      const totalCount = res.pagination?.total ?? farmers.length;

      setData(farmers);
      setTotal(totalCount);
    } catch (e) {
      notifications.show({ title: 'Error', message: e.message || 'Failed to load members', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [page, sortField, sortDir, search, filters]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Debounce search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPage(1);
    }, 400);
  };

  const handleDisplay = () => {
    setPage(1);
    fetchMembers(1);
  };

  const handleClear = () => {
    setFilters({
      collectionCenter: '', pouringMembers: false, retiredMembers: false,
      prodFrom: '', prodTo: '', localLanguage: false,
      sex: '', caste: '', occupation: '', category: '', localBody: '',
      pourFrom: null, pourTo: null, daysCond: 'gte', daysVal: '', qtyCond: 'gte', qtyVal: '',
      ageMin: '', ageMax: '', reportType: 'active'
    });
    setSearch('');
    setPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const fmtAddress = (a) =>
    [a?.place, a?.post, a?.village, a?.panchayat, a?.pin].filter(Boolean).join(', ');

  const handleExportCSV = () => {
    if (!data.length) return notifications.show({ message: 'No data to export', color: 'yellow' });
    const headers = [
      'Farmer Number','Member No','House Name','Address',
      'Date of Birth','Age','Sex','Date of Admission',
      'Total Share Nos','Total Share Value','Resolution No','Resolution Date',
      'Quantity (L)','Days'
    ];
    const rows = data.map(f => [
      f.farmerNumber,
      f.memberId || '',
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
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '10px 12px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: '2px solid #e2e8f0'
  };

  // ── Sidebar Width ──────────────────────────────────────────────────────────
  const SIDEBAR_W = 260;

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#f1f5f9' }}>

      {/* ══ LEFT FILTER PANEL ══════════════════════════════════════════════ */}
      <Box style={{
            width: SIDEBAR_W,
            minWidth: SIDEBAR_W,
            height: '100%',
            background: '#fff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
            transition: 'width 0.2s ease'
          }}>
            {/* Sidebar Header */}
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
                        size="xs"
                        placeholder="ALL"
                        data={centers}
                        value={filters.collectionCenter}
                        onChange={v => setFilters(f => ({ ...f, collectionCenter: v || '' }))}
                        disabled={centerLoading}
                        searchable
                        clearable
                        styles={{ input: { fontSize: 12 }, option: { fontSize: 12 } }}
                      />
                      <Checkbox
                        size="xs"
                        label={<Text size="xs" fw={500}>Pouring Members</Text>}
                        checked={filters.pouringMembers}
                        onChange={e => setFilters(f => ({ ...f, pouringMembers: e.target.checked }))}
                      />
                      <Checkbox
                        size="xs"
                        label={<Text size="xs" fw={500}>Retired Members</Text>}
                        checked={filters.retiredMembers}
                        onChange={e => setFilters(f => ({ ...f, retiredMembers: e.target.checked }))}
                      />
                      <Divider my={2} />
                      <Group gap={6}>
                        <TextInput
                          size="xs"
                          label="Prod No From"
                          placeholder="001"
                          value={filters.prodFrom}
                          onChange={e => setFilters(f => ({ ...f, prodFrom: e.target.value }))}
                          style={{ flex: 1 }}
                          styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                        />
                        <TextInput
                          size="xs"
                          label="To"
                          placeholder="999"
                          value={filters.prodTo}
                          onChange={e => setFilters(f => ({ ...f, prodTo: e.target.value }))}
                          style={{ flex: 1 }}
                          styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                        />
                      </Group>
                      <Checkbox
                        size="xs"
                        label={<Text size="xs" fw={500}>Local Language</Text>}
                        checked={filters.localLanguage}
                        onChange={e => setFilters(f => ({ ...f, localLanguage: e.target.checked }))}
                      />
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
                      <Select
                        size="xs"
                        label="Sex"
                        data={SEX_OPTIONS}
                        value={filters.sex}
                        onChange={v => setFilters(f => ({ ...f, sex: v || '' }))}
                        clearable
                        styles={{
                          label: { fontSize: 10, fontWeight: 600, color: '#64748b' },
                          input: { fontSize: 12 },
                          option: { fontSize: 12 }
                        }}
                      />
                      <Select
                        size="xs"
                        label="Caste"
                        data={CASTE_OPTIONS}
                        value={filters.caste}
                        onChange={v => setFilters(f => ({ ...f, caste: v ?? '' }))}
                        clearable
                        styles={{
                          label: { fontSize: 10, fontWeight: 600, color: '#64748b' },
                          input: { fontSize: 12 },
                          option: { fontSize: 12 }
                        }}
                      />
                      <TextInput
                        size="xs"
                        label="Occupation"
                        placeholder="e.g. Farmer"
                        value={filters.occupation}
                        onChange={e => setFilters(f => ({ ...f, occupation: e.target.value }))}
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
                      <TextInput
                        size="xs"
                        label="Category"
                        placeholder="e.g. A / B / C"
                        value={filters.category}
                        onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
                      <TextInput
                        size="xs"
                        label="Local Body"
                        placeholder="Panchayat / Municipality"
                        value={filters.localBody}
                        onChange={e => setFilters(f => ({ ...f, localBody: e.target.value }))}
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
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
                      <DatePickerInput
                        size="xs"
                        type="range"
                        label="Date Range"
                        placeholder="From – To"
                        value={[filters.pourFrom, filters.pourTo]}
                        onChange={([from, to]) => setFilters(f => ({ ...f, pourFrom: from, pourTo: to }))}
                        clearable
                        valueFormat="DD/MM/YYYY"
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
                      <Group gap={4} align="flex-end">
                        <Select
                          size="xs"
                          label="Days"
                          data={DAYS_COND}
                          value={filters.daysCond}
                          onChange={v => setFilters(f => ({ ...f, daysCond: v }))}
                          style={{ width: 64 }}
                          styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                        />
                        <NumberInput
                          size="xs"
                          placeholder="0"
                          value={filters.daysVal}
                          onChange={v => setFilters(f => ({ ...f, daysVal: v }))}
                          min={0}
                          style={{ flex: 1 }}
                        />
                      </Group>
                      <Group gap={4} align="flex-end">
                        <Select
                          size="xs"
                          label="Qty (L)"
                          data={QTY_COND}
                          value={filters.qtyCond}
                          onChange={v => setFilters(f => ({ ...f, qtyCond: v }))}
                          style={{ width: 64 }}
                          styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                        />
                        <NumberInput
                          size="xs"
                          placeholder="0"
                          value={filters.qtyVal}
                          onChange={v => setFilters(f => ({ ...f, qtyVal: v }))}
                          min={0}
                          style={{ flex: 1 }}
                        />
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
                      <NumberInput
                        size="xs"
                        label="Min Age"
                        placeholder="18"
                        value={filters.ageMin}
                        onChange={v => setFilters(f => ({ ...f, ageMin: v }))}
                        min={0} max={120}
                        style={{ flex: 1 }}
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
                      <NumberInput
                        size="xs"
                        label="Max Age"
                        placeholder="80"
                        value={filters.ageMax}
                        onChange={v => setFilters(f => ({ ...f, ageMax: v }))}
                        min={0} max={120}
                        style={{ flex: 1 }}
                        styles={{ label: { fontSize: 10, fontWeight: 600, color: '#64748b' } }}
                      />
                    </Group>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* ── Report Type ───────────────────────────────────────── */}
                <Accordion.Item value="report">
                  <Accordion.Control>
                    <SectionHeader color={SECTION_COLORS.report} icon={IconListDetails} label="Voters List & Share List" />
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Radio.Group
                      value={filters.reportType}
                      onChange={v => setFilters(f => ({ ...f, reportType: v }))}
                    >
                      <Stack gap={6}>
                        {REPORT_TYPE_OPTIONS.map(opt => (
                          <Radio
                            key={opt.value}
                            value={opt.value}
                            label={<Text size="xs">{opt.label}</Text>}
                            size="xs"
                          />
                        ))}
                      </Stack>
                    </Radio.Group>
                  </Accordion.Panel>
                </Accordion.Item>

              </Accordion>
            </ScrollArea>

            {/* Sidebar Footer Buttons */}
            <Box style={{ padding: '12px 12px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <Stack gap={6}>
                <Group gap={6}>
                  <Button
                    size="xs"
                    variant="filled"
                    color="blue"
                    style={{ flex: 1 }}
                    leftSection={<IconSearch size={13} />}
                    onClick={handleDisplay}
                    loading={loading}
                  >
                    Display
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={handleClear}
                    leftSection={<IconRefresh size={13} />}
                  >
                    Clear
                  </Button>
                </Group>
                <Group gap={6}>
                  <Button
                    size="xs"
                    variant="light"
                    color="green"
                    style={{ flex: 1 }}
                    leftSection={<IconFileSpreadsheet size={13} />}
                    onClick={handleExportCSV}
                  >
                    Export
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    style={{ flex: 1 }}
                    leftSection={<IconFileTypePdf size={13} />}
                    onClick={() => notifications.show({ message: 'PDF export coming soon', color: 'blue' })}
                  >
                    PDF
                  </Button>
                </Group>
              </Stack>
            </Box>
          </Box>

      {/* ══ RIGHT CONTENT AREA ═════════════════════════════════════════════ */}
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top Bar ──────────────────────────────────────────────────── */}
        <Box style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <Group gap={10}>
            <Group gap={8}>
              <ThemeIcon size={32} radius="md" color="blue" variant="light">
                <IconUsers size={18} />
              </ThemeIcon>
              <Box>
                <Text fw={700} size="md" lh={1.2} c="#1e293b">Members Register</Text>
                <Text size="xs" c="dimmed" lh={1}>
                  {loading ? 'Loading...' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''} found`}
                </Text>
              </Box>
            </Group>
          </Group>

          <Group gap={8}>
            <TextInput
              ref={searchRef}
              size="sm"
              placeholder="Search by name, ID, phone…"
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ width: 240 }}
              styles={{ input: { borderRadius: 8 } }}
              rightSection={search ? (
                <ActionIcon size="xs" variant="subtle" onClick={() => { setSearch(''); setPage(1); }}>
                  <IconX size={12} />
                </ActionIcon>
              ) : null}
            />
            <Tooltip label="Export CSV">
              <ActionIcon size="lg" variant="light" color="green" onClick={handleExportCSV} radius="md">
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="PDF Report">
              <ActionIcon
                size="lg"
                variant="light"
                color="red"
                radius="md"
                onClick={() => notifications.show({ message: 'PDF export coming soon', color: 'blue' })}
              >
                <IconFileTypePdf size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh">
              <ActionIcon size="lg" variant="light" color="blue" radius="md" onClick={() => fetchMembers(page)}>
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
            <Card
              key={s.label}
              padding="8px 14px"
              radius="md"
              style={{ background: s.bg, border: `1px solid ${s.color}22`, minWidth: 110 }}
            >
              <Text size="xs" c="dimmed" fw={500}>{s.label}</Text>
              <Text size="lg" fw={800} c={s.color} lh={1.2}>{s.value}</Text>
            </Card>
          ))}
        </Box>

        {/* ── Data Table ────────────────────────────────────────────────── */}
        <Box style={{ flex: 1, overflow: 'hidden', padding: '10px 20px 0' }}>
          <Paper radius="lg" withBorder style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
          }}>
            <ScrollArea style={{ flex: 1 }} scrollbarSize={6} type="always">
              <Table
                highlightOnHover
                verticalSpacing={0}
                style={{ fontSize: 12, minWidth: 1400 }}
              >
                <Table.Thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <Table.Tr>
                    {[
                      { label: '#',                field: null },
                      { label: 'Farmer Number',    field: 'farmerNumber' },
                      { label: 'Member No',        field: 'memberId' },
                      { label: 'House Name',       field: null },
                      { label: 'Address',          field: null },
                      { label: 'Date of Birth',    field: null },
                      { label: 'Age',              field: null },
                      { label: 'Sex',              field: 'personalDetails.gender' },
                      { label: 'Date of Admission', field: 'admissionDate' },
                      { label: 'Total Share Nos',  field: 'financialDetails.totalShares' },
                      { label: 'Total Share Value', field: null },
                      { label: 'Resolution No',    field: null },
                      { label: 'Resolution Date',  field: null },
                      { label: 'Quantity (L)',     field: null },
                      { label: 'Days',             field: null },
                      { label: 'Actions',          field: null }
                    ].map(({ label, field }) => (
                      <Table.Th
                        key={label}
                        style={thStyle}
                        onClick={field ? () => handleSort(field) : undefined}
                      >
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
                            <Text size="sm" c="dimmed">Loading members...</Text>
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
                    const totalShareValue = (f.financialDetails?.totalShares || 0) * (f.financialDetails?.shareValue || 0);

                    return (
                      <Table.Tr
                        key={f._id}
                        style={{ background: isEven ? '#fff' : '#f8fafc' }}
                      >
                        {/* # */}
                        <Table.Td style={{ padding: '7px 10px', color: '#94a3b8', fontWeight: 500, minWidth: 36 }}>
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </Table.Td>

                        {/* Farmer Number */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 100 }}>
                          <Badge size="sm" variant="light" color="blue" radius="sm"
                            style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {f.farmerNumber}
                          </Badge>
                        </Table.Td>

                        {/* Member No */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 90 }}>
                          {f.memberId
                            ? <Badge size="sm" variant="dot" color="teal" radius="sm">{f.memberId}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        {/* House Name */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 110 }}>
                          <Text size="xs" c="#374151">{f.address?.houseName || '—'}</Text>
                        </Table.Td>

                        {/* Address */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 150 }}>
                          <Text size="xs" c="#374151" lineClamp={2} style={{ maxWidth: 160 }}>
                            {fmtAddress(f.address) || '—'}
                          </Text>
                        </Table.Td>

                        {/* Date of Birth */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 100 }}>
                          <Text size="xs" c="#374151">
                            {f.personalDetails?.dob ? dayjs(f.personalDetails.dob).format('DD/MM/YYYY') : '—'}
                          </Text>
                        </Table.Td>

                        {/* Age */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 50 }}>
                          {age !== '-'
                            ? <Badge size="sm" variant="light"
                                color={age < 30 ? 'green' : age < 60 ? 'yellow' : 'orange'}
                                radius="xl">{age}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        {/* Sex */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 70 }}>
                          {f.personalDetails?.gender
                            ? <Badge size="xs" variant="outline"
                                color={f.personalDetails.gender === 'Female' ? 'pink' : 'indigo'}
                                radius="sm">{f.personalDetails.gender}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        {/* Date of Admission */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 108 }}>
                          <Text size="xs" c="#374151">
                            {f.admissionDate ? dayjs(f.admissionDate).format('DD/MM/YYYY') : '—'}
                          </Text>
                        </Table.Td>

                        {/* Total Share Nos */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 90, textAlign: 'right' }}>
                          <Badge size="sm" variant="filled"
                            color={f.financialDetails?.totalShares > 0 ? 'blue' : 'gray'}
                            radius="sm">
                            {f.financialDetails?.totalShares || 0}
                          </Badge>
                        </Table.Td>

                        {/* Total Share Value */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 110, textAlign: 'right' }}>
                          <Text size="xs" fw={600} c={totalShareValue > 0 ? '#1e3a5f' : '#94a3b8'}>
                            {totalShareValue > 0 ? `₹ ${totalShareValue.toFixed(2)}` : '—'}
                          </Text>
                        </Table.Td>

                        {/* Resolution No */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 110 }}>
                          <Text size="xs" c="#374151">
                            {f.financialDetails?.resolutionNo || '—'}
                          </Text>
                        </Table.Td>

                        {/* Resolution Date */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 108 }}>
                          <Text size="xs" c="#374151">
                            {f.financialDetails?.resolutionDate
                              ? dayjs(f.financialDetails.resolutionDate).format('DD/MM/YYYY')
                              : '—'}
                          </Text>
                        </Table.Td>

                        {/* Quantity */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 90, textAlign: 'right' }}>
                          <Text size="xs" fw={600} c={f._totalQty > 0 ? '#166534' : '#94a3b8'}>
                            {f._totalQty != null ? f._totalQty.toFixed(2) : '—'}
                          </Text>
                        </Table.Td>

                        {/* Days */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 60, textAlign: 'center' }}>
                          {f._pouringDays != null
                            ? <Badge size="sm" variant="light" color="cyan" radius="sm">{f._pouringDays}</Badge>
                            : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>

                        {/* Actions */}
                        <Table.Td style={{ padding: '7px 10px', minWidth: 90 }}>
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="View" position="top" withArrow>
                              <ActionIcon size="sm" variant="light" color="blue" radius="xl"
                                onClick={() => navigate(`/farmers/view/${f._id}`)}>
                                <IconEye size={12} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Edit" position="top" withArrow>
                              <ActionIcon size="sm" variant="light" color="teal" radius="xl"
                                onClick={() => navigate(`/farmers/${f._id}/edit`)}>
                                <IconEdit size={12} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Print" position="top" withArrow>
                              <ActionIcon size="sm" variant="light" color="violet" radius="xl"
                                onClick={() => window.print()}>
                                <IconPrinter size={12} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {/* ── Pagination Bar ─────────────────────────────────────────── */}
            <Box style={{
              borderTop: '1px solid #e2e8f0',
              padding: '10px 16px',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <Text size="xs" c="dimmed">
                {loading ? 'Loading...' : (
                  total > 0
                    ? `Showing ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString()} members`
                    : 'No records'
                )}
              </Text>
              {total > PAGE_SIZE && (
                <Pagination
                  value={page}
                  onChange={p => { setPage(p); fetchMembers(p); }}
                  total={Math.ceil(total / PAGE_SIZE)}
                  size="sm"
                  radius="md"
                  withEdges
                  color="blue"
                />
              )}
              <Text size="xs" c="dimmed" style={{ textAlign: 'right' }}>
                {PAGE_SIZE} per page
              </Text>
            </Box>
          </Paper>
        </Box>

        {/* small bottom gap */}
        <Box style={{ height: 12 }} />
      </Box>
    </Box>
  );
};

export default MemberRegister;
