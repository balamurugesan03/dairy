// User tiers + module permissions — same rules as frontend/src/utils/modulePermissions.js
//
//   Super Admin — company login (created at company setup), a superadmin / admin
//                 account, or a User Management user of type 'superuser' ("Super Admin")
//   Admin       — User Management user of type 'admin'
//   Others      — only the modules assigned in User Management

export const isSuperAdminReq = (req) => {
  if (req.userType === 'company') return true;
  if (req.userType !== 'user') return false;           // centre logins never
  const u = req.user || {};
  return u.role === 'superadmin' || u.role === 'admin' || u.userType === 'superuser';
};

export const isAdminTierReq = (req) =>
  req.userType === 'user' && !isSuperAdminReq(req) && req.user?.userType === 'admin';

export const canManageUsersReq = (req) => isSuperAdminReq(req) || isAdminTierReq(req);

// Never assignable: Super Admin-only options, and User Management (decided by tier)
export const NON_ASSIGNABLE_PERMS = ['milkCollection.rateChart', 'settings.openLyssaMerge', 'settings.userManagement'];

const anyFlag = (p) => !!p && (p.read || p.write || p.edit || p.delete);

/** Does the user hold `action` ('read'|'write'|'edit'|'delete'|'any') anywhere in `moduleKey` (module or one of its screens)? */
export const hasModuleAction = (user, moduleKey, action) => (user?.permissions || []).some((p) => {
  if (p.module !== moduleKey && !p.module.startsWith(`${moduleKey}.`)) return false;
  return action === 'any' ? anyFlag(p) : !!p[action];
});

// Express middleware: Super Admin only
export const requireSuperAdmin = (req, res, next) => {
  if (isSuperAdminReq(req)) return next();
  return res.status(403).json({ success: false, message: 'Only the Super Admin can use this option' });
};
