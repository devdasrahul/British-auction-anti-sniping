import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

const EXTENSION_TRIGGERS = [
  {
    value: 'BID_RECEIVED',
    label: 'Bid Received in Last X Minutes',
    desc: 'If any supplier submits a new bid during the trigger window, the auction extends by Y minutes.',
  },
  {
    value: 'ANY_RANK_CHANGE',
    label: 'Any Supplier Rank Change in Last X Minutes',
    desc: 'If any change in supplier ranking occurs during the trigger window, the auction extends by Y minutes.',
  },
  {
    value: 'L1_RANK_CHANGE',
    label: 'Lowest Bidder (L1) Rank Change in Last X Minutes',
    desc: 'The auction extends only when the lowest-priced supplier changes in the trigger window.',
  },
];

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    bidStartTime: '',
    bidCloseTime: '',
    forcedCloseTime: '',
    pickupServiceDate: '',
    isBritishAuction: true,
    supplierIds: [],
    auctionConfig: {
      triggerWindowMinutes: 10,
      extensionDurationMinutes: 5,
      triggerType: 'BID_RECEIVED',
    },
  });

  useEffect(() => {
    // Fetch registered suppliers to invite
    api.get('/rfqs/suppliers')
      .then((res) => {
        setSuppliers(res.data);
        // By default select all existing suppliers for convenience
        setForm((prev) => ({
          ...prev,
          supplierIds: res.data.map((s) => s.id),
        }));
      })
      .catch(() => {
        toast.error('Unable to fetch suppliers list');
      });
  }, []);

  const toggleSupplier = (id) => {
    setForm((prev) => ({
      ...prev,
      supplierIds: prev.supplierIds.includes(id)
        ? prev.supplierIds.filter((sId) => sId !== id)
        : [...prev.supplierIds, id],
    }));
  };

  const setConfigValue = (field, val) => {
    setForm((prev) => ({
      ...prev,
      auctionConfig: {
        ...prev.auctionConfig,
        [field]: val,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      return toast.error('RFQ Name is mandatory');
    }
    if (!form.bidStartTime || !form.bidCloseTime || !form.forcedCloseTime || !form.pickupServiceDate) {
      return toast.error('All date and time specifications are required');
    }

    const start = new Date(form.bidStartTime);
    const close = new Date(form.bidCloseTime);
    const forced = new Date(form.forcedCloseTime);

    if (close <= start) {
      return toast.error('Bid Close Time must be after Bid Start Time');
    }
    if (forced <= close) {
      return toast.error('Validation Rule: Forced Bid Close Time must always be greater than Bid Close Time');
    }
    if (form.supplierIds.length === 0) {
      return toast.error('Please invite at least one supplier to the RFQ');
    }

    setLoading(true);
    try {
      const res = await api.post('/rfqs', form);
      toast.success('British Auction RFQ created successfully!');
      navigate(`/rfq/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create RFQ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">
          Create New Logistics RFQ
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Define freight parameters, invite carriers, and configure British Auction anti-sniping parameters.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic RFQ Details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">
            1. Core RFQ Parameters
          </h2>

          <div>
            <label className="label">RFQ Name / Reference Identifier *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Shanghai to Rotterdam Ocean Freight - 40ft HC"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Bid Start Date & Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={form.bidStartTime}
                onChange={(e) => setForm({ ...form, bidStartTime: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Bid Close Date & Time *</label>
              <input
                type="datetime-local"
                className="input"
                value={form.bidCloseTime}
                onChange={(e) => setForm({ ...form, bidCloseTime: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label text-red-700 font-bold">
                Forced Bid Close Date & Time * (Hard Limit)
              </label>
              <input
                type="datetime-local"
                className="input border-red-300 focus:ring-red-500"
                value={form.forcedCloseTime}
                onChange={(e) => setForm({ ...form, forcedCloseTime: e.target.value })}
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Rule: Must be strictly later than Bid Close Time. Auction will terminate unconditionally here.
              </p>
            </div>

            <div>
              <label className="label">Pickup / Service Date *</label>
              <input
                type="date"
                className="input"
                min={new Date().toISOString().split('T')[0]}
                value={form.pickupServiceDate}
                onChange={(e) => setForm({ ...form, pickupServiceDate: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: British Auction Configurations */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span>⚡</span> 2. British Auction Extension Rules
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Dynamic bid-time extensions to encourage fair competition and prevent snipe manipulation.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isBritishAuction}
                onChange={(e) => setForm({ ...form, isBritishAuction: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {form.isBritishAuction && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl">
                  <label className="label text-purple-900 font-bold">
                    Trigger Window (X Minutes)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max="120"
                      value={form.auctionConfig.triggerWindowMinutes}
                      onChange={(e) => setConfigValue('triggerWindowMinutes', e.target.value)}
                      required
                    />
                    <span className="text-xs font-semibold text-gray-600">min</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Monitors activity happening within the last X minutes before auction close.
                  </p>
                </div>

                <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl">
                  <label className="label text-purple-900 font-bold">
                    Extension Duration (Y Minutes)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max="120"
                      value={form.auctionConfig.extensionDurationMinutes}
                      onChange={(e) => setConfigValue('extensionDurationMinutes', e.target.value)}
                      required
                    />
                    <span className="text-xs font-semibold text-gray-600">min</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Extra time added to the current close time when an extension trigger fires.
                  </p>
                </div>
              </div>

              <div>
                <label className="label font-bold text-gray-800 mb-2">
                  Extension Trigger Condition
                </label>
                <div className="space-y-2.5">
                  {EXTENSION_TRIGGERS.map((trigger) => (
                    <label
                      key={trigger.value}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                        form.auctionConfig.triggerType === trigger.value
                          ? 'border-purple-500 bg-purple-50/80 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value={trigger.value}
                        checked={form.auctionConfig.triggerType === trigger.value}
                        onChange={(e) => setConfigValue('triggerType', e.target.value)}
                        className="mt-1 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-gray-900">{trigger.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{trigger.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Select Suppliers */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              3. Invite Verified Suppliers
            </h2>
            <span className="text-xs font-bold text-primary-600">
              {form.supplierIds.length} carriers selected
            </span>
          </div>

          {suppliers.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No registered suppliers found in the system.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suppliers.map((s) => {
                const isSelected = form.supplierIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSupplier(s.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900">{s.name}</p>
                      <p className="text-[11px] text-gray-500">{s.email}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-primary-600 focus:ring-primary-500 pointer-events-none"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-secondary py-2 px-5 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-600 hover:from-blue-700 hover:to-primary-700 text-white py-3 px-8 text-xs font-black rounded-2xl shadow-lg transition duration-150 transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating RFQ Auction...' : 'Publish British Auction RFQ 🚀'}
          </button>
        </div>
      </form>
    </div>
  );
}
