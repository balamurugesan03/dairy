const KEY = 'dairy_offline_queue';

export const offlineQueue = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  },
  add(type, payload) {
    const item = { localId: `${type}-${Date.now()}`, type, payload, queuedAt: new Date().toISOString() };
    const q = this.getAll();
    q.push(item);
    localStorage.setItem(KEY, JSON.stringify(q));
    return item;
  },
  remove(localId) {
    const q = this.getAll().filter(i => i.localId !== localId);
    localStorage.setItem(KEY, JSON.stringify(q));
  },
  byType(type) {
    return this.getAll().filter(i => i.type === type);
  },
};
