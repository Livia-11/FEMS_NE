import client from './client';

export const listMaintenance   = (p)     => client.get('/maintenance', { params: p });
export const getMaintenance    = (id)    => client.get(`/maintenance/${id}`);
export const createMaintenance = (data)  => client.post('/maintenance', data);
export const updateMaintenance = (id, d) => client.put(`/maintenance/${id}`, d);
export const deleteMaintenance = (id)    => client.delete(`/maintenance/${id}`);
