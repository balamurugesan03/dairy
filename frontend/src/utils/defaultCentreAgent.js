// Login-based default Centre / Agent — one rule for every entry form.
// Source of truth: User Management → user → Center / Agent.
//
//   • Centre login            → that centre
//   • Any user login          → their assigned centre (User.collectionCenter, else the
//                               linked agent's centre) and their assigned agent
//   • Nothing assigned / company login → the Head Office (lowest centre code, C1)
//
// Admins (isAdminLogin) may still pick other centres / agents; centre logins and ordinary
// users with an assignment get `locked: true` — only their own centre / agent is offered.
import { useEffect, useState } from 'react';
import { useAuth, isAdminAccount } from '../context/AuthContext';
import { agentAPI, collectionCenterAPI } from '../services/api';

const idOf = (v) => (v?._id ?? v)?.toString?.() || '';
const codeNum = (c) => parseInt(String(c?.centerCode || '').replace(/^C/i, ''), 10) || 999999;

// Head Office = the first centre (C1); centres rarely change — share one request, refresh after 60 s
let headOfficeCache = { at: 0, promise: null };
const loadHeadOffice = () => {
  if (!headOfficeCache.promise || Date.now() - headOfficeCache.at > 60 * 1000) {
    headOfficeCache = {
      at: Date.now(),
      promise: collectionCenterAPI.getAll({ status: 'Active', limit: 1000 })
        .then((res) => {
          const list = [...(res?.data || [])];
          list.sort((a, b) => (a.centerType === 'Head Office' ? 0 : 1) - (b.centerType === 'Head Office' ? 0 : 1) || codeNum(a) - codeNum(b));
          return idOf(list[0]);
        })
        .catch(() => ''),
    };
  }
  return headOfficeCache.promise;
};

// Call after centres change so open forms pick up the new Head Office
export const clearDefaultCentreAgentCache = () => { headOfficeCache = { at: 0, promise: null }; };

export async function resolveDefaultCentreAgent({ user, isCentreLogin, centreInfo }) {
  if (isCentreLogin) return { centreId: idOf(centreInfo?.centreId), agentId: '', locked: true };

  if (user?.loginType === 'user') {
    let centreId = idOf(user.collectionCenter);
    const agentId = idOf(user.agentId);
    if (!centreId && agentId) {
      centreId = idOf(user.agentId?.collectionCenterId);
      if (!centreId) {
        try {
          const res = await agentAPI.getById(agentId);
          centreId = idOf(res?.data?.collectionCenterId);
        } catch { /* leave empty */ }
      }
    }
    if (centreId || agentId) {
      return { centreId: centreId || await loadHeadOffice(), agentId, locked: !isAdminAccount(user) && !!centreId };
    }
  }

  return { centreId: await loadHeadOffice(), agentId: '', locked: false };
}

export default function useDefaultCentreAgent() {
  const { user, isCentreLogin, centreInfo } = useAuth();
  const [defaults, setDefaults] = useState({ centreId: '', agentId: '', locked: false, loaded: false });

  useEffect(() => {
    let alive = true;
    resolveDefaultCentreAgent({ user, isCentreLogin, centreInfo })
      .then((d) => { if (alive) setDefaults({ ...d, loaded: true }); });
    return () => { alive = false; };
  }, [user, isCentreLogin, centreInfo]);

  return defaults;
}
