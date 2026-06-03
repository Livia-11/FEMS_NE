import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Flame,
  BarChart2,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import toast from 'react-hot-toast';

import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/reports';
import { listInspections } from '../api/inspections';
import { listMaintenance } from '../api/maintenance';
import { listUsers } from '../api/users';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import LoadingSpinner from '../components/LoadingSpinner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

/* ─────────────────────────── Admin Dashboard ─────────────────────────── */

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentInspections, setRecentInspections] = useState([]);
  const [recentMaintenance, setRecentMaintenance] = useState([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [maintenanceTotal, setMaintenanceTotal] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          dashRes,
          usersRes,
          inspRes,
          maintRes,
          scheduledRes,
          maintTotalRes,
        ] = await Promise.all([
          getDashboard(),
          listUsers({ limit: 1 }),
          listInspections({ limit: 5 }),
          listMaintenance({ limit: 5 }),
          listInspections({ status: 'scheduled', limit: 1 }),
          listMaintenance({ limit: 1 }),
        ]);

        setStats(dashRes.data);
        setTotalUsers(usersRes.data.pagination.total);
        setRecentInspections(inspRes.data.data);
        setRecentMaintenance(maintRes.data.data);
        setScheduledCount(scheduledRes.data.pagination.total);
        setMaintenanceTotal(maintTotalRes.data.pagination.total);
      } catch {
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) return <LoadingSpinner />;

  const inventory = stats?.inventory ?? {};
  // by_type and by_status are arrays: [{type:'CO2',count:'5'}, ...]
  const byType   = Array.isArray(inventory.by_type)   ? inventory.by_type   : [];
  const byStatus = Array.isArray(inventory.by_status) ? inventory.by_status : [];

  const STATUS_COLORS = { active:'#22c55e', inactive:'#94a3b8', expired:'#ef4444', maintenance:'#f97316', decommissioned:'#64748b' };

  const barData = {
    labels: byType.map(t => t.type),
    datasets: [{
      label: 'Count',
      data: byType.map(t => Number(t.count)),
      backgroundColor: '#dc2626',
      borderRadius: 4,
    }],
  };

  const doughnutData = {
    labels: byStatus.map(s => s.status?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())),
    datasets: [{
      data: byStatus.map(s => Number(s.count)),
      backgroundColor: byStatus.map(s => STATUS_COLORS[s.status] ?? '#94a3b8'),
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">
          System overview — everything at a glance
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          to="/users"
          className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-purple-50 border-purple-200 text-purple-700 font-medium hover:bg-purple-100 transition-colors text-sm"
        >
          <Users className="w-5 h-5" />
          Manage Users
        </Link>
        <Link
          to="/extinguishers"
          className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-medium hover:bg-red-100 transition-colors text-sm"
        >
          <Flame className="w-5 h-5" />
          Add Extinguisher
        </Link>
        <Link
          to="/reports"
          className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-blue-50 border-blue-200 text-blue-700 font-medium hover:bg-blue-100 transition-colors text-sm"
        >
          <BarChart2 className="w-5 h-5" />
          View Reports
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Active Extinguishers"
          value={inventory.total ?? 0}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pending Inspections"
          value={scheduledCount}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Overdue Inspections"
          value={stats?.overdue_inspections ?? 0}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-navy-900 mb-4">
            Extinguishers by Type
          </h2>
          {Object.keys(byType).length > 0 ? (
            <Bar data={barData} options={chartOptions} />
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">No data available.</p>
          )}
        </div>
        <div className="card p-6">
          <h2 className="text-base font-semibold text-navy-900 mb-4">
            Status Distribution
          </h2>
          {Object.keys(byStatus).length > 0 ? (
            <Doughnut data={doughnutData} options={chartOptions} />
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">No data available.</p>
          )}
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inspections */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-navy-900">
              Recent Inspections
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Serial</th>
                  <th className="table-th">Location</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInspections.length > 0 ? (
                  recentInspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-50">
                      <td className="table-td font-mono text-xs">
                        {insp.serial_number}
                      </td>
                      <td className="table-td">{insp.location}</td>
                      <td className="table-td">
                        {(insp.scheduled_date ?? insp.created_at ?? '').slice(0, 10)}
                      </td>
                      <td className="table-td">
                        <Badge status={insp.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-td text-center text-slate-400 py-8">
                      No inspections found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Maintenance */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-navy-900">
              Recent Maintenance
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Serial</th>
                  <th className="table-th">Action</th>
                  <th className="table-th">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentMaintenance.length > 0 ? (
                  recentMaintenance.map((maint) => (
                    <tr key={maint.id} className="hover:bg-slate-50">
                      <td className="table-td font-mono text-xs">
                        {maint.serial_number}
                      </td>
                      <td className="table-td">{maint.action_taken}</td>
                      <td className="table-td">
                        {(maint.date_of_maintenance ?? maint.created_at ?? '').slice(0, 10)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="table-td text-center text-slate-400 py-8">
                      No maintenance logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-red-500">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Expired
          </p>
          <p className="text-2xl font-bold text-red-600">
            {inventory.expired ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Extinguishers</p>
        </div>
        <div className="card p-5 border-l-4 border-orange-500">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Expiring Soon
          </p>
          <p className="text-2xl font-bold text-orange-600">
            {inventory.expiring_in_30_days ?? 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Within 30 days</p>
        </div>
        <div className="card p-5 border-l-4 border-purple-500">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Maintenance Logs
          </p>
          <p className="text-2xl font-bold text-purple-600">{maintenanceTotal}</p>
          <p className="text-xs text-slate-400 mt-1">Total records</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Inspector Dashboard ─────────────────────────── */

function InspectorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myInspections, setMyInspections] = useState([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [myMaintenance, setMyMaintenance] = useState([]);
  const [maintTotal, setMaintTotal] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const [inspRes, upcomingRes, overdueRes, maintRes, maintTotalRes] =
          await Promise.all([
            listInspections({ inspector_id: user.id, limit: 5 }),
            listInspections({ inspector_id: user.id, status: 'scheduled', limit: 1 }),
            listInspections({ inspector_id: user.id, status: 'overdue', limit: 1 }),
            listMaintenance({ inspector_id: user.id, limit: 5 }),
            listMaintenance({ inspector_id: user.id, limit: 1 }),
          ]);

        setMyInspections(inspRes.data.data);
        setUpcomingCount(upcomingRes.data.pagination.total);
        setOverdueCount(overdueRes.data.pagination.total);
        setMyMaintenance(maintRes.data.data);
        setMaintTotal(maintTotalRes.data.pagination.total);
      } catch {
        toast.error('Failed to load inspector dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user?.id]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Inspector Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back, {user?.first_name}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          to="/inspections"
          className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-blue-50 border-blue-200 text-blue-700 font-medium hover:bg-blue-100 transition-colors text-sm"
        >
          <ClipboardList className="w-5 h-5" />
          Schedule Inspection
        </Link>
        <Link
          to="/maintenance"
          className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-orange-50 border-orange-200 text-orange-700 font-medium hover:bg-orange-100 transition-colors text-sm"
        >
          <Wrench className="w-5 h-5" />
          Log Maintenance
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="My Upcoming Inspections"
          value={upcomingCount}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="My Overdue"
          value={overdueCount}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="My Maintenance Logs"
          value={maintTotal}
          icon={Wrench}
          color="purple"
        />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Inspections */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-navy-900">
              My Recent Inspections
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Serial</th>
                  <th className="table-th">Location</th>
                  <th className="table-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {myInspections.length > 0 ? (
                  myInspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-50">
                      <td className="table-td">
                        {(insp.scheduled_date ?? insp.created_at ?? '').slice(0, 10)}
                      </td>
                      <td className="table-td font-mono text-xs">
                        {insp.serial_number}
                      </td>
                      <td className="table-td">{insp.location}</td>
                      <td className="table-td">
                        <Badge status={insp.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="table-td text-center text-slate-400 py-8">
                      No inspections assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Maintenance */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-navy-900">
              My Recent Maintenance
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Serial</th>
                  <th className="table-th">Action Taken</th>
                </tr>
              </thead>
              <tbody>
                {myMaintenance.length > 0 ? (
                  myMaintenance.map((maint) => (
                    <tr key={maint.id} className="hover:bg-slate-50">
                      <td className="table-td">
                        {(maint.date_of_maintenance ?? maint.created_at ?? '').slice(0, 10)}
                      </td>
                      <td className="table-td font-mono text-xs">
                        {maint.serial_number}
                      </td>
                      <td className="table-td">{maint.action_taken}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="table-td text-center text-slate-400 py-8">
                      No maintenance logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── User Dashboard ────────────────────────────── */

function UserDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentInspections, setRecentInspections] = useState([]);
  const [scheduledCount, setScheduledCount] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [dashRes, inspRes, scheduledRes] = await Promise.all([
          getDashboard(),
          listInspections({ limit: 5 }),
          listInspections({ status: 'scheduled', limit: 1 }),
        ]);

        setStats(dashRes.data);
        setRecentInspections(inspRes.data.data);
        setScheduledCount(scheduledRes.data.pagination.total);
      } catch {
        toast.error('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) return <LoadingSpinner />;

  const inventory = stats?.inventory ?? {};
  const activeArr = Array.isArray(inventory.by_status) ? inventory.by_status : [];
  const activeCount = Number(activeArr.find(s => s.status === 'active')?.count ?? 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Hello, {user?.first_name}</p>
      </div>

      {/* Quick Action */}
      <div>
        <Link
          to="/inspections"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <ClipboardList className="w-4 h-4" />
          Schedule an Inspection
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Extinguishers"
          value={inventory.total ?? 0}
          icon={Flame}
          color="red"
        />
        <StatCard
          title="Active"
          value={activeCount}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Scheduled Inspections"
          value={scheduledCount}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Expiry alerts */}
      {((inventory.expired ?? 0) > 0 || (inventory.expiring_in_30_days ?? 0) > 0) && (
        <div className="space-y-3">
          {(inventory.expired ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                <strong>{inventory.expired}</strong> extinguisher
                {inventory.expired !== 1 ? 's' : ''} have expired and require
                immediate replacement.
              </span>
            </div>
          )}
          {(inventory.expiring_in_30_days ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <span>
                <strong>{inventory.expiring_in_30_days}</strong> extinguisher
                {inventory.expiring_in_30_days !== 1 ? 's' : ''} will expire
                within 30 days.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Inspections */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy-900">
            Upcoming Inspections
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th">Date</th>
                <th className="table-th">Serial</th>
                <th className="table-th">Location</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInspections.length > 0 ? (
                recentInspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-slate-50">
                    <td className="table-td">
                      {(insp.scheduled_date ?? insp.created_at ?? '').slice(0, 10)}
                    </td>
                    <td className="table-td font-mono text-xs">
                      {insp.serial_number}
                    </td>
                    <td className="table-td">{insp.location}</td>
                    <td className="table-td">
                      <Badge status={insp.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="table-td text-center text-slate-400 py-8">
                    No inspections scheduled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info card */}
      <div className="card p-5 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-700">
          Need help? Contact your administrator for access to maintenance and
          reporting tools.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── Root DashboardPage ──────────────────────────── */

export default function DashboardPage() {
  const { isAdmin, isInspector } = useAuth();

  if (isAdmin) return <AdminDashboard />;
  if (isInspector) return <InspectorDashboard />;
  return <UserDashboard />;
}
