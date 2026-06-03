import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  BarChart3, Download, FileText, FileSpreadsheet,
  Package, ClipboardList, ShieldCheck, Wrench,
  AlertTriangle, CheckCircle, Clock, XCircle,
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Badge from '../components/Badge';

import {
  getInventory,
  getInventoryDaily,
  getInventoryMonthly,
  getInventoryYearly,
  getInspections,
  getCompliance,
  getMaintenance,
  exportPDF,
  exportCSV,
} from '../api/reports';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, ArcElement,
  Tooltip, Legend,
);

const TABS = [
  { id: 'inventory',    label: 'Inventory',    Icon: Package },
  { id: 'inspections',  label: 'Inspections',  Icon: ClipboardList },
  { id: 'compliance',   label: 'Compliance',   Icon: ShieldCheck },
  { id: 'maintenance',  label: 'Maintenance',  Icon: Wrench },
];

const CHART_COLORS = {
  active:      '#16a34a',
  expired:     '#dc2626',
  maintenance: '#f97316',
  inactive:    '#6b7280',
  decommissioned: '#94a3b8',
  scheduled:   '#3b82f6',
  in_progress: '#f97316',
  completed:   '#16a34a',
  overdue:     '#dc2626',
  cancelled:   '#6b7280',
};

const DEFAULT_BAR_COLOR = '#0f172a';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '—';
  return `$${Number(val).toFixed(2)}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Shared chart options ────────────────────────────────────────────────────
const BAR_OPTIONS = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

const DOUGHNUT_OPTIONS = {
  responsive: true,
  plugins: { legend: { position: 'right' } },
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('inventory');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-fire-600" />
          Reports
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Analytics and exports for your fire safety system</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-fire-600 text-fire-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'inventory'   && <InventoryTab />}
      {activeTab === 'inspections' && <InspectionsTab />}
      {activeTab === 'compliance'  && <ComplianceTab />}
      {activeTab === 'maintenance' && <MaintenanceTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// INVENTORY TAB
// ────────────────────────────────────────────────────────────────────────────
function InventoryTab() {
  const [granularity, setGranularity] = useState('monthly');
  const [dateParam, setDateParam]     = useState(() => today().slice(0, 7)); // YYYY-MM
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Always use getInventory() for overall stats — period endpoints have different shapes
      const [overviewRes, periodRes] = await Promise.all([
        getInventory(),
        granularity === 'daily'
          ? getInventoryDaily({ date: dateParam })
          : granularity === 'monthly'
            ? getInventoryMonthly({
                year: dateParam.split('-')[0],
                month: dateParam.split('-')[1],
              })
            : getInventoryYearly({ year: dateParam }),
      ]);
      setData({ overview: overviewRes.data, period: periodRes.data });
    } catch (err) {
      toast.error(err.message ?? 'Failed to load inventory report');
    } finally {
      setLoading(false);
    }
  }, [granularity, dateParam]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExport(format, type) {
    setExporting(format);
    try {
      const res = format === 'pdf' ? await exportPDF(type) : await exportCSV(type);
      triggerDownload(res.data, `inventory-report.${format}`);
      toast.success(`Export downloaded`);
    } catch (err) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting('');
    }
  }

  // getInventory returns: { summary: { total, by_status, by_type, expired, expiring_in_30_days }, total_extinguishers }
  const summary       = data?.overview?.summary ?? {};
  const typeBreakdown   = summary.by_type ?? [];
  const statusBreakdown = summary.by_status ?? [];
  const activeCount   = statusBreakdown.find(s => s.status === 'active')?.count ?? 0;
  // Period-specific counts
  const periodData    = data?.period ?? {};
  const periodInspCount = periodData.inspections_today ?? periodData.inspections_count ?? periodData.annual_inspections ?? '—';
  const periodMaintCount = periodData.maintenance_today ?? periodData.maintenance_count ?? periodData.annual_maintenance ?? '—';

  const barData = {
    labels:   typeBreakdown.map(t => t.type ?? t.label ?? 'Unknown'),
    datasets: [{
      label: 'Count',
      data:   typeBreakdown.map(t => t.count ?? t.value ?? 0),
      backgroundColor: DEFAULT_BAR_COLOR,
      borderRadius: 4,
    }],
  };

  const doughnutData = {
    labels: statusBreakdown.map(s => {
      const k = s.status ?? s.label ?? '';
      return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }),
    datasets: [{
      data:            statusBreakdown.map(s => s.count ?? s.value ?? 0),
      backgroundColor: statusBreakdown.map(s => CHART_COLORS[s.status ?? s.label] ?? '#94a3b8'),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            {['daily', 'monthly', 'yearly'].map(g => (
              <label key={g} className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                <input
                  type="radio"
                  name="granularity"
                  value={g}
                  checked={granularity === g}
                  onChange={() => {
                    setGranularity(g);
                    if (g === 'daily')   setDateParam(today());
                    if (g === 'monthly') setDateParam(today().slice(0, 7));
                    if (g === 'yearly')  setDateParam(String(new Date().getFullYear()));
                  }}
                  className="text-fire-600 focus:ring-fire-600"
                />
                <span className="font-medium capitalize text-gray-700">{g}</span>
              </label>
            ))}
          </div>
          {granularity === 'daily'   && (
            <input type="date"  className="input" value={dateParam} onChange={e => setDateParam(e.target.value)} />
          )}
          {granularity === 'monthly' && (
            <input type="month" className="input" value={dateParam} onChange={e => setDateParam(e.target.value)} />
          )}
          {granularity === 'yearly'  && (
            <input
              type="number"
              className="input w-28"
              min="2000"
              max="2100"
              value={dateParam}
              onChange={e => setDateParam(e.target.value)}
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total"              value={summary.total ?? '—'}                    icon={Package}      color="blue"   />
            <StatCard title="Active"             value={activeCount}                              icon={CheckCircle}  color="green"  />
            <StatCard title="Expired"            value={summary.expired ?? '—'}                  icon={XCircle}      color="red"    />
            <StatCard title="Expiring in 30 Days" value={summary.expiring_in_30_days ?? '—'}     icon={AlertTriangle} color="orange" />
          </div>
          {/* Period-specific counts */}
          {(periodInspCount !== '—' || periodMaintCount !== '—') && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard title={`Inspections (${granularity})`} value={periodInspCount}  icon={ClipboardList} color="blue" />
              <StatCard title={`Maintenance (${granularity})`} value={periodMaintCount} icon={Wrench}        color="purple" />
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {typeBreakdown.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Extinguishers by Type</h3>
                <Bar data={barData} options={BAR_OPTIONS} />
              </div>
            )}
            {statusBreakdown.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Distribution</h3>
                <Doughnut data={doughnutData} options={DOUGHNUT_OPTIONS} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Exports */}
      <div className="flex gap-2">
        <button
          onClick={() => handleExport('pdf', 'inventory')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileText className="h-4 w-4" />
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
        <button
          onClick={() => handleExport('csv', 'extinguishers')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// INSPECTIONS TAB
// ────────────────────────────────────────────────────────────────────────────
function InspectionsTab() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate]     = useState(today);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInspections({
        ...(fromDate && { from_date: fromDate }),
        ...(toDate   && { to_date:   toDate }),
      });
      setData(res.data);
    } catch (err) {
      toast.error(err.message ?? 'Failed to load inspections report');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExport(format) {
    setExporting(format);
    try {
      const res = format === 'pdf' ? await exportPDF('inspections') : await exportCSV('inspections');
      triggerDownload(res.data, `inspections-report.${format}`);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting('');
    }
  }

  // getInspections returns: { scheduled: {count, data}, completed: {count, data}, overdue: {count, data} }
  const scheduledCount = data?.scheduled?.count ?? 0;
  const completedCount = data?.completed?.count ?? 0;
  const overdueCount   = data?.overdue?.count   ?? 0;
  const totalCount     = scheduledCount + completedCount + overdueCount;

  const statusBreakdown = [
    { status: 'scheduled', count: scheduledCount },
    { status: 'completed', count: completedCount },
    { status: 'overdue',   count: overdueCount },
  ].filter(s => s.count > 0);

  const barData = {
    labels:   statusBreakdown.map(s => s.status.charAt(0).toUpperCase() + s.status.slice(1)),
    datasets: [{
      label: 'Inspections',
      data:   statusBreakdown.map(s => s.count),
      backgroundColor: statusBreakdown.map(s => CHART_COLORS[s.status] ?? '#94a3b8'),
      borderRadius: 4,
    }],
  };

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} title="From date" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input" value={toDate}   onChange={e => setToDate(e.target.value)}   title="To date"   />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total"      value={totalCount}     icon={ClipboardList} color="blue"   />
            <StatCard title="Scheduled"  value={scheduledCount} icon={Clock}         color="blue"   />
            <StatCard title="Completed"  value={completedCount} icon={CheckCircle}   color="green"  />
            <StatCard title="Overdue"    value={overdueCount}   icon={AlertTriangle}  color="red"    />
          </div>

          {statusBreakdown.length > 0 && (
            <div className="card p-5 max-w-xl">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Inspections by Status</h3>
              <Bar data={barData} options={BAR_OPTIONS} />
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleExport('pdf')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileText className="h-4 w-4" />
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPLIANCE TAB
// ────────────────────────────────────────────────────────────────────────────
function ComplianceTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCompliance()
      .then(r => setData(r.data))
      .catch(err => toast.error(err.message ?? 'Failed to load compliance report'))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await exportPDF('compliance');
      triggerDownload(res.data, 'compliance-report.pdf');
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // getCompliance returns: { compliance_rate, total_extinguishers, compliant, expired: {count, data}, expiring_in_30_days: {count, data}, expiring_in_90_days: {count, data} }
  const expiredCount = data?.expired?.count ?? 0;
  const exp30Count   = data?.expiring_in_30_days?.count ?? 0;
  const exp90Count   = data?.expiring_in_90_days?.count ?? 0;
  const expired      = data?.expired?.data ?? [];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          {data?.compliance_rate && (
            <div className="card p-5 bg-green-50 border-green-200">
              <p className="text-sm font-medium text-green-700">Compliance Rate</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{data.compliance_rate}</p>
              <p className="text-xs text-green-600 mt-0.5">{data.compliant ?? 0} of {data.total_extinguishers ?? 0} extinguishers compliant</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Expired"
              value={expiredCount}
              icon={XCircle}
              color="red"
              subtitle="Require immediate action"
            />
            <StatCard
              title="Expiring in 30 Days"
              value={exp30Count}
              icon={AlertTriangle}
              color="orange"
              subtitle="Urgent attention needed"
            />
            <StatCard
              title="Expiring in 90 Days"
              value={exp90Count}
              icon={Clock}
              color="blue"
              subtitle="Plan maintenance soon"
            />
          </div>

          {expired.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Expired Extinguishers ({expired.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="table-th">Serial Number</th>
                      <th className="table-th">Location</th>
                      <th className="table-th">Type</th>
                      <th className="table-th">Expiry Date</th>
                      <th className="table-th">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expired.map(ext => (
                      <tr key={ext.id} className="hover:bg-gray-50">
                        <td className="table-td font-medium text-gray-900">{ext.serial_number}</td>
                        <td className="table-td text-gray-500">{ext.location ?? '—'}</td>
                        <td className="table-td text-gray-500 capitalize">{ext.type ?? '—'}</td>
                        <td className="table-td text-red-600 font-medium">{formatDate(ext.expiry_date)}</td>
                        <td className="table-td"><Badge status={ext.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileText className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAINTENANCE TAB
// ────────────────────────────────────────────────────────────────────────────
function MaintenanceTab() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate]     = useState(today);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMaintenance({
        ...(fromDate && { from_date: fromDate }),
        ...(toDate   && { to_date:   toDate }),
      });
      setData(res.data);
    } catch (err) {
      toast.error(err.message ?? 'Failed to load maintenance report');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExport(format) {
    setExporting(format);
    try {
      const res = format === 'pdf' ? await exportPDF('maintenance') : await exportCSV('maintenance');
      triggerDownload(res.data, `maintenance-report.${format}`);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message ?? 'Export failed');
    } finally {
      setExporting('');
    }
  }

  // getMaintenance returns: { total_activities, total_cost, most_maintained, recent_activities }
  const totalLogs = data?.total_activities ?? 0;
  const totalCost = data?.total_cost ?? null;
  const avgCost   = totalLogs > 0 && totalCost !== null
    ? (Number(totalCost) / totalLogs).toFixed(2) : null;
  const recent    = data?.recent_activities ?? [];

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} title="From date" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input" value={toDate}   onChange={e => setToDate(e.target.value)}   title="To date"   />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Logs"
              value={totalLogs}
              icon={Wrench}
              color="blue"
            />
            <StatCard
              title="Total Cost"
              value={totalCost !== null ? formatCurrency(totalCost) : '—'}
              icon={BarChart3}
              color="green"
            />
            <StatCard
              title="Avg Cost per Log"
              value={avgCost !== null ? formatCurrency(avgCost) : '—'}
              icon={BarChart3}
              color="orange"
            />
          </div>

          {recent.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Recent Maintenance Activities</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="table-th">Date</th>
                      <th className="table-th">Serial / Location</th>
                      <th className="table-th">Action Taken</th>
                      <th className="table-th">Inspector</th>
                      <th className="table-th">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recent.map(rec => (
                      <tr key={rec.id} className="hover:bg-gray-50">
                        <td className="table-td whitespace-nowrap">{formatDate(rec.date_of_maintenance)}</td>
                        <td className="table-td">
                          <p className="font-medium text-gray-900">{rec.serial_number ?? '—'}</p>
                          <p className="text-xs text-gray-400">{rec.location ?? ''}</p>
                        </td>
                        <td className="table-td max-w-[200px]">
                          <span className="line-clamp-2" title={rec.action_taken}>{rec.action_taken}</span>
                        </td>
                        <td className="table-td">
                          {rec.inspector_name ?? '—'}
                        </td>
                        <td className="table-td whitespace-nowrap font-medium">
                          {formatCurrency(rec.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleExport('pdf')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileText className="h-4 w-4" />
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={!!exporting}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </div>
  );
}
