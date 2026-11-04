/**
 * Farmer Application print layouts — copies of the two Panchayat forms the
 * society submits for its farmers, A4 portrait:
 *
 *   SUBSIDY   — "<Panchayat> ഗ്രാമപഞ്ചായത്ത് / ജനകീയാസൂത്രണം / പാലിന് സബ്സിഡി /
 *               അപേക്ഷ ഫോറം" — 14 numbered items (page 1), സത്യപ്രസ്താവന +
 *               ക്ഷീരസംഘം സെക്രട്ടറിയുടെ സാക്ഷ്യപത്രം (page 2).
 *   INCENTIVE — "ഗ്രാമ പഞ്ചായത്ത് / വാർഷിക പദ്ധതി / അപേക്ഷാ ഫോറം" — boxed
 *               13-row table, consent, ഭാരവാഹികളുടെ ശുപാർശ, signatures, seal.
 *
 * The same HTML is used for Preview (iframe) and Print, so what is previewed
 * is what prints. Uploaded Bank Statement / Aadhaar / Ration Card pages
 * (utils/farmerDocumentsPrint) follow the form.
 */
import { DOCUMENT_PAGE_CSS, buildFarmerDocumentPages } from './farmerDocumentsPrint';

// The two LSGD Dairy Reports — each has its own form, template and menu entry
export const FORM_TYPES = [
  { value: 'SUBSIDY',   short: "Panchayath People's Planning Milk Subsidy", label: "Panchayath People's Planning Milk Subsidy — ജനകീയാസൂത്രണം പാലിന് സബ്സിഡി", route: '/farmers/lsgd/milk-subsidy' },
  { value: 'INCENTIVE', short: 'Panchayath Annual Plan Milk Incentive',     label: 'Panchayath Annual Plan Milk Incentive — വാർഷിക പദ്ധതി പാലളവിന് ഇൻസെന്റീവ്', route: '/farmers/lsgd/milk-incentive' },
];

export const DEFAULT_SCHEME = {
  SUBSIDY: 'പാലിന് സബ്സിഡി',
  INCENTIVE: 'ക്ഷീരകർഷകർക്ക് പാലളവിനു ഇൻസെന്റീവ്',
};

export const CATEGORIES = [
  { value: 'General', label: 'ജനറൽ',          en: 'General' },
  { value: 'SC',      label: 'പട്ടികജാതി',      en: 'SC' },
  { value: 'ST',      label: 'പട്ടികവർഗ്ഗം',     en: 'ST' },
  { value: 'OBC',     label: 'മറ്റു പിന്നോക്കം',  en: 'OBC' },
];

/** 2026 → "2026-2027" (financial / scheme year) */
export const fyLabel = (y) => (y ? `${y}-${Number(y) + 1}` : '');

