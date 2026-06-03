const colorMap = {
  // status → tailwind classes
  active:            'bg-green-100 text-green-700',
  pass:              'bg-green-100 text-green-700',
  completed:         'bg-green-100 text-green-700',

  expired:           'bg-red-100 text-red-700',
  fail:              'bg-red-100 text-red-700',
  overdue:           'bg-red-100 text-red-700',

  maintenance:       'bg-orange-100 text-orange-700',
  in_progress:       'bg-orange-100 text-orange-700',
  needs_maintenance: 'bg-orange-100 text-orange-700',

  inactive:          'bg-gray-100 text-gray-600',
  cancelled:         'bg-gray-100 text-gray-600',

  scheduled:         'bg-blue-100 text-blue-700',

  decommissioned:    'bg-slate-100 text-slate-600',

  admin:             'bg-purple-100 text-purple-700',
  inspector:         'bg-blue-100 text-blue-700',
  user:              'bg-teal-100 text-teal-700',
};

const fallback = 'bg-gray-100 text-gray-600';

export default function Badge({ status }) {
  if (!status) return null;

  const key   = status.toLowerCase();
  const color = colorMap[key] ?? fallback;
  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
