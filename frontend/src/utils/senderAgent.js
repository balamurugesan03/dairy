// Sender Agent helpers shared by Milk Purchase (F2) and Milk Sales (F3).
//
//   • Agent login  (User linked to an Agent via User.agentId, non-admin role)
//       → Sender Agent is fixed to that agent; centre follows the agent.
//   • Admin login  (company / admin / superadmin, or any other user)
//       → every active agent under every centre is offered, grouped by centre.
//         Default = the logged-in user's own agent (linked agentId, else an
//         agent whose name matches the user's name), else the first agent of
//         the selected centre.

const idOf = (v) => (v?._id ?? v)?.toString?.() || '';

// API agent docs → Select options (keeps centre info for grouping/filtering)
export const toAgentOptions = (agents = []) => agents.map(a => ({
  value: a._id,
  label: a.agentName || '—',
  centerId: idOf(a.collectionCenterId) || null,
  centerName: a.collectionCenterId?.centerName || '',
}));

// Mantine grouped Select data. The selected centre's group is listed first.
export const groupAgentsByCenter = (options = [], firstCenterId = '') => {
  const groups = new Map();
  options.forEach(({ value, label, centerId, centerName }) => {
    const key = centerId || '_none';
    if (!groups.has(key)) groups.set(key, { group: centerName || 'Other', centerId: key, items: [] });
    groups.get(key).items.push({ value, label });
  });
  return [...groups.values()]
    .sort((a, b) => (b.centerId === firstCenterId) - (a.centerId === firstCenterId) || a.group.localeCompare(b.group))
    .map(({ group, items }) => ({ group, items }));
};

// The agent the logged-in user "is", if any.
export const findOwnAgent = (options = [], user) => {
  if (!user) return null;
  const linkedId = idOf(user.agentId);
  if (linkedId) {
    const linked = options.find(a => a.value === linkedId);
    if (linked) return linked;
  }
  const names = [user.displayName, user.username, user.name]
    .filter(Boolean).map(n => n.trim().toLowerCase());
  return options.find(a => names.includes((a.label || '').trim().toLowerCase())) || null;
};

// Default Sender Agent for a screen.
export const pickDefaultAgent = (options = [], user, centerId = '') => {
  const own = findOwnAgent(options, user);
  if (own) return own;
  return options.find(a => a.centerId === centerId) || options[0] || null;
};