// Scheme (financial) year starting April: Nov 2026 → 2026 (2026-2027)
export const currentSchemeYear = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };
export const SCHEME_YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => {
  const y = currentSchemeYear() + 1 - i;
  return { value: String(y), label: fyLabel(y) };
});

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br/>');
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`;
};
const yesNo = (b) => (b === true ? 'അതെ' : b === false ? 'അല്ല' : '');
const genderMl = (g) => ({ Female: 'സ്ത്രീ', Male: 'പുരുഷൻ', Other: 'മറ്റുള്ളവർ' }[g] || '');
const fullAddress = (a) => [a.address, a.pincode].filter((x) => String(x || '').trim()).join(' - ');
const num = (n) => (n === null || n === undefined || n === '' ? '' : String(n));

// ── Shared page CSS ─────────────────────────────────────────────────────────
const BASE_CSS = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; position: relative; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .v { font-family: Arial, 'Noto Sans Malayalam', 'Nirmala UI', sans-serif; font-weight: 600; }
  .farmer-doc-page { padding: 12mm 12mm 0; }
  .farmer-doc-page img { max-height: 262mm; }
  @media screen {
    html, body { background: #e9ecef; }
    .page, .farmer-doc-page { margin: 8mm auto; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.25); width: 210mm; min-height: 297mm; }
  }
  ${DOCUMENT_PAGE_CSS}
`;

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manjari:wght@400;700&family=Noto+Sans+Malayalam:wght@400;600;700&display=block" rel="stylesheet">
`;

// ════════════════════════════════════════════════════════════════════════════
//  SUBSIDY form (Kanjiramkulam pattern) — 2 pages
// ════════════════════════════════════════════════════════════════════════════
const SUBSIDY_CSS = `
  .s { font-family: 'Manjari', 'Noto Sans Malayalam', 'Nirmala UI', 'Kartika', sans-serif; font-size: 12.5pt; line-height: 1.35; }
  .s.page { padding: 22mm 17mm 15mm 25mm; }
  .s .title { text-align: center; font-weight: 700; margin-bottom: 7mm; }
  .s .title div { margin-bottom: 2.6mm; }
  .s .t-big { font-size: 17pt; }
  .s .t-mid { font-size: 14.5pt; }
  .s .t-form { font-size: 15.5pt; }
  .s table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .s table.items td { vertical-align: top; padding: 0; height: 8.6mm; }
  .s td.l { width: 98mm; }
  .s td.c { width: 6mm; text-align: center; }
  .s td.l.sub { padding-left: 6.5mm; }
  .s td.l.sub2 { padding-left: 9mm; }
  .s .cat { display: inline-block; }
  .s .cat .opt { padding: 0 1.2mm; border-radius: 50%; }
  .s .cat .opt.on { border: 1.2px solid #000; border-radius: 12px; font-weight: 700; }
  .s .p2-head { font-weight: 700; font-size: 14pt; padding-left: 16mm; margin-bottom: 5mm; }
  .s .para { text-align: justify; margin-bottom: 7mm; line-height: 1.55; }
  .s .sig { display: grid; grid-template-columns: 105mm 1fr; row-gap: 6.5mm; margin-bottom: 8mm; }
  .s .cert-head { font-weight: 700; font-size: 14pt; text-align: center; padding-left: 18mm; margin: 2mm 0 5mm; }
  .s .dots { border-bottom: 1.2px dotted #000; display: inline-block; text-align: center; padding: 0 2mm; }
  .s .sign2 { display: grid; grid-template-columns: 96mm 1fr; margin-bottom: 18mm; }
  .s .sign2 .ind1 { padding-left: 6mm; }
  .s .sign2 .ind2 { padding-left: 9mm; }
  .s .pd { margin-bottom: 6mm; }
  .s .seal { margin-top: 40mm; padding-left: 21mm; }
`;

const subsidyPages = (a) => {
  const row = (no, label, value, cls = 'l') =>
    `<tr><td class="${cls}">${no ? `${no}. ` : ''}${label}</td><td class="c">:</td><td class="v">${value}</td></tr>`;
  const rowNoColon = (label, value, cls) =>
    `<tr><td class="${cls}">${label}</td><td class="c"></td><td class="v">${value}</td></tr>`;
  const cat = CATEGORIES.map((c) => `<span class="opt${a.category === c.value ? ' on' : ''}">${c.label}</span>`).join('/');
  const wardHouse = [a.ward, a.houseNumber].filter((x) => String(x || '').trim()).join(' / ');
  const bankBranch = [a.bankName, a.branch].filter((x) => String(x || '').trim()).join(', ');
  const panchayatTitle = esc(a.panchayatLabel || a.panchayat);

  const page1 = `
  <div class="page s">
    <div class="title">
      <div class="t-big">${panchayatTitle}&nbsp; ഗ്രാമപഞ്ചായത്ത്</div>
      <div class="t-mid">ജനകീയാസൂത്രണം ${esc(fyLabel(a.year))}</div>
      <div class="t-big">${esc(a.schemeName || DEFAULT_SCHEME.SUBSIDY)}</div>
      <div class="t-form">അപേക്ഷ ഫോറം</div>
    </div>
    <table class="items">
      ${row(1, 'അപേക്ഷകന്റെ പേര്', esc(a.applicantName))}
      ${row(2, 'മേൽവിലാസം', nl(fullAddress(a)))}
      <tr><td class="l sub" style="padding-left:2mm">(പിൻകോഡ് സഹിതം)</td><td class="c"></td><td></td></tr>
      ${row(3, 'ഫോൺ നമ്പർ', esc(a.mobileNumber))}
      <tr><td colspan="3"><span style="display:inline-block;width:47mm">4. വിഭാഗം</span>:<span class="cat">${cat}</span></td></tr>
      ${row(5, 'വാർഡ് &nbsp;&nbsp;&nbsp; നമ്പരും വീട്ട് നമ്പരും', esc(wardHouse))}
      ${row(6, 'റേഷൻ കാർഡ് നമ്പർ', esc(a.rationCardNo))}
      ${row(7, 'ഇലക്ഷൻ കാർഡ് നമ്പർ', esc(a.electionId))}
      ${row(8, 'ആധാർ കാർഡ് നമ്പർ', esc(a.aadhaarNumber))}
      ${row(9, 'ബാങ്കിന്റെ പേരും ശാഖയും', esc(bankBranch))}
      ${row(10, 'ബാങ്ക് അക്കൗണ്ട് നമ്പർ', esc(a.accountNumber))}
      ${row(11, '<span style="font-family:Arial;font-size:9.5pt">IFSC</span> കോഡ്', esc(a.ifsc))}
      ${row(12, 'ക്ഷീര സംഘത്തിൽ അംഗമാണോ?', yesNo(a.isMember))}
      ${row('', '(1) ആണെങ്കിൽ അംഗ നമ്പർ', a.isMember ? esc(a.membershipNo) : '', 'l sub')}
      ${row('', '(2)ക്ഷീര സംഘത്തിന്റെ പേര്', a.isMember ? esc(a.societyName) : '', 'l sub')}
      ${row(13, 'ചെറുകിട/നാമമാത്ര കർഷകനാണോ ?', yesNo(a.isSmallFarmer))}
      ${rowNoColon('(1) കൈവശമുള്ള വസ്തുവിന്റെ ആകെ<br/><span style="padding-left:5mm">വിസ്തീർണം</span>', esc(a.landArea), 'l sub')}
      ${row('', '(2)സർവ്വേ നമ്പർ', esc(a.surveyNumber), 'l sub')}
      ${row(14, 'ഗുണഭോക്തൃ ലിസ്റ്റിലെ നമ്പർ', esc(a.beneficiaryNo))}
    </table>
  </div>`;

  const name = esc(a.applicantName);
  const avg = num(a.avgMilkPerDay);
  const page2 = `
  <div class="page s">
    <div class="p2-head">സത്യപ്രസ്താവന</div>
    <div class="para">മേൽപ്പറഞ്ഞ കാര്യങ്ങൾ എന്റെ അറിവിലും വിശ്വാസത്തിലും സത്യമാണെന്ന് സാക്ഷ്യപ്പെടുത്തിക്കൊള്ളുന്നു.</div>
    <div class="sig">
      <div>സ്ഥലം &nbsp;&nbsp;<span class="v">${esc(a.place)}</span></div><div>അപേക്ഷകന്റെ ഒപ്പ്</div>
      <div>തീയതി &nbsp;&nbsp;<span class="v">${fmtDate(a.applicationDate)}</span></div><div>പേര് &nbsp;&nbsp;<span class="v">${name}</span></div>
      <div></div><div>വിലാസം &nbsp;&nbsp;<span class="v" style="font-size:10.5pt">${nl(fullAddress(a))}</span></div>
    </div>
    <div class="cert-head">ക്ഷീരസംഘം സെക്രട്ടറിയുടെ സാക്ഷ്യപത്രം</div>
    <div class="para">മേൽപ്പറഞ്ഞ &nbsp;&nbsp; ശ്രീ<span class="dots v" style="min-width:62mm">${name || '&nbsp;'}</span>എന്ന &nbsp;&nbsp; കർഷക
      സംഘത്തിൽ ദിനംപ്രതി ശരാശരി<span class="dots v" style="min-width:22mm">${avg || '&nbsp;'}</span>ലിറ്റർ പാൽ അളക്കുന്ന
      ക്ഷീരകർഷകയാണെന്ന് സാക്ഷ്യപെടുത്തിക്കൊള്ളുന്നു.</div>
    <div class="sign2">
      <div>സംഘം പ്രസിഡന്റിന്റെ</div><div>സംഘം സെക്രട്ടറിയുടെ</div>
      <div class="ind1">പേരും ഒപ്പും</div><div class="ind2">പേരും ഒപ്പും</div>
    </div>
    <div class="pd">സ്ഥലം : &nbsp;<span class="v">${esc(a.place)}</span></div>
    <div class="pd">തീയതി : &nbsp;<span class="v">${fmtDate(a.applicationDate)}</span></div>
    <div class="seal">സംഘം സീൽ</div>
  </div>`;

  return page1 + page2;
};

// ════════════════════════════════════════════════════════════════════════════
//  INCENTIVE form (Annual Plan table pattern) — 1 page
// ════════════════════════════════════════════════════════════════════════════
const INCENTIVE_CSS = `
  .n { font-family: 'Noto Sans Malayalam', 'Manjari', 'Nirmala UI', 'Kartika', sans-serif; font-size: 10.5pt; line-height: 1.35; }
  .n.page { padding: 12mm 14mm 8mm 14mm; }
  .n .head { text-align: center; margin-bottom: 2.5mm; }
  .n .head div { margin-bottom: 1.2mm; }
  .n .head .form { font-weight: 700; }
  .n .line { display: flex; gap: 6mm; margin-bottom: 1.6mm; }
  .n .line .grow { flex: 1; }
  .n table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 1mm; }
  .n table.grid td { border: 1px solid #000; vertical-align: top; padding: 0.9mm 2mm; }
  .n td.no { width: 13mm; text-align: center; }
  .n td.lab { width: 66mm; }
  .n td.val { font-size: 11pt; }
  .n .hint { font-size: 9pt; }
  .n .yn .opt { padding: 0 1mm; }
  .n .yn .opt.on { border: 1.1px solid #000; border-radius: 10px; font-weight: 700; }
  .n td.split { padding: 0; }
  .n td.split > div { padding: 0.9mm 2mm; min-height: 6mm; }
  .n td.split > div + div { border-top: 1px solid #000; }
  .n .consent { margin-top: 1.5mm; line-height: 1.6; }
  .n .sig { display: grid; grid-template-columns: 1fr 72mm; margin-top: 2mm; row-gap: 1.5mm; }
  .n .rec-head { text-align: center; font-weight: 700; text-decoration: underline; margin: 2.5mm 0 1.5mm; }
  .n .rec { line-height: 1.6; }
  .n .officers { display: grid; grid-template-columns: 1fr 1fr; margin-top: 8mm; }
  .n .officers .r { text-align: right; padding-right: 8mm; padding-top: 4mm; }
  .n .officers .r .s2 { padding-right: 0; margin-top: 1.5mm; }
  .n .seal { text-align: center; font-weight: 700; margin-top: 3mm; }
  .n .note { display: inline-block; margin-top: 2mm; border-bottom: 1px solid #000; font-size: 9.5pt; }
`;

const incentivePage = (a) => {
  const yr = Number(a.year);
  const yy = yr ? String(yr + 1).slice(-2) : '';
  const yn = `<span class="yn"><span class="opt${a.isMember === true ? ' on' : ''}">അതെ</span>/<span class="opt${a.isMember === false ? ' on' : ''}">അല്ല</span></span>`;
  const r = (no, label, value, extra = '') =>
    `<tr${extra}><td class="no">${no}</td><td class="lab">${label}</td><td class="val v">${value}</td></tr>`;
  const panchayatTitle = esc(a.panchayatLabel || a.panchayat);

  return `
  <div class="page n">
    <div class="head">
      <div>${panchayatTitle} ഗ്രാമ പഞ്ചായത്ത് ${yr ? `${yr}/${yr + 1}` : ''}</div>
      <div>വാർഷിക പദ്ധതി ${yr ? `${yr}-${yy}` : ''}</div>
      <div class="form">അപേക്ഷാ ഫോറം</div>
    </div>
    <div class="line"><span style="width:36mm">പദ്ധതിയുടെ പേര്</span><span>${esc(a.schemeName || DEFAULT_SCHEME.INCENTIVE)}</span></div>
    <div class="line"><span class="grow">ക്ഷീരസംഘത്തിന്റെ പേര് : <span class="v">${esc(a.societyName)}</span></span><span style="width:52mm">വാർഡ് നം. <span class="v">${esc(a.ward)}</span></span></div>
    <table class="grid">
      ${r(1, 'അപേക്ഷകന്റെ പേര്', esc(a.applicantName), ' style="height:9mm"')}
      ${r(2, 'ഗുണഭോക്തൃ ലിസ്റ്റിലെ നമ്പർ', `<span class="hint" style="font-weight:400">വാർഡ്/നം.</span> ${esc(a.beneficiaryNo)}`, ' style="height:9mm"')}
      ${r(3, 'മേൽവിലാസം പിൻകോഡ് സഹിതം', nl(fullAddress(a)), ' style="height:14mm"')}
      ${r(4, 'മൊബൈൽ നമ്പർ', esc(a.mobileNumber), ' style="height:8mm"')}
      ${r(5, 'സ്ത്രീ/പുരുഷൻ', genderMl(a.gender), ' style="height:8mm"')}
      ${r(6, 'റേഷൻകാർഡ് നമ്പർ (പുതിയ<br/>കാർഡിന്റെ പകർപ്പ് ഉള്ളടക്കം<br/>ചെയ്യണം)', esc(a.rationCardNo), ' style="height:15mm"')}
      ${r(7, 'ആധാർ നമ്പർ (പകർപ്പ് ഉള്ളടക്കം<br/>ചെയ്യണം )', esc(a.aadhaarNumber), ' style="height:12mm"')}
      ${r(8, 'ബാങ്ക്', esc(a.bankName), ' style="height:8mm"')}
      ${r(9, 'ബാങ്ക് അക്കൗണ്ട് നമ്പർ (പകർപ്പ്<br/>ഉള്ളടക്കം ചെയ്യണം )', esc(a.accountNumber), ' style="height:12mm"')}
      ${r(10, 'ബ്രാഞ്ച്', esc(a.branch), ' style="height:8mm"')}
      ${r(11, '<span style="font-family:Arial;font-size:9pt">IFSC</span> കോഡ്', esc(a.ifsc), ' style="height:8mm"')}
      <tr><td class="no">12</td><td class="lab">ക്ഷീരസംഘത്തിലെ അംഗം ആണോ</td>
        <td class="split"><div>${yn}</div><div>അംഗത്വ നമ്പർ : <span class="v">${a.isMember ? esc(a.membershipNo) : ''}</span></div></td></tr>
      ${r(13, 'വളർത്തുന്ന കറവപ്പശുക്കളുടെ എണ്ണം', esc(num(a.cowCount)), ' style="height:11mm"')}
    </table>
    <div class="consent">സബ്സിഡിക്ക് അർഹയാകുകയാണെങ്കിൽ മേൽ പറഞ്ഞ അക്കൗണ്ടിലേക്ക് സബ്സിഡി
      മാറ്റുന്നതിന് എനിക്ക് സമ്മതമാണെന്ന് ഇതിനാൽ സാക്ഷ്യപ്പെടുത്തുന്നു —</div>
    <div class="sig">
      <div>സ്ഥലം &nbsp; <span class="v">${esc(a.place)}</span></div><div></div>
      <div>തീയതി &nbsp; <span class="v">${fmtDate(a.applicationDate)}</span></div><div>അപേക്ഷകന്റെ ഒപ്പ് :</div>
      <div></div><div>പേര് : <span class="v">${esc(a.applicantName)}</span></div>
    </div>
    <div class="rec-head">ക്ഷീരസംഘം ഭാരവാഹികളുടെ ശുപാർശ</div>
    <div class="rec">അപേക്ഷയിൽ രേഖപ്പെടുത്തിയ വിവരങ്ങൾ വസ്തുതാപരമാണ് . അനുകൂല്യം
      അനുവദിക്കുന്നതിന് ശുപാർശ ചെയ്യുന്നു.</div>
    <div class="officers">
      <div>ക്ഷീരസംഘം സെക്രട്ടറിയുടെ<div style="margin-top:1.5mm">ഒപ്പും പേരും</div></div>
      <div class="r">നിർവഹണ ഉദ്യോഗസ്ഥന്റെ<div class="s2">ഒപ്പും പേരും</div></div>
    </div>
    <div class="seal">സീൽ</div>
    <div class="note">*ക്രമനം.6,7,8 പകർപ്പ് നിർബന്ധമായും ഹാജരാക്കേണ്ടതാണ്</div>
  </div>`;
};

/** Form pages of one application (no <html> wrapper). */
export const buildApplicationBody = (app) => {
  const a = app || {};
  return a.formType === 'INCENTIVE' ? incentivePage(a) : subsidyPages(a);
};

const wrapDocument = (title, body) => `<!DOCTYPE html>
<html lang="ml"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
${FONT_LINKS}
<style>${BASE_CSS}${SUBSIDY_CSS}${INCENTIVE_CSS}</style>
</head><body>${body}</body></html>`;

/**
 * Complete print document: the application form, then the farmer's uploaded
 * document pages (already-built HTML from buildFarmerDocumentPages, may be '').
 */
export const buildApplicationHtml = (app, docPagesHtml = '') =>
  wrapDocument(`${app?.applicationNo || 'Application'} - ${app?.applicantName || ''}`, buildApplicationBody(app) + (docPagesHtml || ''));

/**
 * Print one or many applications as a single A4 output: for each farmer the
 * form, then their uploaded Bank Statement / Aadhaar / Ration Card pages
 * (only those uploaded — no blank pages). The window opens inside the click;
 * `apps` may be an array or an async function returning one (fetched after).
 * Returns { ok, message?, docCount, failed: [labels that could not be read] }.
 */
export const printApplications = async (source, { withDocuments = true, title = 'Farmer Applications' } = {}) => {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return { ok: false, message: 'Allow pop-ups for this site to print' };
  win.document.write('<p style="font:14px Arial;padding:24px">Preparing print…</p>');
  let apps;
  try {
    apps = typeof source === 'function' ? await source() : source;
  } catch (err) {
    win.close();
    throw err;
  }
  if (!apps?.length) { win.close(); return { ok: false, message: 'Nothing to print' }; }
  let body = '';
  let docCount = 0;
  const failed = [];
  for (const app of apps) {
    body += buildApplicationBody(app);
    if (!withDocuments || !app.farmerId) continue;
    try {
      const pages = await buildFarmerDocumentPages(app.farmerId?._id || app.farmerId);
      body += pages.html;
      docCount += pages.count;
      pages.skipped.forEach((s) => failed.push(apps.length > 1 ? `${app.applicantName}: ${s}` : s));
    } catch {
      failed.push(apps.length > 1 ? `${app.applicantName}: documents` : 'documents');
    }
  }
  win.document.open();
  win.document.write(wrapDocument(apps.length === 1 ? `${apps[0].applicationNo || 'Application'} - ${apps[0].applicantName || ''}` : title, body));
  win.document.close();
  const imgs = [...win.document.images];
  await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  try { await Promise.race([win.document.fonts?.ready, new Promise((r) => setTimeout(r, 4000))]); } catch { /* print anyway */ }
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
  return { ok: true, docCount, failed };
};
