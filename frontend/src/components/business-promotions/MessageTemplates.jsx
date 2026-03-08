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
  Select,
  Textarea,
  ActionIcon,
  ScrollArea,
  Divider,
  Grid,
  Loader,
  Center,
  Card,
  Code,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconMessage,
  IconBrandWhatsapp,
  IconDeviceMobile,
  IconEye,
  IconRefresh,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { businessPromotionAPI } from '../../services/api';

const CHANNEL_OPTIONS = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'Both', label: 'Both' },
];

const CATEGORY_OPTIONS = [
  { value: 'Coupon', label: 'Coupon' },
  { value: 'Offer', label: 'Offer' },
  { value: 'Festival', label: 'Festival' },
  { value: 'Reminder', label: 'Reminder' },
  { value: 'Welcome', label: 'Welcome' },
  { value: 'Custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const PLACEHOLDER_BUTTONS = [
  '{{customerName}}',
  '{{couponCode}}',
  '{{discount}}',
  '{{storeName}}',
  '{{expiryDate}}',
  '{{minOrder}}',
  '{{phone}}',
];

const SAMPLE_VALUES = {
  customerName: 'John',
  couponCode: 'SAVE20',
  discount: '20%',
  storeName: 'Our Store',
  expiryDate: '31 Dec 2026',
  minOrder: '500',
  phone: '9876543210',
};

const CHANNEL_FILTER_OPTIONS = [
  { value: 'All', label: 'All Channels' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'SMS', label: 'SMS' },
  { value: 'Both', label: 'Both' },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: 'All', label: 'All Categories' },
  ...CATEGORY_OPTIONS,
];

function getChannelColor(channel) {
  if (channel === 'WhatsApp') return 'green';
  if (channel === 'SMS') return 'blue';
  return 'grape';
}

function getCategoryColor(category) {
  const map = {
    Coupon: 'orange',
    Offer: 'red',
    Festival: 'yellow',
    Reminder: 'cyan',
    Welcome: 'teal',
    Custom: 'gray',
  };
  return map[category] || 'gray';
}

function getChannelIcon(channel) {
  if (channel === 'WhatsApp') return <IconBrandWhatsapp size={14} />;
  if (channel === 'SMS') return <IconDeviceMobile size={14} />;
  return <IconMessage size={14} />;
}

