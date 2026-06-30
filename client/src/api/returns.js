import api from './axios';

export const getReturns = async (params = {}) => {
  const response = await api.get('/returns', { params });
  return response.data;
};

export const getReturnById = async (id) => {
  const response = await api.get(`/returns/${id}`);
  return response.data;
};

export const createSaleReturn = async (payload) => {
  const response = await api.post('/returns/sales', payload);
  return response.data;
};

export const createPurchaseReturn = async (payload) => {
  const response = await api.post('/returns/purchases', payload);
  return response.data;
};
