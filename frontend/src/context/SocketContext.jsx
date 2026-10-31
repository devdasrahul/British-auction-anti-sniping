import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(true);
  const activeRfqIdRef = useRef(null);
  const pollTimerRef = useRef(null);
  const previousRfqStateRef = useRef(null);
  const listenersRef = useRef({
    bid_submitted: new Set(),
    time_extended: new Set(),
    auction_closed: new Set(),
  });

  const dispatchEvent = (eventName, data) => {
    const handlers = listenersRef.current[eventName];
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in ${eventName} listener:`, err);
        }
      });
    }
  };

  const pollRfq = useCallback(async (rfqId) => {
    if (!rfqId || !user) return;
    try {
      const res = await api.get(`/rfqs/${rfqId}`);
      const current = res.data;
      const prev = previousRfqStateRef.current;

      if (prev && prev.id === current.id) {
        // 1. Detect Time Extension
        if (prev.bidCloseTime && current.bidCloseTime && prev.bidCloseTime !== current.bidCloseTime) {
          const extensionMinutes =
            current.auctionConfig?.extensionDurationMinutes ||
            Math.round((new Date(current.bidCloseTime) - new Date(prev.bidCloseTime)) / 60000);
          
          dispatchEvent('time_extended', {
            rfqId: current.id,
            previousCloseTime: prev.bidCloseTime,
            newCloseTime: current.bidCloseTime,
            extensionMinutes: extensionMinutes > 0 ? extensionMinutes : 5,
            reason: `Dynamic time extension applied (${current.auctionConfig?.triggerType || 'British Auction'})`,
          });
        }

        // 2. Detect New Bid / Rank Change
        const prevBidsCount = prev.bids?.length || 0;
        const currBidsCount = current.bids?.length || 0;
        const prevL1 = prev.bids?.[0]?.totalAmount;
        const currL1 = current.bids?.[0]?.totalAmount;

        if (currBidsCount !== prevBidsCount || prevL1 !== currL1) {
          const latestBid = current.bids?.[0] || {};
          dispatchEvent('bid_submitted', {
            rfqId: current.id,
            supplier: { name: latestBid.supplierName || 'A supplier' },
            rankings: current.bids || [],
          });
        }

        // 3. Detect Auction Closed or Force Closed
        if (prev.status !== current.status && (current.status === 'CLOSED' || current.status === 'FORCE_CLOSED')) {
          dispatchEvent('auction_closed', {
            rfqId: current.id,
            status: current.status,
            reason:
              current.status === 'FORCE_CLOSED'
                ? 'Auction reached forced close deadline.'
                : 'Bidding window concluded.',
          });
        }
      }

      previousRfqStateRef.current = current;
      setConnected(true);
    } catch {
      // Ignore transient network errors
    }
  }, [user]);

  const joinRfq = useCallback((rfqId) => {
    activeRfqIdRef.current = rfqId;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    // Initial check
    pollRfq(rfqId);

    // Poll every 3 seconds for responsive live updates without Socket.IO 404s
    pollTimerRef.current = setInterval(() => {
      pollRfq(rfqId);
    }, 3000);
  }, [pollRfq]);

  const leaveRfq = useCallback((rfqId) => {
    if (activeRfqIdRef.current === rfqId) {
      activeRfqIdRef.current = null;
      previousRfqStateRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, []);

  const onEvent = useCallback((event, handler) => {
    if (!listenersRef.current[event]) {
      listenersRef.current[event] = new Set();
    }
    listenersRef.current[event].add(handler);

    return () => {
      listenersRef.current[event]?.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      activeRfqIdRef.current = null;
      previousRfqStateRef.current = null;
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: null, connected, joinRfq, leaveRfq, onEvent }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
