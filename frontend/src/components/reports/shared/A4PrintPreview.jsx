import { useMemo } from 'react';
import { Modal, Group, Button, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { printHtmlDocument, A4_SIZE } from '../../../utils/printA4';

// Gutter of grey "desk" either side of the sheet inside the iframe.
const GUTTER = 24;

// Preview-only: hide the iframe's own scrollbar (it still scrolls with the
// wheel / keyboard). Never part of the printed document.
const HIDE_SCROLLBAR = '<style>html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}</style>';

/**
 * In-app A4 print preview shared by the register reports. The iframe renders
 * the exact document that gets printed and is sized to the real sheet width,
 * so the preview shows the page as it will print.
 */
const A4PrintPreview = ({ html, orientation, title, onClose }) => {
  const opened = !!orientation && !!html;
  const pagePx = A4_SIZE[orientation === 'portrait' ? 'portrait' : 'landscape'].px;
  const frameW = pagePx + GUTTER;

  const previewHtml = useMemo(
    () => (html ? html.replace('</head>', `${HIDE_SCROLLBAR}</head>`) : ''),
    [html]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600}>{title} — Print Preview (A4 {orientation === 'portrait' ? 'Portrait' : 'Landscape'})</Text>}
      size={frameW + 34}
      centered
    >
      <iframe
        title={`${title} print preview`}
        srcDoc={previewHtml}
        style={{ width: '100%', maxWidth: frameW, height: '75vh', border: '1px solid #ccc', display: 'block', margin: '0 auto' }}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Close</Button>
        <Button color="dark" leftSection={<IconPrinter size={16} />} onClick={() => printHtmlDocument(html)}>
          Print
        </Button>
      </Group>
    </Modal>
  );
};

export default A4PrintPreview;
