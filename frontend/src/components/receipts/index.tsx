'use client';
import Link from 'next/link';
import { FileText, ChevronRight, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';
import { RiskBadge, StatusBadge, EmptyState } from '@/components/ui';
import type { ReceiptListItem } from '@/types';

function fmt(n?: number | null) {
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

// ─── Receipt table ────────────────────────────────────────────────────────────

interface ReceiptTableProps {
  receipts: ReceiptListItem[];
  loading?: boolean;
}

export function ReceiptTable({ receipts, loading }: ReceiptTableProps) {
  if (loading) {
    return (
      <div className="divide-y divide-gray-50">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded w-40" />
              <div className="h-3 bg-gray-50 rounded w-24" />
            </div>
            <div className="h-5 bg-gray-100 rounded-full w-16" />
            <div className="h-5 bg-gray-100 rounded-full w-12" />
            <div className="h-3 bg-gray-50 rounded w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-6 h-6" />}
        title="No receipts yet"
        description="Upload a receipt to get started with fraud detection."
        action={
          <Link href="/dashboard/upload"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            Upload receipt
          </Link>
        }
      />
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {receipts.map((r) => (
        <Link
          key={r.id}
          href={`/dashboard/receipts/${r.id}`}
          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
        >
          {/* Icon */}
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            r.risk_level === 'CRITICAL' ? 'bg-red-50' :
            r.risk_level === 'HIGH'     ? 'bg-orange-50' :
            r.risk_level === 'MEDIUM'   ? 'bg-amber-50' : 'bg-green-50'
          )}>
            <FileText className={clsx(
              'w-4 h-4',
              r.risk_level === 'CRITICAL' ? 'text-red-500' :
              r.risk_level === 'HIGH'     ? 'text-orange-500' :
              r.risk_level === 'MEDIUM'   ? 'text-amber-500' : 'text-green-500'
            )} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {r.merchant_name || r.original_filename || 'Unknown merchant'}
            </p>
            <p className="text-xs text-gray-400">
              {r.submitted_by?.full_name || 'Unknown'} · {timeAgo(r.created_at)}
            </p>
          </div>

          {/* Amount */}
          <span className="text-sm font-medium text-gray-700 tabular-nums w-20 text-right">
            {fmt(r.total_amount)}
          </span>

          {/* Risk */}
          <div className="w-20 flex justify-center">
            <RiskBadge level={r.risk_level} />
          </div>

          {/* Status */}
          <div className="w-24 flex justify-center">
            <StatusBadge status={r.status} />
          </div>

          {/* Score */}
          <span className="text-xs text-gray-400 tabular-nums w-8 text-right">
            {r.risk_score ?? '—'}
          </span>

          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}

// ─── Receipt card (compact, for dashboard) ────────────────────────────────────

export function ReceiptCard({ receipt }: { receipt: ReceiptListItem }) {
  return (
    <Link
      href={`/dashboard/receipts/${receipt.id}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {receipt.merchant_name || 'Unknown merchant'}
        </p>
        <p className="text-xs text-gray-400">{fmt(receipt.total_amount)} · {timeAgo(receipt.created_at)}</p>
      </div>
      <RiskBadge level={receipt.risk_level} />
      <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
    </Link>
  );
}
