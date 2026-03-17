import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Stack,
  Table,
  Badge,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  ActionIcon,
  ScrollArea,
  Divider,
  Grid,
  MultiSelect,
  Loader,
  Center,
  Switch,
  Tabs,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconTag,
  IconCheck,
  IconX,
  IconTicket,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { businessPromotionAPI, businessItemAPI, businessCustomerAPI } from '../../services/api';

const generateCouponCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const STATUS_COLORS = {
  Active: 'green',
  Draft: 'gray',
  Paused: 'yellow',
  Expired: 'red',
};

const emptyForm = {
  name: '',
  couponCode: '',
  description: '',
  discountType: 'Percentage',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderAmount: '',
  startDate: null,
  endDate: null,
  usageLimit: '',
  usageLimitPerCustomer: '',
  applicableTo: 'All Items',
  applicableItems: [],
  targetType: 'All',
  targetCustomers: [],
  targetGroup: '',
  status: 'Draft',
};

export default function CouponManager() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    fetchCoupons();
    fetchItems();
    fetchCustomers();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await businessPromotionAPI.getAll({ promotionType: 'Coupon' });
      const data = response?.data || response || [];
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to fetch coupons',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await businessItemAPI.getAll();
      const data = response?.data || response || [];
      setItems(
        (Array.isArray(data) ? data : []).map((item) => ({
          value: item._id,
          label: item.name,
        }))
      );
    } catch {
      setItems([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await businessCustomerAPI.getAll();
      const data = response?.data || response || [];
      setCustomers(
        (Array.isArray(data) ? data : []).map((c) => ({
          value: c._id,
          label: c.name || c.customerName || c._id,
        }))
      );
    } catch {
      setCustomers([]);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, couponCode: generateCouponCode() });
    openModal();
  };

  const handleOpenEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm({
      name: coupon.name || '',
      couponCode: coupon.couponCode || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'Percentage',
      discountValue: coupon.discountValue ?? '',
      maxDiscountAmount: coupon.maxDiscountAmount ?? '',
      minOrderAmount: coupon.minOrderAmount ?? '',
      startDate: coupon.startDate ? new Date(coupon.startDate) : null,
      endDate: coupon.endDate ? new Date(coupon.endDate) : null,
      usageLimit: coupon.usageLimit ?? '',
      usageLimitPerCustomer: coupon.usageLimitPerCustomer ?? '',
      applicableTo: coupon.applicableTo || 'All Items',
      applicableItems: coupon.applicableItems
        ? coupon.applicableItems.map((i) => (typeof i === 'object' ? i._id : i))
        : [],
      targetType: coupon.targetType || 'All',
      targetCustomers: coupon.targetCustomers
        ? coupon.targetCustomers.map((c) => (typeof c === 'object' ? c._id : c))
        : [],
      targetGroup: coupon.targetGroup || '',
      status: coupon.status || 'Draft',
    });
    openModal();
  };

  const handleCloseModal = () => {
    closeModal();
    setEditingId(null);
    setForm(emptyForm);
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      notifications.show({ title: 'Validation', message: 'Name is required', color: 'orange' });
      return;
    }
    if (!form.couponCode.trim()) {
      notifications.show({ title: 'Validation', message: 'Coupon code is required', color: 'orange' });
      return;
    }
    if (form.discountValue === '' || form.discountValue === null || form.discountValue === undefined) {
      notifications.show({ title: 'Validation', message: 'Discount value is required', color: 'orange' });
      return;
    }

    const payload = {
      promotionType: 'Coupon',
      name: form.name.trim(),
      couponCode: form.couponCode.trim().toUpperCase(),
      description: form.description,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.discountType === 'Percentage' && form.maxDiscountAmount !== '' ? Number(form.maxDiscountAmount) : undefined,
      minOrderAmount: form.minOrderAmount !== '' ? Number(form.minOrderAmount) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : undefined,
      usageLimitPerCustomer: form.usageLimitPerCustomer !== '' ? Number(form.usageLimitPerCustomer) : undefined,
      applicableTo: form.applicableTo,
      applicableItems: form.applicableTo === 'Specific Items' ? form.applicableItems : [],
      targetType: form.targetType,
      targetCustomers: form.targetType === 'Specific' ? form.targetCustomers : [],
      targetGroup: form.targetType === 'Group' ? form.targetGroup : '',
      status: form.status,
    };

    setSaving(true);
    try {
      if (editingId) {
        await businessPromotionAPI.update(editingId, payload);
        notifications.show({
          title: 'Success',
          message: 'Coupon updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        await businessPromotionAPI.create(payload);
        notifications.show({
          title: 'Success',
          message: 'Coupon created successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
      handleCloseModal();
      fetchCoupons();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to save coupon',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id) => {
    setPendingDeleteId(id);
    openDeleteModal();
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleting(pendingDeleteId);
    try {
      await businessPromotionAPI.delete(pendingDeleteId);
      notifications.show({
        title: 'Deleted',
        message: 'Coupon deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      closeDeleteModal();
      setPendingDeleteId(null);
      fetchCoupons();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete coupon',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDiscount = (coupon) => {
    if (!coupon.discountType || coupon.discountValue === undefined) return '-';
    return coupon.discountType === 'Percentage'
      ? `${coupon.discountValue}%`
      : `₹${coupon.discountValue}`;
  };

  const rows = coupons.map((coupon) => (
    <Table.Tr key={coupon._id}>
      <Table.Td>
        <Text fw={600} size="sm" ff="monospace">
          {coupon.couponCode}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{coupon.name}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDiscount(coupon)}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">
          {coupon.minOrderAmount != null ? `₹${coupon.minOrderAmount}` : '-'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">
          {coupon.currentUsageCount ?? 0}
          {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ''}
        </Text>
      </Table.Td>
      <Table.Td>
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            {coupon.startDate ? dayjs(coupon.startDate).format('DD MMM YYYY') : '-'}
          </Text>
          <Text size="xs" c="dimmed">
            {coupon.endDate ? dayjs(coupon.endDate).format('DD MMM YYYY') : '-'}
          </Text>
        </Stack>
      </Table.Td>
      <Table.Td>
        <Badge color={STATUS_COLORS[coupon.status] || 'gray'} variant="light" size="sm">
          {coupon.status || 'Draft'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            color="blue"
            size="sm"
            onClick={() => handleOpenEdit(coupon)}
            title="Edit"
          >
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="red"
            size="sm"
            onClick={() => handleDeleteClick(coupon._id)}
            loading={deleting === coupon._id}
            title="Delete"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <IconTicket size={28} color="var(--mantine-color-violet-6)" />
            <div>
              <Title order={2}>Coupon Manager</Title>
              <Text size="sm" c="dimmed">
                Create and manage discount coupons for your business
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={fetchCoupons}
              loading={loading}
            >
              Refresh
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate} color="violet">
              Create Coupon
            </Button>
          </Group>
        </Group>

        <Paper withBorder shadow="sm" radius="md" p={0}>
          {loading ? (
            <Center py="xl">
              <Loader size="lg" color="violet" />
            </Center>
          ) : coupons.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconTag size={48} color="var(--mantine-color-gray-4)" />
                <Text c="dimmed" size="sm">
                  No coupons found. Create your first coupon!
                </Text>
                <Button
                  variant="light"
                  color="violet"
                  leftSection={<IconPlus size={16} />}
                  onClick={handleOpenCreate}
                  size="sm"
                >
                  Create Coupon
                </Button>
              </Stack>
            </Center>
          ) : (
            <ScrollArea>
              <Table highlightOnHover striped withTableBorder={false} verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Code</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Discount</Table.Th>
                    <Table.Th>Min Order</Table.Th>
                    <Table.Th>Usage</Table.Th>
                    <Table.Th>Validity</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Paper>
      </Stack>

      {/* Create / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={
          <Group gap="xs">
            <IconTicket size={20} color="var(--mantine-color-violet-6)" />
            <Text fw={600}>{editingId ? 'Edit Coupon' : 'Create Coupon'}</Text>
          </Group>
        }
        size="lg"
        scrollAreaComponent={ScrollArea.Autosize}
        closeOnClickOutside={false}
      >
        <Stack gap="sm">
          {/* Basic Info */}
          <Text fw={500} size="sm" c="violet">
            Basic Information
          </Text>
          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={6}>
              <TextInput
                label="Coupon Name"
                placeholder="e.g. Summer Sale"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Coupon Code"
                placeholder="e.g. SAVE20"
                value={form.couponCode}
                onChange={(e) => setField('couponCode', e.target.value.toUpperCase())}
                required
                rightSection={
                  <ActionIcon
                    variant="subtle"
                    color="violet"
                    size="sm"
                    onClick={() => setField('couponCode', generateCouponCode())}
                    title="Auto-generate code"
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                }
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Description"
            placeholder="Optional description for this coupon"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
          />

          {/* Discount Settings */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Discount Settings
          </Text>
          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={4}>
              <Select
                label="Discount Type"
                data={[
                  { value: 'Percentage', label: 'Percentage (%)' },
                  { value: 'Flat', label: 'Flat Amount (₹)' },
                ]}
                value={form.discountType}
                onChange={(val) => setField('discountType', val)}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="Discount Value"
                placeholder={form.discountType === 'Percentage' ? 'e.g. 10' : 'e.g. 50'}
                value={form.discountValue}
                onChange={(val) => setField('discountValue', val)}
                min={0}
                max={form.discountType === 'Percentage' ? 100 : undefined}
                required
              />
            </Grid.Col>
            {form.discountType === 'Percentage' && (
              <Grid.Col span={4}>
                <NumberInput
                  label="Max Discount (₹)"
                  placeholder="e.g. 200"
                  value={form.maxDiscountAmount}
                  onChange={(val) => setField('maxDiscountAmount', val)}
                  min={0}
                />
              </Grid.Col>
            )}
            <Grid.Col span={form.discountType === 'Percentage' ? 12 : 8}>
              <NumberInput
                label="Min Order Amount (₹)"
                placeholder="e.g. 500"
                value={form.minOrderAmount}
                onChange={(val) => setField('minOrderAmount', val)}
                min={0}
              />
            </Grid.Col>
          </Grid>

          {/* Validity */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Validity Period
          </Text>
          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={6}>
              <DateInput
                label="Start Date"
                placeholder="Select start date"
                value={form.startDate}
                onChange={(val) => setField('startDate', val)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="Select end date"
                value={form.endDate}
                onChange={(val) => setField('endDate', val)}
                clearable
                minDate={form.startDate || undefined}
              />
            </Grid.Col>
          </Grid>

          {/* Usage Limits */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Usage Limits
          </Text>
          <Divider />

          <Grid gutter="sm">
            <Grid.Col span={6}>
              <NumberInput
                label="Total Usage Limit"
                placeholder="Leave empty for unlimited"
                value={form.usageLimit}
                onChange={(val) => setField('usageLimit', val)}
                min={1}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Per Customer Limit"
                placeholder="Leave empty for unlimited"
                value={form.usageLimitPerCustomer}
                onChange={(val) => setField('usageLimitPerCustomer', val)}
                min={1}
              />
            </Grid.Col>
          </Grid>

          {/* Applicability */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Applicability
          </Text>
          <Divider />

          <Select
            label="Applicable To"
            data={[
              { value: 'All Items', label: 'All Items' },
              { value: 'Specific Items', label: 'Specific Items' },
              { value: 'Specific Categories', label: 'Specific Categories' },
            ]}
            value={form.applicableTo}
            onChange={(val) => setField('applicableTo', val)}
          />

          {form.applicableTo === 'Specific Items' && (
            <MultiSelect
              label="Select Items"
              placeholder="Search and select items"
              data={items}
              value={form.applicableItems}
              onChange={(val) => setField('applicableItems', val)}
              searchable
              clearable
              nothingFoundMessage="No items found"
            />
          )}

          {/* Target Customers */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Target Customers
          </Text>
          <Divider />

          <Select
            label="Target Type"
            data={[
              { value: 'All', label: 'All Customers' },
              { value: 'Specific', label: 'Specific Customers' },
              { value: 'Group', label: 'Customer Group' },
            ]}
            value={form.targetType}
            onChange={(val) => setField('targetType', val)}
          />

          {form.targetType === 'Specific' && (
            <MultiSelect
              label="Select Customers"
              placeholder="Search and select customers"
              data={customers}
              value={form.targetCustomers}
              onChange={(val) => setField('targetCustomers', val)}
              searchable
              clearable
              nothingFoundMessage="No customers found"
            />
          )}

          {form.targetType === 'Group' && (
            <TextInput
              label="Customer Group Name"
              placeholder="e.g. VIP, Premium, Wholesale"
              value={form.targetGroup}
              onChange={(e) => setField('targetGroup', e.target.value)}
            />
          )}

          {/* Status */}
          <Text fw={500} size="sm" c="violet" mt="xs">
            Status
          </Text>
          <Divider />

          <Select
            label="Coupon Status"
            data={[
              { value: 'Draft', label: 'Draft' },
              { value: 'Active', label: 'Active' },
              { value: 'Paused', label: 'Paused' },
            ]}
            value={form.status}
            onChange={(val) => setField('status', val)}
          />

          <Divider mt="xs" />

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button
              color="violet"
              leftSection={<IconCheck size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              {editingId ? 'Update Coupon' : 'Create Coupon'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setPendingDeleteId(null);
        }}
        title={
          <Group gap="xs">
            <IconTrash size={20} color="var(--mantine-color-red-6)" />
            <Text fw={600}>Delete Coupon</Text>
          </Group>
        }
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete this coupon? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                closeDeleteModal();
                setPendingDeleteId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleDeleteConfirm}
              loading={!!deleting}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
