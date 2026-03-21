/* ============================================================
   POCKET APP — Constants & Initial State
   All configuration values and initial data structures
   ============================================================ */

export const STORAGE_KEY = 'pocket-app-v2';

export const INITIAL_STATE = {
  isSetupComplete: false,
  microIncomeLedger: [],      // [{ id, amount(¢), label, date(ISO) }]
  nextIncomeDate: null,       // ISO — next expected cash injection
  cashOnHand: 0,              // centavos — liquid funds after bills/utang
  tier1Bills: [],             // [{ id, label, amount(¢), dueDate(ISO), isPaid }]
  tier2Config: { categories: ['food', 'transport'] },
  transactions: [],           // [{ id, date(ISO), amount(¢), tier, category, satietyScore?, note? }]
  setupDate: null,            // ISO
  utangLedger: [],            // [{ id, amount(¢), label, date(ISO), amountPaid(¢) }]
  emergencyVault: 0,          // centavos — locked auto-saved vault
  nutritionLog: [],           // [{ date, score, cost }]
  lastProcessedDate: null,    // ISO — last date we ran end-of-day leftover split
};

export const SATIETY_TAGS = [
  { value: 1, label: 'Junk', emoji: '🍜' },
  { value: 2, label: 'Low', emoji: '🍞' },
  { value: 3, label: 'Fair', emoji: '👌' },
  { value: 4, label: 'Good', emoji: '🥩' },
  { value: 5, label: 'Superb', emoji: '🥗' },
];

export const CAT_ICONS = { food: '🍚', transport: '🚌' };
