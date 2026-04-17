import { useState, useRef } from 'react';
import {
  Alert, Badge, Box, Button, Card, Divider, Grid, Group,
  Loader, Paper, Stack, Table, Tabs, Text, Title, ActionIcon, Tooltip
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconRefresh, IconPrinter, IconAlertCircle, IconScale,
  IconChartBar, IconTrendingUp, IconFileText, IconLayoutColumns
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

/* ── helpers ────────────────────────────────────────────────── */
const fmt = (v) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(parseFloat(v || 0))
  );
const neg = (v) => parseFloat(v || 0) < 0;

const getFinancialYear = (date) => {
  const d = dayjs(date);
  const m = d.month();
  const y = d.year();
  return m >= 3 ? `${y}-${(y + 1).toString().slice(2)}` : `${y - 1}-${y.toString().slice(2)}`;
};

/* ── reusable two-column wrapper ────────────────────────────── */
const TwoCol = ({ left, right }) => (
  <Group align="flex-start" grow gap="md" style={{ alignItems: 'stretch' }}>
    {left}
    {right}
  </Group>
);

/* ── side panel card ────────────────────────────────────────── */
const SideCard = ({ title, color, children, footer }) => (
  <Card withBorder shadow="sm" radius="md" p={0} style={{ flex: 1 }}>
    <Box bg={color} px="md" py="xs">
      <Text fw={700} size="sm" c="white" tt="uppercase" style={{ letterSpacing: 1 }}>
        {title}
      </Text>
    </Box>
    <Box>{children}</Box>
    {footer && (
      <Box bg="gray.1" px="md" py="xs" style={{ borderTop: '1px solid #dee2e6' }}>
        {footer}
      </Box>
    )}
  </Card>
);

/* ── simple table row types ─────────────────────────────────── */
const GroupHeader = ({ label, no }) => (
  <Table.Tr bg="gray.0">
    <Table.Td w={32} ta="center" c="dimmed" style={{ fontSize: 11 }}>{no}</Table.Td>
    <Table.Td colSpan={2}><Text fw={700} size="sm">{label}</Text></Table.Td>
  </Table.Tr>
);

const ItemRow = ({ label, amount, indent }) => (
  <Table.Tr>
    <Table.Td />
    <Table.Td pl={indent ? 28 : 12}>{label}</Table.Td>
    <Table.Td ta="right" w={130} c={neg(amount) ? 'red' : 'dark'} fw={500}>
      {neg(amount) ? `(${fmt(amount)})` : fmt(amount)}
    </Table.Td>
  </Table.Tr>
);

const SubtotalRow = ({ label, amount }) => (
  <Table.Tr bg="blue.0">
    <Table.Td />
    <Table.Td pl={28}><Text fw={600} size="sm">{label}</Text></Table.Td>
    <Table.Td ta="right" w={130}>
      <Text fw={700} size="sm" c="blue">{neg(amount) ? `(${fmt(amount)})` : fmt(amount)}</Text>
    </Table.Td>
  </Table.Tr>
);

const GrandTotalRow = ({ label, amount, color = 'dark' }) => (
  <Table.Tr bg="dark" style={{ borderTop: '2px solid #343a40' }}>
    <Table.Td colSpan={2} pl={12}><Text fw={800} size="sm" c="white">{label}</Text></Table.Td>
    <Table.Td ta="right" w={130}>
      <Text fw={800} size="sm" c="yellow">{neg(amount) ? `(${fmt(amount)})` : fmt(amount)}</Text>
    </Table.Td>
  </Table.Tr>
);

const SpecialRow = ({ label, amount, color = 'green' }) => (
  <Table.Tr bg={`${color}.0`}>
    <Table.Td colSpan={2} pl={12}><Text fw={700} size="sm" c={color}>{label}</Text></Table.Td>
    <Table.Td ta="right" w={130}>
      <Text fw={700} size="sm" c={color}>{neg(amount) ? `(${fmt(amount)})` : fmt(amount)}</Text>
    </Table.Td>
  </Table.Tr>
);

