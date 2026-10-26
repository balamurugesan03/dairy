import Company from '../models/Company.js';
import SocietyInfo from '../models/SocietyInfo.js';

// ══════════════════════════════════════════════════════════════════════════════
//  Society Information ← company configuration (Super Admin)
//
//  The company record the Super Admin creates / edits is the source of truth for
//  the fields both share. Society Information shows those values automatically:
//  a non-empty company value always wins (and is read-only on the Society Info
//  page); an empty one leaves whatever the society entered. Fields with no
//  company equivalent (Registered Name, Door No, City, PIN, Fax, board details …)
//  stay the society's own.
// ══════════════════════════════════════════════════════════════════════════════
const FROM_COMPANY = {
  societyCode:           (c) => c.societyCode,
  societyName:           (c) => c.societyName || c.companyName,
  state:                 (c) => c.state,
  phone:                 (c) => c.phone,
  email:                 (c) => c.email,
  auditedYear:           (c) => c.yearOfAudit,
  auditedClassification: (c) => c.auditClassification,
};

const companyValues = (company) => {
  const out = {};
  if (!company) return out;
  for (const [key, pick] of Object.entries(FROM_COMPANY)) {
    const v = pick(company);
    if (v !== undefined && v !== null && String(v).trim() !== '') out[key] = String(v).trim();
  }
  return out;
};

// { info: merged Society Information, companyFields: keys filled from the company }
export async function getSocietyProfile(companyId) {
  const [company, info] = await Promise.all([
    Company.findById(companyId).select('companyName societyName societyCode state phone email yearOfAudit auditClassification').lean(),
    SocietyInfo.findOne({ companyId }).lean(),
  ]);
  const fromCompany = companyValues(company);
  return { info: { ...(info || {}), ...fromCompany }, companyFields: Object.keys(fromCompany) };
}

// Values the company owns override whatever the Society Info form sends
export async function applyCompanyValues(companyId, body) {
  const company = await Company.findById(companyId).select('companyName societyName societyCode state phone email yearOfAudit auditClassification').lean();
  return { ...body, ...companyValues(company) };
}
