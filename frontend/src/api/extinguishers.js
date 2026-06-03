import client from './client';

export const listExtinguishers   = (p)     => client.get('/extinguishers', { params: p });
export const getExtinguisher     = (id)    => client.get(`/extinguishers/${id}`);
export const createExtinguisher  = (data)  => client.post('/extinguishers', data);
export const updateExtinguisher  = (id, d) => client.put(`/extinguishers/${id}`, d);
export const deleteExtinguisher  = (id)    => client.delete(`/extinguishers/${id}`);
export const getStats            = ()      => client.get('/extinguishers/stats/summary');
