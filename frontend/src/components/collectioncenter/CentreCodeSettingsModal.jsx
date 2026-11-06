import { useEffect, useState } from 'react';
import { Modal, Stack, Text, TextInput, Group, Button, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { collectionCenterAPI } from '../../services/api';

// Centre code format: fixed prefix 'C' + a number. The user picks the starting number
// (e.g. 100 → C100, C101 …); each new centre takes the next free number.
const CentreCodeSettingsModal = ({ opened, onClose, onSaved }) => {
  const [startNumber, setStartNumber] = useState('');
  const [nextCode, setNextCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    collectionCenterAPI.getCodeSettings()
      .then(res => {
        setStartNumber(String(res.data?.startNumber || 1));
        setNextCode(res.data?.nextCode || '');
      })
      .catch(err => notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to load code settings' }))
      .finally(() => setLoading(false));
  }, [opened]);

  const valid = /^\d{1,6}$/.test(startNumber) && parseInt(startNumber, 10) >= 1;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await collectionCenterAPI.updateCodeSettings({ startNumber: parseInt(startNumber, 10) });
      setNextCode(res.data?.nextCode || '');
      notifications.show({ color: 'green', title: 'Saved', message: res.message || 'Centre code settings saved' });
      onSaved?.();
      onClose();
    } catch (err) {
      notifications.show({ color: 'red', title: 'Error', message: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Centre Code Settings" size="sm" centered>
      <Stack gap="md">
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput label="Prefix" value="C" readOnly variant="filled" w={70} />
          <TextInput
            label="Starting Number"
            placeholder="e.g. 100"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={startNumber && !valid ? 'Enter a number from 1' : null}
            disabled={loading}
            style={{ flex: 1 }}
            data-autofocus
          />
        </Group>
        <Text size="sm">
          New centres: <b>C{valid ? parseInt(startNumber, 10) : '…'}</b>, <b>C{valid ? parseInt(startNumber, 10) + 1 : '…'}</b> … (next free number)
          {nextCode && <> · currently next: <b>{nextCode}</b></>}
        </Text>
        <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />}>
          Existing codes are not renumbered. To match the DP system Center Number, edit a centre and change
          the number after C — its farmers stay linked automatically.
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!valid || loading}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CentreCodeSettingsModal;
