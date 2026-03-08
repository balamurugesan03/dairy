import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Badge,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  ActionIcon,
  Grid,
  SimpleGrid,
  Card,
  Progress,
  Loader,
  Center,
  Divider,
  MultiSelect,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconCurrencyRupee,
  IconTarget,
  IconBulb,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { businessPromotionAPI } from '../../services/api';

const CAMPAIGN_TYPE_OPTIONS = [
  { value: 'Seasonal', label: 'Seasonal' },
  { value: 'Clearance', label: 'Clearance' },
  { value: 'Launch', label: 'Launch' },
  { value: 'Festival', label: 'Festival' },
  { value: 'Custom', label: 'Custom' },
];

const TARGET_TYPE_OPTIONS = [
  { value: 'All', label: 'All Customers' },
  { value: 'Specific', label: 'Specific Customers' },
  { value: 'Group', label: 'Customer Group' },
];

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'Paused', label: 'Paused' },
];

const CAMPAIGN_TYPE_COLORS = {
  Seasonal: 'teal',
  Clearance: 'orange',
  Launch: 'blue',
  Festival: 'grape',
  Custom: 'gray',
};

const STATUS_COLORS = {
  Draft: 'gray',
  Active: 'green',
  Paused: 'yellow',
  Completed: 'blue',
  Cancelled: 'red',
};

