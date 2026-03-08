import { useState } from 'react';
import {
  Modal, Stack, Group, Button, TextInput, Textarea, Text,
  SegmentedControl, Box, ThemeIcon, Loader
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrandWhatsapp, IconMail, IconSend } from '@tabler/icons-react';
import { quotationAPI } from '../../services/api';

/**
 * QuotationSendModal
 * Props:
 *   opened   - boolean
 *   onClose  - fn()
 *   quotation - quotation object (needs partyPhone, partyEmail, partyName, quotationNumber, grandTotal)
 *   onSent   - optional fn() called after successful send (to refresh status)
 */
const QuotationSendModal = ({ opened, onClose, quotation, onSent }) => {
  const [method, setMethod] = useState('whatsapp');
  const [phone, setPhone] = useState(quotation?.partyPhone || '');
  const [email, setEmail] = useState(quotation?.partyEmail || '');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Keep phone/email in sync when quotation changes
  const q = quotation || {};

  const handleSend = async () => {
    if (method === 'whatsapp' && !phone.trim()) {
      notifications.show({ title: 'Required', message: 'Enter a phone number', color: 'orange' });
      return;
    }
    if (method === 'email' && !email.trim()) {
      notifications.show({ title: 'Required', message: 'Enter an email address', color: 'orange' });
      return;
    }

    setSending(true);
    try {
      const payload = { method, customMessage: customMessage.trim() || undefined };
      if (method === 'whatsapp') payload.phone = phone.trim();
      if (method === 'email') payload.email = email.trim();

      const res = await quotationAPI.send(q._id, payload);

      if (method === 'whatsapp' && res?.data?.waUrl) {
        window.open(res.data.waUrl, '_blank', 'noopener,noreferrer');
        notifications.show({ title: 'WhatsApp Opened', message: 'WhatsApp opened with your message. Send it manually.', color: 'green' });
      } else {
        notifications.show({ title: 'Email Sent', message: res?.message || 'Email sent successfully', color: 'green' });
      }

      onSent?.();
      onClose();
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to send', color: 'red' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSend size={18} />
          <Text fw={600}>Send Quotation – {q.quotationNumber}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        {/* Method selector */}
        <SegmentedControl
          fullWidth
          value={method}
          onChange={setMethod}
          data={[
            {
              value: 'whatsapp',
              label: (
                <Group gap={6} justify="center">
                  <ThemeIcon size="xs" color="green" variant="transparent">
                    <IconBrandWhatsapp size={16} />
                  </ThemeIcon>
                  <Text size="sm">WhatsApp</Text>
                </Group>
              )
            },
            {
              value: 'email',
              label: (
                <Group gap={6} justify="center">
                  <ThemeIcon size="xs" color="blue" variant="transparent">
                    <IconMail size={16} />
                  </ThemeIcon>
                  <Text size="sm">Email</Text>
                </Group>
              )
            }
          ]}
        />

        {/* Summary */}
        <Box p="sm" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 8, border: '1px solid var(--mantine-color-gray-2)' }}>
          <Text size="sm" c="dimmed">Customer: <b>{q.partyName || '—'}</b></Text>
          <Text size="sm" c="dimmed">Amount: <b>₹{(q.grandTotal || 0).toFixed(2)}</b></Text>
        </Box>

        {/* WhatsApp fields */}
        {method === 'whatsapp' && (
          <>
            <TextInput
              label="WhatsApp Number"
              placeholder="9876543210 (10-digit mobile)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              leftSection={<IconBrandWhatsapp size={16} color="green" />}
              description="Country code (91) will be added automatically for Indian numbers"
            />
            <Textarea
              label="Custom Message (optional)"
              placeholder="Leave blank to use the default message with quotation details"
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              minRows={3}
              maxRows={6}
              description="Default message includes all item details, amounts, and validity"
            />
          </>
        )}

        {/* Email fields */}
        {method === 'email' && (
          <>
            <TextInput
              label="Email Address"
              placeholder="customer@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftSection={<IconMail size={16} color="blue" />}
              type="email"
            />
            <Textarea
              label="Additional Note (optional)"
              placeholder="Add a personal note to appear at the bottom of the email"
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              minRows={2}
              maxRows={4}
            />
            <Text size="xs" c="dimmed">
              A formatted HTML email with complete quotation details, item table, and totals will be sent.
            </Text>
          </>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button
            color={method === 'whatsapp' ? 'green' : 'blue'}
            leftSection={sending ? <Loader size={14} color="white" /> : method === 'whatsapp' ? <IconBrandWhatsapp size={16} /> : <IconMail size={16} />}
            onClick={handleSend}
            loading={sending}
          >
            {method === 'whatsapp' ? 'Open WhatsApp' : 'Send Email'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default QuotationSendModal;
