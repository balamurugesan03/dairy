import { createContext, useReducer, useContext } from 'react';

const AppContext = createContext();

// Initial state
const initialState = {
  farmers: [],
  items: [],
  sales: [],
  vouchers: [],
  ledgers: [],
  payments: [],
  advances: [],
  warranties: [],
  machines: [],
  quotations: [],
  promotions: [],
  loading: false,
  error: null
};

// Action types
export const ActionTypes = {
  SET_FARMERS: 'SET_FARMERS',
  SET_ITEMS: 'SET_ITEMS',
  SET_SALES: 'SET_SALES',
  SET_VOUCHERS: 'SET_VOUCHERS',
  SET_LEDGERS: 'SET_LEDGERS',
  SET_PAYMENTS: 'SET_PAYMENTS',
  SET_ADVANCES: 'SET_ADVANCES',
  SET_WARRANTIES: 'SET_WARRANTIES',
  SET_MACHINES: 'SET_MACHINES',
  SET_QUOTATIONS: 'SET_QUOTATIONS',
  SET_PROMOTIONS: 'SET_PROMOTIONS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Reducer
const appReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_FARMERS:
      return { ...state, farmers: action.payload };
    case ActionTypes.SET_ITEMS:
      return { ...state, items: action.payload };
    case ActionTypes.SET_SALES:
      return { ...state, sales: action.payload };
    case ActionTypes.SET_VOUCHERS:
      return { ...state, vouchers: action.payload };
    case ActionTypes.SET_LEDGERS:
      return { ...state, ledgers: action.payload };
    case ActionTypes.SET_PAYMENTS:
      return { ...state, payments: action.payload };
    case ActionTypes.SET_ADVANCES:
      return { ...state, advances: action.payload };
    case ActionTypes.SET_WARRANTIES:
      return { ...state, warranties: action.payload };
    case ActionTypes.SET_MACHINES:
      return { ...state, machines: action.payload };
    case ActionTypes.SET_QUOTATIONS:
      return { ...state, quotations: action.payload };
    case ActionTypes.SET_PROMOTIONS:
      return { ...state, promotions: action.payload };
    case ActionTypes.SET_LOADING:
      return { ...state, loading: action.payload };
    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload };
    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };
    default:
      return state;
  }
};

// Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export default AppContext;
