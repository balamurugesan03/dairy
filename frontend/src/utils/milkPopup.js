// Milk Purchase / Milk Sales always open as the MainLayout popups (never as
// pages). Anything outside MainLayout opens them with openMilkPopup().
export const MILK_POPUP_EVENT = 'open-milk-popup';

export const MILK_POPUP_ROUTES = {
  '/daily-collections/milk-purchase': 'purchase',
  '/daily-collections/milk-sales':    'sales',
};

export const openMilkPopup = (which) =>
  window.dispatchEvent(new CustomEvent(MILK_POPUP_EVENT, { detail: which === 'sales' ? 'sales' : 'purchase' }));
