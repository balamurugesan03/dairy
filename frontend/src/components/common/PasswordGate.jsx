import { useState } from 'react';
import { Center, Paper, Stack, Title, Text, PasswordInput, Button, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

/**
 * PasswordGate
 *
 * Wraps a single protected page so restricted (newly created, role 'user')
 * accounts must enter the company/admin login password before the page
 * renders. Admin/superadmin accounts pass straight through. The unlock only
 * lasts for the current mount — it is not persisted, so the password is
 * required again on next visit/reload.
 *
 * Usage:
 *   <Route path="milk-purchase-settings" element={<PasswordGate><MilkPurchaseSettings /></PasswordGate>} />
 */
export default function PasswordGate({ children }) {
  const { isAdmin } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  if (isAdmin || unlocked) {
    return children;
  }

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter the password');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await authAPI.verifyAdminPassword(password);
      if (res.success) {
        setUnlocked(true);
      } else {
        setError(res.message || 'Incorrect password');
      }
    } catch (err) {
      setError(err.message || 'Incorrect password');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Center style={{ minHeight: '60vh' }}>
      <Paper withBorder shadow="sm" radius="md" p="xl" style={{ maxWidth: 380, width: '100%' }}>
        <Stack align="center" gap="sm">
          <ThemeIcon size={48} radius="xl" color="violet" variant="light">
            <IconLock size={26} />
          </ThemeIcon>
          <Title order={4}>Password Protected</Title>
          <Text size="sm" c="dimmed" ta="center">
            Enter the admin password to access Machine Configuration.
          </Text>
          <PasswordInput
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            error={error}
            w="100%"
          />
          <Button fullWidth onClick={handleUnlock} loading={verifying}>
            Unlock
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
