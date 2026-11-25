import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Paper, Group, Stack, Title, Text, Button, Select, SegmentedControl, Badge, Loader, Center,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconPrinter, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milkCollectionAPI, milkSalesAPI, collectionCenterAPI } from '../../services/api';
import useSocietyHeader from './shared/useSocietyHeader';
import {
  buildMilkPurchasePrintHtml, openMilkPurchasePrint, summariseMilkSales, byFarmerNumber,
} from '../../utils/milkPurchasePrint';

/**
 * Milk Purchase & Sales → Reports → Milk Purchase Report
 *
 * The Daily Collection List's A4 portrait print, for:
 *   • a single date or a from–to date range
 *   • AM / PM / All Shifts (defaults to the current shift: before noon AM, else PM)
 *   • one centre or All Centres
 * All Centres + All Shifts prints every centre's AM and PM collections together,
 * one block per date and shift, with block totals and one grand total.
 */

const ALL = 'ALL';
const PAGE = 5000;
const currentShift = () => (new Date().getHours() < 12 ? 'AM' : 'PM');
const SHIFT_OPTIONS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
  { value: ALL,  label: 'All Shifts' },
];

// Fetch every page so long date ranges are never cut short
const fetchAll = async (call, params, totalOf) => {
  const out = [];
  for (let page = 1; page <= 200; page++) {
    const res = await call({ ...params, page, limit: PAGE });
    const rows = res?.data || [];
    out.push(...rows);
    const total = totalOf(res);
    if (!rows.length || rows.length < PAGE || (total != null && out.length >= total)) break;
  }
  return out;
};

