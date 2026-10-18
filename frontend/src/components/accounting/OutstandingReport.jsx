import { useState } from 'react';
import { message } from '../../utils/toast';
import {
  ledgerAPI, loanAdvanceAPI, cashAdvanceAPI, cattleFeedAdvanceAPI
} from '../../services/api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  Box, Button, Paper, Text, LoadingOverlay, Group, Stack, Container, Title,
  Table, Badge, Card, ScrollArea, Progress, Select
} from '@mantine/core';
import {
  IconTrendingUp, IconTrendingDown, IconArrowUpRight, IconArrowDownRight,
  IconCashBanknote, IconPrinter, IconSearch, IconFileExport, IconChartBar
} from '@tabler/icons-react';
import DateField from '../common/DateField';
import { useCompany } from '../../context/CompanyContext';
import { openA4Print, a4Header, a4Signatures, escapeHtml } from '../../utils/printA4';

// ── Outstanding categories and where each one's data comes from ───────────
// To Receive: Loans / Cash Advance / Cattle Feed Advance — the producer-wise
// summaries behind Producer Dues → Recoveries (same figures as those screens);
// Customers — Farmers Management → Customers (opening + credit milk sales −
// receipts). To Pay: Supplier — Dairy Inventory → Supplier (supplier ledger).
// Every row is normalised to { code, name, opening, added, settled, balance }.
const CATEGORIES = [
  {
    key: 'loan', label: 'Loans', side: 'receive', added: 'Loan Given', settled: 'Recovered',
    fetch: (p) => loanAdvanceAPI.getSummary(p).then(r => r?.data?.rows || []),
    map: (r) => ({ code: r.farmerNumber, name: r.farmerName, opening: r.opening, added: r.advanced, settled: r.recovery, balance: r.balance })
  },
  {
    key: 'cashAdvance', label: 'Cash Advance', side: 'receive', added: 'Advance Given', settled: 'Recovered',
    fetch: (p) => cashAdvanceAPI.getSummary(p).then(r => r?.data?.rows || []),
    map: (r) => ({ code: r.farmerNumber, name: r.farmerName, opening: r.opening, added: r.advanced, settled: r.recovery, balance: r.balance })
  },
  {
    key: 'cattleFeed', label: 'Cattle Feed Advance', side: 'receive', added: 'Feed Given', settled: 'Recovered',
    fetch: (p) => cattleFeedAdvanceAPI.getSummary(p).then(r => r?.data?.rows || []),
    map: (r) => ({ code: r.producerId, name: r.producerName, opening: r.openingBalance, added: r.credit, settled: r.debit, balance: r.balance })
  },
  {
    key: 'customer', label: 'Customers', side: 'receive', added: 'Credit Sales', settled: 'Received',
    fetch: (p, parties) => parties().then(d => d.customers || []),
    map: (r) => ({ code: r.code, name: r.name, opening: r.opening, added: r.debit, settled: r.credit, balance: r.balance })
  },
  {
    key: 'supplier', label: 'Supplier', side: 'pay', added: 'Purchases', settled: 'Paid',
    fetch: (p, parties) => parties().then(d => d.suppliers || []),
    map: (r) => ({ code: r.code, name: r.name, opening: r.opening, added: r.debit, settled: r.credit, balance: r.balance })
  }
];

const CATEGORY_OPTS = [
  { value: 'all',         label: 'All' },
  { value: 'supplier',    label: 'Supplier' },
  { value: 'cattleFeed',  label: 'Cattle Feed Advance' },
  { value: 'cashAdvance', label: 'Cash Advance' },
  { value: 'loan',        label: 'Loans' },
  { value: 'customer',    label: 'Customers' }
];

const SIDES = [
  { key: 'receive', title: 'To Receive', color: 'green', hex: '#2f9e44' },
  { key: 'pay',     title: 'To Pay',     color: 'red',   hex: '#e03131' }
];

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = (rows, k) => rows.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);

