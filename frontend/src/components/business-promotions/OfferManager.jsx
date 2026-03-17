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
  Grid,
  MultiSelect,
  Loader,
  Center,
  Divider
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconTag,
  IconRefresh,
  IconGift,
  IconPercentage,
  IconCurrencyRupee,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { businessPromotionAPI, businessItemAPI, businessCustomerAPI } from '../../services/api';

const OFFER_TYPE_OPTIONS = [
  { value: 'Buy X Get Y', label: 'Buy X Get Y' },
  { value: 'Percentage Discount', label: 'Percentage Discount' },
  { value: 'Flat Discount', label: 'Flat Discount' },
  { value: 'Free Item', label: 'Free Item' }
];

const APPLICABLE_TO_OPTIONS = [
  { value: 'All', label: 'All Items' },
  { value: 'Specific Items', label: 'Specific Items' }
];

const TARGET_TYPE_OPTIONS = [
  { value: 'All Customers', label: 'All Customers' },
  { value: 'Specific Customers', label: 'Specific Customers' },
  { value: 'Customer Group', label: 'Customer Group' }
];

const STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'Paused', label: 'Paused' }
];

const CUSTOMER_GROUP_OPTIONS = [
  { value: 'Retail', label: 'Retail' },
  { value: 'Wholesale', label: 'Wholesale' },
  { value: 'VIP', label: 'VIP' }
];

const getOfferTypeBadgeColor = (offerType) => {
  switch (offerType) {
    case 'Buy X Get Y': return 'blue';
    case 'Percentage Discount': return 'green';
    case 'Flat Discount': return 'orange';
    case 'Free Item': return 'grape';
    default: return 'gray';
  }
};

const getStatusBadgeColor = (status) => {
  switch (status) {
    case 'Active': return 'green';
    case 'Draft': return 'gray';
    case 'Paused': return 'yellow';
    case 'Expired': return 'red';
    default: return 'gray';
  }
};

const getOfferTypeBadgeIcon = (offerType) => {
  switch (offerType) {
    case 'Buy X Get Y': return <IconGift size={12} />;
    case 'Percentage Discount': return <IconPercentage size={12} />;
    case 'Flat Discount': return <IconCurrencyRupee size={12} />;
    case 'Free Item': return <IconTag size={12} />;
    default: return null;
  }
};

const getOfferDetails = (offer) => {
  switch (offer.offerType) {
    case 'Buy X Get Y':
      return `Buy ${offer.buyQuantity || 0}, Get ${offer.getQuantity || 0} (${offer.getItemName || 'Same Item'}) Free`;
    case 'Percentage Discount':
      return `${offer.discountValue || 0}% Off`;
    case 'Flat Discount':
      return `Flat Rs. ${offer.discountValue || 0} Off`;
    case 'Free Item':
      return `Buy ${offer.buyQuantity || 0}, Get 1 ${offer.getItemName || 'Free Item'} Free`;
    default:
      return '-';
  }
};

const EMPTY_FORM = {
  name: '',
  description: '',
  offerType: 'Percentage Discount',
  buyQuantity: 1,
  getQuantity: 1,
  getItemId: '',
  getItemName: '',
  discountType: 'Percentage',
  discountValue: 0,
  startDate: null,
  endDate: null,
  applicableTo: 'All',
  applicableItems: [],
  targetType: 'All Customers',
  targetCustomers: [],
  targetGroup: '',
  status: 'Draft'
};

