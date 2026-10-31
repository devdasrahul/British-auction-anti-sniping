import React from 'react';
import { format } from 'date-fns';

const EVENT_CONFIG = {
  RFQ_CREATED: { icon: '📋', color: 'text-blue-700', bg: 'bg-blue-100', title: 'RFQ Created' },
  AUCTION_STARTED: { icon: '🚀', color: 'text-emerald-700', bg: 'bg-emerald-100', title: 'Auction Started' },
  BID_SUBMITTED: { icon: '💰', color: 'text-indigo-700', bg: 'bg-indigo-100', title: 'Bid Submitted' },
  RANK_CHANGED: { icon: '🔄', color: 'text-purple-700', bg: 'bg-purple-100', title: 'Rank Shift' },
  L1_CHANGED: { icon: '🏆', color: 'text-amber-700', bg: 'bg-amber-100', title: 'New Leader (L1)' },
  TIME_EXTENDED: { icon: '⏰', color: 'text-orange-700', bg: 'bg-orange-100', title: 'Time Extended' },
  AUCTION_CLOSED: { icon: '🏁', color: 'text-gray-700', bg: 'bg-gray-200', title: 'Auction Closed' },
  FORCE_CLOSED: { icon: '🛑', color: 'text-red-700', bg: 'bg-red-100', title: 'Forced Close' },
};

const safeFormat = (val, fmt) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : format(d, fmt);
};

export default function ActivityLog({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        No auction activity recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
      {logs.map((log) => {
        const eventType = log.eventType || log.event_type;
        const config = EVENT_CONFIG[eventType] || {
          icon: '📌',
          color: 'text-gray-700',
          bg: 'bg-gray-100',
          title: eventType || 'Event',
        };

        const prevTime = log.previousCloseTime || log.previous_close_time;
        const newTime = log.newCloseTime || log.new_close_time;
        const createdAt = log.createdAt || log.created_at;

        return (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white shadow-xs hover:border-gray-200 transition"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm ${config.bg}`}
            >
              {config.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                  {config.title}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {safeFormat(createdAt, 'HH:mm:ss')}
                </span>
              </div>

              <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                {log.description}
              </p>

              {prevTime && newTime && (
                <div className="mt-1.5 p-1.5 bg-orange-50 border border-orange-100 rounded text-[11px] text-orange-800 flex items-center gap-1.5">
                  <span>Extended from:</span>
                  <span className="font-mono line-through text-gray-500">
                    {safeFormat(prevTime, 'HH:mm:ss')}
                  </span>
                  <span>→</span>
                  <span className="font-mono font-bold text-orange-700">
                    {safeFormat(newTime, 'HH:mm:ss')}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
