import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ledger from '../models/Ledger.js';

dotenv.config();

// ── Dairy Cooperative Society — Standard Chart of Accounts ──────────────────
// voucherType: B=Balance Sheet  P=Profit&Loss  R=Receipt
// isFixed: true = system ledger (cannot be deleted by users)
// balanceType auto-derived from parentGroup: ASSET/EXPENSE→Dr, LIABILITY/INCOME→Cr

const DAIRY_LEDGERS = [

  // ══ ASSET ══════════════════════════════════════════════════════════════════

  // Bank Accounts
  { ledgerName: 'KOTTAKAL SERVICE CO-OPERATIVE BANK A/C',    ledgerType: 'Bank Accounts', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },
  { ledgerName: 'KOTTAKAL SERVICE CO-OPERATIVE BANK FD A/C', ledgerType: 'Bank Accounts', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },
  { ledgerName: 'UNION BANK A/C',                            ledgerType: 'Bank Accounts', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },

  // Share in Other Institutions
  { ledgerName: 'SHARE IN DIST CO-OP BANK', ledgerType: 'Share in Other Institutions', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },
  { ledgerName: 'SHARE IN MILMA',           ledgerType: 'Share in Other Institutions', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },

  // Other Investments
  { ledgerName: 'BUILDING FUND DEPOSITS',                ledgerType: 'Other Investments', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },
  { ledgerName: 'INVESTMENT OF RESERVE FUND',            ledgerType: 'Other Investments', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },
  { ledgerName: 'INVESTMENT OF STAFF PROVIDENT FUND',    ledgerType: 'Other Investments', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },
  { ledgerName: 'INVESTMENT OF STAFF SECURITY DEPOSIT',  ledgerType: 'Other Investments', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },

  // Fixed Assets - Movables
  { ledgerName: 'COMPUTER & ACCESSORIES',                  ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'FIXTURES & FITTINGS',                     ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'FURNITURE',                               ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'LIBRARY BOOKS',                           ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'LOOSE TOOLS',                             ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'MILK CAN',                                ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILK PROCUREMENT & TESTING EQUIPMENTS',   ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'MOTOR VEHICLES',                          ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'OFFICE EQUIPMENTS',                       ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'PLANT AND MACHINERY',                     ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'WEIGHING SCALE',                          ledgerType: 'Fixed Assets - Movables', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },

  // Fixed Assets - Immovables
  { ledgerName: 'BUILDINGS', ledgerType: 'Fixed Assets - Immovables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },
  { ledgerName: 'LAND',      ledgerType: 'Fixed Assets - Immovables', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },

  // Advance due to Society
  { ledgerName: 'CATTLE FEED ADVANCE',        ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'COVID 19 RELIEF ADDL PRICE', ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILK VALUE ADDL PRICE ADVANCE', ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILMA UNION',                ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'SA DUE FROM CREDIT SALES',   ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'SA DUE FROM SALESMAN',        ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },
  { ledgerName: 'STAFF PF LOAN',               ledgerType: 'Advance due to Society', parentGroup: 'ASSET', voucherType: 'B', isFixed: true  },

  // Loss
  { ledgerName: 'PREVIOUS YEARS LOSS', ledgerType: 'Loss', parentGroup: 'ASSET', voucherType: 'B', isFixed: true },

  // ══ LIABILITY ══════════════════════════════════════════════════════════════

  // Share Capital
  { ledgerName: 'SHARE CAPITAL', ledgerType: 'Share Capital', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },

  // Statutory Funds and Reserves
  { ledgerName: 'BUILDING FUND',              ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'CATTLE DEVELOPMENT FUND',    ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'CHARITY FUND',               ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'CO OPERATIVE PROPAGANDA FUND', ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'MEMBERS BONUS',              ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'RESERVE FUND',               ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'STAFF BONUS DUE',            ledgerType: 'Statutory Funds and Reserves', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },

  // Other Funds, Reserves and Provisions
  { ledgerName: 'CAPITAL RESERVE',                        ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'DEPRECIATION FUND',                      ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'PROVISION FOR BONUS TO EMPLOYEES',       ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'PROVISION FOR GRATUITY TO EMPLOYEES',    ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'RESERVE FOR BAD & DOUBTFUL DEBTS',       ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'RESERVE FOR DAMAGED STOCK',              ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'RESERVE FOR DEFICIT STOCK',              ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'RESERVE FOR EXCESS STOCK',               ledgerType: 'Other Funds, Reserves and Provisions', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },

  // Grants and Subsidies
  { ledgerName: 'ATMA GRANTS & SUBSIDIES',        ledgerType: 'Grants and Subsidies', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'DEPARTMENT GRANT AND SUBSIDIES', ledgerType: 'Grants and Subsidies', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILMA GRANT AND SUBSIDIES',      ledgerType: 'Grants and Subsidies', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },

  // Other Liabilities
  { ledgerName: 'STAFF PROVIDENT FUND DEPOSITS', ledgerType: 'Other Liabilities', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },
  { ledgerName: 'STAFF SECURITY DEPOSITS',       ledgerType: 'Other Liabilities', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },

  // Advance due by Society
  { ledgerName: 'ADDL PRICE WORKING FUND TO STAFF',          ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'APCOS EMPLOYEES WELFARE SOCIETY',           ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'AUDIT RECTIFICATIONS (CF INSP FEE)',        ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'AUDIT RECTIFICATIONS(CB DIFF)',             ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'CATINS UNION SHARE REFUND',                 ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'CATTLE DEATH INSURANCE CLAIM',              ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'CATTLE INSURANCE PREMIUM',                  ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'CATTLE SHED SUBSIDY',                       ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'COW SHED AND HOME INSURANCE',               ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'EMPLOYEE CO-OP SOCIETY LOAN',               ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'EMPLOYEE LIC PREMIUM',                      ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'EMPLOYEE LOAN RECOVERY',                    ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'EMPLOYEES PROVIDENT FUND',                  ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'EMPLOYEES RECURRING DEPOSIT',               ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'FARM SUPPORT SUBSIDY',                      ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'FARMER ADVANCE',                            ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'HDP INSURANCE PREMIUM AND TAG FEE',         ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'IDDP FARMERS INDUCTION PROGRAMME',          ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'KDF WELFARE FUND',                          ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'KDFWF ADMISSION FEE',                       ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'KDFWF DEATH ASSISTANCE',                    ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'KDFWF ONAMADHURAM',                         ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'KKSP INCENTIVE',                            ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MEDICLAIM PREMIUM',                         ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILMA ADDL PRICE INCENTIVE TO STAFFS',      ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILMA RELIEF ASSISTANCE',                   ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MILMA FARMERS MEETING',                     ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'MRDF ASSISTANCE',                           ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'PENSION FUND - KSCEPB',                     ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'PRESIDENT ADVANCE',                         ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'PRODUCERS DUES',                            ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'SECRETARY ADVANCE',                         ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'SILAGE HANDLING CHARGES',                   ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'STAFF PROVIDENT FUND',                      ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'SUSPENSE LIABILITY',                        ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },
  { ledgerName: 'TA MPM DAIRY FUNCTION',                     ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'VETERINARY CF STAFF INSPECTION FEE',        ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'WEATHER PROTECTION INSURANCE',              ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: false },
  { ledgerName: 'WELFARE FUND - KSCEWB',                     ledgerType: 'Advance due by Society', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true  },

  // Profit
  { ledgerName: 'UNDISTRIBUTED PROFIT PREV YEARS', ledgerType: 'Profit', parentGroup: 'LIABILITY', voucherType: 'B', isFixed: true },

  // ══ EXPENSE ════════════════════════════════════════════════════════════════

  // Establishment Charges
  { ledgerName: 'APCOS EWS DCS CONTRIBUTION',  ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'DAILY WAGES',                 ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'EPF DCS CONTRIBUTION',        ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'FESTIVAL ALLOWANCES',         ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'GROUP GRATUITY',              ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'HOLIDAY WAGE',               ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'LEAVE SALARY',               ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'LEAVE SURRENDER',            ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'MEDICAL ALLOWANCES',         ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'PENSION FUND DCS CONTRIBUTION', ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'SALARY & ALLOWANCES',        ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'STAFF BONUS',               ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'WELFARE FUND DCS CONTRIBUTION', ledgerType: 'Establishment Charges', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },

  // Contingencies
  { ledgerName: 'ADVERTISEMENT',             ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'AFFILATION FEE',            ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'ANNUAL MAINTENANCE COSTS',  ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'AUDIT FEE',                 ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'AWARDS & PRESENTATIONS',    ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BANK CHARGES',              ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BOOKS & FORMS',             ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'CELEBRATIONS & CEREMONIES', ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'COVID 19 RELIEF ASSISTANCE', ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'DONATION',                  ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'ELECTION EXPENSES',         ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'ELECTRICITY CHARGES',       ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'FARMERS CONTACT PROGRAM',   ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'FLOOD RELIEF FUND',         ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'GENERAL BODY EXPENSES',     ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'HONORARIUM',                ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INCOME TAX',               ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INSURANCE PREMIUM',        ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INTEREST PAID',            ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INTERNET CHARGES',         ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'KDFWF SOCIETY CONTRIBUTION', ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'KERALA CESS',              ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'KSHEERASAMGAMAM EXPENSES', ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'KSHEERASANTHWANAM INSURANCE SOCIETY CONTRIBUTION', ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'LAW CHARGES',             ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'LIC AABY RECOVERY',       ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'LIC GI PREMIUM',          ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'MEETING EXPENSES',        ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'MISCELLANEOUS EXPENSES',  ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'OFFICE EXPENSES',         ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'OKHI RELIEF FUND',        ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'P&I SALES SPARE COST',    ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'POSTAGE',                 ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'POSTAL COVER',            ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'PRINTING & STATIONERY',   ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'RATES & TAXES',           ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'REFRESHMENT',             ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'RENT PAID',              ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'REPAIRS & MAINTENANCE',   ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'SITTING FEE',            ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'SUBSCRIPTION',           ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'TA TO DIRECTORS',        ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'TA TO STAFF',            ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'TELEPHONE CHARGES',      ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'TRAINING EXPENSES',      ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'VETFEN RECOVERY',        ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'WATER CHARGES',          ledgerType: 'Contingencies', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },

  // Purchases
  { ledgerName: 'CATTLE FEED PURCHASE',    ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'FARM EQUIPMENT PURCHASE', ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'GENERAL STORE PURCHASE',  ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'GHEE PURCHASE',           ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'HDP CATTLE FEED PURCHASE', ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true },
  { ledgerName: 'MILK PURCHASE',           ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'MINERALS PURCHASE',       ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'PURCHASE RETURNS',        ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'R', isFixed: true  },
  { ledgerName: 'UNIFORM PURCHASE',        ledgerType: 'Purchases', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },

  // Trade Expenses
  { ledgerName: 'ADDL PRICE INCENTIVE TO FARMERS',         ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'BMC ELECTRICITY CHARGES',                 ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BMC EXPENSES',                            ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BMC FUEL CHARGES',                        ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BMC REPAIRING & MAINTENANCE',             ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'BMC TRANSPORTING CHARGES',                ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'FUEL CHARGES',                            ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INCENTIVE DCS CONTRIBUTION',              ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'INSPECTION FEE',                          ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'LABORATARY EXPENSES',                     ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'LOADING & UNLOADING',                     ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'MILK INCENTIVE (SHIFT)',                   ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'MILK INCENTIVE TO FARMERS',               ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'MILK VALUE EXCESS PAID',                  ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'QUALITY AWARENESS PROGRAMME',             ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'ROUNDING DIFFERENCE PAYMENT',             ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'TDS RECOVERY',                            ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'TRADE DISCOUNT',                          ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'TRADE EXPENSES',                          ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'TRANSPORTING CHARGES',                    ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: true  },
  { ledgerName: 'VETERINARY SCHEME CATTLE FEED EXPENSES',  ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'VETERINARY SCHEME HANDLING CHARGES',      ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },
  { ledgerName: 'VETERINARY SLBP CF UNLOADING CHARGES',    ledgerType: 'Trade Expenses', parentGroup: 'EXPENSE', voucherType: 'P', isFixed: false },

  // ══ INCOME ═════════════════════════════════════════════════════════════════

  // Miscellaneous Income
  { ledgerName: 'INTEREST RECEIVED', ledgerType: 'Miscellaneous Income', parentGroup: 'INCOME', voucherType: 'B', isFixed: false },
  { ledgerName: 'VMRP',              ledgerType: 'Miscellaneous Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },

  // Sales
  { ledgerName: 'CATTLE FEED SALES',    ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'FARM EQUIPMENTS SALES', ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true },
  { ledgerName: 'GENERAL STORE SALES',  ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'GHEE SALES',           ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'HDP CATTLE FEED SALES', ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true },
  { ledgerName: 'LOCAL SALES',          ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'MINERALS SALES',       ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'OTHER MILK SALES',     ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'SALES RETURN',         ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'P', isFixed: true  },
  { ledgerName: 'SAMPLE SALES',         ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'UNIFORM SALES',        ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'UNION SALES',          ledgerType: 'Sales', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },

  // Trade Income
  { ledgerName: 'ADDL PRICE TO SOCIETIES',                  ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'ADDL PRICE WORKING FUND',                  ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'BMC CHILLING COST (RECEIPTS)',             ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'BMC REPAIR CHARGES RECEIPT',              ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'BMC TRANSPORTATION (RECEIPTS)',            ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'CATTLE FEED COMMISSION',                   ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'GENERAL STORE COMMISSION',                 ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'GREEN FODDER COMMISSION',                  ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'HDP CATTLE FEED COMMISSION',               ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'MILK VALUE EXTRA PAYMENT',                 ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'MINERALS COMMISSION',                      ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'ROUNDING DIFFERENCE RECEIPT',              ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'TRANSPORT CHAGES (RECOVERY)',              ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'VEHICLE INCOME',                           ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: true  },
  { ledgerName: 'VETERINARY SCHEME CATTLE FEED COMMISSION', ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
  { ledgerName: 'WORKING CAPITAL GRANT',                    ledgerType: 'Trade Income', parentGroup: 'INCOME', voucherType: 'R', isFixed: false },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const balanceTypeFor = (parentGroup) =>
  ['ASSET', 'EXPENSE'].includes(parentGroup) ? 'Dr' : 'Cr';

export async function seedDairyLedgersForCompany(companyId) {
  let created = 0, skipped = 0;

  for (const def of DAIRY_LEDGERS) {
    const bt = balanceTypeFor(def.parentGroup);
    const result = await Ledger.updateOne(
      { ledgerName: def.ledgerName, companyId },
      {
        $setOnInsert: {
          ledgerName:          def.ledgerName,
          ledgerType:          def.ledgerType,
          parentGroup:         def.parentGroup,
          voucherType:         def.voucherType,
          isFixed:             def.isFixed,
          openingBalance:      0,
          openingBalanceType:  bt,
          currentBalance:      0,
          balanceType:         bt,
          status:              'Active',
          companyId,
        }
      },
      { upsert: true }
    );
    if (result.upsertedCount) created++;
    else skipped++;
  }

  return { created, skipped, total: DAIRY_LEDGERS.length };
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// Usage: COMPANY_ID=<id> node seedDairyLedgers.js

if (process.argv[1].includes('seedDairyLedgers')) {
  const companyId = process.env.COMPANY_ID;
  if (!companyId) { console.error('Set COMPANY_ID env var'); process.exit(1); }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await seedDairyLedgersForCompany(companyId);
  console.log(`Done: ${result.created} created, ${result.skipped} already existed`);
  await mongoose.disconnect();
}