/* ══════════════════════════════════════════════════════════════
   TRADING ACCOUNT
══════════════════════════════════════════════════════════════ */
const TradingAccount = ({ data, period }) => {
  if (!data) return null;
  const { debitSide, creditSide, totals } = data;
  const periodLabel = period
    ? `${dayjs(period.startDate).format('DD-MMM-YYYY')} to ${dayjs(period.endDate).format('DD-MMM-YYYY')}`
    : '';

  const BaseTable = ({ children }) => (
    <Table withColumnBorders style={{ fontSize: 13 }}>
      <Table.Thead bg="gray.0">
        <Table.Tr>
          <Table.Th w={32} ta="center" style={{ fontSize: 11 }}>#</Table.Th>
          <Table.Th>Particulars</Table.Th>
          <Table.Th w={130} ta="right">Amount (₹)</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  );

  return (
    <Stack gap="sm">
      <Box ta="center">
        <Text fw={700} size="md">TRADING ACCOUNT</Text>
        {periodLabel && <Text size="sm" c="dimmed">Period: {periodLabel}</Text>}
      </Box>

      <TwoCol
        left={
          <SideCard title="Dr. — Expenditure / Purchases" color="blue">
            <BaseTable>
              <GroupHeader no={1} label="Opening Stock" />
              <ItemRow label="Total Opening Stock" amount={debitSide?.openingStock?.total || 0} />
              <SubtotalRow label="Total Opening Stock" amount={debitSide?.openingStock?.total || 0} />

              <GroupHeader no={2} label="Milk Purchase (Dairy)" />
              <ItemRow
                label={`Milk Purchase — ${debitSide?.milkPurchase?.farmerCount || 0} Farmers (${(debitSide?.milkPurchase?.qty || 0).toFixed(2)} L)`}
                amount={debitSide?.milkPurchase?.total || 0}
                indent
              />
              <SubtotalRow label="Total Milk Purchase" amount={debitSide?.milkPurchase?.total || 0} />

              {(debitSide?.purchases?.items || []).length > 0 && (
                <>
                  <GroupHeader no={3} label="Other Purchases" />
                  {(debitSide.purchases.items).map((it, i) => (
                    <ItemRow key={i} label={it.ledgerName} amount={it.amount} indent />
                  ))}
                  <SubtotalRow label="Total Other Purchases" amount={debitSide?.purchases?.total || 0} />
                </>
              )}

              <GroupHeader no={4} label="Trade / Establishment Expenses" />
              {(debitSide?.tradeExpenses?.items || []).map((it, i) => (
                <ItemRow key={i} label={it.ledgerName} amount={it.amount} indent />
              ))}
              <SubtotalRow label="Total Expenses" amount={debitSide?.tradeExpenses?.total || 0} />

              {parseFloat(debitSide?.grossProfit || 0) > 0 && (
                <SpecialRow label="Gross Profit c/o to P&L A/c" amount={debitSide.grossProfit} color="green" />
              )}
              <GrandTotalRow label="GRAND TOTAL" amount={totals?.debitTotal || 0} />
            </BaseTable>
          </SideCard>
        }
        right={
          <SideCard title="Cr. — Sales / Income" color="teal">
            <BaseTable>
              <GroupHeader no={1} label="Milk Sales (Dairy)" />
              <ItemRow label="Milk Sales to Customers / Local" amount={creditSide?.milkSales?.total || 0} indent />
              <SubtotalRow label="Total Milk Sales" amount={creditSide?.milkSales?.total || 0} />

              {(creditSide?.unionSales?.total || 0) > 0 && (
                <>
                  <GroupHeader no={2} label="Union / Society Sales Slips" />
                  <ItemRow label="Union Sales Slips" amount={creditSide.unionSales.total} indent />
                  <SubtotalRow label="Total Union Sales" amount={creditSide.unionSales.total} />
                </>
              )}

              {(creditSide?.sales?.items || []).length > 0 && (
                <>
                  <GroupHeader no={3} label="Other Sales" />
                  {creditSide.sales.items.map((it, i) => (
                    <ItemRow key={i} label={it.ledgerName} amount={it.amount} indent />
                  ))}
                  <SubtotalRow label="Total Other Sales" amount={creditSide?.sales?.total || 0} />
                </>
              )}

              {(creditSide?.tradeIncome?.items || []).length > 0 && (
                <>
                  <GroupHeader no={4} label="Trade Income" />
                  {creditSide.tradeIncome.items.map((it, i) => (
                    <ItemRow key={i} label={it.ledgerName} amount={it.amount} indent />
                  ))}
                  <SubtotalRow label="Total Trade Income" amount={creditSide?.tradeIncome?.total || 0} />
                </>
              )}

              <GroupHeader no={5} label="Closing Stock" />
              {(creditSide?.closingStock?.items || []).map((it, i) => (
                <ItemRow key={i} label={it.category} amount={it.amount} indent />
              ))}
              <SubtotalRow label="Total Closing Stock" amount={creditSide?.closingStock?.total || 0} />

              {parseFloat(creditSide?.grossLoss || 0) > 0 && (
                <SpecialRow label="Gross Loss c/o to P&L A/c" amount={creditSide.grossLoss} color="red" />
              )}
              <GrandTotalRow label="GRAND TOTAL" amount={totals?.creditTotal || 0} />
            </BaseTable>
          </SideCard>
        }
      />
    </Stack>
  );
};

