import Agent from '../models/Agent.js';

// Mobile-app submissions are entered agent-wise and may omit the collection
// center entirely (the agent already implies it). Both MilkCollection and
// MilkSales require the center to be filterable, so derive it from the
// agent's own collectionCenterId whenever the caller didn't supply one.
export async function resolveCenterFromAgent(agentId) {
  if (!agentId) return null;
  try {
    const agent = await Agent.findById(agentId).select('collectionCenterId').lean();
    return agent?.collectionCenterId || null;
  } catch {
    return null;
  }
}
