import client from './client';

export const listInspections   = (p)     => client.get('/inspections', { params: p });
export const getInspection     = (id)    => client.get(`/inspections/${id}`);
export const createInspection  = (data)  => client.post('/inspections', data);
export const updateInspection  = (id, d) => client.put(`/inspections/${id}`, d);
export const deleteInspection  = (id)    => client.delete(`/inspections/${id}`);
export const markOverdue       = ()      => client.post('/inspections/overdue/mark');
