import { useState, useEffect } from 'react';
import {
  Box, Paper, Group, Text, Title, Button, Table, ScrollArea,
  Badge, Stack, SimpleGrid, ThemeIcon, Loader, Center, Divider
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconLeaf, IconCalendar, IconRefresh, IconFileExport, IconInbox
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { reportAPI } from '../../services/api';

const fmt = (n, dec = 2) => parseFloat(n || 0).toFixed(dec);
const fmtDate = (d) => d ? dayjs(d).format('DD-MM-YYYY') : '-';

const SubsidyReport = () => {
  const [loading, setLoading] = useState(false);
  const [subsidyData, setSubsidyData] = useState([]);
  const [summary, setSummary] = useState({ totalFarmers: 0, totalMilkAmount: 0, totalSubsidy: 0, totalNetPayable: 0 });
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      notifications.show({ title: 'Error', message: 'Please select a date range', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await reportAPI.subsidy({
        startDate: dayjs(dateRange[0]).toISOString(),
        endDate: dayjs(dateRange[1]).toISOString()
      });
      const data = res.data || res;
      const subsidies = data.subsidies || (Array.isArray(data) ? data : []);
      setSubsidyData(subsidies);
      setSummary(data.summary || {
        totalFarmers: subsidies.length,
        totalMilkAmount: subsidies.reduce((s, r) => s + (r.milkAmount || 0), 0),
        totalSubsidy: subsidies.reduce((s, r) => s + (r.subsidyAmount || 0), 0),
        totalNetPayable: subsidies.reduce((s, r) => s + (r.netPayable || 0), 0)
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to fetch subsidy report', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!subsidyData.length) return;
    const data = subsidyData.map(item => ({
      'Farmer No': item.farmerNumber || '-',
      'Farmer Name': item.farmerName || '-',
      'Aadhaar': item.aadhaar || '-',
      'Ksheerasree ID': item.ksheerasreeId || '-',
      'Payment Date': fmtDate(item.paymentDate),
      'Milk Amount (₹)': fmt(item.milkAmount),
      'Subsidy Amount (₹)': fmt(item.subsidyAmount),
      'Net Payable (₹)': fmt(item.netPayable)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subsidy Register');
    XLSX.writeFile(wb, `subsidy_register_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    notifications.show({ title: 'Success', message: 'Exported to Excel', color: 'green' });
  };

  return (
    <Box p="md">
      {/* Header */}
      <Paper radius="lg" mb="md" style={{ background: 'linear-gradient(135deg, #fff8e1 0%, #ffe082 40%, #ffffff 100%)', border: '1px solid #ffd54f', overflow: 'hidden' }}>
        <Box style={{ background: 'linear-gradient(90deg, #f57f17 0%, #f9a825 50%, #ffca28 100%)', padding: '10px 20px' }}>
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconLeaf size={22} color="white" />
              </ThemeIcon>
              <Box>
                <Title order={4} c="white" style={{ lineHeight: 1.1 }}>Subsidy Register</Title>
                <Text size="xs" c="rgba(255,255,255,0.9)">Farmer subsidy payment details</Text>
              </Box>
            </Group>
          </Group>
        </Box>

        <Box px="xl" py="sm">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {[
              { label: 'Total Farmers', value: summary.totalFarmers, color: 'orange.8' },
              { label: 'Milk Amount', value: `₹${fmt(summary.totalMilkAmount)}`, color: 'blue.8' },
              { label: 'Subsidy Amount', value: `₹${fmt(summary.totalSubsidy)}`, color: 'green.8' },
              { label: 'Net Payable', value: `₹${fmt(summary.totalNetPayable)}`, color: 'teal.8' }
            ].map(s => (
              <Box key={s.label} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">{s.label}</Text>
                <Text fw={800} c={s.color} size="sm">{s.value}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </Paper>

      {/* Filters */}
      <Paper radius="md" p="md" mb="md" withBorder>
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
          <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} loading={loading} color="orange" size="sm">
            Generate
          </Button>
          {subsidyData.length > 0 && (
            <Button leftSection={<IconFileExport size={16} />} variant="light" color="green" onClick={handleExport} size="sm">
              Export Excel
            </Button>
          )}
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'hidden' }}>
        <Box style={{ background: 'linear-gradient(90deg, #f57f17 0%, #f9a825 100%)', padding: '10px 16px' }}>
          <Group justify="space-between">
            <Text fw={700} size="sm" c="white">Subsidy Details</Text>
            {dateRange[0] && dateRange[1] && (
              <Text size="xs" c="rgba(255,255,255,0.9)">
                {fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}
              </Text>
            )}
          </Group>
        </Box>

        <ScrollArea>
          {loading ? (
            <Center py="xl"><Loader size="md" /></Center>
          ) : subsidyData.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconInbox size={40} color="#bdbdbd" />
                <Text c="dimmed" size="sm">No subsidy records found for this period</Text>
                <Text c="dimmed" size="xs">{fmtDate(dateRange[0])} — {fmtDate(dateRange[1])}</Text>
              </Stack>
            </Center>
          ) : (
            <Table striped highlightOnHover withColumnBorders style={{ fontSize: 12 }}>
              <Table.Thead style={{ background: 'linear-gradient(180deg, #fff8e1 0%, #ffe082 100%)' }}>
                <Table.Tr>
                  {['#', 'Farmer No', 'Farmer Name', 'Aadhaar', 'Ksheerasree ID', 'Payment Date', 'Milk Amount', 'Subsidy Amt', 'Net Payable'].map(col => (
                    <Table.Th key={col} style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#e65100', padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      {col}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subsidyData.map((item, idx) => (
                  <Table.Tr key={item._id || idx}>
                    <Table.Td style={{ padding: '6px 10px', color: '#e65100', fontWeight: 700 }}>{idx + 1}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px' }}>
                      <Badge size="sm" variant="light" color="orange">{item.farmerNumber || '-'}</Badge>
                    </Table.Td>
                    <Table.Td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.farmerName || '-'}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px' }}>{item.aadhaar || '-'}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px' }}>{item.ksheerasreeId || '-'}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmtDate(item.paymentDate)}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px', textAlign: 'right' }}>₹{fmt(item.milkAmount)}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px', textAlign: 'right', color: '#388e3c' }}>₹{fmt(item.subsidyAmount)}</Table.Td>
                    <Table.Td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#1565c0' }}>₹{fmt(item.netPayable)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr style={{ background: '#fff8e1' }}>
                  <Table.Td colSpan={6} style={{ padding: '8px 10px', fontWeight: 800, color: '#e65100', fontSize: 12 }}>Total ({summary.totalFarmers} farmers)</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(summary.totalMilkAmount)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(summary.totalSubsidy)}</Table.Td>
                  <Table.Td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>₹{fmt(summary.totalNetPayable)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          )}
        </ScrollArea>
      </Paper>
    </Box>
  );
};

export default SubsidyReport;
