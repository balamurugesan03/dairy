import mongoose from 'mongoose';
import Farmer from '../models/Farmer.js';
import Ledger from '../models/Ledger.js';
import CollectionCenter from '../models/CollectionCenter.js';
import FarmerSettings from '../models/FarmerSettings.js';
import { getNumberSeries, farmerRefText } from '../utils/farmerSeries.js';
import { ensureCentreCodes, normaliseCentreCode, nextCentreCodes } from '../utils/centreCode.js';

// ══════════════════════════════════════════════════════════════════════════════
//  DP system farmer import  (POST /api/farmers/dp-import)
//
//  Excel columns: VillageCode, VillageName, MemberCode, MemberName, MobileNo,
//                 IsMember, IsActive, RateType, ImportType
//
//  VillageCode identifies a Collection Centre, not a farmer: every row with the
//  same VillageCode goes to ONE centre, chosen by the user in `mappings`:
//     { villageCode, villageName, centreId }   → an existing centre
//     { villageCode, villageName, newCode }    → create centre <newCode> named VillageName
//  The mapping is remembered on the centre (CollectionCenter.dpVillageCode) so the
//  next import pre-selects it.
//
//  Farmers are matched by (centre, MemberCode) — never by number alone — so the
//  same MemberCode in two villages is two farmers. A farmer already saved with that
//  number but no centre is adopted (centre assigned) instead of duplicated.
//  Farmer Numbers of existing farmers are never changed.
//
//  dryRun: true → validate and return the preview only; nothing is written.
// ══════════════════════════════════════════════════════════════════════════════

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Excel numbers come as 208 or 208.0 → '208'; text codes kept as typed
const codeStr = (v) => {
  const s = str(v);
  if (/^\d+(\.0+)?$/.test(s)) return String(parseInt(s, 10));
  return s;
};

// Y/N, Yes/No, 1/0, True/False, Active/Inactive, Member/Non-Member → true/false/undefined
const parseFlag = (v) => {
  const s = str(v).toUpperCase();
  if (!s) return undefined;
  if (['Y', 'YES', '1', 'TRUE', 'T', 'ACTIVE', 'A', 'MEMBER', 'M'].includes(s)) return true;
  if (['N', 'NO', '0', 'FALSE', 'F', 'INACTIVE', 'I', 'NON-MEMBER', 'NONMEMBER', 'NON MEMBER', 'P'].includes(s)) return false;
  return undefined;
};

const parsePhone = (v) => {
  const d = str(v).replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  return undefined;
};

