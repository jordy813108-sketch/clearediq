'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Filter, Upload, ChevronRight,
  ShieldAlert, ShieldCheck, ShieldX, FileText,
  AlertCircle, Clock, CheckCircle2, Loader2
} from 'lucide-react';
import { receiptsApi } from '@/lib/api';
import type { ReceiptListItem, RiskLevel } from '@/types';
import { format, parseISO } from 'date-fns';

const RISK_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
  HIGH:     { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  MEDIUM:   { bg: '#fefce8', text: '#854d0e', dot: '#eab308' },
  LOW:      { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
};

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: '#6366f1' },
  processing: { label: 'Processing', color: '#8b5cf6' },
  approved:   { label: 'Approved',   color: '#22c55e' },
  rejected:   { label: 'Rejected',   color: '#ef4444' },
  escalated:  { label: 'Escalated',  color: '#f97316' },
  reviewed:   { label: 'Reviewed',   color: '#06b6d4' },
};

function fmt(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function timeAgo(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return format(parseISO(s), 'MMM d');
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await receiptsApi.list({
        status: statusFilter || undefined,
        risk_level: riskFilter || undefined,
        limit: 100,
      });
      setReceipts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = receipts.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.merchant_name?.toLowerCase().includes(q) ||
      r.original_filename?.toLowerCase().includes(q) ||
      r.submitted_by?.full_name?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .receipts-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #f8f8f9; animation: fadeUp 0.3s ease; }
        .table-row { display: grid; grid-template-columns: 2fr 1fr 100px 100px 80px 36px; align-items: center; padding: 11px 20px; border-bottom: 1px solid #f9f9f9; gap: 12px; transition: background 0.1s; text-decoration: none; color: inherit; }
        .table-row:hover { background: #fafafa; }
        .table-head { display: grid; grid-template-columns: 2fr 1fr 100px 100px 80px 36px; padding: 8px 20px; gap: 12px; background: #f8f8f9; border-bottom: 1px solid #f0f0f0; }
        .th { font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.07em; }
        .select-filter { font-size: 13px; font-family: 'DM Sans', sans-serif; color: '#52525b'; background: '#fff'; border: '1px solid #e4e4e7'; border-radius: 9px; padding: '7px 12px'; outline: none; cursor: pointer; }
      `}</style>

      <div className="receipts-page">
        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '12px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#09090b' }}>All receipts</div>
          <Link href="/dashboard/upload" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Upload size={13} /> Upload
          </Link>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={13} color="#a1a1aa" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text" placeholder="Search merchant, file, or employee…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #e4e4e7', borderRadius: 10, fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: '#09090b', outline: 'none', background: '#fff' }}
              />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e4e4e7', borderRadius: 10, fontSize: 13, fontFamily: 'DM Sans, sans-serif', background: '#fff', color: '#52525b', outline: 'none', cursor: 'pointer' }}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e4e4e7', borderRadius: 10, fontSize: 13, fontFamily: 'DM Sans, sans-serif', background: '#fff', color: '#52525b', outline: 'none', cursor: 'pointer' }}>
              <option value="">All risk levels</option>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, overflow: 'hidden' }}>
            <div className="table-head">
              <span className="th">Receipt</span>
              <span className="th">Submitted by</span>
              <span className="th">Amount</span>
              <span className="th">Risk</span>
              <span className="th">Status</span>
              <span />
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#a1a1aa', gap: 10 }}>
                <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13 }}>Loading receipts…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 0', color: '#a1a1aa' }}>
                <FileText size={32} style={{ opacity: 0.4 }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>{search || statusFilter || riskFilter ? 'No matching receipts' : 'No receipts yet'}</div>
                {!search && !statusFilter && !riskFilter && (
                  <Link href="/dashboard/upload" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    <Upload size={13} /> Upload first receipt
                  </Link>
                )}
              </div>
            ) : (
              filtered.map(r => {
                const risk = r.risk_level ? RISK_COLORS[r.risk_level] : null;
                const status = STATUS_COLORS[r.status];
                return (
                  <Link key={r.id} href={`/dashboard/receipts/${r.id}`} className="table-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 36, borderRadius: 6, background: '#f4f4f5', border: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={13} color="#a1a1aa" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.merchant_name || r.original_filename || 'Unknown'}
                        </div>
                        <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>{timeAgo(r.created_at)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.submitted_by?.full_name || r.submitted_by?.email || '—'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(r.total_amount)}
                    </div>
                    <div>
                      {risk ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: risk.bg, color: risk.text, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: risk.dot }} />
                          {r.risk_level} {r.risk_score != null ? `· ${r.risk_score}` : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#d4d4d8' }}>—</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.label}</div>
                    <ChevronRight size={14} color="#d4d4d8" />
                  </Link>
                );
              })
            )}
          </div>

          {!loading && filtered.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#a1a1aa', textAlign: 'center' }}>
              Showing {filtered.length} receipt{filtered.length !== 1 ? 's' : ''}
              {(statusFilter || riskFilter || search) && ` (filtered from ${receipts.length})`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
