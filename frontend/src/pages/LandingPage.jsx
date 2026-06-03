import { Link } from 'react-router-dom';
import {
  Flame,
  Shield,
  BarChart2,
  Bell,
  Users,
  ClipboardList,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: Flame,
    title: 'Inventory Management',
    description:
      'Track every fire extinguisher across all your premises with full lifecycle visibility.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    icon: ClipboardList,
    title: 'Inspection Scheduling',
    description:
      'Assign inspectors and schedule periodic checks to ensure nothing is missed.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: Shield,
    title: 'Compliance Monitoring',
    description:
      'Stay audit-ready with automated compliance tracking and detailed activity logs.',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    icon: BarChart2,
    title: 'Real-Time Reports',
    description:
      'Generate and export comprehensive PDF and CSV reports with a single click.',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description:
      'Receive automated alerts for expiring equipment, overdue inspections, and more.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    description:
      'Separate portals for admins, inspectors, and users — everyone sees only what they need.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
];

const roles = [
  {
    role: 'Admin',
    gradient: 'from-purple-600 to-purple-800',
    badge: 'bg-purple-100 text-purple-800',
    items: [
      'Manage all users & roles',
      'Full CRUD on extinguishers',
      'View all reports & analytics',
      'Configure & control everything',
    ],
  },
  {
    role: 'Inspector',
    gradient: 'from-blue-600 to-blue-800',
    badge: 'bg-blue-100 text-blue-800',
    items: [
      'Conduct & log inspections',
      'Record maintenance activities',
      'Update equipment status',
      'Schedule upcoming visits',
    ],
  },
  {
    role: 'User',
    gradient: 'from-green-600 to-green-800',
    badge: 'bg-green-100 text-green-800',
    items: [
      'View equipment status',
      'Schedule inspections',
      'View inspection history',
      'Receive safety alerts',
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-navy-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-fire-600 p-1.5 rounded-lg">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">
              TZW <span className="text-fire-500">LTD</span>
            </span>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-navy-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* Pill badge */}
          <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            🔥 Fire Safety Management System
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Keep Your Premises{' '}
            <span className="text-fire-500">Safe & Compliant</span>
          </h1>

          <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            A powerful, role-based platform to manage fire extinguisher
            inventories, schedule inspections, track compliance, and generate
            instant reports — all in one place.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
            <Link
              to="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 text-base px-8 py-3"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-base px-8 py-3 rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors font-medium"
            >
              Sign In
            </Link>
          </div>

          {/* Check marks */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-300">
            {[
              'No credit card required',
              'Role-based access',
              'Real-time reports',
              'PDF & CSV exports',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Designed for fire safety professionals who need reliable,
              comprehensive management tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description, color, bg }) => (
              <div
                key={title}
                className="card p-6 hover:shadow-md transition-shadow"
              >
                <div
                  className={`inline-flex p-3 rounded-xl ${bg} mb-4`}
                >
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3 className="text-lg font-semibold text-navy-900 mb-2">
                  {title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-4">
              A Portal for Every Role
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Each team member gets a tailored experience with exactly the
              permissions they need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map(({ role, gradient, badge, items }) => (
              <div
                key={role}
                className={`bg-gradient-to-br ${gradient} rounded-2xl p-7 text-white shadow-lg`}
              >
                <span
                  className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4 ${badge}`}
                >
                  {role}
                </span>
                <h3 className="text-xl font-bold mb-5">{role} Portal</h3>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/80" />
                      <span className="text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-navy-900 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Join TZW LTD and take control of your fire safety compliance today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 text-base px-8 py-3"
            >
              Create an Account
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 text-base px-8 py-3 rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors font-medium"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-fire-600 p-1.5 rounded-lg">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm">
              TZW <span className="text-fire-500">LTD</span>
            </span>
          </Link>
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} TZW LTD. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
