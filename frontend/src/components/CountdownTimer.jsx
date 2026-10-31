import { useState, useEffect } from 'react';
import { differenceInSeconds, intervalToDuration } from 'date-fns';

export default function CountdownTimer({ targetTime, label = 'Closes in', onExpire, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!targetTime) return;

    const tick = () => {
      const target = new Date(targetTime);
      if (isNaN(target.getTime())) {
        setTimeLeft(null);
        return;
      }

      const now = new Date();
      const diff = differenceInSeconds(target, now);

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(null);
        onExpire?.();
        return;
      }

      const duration = intervalToDuration({ start: now, end: target });
      setTimeLeft(duration);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime, onExpire]);

  if (expired) {
    return (
      <div className={`text-red-600 font-semibold ${className}`}>
        Auction Ended
      </div>
    );
  }

  if (!timeLeft) return null;

  const pad = (n) => String(n || 0).padStart(2, '0');
  const isUrgent = (timeLeft.hours === 0 || !timeLeft.hours) && (timeLeft.minutes || 0) <= 10;

  return (
    <div className={className}>
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className={`flex items-center gap-1 font-mono text-lg font-bold ${isUrgent ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
        {timeLeft.hours > 0 && <span>{pad(timeLeft.hours)}h </span>}
        <span>{pad(timeLeft.minutes)}m </span>
        <span>{pad(timeLeft.seconds)}s</span>
      </div>
    </div>
  );
}