/* ══════════════════════════════════════════════════════════════
   PROFIT & LOSS
══════════════════════════════════════════════════════════════ */
const ProfitLoss = ({ data }) => {
  if (!data) return null;
  const { income, totalIncome, expenses, totalExpense, netProfit } = data;
  const isProfit = netProfit >= 0;

  const BaseTable = ({ children }) => (
    <Table withColumnBorders style={{ fontSize: 13 }}>
      <Table.Thead bg="gray.0">
        <Table.Tr>
          <Table.Th w={32} ta="center" style={{ fontSize: 11 }}>#</Table.Th>
          <Table.Th>Particulars</Table.Th>
          <Table.Th w={130} ta="right">Amount (₹)</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  );

  return (
    <Stack gap="sm">
      <Box ta="center">
        <Text fw={700} size="md">PROFIT & LOSS ACCOUNT</Text>
        <Text size="sm" c="dimmed">Based on current ledger balances</Text>
      </Box>

      <TwoCol
        left={
          <SideCard title="Dr. — Expenses" color="red.7">
            <BaseTable>
              <GroupHeader no={1} label="Expenses" />
              {(expenses || []).map((it, i) => (
                <ItemRow key={i} label={it.name} amount={it.amount} indent />
              ))}
              <SubtotalRow label="Total Expenses" amount={totalExpense} />

              {/* Net Profit carried to Balance Sheet */}
              {isProfit && (
                <SpecialRow label="Net Profit (c/o to Balance Sheet)" amount={netProfit} color="green" />
              )}

              <GrandTotalRow
                label="GRAND TOTAL"
                amount={isProfit ? (totalExpense + netProfit) : totalExpense}
              />
            </BaseTable>
          </SideCard>
        }
        right={
          <SideCard title="Cr. — Income" color="green.7">
            <BaseTable>
              <GroupHeader no={1} label="Income" />
              {(income || []).map((it, i) => (
                <ItemRow key={i} label={it.name} amount={it.amount} indent />
              ))}
              <SubtotalRow label="Total Income" amount={totalIncome} />

              {/* Net Loss carried to Balance Sheet */}
              {!isProfit && (
                <SpecialRow label="Net Loss (c/o to Balance Sheet)" amount={Math.abs(netProfit)} color="red" />
              )}

              <GrandTotalRow
                label="GRAND TOTAL"
                amount={!isProfit ? (totalIncome + Math.abs(netProfit)) : totalIncome}
              />
            </BaseTable>
          </SideCard>
        }
      />

      {/* Net Profit / Loss summary */}
      <Card withBorder radius="md" p="sm" bg={isProfit ? 'green.0' : 'red.0'}>
        <Group justify="center" gap="xl">
          <Text fw={700} c={isProfit ? 'green' : 'red'} size="lg">
            {isProfit ? 'NET PROFIT' : 'NET LOSS'}: ₹ {fmt(netProfit)}
          </Text>
          <Badge color={isProfit ? 'green' : 'red'} size="lg">
            {isProfit ? 'Profitable' : 'Loss-Making'}
          </Badge>
        </Group>
      </Card>
    </Stack>
  );
};

