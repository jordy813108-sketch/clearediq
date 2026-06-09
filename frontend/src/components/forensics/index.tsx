'use client';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { FraudScore, FraudFlag } from '@/types';

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score?: number }) {
  if (score == null) return null;
  const color = score >= 75 ? 'bg-red-500' : score >= 55 ? 'bg-orange-400' : score >= 30 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-8 text-right tabular-nums">{score}</span>
    </div>
  );
}

// ─── Forensics score breakdown panel ─────────────────────────────────────────

interface ForensicsPanelProps {
  fraudScore: FraudScore;
  flags: FraudFlag[];
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export function ForensicsPanel({ fraudScore, flags }: ForensicsPanelProps) {
  const sorted = [...flags].sort((a, b) =>
    (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  const scoreColor = fraudScore.overall_score >= 75 ? 'text-red-600' :
                     fraudScore.overall_score >= 55 ? 'text-orange-500' :
                     fraudScore.overall_score >= 30 ? 'text-amber-500' : 'text-green-600';

  return (
    <div className="space-y-5">
      {/* Overall */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="text-center">
          <div className={clsx('text-3xl font-bold tabular-nums', scoreColor)}>
            {fraudScore.overall_score}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">risk score</div>
        </div>
        <div className="flex-1 space-y-2">
          <ScoreBar label="Math validation"    score={fraudScore.math_validation_score} />
          <ScoreBar label="Tax validation"     score={fraudScore.tax_validation_score} />
          <ScoreBar label="Timestamp check"    score={fraudScore.timestamp_score} />
          <ScoreBar label="Duplicate check"    score={fraudScore.duplicate_score} />
          <ScoreBar label="Merchant check"     score={fraudScore.merchant_score} />
          <ScoreBar label="Image forensics"    score={fraudScore.image_forensics_score} />
          <ScoreBar label="Metadata analysis"  score={fraudScore.metadata_score} />
        </div>
      </div>

      {/* Flags */}
      {sorted.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Flags detected ({sorted.length})
          </p>
          <div className="space-y-2">
            {sorted.map((flag, i) => (
              <FlagCard key={i} flag={flag} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 p-3 bg-green-50 rounded-lg border border-green-100">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700">No fraud flags detected on this receipt.</p>
        </div>
      )}
    </div>
  );
}

// ─── Single flag card ─────────────────────────────────────────────────────────

function FlagCard({ flag }: { flag: FraudFlag }) {
  const styles = {
    critical: { bg: 'bg-red-50 border-red-200',   icon: 'text-red-500',    label: 'bg-red-100 text-red-700' },
    high:     { bg: 'bg-orange-50 border-orange-200', icon: 'text-orange-500', label: 'bg-orange-100 text-orange-700' },
    medium:   { bg: 'bg-amber-50 border-amber-200',  icon: 'text-amber-500',  label: 'bg-amber-100 text-amber-700' },
    low:      { bg: 'bg-blue-50 border-blue-100',    icon: 'text-blue-400',   label: 'bg-blue-100 text-blue-700' },
  }[flag.severity] || { bg: 'bg-gray-50 border-gray-100', icon: 'text-gray-400', label: 'bg-gray-100 text-gray-600' };

  const Icon = flag.severity === 'low' ? Info : AlertTriangle;

  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-lg border', styles.bg)}>
      <Icon className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-gray-800">{flag.title}</p>
          <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase', styles.label)}>
            {flag.severity}
          </span>
        </div>
        {flag.description && (
          <p className="text-xs text-gray-500">{flag.description}</p>
        )}
      </div>
    </div>
  );
}
