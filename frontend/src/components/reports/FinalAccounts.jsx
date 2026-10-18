import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Divider, Group, Loader, Paper, Stack, Tabs, Text, Title,
  SegmentedControl
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconRefresh, IconPrinter, IconAlertCircle, IconScale, IconFileSpreadsheet,
  IconChartBar, IconTrendingUp, IconFileText, IconLayoutColumns
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { reportAPI, societyInfoAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import A4PrintPreview from './shared/A4PrintPreview';
import { buildTrading, buildProfitLoss, buildBalanceSheet } from './finalAccountsModel';
import {
  FA_FONT_IMPORT, FA_GRID_CSS, statementTableHtml, reportHeaderHtml,
  buildFinalAccountsPrintHtml, exportFinalAccountsExcel
} from './finalAccountsPrint';

const getFinancialYear = (date) => {
  const d = dayjs(date);
  const m = d.month();
  const y = d.year();
  return m >= 3 ? `${y}-${(y + 1).toString().slice(2)}` : `${y - 1}-${y.toString().slice(2)}`;
};

const NOTE_STYLE = {
  ok:     { color: 'green',  icon: <IconScale size={16} /> },
  warn:   { color: 'orange', icon: <IconAlertCircle size={16} /> },
  profit: { color: 'green',  icon: <IconTrendingUp size={16} /> },
  loss:   { color: 'red',    icon: <IconAlertCircle size={16} /> }
};

/* ── one statement: report header + grid (the same HTML as the print) ── */
const StatementView = ({ st, ctx, emptyText }) => {
  if (!st) return <Text c="dimmed" ta="center" py="xl">{emptyText}</Text>;
  const note = st.note && NOTE_STYLE[st.note.tone];
  return (
    <Stack gap="sm">
      <Paper withBorder p="md" radius={0} style={{ overflowX: 'auto', background: '#fff' }}>
        <Box
          className="fa-report"
          miw={900}
          dangerouslySetInnerHTML={{ __html: reportHeaderHtml(st, ctx) + statementTableHtml(st) }}
        />
      </Paper>
      {note && (
        <Alert icon={note.icon} color={note.color} py="xs">
          <Text fw={700} size="sm">{st.note.text}</Text>
        </Alert>
      )}
    </Stack>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const FinalAccounts = () => {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('trading');
  const [dataSource, setDataSource] = useState('dynamic'); // 'dynamic' | 'standard'
  const [printOpen, setPrintOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(fy, 3, 1);
  });
  const [endDate, setEndDate] = useState(new Date());
  const [loadedPeriod, setLoadedPeriod] = useState(null);
  const [raw, setRaw] = useState(null);
  const [registeredName, setRegisteredName] = useState('');

  // Registered name (with Reg. No., often Malayalam) for the 2nd header line
  useEffect(() => {
    societyInfoAPI.get()
      .then(res => setRegisteredName(res?.data?.info?.registeredName || ''))
      .catch(() => {});
  }, [selectedCompany?._id]);

  const societyName = selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society';
  const fy = getFinancialYear(loadedPeriod?.startDate || startDate);
  const headerCtx = { shortName: societyName, registeredName, financialYear: fy };

  // Balance Sheet tab: As On only — the period runs from 1 April of that financial year
  const isBsTab = activeTab === 'bs';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const from = isBsTab ? `${getFinancialYear(endDate).slice(0, 4)}-04-01` : dayjs(startDate).format('YYYY-MM-DD');
      if (isBsTab) setStartDate(dayjs(from).toDate());
      const params = {
        startDate: from,
        endDate: dayjs(endDate).format('YYYY-MM-DD')
      };

      const [trading, pl, bs, tradingV2, plV2, bsV2] = await Promise.all([
        reportAPI.tradingAccount(params),
        reportAPI.profitLoss(params),
        reportAPI.balanceSheet(params),
        reportAPI.tradingAccountV2(params),
        reportAPI.profitLossV2(params),
        reportAPI.balanceSheetV2(params)
      ]);

      setRaw({
        standard: { trading: trading?.data || null, pl: pl?.data || null, bs: bs?.data || null },
        dynamic:  { trading: tradingV2?.data || null, pl: plV2?.data || null, bs: bsV2?.data || null }
      });
      setLoadedPeriod({ startDate: params.startDate, endDate: params.endDate });

      notifications.show({ title: 'Done', message: 'Final accounts loaded', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to load', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const statements = useMemo(() => {
    const src = raw?.[dataSource];
    if (!src) return null;
    return {
      trading: buildTrading(src.trading, dataSource, loadedPeriod),
      pl:      buildProfitLoss(src.pl, dataSource, loadedPeriod),
      bs:      buildBalanceSheet(src.bs, dataSource, loadedPeriod)
    };
  }, [raw, dataSource, loadedPeriod]);

  const hasData = !!statements && !!(statements.trading || statements.pl || statements.bs);

  // Print / export the open tab; Combined View covers all three statements.
  const selected = () => (activeTab === 'combined' || !statements?.[activeTab]
    ? [statements?.trading, statements?.pl, statements?.bs]
    : [statements[activeTab]]);

  const printHtml = useMemo(() => {
    if (!printOpen || !statements) return '';
    return buildFinalAccountsPrintHtml(selected(), {
      ...headerCtx,
      generatedOn: dayjs().format('DD/MM/YYYY HH:mm:ss')
    }, 'landscape');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printOpen, statements, activeTab, societyName, registeredName, fy]);

  const handleExport = () => {
    exportFinalAccountsExcel(selected(), headerCtx,
      `final_accounts_${activeTab}_${dataSource}_${dayjs(loadedPeriod?.endDate).format('YYYY-MM-DD')}.xlsx`);
  };

  return (
    <Stack gap="md" p="md">
      <style>{FA_FONT_IMPORT + FA_GRID_CSS}</style>

      {/* Header */}
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={3}>Final Accounts</Title>
          <Text size="sm" c="dimmed">Trading Account · Profit & Loss · Balance Sheet</Text>
        </Stack>
        {hasData && (
          <Group gap="xs">
            <Button variant="light" color="green" leftSection={<IconFileSpreadsheet size={16} />} onClick={handleExport}>
              Export
            </Button>
            <Button variant="light" color="dark" leftSection={<IconPrinter size={16} />} onClick={() => setPrintOpen(true)}>
              Print
            </Button>
          </Group>
        )}
      </Group>

      {/* Filters — one row: From Date, To Date, Generate (Balance Sheet: As On Date, Generate) */}
      <Paper withBorder p="sm" radius="md">
        <Group align="flex-end" gap="md" wrap="nowrap" style={{ overflowX: 'auto' }}>
          {!isBsTab && (
            <DateInput
              label="From Date"
              value={startDate}
              onChange={setStartDate}
              valueFormat="DD/MM/YYYY"
              clearable={false}
              w={160}
            />
          )}
          <DateInput
            label={isBsTab ? 'As On Date' : 'To Date'}
            value={endDate}
            onChange={setEndDate}
            valueFormat="DD/MM/YYYY"
            clearable={false}
            w={160}
          />
          <Button
            leftSection={loading ? <Loader size={14} color="white" /> : <IconRefresh size={16} />}
            onClick={fetchAll}
            loading={loading}
            color="blue"
          >
            Generate
          </Button>
          <Box>
            <Text size="xs" c="dimmed" mb={4}>Data Source</Text>
            <SegmentedControl
              size="xs"
              value={dataSource}
              onChange={setDataSource}
              data={[
                { value: 'dynamic',  label: 'Dynamic' },
                { value: 'standard', label: 'Standard' }
              ]}
            />
          </Box>
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
            Select a date range and click "Generate" to view the Final Accounts
          </Text>
        </Paper>
      )}

      {/* Tabs */}
      {hasData && (
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
            <StatementView st={statements.trading} ctx={headerCtx} emptyText="No trading data available" />
          </Tabs.Panel>

          <Tabs.Panel value="pl" pt="md">
            <StatementView st={statements.pl} ctx={headerCtx} emptyText="No profit & loss data available" />
          </Tabs.Panel>

          <Tabs.Panel value="bs" pt="md">
            <StatementView st={statements.bs} ctx={headerCtx} emptyText="No balance sheet data available" />
          </Tabs.Panel>

          <Tabs.Panel value="combined" pt="md">
            <Stack gap="xl">
              {['trading', 'pl', 'bs'].map((k, i) => (
                <Box key={k}>
                  {i > 0 && <Divider mb="md" />}
                  <StatementView st={statements[k]} ctx={headerCtx} emptyText="No data" />
                </Box>
              ))}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      )}

      {/* Print preview — the iframe shows the exact A4 document that gets printed */}
      <A4PrintPreview
        html={printHtml}
        orientation={printOpen ? 'landscape' : null}
        title="Final Accounts"
        onClose={() => setPrintOpen(false)}
      />
    </Stack>
  );
};

export default FinalAccounts;
