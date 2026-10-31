import React from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, safeFormat } from '../utils/date';

const RANK_COLORS = {
  1: 'bg-emerald-50/60 border-l-4 border-emerald-500',
  2: 'bg-blue-50/40 border-l-4 border-blue-400',
  3: 'bg-amber-50/40 border-l-4 border-amber-400',
};

const RANK_BADGES = {
  1: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/80 font-black shadow-xs',
  2: 'bg-blue-100 text-blue-800 font-extrabold',
  3: 'bg-amber-100 text-amber-800 font-extrabold',
};

export default function BidTable({ bids, rfqStatus, awardedBidId, onAwardBid, isBuyer }) {
  const { user } = useAuth();

  if (!bids || bids.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="font-bold text-gray-700 text-base">No Quotes Submitted Yet</p>
        <p className="text-xs text-gray-400 mt-1">Carriers can place competitive bids while the auction is active.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-xs bg-white">
      <table className="w-full text-xs min-w-[700px]">
        <thead>
          <tr className="bg-gray-50/90 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
            <th className="px-4 py-3.5 text-left w-16">Rank</th>
            <th className="px-4 py-3.5 text-left min-w-[160px]">Supplier</th>
            <th className="px-4 py-3.5 text-left min-w-[110px]">Carrier</th>
            <th className="px-4 py-3.5 text-right">Freight</th>
            <th className="px-4 py-3.5 text-right">Origin</th>
            <th className="px-4 py-3.5 text-right">Dest.</th>
            <th className="px-4 py-3.5 text-right font-black text-gray-900">Total Quote</th>
            <th className="px-4 py-3.5 text-left">Transit</th>
            <th className="px-4 py-3.5 text-left">Valid Till</th>
            {isBuyer && <th className="px-4 py-3.5 text-center min-w-[130px]">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bids.map((bid) => {
            const supplierId = bid.supplierId || bid.supplier_id;
            const carrier = bid.carrierName || bid.carrier_name || 'Carrier';
            const freight = bid.freightCharges ?? bid.freight_charges ?? 0;
            const origin = bid.originCharges ?? bid.origin_charges ?? 0;
            const dest = bid.destinationCharges ?? bid.destination_charges ?? 0;
            const total = bid.totalCharges ?? bid.total_charges ?? (Number(freight) + Number(origin) + Number(dest));
            const transit = bid.transitTime || bid.transit_time || '—';
            const validity = bid.quoteValidity || bid.quote_validity;

            const isMe = supplierId === user?.id;
            const isAwarded = awardedBidId === bid.id;
            const rowClass = isAwarded
              ? 'bg-emerald-50/90 border-l-4 border-emerald-500'
              : RANK_COLORS[bid.rank] || 'hover:bg-blue-50/30';
            const badgeClass = RANK_BADGES[bid.rank] || 'bg-gray-100 text-gray-700';

            return (
              <tr key={bid.id} className={`${rowClass} transition`}>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] ${badgeClass}`}>
                    L{bid.rank}
                  </span>
                </td>

                <td className="px-4 py-4 font-bold text-gray-900 whitespace-nowrap">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span>{bid.supplier?.name}</span>
                    {isMe && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                        You
                      </span>
                    )}
                    {isAwarded && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs whitespace-nowrap">
                        🏆 Winner
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 text-gray-700 font-semibold whitespace-nowrap">{carrier}</td>
                <td className="px-4 py-4 text-right font-mono text-gray-700 whitespace-nowrap">{formatCurrency(freight)}</td>
                <td className="px-4 py-4 text-right font-mono text-gray-500 whitespace-nowrap">{formatCurrency(origin)}</td>
                <td className="px-4 py-4 text-right font-mono text-gray-500 whitespace-nowrap">{formatCurrency(dest)}</td>
                <td className="px-4 py-4 text-right font-mono font-black text-gray-900 text-sm whitespace-nowrap">
                  {formatCurrency(total)}
                </td>
                <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{transit}</td>
                <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                  {safeFormat(validity, 'dd/MM/yyyy')}
                </td>

                {isBuyer && (
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {isAwarded ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-xs bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 whitespace-nowrap">
                        ✓ Awarded
                      </span>
                    ) : rfqStatus !== 'AWARDED' ? (
                      <button
                        type="button"
                        onClick={() => onAwardBid(bid.id)}
                        className="btn-primary text-xs py-1.5 px-3.5 shadow-xs hover:shadow-md transition active:scale-95 whitespace-nowrap"
                      >
                        Award Contract
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
