import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  SimpleGrid,
  Card,
  Table,
  Badge,
  Button,
  ThemeIcon,
  Loader,
  Center,
  ScrollArea,
} from '@mantine/core';
import {
  IconTicket,
  IconTag,
  IconSpeakerphone,
  IconCurrencyRupee,
  IconDiscount,
  IconArrowRight,
  IconChartBar,
  IconUsers,
  IconReceipt,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { businessPromotionAPI } from '../../services/api';

const STAT_CARD_CONFIGS = [
  {
    key: 'activeCoupons',
    label: 'Active Coupons',
    icon: IconTicket,
    color: 'blue',
    gradient: { from: 'blue', to: 'cyan' },
    prefix: '',
    isCurrency: false,
  },
  {
    key: 'activeOffers',
    label: 'Active Offers',
    icon: IconTag,
    color: 'grape',
    gradient: { from: 'grape', to: 'violet' },
    prefix: '',
    isCurrency: false,
  },
  {
    key: 'activeCampaigns',
    label: 'Active Campaigns',
    icon: IconSpeakerphone,
    color: 'orange',
    gradient: { from: 'orange', to: 'red' },
    prefix: '',
    isCurrency: false,
  },
  {
    key: 'totalRevenueImpact',
    label: 'Total Revenue Impact',
    icon: IconCurrencyRupee,
    color: 'green',
    gradient: { from: 'green', to: 'teal' },
    prefix: '₹',
    isCurrency: true,
  },
  {
    key: 'totalDiscountsGiven',
    label: 'Total Discounts Given',
    icon: IconDiscount,
    color: 'pink',
    gradient: { from: 'pink', to: 'red' },
    prefix: '₹',
    isCurrency: true,
  },
];

function StatCard({ config, value }) {
  const Icon = config.icon;
  const displayValue = config.isCurrency
    ? `${config.prefix}${Number(value || 0).toFixed(2)}`
    : String(value || 0);

  return (
    <Card withBorder shadow="sm" radius="md" p="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>
            {config.label}
          </Text>
          <Text size="xl" fw={700} style={{ wordBreak: 'break-all' }}>
            {displayValue}
          </Text>
        </Stack>
        <ThemeIcon
          size={48}
          radius="md"
          variant="gradient"
          gradient={config.gradient}
          style={{ flexShrink: 0 }}
        >
          <Icon size={24} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function getPromotionTypeBadgeColor(type) {
  if (!type) return 'gray';
  const t = type.toLowerCase();
  if (t.includes('coupon')) return 'blue';
  if (t.includes('offer')) return 'grape';
  if (t.includes('campaign')) return 'orange';
  return 'gray';
}

function getStatusBadgeColor(status) {
  if (!status) return 'gray';
  const s = status.toLowerCase();
  if (s === 'active') return 'green';
  if (s === 'expired') return 'red';
  if (s === 'inactive' || s === 'disabled') return 'gray';
  if (s === 'scheduled') return 'blue';
  return 'gray';
}

export default function PromotionDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const response = await businessPromotionAPI.getAnalytics();
      const data = response?.data || response || {};
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch promotion analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const stats = analytics.stats || {};
  const topPromotions = analytics.topPromotions || [];
  const recentRedemptions = analytics.recentRedemptions || [];

  if (loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text c="dimmed">Loading promotion analytics...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Center h={300}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconChartBar size={32} />
            </ThemeIcon>
            <Text c="red" fw={500}>{error}</Text>
            <Button variant="light" onClick={fetchAnalytics}>
              Retry
            </Button>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>Promotions Dashboard</Title>
            <Text c="dimmed" size="sm">
              Overview of all active promotions, coupons, and campaigns
            </Text>
          </Stack>
          <Button
            variant="light"
            leftSection={<IconChartBar size={16} />}
            onClick={fetchAnalytics}
          >
            Refresh
          </Button>
        </Group>

        {/* Stat Cards */}
        <SimpleGrid cols={5} spacing="md" breakpoints={[
          { maxWidth: 'xl', cols: 3 },
          { maxWidth: 'md', cols: 2 },
          { maxWidth: 'sm', cols: 1 },
        ]}>
          {STAT_CARD_CONFIGS.map((config) => (
            <StatCard key={config.key} config={config} value={stats[config.key]} />
          ))}
        </SimpleGrid>

        {/* Quick Actions */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" tt="uppercase" c="dimmed" style={{ letterSpacing: '0.5px' }}>
              Quick Actions
            </Text>
            <Group gap="sm" wrap="wrap">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconTicket size={16} />}
                rightSection={<IconArrowRight size={14} />}
                onClick={() => navigate('/business-promotions/coupons')}
              >
                Manage Coupons
              </Button>
              <Button
                variant="light"
                color="grape"
                leftSection={<IconTag size={16} />}
                rightSection={<IconArrowRight size={14} />}
                onClick={() => navigate('/business-promotions/offers')}
              >
                Manage Offers
              </Button>
              <Button
                variant="light"
                color="orange"
                leftSection={<IconSpeakerphone size={16} />}
                rightSection={<IconArrowRight size={14} />}
                onClick={() => navigate('/business-promotions/campaigns')}
              >
                Manage Campaigns
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Top Performing Promotions */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Group align="center" gap="xs">
              <ThemeIcon size={28} radius="sm" variant="light" color="violet">
                <IconChartBar size={16} />
              </ThemeIcon>
              <Title order={4}>Top Performing Promotions</Title>
            </Group>
            <ScrollArea>
              {topPromotions.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                      <IconTag size={24} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">No promotion data available</Text>
                  </Stack>
                </Center>
              ) : (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Redemptions</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Revenue (₹)</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Discount Given (₹)</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {topPromotions.map((promo, index) => (
                      <Table.Tr key={promo._id || index}>
                        <Table.Td>
                          <Text fw={500} size="sm">{promo.name || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getPromotionTypeBadgeColor(promo.type)}
                            variant="light"
                            size="sm"
                          >
                            {promo.type || '-'}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">{promo.redemptions ?? 0}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={500} c="green">
                            {Number(promo.revenue || 0).toFixed(2)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="pink">
                            {Number(promo.discountGiven || 0).toFixed(2)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Badge
                            color={getStatusBadgeColor(promo.status)}
                            variant="filled"
                            size="sm"
                          >
                            {promo.status || 'Unknown'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </ScrollArea>
          </Stack>
        </Paper>

        {/* Recent Redemptions */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Group align="center" gap="xs">
              <ThemeIcon size={28} radius="sm" variant="light" color="teal">
                <IconReceipt size={16} />
              </ThemeIcon>
              <Title order={4}>Recent Redemptions</Title>
            </Group>
            <ScrollArea>
              {recentRedemptions.length === 0 ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <ThemeIcon size={48} radius="xl" color="gray" variant="light">
                      <IconUsers size={24} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm">No recent redemptions found</Text>
                  </Stack>
                </Center>
              ) : (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Promotion</Table.Th>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Discount (₹)</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Order Amount (₹)</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {recentRedemptions.map((redemption, index) => (
                      <Table.Tr key={redemption._id || index}>
                        <Table.Td>
                          <Text size="sm">
                            {redemption.date
                              ? dayjs(redemption.date).format('DD MMM YYYY')
                              : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {redemption.customer || redemption.customerName || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {redemption.promotion || redemption.promotionName || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="blue">
                            {redemption.invoice || redemption.invoiceNo || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" c="pink">
                            {Number(redemption.discount || 0).toFixed(2)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={500}>
                            {Number(redemption.orderAmount || redemption.amount || 0).toFixed(2)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </ScrollArea>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