// Three summary fields (To Receive / To Pay / Net Position) — same fixed size.
const SummaryCard = ({ label, value, color, children }) => (
  <Card withBorder p="sm" radius="md" w={220} h={78} style={{ borderLeft: `4px solid ${color}` }}>
    <Text size="xs" c="dimmed" fw={600}>{label}</Text>
    {children || <Text size="lg" fw={700} style={{ color }}>{fmt(value)}</Text>}
  </Card>
);

const OutstandingReport = () => {
  const { selectedCompany } = useCompany();
  const companyName = selectedCompany?.companyName || 'Dairy Co-operative Society';
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [category, setCategory] = useState('all');
  // Generated result: { period: {from, to}, sections: [{ ...category, rows }] }
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      message.error('Please select both From and To dates');
      return;
    }
    setLoading(true);
    try {
      const params = { fromDate, toDate };
      // Supplier + Customers share one request; fetched at most once.
      let partiesPromise = null;
      const parties = () => (partiesPromise ||= ledgerAPI.getPartyOutstanding(params).then(r => r?.data || {}));
      const wanted = CATEGORIES.filter(c => category === 'all' || c.key === category);
      const lists = await Promise.all(wanted.map(c => c.fetch(params, parties)));
      const sections = wanted.map((c, i) => ({
        ...c,
        // Outstanding only — settled parties (balance 0) are left out.
        rows: lists[i].map(c.map).filter(r => Math.abs(parseFloat(r.balance) || 0) >= 0.005)
      }));
      setResult({ period: { from: fromDate, to: toDate }, category, sections });
    } catch (error) {
      message.error(error.message || 'Failed to fetch outstanding report');
    } finally {
      setLoading(false);
    }
  };

  const sections = result?.sections || [];
  const sideSections = (side) => sections.filter(s => s.side === side);
  const sideTotal = (side) => sideSections(side).reduce((t, s) => t + sum(s.rows, 'balance'), 0);
  const totalReceivable = sideTotal('receive');
  const totalPayable = sideTotal('pay');
  const netPosition = totalReceivable - totalPayable;
  const hasRows = sections.some(s => s.rows.length);
  const periodText = result
    ? `${dayjs(result.period.from).format('DD-MM-YYYY')} to ${dayjs(result.period.to).format('DD-MM-YYYY')}`
    : '';

  // ── Print — A4, one table per category under To Receive / To Pay ──────
  const handlePrint = () => {
    if (!hasRows) return;
    const tableHtml = (sec) => `
      <div class="os-cat">${escapeHtml(sec.label)}</div>
      <table class="a4">
        <colgroup><col style="width:6%"><col style="width:10%"><col style="width:28%">
          <col style="width:14%"><col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup>
        <thead><tr><th>#</th><th>Code</th><th>Name</th><th>Opening</th><th>${sec.added}</th><th>${sec.settled}</th><th>Outstanding</th></tr></thead>
        <tbody>
          ${sec.rows.map((r, i) => `<tr>
            <td class="ctr">${i + 1}</td><td>${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}</td>
            <td class="amt">${fmt(r.opening)}</td><td class="amt">${fmt(r.added)}</td>
            <td class="amt">${fmt(r.settled)}</td><td class="amt b">${fmt(r.balance)}</td></tr>`).join('')}
          <tr class="row-grand"><td colspan="3">Total — ${escapeHtml(sec.label)}</td>
            <td class="amt">${fmt(sum(sec.rows, 'opening'))}</td><td class="amt">${fmt(sum(sec.rows, 'added'))}</td>
            <td class="amt">${fmt(sum(sec.rows, 'settled'))}</td><td class="amt">${fmt(sum(sec.rows, 'balance'))}</td></tr>
        </tbody>
      </table>`;
    const body = SIDES.map(side => {
      const secs = sideSections(side.key).filter(s => s.rows.length);
      if (!secs.length) return '';
      return `<div class="os-side">${side.title} — ${fmt(sideTotal(side.key))}</div>${secs.map(tableHtml).join('')}`;
    }).join('');
    const summary = `<table class="a4 os-sum"><tbody><tr>
        <td>To Receive<br><b>${fmt(totalReceivable)}</b></td>
        <td>To Pay<br><b>${fmt(totalPayable)}</b></td>
        <td>Net Position<br><b>${fmt(Math.abs(netPosition))} ${netPosition >= 0 ? 'Favorable' : 'Unfavorable'}</b></td>
      </tr></tbody></table>`;
    openA4Print({
      title: 'Outstanding Report',
      orientation: 'portrait',
      css: `
        .os-side { font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 12px 0 4px; border-bottom: 1.5px solid #000; }
        .os-cat { font-size: 10.5px; font-weight: 700; margin: 8px 0 3px; }
        table.os-sum td { text-align: center; padding: 6px; font-size: 10px; }`,
      bodyHtml: a4Header({
        orgName: companyName,
        title: 'Outstanding Report',
        period: periodText,
        extra: `Category: ${escapeHtml(CATEGORY_OPTS.find(o => o.value === result.category)?.label || 'All')}`
      }) + summary + body + a4Signatures(['President', 'Secretary'])
    });
  };

  // ── Excel — one sheet per category ──────────────────────────────────────
  const handleExport = () => {
    if (!hasRows) return;
    const wb = XLSX.utils.book_new();
    sections.filter(s => s.rows.length).forEach(sec => {
      const aoa = [
        ['#', 'Code', 'Name', 'Opening', sec.added, sec.settled, 'Outstanding'],
        ...sec.rows.map((r, i) => [i + 1, r.code, r.name, r.opening, r.added, r.settled, r.balance]),
        ['', '', 'Total', sum(sec.rows, 'opening'), sum(sec.rows, 'added'), sum(sec.rows, 'settled'), sum(sec.rows, 'balance')]
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sec.label.slice(0, 31));
    });
    XLSX.writeFile(wb, `outstanding_report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const renderCategory = (sec, side) => (
    <Box key={sec.key} mb="md">
      <Group justify="space-between" mb={6}>
        <Text fw={700} size="sm">{sec.label}</Text>
        <Text size="sm" fw={700} c={side.color}>{fmt(sum(sec.rows, 'balance'))}</Text>
      </Group>
      {sec.rows.length === 0 ? (
        <Text size="sm" c="dimmed" mb="xs">No outstanding {sec.label.toLowerCase()} for this period</Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr style={{ backgroundColor: '#f8f9fa' }}>
                <Table.Th w={50}>#</Table.Th>
                <Table.Th w={100}>Code</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Opening</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>{sec.added}</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>{sec.settled}</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Outstanding</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sec.rows.map((r, i) => (
                <Table.Tr key={`${r.code}-${i}`}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td>{r.code}</Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{r.name}</Text></Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{fmt(r.opening)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{fmt(r.added)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{fmt(r.settled)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={700} c={side.color}>{fmt(r.balance)}</Text></Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr style={{ background: '#f1f3f5' }}>
                <Table.Td colSpan={3}><Text size="sm" fw={700}>Total — {sec.label}</Text></Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(sum(sec.rows, 'opening'))}</Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(sum(sec.rows, 'added'))}</Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(sum(sec.rows, 'settled'))}</Table.Td>
                <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(sum(sec.rows, 'balance'))}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Box>
  );

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper p="lg" mb="md" withBorder shadow="sm" radius="md"
        style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <Box>
          <Title order={2} c="white">Outstanding Report</Title>
          <Text c="white" size="sm" opacity={0.9}>Track receivables and payables by date range</Text>
        </Box>
      </Paper>

      {/* Filters — From, To, Category, Generate · Print / Excel on the right */}
      <Paper p="md" withBorder shadow="sm" radius="md" mb="md">
        <Group align="flex-end" gap="md" justify="space-between">
          <Group align="flex-end" gap="md">
            <DateField label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 140 }} />
            <DateField label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 140 }} />
            <Select
              label="Category"
              data={CATEGORY_OPTS}
              value={category}
              onChange={(v) => setCategory(v || 'all')}
              allowDeselect={false}
              w={190}
            />
            <Button leftSection={<IconSearch size={16} />} onClick={handleGenerate} loading={loading} color="violet">
              Generate
            </Button>
          </Group>
          <Group gap="xs">
            <Button leftSection={<IconPrinter size={16} />} variant="light" color="gray" onClick={handlePrint} disabled={!hasRows}>
              Print
            </Button>
            <Button leftSection={<IconFileExport size={16} />} variant="light" color="teal" onClick={handleExport} disabled={!hasRows}>
              Excel Export
            </Button>
          </Group>
        </Group>
      </Paper>

      {result && (
        <>
          {/* Summary — three equal fields */}
          <Group gap="md" mb="md">
            <SummaryCard label="TO RECEIVE" value={totalReceivable} color="#40c057" />
            <SummaryCard label="TO PAY" value={totalPayable} color="#fa5252" />
            <SummaryCard label="NET POSITION" color={netPosition >= 0 ? '#228be6' : '#fd7e14'}>
              <Group gap={6} align="center" wrap="nowrap">
                {netPosition >= 0 ? <IconArrowUpRight size={16} color="#228be6" /> : <IconArrowDownRight size={16} color="#fd7e14" />}
                <Text size="lg" fw={700} c={netPosition >= 0 ? 'blue' : 'orange'}>{fmt(Math.abs(netPosition))}</Text>
                <Badge color={netPosition >= 0 ? 'blue' : 'orange'} variant="light" size="sm">
                  {netPosition >= 0 ? 'Favorable' : 'Unfavorable'}
                </Badge>
              </Group>
            </SummaryCard>
          </Group>

          {/* Distribution */}
          <Card withBorder p="lg" mb="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}><Group gap="xs"><IconChartBar size={20} />Outstanding Distribution</Group></Title>
              <Text size="sm" c="dimmed">Period: {periodText}</Text>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs"><IconTrendingUp size={14} color="green" /><Text size="sm">To Receive</Text></Group>
                <Text size="sm" fw={500}>{fmt(totalReceivable)}</Text>
              </Group>
              <Progress value={totalReceivable > 0 ? (totalReceivable / (totalReceivable + totalPayable)) * 100 : 0} color="green" size="lg" radius="xl" />
              <Group justify="space-between" mt="sm">
                <Group gap="xs"><IconTrendingDown size={14} color="red" /><Text size="sm">To Pay</Text></Group>
                <Text size="sm" fw={500}>{fmt(totalPayable)}</Text>
              </Group>
              <Progress value={totalPayable > 0 ? (totalPayable / (totalReceivable + totalPayable)) * 100 : 0} color="red" size="lg" radius="xl" />
            </Stack>
          </Card>

          {/* To Receive / To Pay sections — each category in its own grid */}
          {SIDES.map(side => {
            const secs = sideSections(side.key);
            if (!secs.length) return null;
            return (
              <Paper key={side.key} p="lg" withBorder shadow="sm" radius="md" mb="md" pos="relative">
                <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
                <Group justify="space-between" mb="md">
                  <Title order={4}>
                    <Group gap="xs">
                      {side.key === 'receive' ? <IconTrendingUp size={20} color={side.hex} /> : <IconTrendingDown size={20} color={side.hex} />}
                      {side.title}
                    </Group>
                  </Title>
                  <Text fw={700} c={side.color}>{fmt(sideTotal(side.key))}</Text>
                </Group>
                {secs.map(sec => renderCategory(sec, side))}
              </Paper>
            );
          })}
        </>
      )}

      {!result && (
        <Card p="xl" withBorder ta="center">
          <Stack align="center" gap="md">
            <IconCashBanknote size={48} color="gray" />
            <Text c="dimmed" size="lg">Select a date range and category, then click Generate</Text>
          </Stack>
        </Card>
      )}
    </Container>
  );
};

export default OutstandingReport;
