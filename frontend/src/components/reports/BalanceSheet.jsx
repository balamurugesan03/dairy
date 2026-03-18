import { useState, useRef } from 'react';
import {
  Box, Button, Card, Divider, Grid, Group, Loader, Paper, Stack,
  Table, Text, Title, Badge, Alert, ActionIcon, Tooltip
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh, IconAlertCircle, IconScale } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

const fmt = (amount) => {
  const v = parseFloat(amount || 0);
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
};

const getFinancialYear = (date) => {
  const d = dayjs(date);
  const month = d.month(); // 0=Jan
  const year = d.year();
  if (month >= 3) return `${year}-${(year + 1).toString().slice(2)}`;
  return `${year - 1}-${year.toString().slice(2)}`;
};

const SideTable = ({ title, color, items, capital, netProfit, showExtra }) => {
  // Build rows: items → then capital → then net profit (for liabilities side)
  const allItems = [...(items || [])];
  const extraItems = showExtra
    ? [
        ...(capital || []).map(c => ({ ...c, _group: 'Capital' })),
        ...(netProfit !== 0 ? [{ name: 'Net Profit from P&L A/c', amount: netProfit, _group: 'Profit' }] : [])
      ]
    : [];

  const allRows = [...allItems, ...extraItems];
  const grandTotal = allRows.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  return (
    <Card withBorder shadow="sm" radius="md" p={0} style={{ flex: 1 }}>
      {/* Side Header */}
      <Box bg={color} px="md" py="sm">
        <Text fw={700} size="sm" c="white" tt="uppercase" style={{ letterSpacing: 1 }}>
          {title}
        </Text>
      </Box>

      <Box p={0}>
        <Table highlightOnHover withColumnBorders style={{ fontSize: 13 }}>
          <Table.Thead bg="gray.0">
            <Table.Tr>
              <Table.Th w={36} ta="center" style={{ fontSize: 12 }}>#</Table.Th>
              <Table.Th>Ledger / Particulars</Table.Th>
              <Table.Th w={130} ta="right">Amount (₹)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allRows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3} ta="center" py="xl" c="dimmed">
                  No records found
                </Table.Td>
              </Table.Tr>
            )}
            {allRows.map((item, i) => (
              <Table.Tr key={i}>
                <Table.Td ta="center" c="dimmed" style={{ fontSize: 11 }}>{i + 1}</Table.Td>
                <Table.Td>
                  {item._group && (
                    <Badge size="xs" variant="light" color={item._group === 'Capital' ? 'violet' : 'green'} mr={6}>
                      {item._group}
                    </Badge>
                  )}
                  {item.name}
                </Table.Td>
                <Table.Td ta="right" c={parseFloat(item.amount) < 0 ? 'red' : 'dark'} fw={500}>
                  {parseFloat(item.amount) < 0 ? `(${fmt(item.amount)})` : fmt(item.amount)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr style={{ background: '#f1f3f5' }}>
              <Table.Td colSpan={2}>
                <Text fw={700} size="sm">GRAND TOTAL</Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fw={700} size="sm" c={grandTotal < 0 ? 'red' : color}>
                  ₹ {grandTotal < 0 ? `(${fmt(grandTotal)})` : fmt(grandTotal)}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Box>
    </Card>
  );
};

const getFYStart = (date = new Date()) => {
  const m = date.getMonth();
  const y = date.getFullYear();
  return new Date(m >= 3 ? y : y - 1, 3, 1); // April 1
};

const BalanceSheet = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState(null);
  const [fromDate, setFromDate] = useState(() => getFYStart());
  const [toDate,   setToDate]   = useState(() => new Date());
  const printRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.balanceSheet({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      setData(res.data);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch balance sheet', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const fy = getFinancialYear(toDate);
  const isBalanced = data ? Math.abs((data.totalLiabilitiesAndCapital || 0) - (data.totalAssets || 0)) < 0.01 : true;

  return (
    <Stack gap="md" p="md">
      {/* Page Header */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Title order={3} c="dark">Balance Sheet</Title>
          <Text size="sm" c="dimmed">Cooperative Society / ERP — Audit-Ready Format</Text>
        </Stack>
        <Group>
          {data && (
            <Tooltip label="Print Report">
              <ActionIcon variant="light" color="gray" size="lg" onClick={() => printReport(printRef, { title: 'Balance Sheet', orientation: 'landscape' })}>
                <IconPrinter size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {/* Controls */}
      <Paper withBorder p="sm" radius="md">
        <Group align="flex-end" gap="md">
          <DateInput
            label="From Date"
            value={fromDate}
            onChange={v => v && setFromDate(v)}
            valueFormat="DD-MM-YYYY"
            maxDate={new Date()}
            clearable={false}
            w={160}
          />
          <DateInput
            label="To Date"
            value={toDate}
            onChange={v => v && setToDate(v)}
            valueFormat="DD-MM-YYYY"
            maxDate={new Date()}
            clearable={false}
            w={160}
          />
          <Box>
            <Text size="xs" c="dimmed" mb={4}>Financial Year</Text>
            <Badge size="lg" variant="outline" color="blue" radius="sm">{fy}</Badge>
          </Box>
          <Button
            leftSection={loading ? <Loader size={14} color="white" /> : <IconRefresh size={16} />}
            onClick={fetchData}
            loading={loading}
            color="blue"
          >
            Generate Report
          </Button>
        </Group>
      </Paper>

      {/* Imbalance Warning */}
      {data && !isBalanced && (
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Balance Sheet Not Balanced">
          <Group gap="xl">
            <Text size="sm">Liabilities + Capital: ₹ {fmt(data.totalLiabilitiesAndCapital)}</Text>
            <Text size="sm">Assets: ₹ {fmt(data.totalAssets)}</Text>
            <Text size="sm" fw={600}>
              Difference: ₹ {fmt(Math.abs((data.totalLiabilitiesAndCapital || 0) - (data.totalAssets || 0)))}
            </Text>
          </Group>
        </Alert>
      )}

      {/* Balance indicator */}
      {data && isBalanced && (
        <Alert icon={<IconScale size={16} />} color="green" title="Balance Sheet is Balanced">
          <Text size="sm">Total Liabilities & Capital = Total Assets = ₹ {fmt(data.totalAssets)}</Text>
        </Alert>
      )}

      {/* Loading */}
      {loading && !data && (
        <Box ta="center" py="xl">
          <Loader size="md" />
          <Text mt="sm" c="dimmed">Loading balance sheet...</Text>
        </Box>
      )}

      {/* No Data */}
      {!loading && !data && (
        <Paper withBorder p="xl" ta="center" radius="md">
          <Text c="dimmed" size="sm">Click "Generate Report" to view the Balance Sheet</Text>
        </Paper>
      )}

      {/* Balance Sheet Report */}
      {data && (
        <Box ref={printRef}>
          {/* Report Title (print header) */}
          <Box ta="center" style={{ display: 'none' }} className="print-only">
            <Title order={2}>BALANCE SHEET AS ON {dayjs(toDate).format('DD-MMM-YYYY').toUpperCase()}</Title>
            <Text size="sm">Financial Year: {fy} | Period: {dayjs(fromDate).format('DD-MMM-YYYY')} to {dayjs(toDate).format('DD-MMM-YYYY')}</Text>
          </Box>

          {/* Summary Cards */}
          <Grid gutter="sm">
            <Grid.Col span={3}>
              <Card withBorder radius="md" p="sm" bg="blue.0">
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Liabilities</Text>
                <Text size="xl" fw={700} c="blue">₹ {fmt(data.totalLiabilities)}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder radius="md" p="sm" bg="violet.0">
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Capital</Text>
                <Text size="xl" fw={700} c="violet">₹ {fmt(data.totalCapital)}</Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder radius="md" p="sm" bg={data.netProfit >= 0 ? 'green.0' : 'red.0'}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Net Profit / Loss</Text>
                <Text size="xl" fw={700} c={data.netProfit >= 0 ? 'green' : 'red'}>
                  {data.netProfit < 0 ? '(' : ''}₹ {fmt(data.netProfit)}{data.netProfit < 0 ? ')' : ''}
                </Text>
              </Card>
            </Grid.Col>
            <Grid.Col span={3}>
              <Card withBorder radius="md" p="sm" bg="teal.0">
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Total Assets</Text>
                <Text size="xl" fw={700} c="teal">₹ {fmt(data.totalAssets)}</Text>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Report Date */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed" fw={500}>
              Period: <Text span fw={700} c="dark">{dayjs(fromDate).format('DD MMM YYYY')}</Text>
              {' to '}
              <Text span fw={700} c="dark">{dayjs(toDate).format('DD MMM YYYY')}</Text>
            </Text>
            <Text size="xs" c="dimmed">Generated: {dayjs().format('DD/MM/YYYY hh:mm A')}</Text>
          </Group>

          <Divider />

          {/* Two-Column Layout */}
          <Group align="flex-start" grow gap="md" style={{ alignItems: 'stretch' }}>
            {/* LIABILITIES SIDE (includes capital + net profit) */}
            <SideTable
              title="Liabilities"
              color="blue"
              items={data.liabilities}
              capital={data.capital}
              netProfit={data.netProfit}
              showExtra={true}
            />

            {/* ASSETS SIDE */}
            <SideTable
              title="Assets"
              color="teal"
              items={data.assets}
              showExtra={false}
              netProfit={0}
            />
          </Group>

          {/* Footer */}
          <Paper withBorder p="sm" radius="md">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Financial Year: {fy}</Text>
              <Text size="xs" c="dimmed" ta="center">This is a computer-generated report</Text>
              <Text size="xs" c="dimmed">Dairy Cooperative Management System</Text>
            </Group>
          </Paper>
        </Box>
      )}
    </Stack>
  );
};

export default BalanceSheet;
