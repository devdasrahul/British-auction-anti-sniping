import React from 'react';
import { differenceInSeconds } from 'date-fns';
import { parseSafeDate, safeFormat } from '../utils/date';

export default function AuctionTimeline({ rfq }) {
  if (!rfq) return null;

  const start = parseSafeDate(rfq.bidStartTime || rfq.bid_start_time) || new Date();
  const close = parseSafeDate(rfq.bidCloseTime || rfq.bid_close_time) || new Date();
  const forced = parseSafeDate(rfq.forcedCloseTime || rfq.forced_close_time) || new Date();
  const now = new Date();

  let totalSpan = differenceInSeconds(forced, start);
  if (totalSpan <= 0) {
    totalSpan = Math.max(60, differenceInSeconds(close, start) + 900);
  }

  const elapsedSeconds = Math.max(0, differenceInSeconds(now, start));
  const progressPct = Math.min(100, Math.max(0, (elapsedSeconds / totalSpan) * 100));

  const closeSeconds = Math.max(0, differenceInSeconds(close, start));
  const closeMarkerPct = Math.min(100, Math.max(0, (closeSeconds / totalSpan) * 100));

  const windowMinutes = rfq.auctionConfig?.triggerWindowMinutes || rfq.auction_config?.trigger_window_minutes || 10;
  const triggerWindowSeconds = windowMinutes * 60;
  const triggerWindowWidthPct = Math.min(closeMarkerPct, (triggerWindowSeconds / totalSpan) * 100);
  const triggerWindowStartPct = Math.max(0, closeMarkerPct - triggerWindowWidthPct);

  const isTriggerActive = now >= new Date(close.getTime() - triggerWindowSeconds * 1000) && now <= close;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⏱️</span>
            <h3 className="font-extrabold text-gray-900 text-sm tracking-tight">British Auction Timeline & Extension Horizon</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time visual map of the bidding span, dynamic trigger zone, and forced close hard cap.
          </p>
        </div>

        {isTriggerActive && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-2xl animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold text-amber-900">
              ⚡ Trigger Window Active ({windowMinutes}m) – Underbidding Extends Auction!
            </span>
          </div>
        )}
      </div>

      {/* Progress Track */}
      <div className="relative pt-6 pb-4">
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative border border-gray-200 shadow-inner">
          {/* Active elapsed fill */}
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-l-full"
          />

          {/* Trigger Window Overlay Zone */}
          <div
            style={{
              left: `${triggerWindowStartPct}%`,
              width: `${triggerWindowWidthPct}%`,
            }}
            className="absolute top-0 bottom-0 bg-amber-400/40 border-l border-r border-amber-500/80"
            title={`Trigger Window (Last ${windowMinutes} min)`}
          />

          {/* Hard cap boundary fill */}
          <div
            style={{ left: `${closeMarkerPct}%` }}
            className="absolute top-0 bottom-0 right-0 bg-red-100/50"
            title="Anti-Sniping Buffer Zone"
          />
        </div>

        {/* Dynamic Markers */}
        {/* Rolling Close Marker */}
        <div
          style={{ left: `${Math.min(94, Math.max(6, closeMarkerPct))}%` }}
          className="absolute top-1 transform -translate-x-1/2 flex flex-col items-center pointer-events-none"
        >
          <div className="w-1.5 h-6 bg-orange-600 rounded-full shadow-md"></div>
          <span className="text-[10px] font-black text-orange-700 font-mono mt-1 whitespace-nowrap bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 shadow-xs">
            Close: {safeFormat(close, 'HH:mm')}
          </span>
        </div>

        {/* Forced Close Marker (End of track) */}
        <div className="absolute right-0 top-1 transform translate-x-1/2 flex flex-col items-center pointer-events-none">
          <div className="w-1.5 h-6 bg-red-600 rounded-full shadow-md"></div>
          <span className="text-[10px] font-black text-red-700 font-mono mt-1 whitespace-nowrap bg-red-50 px-2 py-0.5 rounded-md border border-red-200 shadow-xs">
            Hard Cap: {safeFormat(forced, 'HH:mm')}
          </span>
        </div>
      </div>

      {/* Legend & Summary Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block"></span>
            <span>Elapsed Time</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400/80 border border-amber-500 inline-block"></span>
            <span>Trigger Window ({windowMinutes}m)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block"></span>
            <span>Extension Ceiling</span>
          </div>
        </div>

        <div className="text-gray-400 font-mono">
          Bidding Started: <strong className="text-gray-700">{safeFormat(start, 'dd MMM, HH:mm')}</strong>
        </div>
      </div>
    </div>
  );
}
