import { useState, useRef } from 'react';
import { message } from '../../utils/toast';
import { ledgerAPI } from '../../services/api';
import dayjs from 'dayjs';
import {
  Box,
  Button,
  Paper,
  Grid,
  Text,
  LoadingOverlay,
  Group,
  Stack,
  Container,
  Title,
  Divider,
  Table,
  Badge,
  Card,
  ScrollArea,
  SimpleGrid,
  RingProgress,
  Center,
  Progress,
  TextInput
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconChartBar,
  IconArrowUpRight,
  IconArrowDownRight,
  IconCashBanknote,
  IconPrinter,
  IconSearch
} from '@tabler/icons-react';

const OutstandingReport = () => {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [generated, setGenerated] = useState(false);
  const [stats, setStats] = useState({
    totalReceivable: 0,
    totalPayable: 0,
    netPosition: 0,
    totalParties: 0,
    receivableParties: 0,
    payableParties: 0
  });
  const printRef = useRef(null);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      message.error('Please select both From and To dates');
      return;
    }
    setLoading(true);
    try {
      const response = await ledgerAPI.getOutstandingReport({ fromDate, toDate });
      const data = response.data || [];
      setLedgers(data);
      calculateStats(data);
      setGenerated(true);
    } catch (error) {
      message.error(error.message || 'Failed to fetch outstanding report');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    let totalReceivable = 0, totalPayable = 0, receivableParties = 0, payableParties = 0;
    data.forEach(l => {
      if (l.balanceType === 'Dr') { totalReceivable += l.currentBalance; receivableParties++; }
      else { totalPayable += l.currentBalance; payableParties++; }
    });
    setStats({
      totalReceivable, totalPayable,
      netPosition: totalReceivable - totalPayable,
      totalParties: data.length,
      receivableParties, payableParties
    });
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Outstanding Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; padding: 20px; }
        h2 { text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #f1f3f5; padding: 8px; border: 1px solid #dee2e6; text-align: left; }
        td { padding: 7px 8px; border: 1px solid #dee2e6; }
        .right { text-align: right; }
        .green { color: #2f9e44; font-weight: 600; }
        .red { color: #e03131; font-weight: 600; }
        .total-row { font-weight: 700; background: #f8f9fa; }
        .summary { margin-top: 20px; display: flex; gap: 40px; }
        .summary-item { text-align: center; }
        .summary-label { font-size: 11px; color: #888; }
        .summary-value { font-size: 16px; font-weight: 700; }
      </style>
    </head><body>
      <h2>Outstanding Report</h2>
      <div class="subtitle">Period: ${dayjs(fromDate).format('DD-MM-YYYY')} to ${dayjs(toDate).format('DD-MM-YYYY')}</div>
      <table>
        <thead><tr>
          <th>#</th><th>Ledger Name</th><th>Account Type</th>
          <th class="right">Debit (₹)</th><th class="right">Credit (₹)</th>
          <th class="right">Outstanding (₹)</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${ledgers.map((l, i) => `<tr>
            <td>${i + 1}</td>
            <td>${l.ledgerName}</td>
            <td>${l.ledgerType}</td>
            <td class="right">${l.periodDebit?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
            <td class="right">${l.periodCredit?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
            <td class="right ${l.balanceType === 'Dr' ? 'green' : 'red'}">
              ${l.currentBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td>${l.balanceType === 'Dr' ? 'To Receive' : 'To Pay'}</td>
          </tr>`).join('')}
          <tr class="total-row">
            <td colspan="5">Total</td>
            <td class="right green">₹${stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Receivable</td>
            <td class="right red">₹${stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Payable</td>
          </tr>
        </tbody>
      </table>
      <div class="summary">
        <div class="summary-item"><div class="summary-label">Total Receivable</div><div class="summary-value" style="color:#2f9e44">₹${stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="summary-item"><div class="summary-label">Total Payable</div><div class="summary-value" style="color:#e03131">₹${stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div></div>
        <div class="summary-item"><div class="summary-label">Net Position</div><div class="summary-value">₹${Math.abs(stats.netPosition).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${stats.netPosition >= 0 ? 'Favorable' : 'Unfavorable'}</div></div>
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const receivablePercentage = stats.totalParties > 0 ? (stats.receivableParties / stats.totalParties) * 100 : 0;
  const payablePercentage = stats.totalParties > 0 ? (stats.payableParties / stats.totalParties) * 100 : 0;

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper p="lg" mb="md" withBorder shadow="sm" radius="md"
        style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2} c="white">Outstanding Report</Title>
            <Text c="white" size="sm" opacity={0.9}>Track receivables and payables by date range</Text>
          </Box>
        </Group>
      </Paper>

      {/* Date Filter */}
      <Paper p="md" withBorder shadow="sm" radius="md" mb="md">
        <Group align="flex-end" gap="md">
          <TextInput
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ width: 160 }}
          />
          <TextInput
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ width: 160 }}
          />
          <Button
            leftSection={<IconSearch size={16} />}
            onClick={handleGenerate}
            loading={loading}
            color="violet"
          >
            Generate
          </Button>
          {generated && (
            <Button
              leftSection={<IconPrinter size={16} />}
              variant="light"
              color="gray"
              onClick={handlePrint}
              disabled={ledgers.length === 0}
            >
              Print
            </Button>
          )}
        </Group>
      </Paper>

      {generated && (
        <>
          {/* Stats */}
          <Grid gutter="md" mb="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #40c057' }}>
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>TO RECEIVE</Text>
                    <Text size="xl" fw={700} c="green">
                      ₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Box>
                  <RingProgress size={60} thickness={4}
                    sections={[{ value: stats.totalReceivable > 0 ? 100 : 0, color: '#40c057' }]}
                    label={<Center><IconTrendingUp size={22} color="#40c057" /></Center>}
                  />
                </Group>
                <Text size="sm" c="dimmed" mt="xs">{stats.receivableParties} party(s)</Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #fa5252' }}>
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>TO PAY</Text>
                    <Text size="xl" fw={700} c="red">
                      ₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </Box>
                  <RingProgress size={60} thickness={4}
                    sections={[{ value: stats.totalPayable > 0 ? 100 : 0, color: '#fa5252' }]}
                    label={<Center><IconTrendingDown size={22} color="#fa5252" /></Center>}
                  />
                </Group>
                <Text size="sm" c="dimmed" mt="xs">{stats.payableParties} party(s)</Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="lg" radius="md"
                style={{ borderLeft: `4px solid ${stats.netPosition >= 0 ? '#228be6' : '#fd7e14'}` }}>
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>NET POSITION</Text>
                    <Group gap="xs" align="center">
                      {stats.netPosition >= 0
                        ? <IconArrowUpRight size={18} color="#228be6" />
                        : <IconArrowDownRight size={18} color="#fd7e14" />}
                      <Text size="xl" fw={700} color={stats.netPosition >= 0 ? 'blue' : 'orange'}>
                        ₹{Math.abs(stats.netPosition).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                    </Group>
                  </Box>
                  <Badge color={stats.netPosition >= 0 ? 'blue' : 'orange'} variant="light" size="lg">
                    {stats.netPosition >= 0 ? 'Favorable' : 'Unfavorable'}
                  </Badge>
                </Group>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #7950f2' }}>
                <Group justify="space-between">
                  <Box>
                    <Text size="xs" c="dimmed" fw={600}>TOTAL PARTIES</Text>
                    <Text size="xl" fw={700}>{stats.totalParties}</Text>
                  </Box>
                  <RingProgress size={60} thickness={4}
                    sections={[
                      { value: receivablePercentage, color: '#40c057' },
                      { value: payablePercentage, color: '#fa5252' }
                    ]}
                    label={<Center><IconUsers size={22} color="#7950f2" /></Center>}
                  />
                </Group>
                <Group gap="xs" mt="xs">
                  <Badge color="green" variant="light" size="xs">{stats.receivableParties} Receivable</Badge>
                  <Badge color="red" variant="light" size="xs">{stats.payableParties} Payable</Badge>
                </Group>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Distribution */}
          <Card withBorder p="lg" mb="md" radius="md">
            <Group justify="space-between" mb="md">
              <Title order={4}><Group gap="xs"><IconChartBar size={20} />Outstanding Distribution</Group></Title>
              <Text size="sm" c="dimmed">
                Period: {dayjs(fromDate).format('DD-MM-YYYY')} — {dayjs(toDate).format('DD-MM-YYYY')}
              </Text>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs"><IconTrendingUp size={14} color="green" /><Text size="sm">To Receive</Text></Group>
                <Text size="sm" fw={500}>₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </Group>
              <Progress
                value={stats.totalReceivable > 0 ? (stats.totalReceivable / (stats.totalReceivable + stats.totalPayable)) * 100 : 0}
                color="green" size="lg" radius="xl"
              />
              <Group justify="space-between" mt="sm">
                <Group gap="xs"><IconTrendingDown size={14} color="red" /><Text size="sm">To Pay</Text></Group>
                <Text size="sm" fw={500}>₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </Group>
              <Progress
                value={stats.totalPayable > 0 ? (stats.totalPayable / (stats.totalReceivable + stats.totalPayable)) * 100 : 0}
                color="red" size="lg" radius="xl"
              />
            </Stack>
          </Card>

          {/* Table */}
          <Paper p="lg" withBorder shadow="sm" radius="md" ref={printRef}>
            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            <Group justify="space-between" mb="md">
              <Title order={4}><Group gap="xs"><IconUsers size={20} />Party Outstanding Details</Group></Title>
              <Badge color={stats.netPosition >= 0 ? 'green' : 'red'} variant="light" size="lg">
                {stats.netPosition >= 0 ? 'Net Favorable' : 'Net Unfavorable'}
              </Badge>
            </Group>

            {ledgers.length === 0 ? (
              <Card p="xl" withBorder>
                <Stack align="center" gap="md">
                  <IconCashBanknote size={48} color="gray" />
                  <Text c="dimmed" size="lg">No outstanding balances for this period</Text>
                </Stack>
              </Card>
            ) : (
              <>
                <ScrollArea>
                  <Table striped highlightOnHover withBorder verticalSpacing="sm">
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th>#</th>
                        <th>Ledger Name</th>
                        <th>Account Type</th>
                        <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                        <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                        <th style={{ textAlign: 'right' }}>Outstanding (₹)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgers.map((ledger, i) => (
                        <tr key={ledger._id}>
                          <td>{i + 1}</td>
                          <td>
                            <Group gap="xs" wrap="nowrap">
                              {ledger.balanceType === 'Dr'
                                ? <IconUserCheck size={16} color="green" />
                                : <IconUserX size={16} color="red" />}
                              <Text size="sm" fw={500}>{ledger.ledgerName}</Text>
                            </Group>
                          </td>
                          <td><Badge color="blue" variant="light">{ledger.ledgerType}</Badge></td>
                          <td style={{ textAlign: 'right' }}>
                            <Text size="sm" c="dimmed">
                              {ledger.periodDebit > 0 ? ledger.periodDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                            </Text>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Text size="sm" c="dimmed">
                              {ledger.periodCredit > 0 ? ledger.periodCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                            </Text>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Text fw={700} color={ledger.balanceType === 'Dr' ? 'green' : 'red'} size="sm">
                              ₹{ledger.currentBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </Text>
                          </td>
                          <td>
                            <Badge
                              color={ledger.balanceType === 'Dr' ? 'green' : 'red'}
                              variant="filled"
                              leftSection={ledger.balanceType === 'Dr' ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                            >
                              {ledger.balanceType === 'Dr' ? 'To Receive' : 'To Pay'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </ScrollArea>

                <Card mt="md" p="md" withBorder bg="gray.0">
                  <Group justify="space-between">
                    <Text fw={500}>Summary</Text>
                    <Group gap="lg">
                      <div>
                        <Text size="sm" c="dimmed">Total Parties</Text>
                        <Text fw={700}>{stats.totalParties}</Text>
                      </div>
                      <Divider orientation="vertical" />
                      <div>
                        <Text size="sm" c="dimmed">Total Receivable</Text>
                        <Text fw={700} c="green">₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                      </div>
                      <Divider orientation="vertical" />
                      <div>
                        <Text size="sm" c="dimmed">Total Payable</Text>
                        <Text fw={700} c="red">₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                      </div>
                      <Divider orientation="vertical" />
                      <div>
                        <Text size="sm" c="dimmed">Net Position</Text>
                        <Badge color={stats.netPosition >= 0 ? 'blue' : 'orange'} variant="light" size="lg">
                          ₹{Math.abs(stats.netPosition).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {stats.netPosition >= 0 ? ' favorable' : ' unfavorable'}
                        </Badge>
                      </div>
                    </Group>
                  </Group>
                </Card>
              </>
            )}
          </Paper>
        </>
      )}

      {!generated && (
        <Card p="xl" withBorder ta="center">
          <Stack align="center" gap="md">
            <IconCashBanknote size={48} color="gray" />
            <Text c="dimmed" size="lg">Select a date range and click Generate</Text>
          </Stack>
        </Card>
      )}
    </Container>
  );
};

export default OutstandingReport;
