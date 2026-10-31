import React, { useState } from 'react';

export default function BidTrendChart({ bids = [] }) {
  const [hoveredBid, setHoveredBid] = useState(null);

  if (!bids || bids.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
        <p className="text-3xl mb-2">📉</p>
        <p className="text-sm font-semibold text-gray-600">No Bids Placed Yet</p>
        <p className="text-xs text-gray-400 mt-0.5">Price trend chart will appear as carriers submit quotes.</p>
      </div>
    );
  }

  // Sort bids chronologically by submitted_at to show downward price trend
  const sortedBids = [...bids].sort(
    (a, b) => new Date(a.submittedAt || a.submitted_at) - new Date(b.submittedAt || b.submitted_at)
  );

  const prices = sortedBids.map((b) => Number(b.totalCharges || b.total_charges || 0));
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice === minPrice ? 1 : maxPrice - minPrice;
  const initialPrice = prices[0];
  const lowestPrice = minPrice;
  const totalSavings = initialPrice - lowestPrice;
  const savingsPercent = initialPrice > 0 ? ((totalSavings / initialPrice) * 100).toFixed(1) : 0;

  // SVG dimensions
  const width = 540;
  const height = 180;
  const paddingX = 45;
  const paddingY = 25;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  // Calculate points
  const points = sortedBids.map((bid, i) => {
    const x = sortedBids.length === 1
      ? width / 2
      : paddingX + (i / (sortedBids.length - 1)) * chartW;
    const price = Number(bid.totalCharges || bid.total_charges || 0);
    const y = paddingY + chartH - ((price - minPrice) / priceRange) * chartH;
    return { x, y, bid, price };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = points.length > 1
    ? `M ${points[0].x},${points[0].y} ` +
      points.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ') +
      ` L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`
    : '';

  const formatCurr = (v) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📉</span>
            <h3 className="font-extrabold text-gray-900 text-sm tracking-tight">Reverse Auction Price Reduction Trend</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Track how competitive bidding lowers shipping costs.</p>
        </div>

        {totalSavings > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <span className="text-emerald-700 text-xs font-bold">Total Savings:</span>
            <span className="text-emerald-800 font-extrabold text-sm font-mono">{formatCurr(totalSavings)}</span>
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-full">
              ↓ {savingsPercent}%
            </span>
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 select-none">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeDasharray="4 4" />
          <line x1={paddingX} y1={paddingY + chartH / 2} x2={width - paddingX} y2={paddingY + chartH / 2} stroke="#f1f5f9" strokeDasharray="4 4" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" />

          {/* Y-axis labels */}
          <text x={paddingX - 8} y={paddingY + 4} textAnchor="end" className="text-[9px] fill-gray-400 font-mono">
            {formatCurr(maxPrice)}
          </text>
          <text x={paddingX - 8} y={height - paddingY + 2} textAnchor="end" className="text-[9px] fill-emerald-600 font-mono font-bold">
            {formatCurr(minPrice)}
          </text>

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#trendGradient)" />}

          {/* Line stroke */}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineStr}
              filter="url(#glow)"
            />
          )}

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isL1 = pt.price === lowestPrice;
            const isHovered = hoveredBid?.id === pt.bid.id;

            return (
              <g key={pt.bid.id || idx} className="cursor-pointer">
                {/* Outer halo */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 8 : isL1 ? 6 : 4.5}
                  fill={isL1 ? '#10b981' : '#3b82f6'}
                  className="transition-all duration-150"
                  opacity={isHovered ? 0.4 : 0.2}
                />
                {/* Core dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isL1 ? 4.5 : 3.5}
                  fill={isL1 ? '#059669' : '#1d4ed8'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredBid(pt.bid)}
                  onMouseLeave={() => setHoveredBid(null)}
                />
                {/* L1 Crown Badge */}
                {isL1 && (
                  <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-emerald-700">
                    🏆 L1
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredBid && (
          <div className="absolute top-2 right-4 bg-gray-900/90 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs shadow-lg pointer-events-none transition">
            <p className="font-bold text-gray-200">
              {hoveredBid.carrierName || hoveredBid.carrier_name}
            </p>
            <p className="text-emerald-400 font-extrabold font-mono text-sm">
              {formatCurr(hoveredBid.totalCharges || hoveredBid.total_charges)}
            </p>
            <p className="text-[10px] text-gray-400">
              Rank: L{hoveredBid.rank} · Transit: {hoveredBid.transitTime || hoveredBid.transit_time}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 px-1 border-t border-gray-100 pt-2 font-mono">
        <span>Initial Baseline Quote: {formatCurr(initialPrice)}</span>
        <span>Latest Lowest Bid (L1): <strong className="text-emerald-600">{formatCurr(lowestPrice)}</strong></span>
      </div>
    </div>
  );
}

