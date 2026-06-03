import client from './client';

export const listNotifications  = (p)    => client.get('/notifications', { params: p });
export const getUnreadCount     = ()     => client.get('/notifications/unread-count');
export const markRead           = (id)   => client.patch(`/notifications/${id}/read`);
export const markAllRead        = ()     => client.patch('/notifications/read-all');
export const sendNotification   = (data) => client.post('/notifications/send', data);
export const deleteNotification = (id)   => client.delete(`/notifications/${id}`);
