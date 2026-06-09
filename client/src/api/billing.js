import api from './axios';

export const createBill = async (data) => {
  const response = await api.post('/bills', data);
  return response.data;
};

export const getBills = async (params = {}) => {
  const response = await api.get('/bills', { params });
  return response.data;
};

export const getBillById = async (id) => {
  const response = await api.get(`/bills/${id}`);
  return response.data;
};

export const getDailySales = async (month, year) => {
  const response = await api.get('/bills/daily-sales', { params: { month, year } });
  return response.data;
};

export const voidBill = async (id) => {
  const response = await api.put(`/bills/${id}/void`);
  return response.data;
};

export const returnBillItem = async (id, payload) => {
  const response = await api.put(`/bills/${id}/return-item`, payload);
  return response.data;
};
