import client from './client';

export const listUsers       = (params) => client.get('/users', { params });
export const getUser         = (id)     => client.get(`/users/${id}`);
export const createUser      = (data)   => client.post('/users', data);
export const updateUser      = (id, d)  => client.put(`/users/${id}`, d);
export const deleteUser      = (id)     => client.delete(`/users/${id}`);
export const activateUser    = (id)     => client.patch(`/users/${id}/activate`);
export const deactivateUser  = (id)     => client.patch(`/users/${id}/deactivate`);
export const updateProfile   = (data)   => client.put('/users/me/profile', data);
export const listInspectors  = ()       => client.get('/users/inspectors/list');
