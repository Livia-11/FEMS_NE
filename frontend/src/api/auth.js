import client from './client';

export const login          = (data)   => client.post('/auth/login', data);
export const register       = (data)   => client.post('/auth/register', data);
export const verifyEmail    = (data)   => client.post('/auth/verify-email', data);
export const resendOtp      = (data)   => client.post('/auth/resend-otp', data);
export const logout         = ()       => client.post('/auth/logout');
export const getMe          = ()       => client.get('/auth/me');
export const forgotPassword = (data)   => client.post('/auth/forgot-password', data);
export const resetPassword  = (data)   => client.post('/auth/reset-password', data);
export const changePassword = (data)   => client.put('/auth/change-password', data);
