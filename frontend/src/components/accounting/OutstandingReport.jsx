import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
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
  Alert,
  Progress,
  Tooltip
} from '@mantine/core';
import {
  IconReceipt,
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconDownload,
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconCurrencyRupee,
  IconChartBar,
  IconRefresh,
  IconInfoCircle,
  IconArrowUpRight,
  IconArrowDownRight,
  IconCashBanknote
} from '@tabler/icons-react';

const OutstandingReport = () => {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalReceivable: 0,
    totalPayable: 0,
    netPosition: 0,
    totalParties: 0,
    receivableParties: 0,
    payableParties: 0
  });

  useEffect(() => {
    fetchOutstandingLedgers();
  }, []);

  const fetchOutstandingLedgers = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getAll();
      const partyLedgers = response.data.filter(ledger =>
        ledger.ledgerType === 'Party' && ledger.currentBalance > 0
      );

      setLedgers(partyLedgers);
      calculateStats(partyLedgers);
    } catch (error) {
      message.error(error.message || 'Failed to fetch outstanding ledgers');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ledgers) => {
    let totalReceivable = 0;
    let totalPayable = 0;
    let receivableParties = 0;
    let payableParties = 0;

    ledgers.forEach(ledger => {
      if (ledger.balanceType === 'Dr') {
        totalReceivable += ledger.currentBalance;
        receivableParties++;
      } else if (ledger.balanceType === 'Cr') {
        totalPayable += ledger.currentBalance;
        payableParties++;
      }
    });

    const netPosition = totalReceivable - totalPayable;

    setStats({
      totalReceivable,
      totalPayable,
      netPosition,
      totalParties: ledgers.length,
      receivableParties,
      payableParties
    });
  };

  const exportData = ledgers.map(ledger => ({
    'Ledger Name': ledger.ledgerName,
    'Account Group': ledger.ledgerType,
    'Balance Type': ledger.balanceType === 'Dr' ? 'Receivable' : 'Payable',
    'Outstanding Amount': ledger.currentBalance,
    'Contact': ledger.linkedEntity?.entityType || '-',
    'Entity Type': ledger.linkedEntity?.entityType || '-'
  }));

  const receivablePercentage = stats.totalParties > 0 
    ? (stats.receivableParties / stats.totalParties) * 100 
    : 0;
  const payablePercentage = stats.totalParties > 0 
    ? (stats.payableParties / stats.totalParties) * 100 
    : 0;

  const rows = ledgers.map((ledger) => (
    <tr key={ledger._id}>
      <td>
        <Group gap="xs" wrap="nowrap">
          {ledger.balanceType === 'Dr' ? (
            <IconUserCheck size={16} color="green" />
          ) : (
            <IconUserX size={16} color="red" />
          )}
          <Text size="sm" weight={500}>
            {ledger.ledgerName}
          </Text>
        </Group>
      </td>
      <td>
        <Badge color="blue" variant="light">
          {ledger.ledgerType}
        </Badge>
      </td>
      <td>
        <Badge
          color={ledger.balanceType === 'Dr' ? 'green' : 'red'}
          variant="filled"
          leftSection={ledger.balanceType === 'Dr' ? 
            <IconTrendingUp size={12} /> : 
            <IconTrendingDown size={12} />
          }
        >
          {ledger.balanceType === 'Dr' ? 'To Receive' : 'To Pay'}
        </Badge>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text 
          weight={700} 
          color={ledger.balanceType === 'Dr' ? 'green' : 'red'}
          size="sm"
        >
          ₹{ledger.currentBalance?.toFixed(2) || 0}
        </Text>
      </td>
      <td>
        {ledger.linkedEntity?.entityType === 'Farmer' ? (
          <Badge color="lime" variant="light">
            Farmer Account
          </Badge>
        ) : (
          <Text size="sm" color="dimmed">-</Text>
        )}
      </td>
    </tr>
  ));

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper p="lg" mb="md" withBorder shadow="sm" radius="md" 
        style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <Group position="apart">
          <Box>
            <Title order={2} color="white">Outstanding Report</Title>
            <Text color="white" size="sm" opacity={0.9}>
              Track receivables and payables for all parties
            </Text>
          </Box>
          <Group spacing="xs">
            <Button
              variant="light"
              color="white"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchOutstandingLedgers}
              disabled={loading}
            >
              Refresh
            </Button>
            <ExportButton
              data={exportData}
              filename={`outstanding_report_${new Date().toISOString().split('T')[0]}`}
              buttonText="Export Report"
              variant="filled"
              color="white"
            />
          </Group>
        </Group>
      </Paper>

      {/* Stats Overview */}
      <Grid gutter="md" mb="md">
        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #40c057' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>To Receive</Text>
                <Text size="xl" weight={700} color="green">
                  ₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ 
                  value: stats.totalReceivable > 0 ? 100 : 0, 
                  color: '#40c057' 
                }]}
                label={
                  <Center>
                    <IconTrendingUp size={22} color="#40c057" />
                  </Center>
                }
              />
            </Group>
            <Text size="sm" color="dimmed" mt="xs">
              {stats.receivableParties} party(s) to receive from
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #fa5252' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>To Pay</Text>
                <Text size="xl" weight={700} color="red">
                  ₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[{ 
                  value: stats.totalPayable > 0 ? 100 : 0, 
                  color: '#fa5252' 
                }]}
                label={
                  <Center>
                    <IconTrendingDown size={22} color="#fa5252" />
                  </Center>
                }
              />
            </Group>
            <Text size="sm" color="dimmed" mt="xs">
              {stats.payableParties} party(s) to pay to
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" 
            style={{ borderLeft: '4px solid', borderLeftColor: stats.netPosition >= 0 ? '#228be6' : '#fd7e14' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Net Position</Text>
                <Group spacing="xs" align="center">
                  {stats.netPosition >= 0 ? (
                    <IconArrowUpRight size={18} color="#228be6" />
                  ) : (
                    <IconArrowDownRight size={18} color="#fd7e14" />
                  )}
                  <Text 
                    size="xl" 
                    weight={700} 
                    color={stats.netPosition >= 0 ? 'blue' : 'orange'}
                  >
                    ₹{Math.abs(stats.netPosition).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </Group>
              </Box>
              <Badge 
                color={stats.netPosition >= 0 ? 'blue' : 'orange'} 
                variant="light"
                size="lg"
              >
                {stats.netPosition >= 0 ? 'Favorable' : 'Unfavorable'}
              </Badge>
            </Group>
            <Text size="sm" color="dimmed" mt="xs">
              {stats.netPosition >= 0 ? 'Net receivable' : 'Net payable'}
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col xs={12} sm={6} md={3}>
          <Card withBorder p="lg" radius="md" style={{ borderLeft: '4px solid #7950f2' }}>
            <Group position="apart">
              <Box>
                <Text size="xs" color="dimmed" transform="uppercase" weight={600}>Total Parties</Text>
                <Text size="xl" weight={700}>{stats.totalParties}</Text>
              </Box>
              <RingProgress
                size={60}
                thickness={4}
                sections={[
                  { value: receivablePercentage, color: '#40c057' },
                  { value: payablePercentage, color: '#fa5252' }
                ]}
                label={
                  <Center>
                    <IconUsers size={22} color="#7950f2" />
                  </Center>
                }
              />
            </Group>
            <Group spacing="xs" mt="xs">
              <Badge color="green" variant="light" size="xs">
                {stats.receivableParties} Receivable
              </Badge>
              <Badge color="red" variant="light" size="xs">
                {stats.payableParties} Payable
              </Badge>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Distribution Bar */}
      <Card withBorder p="lg" mb="md" radius="md">
        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconChartBar size={20} />
              Outstanding Distribution
            </Group>
          </Title>
          <Text size="sm" color="dimmed">
            ₹{(stats.totalReceivable + stats.totalPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Total Outstanding
          </Text>
        </Group>

        <Stack spacing="xs">
          <Group position="apart">
            <Group spacing="xs">
              <IconTrendingUp size={14} color="green" />
              <Text size="sm">To Receive</Text>
            </Group>
            <Text size="sm" weight={500}>
              ₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
          <Progress
            value={stats.totalReceivable > 0 ? (stats.totalReceivable / (stats.totalReceivable + stats.totalPayable)) * 100 : 0}
            color="green"
            size="lg"
            radius="xl"
          />

          <Group position="apart" mt="md">
            <Group spacing="xs">
              <IconTrendingDown size={14} color="red" />
              <Text size="sm">To Pay</Text>
            </Group>
            <Text size="sm" weight={500}>
              ₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
          <Progress
            value={stats.totalPayable > 0 ? (stats.totalPayable / (stats.totalReceivable + stats.totalPayable)) * 100 : 0}
            color="red"
            size="lg"
            radius="xl"
          />
        </Stack>
      </Card>

      {/* Outstanding Details */}
      <Paper p="lg" withBorder shadow="sm" radius="md">
        <Group position="apart" mb="md">
          <Title order={4}>
            <Group spacing="xs">
              <IconUsers size={20} />
              Party Outstanding Details
            </Group>
          </Title>
          <Badge 
            color={stats.netPosition >= 0 ? 'green' : 'red'} 
            variant="light"
            size="lg"
          >
            {stats.netPosition >= 0 ? 'Net Favorable' : 'Net Unfavorable'}
          </Badge>
        </Group>

        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {ledgers.length === 0 ? (
          <Card p="xl" withBorder>
            <Stack align="center" spacing="md">
              <IconCashBanknote size={48} color="gray" />
              <Text color="dimmed" size="lg">No outstanding balances found</Text>
              <Text color="dimmed" size="sm" ta="center">
                All party accounts are settled with zero balance
              </Text>
            </Stack>
          </Card>
        ) : (
          <>
            <ScrollArea>
              <Table striped highlightOnHover withBorder verticalSpacing="sm">
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ width: '250px' }}>Ledger Name</th>
                    <th style={{ width: '120px' }}>Account Group</th>
                    <th style={{ width: '120px' }}>Balance Type</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>Outstanding Amount</th>
                    <th style={{ width: '120px' }}>Contact</th>
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </Table>
            </ScrollArea>

            {/* Summary */}
            <Card mt="md" p="md" withBorder bg="gray.0">
              <Group position="apart">
                <Text weight={500}>Summary</Text>
                <Group spacing="lg">
                  <div>
                    <Text size="sm" color="dimmed">Total Parties</Text>
                    <Text weight={700}>{stats.totalParties}</Text>
                  </div>
                  <Divider orientation="vertical" />
                  <div>
                    <Text size="sm" color="dimmed">Total Receivable</Text>
                    <Text weight={700} color="green">
                      ₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                  <Divider orientation="vertical" />
                  <div>
                    <Text size="sm" color="dimmed">Total Payable</Text>
                    <Text weight={700} color="red">
                      ₹{stats.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                  <Divider orientation="vertical" />
                  <div>
                    <Text size="sm" color="dimmed">Net Position</Text>
                    <Badge 
                      color={stats.netPosition >= 0 ? 'blue' : 'orange'} 
                      variant="light"
                      size="lg"
                    >
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

      {/* Info Alert */}
      <Alert 
        color="blue" 
        variant="light" 
        icon={<IconInfoCircle size={16} />}
        mt="md"
        radius="md"
      >
        <Group spacing="xs">
          <Text size="sm">
            Outstanding report shows party balances only. 
            Receivable amounts (Dr) are money to be received, 
            Payable amounts (Cr) are money to be paid.
          </Text>
        </Group>
      </Alert>
    </Container>
  );
};

export default OutstandingReport;