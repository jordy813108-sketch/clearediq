'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Clock, CheckCircle2, TrendingUp,
  Upload, RefreshCw, ArrowRight, ArrowUpRight,
  ShieldAlert, ShieldCheck, ShieldX, MoreHorizontal,
  FileText, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { dashboardApi, receiptsApi } from '@/lib/api';
import type { DashboardStats, AnalyticsPoint, ReceiptListItem, RiskLevel } from '@/types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function riskColors(level?: RiskLevel | null) {
  switch (level) {
    case 'CRITICAL': return { bg: '#fef2f2', text: '#991b1b', border: '#fecaca', dot: '#ef4444' };
    case 'HIGH':     return { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', dot: '#f97316' };
    case 'MEDIUM':   return { bg: '#fefce8', text: '#854d0e', border: '#fde68a', dot: '#eab308' };
    case 'LOW':      return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' };
    default:         return { bg: '#f4f4f5', text: '#52525b', border: '#e4e4e7', dot: '#a1a1aa' };
  }
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    pending:    { label: 'Pending',    color: '#6366f1' },
    processing: { label: 'Processing', color: '#8b5cf6' },
    approved:   { label: 'Approved',   color: '#22c55e' },
    rejected:   { label: 'Rejected',   color: '#ef4444' },
    escalated:  { label: 'Escalated',  color: '#f97316' },
    reviewed:   { label: 'Reviewed',   color: '#06b6d4' },
  };
  return map[status] || { label: status, color: '#a1a1aa' };
}

function fmt(n?: number) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Skeleton shimmer
function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );
}

// ─── Metric card ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  href?: string;
}

