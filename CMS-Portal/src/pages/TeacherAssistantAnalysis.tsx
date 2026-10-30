import { useState, useEffect } from 'react';
import { apiFetch, API_BASE_URL } from '../api';
import { io } from 'socket.io-client';

interface TaPerformanceItem {
  name: string;
  email: string;
  claimedCount: number;
  resolvedCount: number;
  successRate?: string;
  status?: string;
}

interface AnalyticsPayload {
  totalTickets: number;
  unassignedPoolCount: number;
  inProgressCount: number;
  resolvedCount: number;
  taPerformance: TaPerformanceItem[];
}

export function TeacherAssistantAnalysis() {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ success: boolean; data: AnalyticsPayload }>('/tickets/analytics');
      if (res && res.data) {
        setAnalytics(res.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to fetch TA analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();

    // Socket.io for live real-time sync with Teacher Assistant activity
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('ticket_created', () => fetchAnalyticsData());
    socket.on('ticket_updated', () => fetchAnalyticsData());
    socket.on('ticket_status_updated', () => fetchAnalyticsData());
    socket.on('ticket_closed', () => fetchAnalyticsData());

    const interval = setInterval(fetchAnalyticsData, 10000);

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const totalResolved = loading && !analytics ? '...' : analytics ? String(analytics.resolvedCount) : '—';
  const poolCount = loading && !analytics ? '...' : analytics ? String(analytics.unassignedPoolCount) : '—';
  const inProgressCount = loading && !analytics ? '...' : analytics ? String(analytics.inProgressCount) : '—';
  const avgSpeed = 'Unavailable';

  const hasOutcomeRate = Boolean(analytics?.taPerformance?.some((item) => item.successRate));
  const displayPerformers: TaPerformanceItem[] =
    analytics && analytics.taPerformance && analytics.taPerformance.length > 0
      ? analytics.taPerformance.map((item) => ({
          ...item,
          status: item.status || 'Unavailable',
        }))
      : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '40px' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Teacher Assistant Analysis
            </h2>
            <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
              Super Admin Only
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Live performance, doubt pickups, resolution speed, and workload balance across faculty and teacher assistants.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Live synced at {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Doubts Solved
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
            {totalResolved}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Verified student closures
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Available in Pool
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
            {poolCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Waiting for teacher pickup
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Solving (In Progress)
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Currently claimed by teachers
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Avg Resolution Speed
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#c084fc', marginTop: '6px' }}>
            {avgSpeed}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            From doubt pick to resolution
          </div>
        </div>
      </div>

      {/* Teacher Assistant Performance Table */}
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              Faculty &amp; Teacher Assistant Workload Tracker
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0 0' }}>
              Individual doubt pickup rates, completed solutions, and active teacher availability
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Teacher Assistant</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Email Address</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Active Claims</th>
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Doubts Solved</th>
                {hasOutcomeRate && <th style={{ padding: '14px 20px', fontWeight: 600 }}>Success Rate</th>}
                <th style={{ padding: '14px 20px', fontWeight: 600 }}>Availability</th>
              </tr>
            </thead>
            <tbody>
              {loading && displayPerformers.length === 0 ? (
                <tr>
                  <td colSpan={hasOutcomeRate ? 6 : 5} style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    Loading teacher assistant data…
                  </td>
                </tr>
              ) : displayPerformers.length === 0 ? (
                <tr>
                  <td colSpan={hasOutcomeRate ? 6 : 5} style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    No teacher assistant activity recorded yet.
                  </td>
                </tr>
              ) : (
                displayPerformers.map((ta, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 20px', color: '#ffffff', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                          {ta.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{ta.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '12px' }}>
                      {ta.email}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#38bdf8', fontWeight: 700 }}>
                      {ta.claimedCount} doubts
                    </td>
                    <td style={{ padding: '14px 20px', color: '#34d399', fontWeight: 700 }}>
                      {ta.resolvedCount} solved
                    </td>
                    {hasOutcomeRate && (
                      <td style={{ padding: '14px 20px', color: '#ffffff', fontWeight: 600 }}>
                        {ta.successRate}
                      </td>
                    )}
                    <td style={{ padding: '14px 20px' }}>
                      <span
                        style={{
                          background:
                            ta.status === 'Online'
                              ? 'rgba(34,197,94,0.15)'
                              : ta.status === 'Active'
                              ? 'rgba(56,189,248,0.15)'
                              : 'rgba(148,163,184,0.15)',
                          color: ta.status === 'Online' ? '#22c55e' : ta.status === 'Active' ? '#38bdf8' : '#94a3b8',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: ta.status === 'Online' ? '#22c55e' : ta.status === 'Active' ? '#38bdf8' : '#94a3b8',
                          }}
                        />
                        {ta.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TeacherAssistantAnalysis;
