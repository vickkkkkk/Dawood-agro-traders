import api from './axios';

export const getLiabilities = async (params = {}) => {
  const response = await api.get('/liabilities', { params });
  return response.data;
};

export const getLiabilityById = async (id) => {
  const response = await api.get(`/liabilities/${id}`);
  return response.data;
};

export const payLiability = async (id, data) => {
  const response = await api.post(`/liabilities/${id}/payments`, data);
  return response.data;
};
