/**
 * Upload a farmer's documents from an LSGD report (Milk Subsidy, Milk Incentive,
 * Milk Statement). Every upload is saved at once to that farmer in Farmers
 * Management → Documents (found by the farmer picked by Farmer Number), so it is
 * there for the next report and in Farmer Details:
 *   Bank Statement → documents.bankPassbook   Aadhaar → documents.aadhaar
 *   Ration Card → documents.rationCard         Income Proof → documents.incomeProof
 *   Other documents → documents.additionalDocuments (up to 5)
 * A new file replaces the one in the same slot; the same "other" file is not added twice.
 * Photos are shrunk in the browser (max 1800 px JPEG) before upload.
 */
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text, ActionIcon, Tooltip, FileButton, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconUpload, IconEye, IconTrash, IconPaperclip, IconCheck } from '@tabler/icons-react';
import { farmerFormAPI } from '../../services/api';
import { FARMER_DOCUMENTS, OTHER_DOCUMENT_LABEL } from '../../utils/farmerDocumentsPrint';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_OTHER = 5;
const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

const readDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('Could not read the file'));
  r.readAsDataURL(file);
});

/** Image → JPEG data URL, longest side ≤ 1800 px (small enough to keep many on a farmer record) */
const shrinkImage = (dataUrl, maxSide = 1800) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', 0.85);
    resolve(out.length < dataUrl.length ? out : dataUrl);
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

export const fileToUploadData = async (file) => {
  if (!file) throw new Error('No file');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImg = /^image\//.test(file.type);
  if (!isPdf && !isImg) throw new Error('Upload an image (JPG / PNG) or a PDF');
  let data = await readDataUrl(file);
  if (isImg) data = await shrinkImage(data);
  const bytes = Math.floor((data.length - data.indexOf(',') - 1) * 0.75);
  if (bytes > MAX_BYTES) throw new Error(`File is ${(bytes / 1048576).toFixed(1)} MB — the limit is 5 MB`);
  return data;
};

const openDataUrl = (src) => {
  if (!src) return;
  if (!src.startsWith('data:')) { window.open(src, '_blank', 'noopener'); return; }
  const [head, b64] = src.split(',');
  const mime = head.slice(5, head.indexOf(';'));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/**
 * @param farmerId      farmer picked on the report (by Farmer Number)
 * @param farmerNumber  shown, and checked by the server against the farmer
 * @param onChange      (summary) => void — { bankPassbook, aadhaar, rationCard, incomeProof, otherCount }
 */
export default function FarmerDocumentsUpload({ farmerId, farmerNumber, farmerName, onChange, compact = false }) {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setSummary(null);
    if (!farmerId) return undefined;
    let alive = true;
    farmerFormAPI.getDocumentSummary(farmerId)
      .then((r) => { if (alive) setSummary(r?.data || {}); })
      .catch(() => { if (alive) setSummary({}); });
    return () => { alive = false; };
  }, [farmerId]);

  const apply = (s) => { setSummary(s || {}); onChangeRef.current?.(s || {}); };

  const upload = async (type, file) => {
    if (!file) return;
    setBusy(type);
    try {
      const data = await fileToUploadData(file);
      const res = await farmerFormAPI.uploadDocument(farmerId, { type, data, farmerNumber });
      apply(res?.data);
      notifications.show({ color: 'teal', title: `Farmer ${farmerNumber || ''}`.trim(), message: res?.message || 'Saved to Farmers Management' });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Upload failed' });
    } finally {
      setBusy('');
    }
  };

  const view = async (type, index) => {
    setBusy(`view:${type}:${index ?? ''}`);
    try {
      const res = await farmerFormAPI.getDocuments(farmerId);
      const d = res?.data || {};
      openDataUrl(type === 'other' ? d.additionalDocuments?.[index] : d[type]);
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Could not open the document' });
    } finally {
      setBusy('');
    }
  };

  const remove = (type, label, index) => modals.openConfirmModal({
    title: 'Remove document',
    children: <Text size="sm">Remove <b>{label}</b> from farmer {farmerNumber} in Farmers Management?</Text>,
    labels: { confirm: 'Remove', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: async () => {
      try {
        const res = await farmerFormAPI.deleteDocument(farmerId, type, index);
        apply(res?.data);
      } catch (err) {
        notifications.show({ color: 'red', message: err?.message || 'Could not remove' });
      }
    },
  });

  if (!farmerId) {
    return <Text size="xs" c="dimmed">Select the farmer (Farmer Number) to upload documents.</Text>;
  }
  if (!summary) return <Group gap="xs"><Loader size="xs" /><Text size="xs" c="dimmed">Loading documents…</Text></Group>;

  const otherCount = summary.otherCount || 0;
  const row = (type, label, uploaded, index) => (
    <Group key={`${type}${index ?? ''}`} justify="space-between" wrap="nowrap" gap="xs">
      <Group gap={6} wrap="nowrap">
        <IconPaperclip size={14} />
        <Text size="sm">{label}</Text>
        {uploaded
          ? <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>Saved</Badge>
          : <Badge size="xs" color="gray" variant="light">Not uploaded</Badge>}
      </Group>
      <Group gap={4} wrap="nowrap">
        {uploaded && (
          <Tooltip label="View">
            <ActionIcon size="sm" variant="subtle" loading={busy === `view:${type}:${index ?? ''}`} onClick={() => view(type, index)}><IconEye size={14} /></ActionIcon>
          </Tooltip>
        )}
        {uploaded && (
          <Tooltip label="Remove">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={() => remove(type, label, index)}><IconTrash size={14} /></ActionIcon>
          </Tooltip>
        )}
        {type !== 'other' && (
          <FileButton accept={ACCEPT} onChange={(f) => upload(type, f)}>
            {(props) => (
              <Button {...props} size="compact-xs" variant="light" leftSection={<IconUpload size={12} />} loading={busy === type}>
                {uploaded ? 'Replace' : 'Upload'}
              </Button>
            )}
          </FileButton>
        )}
      </Group>
    </Group>
  );

  return (
    <Paper withBorder p={compact ? 'xs' : 'sm'}>
      <Group justify="space-between" mb={6}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Documents — saved to Farmers Management</Text>
        {farmerNumber && <Text size="xs" c="dimmed">Farmer {farmerNumber}{farmerName ? ` · ${farmerName}` : ''}</Text>}
      </Group>
      <Stack gap={6}>
        {FARMER_DOCUMENTS.map((d) => row(d.key, d.label, !!summary[d.key]))}
        {Array.from({ length: otherCount }, (_, i) => row('other', otherCount > 1 ? `${OTHER_DOCUMENT_LABEL} ${i + 1}` : OTHER_DOCUMENT_LABEL, true, i))}
        {otherCount < MAX_OTHER && (
          <Group justify="flex-end">
            <FileButton accept={ACCEPT} onChange={(f) => upload('other', f)}>
              {(props) => (
                <Button {...props} size="compact-xs" variant="subtle" leftSection={<IconUpload size={12} />} loading={busy === 'other'}>
                  Add other document ({otherCount}/{MAX_OTHER})
                </Button>
              )}
            </FileButton>
          </Group>
        )}
      </Stack>
      <Text size="xs" c="dimmed" mt={6}>JPG, PNG or PDF up to 5 MB. Uploaded documents are printed after the report.</Text>
    </Paper>
  );
}