/* ══════════════════════════════════════════════════════════════
   BALANCE SHEET
══════════════════════════════════════════════════════════════ */
const BalanceSheetSection = ({ data }) => {
  if (!data) return null;
  const { assets, totalAssets, liabilities, totalLiabilities, capital, totalCapital, netProfit, totalLiabilitiesAndCapital, isTallied } = data;

  const BaseTable = ({ children }) => (
    <Table withColumnBorders style={{ fontSize: 13 }}>
      <Table.Thead bg="gray.0">
        <Table.Tr>
          <Table.Th w={32} ta="center" style={{ fontSize: 11 }}>#</Table.Th>
          <Table.Th>Particulars</Table.Th>
          <Table.Th w={130} ta="right">Amount (₹)</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{children}</Table.Tbody>
    </Table>
  );

  // Build liability+capital items
  const liabRow = (it, i) => <ItemRow key={i} label={it.name} amount={it.amount} indent />;
  const capRow = (it, i) => <ItemRow key={`cap-${i}`} label={it.name} amount={it.amount} indent />;

  return (
    <Stack gap="sm">
      <Box ta="center">
        <Text fw={700} size="md">BALANCE SHEET</Text>
        <Text size="sm" c="dimmed">As on {dayjs().format('DD MMMM YYYY')}</Text>
      </Box>

      {!isTallied && (
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Not Balanced">
          Liabilities + Capital (₹ {fmt(totalLiabilitiesAndCapital)}) ≠ Assets (₹ {fmt(totalAssets)}) |
          Difference: ₹ {fmt(Math.abs((totalLiabilitiesAndCapital || 0) - (totalAssets || 0)))}
        </Alert>
      )}

      <TwoCol
        left={
          <SideCard title="Liabilities & Capital" color="blue">
            <BaseTable>
              {/* Liabilities */}
              {(liabilities || []).length > 0 && (
                <>
                  <GroupHeader no={1} label="Liabilities" />
                  {(liabilities || []).map(liabRow)}
                  <SubtotalRow label="Total Liabilities" amount={totalLiabilities} />
                </>
              )}

              {/* Capital */}
              {(capital || []).length > 0 && (
                <>
                  <GroupHeader no={2} label="Capital" />
                  {(capital || []).map(capRow)}
                  <SubtotalRow label="Total Capital" amount={totalCapital} />
                </>
              )}

              {/* Net Profit from P&L */}
              <Table.Tr bg="green.0">
                <Table.Td />
                <Table.Td pl={12}>
                  <Text fw={600} size="sm" c="green">Net Profit from P&L A/c</Text>
                </Table.Td>
                <Table.Td ta="right" w={130}>
                  <Text fw={700} size="sm" c={netProfit >= 0 ? 'green' : 'red'}>
                    {netProfit < 0 ? `(${fmt(netProfit)})` : fmt(netProfit)}
                  </Text>
                </Table.Td>
              </Table.Tr>

              <GrandTotalRow label="GRAND TOTAL" amount={totalLiabilitiesAndCapital} />
            </BaseTable>
          </SideCard>
        }
        right={
          <SideCard title="Assets" color="teal">
            <BaseTable>
              <GroupHeader no={1} label="Assets" />
              {(assets || []).map((it, i) => (
                <ItemRow key={i} label={it.name} amount={it.amount} indent />
              ))}
              <SubtotalRow label="Total Assets" amount={totalAssets} />
              <GrandTotalRow label="GRAND TOTAL" amount={totalAssets} />
            </BaseTable>
          </SideCard>
        }
      />

      {isTallied && (
        <Alert icon={<IconScale size={16} />} color="green" title="Balance Sheet Tallied">
          Total Liabilities & Capital = Total Assets = ₹ {fmt(totalAssets)}
        </Alert>
      )}
    </Stack>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const FinalAccounts = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trading');
  const printRef = useRef(null);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(fy, 3, 1); // 1 April
  });
  const [endDate, setEndDate] = useState(new Date());

  const [tradingData, setTradingData] = useState(null);
  const [plData, setPlData] = useState(null);
  const [bsData, setBsData] = useState(null);

  const fy = getFinancialYear(startDate);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(startDate).format('YYYY-MM-DD'),
        endDate: dayjs(endDate).format('YYYY-MM-DD')
      };

      const [trading, pl, bs] = await Promise.all([
        reportAPI.tradingAccount(params),
        reportAPI.profitLoss(params),
        reportAPI.balanceSheet(params)
      ]);

      setTradingData(trading?.data || null);
      setPlData(pl?.data || null);
      setBsData(bs?.data || null);

      notifications.show({ title: 'Done', message: 'Final accounts loaded', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const hasData = tradingData || plData || bsData;

  return (
    <Stack gap="md" p="md">
      {/* Header */}
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={3}>Final Accounts</Title>
          <Text size="sm" c="dimmed">Trading Account · Profit & Loss · Balance Sheet</Text>
        </Stack>
        {hasData && (
          <Tooltip label="Print">
            <ActionIcon variant="light" color="gray" size="lg" onClick={() => printReport(printRef, { title: 'Final Accounts', orientation: 'landscape' })}>
              <IconPrinter size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* Filters */}
      <Paper withBorder p="sm" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <DateInput
            label="From Date"
            value={startDate}
            onChange={setStartDate}
            valueFormat="DD-MM-YYYY"
            clearable={false}
            w={160}
          />
          <DateInput
            label="To Date"
            value={endDate}
            onChange={setEndDate}
            valueFormat="DD-MM-YYYY"
            clearable={false}
            w={160}
          />
          <Box>
            <Text size="xs" c="dimmed" mb={4}>Financial Year</Text>
            <Badge size="lg" variant="outline" color="blue" radius="sm">{fy}</Badge>
          </Box>
          <Button
            leftSection={loading ? <Loader size={14} color="white" /> : <IconRefresh size={16} />}
            onClick={fetchAll}
            loading={loading}
            color="blue"
          >
            Generate All
          </Button>
        </Group>
      </Paper>

      {/* Loading / No Data */}
      {loading && !hasData && (
        <Box ta="center" py="xl">
          <Loader size="md" />
          <Text mt="sm" c="dimmed">Loading final accounts...</Text>
        </Box>
      )}
      {!loading && !hasData && (
        <Paper withBorder p="xl" ta="center" radius="md">
          <Text c="dimmed" size="sm">
            Select a date range and click "Generate All" to view the Final Accounts
          </Text>
        </Paper>
      )}

      {/* Tabs */}
      {hasData && (
        <Box ref={printRef}>
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="trading" leftSection={<IconChartBar size={16} />}>
              Trading Account
            </Tabs.Tab>
            <Tabs.Tab value="pl" leftSection={<IconTrendingUp size={16} />}>
              Profit & Loss
            </Tabs.Tab>
            <Tabs.Tab value="bs" leftSection={<IconFileText size={16} />}>
              Balance Sheet
            </Tabs.Tab>
            <Tabs.Tab value="combined" leftSection={<IconLayoutColumns size={16} />}>
              Combined View
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="trading" pt="md">
            {tradingData
              ? <TradingAccount data={tradingData} period={tradingData.period} />
              : <Text c="dimmed" ta="center" py="xl">No trading data available</Text>
            }
          </Tabs.Panel>

          <Tabs.Panel value="pl" pt="md">
            {plData
              ? <ProfitLoss data={plData} />
              : <Text c="dimmed" ta="center" py="xl">No profit & loss data available</Text>
            }
          </Tabs.Panel>

          <Tabs.Panel value="bs" pt="md">
            {bsData
              ? <BalanceSheetSection data={bsData} />
              : <Text c="dimmed" ta="center" py="xl">No balance sheet data available</Text>
            }
          </Tabs.Panel>

          <Tabs.Panel value="combined" pt="md">
            <Stack gap="xl">
              <Box>
                <Divider label={<Text fw={700} size="sm">TRADING ACCOUNT</Text>} labelPosition="center" mb="md" />
                {tradingData
                  ? <TradingAccount data={tradingData} period={tradingData.period} />
                  : <Text c="dimmed" ta="center">No data</Text>
                }
              </Box>
              <Box>
                <Divider label={<Text fw={700} size="sm">PROFIT & LOSS ACCOUNT</Text>} labelPosition="center" mb="md" />
                {plData
                  ? <ProfitLoss data={plData} />
                  : <Text c="dimmed" ta="center">No data</Text>
                }
              </Box>
              <Box>
                <Divider label={<Text fw={700} size="sm">BALANCE SHEET</Text>} labelPosition="center" mb="md" />
                {bsData
                  ? <BalanceSheetSection data={bsData} />
                  : <Text c="dimmed" ta="center">No data</Text>
                }
              </Box>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}

      {/* Footer */}
      {hasData && (
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">Financial Year: {fy}</Text>
            <Text size="xs" c="dimmed">This is a computer-generated report</Text>
            <Text size="xs" c="dimmed">Generated: {dayjs().format('DD/MM/YYYY hh:mm A')}</Text>
          </Group>
        </Paper>
      )}
        </Box>
      )}
    </Stack>
  );
};

export default FinalAccounts;
