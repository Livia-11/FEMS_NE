import client from './client';

export const getDashboard       = ()  => client.get('/reports/dashboard');
export const getInventory       = ()  => client.get('/reports/inventory');
export const getInventoryDaily  = (p) => client.get('/reports/inventory/daily', { params: p });
export const getInventoryMonthly= (p) => client.get('/reports/inventory/monthly', { params: p });
export const getInventoryYearly = (p) => client.get('/reports/inventory/yearly', { params: p });
export const getInspections     = (p) => client.get('/reports/inspections', { params: p });
export const getCompliance      = ()  => client.get('/reports/compliance');
export const getMaintenance     = (p) => client.get('/reports/maintenance', { params: p });

export const exportPDF = (type) =>
  client.get('/reports/export/pdf', { params: { type }, responseType: 'blob' });

export const exportCSV = (type) =>
  client.get('/reports/export/csv', { params: { type }, responseType: 'blob' });
