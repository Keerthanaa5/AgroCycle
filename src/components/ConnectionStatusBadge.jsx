import { useState, useEffect } from 'react';
import { realtimeSocketClient } from '@/services/realtimeSocketClient';
import { marketplaceService } from '@/services/marketplaceService';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionStatusBadge({ className = '' }) {
  const [status, setStatus] = useState('offline'); // 'connected' | 'reconnecting' | 'offline'

  useEffect(() => {
    // 1. Initial health ping
    marketplaceService.checkHealth().then(health => {
      if (health.connected) {
        setStatus('connected');
      } else {
        setStatus('offline');
      }
    });

    // 2. Real-time WebSocket connection state listener
    const unsub = realtimeSocketClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // 3. Periodic liveness heartbeat (every 15s)
    const interval = setInterval(() => {
      marketplaceService.checkHealth().then(health => {
        if (!health.connected && status === 'connected') {
          setStatus('offline');
        } else if (health.connected && status === 'offline') {
          setStatus('connected');
        }
      });
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const config = {
    connected: {
      label: 'CONNECTED',
      sublabel: 'Shared Live DB',
      dotClass: 'bg-emerald-500 animate-pulse',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      icon: <Wifi className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
    },
    reconnecting: {
      label: 'RECONNECTING',
      sublabel: 'Attempting Live Sync',
      dotClass: 'bg-amber-500 animate-spin',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      icon: <RefreshCw className="h-3 w-3 text-amber-600 dark:text-amber-400 animate-spin" />
    },
    offline: {
      label: 'OFFLINE',
      sublabel: 'Local Storage Mode',
      dotClass: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
      icon: <WifiOff className="h-3 w-3 text-rose-600 dark:text-rose-400" />
    }
  };

  const current = config[status] || config.offline;

  return (
    <div
      title={`Marketplace Sync Status: ${current.label} (${current.sublabel})`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide transition-colors ${current.badgeClass} ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${current.dotClass}`} />
      <span className="flex items-center gap-1 font-bold">
        {current.icon}
        <span>{current.label}</span>
      </span>
    </div>
  );
}
