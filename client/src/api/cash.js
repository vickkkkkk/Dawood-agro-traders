import api from './axios';

export const getCashSummary = async () => {
  const response = await api.get('/cash/summary');
  return response.data;
};

export const getCashLedger = async (params = {}) => {
  const response = await api.get('/cash/ledger', { params });
  return response.data;
};

export const getCashTransactions = async (params = {}) => {
  const response = await api.get('/cash/transactions', { params });
  return response.data;
};

export const createCashTransaction = async (data) => {
  const response = await api.post('/cash/transactions', data);
  return response.data;
};

export const getExpenses = async (params = {}) => {
  const response = await api.get('/cash/expenses', { params });
  return response.data;
};

export const deleteExpense = async (id) => {
  const response = await api.delete(`/cash/expenses/${id}`);
  return response.data;
};

