import api from './axios';

export const getCreditSummary = async (params = {}) => {
  const response = await api.get('/credits/summary', { params });
  return response.data;
};

export const getCustomerCredits = async (customerId) => {
  const response = await api.get(`/credits/customer/${customerId}`);
  return response.data;
};

export const recordPayment = async (data) => {
  const response = await api.post('/credits/payment', data);
  return response.data;
};

export const recordPayback = async (data) => {
  const response = await api.post('/credits/payback', data);
  return response.data;
};

export const getOverdue = async () => {
  const response = await api.get('/credits/overdue');
  return response.data;
};
