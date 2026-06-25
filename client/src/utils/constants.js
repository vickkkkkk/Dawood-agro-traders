// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'CASH',
  JAZZCASH: 'JAZZCASH',
  EASYPAISA: 'EASYPAISA',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT',
};

export const PAYMENT_METHOD_LABELS = {
  CASH: 'Cash',
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'EasyPaisa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit (Udhar)',
};

export const PAYMENT_METHOD_COLORS = {
  CASH: 'text-green-400',
  JAZZCASH: 'text-red-400',
  EASYPAISA: 'text-emerald-400',
  BANK_TRANSFER: 'text-blue-400',
  CREDIT: 'text-amber-400',
};

// Bill Status
export const BILL_STATUS = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  CREDIT: 'CREDIT',
  VOID: 'VOID',
};

export const BILL_STATUS_COLORS = {
  PAID: { bg: '', text: 'text-green-400', border: '' },
  PARTIAL: { bg: '', text: 'text-amber-400', border: '' },
  CREDIT: { bg: '', text: 'text-red-400', border: '' },
  VOID: { bg: '', text: 'text-gray-400', border: '' },
};

// User Roles
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
};

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
};

export const ROLE_COLORS = {
  ADMIN: { bg: '', text: 'text-purple-400' },
  MANAGER: { bg: '', text: 'text-blue-400' },
  CASHIER: { bg: '', text: 'text-emerald-400' },
};

// Stock status thresholds
export const STOCK_STATUS = {
  OUT: 0,
  LOW: 10,
  GOOD: 50,
};

export const getStockStatusColor = (qty) => {
  if (qty <= STOCK_STATUS.OUT) return { bg: '', text: 'text-red-400' };
  if (qty <= STOCK_STATUS.LOW) return { bg: '', text: 'text-amber-400' };
  return { bg: '', text: 'text-green-400' };
};

// Navigation items
export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/pos', label: 'Point of Sale', icon: 'ShoppingCart', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/bills', label: 'Bills', icon: 'Receipt', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/inventory', label: 'Inventory', icon: 'Package', roles: ['ADMIN', 'MANAGER'] },
  { path: '/purchases', label: 'Purchases', icon: 'Truck', roles: ['ADMIN', 'MANAGER'] },
  { path: '/customers', label: 'Customers', icon: 'Users', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { path: '/credits', label: 'Credit Ledger', icon: 'BookOpen', roles: ['ADMIN', 'MANAGER'] },
  { path: '/cash-management', label: 'Cash Management', icon: 'Wallet', roles: ['ADMIN', 'MANAGER'] },
  { path: '/purchase-ledger', label: 'Purchase Ledger', icon: 'FileSpreadsheet', roles: ['ADMIN', 'MANAGER'] },
  { path: '/sales-ledger', label: 'Sales Ledger', icon: 'TrendingUp', roles: ['ADMIN', 'MANAGER'] },
  { path: '/users', label: 'User Management', icon: 'UserCog', roles: ['ADMIN'] },
];

// Months for selectors
export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];