const MilkPurchaseCollectionReport = () => {
  const society = useSocietyHeader();

  const [dateMode, setDateMode] = useState('single');
  const [date, setDate]         = useState(new Date());
  const [range, setRange]       = useState([dayjs().startOf('month').toDate(), new Date()]);
  const [shift, setShift]       = useState(currentShift);
  const [center, setCenter]     = useState(ALL);
  const [centers, setCenters]   = useState([]);

  const [loading, setLoading]   = useState(false);
  const [records, setRecords]   = useState([]);
  const [sales, setSales]       = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);   // filters of the data on screen
  const frameRef = useRef(null);

  useEffect(() => {
    collectionCenterAPI.getAll({ status: 'Active', limit: 200 })
      .then(res => setCenters((res?.data || []).map(c => ({ value: c._id, label: c.centerName }))))
      .catch(() => {});
  }, []);

  const [from, to] = dateMode === 'single'
    ? [date, date]
    : [range?.[0] || null, range?.[1] || null];
  const fromISO = from ? dayjs(from).format('YYYY-MM-DD') : null;
  const toISO   = to   ? dayjs(to).format('YYYY-MM-DD')   : null;

  const load = useCallback(async () => {
    if (!fromISO || !toISO) return;
    if (fromISO > toISO) {
      notifications.show({ message: 'From date must be on or before To date', color: 'yellow' });
      return;
    }
    setLoading(true);
    try {
      const cParams = { fromDate: fromISO, toDate: toISO, lean: 'true' };
      const sParams = { fromDate: fromISO, toDate: toISO };
      if (shift !== ALL)  { cParams.shift = shift; sParams.session = shift; }
      if (center !== ALL) { cParams.collectionCenter = center; sParams.centerId = center; }

      const [coll, sl] = await Promise.all([
        fetchAll(milkCollectionAPI.exportAll, cParams, r => r?.pagination?.total),
        fetchAll(milkSalesAPI.getAll, sParams, r => r?.total).catch(() => []),
      ]);
      setRecords(coll);
      setSales(sl);
      setLoadedFor({ fromISO, toISO, shift, center });
    } catch (err) {
      notifications.show({ message: err?.message || 'Failed to load milk purchase records', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [fromISO, toISO, shift, center]);

  useEffect(() => { load(); }, [load]);

  // ── Labels ────────────────────────────────────────────────────────────────
  const dateLabel = !fromISO ? '' : fromISO === toISO
    ? dayjs(fromISO).format('DD/MM/YYYY')
    : `${dayjs(fromISO).format('DD/MM/YYYY')} to ${dayjs(toISO).format('DD/MM/YYYY')}`;
  const shiftLabel  = shift === ALL ? 'All Shifts (AM & PM)' : `${shift} Shift`;
  const centerLabel = center === ALL ? 'All Centres' : (centers.find(c => c.value === center)?.label || 'Centre');

  // ── Sections: one per date + shift (AM before PM), farmers in number order ─
  const sections = useMemo(() => {
    const groups = new Map();
    records.forEach((r) => {
      const d = dayjs(r.date).format('YYYY-MM-DD');
      const key = `${d}|${r.shift === 'PM' ? 'PM' : 'AM'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    const keys = [...groups.keys()].sort();
    if (keys.length <= 1) return [{ records: [...records].sort(byFarmerNumber) }];
    return keys.map((k) => {
      const [d, s] = k.split('|');
      return { heading: `${dayjs(d).format('DD/MM/YYYY')} — ${s} Shift`, records: groups.get(k).sort(byFarmerNumber) };
    });
  }, [records]);

  const salesSummary = useMemo(() => summariseMilkSales(sales), [sales]);
  const printOpts = {
    society, title: 'Milk Purchase Report', sections, dateLabel, shiftLabel, centerLabel, salesSummary,
  };
  const previewHtml = loadedFor ? buildMilkPurchasePrintHtml({ ...printOpts, autoPrint: false }) : '';

  const totalLtr = records.reduce((s, r) => s + (r.qty || 0), 0);
  const totalAmt = records.reduce((s, r) => s + (r.amount || 0), 0);

  const handlePrint = () => {
    if (!records.length) {
      notifications.show({ message: 'No records to print', color: 'yellow' });
      return;
    }
    openMilkPurchasePrint(printOpts);
  };

  // Grow the preview frame to its content so the page scrolls, not the frame
  const fitFrame = () => {
    const f = frameRef.current;
    const h = f?.contentDocument?.documentElement?.scrollHeight;
    if (h) f.style.height = `${h + 20}px`;
  };

  return (
    <Box style={{ background: '#f0f4fb', minHeight: '100vh', padding: '14px' }}>
      {/* ── Action bar ── */}
      <Paper radius="sm" p="xs" mb="sm" withBorder style={{ borderColor: '#dde3ee', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={0}>
            <Title order={5} style={{ color: '#1c3d6e', lineHeight: 1.2 }}>Milk Purchase Report</Title>
            <Text size="xs" c="dimmed">{dateLabel} · {shiftLabel} · {centerLabel}</Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <Button leftSection={<IconRefresh size={14} />} onClick={load} loading={loading}
              variant="filled" color="blue" size="xs" radius="sm">Load</Button>
            <Button leftSection={<IconPrinter size={14} />} onClick={handlePrint}
              disabled={loading || !records.length} variant="light" color="dark" size="xs" radius="sm">
              Print (A4 Portrait)
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* ── Filters ── */}
      <Paper radius="sm" p="md" mb="sm" withBorder style={{ borderColor: '#dde3ee' }}>
        <Group align="flex-end" gap="lg" wrap="wrap">
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={4} tt="uppercase" style={{ letterSpacing: '0.4px' }}>Date</Text>
            <SegmentedControl
              size="xs" radius="sm" value={dateMode} onChange={setDateMode}
              data={[{ label: 'Single Date', value: 'single' }, { label: 'From – To', value: 'range' }]}
              styles={{ root: { background: '#e8edf5' } }}
            />
          </div>
          {dateMode === 'single' ? (
            <DatePickerInput
              label="Date" value={date} onChange={setDate} valueFormat="DD/MM/YYYY"
              size="xs" radius="sm" leftSection={<IconCalendar size={14} />} style={{ minWidth: 150 }}
            />
          ) : (
            <DatePickerInput
              type="range" label="From – To Date" value={range} onChange={setRange} valueFormat="DD/MM/YYYY"
              size="xs" radius="sm" leftSection={<IconCalendar size={14} />} style={{ minWidth: 230 }}
              allowSingleDateInRange
            />
          )}
          <Select
            label="Shift" data={SHIFT_OPTIONS} value={shift} onChange={(v) => setShift(v || currentShift())}
            allowDeselect={false} size="xs" radius="sm" style={{ width: 140 }}
          />
          <Select
            label="Centre" data={[{ value: ALL, label: 'All Centres' }, ...centers]} value={center}
            onChange={(v) => setCenter(v || ALL)} allowDeselect={false} searchable
            size="xs" radius="sm" style={{ width: 220 }}
          />
          {loadedFor && !loading && (
            <Group gap="xs">
              <Badge variant="light" color="blue">{records.length} entries</Badge>
              <Badge variant="light" color="teal">{totalLtr.toFixed(2)} L</Badge>
              <Badge variant="light" color="green">Rs. {totalAmt.toFixed(2)}</Badge>
            </Group>
          )}
        </Group>
      </Paper>

      {/* ── Preview (exactly what prints) ── */}
      <Paper radius="sm" p="md" withBorder style={{ borderColor: '#dde3ee', overflowX: 'auto' }}>
        {loading ? (
          <Center py="xl"><Loader size="sm" /></Center>
        ) : !loadedFor ? (
          <Text c="dimmed" ta="center" py="xl">Select the date to view the report</Text>
        ) : (
          <iframe
            ref={frameRef} title="Milk Purchase Report preview" srcDoc={previewHtml} onLoad={fitFrame}
            style={{ width: '210mm', minHeight: 400, border: '1px solid #e5e7eb', background: '#fff', display: 'block', margin: '0 auto' }}
          />
        )}
      </Paper>
    </Box>
  );
};

export default MilkPurchaseCollectionReport;
