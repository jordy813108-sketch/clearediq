'use client';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import React from 'react';

// ─── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = {
  default:  'bg-gray-100 text-gray-700',
  success:  'bg-green-50 text-green-700 border border-green-200',
  warning:  'bg-amber-50 text-amber-700 border border-amber-200',
  danger:   'bg-red-50 text-red-700 border border-red-200',
  critical: 'bg-red-100 text-red-800 border border-red-300 font-semibold',
  info:     'bg-indigo-50 text-indigo-700 border border-indigo-200',
  outline:  'bg-white text-gray-600 border border-gray-200',
};

interface BadgeProps {
  variant?: keyof typeof badgeVariants;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}

export function Badge({ variant = 'default', className, children, dot }: BadgeProps) {
  const dotColors: Record<string, string> = {
    success: 'bg-green-500', warning: 'bg-amber-500', danger: 'bg-red-500',
    critical: 'bg-red-600', info: 'bg-indigo-500', default: 'bg-gray-400',
    outline: 'bg-gray-400',
  };
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      badgeVariants[variant], className
    )}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

const buttonVariants = {
  primary:   'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 border-transparent',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-gray-200',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-transparent',
  ghost:     'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 border-transparent',
  outline:   'bg-white text-indigo-600 hover:bg-indigo-50 border-indigo-200',
};

const buttonSizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant], buttonSizes[size], className
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  className?: string;
  children: React.ReactNode;
  padding?: boolean;
}
export function Card({ className, children, padding = true }: CardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-gray-100 shadow-sm',
      padding && 'p-5',
      className
    )}>
      {children}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return <Loader2 className={clsx(s, 'animate-spin text-indigo-500')} />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
      {description && <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

import type { RiskLevel } from '@/types';

export function RiskBadge({ level }: { level?: RiskLevel | null }) {
  if (!level) return <Badge variant="outline">—</Badge>;
  const map: Record<RiskLevel, { variant: keyof typeof badgeVariants; label: string }> = {
    LOW:      { variant: 'success',  label: 'Low' },
    MEDIUM:   { variant: 'warning',  label: 'Medium' },
    HIGH:     { variant: 'danger',   label: 'High' },
    CRITICAL: { variant: 'critical', label: 'Critical' },
  };
  const { variant, label } = map[level];
  return <Badge variant={variant} dot>{label}</Badge>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

import type { ReceiptStatus } from '@/types';

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const map: Record<ReceiptStatus, { variant: keyof typeof badgeVariants; label: string }> = {
    pending:    { variant: 'warning', label: 'Pending' },
    processing: { variant: 'info',    label: 'Processing' },
    reviewed:   { variant: 'info',    label: 'Reviewed' },
    approved:   { variant: 'success', label: 'Approved' },
    rejected:   { variant: 'danger',  label: 'Rejected' },
    escalated:  { variant: 'danger',  label: 'Escalated' },
  };
  const { variant, label } = map[status] || { variant: 'default', label: status };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Score ring ───────────────────────────────────────────────────────────────

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 75 ? '#ef4444' : score >= 55 ? '#f97316' : score >= 30 ? '#eab308' : '#22c55e';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f4f4f5" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: size * 0.22, fontWeight: 600, fill: color }}>
        {score}
      </text>
    </svg>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx('border-gray-100', className)} />;
}
