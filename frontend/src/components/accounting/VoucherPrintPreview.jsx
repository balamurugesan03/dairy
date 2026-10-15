import { useMemo } from 'react';
import { Modal, Group, Button, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { buildVoucherPrintHtml, printVoucherHtml } from '../../utils/voucherPrint';

/**
 * A4 print preview for Receipt / Payment vouchers. The iframe renders the
 * exact document that gets printed, so the preview matches the A4 output.
 */
const VoucherPrintPreview = ({ opened, onClose, vouchers, kind, orgName }) => {
  const html = useMemo(
    () => (vouchers?.length ? buildVoucherPrintHtml(vouchers, kind, orgName) : ''),
    [vouchers, kind, orgName]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600}>{kind} Voucher — Print Preview (A4)</Text>}
      size={880}
      centered
    >
      <iframe
        title="Voucher print preview"
        srcDoc={html}
        style={{ width: '100%', height: '72vh', border: '1px solid #ccc', display: 'block' }}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Close</Button>
        <Button
          color="dark"
          leftSection={<IconPrinter size={16} />}
          onClick={() => printVoucherHtml(html)}
        >
          Print
        </Button>
      </Group>
    </Modal>
  );
};

export default VoucherPrintPreview;
