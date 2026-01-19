import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Modal,
  Text,
  Title,
  Button,
  Group,
  Select,
  TextInput,
  NumberInput,
  Textarea,
  SimpleGrid,
  Paper,
  Stack,
  Alert,
  Badge,
  Loader,
  Card,
  Divider
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconX,
  IconAlertCircle,
  IconCoin,
  IconFileCertificate,
  IconCalendar,
  IconNote
} from '@tabler/icons-react';
import { farmerAPI } from '../../services/api';

const AddShareModal = ({ opened, onClose, onSuccess, farmer }) => {
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      transactionType: farmer?.financialDetails?.totalShares > 0 ? 'Additional Allotment' : 'Allotment',
      shares: '',
      shareValue: '',
      resolutionNo: '',
      resolutionDate: '',
      remarks: ''
    },

    validate: {
      shares: (value) => {
        if (!value) return 'Number of shares is required';
        if (parseFloat(value) <= 0) return 'Please enter a valid number of shares';
        return null;
      },
      shareValue: (value) => {
        if (!value) return 'Share value is required';
        if (parseFloat(value) <= 0) return 'Please enter a valid share value';
        return null;
      },
      resolutionNo: (value) => !value ? 'Resolution number is required' : null,
      resolutionDate: (value) => !value ? 'Resolution date is required' : null,
    }
  });

  useEffect(() => {
    if (farmer) {
      form.setFieldValue('transactionType', farmer.financialDetails?.totalShares > 0 ? 'Additional Allotment' : 'Allotment');
    }
  }, [farmer]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await farmerAPI.addShares(farmer._id, {
        ...values,
        shares: parseFloat(values.shares),
        shareValue: parseFloat(values.shareValue)
      });

      notifications.show({
        title: 'Success',
        message: 'Shares updated successfully',
        color: 'green'
      });
      
      form.reset();
      onSuccess();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update shares',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const totalValue = (parseFloat(form.values.shares) || 0) * (parseFloat(form.values.shareValue) || 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Title order={3}>
          <Group spacing="xs">
            <IconCoin size={20} />
            Add Shares
          </Group>
        </Title>
      }
      size="lg"
      centered
      overlayProps={{
        blur: 3,
        opacity: 0.55,
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack spacing="md">
          {/* Current Shares Summary */}
          <Paper p="md" withBorder>
            <SimpleGrid cols={3} spacing="md">
              <div>
                <Text size="sm" color="dimmed" mb={4}>
                  Old Shares
                </Text>
                <Badge
                  size="lg"
                  variant="light"
                  color="gray"
                  fullWidth
                >
                  {farmer?.financialDetails?.oldShares || 0}
                </Badge>
              </div>
              <div>
                <Text size="sm" color="dimmed" mb={4}>
                  New Shares
                </Text>
                <Badge
                  size="lg"
                  variant="light"
                  color="blue"
                  fullWidth
                >
                  {farmer?.financialDetails?.newShares || 0}
                </Badge>
              </div>
              <div>
                <Text size="sm" color="dimmed" mb={4}>
                  Total Shares
                </Text>
                <Badge
                  size="lg"
                  variant="filled"
                  color="blue"
                  fullWidth
                >
                  {farmer?.financialDetails?.totalShares || 0}
                </Badge>
              </div>
            </SimpleGrid>
          </Paper>

          {/* Form Fields */}
          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Transaction Type"
              withAsterisk
              data={[
                { value: 'Allotment', label: 'Allotment' },
                { value: 'Additional Allotment', label: 'Additional Allotment' },
                { value: 'Redemption', label: 'Redemption' }
              ]}
              icon={<IconCoin size={16} />}
              {...form.getInputProps('transactionType')}
            />

            <NumberInput
              label="Number of Shares"
              withAsterisk
              placeholder="Enter number of shares"
              min={1}
              step={1}
              icon={<IconCoin size={16} />}
              {...form.getInputProps('shares')}
            />

            <NumberInput
              label="Share Value (per share)"
              withAsterisk
              placeholder="Enter share value"
              min={0.01}
              step={0.01}
              precision={2}
              icon="₹"
              {...form.getInputProps('shareValue')}
            />

            <TextInput
              label="Total Value"
              value={`₹${totalValue.toFixed(2)}`}
              disabled
              styles={{
                input: {
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  cursor: 'not-allowed'
                }
              }}
            />

            <TextInput
              label="Resolution Number"
              withAsterisk
              placeholder="Enter resolution number"
              icon={<IconFileCertificate size={16} />}
              {...form.getInputProps('resolutionNo')}
            />

            <TextInput
              label="Resolution Date"
              withAsterisk
              type="date"
              icon={<IconCalendar size={16} />}
              {...form.getInputProps('resolutionDate')}
            />
          </SimpleGrid>

          {/* Remarks */}
          <Textarea
            label="Remarks"
            placeholder="Enter remarks (optional)"
            icon={<IconNote size={16} />}
            rows={3}
            {...form.getInputProps('remarks')}
          />

          {/* Redemption Warning */}
          {form.values.transactionType === 'Redemption' && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Important Note"
              color="orange"
              variant="light"
            >
              Shares will be redeemed from new shares first, then from old shares.
            </Alert>
          )}

          {/* Modal Footer */}
          <Group position="right" mt="md">
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              loading={loading}
              leftSection={!loading && <IconCoin size={16} />}
            >
              {loading ? 'Saving...' : 'Save Shares'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AddShareModal;