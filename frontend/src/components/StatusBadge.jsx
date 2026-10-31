const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    classes: 'bg-gray-100 text-gray-700 border-gray-300',
    dot: null,
  },
  UPCOMING: {
    label: 'Upcoming',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  ACTIVE: {
    label: 'Active Auction',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs',
    dot: 'bg-emerald-500 animate-ping',
  },
  CLOSED: {
    label: 'Closed',
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: null,
  },
  FORCE_CLOSED: {
    label: 'Forced Close',
    classes: 'bg-red-50 text-red-700 border-red-200 font-bold',
    dot: 'bg-red-500',
  },
  AWARDED: {
    label: 'Awarded Winner',
    classes: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-extrabold shadow-xs',
    dot: null,
    icon: '🏆',
  },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
    dot: null,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition whitespace-nowrap ${config.classes}`}
    >
      {config.dot && (
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {config.icon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}
