import api from './axios';

export const getPurchases = async (params = {}) => {
  const response = await api.get('/purchases', { params });
  return response.data;
};

export const createPurchase = async (data) => {
  const response = await api.post('/purchases', data);
  return response.data;
};

export const getPurchaseById = async (id) => {
  const response = await api.get(`/purchases/${id}`);
  return response.data;
};

export const getSuppliers = async (params = {}) => {
  const response = await api.get('/suppliers', { params });
  return response.data;
};

export const createSupplier = async (data) => {
  const response = await api.post('/suppliers', data);
  return response.data;
};

export const updateSupplier = async (id, data) => {
  const response = await api.put(`/suppliers/${id}`, data);
  return response.data;
};
