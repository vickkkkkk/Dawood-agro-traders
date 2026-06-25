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
