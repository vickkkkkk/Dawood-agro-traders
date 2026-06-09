/**
 * Format a number as Pakistani Rupees (PKR)
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string like "Rs. 1,234"
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0';
  
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Format with Pakistani numbering system (Indian/Pakistani comma placement)
  // e.g., 1,00,000 instead of 100,000
  const formatted = absNum.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return `${isNegative ? '-' : ''}Rs. ${formatted}`;
};

/**
 * Format currency with decimals
 * @param {number} amount
 * @returns {string}
 */
export const formatCurrencyDecimal = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0.00';
  
  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  const formatted = absNum.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return `${isNegative ? '-' : ''}Rs. ${formatted}`;
};

/**
 * Parse a currency string back to a number
 * @param {string} str 
 * @returns {number}
 */
export const parseCurrency = (str) => {
  if (!str) return 0;
  return Number(String(str).replace(/[^0-9.-]/g, ''));
};

export default formatCurrency;
