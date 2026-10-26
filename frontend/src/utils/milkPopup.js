// Milk Purchase / Milk Sales always open as the MainLayout popups (never as
// pages). Anything outside MainLayout opens them with openMilkPopup().
export const MILK_POPUP_EVENT = 'open-milk-popup';

export const MILK_POPUP_ROUTES = {
  '/daily-collections/milk-purchase': 'purchase',
  '/daily-collections/milk-sales':    'sales',
};

// Dialogs opened FROM a milk popup (Export, Import, Bulk Delete, confirmations) must sit
// above the popups (200 / 210, Cash Book 220) — at Mantine's default 200 they opened
// behind Milk Purchase. Kept below 300 so their own dropdowns / date pickers still show.
export const POPUP_CHILD_Z = 260;

export const openMilkPopup = (which) =>
  window.dispatchEvent(new CustomEvent(MILK_POPUP_EVENT, { detail: which === 'sales' ? 'sales' : 'purchase' }));
