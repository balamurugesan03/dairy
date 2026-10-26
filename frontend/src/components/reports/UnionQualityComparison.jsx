import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  Container, Paper, Group, Box, Title, Text, ThemeIcon, Grid, Select, Button, Table, Badge, Alert, Stack,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconScaleOutline, IconPrinter, IconFileSpreadsheet, IconSearch, IconInfoCircle,
} from '@tabler/icons-react';
import { unionSalesSlipAPI, collectionCenterAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { openA4Print, a4Header, a4Signatures, escapeHtml } from '../../utils/printA4';

// ────────────────────────────────────────────────────────────────
//  Union Sale Quality Comparison
//    Procurement Data (From Dairy) — Daily Collection List, per date + centre
//    To Dairy                       — Union Sales slips (society-level), per date
//    Comparison                     — To Dairy − Procurement, per date
// ────────────────────────────────────────────────────────────────
const f2 = (n) => (n === null || n === undefined ? '-' : Number(n).toFixed(2));
const fmtD = (d) => dayjs(d).format('DD/MM/YYYY');
const signed = (n) => (n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}`);
const diffColor = (n) => (n < 0 ? 'red' : n > 0 ? 'teal' : undefined);
const centreText = (r) => (r.centreCode ? `${r.centreCode} - ${r.centreName}` : r.centreName);

const COLS = ['Date', 'Center Code', 'Total Quantity', 'Avg FAT', 'Avg SNF', 'Avg TS', 'Avg Rate'];
// Days with only one side (e.g. union slip not entered yet) are left out of the Comparison total
const unmatchedNote = (d) => `${d.totals.comparison.unmatchedDays} day(s) with only Procurement or only To Dairy data are not included in the Comparison total.`;
const tsTitle = (s) => `TS Rate Settings${s?.label ? ` (${s.label})` : ''}`;

export default function UnionQualityComparison() {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';

  const [range, setRange] = useState(() => [dayjs().startOf('month').toDate(), new Date()]);
  const [centre, setCentre] = useState('');
  const [centres, setCentres] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    collectionCenterAPI.getAll({ limit: 1000 })
      .then((res) => setCentres((res?.data || []).map((c) => ({ value: c._id, label: c.centerName }))))
      .catch(() => setCentres([]));
  }, []);

  const load = async () => {
    const [from, to] = range || [];
    if (!from || !to) {
      notifications.show({ title: 'Period', message: 'Select From Date and To Date', color: 'orange' });
      return;
    }
    setLoading(true);
    try {
      const params = { fromDate: dayjs(from).format('YYYY-MM-DD'), toDate: dayjs(to).format('YYYY-MM-DD') };
      if (centre) params.centerId = centre;
      const res = await unionSalesSlipAPI.getQualityComparison(params);
      // Keep the filters the data was built with, so print / export always match it
      setData({ ...res.data, filters: { ...params, centreLabel: res.data.centreName || 'All Centres' } });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const periodText = data ? `${fmtD(data.filters.fromDate)} to ${fmtD(data.filters.toDate)}` : '';
  const rateNote = (s, src) => (s?.tsEnabled ? `${tsTitle(s)} from ${s.fromDate ? fmtD(s.fromDate) : '-'} (${src})` : 'Actual average rate');

  // ── Print (A4 landscape) ────────────────────────────────────
  const handlePrint = () => {
    if (!data) return;
    const qualityRows = (rows) => rows.map((r) => `<tr>
        <td class="ctr">${fmtD(r.date)}</td><td>${escapeHtml(centreText(r))}</td>
        <td class="amt">${f2(r.qty)}</td><td class="amt">${f2(r.fat)}</td><td class="amt">${f2(r.snf)}</td>
        <td class="amt">${f2(r.ts)}</td><td class="amt">${f2(r.rate)}</td></tr>`).join('');
    const qualityTable = (title, note, rows, total) => `
      <div class="sec">${escapeHtml(title)} <span class="note">${escapeHtml(note)}</span></div>
      <table class="a4"><thead><tr>${COLS.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? qualityRows(rows) : '<tr><td colspan="7" class="ctr">No data</td></tr>'}
      <tr class="row-grand"><td colspan="2">Total</td><td class="amt">${f2(total.qty)}</td><td class="amt">${f2(total.fat)}</td>
        <td class="amt">${f2(total.snf)}</td><td class="amt">${f2(total.ts)}</td><td class="amt">${f2(total.rate)}</td></tr>
      </tbody></table>`;
    const cmpRow = (label, a, t, d, cls = '') => `<tr class="${cls}">
        <td class="ctr">${label}</td>
        ${['qty', 'fat', 'snf', 'ts', 'rate'].map((k) => `<td class="amt">${a ? f2(a[k]) : '-'}</td><td class="amt">${t ? f2(t[k]) : '-'}</td><td class="amt b">${d ? signed(d[k]) : '-'}</td>`).join('')}
      </tr>`;
    const cmpHead = `<tr><th rowspan="2">Date</th>${['Total Quantity', 'Avg FAT', 'Avg SNF', 'Avg TS', 'Avg Rate'].map((c) => `<th colspan="3">${c}</th>`).join('')}</tr>
      <tr>${['qty', 'fat', 'snf', 'ts', 'rate'].map(() => '<th>Actual</th><th>To Dairy</th><th>Diff</th>').join('')}</tr>`;
    const body = a4Header({ orgName: companyName, title: 'Union Sale Quality Comparison', period: periodText,
      extra: `Center: ${escapeHtml(data.filters.centreLabel)}` })
      + qualityTable(`Procurement Data${data.names?.fromDairy?.name ? ` — ${data.names.fromDairy.name}` : ''}`, rateNote(data.settings.fromDairy, 'From Dairy settings'), data.procurement, data.totals.actual)
      + qualityTable(`To Diary${data.names?.toDairy?.name ? ` — ${data.names.toDairy.name}` : ''}`, rateNote(data.settings.toDairy, 'manual'), data.toDairy, data.totals.toDairy)
      + `<div class="sec">Comparison <span class="note">Actual / Procurement vs To Dairy · Diff = To Dairy − Actual</span></div>
         <table class="a4 cmp"><thead>${cmpHead}</thead><tbody>
         ${data.comparison.map((c) => cmpRow(fmtD(c.date), c.actual, c.toDairy, c.diff)).join('')}
         ${cmpRow('Total', data.totals.comparison.actual, data.totals.comparison.toDairy, data.totals.comparison.diff, 'row-grand')}
         </tbody></table>`
      + (data.totals.comparison.unmatchedDays ? `<p class="note" style="margin-top:4px">${escapeHtml(unmatchedNote(data))}</p>` : '')
      + (data.singleCentre ? `<p class="note" style="margin-top:4px">Union slips are for the whole society; compared against ${escapeHtml(data.filters.centreLabel)} procurement only.</p>` : '')
      + a4Signatures(['President', 'Secretary'], dayjs().format('DD/MM/YYYY hh:mm A'));
    openA4Print({
      title: 'Union Sale Quality Comparison',
      orientation: 'landscape',
      css: `.sec { font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 10px 0 3px; }
            .note { font-size: 8px; font-weight: 400; text-transform: none; color: #333; }
            table.cmp th, table.cmp td { font-size: 8px; }`,
      bodyHtml: body,
    });
  };

  // ── Export (Excel, one sheet per section) ───────────────────
  const handleExport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const head = [
      ['Union Sale Quality Comparison'],
      [`Period: ${periodText}`, `Center: ${data.filters.centreLabel}`],
      [],
    ];
    const quality = (rows, total) => [
      ...head,
      COLS,
      ...rows.map((r) => [fmtD(r.date), centreText(r), r.qty, r.fat, r.snf, r.ts, r.rate]),
      ['Total', '', total.qty, total.fat, total.snf, total.ts, total.rate],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quality(data.procurement, data.totals.actual)), 'Procurement Data');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quality(data.toDairy, data.totals.toDairy)), 'To Diary');
    const keys = ['qty', 'fat', 'snf', 'ts', 'rate'];
    const cmp = [
      ...head,
      ['Date', ...['Total Quantity', 'Avg FAT', 'Avg SNF', 'Avg TS', 'Avg Rate'].flatMap((c) => [`${c} Actual`, `${c} To Dairy`, `${c} Diff`])],
      ...data.comparison.map((c) => [fmtD(c.date), ...keys.flatMap((k) => [c.actual?.[k] ?? '', c.toDairy?.[k] ?? '', c.diff?.[k] ?? ''])]),
      ['Total', ...keys.flatMap((k) => [data.totals.comparison.actual[k], data.totals.comparison.toDairy[k], data.totals.comparison.diff[k]])],
      ...(data.totals.comparison.unmatchedDays ? [[unmatchedNote(data)]] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cmp), 'Comparison');
    XLSX.writeFile(wb, `Union_Sale_Quality_Comparison_${data.filters.fromDate}_to_${data.filters.toDate}.xlsx`);
  };

  // ── Screen ──────────────────────────────────────────────────
  const QualityTable = ({ rows, total, emptyText }) => (
    <Box style={{ overflowX: 'auto' }}>
      <Table striped withTableBorder withColumnBorders fz="sm">
        <Table.Thead>
          <Table.Tr>{COLS.map((c, i) => <Table.Th key={c} ta={i >= 2 ? 'right' : undefined}>{c}</Table.Th>)}</Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr><Table.Td colSpan={7} ta="center" c="dimmed" py="md">{emptyText}</Table.Td></Table.Tr>
          ) : rows.map((r, i) => (
            <Table.Tr key={`${r.date}-${r.centreName}-${i}`}>
              <Table.Td>{fmtD(r.date)}</Table.Td>
              <Table.Td>{centreText(r)}</Table.Td>
              <Table.Td ta="right">{f2(r.qty)}</Table.Td>
              <Table.Td ta="right">{f2(r.fat)}</Table.Td>
              <Table.Td ta="right">{f2(r.snf)}</Table.Td>
              <Table.Td ta="right">{f2(r.ts)}</Table.Td>
              <Table.Td ta="right">
                {f2(r.rate)}
                {r.rateSource === 'TS' && <Badge ml={4} size="xs" variant="light">TS</Badge>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        {rows.length > 0 && (
          <Table.Tfoot>
            <Table.Tr style={{ fontWeight: 700 }}>
              <Table.Td colSpan={2}>Total</Table.Td>
              <Table.Td ta="right">{f2(total.qty)}</Table.Td>
              <Table.Td ta="right">{f2(total.fat)}</Table.Td>
              <Table.Td ta="right">{f2(total.snf)}</Table.Td>
              <Table.Td ta="right">{f2(total.ts)}</Table.Td>
              <Table.Td ta="right">{f2(total.rate)}</Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </Box>
  );

  const CMP_KEYS = [['qty', 'Total Quantity'], ['fat', 'Avg FAT'], ['snf', 'Avg SNF'], ['ts', 'Avg TS'], ['rate', 'Avg Rate']];
  const cmpCells = (a, t, d) => CMP_KEYS.flatMap(([k]) => [
    <Table.Td key={`${k}a`} ta="right">{a ? f2(a[k]) : '-'}</Table.Td>,
    <Table.Td key={`${k}t`} ta="right">{t ? f2(t[k]) : '-'}</Table.Td>,
    <Table.Td key={`${k}d`} ta="right" fw={700} c={d ? diffColor(d[k]) : undefined} bg="gray.0">{d ? signed(d[k]) : '-'}</Table.Td>,
  ]);

  return (
    <Container size="xl" py="md" fluid>
      <Paper shadow="sm" radius="md" p="lg" withBorder>
        <Group justify="space-between" mb="md" align="flex-start">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" color="teal" variant="light"><IconScaleOutline size={22} /></ThemeIcon>
            <Box>
              <Title order={3} lh={1}>Union Sale Quality Comparison</Title>
              <Text size="xs" c="dimmed">Procurement (From Dairy) vs To Dairy — quantity, FAT, SNF, TS and rate</Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={handlePrint} disabled={!data}>Print</Button>
            <Button variant="light" color="green" leftSection={<IconFileSpreadsheet size={16} />} onClick={handleExport} disabled={!data}>Export</Button>
          </Group>
        </Group>

        <Grid gutter="sm" align="flex-end" mb="md">
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <DatePickerInput label="From Date" valueFormat="DD/MM/YYYY" value={range[0]}
              onChange={(v) => setRange(([, b]) => [v ? new Date(v) : null, b])} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <DatePickerInput label="To Date" valueFormat="DD/MM/YYYY" value={range[1]}
              onChange={(v) => setRange(([a]) => [a, v ? new Date(v) : null])} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Select label="Center" data={[{ value: '', label: 'All Centers' }, ...centres]} value={centre}
              onChange={(v) => setCentre(v || '')} searchable allowDeselect={false} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 2 }}>
            <Button fullWidth color="teal" leftSection={<IconSearch size={16} />} onClick={load} loading={loading}>Show</Button>
          </Grid.Col>
        </Grid>

        {data && (
          <Stack gap="lg">
            {data.singleCentre && (
              <Alert color="blue" icon={<IconInfoCircle size={16} />}>
                Union Sales slips are for the whole society, so To Dairy is not split by centre. The comparison below is
                {` ${data.filters.centreLabel}`} procurement against the whole-society union slips.
              </Alert>
            )}

            <Box>
              <Group gap="xs" mb={6}>
                <Title order={5}>Procurement Data{data.names?.fromDairy?.name ? ` — ${data.names.fromDairy.name}` : ''}</Title>
                <Text size="xs" c="dimmed">{rateNote(data.settings.fromDairy, 'From Dairy settings')}</Text>
              </Group>
              <QualityTable rows={data.procurement} total={data.totals.actual} emptyText="No milk collection in this period." />
            </Box>

            <Box>
              <Group gap="xs" mb={6}>
                <Title order={5}>To Diary{data.names?.toDairy?.name ? ` — ${data.names.toDairy.name}` : ''}</Title>
                <Text size="xs" c="dimmed">{rateNote(data.settings.toDairy, 'manual')} · from Union Sales slips</Text>
              </Group>
              <QualityTable rows={data.toDairy} total={data.totals.toDairy} emptyText="No Union Sales slips in this period." />
            </Box>

            <Box>
              <Group gap="xs" mb={6}>
                <Title order={5}>Comparison</Title>
                <Text size="xs" c="dimmed">Actual / Procurement vs To Dairy · Diff = To Dairy − Actual (red = To Dairy lower)</Text>
              </Group>
              <Box style={{ overflowX: 'auto' }}>
                <Table withTableBorder withColumnBorders fz="xs" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th rowSpan={2}>Date</Table.Th>
                      {CMP_KEYS.map(([k, label]) => <Table.Th key={k} colSpan={3} ta="center">{label}</Table.Th>)}
                    </Table.Tr>
                    <Table.Tr>
                      {CMP_KEYS.flatMap(([k]) => [
                        <Table.Th key={`${k}a`} ta="right">Actual</Table.Th>,
                        <Table.Th key={`${k}t`} ta="right">To Dairy</Table.Th>,
                        <Table.Th key={`${k}d`} ta="right" bg="gray.1">Diff</Table.Th>,
                      ])}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.comparison.length === 0 ? (
                      <Table.Tr><Table.Td colSpan={16} ta="center" c="dimmed" py="md">Nothing to compare in this period.</Table.Td></Table.Tr>
                    ) : data.comparison.map((c) => (
                      <Table.Tr key={c.date}>
                        <Table.Td>{fmtD(c.date)}</Table.Td>
                        {cmpCells(c.actual, c.toDairy, c.diff)}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                  {data.comparison.length > 0 && (
                    <Table.Tfoot>
                      <Table.Tr style={{ fontWeight: 700 }}>
                        <Table.Td>Total</Table.Td>
                        {cmpCells(data.totals.comparison.actual, data.totals.comparison.toDairy, data.totals.comparison.diff)}
                      </Table.Tr>
                    </Table.Tfoot>
                  )}
                </Table>
              </Box>
              {data.totals.comparison.unmatchedDays > 0 && (
                <Text size="xs" c="dimmed" mt={4}>{unmatchedNote(data)}</Text>
              )}
            </Box>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
