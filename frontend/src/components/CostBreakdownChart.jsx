import React from 'react';

export default function CostBreakdownChart({ bids = [] }) {
  if (!bids || bids.length === 0) return null;

  const activeBids = [...bids].filter((b) => b.isActive !== false);

  const formatCurr = (v) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  const maxTotal = Math.max(
    ...activeBids.map((b) => Number(b.totalCharges || b.total_charges || 0)),
    1
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="font-extrabold text-gray-900 text-sm tracking-tight">Quote Cost Component Breakdown</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Compare Freight, Origin, and Destination charges across competing carriers.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span>
            <span>Ocean Freight</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400"></span>
            <span>Origin Charges</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-violet-400"></span>
            <span>Dest. Charges</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeBids.map((bid) => {
          const freight = Number(bid.freightCharges || bid.freight_charges || 0);
          const origin = Number(bid.originCharges || bid.origin_charges || 0);
          const dest = Number(bid.destinationCharges || bid.destination_charges || 0);
          const total = Number(bid.totalCharges || bid.total_charges || (freight + origin + dest));
          const carrier = bid.carrierName || bid.carrier_name || 'Carrier';
          const supplier = bid.supplier?.name || 'Supplier';

          const freightPct = total > 0 ? (freight / total) * 100 : 0;
          const originPct = total > 0 ? (origin / total) * 100 : 0;
          const destPct = total > 0 ? (dest / total) * 100 : 0;
          const widthPct = (total / maxTotal) * 100;

          const isL1 = bid.rank === 1;

          return (
            <div key={bid.id} className="group">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-extrabold text-[10px] ${
                      isL1 ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    L{bid.rank}
                  </span>
                  <span className="font-bold text-gray-900">{carrier}</span>
                  <span className="text-gray-400 text-[11px]">({supplier})</span>
                  {isL1 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Lowest Price Leader
                    </span>
                  )}
                </div>
                <div className="text-right font-mono font-extrabold text-gray-900 text-sm">
                  {formatCurr(total)}
                </div>
              </div>

              {/* Stacked Progress Bar */}
              <div className="w-full bg-gray-100 rounded-lg h-5 overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${(freightPct * widthPct) / 100}%` }}
                  className="bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  title={`Freight: ${formatCurr(freight)}`}
                >
                  {freightPct > 15 && `${Math.round(freightPct)}%`}
                </div>
                <div
                  style={{ width: `${(originPct * widthPct) / 100}%` }}
                  className="bg-amber-400 hover:bg-amber-500 transition-all flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  title={`Origin: ${formatCurr(origin)}`}
                >
                  {originPct > 15 && `${Math.round(originPct)}%`}
                </div>
                <div
                  style={{ width: `${(destPct * widthPct) / 100}%` }}
                  className="bg-violet-400 hover:bg-violet-500 transition-all flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  title={`Destination: ${formatCurr(dest)}`}
                >
                  {destPct > 15 && `${Math.round(destPct)}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