const OfferManager = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [offerToDelete, setOfferToDelete] = useState(null);

  useEffect(() => {
    fetchOffers();
    fetchItems();
    fetchCustomers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const response = await businessPromotionAPI.getAll({ promotionType: 'Offer' });
      const data = response?.data || response || [];
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to load offers',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await businessItemAPI.getAll();
      const data = response?.data || response || [];
      const itemList = Array.isArray(data) ? data : [];
      setItems(itemList.map((item) => ({ value: item._id, label: item.itemName })));
    } catch (err) {
      // Non-critical; silently skip
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await businessCustomerAPI.getAll();
      const data = response?.data || response || [];
      const customerList = Array.isArray(data) ? data : [];
      setCustomers(
        customerList.map((c) => ({
          value: c._id,
          label: c.name || c.customerName || c.customerId || c._id
        }))
      );
    } catch (err) {
      // Non-critical; silently skip
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSelectedOffer(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    openModal();
  };

  const handleOpenEdit = (offer) => {
    setSelectedOffer(offer);
    setForm({
      name: offer.name || '',
      description: offer.description || '',
      offerType: offer.offerType || 'Percentage Discount',
      buyQuantity: offer.buyQuantity ?? 1,
      getQuantity: offer.getQuantity ?? 1,
      getItemId: offer.getItemId || '',
      getItemName: offer.getItemName || '',
      discountType: offer.discountType || 'Percentage',
      discountValue: offer.discountValue ?? 0,
      startDate: offer.startDate ? new Date(offer.startDate) : null,
      endDate: offer.endDate ? new Date(offer.endDate) : null,
      applicableTo: offer.applicableTo || 'All',
      applicableItems: offer.applicableItems || [],
      targetType: offer.targetType || 'All Customers',
      targetCustomers: offer.targetCustomers || [],
      targetGroup: offer.targetGroup || '',
      status: offer.status || 'Draft'
    });
    setFormErrors({});
    openModal();
  };

  const handleCloseModal = () => {
    closeModal();
    resetForm();
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-set discountType when offerType changes
      if (field === 'offerType') {
        if (value === 'Percentage Discount') {
          updated.discountType = 'Percentage';
        } else if (value === 'Flat Discount') {
          updated.discountType = 'Flat';
        }
      }
      // Auto-fill getItemName from items list
      if (field === 'getItemId') {
        const found = items.find((i) => i.value === value);
        updated.getItemName = found ? found.label : '';
      }
      return updated;
    });
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Offer name is required';
    if (!form.offerType) errors.offerType = 'Offer type is required';
    if (!form.startDate) errors.startDate = 'Start date is required';
    if (!form.endDate) errors.endDate = 'End date is required';
    if (form.startDate && form.endDate && dayjs(form.endDate).isBefore(dayjs(form.startDate))) {
      errors.endDate = 'End date must be after start date';
    }
    if (['Buy X Get Y', 'Free Item'].includes(form.offerType)) {
      if (!form.buyQuantity || form.buyQuantity < 1) errors.buyQuantity = 'Buy quantity must be at least 1';
    }
    if (form.offerType === 'Buy X Get Y') {
      if (!form.getQuantity || form.getQuantity < 1) errors.getQuantity = 'Get quantity must be at least 1';
    }
    if (['Percentage Discount', 'Flat Discount'].includes(form.offerType)) {
      if (!form.discountValue || form.discountValue <= 0) errors.discountValue = 'Discount value must be greater than 0';
      if (form.offerType === 'Percentage Discount' && form.discountValue > 100) {
        errors.discountValue = 'Percentage cannot exceed 100';
      }
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the highlighted fields',
        color: 'orange',
        icon: <IconX size={16} />
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        promotionType: 'Offer',
        startDate: form.startDate ? dayjs(form.startDate).toISOString() : null,
        endDate: form.endDate ? dayjs(form.endDate).toISOString() : null
      };

      if (selectedOffer) {
        await businessPromotionAPI.update(selectedOffer._id, payload);
        notifications.show({
          title: 'Success',
          message: 'Offer updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      } else {
        await businessPromotionAPI.create(payload);
        notifications.show({
          title: 'Success',
          message: 'Offer created successfully',
          color: 'green',
          icon: <IconCheck size={16} />
        });
      }

      handleCloseModal();
      fetchOffers();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to save offer',
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (offer) => {
    setOfferToDelete(offer);
    openDeleteModal();
  };

  const handleDeleteConfirm = async () => {
    if (!offerToDelete) return;
    try {
      await businessPromotionAPI.delete(offerToDelete._id);
      notifications.show({
        title: 'Deleted',
        message: 'Offer deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      closeDeleteModal();
      setOfferToDelete(null);
      fetchOffers();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err?.message || 'Failed to delete offer',
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  };

  const renderConditionalFields = () => {
    const { offerType } = form;

    if (offerType === 'Buy X Get Y') {
      return (
        <Grid>
          <Grid.Col span={4}>
            <NumberInput
              label="Buy Quantity"
              placeholder="e.g. 2"
              min={1}
              value={form.buyQuantity}
              onChange={(val) => handleFieldChange('buyQuantity', val)}
              error={formErrors.buyQuantity}
              required
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <NumberInput
              label="Get Quantity"
              placeholder="e.g. 1"
              min={1}
              value={form.getQuantity}
              onChange={(val) => handleFieldChange('getQuantity', val)}
              error={formErrors.getQuantity}
              required
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Select
              label="Get Item (Free)"
              placeholder="Select item"
              data={items}
              value={form.getItemId}
              onChange={(val) => handleFieldChange('getItemId', val)}
              searchable
              clearable
            />
          </Grid.Col>
        </Grid>
      );
    }

    if (offerType === 'Percentage Discount') {
      return (
        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label="Discount Percentage (%)"
              placeholder="e.g. 10"
              min={0.01}
              max={100}
              step={0.01}
              value={form.discountValue}
              onChange={(val) => handleFieldChange('discountValue', val)}
              error={formErrors.discountValue}
              required
              rightSection={<IconPercentage size={16} />}
            />
          </Grid.Col>
        </Grid>
      );
    }

    if (offerType === 'Flat Discount') {
      return (
        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label="Flat Discount Amount (Rs.)"
              placeholder="e.g. 50"
              min={0.01}
              step={0.01}
              value={form.discountValue}
              onChange={(val) => handleFieldChange('discountValue', val)}
              error={formErrors.discountValue}
              required
              leftSection={<IconCurrencyRupee size={16} />}
            />
          </Grid.Col>
        </Grid>
      );
    }

    if (offerType === 'Free Item') {
      return (
        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label="Minimum Buy Quantity"
              placeholder="e.g. 3"
              min={1}
              value={form.buyQuantity}
              onChange={(val) => handleFieldChange('buyQuantity', val)}
              error={formErrors.buyQuantity}
              required
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Free Item"
              placeholder="Select free item"
              data={items}
              value={form.getItemId}
              onChange={(val) => handleFieldChange('getItemId', val)}
              searchable
              clearable
            />
          </Grid.Col>
        </Grid>
      );
    }

    return null;
  };

  const renderTargetFields = () => {
    if (form.targetType === 'Specific Customers') {
      return (
        <MultiSelect
          label="Target Customers"
          placeholder="Select customers"
          data={customers}
          value={form.targetCustomers}
          onChange={(val) => handleFieldChange('targetCustomers', val)}
          searchable
          clearable
        />
      );
    }
    if (form.targetType === 'Customer Group') {
      return (
        <Select
          label="Customer Group"
          placeholder="Select group"
          data={CUSTOMER_GROUP_OPTIONS}
          value={form.targetGroup}
          onChange={(val) => handleFieldChange('targetGroup', val)}
        />
      );
    }
    return null;
  };

  const formatApplicableItems = (offer) => {
    if (offer.applicableTo === 'All') return 'All Items';
    const count = (offer.applicableItems || []).length;
    return count > 0 ? `${count} item${count !== 1 ? 's' : ''}` : 'None selected';
  };

  const formatDateRange = (offer) => {
    const start = offer.startDate ? dayjs(offer.startDate).format('DD MMM YYYY') : '-';
    const end = offer.endDate ? dayjs(offer.endDate).format('DD MMM YYYY') : '-';
    return `${start} - ${end}`;
  };

  return (
    <Container fluid px="md" py="md">
      <Stack gap="md">
        {/* Header */}
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Title order={3}>Offers & Schemes</Title>
              <Text size="sm" c="dimmed">
                Manage discount offers, buy-get promotions, and free item schemes
              </Text>
            </Stack>
            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={fetchOffers}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenCreate}
              >
                New Offer
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* Offers Table */}
        <Paper p="md" radius="md" withBorder>
          {loading ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Loader size="lg" />
                <Text c="dimmed">Loading offers...</Text>
              </Stack>
            </Center>
          ) : offers.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconTag size={48} color="gray" />
                <Text size="lg" fw={500} c="dimmed">No offers found</Text>
                <Text size="sm" c="dimmed">Create your first offer to get started</Text>
                <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
                  Create Offer
                </Button>
              </Stack>
            </Center>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Offer Type</Table.Th>
                    <Table.Th>Details</Table.Th>
                    <Table.Th>Applicable Items</Table.Th>
                    <Table.Th>Validity</Table.Th>
                    <Table.Th>Redemptions</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {offers.map((offer) => (
                    <Table.Tr key={offer._id}>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={500} size="sm">{offer.name}</Text>
                          {offer.description && (
                            <Text size="xs" c="dimmed" lineClamp={1}>{offer.description}</Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getOfferTypeBadgeColor(offer.offerType)}
                          leftSection={getOfferTypeBadgeIcon(offer.offerType)}
                          variant="light"
                          size="sm"
                        >
                          {offer.offerType}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{getOfferDetails(offer)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatApplicableItems(offer)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDateRange(offer)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ta="center">
                          {(offer.redemptions || []).length}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusBadgeColor(offer.status)}
                          variant="filled"
                          size="sm"
                        >
                          {offer.status || 'Draft'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleOpenEdit(offer)}
                            title="Edit offer"
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleDeleteClick(offer)}
                            title="Delete offer"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
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
          <Group gap="sm">
            <IconTag size={20} />
            <Text fw={600}>{selectedOffer ? 'Edit Offer' : 'Create New Offer'}</Text>
          </Group>
        }
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Stack gap="md">
          {/* Basic Info */}
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Offer Name"
                placeholder="e.g. Summer Sale 10% Off"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={formErrors.name}
                required
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Status"
                data={STATUS_OPTIONS}
                value={form.status}
                onChange={(val) => handleFieldChange('status', val)}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Description"
            placeholder="Brief description of the offer..."
            value={form.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            minRows={2}
            autosize
          />

          <Divider label="Offer Configuration" labelPosition="left" />

          <Select
            label="Offer Type"
            data={OFFER_TYPE_OPTIONS}
            value={form.offerType}
            onChange={(val) => handleFieldChange('offerType', val)}
            error={formErrors.offerType}
            required
          />

          {/* Conditional fields based on offerType */}
          {renderConditionalFields()}

          <Divider label="Validity Period" labelPosition="left" />

          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Start Date"
                placeholder="Pick start date"
                value={form.startDate}
                onChange={(val) => handleFieldChange('startDate', val)}
                error={formErrors.startDate}
                required
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="Pick end date"
                value={form.endDate}
                onChange={(val) => handleFieldChange('endDate', val)}
                error={formErrors.endDate}
                required
                clearable
                minDate={form.startDate || undefined}
              />
            </Grid.Col>
          </Grid>

          <Divider label="Applicability" labelPosition="left" />

          <Select
            label="Applicable To"
            data={APPLICABLE_TO_OPTIONS}
            value={form.applicableTo}
            onChange={(val) => handleFieldChange('applicableTo', val)}
          />

          {form.applicableTo === 'Specific Items' && (
            <MultiSelect
              label="Select Applicable Items"
              placeholder="Search and select items"
              data={items}
              value={form.applicableItems}
              onChange={(val) => handleFieldChange('applicableItems', val)}
              searchable
              clearable
            />
          )}

          <Divider label="Target Customers" labelPosition="left" />

          <Select
            label="Target Type"
            data={TARGET_TYPE_OPTIONS}
            value={form.targetType}
            onChange={(val) => handleFieldChange('targetType', val)}
          />

          {renderTargetFields()}

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={handleCloseModal} disabled={saving}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              {selectedOffer ? 'Update Offer' : 'Create Offer'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setOfferToDelete(null);
        }}
        title={
          <Group gap="sm">
            <IconTrash size={20} color="red" />
            <Text fw={600} c="red">Delete Offer</Text>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the offer{' '}
            <Text component="span" fw={600}>{offerToDelete?.name}</Text>?
            This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                closeDeleteModal();
                setOfferToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default OfferManager;
