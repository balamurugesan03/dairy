import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Group, Text, Title, Button, Table, ScrollArea,
  Badge, Stack, SimpleGrid, ThemeIcon, Loader, Center, Select
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconLeaf, IconCalendar, IconRefresh, IconFileExport, IconInbox, IconPrinter,
  IconChevronDown, IconChevronUp, IconX
} from '@tabler/icons-react';
import { printReport } from '../../utils/printReport';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI, subsidyAPI } from '../../services/api';

const fmt = (n, dec = 2) => parseFloat(n || 0).toFixed(dec);
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

const TH = { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#e65100', padding: '8px 10px', whiteSpace: 'nowrap', background: '#fff8e1' };
const TD = { padding: '6px 10px', fontSize: 12 };

const SubsidyReport = () => {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({ totalGroups: 0, totalTransactions: 0, totalSubsidyAmount: 0 });
  const [subsidyOptions, setSubsidyOptions] = useState([]);
  const [selectedSubsidy, setSelectedSubsidy] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);

  useEffect(() => {
    subsidyAPI.getAll({ status: 'Active' }).then(res => {
      const list = res.data || [];
      setSubsidyOptions(list.map(s => ({ value: s._id, label: `${s.subsidyName} (${s.subsidyType})` })));
    }).catch(() => {});
    fetchReport();
  }, []);

  const fetchReport = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      notifications.show({ title: 'Error', message: 'Please select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const params = {
        startDate: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        endDate: dayjs(dateRange[1]).format('YYYY-MM-DD')
      };
      if (selectedSubsidy) params.subsidyId = selectedSubsidy;

      const res = await reportAPI.subsidy(params);
      const data = res.data || res;
      setGroups(data.groups || []);
      setSummary(data.summary || { totalGroups: 0, totalTransactions: 0, totalSubsidyAmount: 0 });
      // Expand all groups by default
      const expanded = {};
      (data.groups || []).forEach(g => { expanded[g.subsidyName] = true; });
      setExpandedGroups(expanded);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch subsidy report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (name) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const allRows = groups.flatMap(g => g.rows || []);

  const handleExport = () => {
    if (!allRows.length) return;
    const data = allRows.map((r, i) => ({
      '#': i + 1,
      'Subsidy Name': r.subsidyName,
      'Subsidy Type': r.subsidyType,
      Date: fmtDate(r.date),
      'Invoice No': r.invoiceNo,
      Supplier: r.supplier,
      Product: r.product,
      Unit: r.unit,
      Qty: fmt(r.qty),
      Rate: fmt(r.rate),
      'Subsidy Amount (₹)': fmt(r.subsidyAmount)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subsidy Report');
    XLSX.writeFile(wb, `subsidy_report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Exported', message: 'Subsidy report exported to Excel', color: 'green' });
  };

  const periodLabel = dateRange[0] && dateRange[1]
    ? `${fmtDate(dateRange[0])} — ${fmtDate(dateRange[1])}`
    : '';

  return (
    <Box p="md" ref={printRef}>
      {/* Header */}
      <Paper radius="lg" mb="md" style={{ overflow: 'hidden', border: '1px solid #ffd54f' }}>
        <Box style={{ background: 'linear-gradient(90deg, #f57f17 0%, #f9a825 50%, #ffca28 100%)', padding: '10px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconLeaf size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Subsidy Report</Title>
                <Text size="xs" c="rgba(255,255,255,0.9)">Subsidy-wise purchase transaction details</Text>
              </Box>
            </Group>
            <Button
              variant="white"
              color="dark"
              leftSection={<IconX size={16} />}
              onClick={() => navigate('/')}
              size="sm"
            >
              Close
            </Button>
          </Group>
        </Box>

        {groups.length > 0 && (
          <Box px="xl" py="sm" style={{ background: 'linear-gradient(135deg, #fff8e1 0%, #fffde7 100%)' }}>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
              {[
                { label: 'Subsidy Types', value: summary.totalGroups, color: 'orange.8' },
                { label: 'Total Transactions', value: summary.totalTransactions, color: 'blue.8' },
                { label: 'Total Subsidy Amount', value: `₹${fmt(summary.totalSubsidyAmount)}`, color: 'green.8' }
              ].map(s => (
                <Box key={s.label} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                  <Text size="xs" c="dimmed" fw={600} tt="uppercase">{s.label}</Text>
                  <Text fw={800} c={s.color} size="sm">{s.value}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Paper>

      {/* Filters */}
      <Paper radius="md" p="md" mb="md" withBorder data-no-print>
        <Group gap="md" wrap="wrap" align="flex-end">
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="Pick date range"
            value={dateRange}
            onChange={setDateRange}
            leftSection={<IconCalendar size={16} />}
            style={{ flex: '2 1 250px' }}
            size="sm"
          />
          <Select
            label="Subsidy"
            placeholder="All Subsidies"
            data={subsidyOptions}
            value={selectedSubsidy}
            onChange={setSelectedSubsidy}
            searchable
            clearable
            style={{ flex: '2 1 220px' }}
            size="sm"
          />
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} color="orange" size="sm">
            Generate
          </Button>
          {allRows.length > 0 && (
            <>
              <Button leftSection={<IconFileExport size={16} />} variant="light" color="green" onClick={handleExport} size="sm">
                Export Excel
              </Button>
              <Button
                leftSection={<IconPrinter size={16} />} variant="outline" color="gray" size="sm"
                onClick={() => printReport(printRef, { title: `Subsidy Report — ${periodLabel}`, orientation: 'landscape' })}
              >
                Print A4
              </Button>
            </>
          )}
        </Group>
      </Paper>

      {/* Groups */}
      {loading ? (
        <Center py="xl"><Loader size="md" /></Center>
      ) : groups.length === 0 ? (
        <Paper radius="md" withBorder>
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconInbox size={40} color="#bdbdbd" />
              <Text c="dimmed" size="sm">No subsidy transactions found for this period</Text>
              <Text c="dimmed" size="xs">{periodLabel}</Text>
            </Stack>
          </Center>
        </Paper>
      ) : (
        <Stack gap="md">
          {groups.map(group => (
            <Paper key={group.subsidyName} radius="md" withBorder style={{ overflow: 'hidden' }}>
              {/* Group header */}
              <Box
                style={{ background: 'linear-gradient(90deg, #f57f17 0%, #f9a825 100%)', padding: '8px 16px', cursor: 'pointer' }}
                onClick={() => toggleGroup(group.subsidyName)}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <IconLeaf size={16} color="white" />
                    <Text fw={700} size="sm" c="white">{group.subsidyName}</Text>
                    <Badge size="sm" style={{ background: 'rgba(255,255,255,0.25)', color: 'white' }}>
                      {group.subsidyType}
                    </Badge>
                    <Badge size="sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                      {group.count} transaction{group.count !== 1 ? 's' : ''}
                    </Badge>
                  </Group>
                  <Group gap="md">
                    <Text size="sm" c="white" fw={700}>Total: ₹{fmt(group.totalAmount)}</Text>
                    {expandedGroups[group.subsidyName]
                      ? <IconChevronUp size={16} color="white" />
                      : <IconChevronDown size={16} color="white" />}
                  </Group>
                </Group>
              </Box>

              {/* Group rows */}
              {expandedGroups[group.subsidyName] && (
                <ScrollArea>
                  <Table withColumnBorders style={{ fontSize: 12 }}>
                    <Table.Thead>
                      <Table.Tr>
                        {['#', 'Date', 'Invoice No', 'Supplier', 'Product', 'Unit', 'Qty', 'Rate', 'Subsidy Amt'].map(col => (
                          <Table.Th key={col} style={TH}>{col}</Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(group.rows || []).map((row, ri) => (
                        <Table.Tr key={ri} style={{ background: ri % 2 === 0 ? '#ffffff' : '#fffde7' }}>
                          <Table.Td style={{ ...TD, color: '#9e9e9e' }}>{ri + 1}</Table.Td>
                          <Table.Td style={{ ...TD, whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</Table.Td>
                          <Table.Td style={TD}>
                            <Badge size="sm" variant="light" color="blue" style={{ fontFamily: 'monospace' }}>{row.invoiceNo}</Badge>
                          </Table.Td>
                          <Table.Td style={{ ...TD, fontWeight: 600 }}>{row.supplier}</Table.Td>
                          <Table.Td style={{ ...TD, fontWeight: 600 }}>{row.product}</Table.Td>
                          <Table.Td style={{ ...TD, textAlign: 'center' }}>
                            <Badge size="xs" variant="light" color="gray">{row.unit}</Badge>
                          </Table.Td>
                          <Table.Td style={{ ...TD, textAlign: 'right' }}>{fmt(row.qty)}</Table.Td>
                          <Table.Td style={{ ...TD, textAlign: 'right' }}>₹{fmt(row.rate)}</Table.Td>
                          <Table.Td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#388e3c' }}>₹{fmt(row.subsidyAmount)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr style={{ background: '#fff8e1' }}>
                        <Table.Td colSpan={8} style={{ padding: '6px 10px', fontWeight: 800, color: '#e65100', fontSize: 11 }}>
                          Subtotal — {group.subsidyName}
                        </Table.Td>
                        <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#388e3c' }}>
                          ₹{fmt(group.totalAmount)}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </ScrollArea>
              )}
            </Paper>
          ))}

          {/* Grand total */}
          <Paper radius="md" withBorder p="sm" style={{ background: '#fff8e1' }}>
            <Group justify="space-between">
              <Text fw={800} size="sm" c="#e65100">
                Grand Total — {summary.totalGroups} subsidy type{summary.totalGroups !== 1 ? 's' : ''}, {summary.totalTransactions} transactions
              </Text>
              <Text fw={800} size="md" c="#388e3c">₹{fmt(summary.totalSubsidyAmount)}</Text>
            </Group>
          </Paper>
        </Stack>
      )}
    </Box>
  );
};

export default SubsidyReport;