function extractPlaceholders(messageBody) {
  const matches = [...messageBody.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function buildPreview(messageBody) {
  let preview = messageBody;
  for (const [key, val] of Object.entries(SAMPLE_VALUES)) {
    preview = preview.replaceAll(`{{${key}}}`, val);
  }
  return preview;
}

const EMPTY_FORM = {
  name: '',
  channel: 'WhatsApp',
  category: 'Custom',
  messageBody: '',
  status: 'Active',
};

export default function MessageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [channelFilter, setChannelFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await businessPromotionAPI.getAllTemplates();
      const data = response?.data || response || [];
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load templates',
        color: 'red',
        icon: <IconX size={16} />,
      });
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const filteredTemplates = templates.filter((t) => {
    const matchChannel = channelFilter === 'All' || t.channel === channelFilter;
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    return matchChannel && matchCategory;
  });

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    openModal();
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name || '',
      channel: template.channel || 'WhatsApp',
      category: template.category || 'Custom',
      messageBody: template.messageBody || '',
      status: template.status || 'Active',
    });
    setFormErrors({});
    openModal();
  };

  const handleOpenDelete = (template) => {
    setDeletingTemplate(template);
    openDeleteModal();
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleInsertPlaceholder = (placeholder) => {
    setForm((prev) => ({
      ...prev,
      messageBody: prev.messageBody
        ? prev.messageBody + ' ' + placeholder
        : placeholder,
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Template name is required';
    if (!form.channel) errors.channel = 'Channel is required';
    if (!form.category) errors.category = 'Category is required';
    if (!form.messageBody.trim()) errors.messageBody = 'Message body is required';
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const placeholders = extractPlaceholders(form.messageBody);
    const payload = { ...form, placeholders };

    setSaving(true);
    try {
      if (editingTemplate) {
        const response = await businessPromotionAPI.updateTemplate(editingTemplate._id, payload);
        if (response?.success || response?.data || response) {
          notifications.show({
            title: 'Success',
            message: 'Template updated successfully',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }
      } else {
        const response = await businessPromotionAPI.createTemplate(payload);
        if (response?.success || response?.data || response) {
          notifications.show({
            title: 'Success',
            message: 'Template created successfully',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }
      }
      closeModal();
      fetchTemplates();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: editingTemplate ? 'Failed to update template' : 'Failed to create template',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setSaving(true);
    try {
      await businessPromotionAPI.deleteTemplate(deletingTemplate._id);
      notifications.show({
        title: 'Deleted',
        message: 'Template deleted successfully',
        color: 'orange',
        icon: <IconTrash size={16} />,
      });
      closeDeleteModal();
      setDeletingTemplate(null);
      fetchTemplates();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete template',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setSaving(false);
    }
  };

  const previewText = buildPreview(form.messageBody);
  const charCount = form.messageBody.length;
  const smsSegments = charCount > 0 ? Math.ceil(charCount / 160) : 0;

  const rows = filteredTemplates.map((template) => (
    <Table.Tr key={template._id}>
      <Table.Td>
        <Text fw={500} size="sm">
          {template.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge
          color={getChannelColor(template.channel)}
          variant="light"
          leftSection={getChannelIcon(template.channel)}
        >
          {template.channel}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge color={getCategoryColor(template.category)} variant="outline">
          {template.category}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed" lineClamp={1} maw={260}>
          {template.messageBody
            ? template.messageBody.length > 80
              ? template.messageBody.slice(0, 80) + '...'
              : template.messageBody
            : '-'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={template.status === 'Active' ? 'green' : 'gray'} variant="filled" size="sm">
          {template.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            title="Edit"
            onClick={() => handleOpenEdit(template)}
          >
            <IconEdit size={15} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            title="Delete"
            onClick={() => handleOpenDelete(template)}
          >
            <IconTrash size={15} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <Stack gap={2}>
          <Title order={3}>Message Templates</Title>
          <Text c="dimmed" size="sm">
            Manage WhatsApp and SMS message templates for promotions
          </Text>
        </Stack>
        <Group>
          <ActionIcon variant="subtle" color="gray" size="lg" title="Refresh" onClick={fetchTemplates}>
            <IconRefresh size={18} />
          </ActionIcon>
          <Button leftSection={<IconPlus size={16} />} onClick={handleOpenCreate}>
            New Template
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="md" p="md" mb="md">
        <Group gap="md">
          <Select
            label="Channel"
            value={channelFilter}
            onChange={(val) => setChannelFilter(val || 'All')}
            data={CHANNEL_FILTER_OPTIONS}
            w={180}
            size="sm"
          />
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val || 'All')}
            data={CATEGORY_FILTER_OPTIONS}
            w={200}
            size="sm"
          />
        </Group>
      </Paper>

      <Paper withBorder radius="md">
        {loading ? (
          <Center py={60}>
            <Loader size="md" />
          </Center>
        ) : filteredTemplates.length === 0 ? (
          <Center py={60}>
            <Stack align="center" gap="xs">
              <IconMessage size={40} color="gray" />
              <Text c="dimmed">No templates found</Text>
              <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={handleOpenCreate}>
                Create your first template
              </Button>
            </Stack>
          </Center>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Channel</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Message Preview</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Create / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={
          <Text fw={600} size="lg">
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </Text>
        }
        size="900px"
        centered
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Grid gutter="md">
          {/* Left: Form */}
          <Grid.Col span={6}>
            <Stack gap="sm">
              <TextInput
                label="Template Name"
                placeholder="e.g. Welcome Message"
                value={form.name}
                onChange={(e) => handleFormChange('name', e.currentTarget.value)}
                error={formErrors.name}
                required
              />

              <Select
                label="Channel"
                placeholder="Select channel"
                value={form.channel}
                onChange={(val) => handleFormChange('channel', val)}
                data={CHANNEL_OPTIONS}
                error={formErrors.channel}
                required
              />

              <Select
                label="Category"
                placeholder="Select category"
                value={form.category}
                onChange={(val) => handleFormChange('category', val)}
                data={CATEGORY_OPTIONS}
                error={formErrors.category}
                required
              />

              <Select
                label="Status"
                value={form.status}
                onChange={(val) => handleFormChange('status', val)}
                data={STATUS_OPTIONS}
              />

              <div>
                <Textarea
                  label="Message Body"
                  placeholder="Type your message here. Use placeholder buttons below to insert variables."
                  value={form.messageBody}
                  onChange={(e) => handleFormChange('messageBody', e.currentTarget.value)}
                  error={formErrors.messageBody}
                  minRows={6}
                  autosize
                  required
                />

                <Text size="xs" c="dimmed" mt={6} mb={4}>
                  Insert placeholders:
                </Text>
                <Group gap={6} wrap="wrap">
                  {PLACEHOLDER_BUTTONS.map((ph) => (
                    <Button
                      key={ph}
                      size="xs"
                      variant="light"
                      color="violet"
                      onClick={() => handleInsertPlaceholder(ph)}
                    >
                      {ph}
                    </Button>
                  ))}
                </Group>
              </div>

              {form.messageBody && (
                <div>
                  <Text size="xs" c="dimmed" mb={4}>
                    Detected placeholders:
                  </Text>
                  <Group gap={6} wrap="wrap">
                    {extractPlaceholders(form.messageBody).length === 0 ? (
                      <Text size="xs" c="dimmed">
                        None
                      </Text>
                    ) : (
                      extractPlaceholders(form.messageBody).map((ph) => (
                        <Code key={ph}>{`{{${ph}}}`}</Code>
                      ))
                    )}
                  </Group>
                </div>
              )}
            </Stack>
          </Grid.Col>

          {/* Right: Preview */}
          <Grid.Col span={6}>
            <Stack gap="sm" h="100%">
              <Group gap={6}>
                <IconEye size={16} />
                <Text fw={600} size="sm">
                  Live Preview
                </Text>
              </Group>

              <Card withBorder radius="md" bg="gray.0" style={{ flex: 1, minHeight: 200 }}>
                {form.messageBody ? (
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {previewText}
                  </Text>
                ) : (
                  <Center h={120}>
                    <Text c="dimmed" size="sm">
                      Preview will appear here
                    </Text>
                  </Center>
                )}
              </Card>

              <Divider />

              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    Character count:
                  </Text>
                  <Badge variant="outline" color={charCount > 160 ? 'orange' : 'blue'} size="sm">
                    {charCount}
                  </Badge>
                </Group>

                {(form.channel === 'SMS' || form.channel === 'Both') && charCount > 0 && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">
                      SMS segments:
                    </Text>
                    <Badge variant="outline" color={smsSegments > 1 ? 'orange' : 'green'} size="sm">
                      {smsSegments} {smsSegments === 1 ? 'segment' : 'segments'}
                    </Badge>
                  </Group>
                )}

                <Text size="xs" c="dimmed" mt={4}>
                  Sample values used: John, SAVE20, 20%, Our Store, 31 Dec 2026, 500, 9876543210
                </Text>
              </Stack>
            </Stack>
          </Grid.Col>
        </Grid>

        <Divider my="md" />

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button
            leftSection={saving ? <Loader size={14} /> : <IconCheck size={16} />}
            onClick={handleSave}
            loading={saving}
          >
            {editingTemplate ? 'Update Template' : 'Create Template'}
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          closeDeleteModal();
          setDeletingTemplate(null);
        }}
        title={
          <Text fw={600} size="lg" c="red">
            Delete Template
          </Text>
        }
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the template{' '}
            <Text component="span" fw={600}>
              {deletingTemplate?.name}
            </Text>
            ? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                closeDeleteModal();
                setDeletingTemplate(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={saving ? <Loader size={14} /> : <IconTrash size={16} />}
              onClick={handleDelete}
              loading={saving}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