const defaultForm = {
  name: '',
  description: '',
  campaignType: '',
  startDate: null,
  endDate: null,
  budget: 0,
  targetType: 'All',
  targetCustomers: '',
  targetGroup: '',
  linkedPromotions: [],
  notes: '',
  status: 'Draft',
};

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [promotionOptions, setPromotionOptions] = useState([]);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchCampaigns();
    fetchPromotionOptions();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await businessPromotionAPI.getAll({ promotionType: 'Campaign' });
      const data = response?.data || response || [];
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load campaigns.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotionOptions = async () => {
    try {
      const couponRes = await businessPromotionAPI.getAll({ promotionType: 'Coupon' });
      const offerRes = await businessPromotionAPI.getAll({ promotionType: 'Offer' });
      const coupons = couponRes?.data || couponRes || [];
      const offers = offerRes?.data || offerRes || [];
      const all = [...(Array.isArray(coupons) ? coupons : []), ...(Array.isArray(offers) ? offers : [])];
      setPromotionOptions(
        all.map((promo) => ({
          value: promo._id,
          label: `${promo.name} (${promo.promotionType})`,
        }))
      );
    } catch {
      setPromotionOptions([]);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    openModal();
  };

  const handleOpenEdit = (campaign) => {
    setEditingId(campaign._id);
    setForm({
      name: campaign.name || '',
      description: campaign.description || '',
      campaignType: campaign.campaignType || '',
      startDate: campaign.startDate ? new Date(campaign.startDate) : null,
      endDate: campaign.endDate ? new Date(campaign.endDate) : null,
      budget: campaign.budget || 0,
      targetType: campaign.targetType || 'All',
      targetCustomers: campaign.targetCustomers || '',
      targetGroup: campaign.targetGroup || '',
      linkedPromotions: campaign.linkedPromotions
        ? campaign.linkedPromotions.map((p) => (typeof p === 'object' ? p._id : p))
        : [],
      notes: campaign.notes || '',
      status: campaign.status || 'Draft',
    });
    openModal();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Campaign name is required.',
        color: 'orange',
        icon: <IconX size={16} />,
      });
      return;
    }
    if (!form.campaignType) {
      notifications.show({
        title: 'Validation Error',
        message: 'Campaign type is required.',
        color: 'orange',
        icon: <IconX size={16} />,
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        promotionType: 'Campaign',
        startDate: form.startDate ? dayjs(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? dayjs(form.endDate).toISOString() : undefined,
      };

      if (editingId) {
        await businessPromotionAPI.update(editingId, payload);
        notifications.show({
          title: 'Campaign Updated',
          message: `"${form.name}" has been updated successfully.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        await businessPromotionAPI.create(payload);
        notifications.show({
          title: 'Campaign Created',
          message: `"${form.name}" has been created successfully.`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }

      closeModal();
      fetchCampaigns();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to save campaign.',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrompt = (id) => {
    setDeletingId(id);
    openDeleteModal();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await businessPromotionAPI.delete(deletingId);
      notifications.show({
        title: 'Campaign Deleted',
        message: 'Campaign has been deleted.',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      closeDeleteModal();
      setDeletingId(null);
      fetchCampaigns();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete campaign.',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const budgetProgress = (campaign) => {
    if (!campaign.budget || campaign.budget === 0) return 0;
    const spent = campaign.spentAmount || 0;
    return Math.min((spent / campaign.budget) * 100, 100);
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Stack gap={2}>
          <Title order={2}>Campaign Manager</Title>
          <Text c="dimmed" size="sm">
            Manage marketing campaigns, budgets, and linked promotions.
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
          New Campaign
        </Button>
      </Group>

      {loading ? (
        <Center py={80}>
          <Loader size="lg" />
        </Center>
      ) : campaigns.length === 0 ? (
        <Paper p="xl" withBorder ta="center">
          <IconBulb size={48} color="var(--mantine-color-gray-5)" />
          <Text mt="md" size="lg" fw={500} c="dimmed">
            No campaigns found
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Create your first campaign to start managing promotions.
          </Text>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            Create Campaign
          </Button>
        </Paper>
      ) : (
        <SimpleGrid cols={3} spacing="md">
          {campaigns.map((campaign) => (
            <Card key={campaign._id} withBorder shadow="sm" padding="lg" radius="md">
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="md" lineClamp={1} style={{ flex: 1 }}>
                    {campaign.name}
                  </Text>
                  <Badge
                    color={CAMPAIGN_TYPE_COLORS[campaign.campaignType] || 'gray'}
                    variant="light"
                    size="sm"
                  >
                    {campaign.campaignType || 'Custom'}
                  </Badge>
                </Group>

                {campaign.description && (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {campaign.description}
                  </Text>
                )}

                <Group gap="xs" align="center">
                  <IconCalendar size={14} color="var(--mantine-color-gray-6)" />
                  <Text size="xs" c="dimmed">
                    {campaign.startDate
                      ? dayjs(campaign.startDate).format('DD MMM YYYY')
                      : 'No start'}
                    {' — '}
                    {campaign.endDate
                      ? dayjs(campaign.endDate).format('DD MMM YYYY')
                      : 'No end'}
                  </Text>
                </Group>

                <Divider />

                <Stack gap={4}>
                  <Group justify="space-between">
                    <Group gap={4} align="center">
                      <IconCurrencyRupee size={14} color="var(--mantine-color-gray-6)" />
                      <Text size="xs" c="dimmed">
                        Budget
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Spent {(campaign.spentAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} of{' '}
                      {(campaign.budget || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                    </Text>
                  </Group>
                  <Progress
                    value={budgetProgress(campaign)}
                    color={budgetProgress(campaign) >= 90 ? 'red' : budgetProgress(campaign) >= 60 ? 'yellow' : 'green'}
                    size="sm"
                    radius="xl"
                  />
                </Stack>

                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <Badge variant="outline" size="sm" color="blue">
                      {campaign.linkedPromotions ? campaign.linkedPromotions.length : 0} Promotions
                    </Badge>
                    <Badge
                      color={STATUS_COLORS[campaign.status] || 'gray'}
                      variant="filled"
                      size="sm"
                    >
                      {campaign.status || 'Draft'}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      size="sm"
                      onClick={() => handleOpenEdit(campaign)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      onClick={() => handleDeletePrompt(campaign._id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={
          <Title order={4}>{editingId ? 'Edit Campaign' : 'Create Campaign'}</Title>
        }
        size="lg"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Campaign Name"
            placeholder="Enter campaign name"
            value={form.name}
            onChange={(e) => setField('name', e.currentTarget.value)}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe the campaign..."
            value={form.description}
            onChange={(e) => setField('description', e.currentTarget.value)}
            minRows={2}
            autosize
          />

          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Campaign Type"
                placeholder="Select type"
                data={CAMPAIGN_TYPE_OPTIONS}
                value={form.campaignType}
                onChange={(val) => setField('campaignType', val)}
                required
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Status"
                placeholder="Select status"
                data={STATUS_OPTIONS}
                value={form.status}
                onChange={(val) => setField('status', val)}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Start Date"
                placeholder="Pick start date"
                value={form.startDate}
                onChange={(val) => setField('startDate', val)}
                leftSection={<IconCalendar size={16} />}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="Pick end date"
                value={form.endDate}
                onChange={(val) => setField('endDate', val)}
                leftSection={<IconCalendar size={16} />}
                minDate={form.startDate || undefined}
                clearable
              />
            </Grid.Col>
          </Grid>

          <NumberInput
            label="Budget"
            placeholder="Enter budget amount"
            value={form.budget}
            onChange={(val) => setField('budget', val || 0)}
            leftSection={<IconCurrencyRupee size={16} />}
            min={0}
            thousandSeparator=","
          />

          <Select
            label="Target Type"
            placeholder="Select target audience"
            data={TARGET_TYPE_OPTIONS}
            value={form.targetType}
            onChange={(val) => setField('targetType', val)}
            leftSection={<IconTarget size={16} />}
          />

          {form.targetType === 'Specific' && (
            <Textarea
              label="Target Customers"
              placeholder="Enter customer names or IDs, one per line..."
              value={form.targetCustomers}
              onChange={(e) => setField('targetCustomers', e.currentTarget.value)}
              minRows={2}
              autosize
            />
          )}

          {form.targetType === 'Group' && (
            <TextInput
              label="Target Group"
              placeholder="Enter customer group name"
              value={form.targetGroup}
              onChange={(e) => setField('targetGroup', e.currentTarget.value)}
            />
          )}

          <MultiSelect
            label="Linked Promotions"
            placeholder="Select promotions to link"
            data={promotionOptions}
            value={form.linkedPromotions}
            onChange={(val) => setField('linkedPromotions', val)}
            searchable
            clearable
            nothingFoundMessage="No promotions found"
          />

          <Textarea
            label="Notes"
            placeholder="Internal notes for this campaign..."
            value={form.notes}
            onChange={(e) => setField('notes', e.currentTarget.value)}
            minRows={2}
            autosize
          />

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} leftSection={<IconCheck size={16} />}>
              {editingId ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setDeletingId(null);
        }}
        title={<Title order={4}>Delete Campaign</Title>}
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text>Are you sure you want to delete this campaign? This action cannot be undone.</Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                closeDeleteModal();
                setDeletingId(null);
              }}
            >
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteConfirm} leftSection={<IconTrash size={16} />}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