export const dpFarmerImport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { rows, mappings, dryRun = false, switchToCentreSeries = false } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No farmer rows to import' });
    }
    if (rows.length > 20000) {
      return res.status(400).json({ success: false, message: 'Too many rows (max 20,000 per import)' });
    }

    await ensureCentreCodes(companyId).catch(() => {});
    const centres = await CollectionCenter.find({ companyId }).select('centerName centerCode dpVillageCode centerType').lean();
    const centreById = new Map(centres.map(c => [String(c._id), c]));

    // ── 1. Normalise rows ────────────────────────────────────────────────────
    const items = rows.map((r, i) => ({
      rowNumber:   Number(r.rowNumber) || i + 2,
      villageCode: codeStr(r.villageCode),
      villageName: str(r.villageName),
      memberCode:  codeStr(r.memberCode),
      memberName:  str(r.memberName),
      mobileRaw:   str(r.mobileNo),
      phone:       parsePhone(r.mobileNo),
      isMember:    parseFlag(r.isMember),
      isActive:    parseFlag(r.isActive),
      rateType:    str(r.rateType) || undefined,
      importType:  str(r.importType) || undefined,
      action: null, message: '', warnings: [],
    }));

    // ── 2. Validate village → centre mappings ────────────────────────────────
    const villageCodes = [...new Set(items.map(it => it.villageCode).filter(Boolean))];
    const villageNameOf = new Map();
    for (const it of items) if (it.villageCode && it.villageName && !villageNameOf.has(it.villageCode)) villageNameOf.set(it.villageCode, it.villageName);

    const mapByVillage = new Map();
    for (const m of Array.isArray(mappings) ? mappings : []) {
      const vc = codeStr(m?.villageCode);
      if (vc) mapByVillage.set(vc, m);
    }

    const mappingErrors = [];
    const villageTarget = new Map();     // villageCode → { key, code, name, isNew, centreId? }
    const targetOwner = new Map();       // centre key → villageCode (one village per centre)
    const newCodes = new Set();
    for (const vc of villageCodes) {
      const m = mapByVillage.get(vc);
      const vName = villageNameOf.get(vc) || str(m?.villageName);
      if (!m || (!m.centreId && !m.newCode)) {
        mappingErrors.push({ villageCode: vc, message: `Village ${vc} (${vName || 'no name'}) is not mapped to a Collection Centre` });
        continue;
      }
      let target;
      if (m.centreId) {
        const c = mongoose.isValidObjectId(m.centreId) ? centreById.get(String(m.centreId)) : null;
        if (!c) { mappingErrors.push({ villageCode: vc, message: `Village ${vc}: selected centre not found` }); continue; }
        if (c.dpVillageCode && c.dpVillageCode !== vc && villageCodes.includes(c.dpVillageCode)) {
          mappingErrors.push({ villageCode: vc, message: `Village ${vc}: ${c.centerCode} is already mapped to Village ${c.dpVillageCode} in this file` });
          continue;
        }
        target = { key: String(c._id), centreId: c._id, code: c.centerCode, name: c.centerName, isNew: false };
      } else {
        const code = normaliseCentreCode(m.newCode);
        if (!code) { mappingErrors.push({ villageCode: vc, message: `Village ${vc}: invalid new Center Code "${m.newCode}" (use C followed by a number)` }); continue; }
        if (centres.some(c => c.centerCode === code)) { mappingErrors.push({ villageCode: vc, message: `Village ${vc}: Center Code ${code} already exists — select that centre or choose another code` }); continue; }
        if (newCodes.has(code)) { mappingErrors.push({ villageCode: vc, message: `Village ${vc}: Center Code ${code} is used for two villages` }); continue; }
        if (!vName) { mappingErrors.push({ villageCode: vc, message: `Village ${vc}: VillageName is needed to create the centre` }); continue; }
        newCodes.add(code);
        target = { key: `new:${code}`, code, name: vName, isNew: true };
      }
      if (targetOwner.has(target.key)) {
        mappingErrors.push({ villageCode: vc, message: `Villages ${targetOwner.get(target.key)} and ${vc} are both mapped to ${target.code} — map each VillageCode to its own centre` });
        continue;
      }
      targetOwner.set(target.key, vc);
      villageTarget.set(vc, target);
    }

    // ── 3. Classify each row: Create / Update / Duplicate / Error ────────────
    const series = await getNumberSeries(companyId);
    const existing = await Farmer.find({ companyId }).select('farmerNumber collectionCenter personalDetails.name').lean();
    const byCentreNo = new Map();   // `${centreId}|${no}` → farmer
    const noCentreByNo = new Map(); // no → [farmers without centre]
    const anyByNo = new Map();      // no → [farmers]
    for (const f of existing) {
      const no = str(f.farmerNumber);
      if (f.collectionCenter) byCentreNo.set(`${f.collectionCenter}|${no}`, f);
      else { if (!noCentreByNo.has(no)) noCentreByNo.set(no, []); noCentreByNo.get(no).push(f); }
      if (!anyByNo.has(no)) anyByNo.set(no, []);
      anyByNo.get(no).push(f);
    }

    // Numbers repeating across villages need centre-wise numbering
    const villagesOfNo = new Map();
    for (const it of items) {
      if (!it.memberCode || !it.villageCode) continue;
      if (!villagesOfNo.has(it.memberCode)) villagesOfNo.set(it.memberCode, new Set());
      villagesOfNo.get(it.memberCode).add(it.villageCode);
    }
    const repeatsAcrossVillages = [...villagesOfNo.values()].some(s => s.size > 1);
    // …or a MemberCode already used by a farmer of ANOTHER centre (company-wide numbering clash)
    const clashesElsewhere = items.some(it => {
      const t = villageTarget.get(it.villageCode);
      if (!t || !it.memberCode) return false;
      const same = (anyByNo.get(it.memberCode) || []);
      if (same.some(f => !f.collectionCenter || String(f.collectionCenter) === t.key)) return false;
      return same.some(f => f.collectionCenter);
    });
    const needsCentreSeries = series !== 'Centre' && (repeatsAcrossVillages || clashesElsewhere);
    // The numbering mode is switched only when this file needs it and the user agreed
    const doSwitch = needsCentreSeries && !!switchToCentreSeries;
    const centreMode = series === 'Centre' || doSwitch;

    const seenKey = new Set();
    const claimedNo = new Map();    // Existing mode: number → centre key that took it in this file
    const adopted = new Set();
    for (const it of items) {
      const missing = [];
      if (!it.villageCode) missing.push('VillageCode');
      if (!it.villageName) missing.push('VillageName');
      if (!it.memberCode) missing.push('MemberCode');
      if (!it.memberName) missing.push('MemberName');
      if (missing.length) { it.action = 'Error'; it.message = `Missing ${missing.join(', ')}`; continue; }

      const target = villageTarget.get(it.villageCode);
      if (!target) { it.action = 'Error'; it.message = `Village ${it.villageCode} has no valid centre mapping`; continue; }
      it.centreCode = target.code;
      it.centreName = target.name;
      it.targetKey = target.key;

      const key = `${it.villageCode}|${it.memberCode}`;
      if (seenKey.has(key)) { it.action = 'Duplicate'; it.message = `MemberCode ${it.memberCode} appears again for Village ${it.villageCode} — row skipped`; continue; }
      seenKey.add(key);

      if (it.mobileRaw && !it.phone) it.warnings.push(`Mobile "${it.mobileRaw}" is not a 10-digit number — not saved`);

      let match = !target.isNew ? byCentreNo.get(`${target.key}|${it.memberCode}`) : null;
      if (!match) {
        // Saved earlier with this number but no centre → adopt it (no duplicate farmer)
        const loose = (noCentreByNo.get(it.memberCode) || []).filter(f => !adopted.has(String(f._id)));
        if (loose.length === 1) { match = loose[0]; adopted.add(String(match._id)); it.adopt = true; }
      }

      if (match) {
        if (!centreMode) claimedNo.set(it.memberCode, target.key);   // company-wide: this number is now taken
        it.action = 'Update';
        it.farmerId = match._id;
        it.message = it.adopt ? `Existing farmer ${it.memberCode} (no centre) — assigned to ${target.code}` : `Existing farmer ${target.code}/${it.memberCode} — details updated`;
        continue;
      }

      if (!centreMode) {
        const elsewhere = (anyByNo.get(it.memberCode) || []).find(f => f.collectionCenter);
        if (elsewhere) {
          const c = centreById.get(String(elsewhere.collectionCenter));
          it.action = 'Error';
          it.message = `Farmer Number ${it.memberCode} already exists in ${c?.centerCode || 'another centre'} (company-wide numbering) — enable centre-wise numbering`;
          continue;
        }
        const owner = claimedNo.get(it.memberCode);
        if (owner && owner !== target.key) {
          it.action = 'Error';
          it.message = `MemberCode ${it.memberCode} is also in another village — enable centre-wise numbering`;
          continue;
        }
        claimedNo.set(it.memberCode, target.key);
      }
      it.action = 'Create';
      it.message = `New farmer ${target.code}/${it.memberCode}`;
    }

    const count = (a) => items.filter(it => it.action === a).length;
    const summary = {
      total: items.length,
      create: count('Create'),
      update: count('Update'),
      duplicate: count('Duplicate'),
      error: count('Error'),
      warnings: items.filter(it => it.warnings.length).length,
    };
    const villages = villageCodes.map(vc => {
      const t = villageTarget.get(vc);
      return {
        villageCode: vc,
        villageName: villageNameOf.get(vc) || '',
        farmers: items.filter(it => it.villageCode === vc).length,
        centreCode: t?.code || '',
        centreName: t?.name || '',
        isNew: !!t?.isNew,
      };
    });
    const preview = items.map(it => ({
      rowNumber: it.rowNumber, villageCode: it.villageCode, villageName: it.villageName,
      memberCode: it.memberCode, memberName: it.memberName, mobileNo: it.phone || it.mobileRaw || '',
      isMember: it.isMember, isActive: it.isActive, rateType: it.rateType || '', importType: it.importType || '',
      centreCode: it.centreCode || '', action: it.action, message: it.message, warnings: it.warnings,
    }));
    const meta = { series, repeatsAcrossVillages, needsCentreSeries };

    if (dryRun || mappingErrors.length) {
      return res.json({
        success: true,
        data: { dryRun: true, mappingErrors, summary, villages, preview, ...meta }
      });
    }

    // ── 4. Write: centres, mapping memory, numbering mode, farmers ───────────
    if (doSwitch) {
      await FarmerSettings.findOneAndUpdate({ companyId }, { $set: { numberSeries: 'Centre' } }, { upsert: true, setDefaultsOnInsert: true });
    }
    const effectiveSeries = centreMode ? 'Centre' : series;

    const centreIdOfKey = new Map();
    const createdCentres = [];
    for (const [vc, t] of villageTarget) {
      if (t.isNew) {
        const c = await CollectionCenter.create({
          centerName: t.name,
          centerCode: t.code,
          dpVillageCode: vc,
          centerType: 'Sub Centre',
          startDate: new Date(),
          status: 'Active',
          address: { village: t.name },
          companyId,
        });
        centreIdOfKey.set(t.key, c._id);
        createdCentres.push({ villageCode: vc, centreCode: t.code, centreName: t.name });
      } else {
        centreIdOfKey.set(t.key, t.centreId);
        await CollectionCenter.updateOne({ _id: t.centreId, companyId }, { $set: { dpVillageCode: vc } });
      }
    }
    // A village code belongs to one centre — clear it from any other centre that held it
    for (const [vc, t] of villageTarget) {
      const id = centreIdOfKey.get(t.key);
      await CollectionCenter.updateMany({ companyId, dpVillageCode: vc, _id: { $ne: id } }, { $unset: { dpVillageCode: 1 } });
    }

    const results = {
      total: items.length, created: 0, updated: 0,
      duplicates: items.filter(it => it.action === 'Duplicate').map(it => ({ row: it.rowNumber, villageCode: it.villageCode, memberCode: it.memberCode, name: it.memberName, message: it.message })),
      failed: items.filter(it => it.action === 'Error').map(it => ({ row: it.rowNumber, villageCode: it.villageCode, memberCode: it.memberCode || 'N/A', name: it.memberName, message: it.message })),
      createdCentres,
      switchedToCentreSeries: doSwitch,
    };

    for (const it of items) {
      if (it.action !== 'Create' && it.action !== 'Update') continue;
      const centreId = centreIdOfKey.get(it.targetKey);
      try {
        let farmer;
        if (it.action === 'Update') {
          farmer = await Farmer.findOne({ _id: it.farmerId, companyId });
          if (!farmer) throw new Error('Farmer no longer exists');
          // Preserve everything else; never change the Farmer Number
          farmer.personalDetails.name = it.memberName;
          if (it.phone) farmer.personalDetails.phone = it.phone;
          if (it.isMember !== undefined) {
            farmer.isMembership = it.isMember;
            if (it.isMember && !farmer.memberId) farmer.memberId = it.memberCode;
          }
          if (it.isActive !== undefined) farmer.status = it.isActive ? 'Active' : 'Inactive';
          if (it.rateType) farmer.rateType = it.rateType;
          if (it.importType) farmer.importType = it.importType;
          if (!farmer.collectionCenter) farmer.collectionCenter = centreId;
          farmer.markModified('personalDetails');
          await farmer.save();
        } else {
          farmer = new Farmer({
            farmerNumber: it.memberCode,
            memberId: it.isMember ? it.memberCode : undefined,
            personalDetails: { name: it.memberName, phone: it.phone },
            address: { village: it.villageName },
            collectionCenter: centreId,
            isMembership: !!it.isMember,
            status: it.isActive === false ? 'Inactive' : 'Active',
            rateType: it.rateType,
            importType: it.importType,
            companyId,
          });
          await farmer.save();
        }

        const ledgerName = `${it.memberName} (${await farmerRefText(farmer, effectiveSeries)})`;
        if (farmer.ledgerId) {
          await Ledger.updateOne({ _id: farmer.ledgerId }, { $set: { ledgerName } });
        } else {
          const ledger = await Ledger.create({
            ledgerName,
            ledgerType: 'Party',
            linkedEntity: { entityType: 'Farmer', entityId: farmer._id },
            openingBalance: 0, openingBalanceType: 'Dr',
            currentBalance: 0, balanceType: 'Dr',
            parentGroup: 'Advance / Due',
            status: 'Active',
            companyId,
          });
          farmer.ledgerId = ledger._id;
          await farmer.save();
        }

        if (it.action === 'Create') results.created++; else results.updated++;
      } catch (err) {
        const msg = err?.code === 11000
          ? `Farmer Number ${it.memberCode} already exists in ${it.centreCode}`
          : (err.message || 'Failed to save farmer');
        results.failed.push({ row: it.rowNumber, villageCode: it.villageCode, memberCode: it.memberCode, name: it.memberName, message: msg });
      }
    }

    res.json({
      success: true,
      message: `DP import done: ${results.created} created, ${results.updated} updated, ${results.duplicates.length} duplicates, ${results.failed.length} failed`,
      data: { dryRun: false, ...results, villages, ...meta }
    });
  } catch (error) {
    console.error('DP farmer import error:', error);
    res.status(500).json({ success: false, message: error.message || 'DP farmer import failed' });
  }
};

