/**
 * Preview of a Farmer Application exactly as it prints: A4 pages of the form,
 * then the farmer's uploaded Bank Statement / Aadhaar / Ration Card pages.
 */
import { useEffect, useState } from 'react';
import { Modal, Group, Button, Text, Badge, Loader, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter } from '@tabler/icons-react';
import { buildFarmerDocumentPages, FARMER_DOCUMENTS } from '../../utils/farmerDocumentsPrint';
import { buildApplicationHtml, printApplications, FORM_TYPES } from '../../utils/farmerApplicationPrint';

export default function FarmerApplicationPreview({ opened, onClose, application }) {
  const [docs, setDocs] = useState({ html: '', count: 0, skipped: [], loading: false, error: '' });
  const [printing, setPrinting] = useState(false);
  const farmerId = application?.farmerId?._id || application?.farmerId;


  useEffect(() => {
    if (!opened || !farmerId) { setDocs({ html: '', count: 0, skipped: [], loading: false, error: '' }); return; }
    let live = true;
    setDocs(d => ({ ...d, loading: true, error: '' }));
    buildFarmerDocumentPages(farmerId)
      .then(r => live && setDocs({ ...r, loading: false, error: '' }))
      .catch(err => live && setDocs({ html: '', count: 0, skipped: [], loading: false, error: err?.message || 'Documents could not be loaded' }));
    return () => { live = false; };
  }, [opened, farmerId]);

  // Each LSGD report prints its own template
  const app = { ...application, formType: application?.formType || 'SUBSIDY' };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const r = await printApplications([app]);
      if (!r.ok) notifications.show({ color: 'red', message: r.message });
      else if (r.failed.length) notifications.show({ color: 'orange', message: `Could not load: ${r.failed.join(', ')}` });
    } catch (err) {
      notifications.show({ color: 'red', message: err?.message || 'Printing failed' });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} size="calc(210mm + 80px)" title="Application preview — A4 portrait" zIndex={400}>
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Text fw={600} size="sm">{FORM_TYPES.find(t => t.value === app.formType)?.short}</Text>
        <Group gap={6}>
          {docs.loading ? <Loader size="xs" /> : FARMER_DOCUMENTS.map(d => {
            const failed = docs.skipped?.includes(d.label);
            const has = docs.html.includes(`alt="${d.label}"`);
            return (
              <Badge key={d.key} size="sm" variant="light" color={has ? 'green' : failed ? 'red' : 'gray'}>
                {d.label}{has ? '' : failed ? ' — cannot read' : ' — not uploaded'}
              </Badge>
            );
          })}
          <Button size="xs" leftSection={<IconPrinter size={14} />} onClick={handlePrint} loading={printing}>Print</Button>
        </Group>
      </Group>
      {docs.error && <Text c="red" size="sm" mb="xs">{docs.error}</Text>}
      {docs.loading ? (
        <Center h={400}><Loader /></Center>
      ) : (
        <iframe
          title="Application preview"
          srcDoc={buildApplicationHtml(app, docs.html)}
          style={{ width: '100%', height: '75vh', border: '1px solid #dee2e6', background: '#e9ecef' }}
        />
      )}
    </Modal>
  );
}
