/**
 * Farmer report prints (Crop Damage Statement, Monthly Agri Statistics):
 * the report first, then the farmer's uploaded documents from Farmer Details —
 * Bank Statement, Aadhaar Card Copy, Ration Card Copy — one A4 portrait page
 * each (a PDF document gives one page per PDF page). Documents that are not
 * uploaded are skipped, so no blank pages.
 */
import { farmerFormAPI } from '../services/api';

export const FARMER_DOCUMENTS = [
  { key: 'bankPassbook', label: 'Bank Statement' },
  { key: 'aadhaar',      label: 'Aadhaar Card Copy' },
  { key: 'rationCard',   label: 'Ration Card Copy' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isPdf = (src) => /^data:application\/pdf/i.test(src) || /\.pdf(\?|$)/i.test(src);
const isImage = (src) => /^data:image\//i.test(src) || /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(src);

// PDF → one PNG per page (pdf.js is loaded only when a PDF document is printed)
const pdfToImages = async (src) => {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = src.startsWith('data:')
    ? Uint8Array.from(atob(src.slice(src.indexOf(',') + 1)), (c) => c.charCodeAt(0))
    : undefined;
  const pdf = await pdfjs.getDocument(data ? { data } : { url: src }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(canvas.toDataURL('image/png'));
  }
  return pages;
};

export const DOCUMENT_PAGE_CSS = `
  .farmer-doc-page { page-break-before: always; break-before: page; display: flex; flex-direction: column; align-items: center; }
  .farmer-doc-title { width: 100%; font: 700 12px Arial, sans-serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
  .farmer-doc-page img { max-width: 100%; max-height: 245mm; object-fit: contain; }
`;

/**
 * The farmer's uploaded documents as images, in print order:
 * { pages: [{ label, title, img }], count, skipped }. PDF documents give one image per page;
 * documents that are not uploaded are left out.
 */
export const getFarmerDocumentImages = async (farmerId) => {
  if (!farmerId) return { pages: [], count: 0, skipped: [] };
  const res = await farmerFormAPI.getDocuments(farmerId);
  const docs = res?.data || {};
  const pages = [];
  let count = 0;
  const skipped = [];
  for (const { key, label } of FARMER_DOCUMENTS) {
    const src = docs[key];
    if (!src) continue;
    let images = [];
    try {
      if (isPdf(src)) images = await pdfToImages(src);
      else if (isImage(src) || !/^data:/i.test(src)) images = [src];
    } catch {
      images = [];
    }
    if (!images.length) { skipped.push(label); continue; }
    images.forEach((img, i) => {
      pages.push({ label, img, title: images.length > 1 ? `${label} (${i + 1}/${images.length})` : label });
    });
    count += 1;
  }
  return { pages, count, skipped };
};

/** HTML for document pages; titlePrefix (e.g. "15 - Ravi") goes before each page title. */
export const documentPagesHtml = (pages, titlePrefix = '') => pages.map(({ label, title, img }) =>
  `<div class="farmer-doc-page"><div class="farmer-doc-title">${esc(titlePrefix ? `${titlePrefix} — ${title}` : title)}</div><img src="${img}" alt="${esc(label)}" /></div>`
).join('');

/** HTML pages for the farmer's uploaded documents ('' when none or no farmer). */
export const buildFarmerDocumentPages = async (farmerId) => {
  const { pages, count, skipped } = await getFarmerDocumentImages(farmerId);
  return { html: documentPagesHtml(pages), count, skipped };
};

/**
 * Open the print window at once (still inside the click, so it isn't blocked),
 * add the documents, wait for every image, then print.
 * buildHtml(documentPagesHtml) → the complete print document.
 */
export const printWithFarmerDocuments = async ({ farmerId, buildHtml, features }) => {
  const win = window.open('', '_blank', features);
  if (!win) return { ok: false, message: 'Allow pop-ups to print' };
  win.document.write('<p style="font:14px Arial;padding:24px">Preparing print…</p>');
  let pages = { html: '', count: 0, skipped: [] };
  try {
    pages = await buildFarmerDocumentPages(farmerId);
  } catch {
    /* print the report even if the documents can't be loaded */
  }
  win.document.open();
  win.document.write(buildHtml(pages.html));
  win.document.close();
  const imgs = [...win.document.images];
  await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  // Web fonts (e.g. Malayalam forms) — give up after a few seconds when offline
  try { await Promise.race([win.document.fonts?.ready, new Promise((r) => setTimeout(r, 4000))]); } catch { /* print anyway */ }
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
  return { ok: true, ...pages };
};
