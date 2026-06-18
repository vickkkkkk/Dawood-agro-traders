import api from './axios';

export const getDashboard = async (params = {}) => {
  const response = await api.get('/reports/dashboard', { params });
  return response.data;
};

export const getDailySales = async (month, year) => {
  const response = await api.get('/reports/daily-sales', { params: { month, year } });
  return response.data;
};

export const getMonthlySales = async (year) => {
  const response = await api.get('/reports/monthly-sales', { params: { year } });
  return response.data;
};

export const getStockValue = async () => {
  const response = await api.get('/reports/stock-value');
  return response.data;
};

export const getPurchaseLedger = async () => {
  const response = await api.get('/reports/purchase-ledger');
  return response.data;
};

export const getProductPurchaseDetail = async (productId) => {
  const response = await api.get(`/reports/purchase-ledger/${productId}`);
  return response.data;
};

export const getSalesLedger = async () => {
  const response = await api.get('/reports/sales-ledger');
  return response.data;
};

export const getProductSalesDetail = async (productId) => {
  const response = await api.get(`/reports/sales-ledger/${productId}`);
  return response.data;
};