// Suggested mapping for the VillageCodes of a file: a centre already remembered for the
// code, else a centre with the same name, else a new code from the starting number.
export const dpImportSuggestMappings = async (req, res) => {
  try {
    const companyId = req.companyId;
    const villages = Array.isArray(req.body?.villages) ? req.body.villages : [];
    await ensureCentreCodes(companyId).catch(() => {});
    const centres = await CollectionCenter.find({ companyId }).select('centerName centerCode dpVillageCode centerType status').lean();
    const norm = (s) => str(s).toUpperCase().replace(/\s+/g, ' ');

    const used = new Set();
    const out = villages.map(v => {
      const vc = codeStr(v.villageCode);
      const byCode = centres.find(c => c.dpVillageCode === vc && !used.has(String(c._id)));
      const byName = !byCode && centres.find(c => norm(c.centerName) === norm(v.villageName) && !used.has(String(c._id)));
      const hit = byCode || byName;
      if (hit) used.add(String(hit._id));
      return { villageCode: vc, villageName: str(v.villageName), centreId: hit ? String(hit._id) : null, matchedBy: byCode ? 'VillageCode' : byName ? 'Name' : null };
    });
    const unmapped = out.filter(o => !o.centreId);
    const codes = await nextCentreCodes(companyId, unmapped.length);
    unmapped.forEach((o, i) => { o.newCode = codes[i]; });

    res.json({
      success: true,
      data: {
        mappings: out,
        centres: centres.map(c => ({ _id: c._id, centerName: c.centerName, centerCode: c.centerCode, dpVillageCode: c.dpVillageCode || '', centerType: c.centerType, status: c.status })),
        numberSeries: await getNumberSeries(companyId),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
