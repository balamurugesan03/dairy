// Login-based default Centre / Agent for entry forms.
//
//   • Centre login            → that centre
//   • Staff / agent user      → their assigned centre (User.collectionCenter, else the
//                               linked agent's centre) and their assigned agent
//   • Admin (company login, admin / superadmin users, or staff with nothing assigned)
//                             → Producer Management → Settings → Default Centre / Agent
//
// Forms only PRESELECT these; whether the field is locked stays each form's own rule.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { farmerSettingsAPI, agentAPI } from '../services/api';

const idOf = (v) => (v?._id ?? v)?.toString?.() || '';

// Settings rarely change — share one request between forms, refresh after 60 s
let settingsCache = { at: 0, promise: null };
const loadAdminDefaults = () => {
  if (!settingsCache.promise || Date.now() - settingsCache.at > 60 * 1000) {
    settingsCache = {
      at: Date.now(),
      promise: farmerSettingsAPI.getSettings()
        .then((res) => ({ centreId: idOf(res?.data?.defaultCentre), agentId: idOf(res?.data?.defaultAgent) }))
        .catch(() => ({ centreId: '', agentId: '' })),
    };
  }
  return settingsCache.promise;
};

// Call after saving settings so open forms pick up the new defaults
export const clearDefaultCentreAgentCache = () => { settingsCache = { at: 0, promise: null }; };

export async function resolveDefaultCentreAgent({ user, isCentreLogin, centreInfo }) {
  if (isCentreLogin) return { centreId: idOf(centreInfo?.centreId), agentId: '' };

  if (user?.role === 'user') {
    let centreId = idOf(user.collectionCenter);
    const agentId = idOf(user.agentId);
    if (!centreId && agentId) {
      try {
        const res = await agentAPI.getById(agentId);
        centreId = idOf(res?.data?.collectionCenterId);
      } catch { /* leave empty */ }
    }
    if (centreId || agentId) return { centreId, agentId };
  }

  return loadAdminDefaults();
}

export default function useDefaultCentreAgent() {
  const { user, isCentreLogin, centreInfo } = useAuth();
  const [defaults, setDefaults] = useState({ centreId: '', agentId: '', loaded: false });

  useEffect(() => {
    let alive = true;
    resolveDefaultCentreAgent({ user, isCentreLogin, centreInfo })
      .then((d) => { if (alive) setDefaults({ ...d, loaded: true }); });
    return () => { alive = false; };
  }, [user, isCentreLogin, centreInfo]);

  return defaults;
}
