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