function MetricCard({ label, value, sub, icon, iconBg, iconColor, loading, href }: MetricCardProps) {
  const inner = (
    <div style={{
      background: '#fff',
      border: '1px solid #f0f0f0',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      transition: 'box-shadow 0.15s, transform 0.15s',
      cursor: href ? 'pointer' : 'default',
      textDecoration: 'none',
      color: 'inherit',
    }}
    onMouseEnter={e => {
      if (href) {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLElement).style.transform = 'none';
    }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: iconBg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500, marginBottom: 4 }}>{label}</div>
        {loading ? (
          <><Skeleton h={28} w={80} r={6} /><div style={{ marginTop: 6 }}><Skeleton h={12} w={100} r={4} /></div></>
        ) : (
          <>
            <div style={{ fontSize: 26, fontWeight: 600, color: '#09090b', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </div>
            {sub && <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{sub}</div>}
          </>
        )}
      </div>
      {href && <ChevronRight size={15} color="#d4d4d8" style={{ marginTop: 2, flexShrink: 0 }} />}
    </div>
  );

  return href ? <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>{inner}</Link> : inner;
}

// ─── Custom tooltip ────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#09090b', borderRadius: 10, padding: '10px 14px',
      border: '1px solid #27272a', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6, fontFamily: 'monospace' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fff', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#a1a1aa', fontSize: 12 }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPoint[]>([]);
  const [flagged, setFlagged] = useState<ReceiptListItem[]>([]);
  const [recent, setRecent] = useState<ReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartDays, setChartDays] = useState(30);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsRes, analyticsRes, flaggedRes, recentRes] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.analytics(chartDays),
        receiptsApi.list({ risk_level: 'HIGH', limit: 6 }),
        receiptsApi.list({ limit: 8 }),
      ]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
      setFlagged(flaggedRes.data);
      setRecent(recentRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartDays]);

  useEffect(() => { load(); }, [load]);

  const chartData = analytics.map(p => ({
    date: (() => {
      try { return format(parseISO(p.date), 'MMM d'); } catch { return p.date; }
    })(),
    Total: p.total,
    Flagged: p.flagged,
    Approved: p.approved,
  }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .dash-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #f8f8f9; }
        .dash-mounted { animation: fadeUp 0.4s ease both; }
        .section-card {
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 14px;
          overflow: hidden;
        }
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #f4f4f5;
        }
        .section-title {
          font-size: 13px; font-weight: 600; color: #09090b;
          display: flex; align-items: center; gap: 7px;
        }
        .tab-pill {
          display: flex; background: #f4f4f5; border-radius: 8px; padding: 3px;
        }
        .tab-pill button {
          padding: 4px 12px; border-radius: 6px; border: none;
          font-size: 12px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; transition: all 0.15s;
          background: transparent; color: #71717a;
        }
        .tab-pill button.active {
          background: #fff; color: #09090b;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .receipt-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 20px;
          border-bottom: 1px solid #f9f9f9;
          transition: background 0.1s;
        }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-row:hover { background: #fafafa; }
        .receipt-icon {
          width: 34px; height: 38px; border-radius: 6px;
          background: #f4f4f5; border: 1px solid #ececec;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .view-all-link {
          display: flex; align-items: center; gap: 4px;
          font-size: 12px; color: #6366f1; font-weight: 500;
          text-decoration: none; transition: gap 0.15s;
        }
        .view-all-link:hover { gap: 6px; }
        .risk-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
        }
        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 48px 24px;
          color: #a1a1aa; gap: 8px;
        }
        .upload-cta {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff; padding: 9px 18px; border-radius: 10px;
          font-size: 13px; font-weight: 600; text-decoration: none;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
          transition: all 0.2s;
        }
        .upload-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.45); }
      `}</style>

      <div className="dash-page">
        {/* Top bar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #f0f0f0',
          padding: '12px 28px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>Dashboard</div>
            <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 1 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9, border: '1px solid #e4e4e7',
                background: '#fff', color: '#52525b', fontSize: 13,
                fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
            <Link href="/dashboard/upload" className="upload-cta">
              <Upload size={14} />
              Upload receipt
            </Link>
          </div>
        </div>

        <div className={mounted ? 'dash-mounted' : ''} style={{ padding: '24px 28px', maxWidth: 1200 }}>

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            <MetricCard
              label="Receipts analyzed"
              value={stats?.total_receipts?.toLocaleString() ?? '—'}
              sub={`+${stats?.receipts_this_week ?? '…'} this week`}
              icon={<FileText size={18} />}
              iconBg="#f0f0ff" iconColor="#6366f1"
              loading={loading}
              href="/dashboard/receipts"
            />
            <MetricCard
              label="High-risk flagged"
              value={stats?.high_risk_count ?? '—'}
              sub={`${stats?.flag_rate ?? '…'}% flag rate`}
              icon={<ShieldAlert size={18} />}
              iconBg="#fef2f2" iconColor="#ef4444"
              loading={loading}
              href="/dashboard/flagged"
            />
            <MetricCard
              label="Pending review"
              value={stats?.pending_review_count ?? '—'}
              sub={`Avg score ${stats?.avg_risk_score ?? '…'}`}
              icon={<Clock size={18} />}
              iconBg="#fffbeb" iconColor="#f59e0b"
              loading={loading}
              href="/dashboard/pending"
            />
            <MetricCard
              label="Auto-approved"
              value={stats?.auto_approved_count?.toLocaleString() ?? '—'}
              sub="Low-risk, passed all checks"
              icon={<ShieldCheck size={18} />}
              iconBg="#f0fdf4" iconColor="#22c55e"
              loading={loading}
            />
          </div>

          {/* Chart + flagged row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 14, marginBottom: 14 }}>

            {/* Area chart */}
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <TrendingUp size={14} color="#6366f1" />
                  Receipt activity
                </div>
                <div className="tab-pill">
                  {[7, 30, 90].map(d => (
                    <button
                      key={d}
                      className={chartDays === d ? 'active' : ''}
                      onClick={() => setChartDays(d)}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding: '16px 8px 8px' }}>
                {loading ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton w="90%" h={180} r={8} />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="empty-state" style={{ height: 220 }}>
                    <TrendingUp size={28} color="#d4d4d8" />
                    <div style={{ fontSize: 13 }}>No data yet — upload your first receipt</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gFlagged" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                        formatter={(v) => <span style={{ color: '#71717a' }}>{v}</span>}
                      />
                      <Area type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2} fill="url(#gTotal)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="Flagged" stroke="#f97316" strokeWidth={2} fill="url(#gFlagged)" dot={false} activeDot={{ r: 4 }} />
                      <Area type="monotone" dataKey="Approved" stroke="#22c55e" strokeWidth={2} fill="url(#gApproved)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Risk breakdown bar */}
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <ShieldAlert size={14} color="#f97316" />
                  Risk breakdown
                </div>
              </div>
              <div style={{ padding: '16px 16px 8px' }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1,2,3,4].map(i => <Skeleton key={i} h={44} r={8} />)}
                  </div>
                ) : stats ? (
                  <>
                    {[
                      { label: 'Critical', count: Math.round((stats.high_risk_count || 0) * 0.3), color: '#ef4444', bg: '#fef2f2' },
                      { label: 'High', count: Math.round((stats.high_risk_count || 0) * 0.7), color: '#f97316', bg: '#fff7ed' },
                      { label: 'Medium', count: stats.pending_review_count || 0, color: '#eab308', bg: '#fefce8' },
                      { label: 'Low / clear', count: stats.auto_approved_count || 0, color: '#22c55e', bg: '#f0fdf4' },
                    ].map(({ label, count, color, bg }) => {
                      const pct = stats.total_receipts > 0 ? Math.round(count / stats.total_receipts * 100) : 0;
                      return (
                        <div key={label} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                              <span style={{ fontSize: 12, color: '#52525b', fontWeight: 500 }}>{label}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#a1a1aa' }}>{count.toLocaleString()}</span>
                              <span style={{ fontSize: 11, color, fontFamily: 'monospace', fontWeight: 600, background: bg, padding: '1px 6px', borderRadius: 4 }}>{pct}%</span>
                            </div>
                          </div>
                          <div style={{ height: 5, background: '#f4f4f5', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#a1a1aa' }}>Total processed</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>
                        {(stats.total_receipts || 0).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="empty-state"><ShieldCheck size={24} /><span>No data</span></div>
                )}
              </div>
            </div>
          </div>

          {/* Flagged + Recent rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* High-risk flagged */}
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <AlertTriangle size={14} color="#ef4444" />
                  High-risk receipts
                </div>
                <Link href="/dashboard/flagged" className="view-all-link">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Skeleton w={34} h={38} r={6} />
                      <div style={{ flex: 1 }}>
                        <Skeleton h={13} w="60%" r={4} />
                        <div style={{ marginTop: 5 }}><Skeleton h={11} w="40%" r={3} /></div>
                      </div>
                      <Skeleton w={56} h={22} r={10} />
                    </div>
                  ))}
                </div>
              ) : flagged.length === 0 ? (
                <div className="empty-state">
                  <ShieldCheck size={28} color="#d4d4d8" />
                  <div style={{ fontSize: 13 }}>No high-risk receipts</div>
                  <div style={{ fontSize: 12, color: '#d4d4d8' }}>Your queue is clear</div>
                </div>
              ) : (
                flagged.map(r => {
                  const c = riskColors(r.risk_level);
                  const s = statusLabel(r.status);
                  return (
                    <Link key={r.id} href={`/dashboard/receipts/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div className="receipt-row">
                        <div className="receipt-icon">
                          <ShieldX size={15} color="#ef4444" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.merchant_name || r.original_filename || 'Unknown merchant'}
                          </div>
                          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                            {r.submitted_by?.full_name || 'Unknown'} · {timeAgo(r.created_at)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {r.total_amount != null && (
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b' }}>{fmt(r.total_amount)}</div>
                          )}
                          <span className="risk-pill" style={{ marginTop: 3, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
                            {r.risk_level} {r.risk_score != null ? `· ${r.risk_score}` : ''}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Recent uploads */}
            <div className="section-card">
              <div className="section-header">
                <div className="section-title">
                  <Clock size={14} color="#6366f1" />
                  Recent uploads
                </div>
                <Link href="/dashboard/receipts" className="view-all-link">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Skeleton w={34} h={38} r={6} />
                      <div style={{ flex: 1 }}>
                        <Skeleton h={13} w="55%" r={4} />
                        <div style={{ marginTop: 5 }}><Skeleton h={11} w="35%" r={3} /></div>
                      </div>
                      <Skeleton w={62} h={20} r={10} />
                    </div>
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="empty-state">
                  <Upload size={28} color="#d4d4d8" />
                  <div style={{ fontSize: 13 }}>No receipts yet</div>
                  <Link href="/dashboard/upload" className="upload-cta" style={{ marginTop: 8, fontSize: 12, padding: '7px 14px' }}>
                    <Upload size={12} /> Upload first receipt
                  </Link>
                </div>
              ) : (
                recent.map(r => {
                  const s = statusLabel(r.status);
                  return (
                    <Link key={r.id} href={`/dashboard/receipts/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div className="receipt-row">
                        <div className="receipt-icon">
                          <FileText size={14} color="#a1a1aa" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.merchant_name || r.original_filename || 'Receipt'}
                          </div>
                          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                            {r.submitted_by?.full_name || 'Unknown'} · {timeAgo(r.created_at)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {r.total_amount != null && (
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#52525b' }}>{fmt(r.total_amount)}</div>
                          )}
                          <span style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2, display: 'block' }}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
