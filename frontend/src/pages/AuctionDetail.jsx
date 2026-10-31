import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';
import BidTable from '../components/BidTable';
import BidTrendChart from '../components/BidTrendChart';
import CostBreakdownChart from '../components/CostBreakdownChart';
import AuctionTimeline from '../components/AuctionTimeline';
import { safeFormat, formatCurrency } from '../utils/date';

const TRIGGER_DESCRIPTIONS = {
  ANY_BID: 'Any new bid placed in the last X minutes triggers an extension.',
  L1_ONLY: 'Only a new lowest bidder (L1 change) in the last X minutes triggers an extension.',
  ALL_PARTICIPANTS: 'A bid triggers an extension ONLY IF all invited suppliers have placed at least one bid.',
};

export default function AuctionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { joinRfq, leaveRfq, onEvent } = useSocket();

  const [rfq, setRfq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'analytics'

  const [bidForm, setBidForm] = useState({
    carrierName: '',
    freightCharges: '',
    originCharges: '0',
    destinationCharges: '0',
    transitTime: '',
    quoteValidity: '',
  });

  const fetchRfq = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rfqs/${id}`);
      setRfq(res.data);
    } catch (err) {
      console.error('Failed to load RFQ', err);
      toast.error('Failed to load RFQ details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRfq();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    joinRfq(id);

    const unsubBid = onEvent('bid_placed', (data) => {
      if (data.rfqId !== id) return;
      setRfq((prev) => {
        if (!prev) return prev;
        const exists = prev.bids?.some((b) => b.id === data.bid.id);
        const updatedBids = exists
          ? prev.bids.map((b) => (b.id === data.bid.id ? data.bid : b))
          : [data.bid, ...(prev.bids || [])];
        return {
          ...prev,
          bids: updatedBids.sort((a, b) => a.rank - b.rank),
        };
      });
      toast.success(`New quote placed by ${data.bid.supplier?.name || 'a supplier'}!`);
    });

    const unsubExtend = onEvent('auction_extended', (data) => {
      if (data.rfqId !== id) return;
      setRfq((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bidCloseTime: data.newCloseTime,
          activityLogs: [
            {
              id: `ext-${Date.now()}`,
              eventType: 'TIME_EXTENDED',
              description: `Auction extended by ${data.extensionMinutes} min. Reason: ${data.reason}`,
              previousCloseTime: data.previousCloseTime,
              newCloseTime: data.newCloseTime,
              createdAt: new Date().toISOString(),
            },
            ...(prev.activityLogs || []),
          ],
        };
      });

      toast(`⚡ British Auction Extended!\n${data.reason}`, {
        icon: '⏰',
        duration: 6000,
        style: {
          background: '#fff7ed',
          color: '#c2410c',
          border: '1px solid #fdba74',
          fontWeight: 600,
        },
      });
    });

    const unsubClose = onEvent('auction_closed', (data) => {
      if (data.rfqId !== id) return;
      setRfq((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: data.status,
          activityLogs: [
            {
              id: `cls-${Date.now()}`,
              eventType: data.status === 'FORCE_CLOSED' ? 'FORCE_CLOSED' : 'AUCTION_CLOSED',
              description: data.reason,
              createdAt: new Date().toISOString(),
            },
            ...(prev.activityLogs || []),
          ],
        };
      });
      toast.error(`Auction Concluded: ${data.reason}`);
    });

    return () => {
      leaveRfq(id);
      unsubBid?.();
      unsubExtend?.();
      unsubClose?.();
    };
  }, [id, joinRfq, leaveRfq, onEvent]);

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    setSubmittingBid(true);

    try {
      await api.post(`/rfqs/${id}/bids`, bidForm);
      toast.success('Your quote has been placed successfully!');
      setShowBidModal(false);
      setBidForm({
        carrierName: '',
        freightCharges: '',
        originCharges: '0',
        destinationCharges: '0',
        transitTime: '',
        quoteValidity: '',
      });
      await fetchRfq();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit quote';
      toast.error(msg);
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleAwardBid = async (bidId) => {
    if (!window.confirm('Are you sure you want to award the contract to this quote?')) return;

    try {
      await api.post(`/rfqs/${id}/award`, { bid_id: bidId });
      toast.success('Contract awarded successfully!');
      fetchRfq();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to award bid');
    }
  };

  const freightVal = parseFloat(bidForm.freightCharges) || 0;
  const originVal = parseFloat(bidForm.originCharges) || 0;
  const destVal = parseFloat(bidForm.destinationCharges) || 0;
  const previewTotal = freightVal + originVal + destVal;

  const isSupplier = user?.role === 'SUPPLIER';
  const isActive = rfq?.status === 'ACTIVE';
  const myCurrentBid = rfq?.bids?.find((b) => b.supplierId === user?.id && b.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!rfq) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center gap-1.5 transition">
          ← Back to All Auctions
        </Link>
        <span className="text-xs font-mono text-gray-400">ID: {rfq.referenceId}</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{rfq.name}</h1>
              <StatusBadge status={rfq.status} />
              {rfq.isBritishAuction && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 shadow-2xs">
                  ⚡ British Auction Enabled
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Buyer: <span className="font-semibold text-gray-700">{rfq.creator?.name || rfq.createdBy?.name || 'Alice Shipper'}</span>
              {' · '}
              Pickup Date:{' '}
              <span className="font-semibold text-gray-700">
                {safeFormat(rfq.pickupServiceDate || rfq.pickup_service_date, 'dd MMMM yyyy')}
              </span>
            </p>
          </div>

          {/* Timers Banner */}
          <div className="flex items-center gap-4 flex-wrap">
            {isActive && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 text-center shadow-xs">
                <CountdownTimer targetTime={rfq.bidCloseTime || rfq.bid_close_time} label="Rolling Bid Close In" />
              </div>
            )}

            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-center shadow-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 mb-0.5">
                Forced Close (Hard Cap)
              </p>
              <p className="text-sm font-mono font-black text-red-700">
                {safeFormat(rfq.forcedCloseTime || rfq.forced_close_time, 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* British Auction Timeline Horizon */}
      {rfq.isBritishAuction && (
        <AuctionTimeline rfq={rfq} />
      )}

      {/* Supplier Bid Callout / CTA */}
      {isSupplier && isActive && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-lg border border-indigo-700/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-yellow-400/20 text-yellow-300 rounded-lg text-sm">⚡</span>
                <h3 className="text-lg font-black tracking-tight text-white">
                  {myCurrentBid ? 'Improve Your Rank (L1 Challenge)' : 'Submit Your Competitive Quote'}
                </h3>
              </div>
              <p className="text-xs text-indigo-200 max-w-md leading-relaxed">
                Underbid competitor carriers to capture the L1 position. Bids placed in the final trigger window will extend the auction time!
              </p>
              {myCurrentBid && (
                <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
                  <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                    Your Current Active Quote: <strong className="text-yellow-300 font-mono font-bold">{formatCurrency(myCurrentBid.totalCharges)}</strong>
                  </span>
                  <span className="bg-yellow-400 text-gray-950 font-black px-2.5 py-1 rounded-lg text-xs shadow-xs">
                    Current Rank: L{myCurrentBid.rank}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowBidModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-black text-xs px-6 py-3.5 rounded-2xl shadow-lg transition duration-150 transform hover:-translate-y-0.5 active:scale-95 shrink-0 flex items-center gap-2"
            >
              <span>{myCurrentBid ? 'Submit Lower Quote 📉' : 'Place Initial Quote 🚀'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs for Content */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'leaderboard'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span>📋 Quotes & Leaderboard</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${activeTab === 'leaderboard' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {rfq.bids?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span>📊 Visual Analytics & Price Trends</span>
          <span className="text-[10px] bg-purple-100 text-purple-700 font-black px-1.5 py-0.5 rounded-md">
            Charts
          </span>
        </button>
      </div>

      {/* 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Main View based on Tab */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'leaderboard' ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">
                    Supplier Leaderboard (Rankings)
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bids sorted by total price ascending (L1 = lowest price winner).
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded-full">
                  {rfq.bids?.length || 0} quotes submitted
                </span>
              </div>

              <BidTable
                bids={rfq.bids}
                rfqStatus={rfq.status}
                awardedBidId={rfq.awardedBidId}
                onAwardBid={handleAwardBid}
                isBuyer={user?.role === 'BUYER'}
              />

              {/* Quick teaser link to analytics */}
              {rfq.bids?.length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">Want to inspect reverse auction cost trends?</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View Price Trend & Component Analysis</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <BidTrendChart bids={rfq.bids || []} />
              <CostBreakdownChart bids={rfq.bids || []} />
            </div>
          )}
        </div>

        {/* Right 1 Col: Auction Config + Activity Log */}
        <div className="space-y-6">
          {/* British Auction Config Card */}
          {rfq.isBritishAuction && rfq.auctionConfig && (
            <div className="bg-white rounded-3xl border border-purple-200 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-600 font-bold">⚡</span>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Auction Configuration
                </h3>
              </div>

              <div className="space-y-3 text-xs divide-y divide-gray-100">
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Trigger Window (X):</span>
                  <span className="font-extrabold text-gray-800">
                    Last {rfq.auctionConfig.triggerWindowMinutes} Minutes
                  </span>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Extension Duration (Y):</span>
                  <span className="font-extrabold text-purple-700">
                    +{rfq.auctionConfig.extensionDurationMinutes} Minutes per trigger
                  </span>
                </div>

                <div className="py-2">
                  <span className="text-gray-500 block mb-1">Trigger Condition:</span>
                  <span className="font-bold text-gray-800 block bg-purple-50 p-2.5 rounded-xl border border-purple-100 text-[11px] leading-relaxed">
                    {TRIGGER_DESCRIPTIONS[rfq.auctionConfig.triggerType]}
                  </span>
                </div>

                <div className="py-2 text-[11px] text-gray-500 italic">
                  🛡️ Anti-sniping guarantee: extensions are automatically capped at the Forced Close Time.
                </div>
              </div>
            </div>
          )}

          {/* Activity Log Card */}
          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Live Activity Log
              </h3>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                Real-time Feed
              </span>
            </div>

            {rfq.activityLogs?.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6">No auction activity recorded yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {rfq.activityLogs?.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-2xl text-xs border ${
                      log.eventType === 'TIME_EXTENDED'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : log.eventType === 'BID_PLACED'
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : log.eventType === 'FORCE_CLOSED'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : log.eventType === 'QUOTE_AWARDED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                      <span>{log.eventType.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {safeFormat(log.createdAt, 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{log.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bid Submission Modal */}
      {showBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {myCurrentBid ? 'Submit Lower Quote (L1 Challenge)' : 'Place Initial Quote'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter charges breakdown for {rfq.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBidModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Carrier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maersk, MSC, Hapag-Lloyd"
                  value={bidForm.carrierName}
                  onChange={(e) => setBidForm({ ...bidForm, carrierName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ocean Freight *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="30000"
                    value={bidForm.freightCharges}
                    onChange={(e) => setBidForm({ ...bidForm, freightCharges: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Origin Charges</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="2500"
                    value={bidForm.originCharges}
                    onChange={(e) => setBidForm({ ...bidForm, originCharges: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Dest. Charges</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="1500"
                    value={bidForm.destinationCharges}
                    onChange={(e) => setBidForm({ ...bidForm, destinationCharges: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-blue-900 font-bold block">Total Calculated Quote:</span>
                  <span className="text-[11px] text-blue-700">Freight + Origin + Destination</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-mono font-black text-blue-900">
                    {formatCurrency(previewTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Transit Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 18 Days"
                    value={bidForm.transitTime}
                    onChange={(e) => setBidForm({ ...bidForm, transitTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Quote Validity</label>
                  <input
                    type="date"
                    value={bidForm.quoteValidity}
                    onChange={(e) => setBidForm({ ...bidForm, quoteValidity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBid}
                  className="btn-primary text-xs py-2.5 px-6 shadow-md hover:shadow-lg transition disabled:opacity-50"
                >
                  {submittingBid ? 'Submitting Quote...' : 'Confirm & Place Quote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
