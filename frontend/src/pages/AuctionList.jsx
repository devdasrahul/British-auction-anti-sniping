import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';
import { safeFormat, formatCurrency } from '../utils/date';

export default function AuctionList() {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const { user } = useAuth();

  const isBuyer = user?.role === 'BUYER';

  useEffect(() => {
    fetchRfqs();
  }, [statusFilter]);

  const fetchRfqs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/rfqs', { params });
      setRfqs(res.data);
    } catch (err) {
      console.error('Failed to load RFQs', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRfqs = rfqs.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (r.name || '').toLowerCase();
    const ref = (r.referenceId || r.reference_id || '').toLowerCase();
    return name.includes(q) || ref.includes(q);
  });

  const totalCount = rfqs.length;
  const activeCount = rfqs.filter((r) => r.status === 'ACTIVE').length;
  const awardedCount = rfqs.filter((r) => r.status === 'AWARDED').length;
  const totalBidsCount = rfqs.reduce((acc, r) => acc + (r.activeBidCount ?? r.active_bid_count ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl text-lg font-bold">⚡</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">British Auction RFQs</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">
            {isBuyer
              ? 'Create logistics freight requests and evaluate dynamic supplier bids in real-time.'
              : 'Submit competitive quotes and underbid competitors to win freight contracts.'}
          </p>
        </div>

        {isBuyer && (
          <Link
            to="/rfq/create"
            className="btn-primary flex items-center justify-center gap-2 text-sm py-3 px-6 shadow-md hover:shadow-lg transition transform hover:-translate-y-0.5 active:scale-95 shrink-0"
          >
            <span>+</span>
            <span>Create New RFQ</span>
          </Link>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total RFQs</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalCount}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Freight shipments</p>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-xs bg-blue-50/20">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Active Auctions</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-2xl font-black text-blue-900">{activeCount}</p>
          </div>
          <p className="text-[11px] text-blue-500 mt-0.5">Accepting quotes</p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs bg-indigo-50/20">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Quotes Placed</p>
          <p className="text-2xl font-black text-indigo-900 mt-1">{totalBidsCount}</p>
          <p className="text-[11px] text-indigo-500 mt-0.5">Carrier submissions</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs bg-emerald-50/20">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Contracts Awarded</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{awardedCount}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Successfully closed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'All', value: '' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Upcoming', value: 'UPCOMING' },
            { label: 'Closed', value: 'CLOSED' },
            { label: 'Force Closed', value: 'FORCE_CLOSED' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by RFQ name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 pl-4 pr-10 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-xs"
          />
          <span className="absolute right-3 top-2.5 text-gray-400 text-xs">🔍</span>
        </div>
      </div>

      {/* RFQ Listing Table */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-xs text-gray-400 font-semibold">Loading RFQ auctions...</p>
        </div>
      ) : filteredRfqs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
          <p className="text-gray-500 text-base font-bold">No RFQ Auctions Found</p>
          <p className="text-xs text-gray-400 mt-1">
            {isBuyer ? 'Create your first British Auction RFQ to invite suppliers.' : 'No active freight auctions currently match your filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/90 border-b border-gray-200 text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4">RFQ Name & ID</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Current Lowest (L1)</th>
                  <th className="px-6 py-4">Bid Close Time</th>
                  <th className="px-6 py-4">Forced Close</th>
                  <th className="px-6 py-4 text-center">Bids</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-center min-w-[140px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRfqs.map((rfq) => {
                  const refId = rfq.referenceId || rfq.reference_id;
                  const lowestBid = rfq.currentLowestBid ?? rfq.current_lowest_bid;
                  const bidClose = rfq.bidCloseTime || rfq.bid_close_time;
                  const forcedClose = rfq.forcedCloseTime || rfq.forced_close_time;
                  const bidCount = rfq.activeBidCount ?? rfq.active_bid_count ?? 0;
                  const isBritish = rfq.isBritishAuction ?? rfq.is_british_auction;
                  const isClosed = rfq.status === 'CLOSED' || rfq.status === 'FORCE_CLOSED' || rfq.status === 'AWARDED';

                  return (
                    <tr key={rfq.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-gray-900 text-sm">{rfq.name}</div>
                        <div className="text-xs font-mono text-gray-400 mt-0.5">
                          {refId}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={rfq.status} />
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {lowestBid ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-black text-emerald-700 text-sm font-mono">
                              {formatCurrency(lowestBid)}
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
                              L1
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">No bids yet</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {rfq.status === 'ACTIVE' && bidClose ? (
                          <CountdownTimer targetTime={bidClose} label="" />
                        ) : isClosed ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            {safeFormat(bidClose, 'dd MMM, HH:mm')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600 font-medium">
                            {safeFormat(bidClose, 'dd MMM, HH:mm')}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-red-600 font-bold whitespace-nowrap">
                        {safeFormat(forcedClose, 'dd MMM, HH:mm')}
                      </td>

                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-extrabold text-xs">
                          {bidCount}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {isBritish ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                            ⚡ British
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Standard</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <Link
                          to={`/rfq/${rfq.id}`}
                          className="btn-primary text-xs py-2 px-4 shadow-xs hover:shadow transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                        >
                          <span>View Details</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
