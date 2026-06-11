'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle,
  MapPin, Phone, Building2, Calendar, Hash, Receipt as ReceiptIcon,
  FileText, Eye, ShieldAlert, ShieldCheck, User, ExternalLink,
  Copy, Clock, BarChart2, Loader2, Flag,
} from 'lucide-react';
import { receiptsApi } from '@/lib/api';
import type { Receipt, FraudFlag, RiskLevel } from '@/types';
import { format, parseISO } from 'date-fns';

const NAVY = '#1a1f3a';
const RED  = '#E02020';

function fmt(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  try { return format(parseISO(s), 'MMM d, yyyy · h:mm a'); } catch { return s; }
}
function fmtShort(s?: string | null) {
  if (!s) return '—';
  try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; }
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  CRITICAL: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', bar: '#ef4444' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', bar: '#f97316' },
  MEDIUM:   { bg: '#fefce8', border: '#fde68a', text: '#854d0e', bar: '#eab308' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', bar: '#22c55e' },
};

const SEV_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#ef4444' },
  high:     { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', icon: '#f97316' },
  medium:   { bg: '#fefce8', border: '#fde68a', text: '#854d0e', icon: '#eab308' },
  low:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '#22c55e' },
};

function ScoreBar({ label, score, weight = 1 }: { label: string; score?: number; weight?: number }) {
  if (score == null) return null;
  const color = score >= 75 ? '#ef4444' : score >= 55 ? '#f97316' : score >= 30 ? '#eab308' : '#22c55e';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: '#52525b' }}>{label}</span>
        <span style={{ fontWeight: 500, color }}>{score}</span>
      </div>
      <div style={{ height: 5, background: '#f4f4f5', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function VerifyRow({ icon: Icon, label, value, status }: {
  icon: any; label: string; value?: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
}) {
  const statusConfig = {
    pass:    { icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: 'Verified' },
    fail:    { icon: XCircle,      color: '#dc2626', bg: '#fef2f2', border: '#fecaca', text: 'Failed'   },
    warn:    { icon: AlertTriangle,color: '#ca8a04', bg: '#fefce8', border: '#fde68a', text: 'Warning'  },
    unknown: { icon: Clock,        color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', text: 'Pending'  },
  }[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid #f4f4f5' }}>
      <Icon size={15} color="#9ca3af" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#52525b', flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, maxWidth: 160, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: statusConfig.bg, border: `0.5px solid ${statusConfig.border}`, flexShrink: 0 }}>
        <StatusIcon size={11} color={statusConfig.color} />
        <span style={{ fontSize: 11, fontWeight: 500, color: statusConfig.color }}>{statusConfig.text}</span>
      </div>
    </div>
  );
}

function FlagCard({ flag }: { flag: FraudFlag }) {
  const sev = SEV_COLORS[flag.severity] || SEV_COLORS.low;
  const Icon = flag.severity === 'critical' || flag.severity === 'high' ? AlertTriangle : flag.severity === 'low' ? CheckCircle2 : AlertTriangle;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: sev.bg, border: `0.5px solid ${sev.border}`, marginBottom: 6 }}>
      <Icon size={15} color={sev.icon} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: sev.text, marginBottom: 2 }}>{flag.title}</div>
        {flag.description && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{flag.description}</div>}
      </div>
      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: sev.icon, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{flag.severity}</span>
    </div>
  );
}

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [acting, setActing]   = useState(false);
  const [note, setNote]       = useState('');
  const [copied, setCopied]   = useState(false);
  const [activeTab, setActiveTab] = useState<'report'|'image'|'raw'>('report');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await receiptsApi.get(id).then(r => r.data);
      setReceipt(data);
    } catch { setError('Could not load receipt.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: 'approve' | 'reject' | 'escalate') {
    if (!receipt) return;
    setActing(true);
    try {
    await receiptsApi.review(id, action, note);
      await load();
    } catch {}
    finally { setActing(false); }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Loader2 size={24} color={RED} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error || !receipt) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
      <p>{error || 'Receipt not found.'}</p>
      <button onClick={() => router.back()} style={{ marginTop: 12, fontSize: 13, color: RED }}>← Go back</button>
    </div>
  );

  const score = receipt.fraud_score;
  const flags = receipt.fraud_flags || [];
  const risk  = (receipt.risk_level || 'LOW') as RiskLevel;
  const riskC = RISK_COLORS[risk] || RISK_COLORS.LOW;
  const place = (score as any)?.score_breakdown?.place_details;

  const criticalFlags = flags.filter(f => f.severity === 'critical' || f.severity === 'high');
  const passFlags     = flags.filter(f => f.flag_type?.includes('verified') || f.flag_type?.includes('passed'));

  // Derive verification statuses from flags
  const hasFlag = (type: string) => flags.some(f => f.flag_type?.includes(type));
  const businessStatus  = hasFlag('business_not_found') ? 'fail' : hasFlag('address') ? 'fail' : place ? 'pass' : 'unknown';
  const addressStatus   = hasFlag('city_mismatch') || hasFlag('state_mismatch') ? 'fail' : place ? 'pass' : 'unknown';
  const phoneStatus     = hasFlag('phone') ? 'fail' : place?.phone ? 'pass' : 'unknown';
  const mathStatus      = hasFlag('math_mismatch') || hasFlag('line_item') ? 'fail' : 'pass';
  const taxStatus       = hasFlag('tax_rate_mismatch') || hasFlag('impossible_tax') ? 'fail' : hasFlag('zero_tax') ? 'warn' : 'pass';
  const imageStatus     = hasFlag('ai_vision_likely_fake') || hasFlag('ai_generated') || hasFlag('editing_software') ? 'fail' : hasFlag('ai_vision_passed') ? 'pass' : 'unknown';
  const dupStatus       = hasFlag('duplicate') ? 'fail' : 'pass';
  const thresholdStatus = hasFlag('threshold') ? 'warn' : 'pass';

  return (
    <div style={{ background: '#f8f9fc', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: NAVY, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'white' }}>
              {receipt.merchant_name || receipt.original_filename || 'Receipt'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Uploaded by {receipt.submitted_by?.full_name || 'Unknown'} · {fmtDate(receipt.created_at)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={copyLink} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Copy size={13} /> {copied ? 'Copied!' : 'Share'}
          </button>
          <div style={{ padding: '6px 16px', borderRadius: 8, background: riskC.bg, border: `0.5px solid ${riskC.border}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: riskC.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {risk} RISK · {score?.overall_score ?? '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Critical alert bar */}
      {criticalFlags.length > 0 && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flag size={14} color="#dc2626" />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#991b1b' }}>
            {criticalFlags.length} critical fraud indicator{criticalFlags.length > 1 ? 's' : ''} detected — review before approving
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #f0f0f0', padding: '0 24px', display: 'flex', gap: 0 }}>
        {[['report','Intelligence report'],['image','Receipt image'],['raw','Raw data']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} style={{
            padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? RED : '#6b7280',
            borderBottom: activeTab === tab ? `2px solid ${RED}` : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {activeTab === 'report' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>

            {/* Left column */}
            <div>

              {/* Score breakdown */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: NAVY }}>Fraud score breakdown</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: riskC.bar }}>{score?.overall_score ?? '—'}<span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400 }}>/100</span></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                  <ScoreBar label="Image forensics"     score={score?.image_forensics_score} />
                  <ScoreBar label="Address verification" score={(score as any)?.score_breakdown?.address_verification_score} />
                  <ScoreBar label="Math validation"      score={score?.math_validation_score} />
                  <ScoreBar label="Tax validation"       score={score?.tax_validation_score} />
                  <ScoreBar label="Behavioral patterns"  score={(score as any)?.score_breakdown?.behavioral_score} />
                  <ScoreBar label="Timestamp check"      score={score?.timestamp_score} />
                  <ScoreBar label="Duplicate check"      score={score?.duplicate_score} />
                  <ScoreBar label="Merchant check"       score={score?.merchant_score} />
                </div>
              </div>

              {/* Verification checks */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 12 }}>Verification checks</div>
                <VerifyRow icon={Building2} label="Business exists in Google Places" value={place?.name} status={businessStatus} />
                <VerifyRow icon={MapPin}    label="Address verified" value={place?.formatted_address} status={addressStatus} />
                <VerifyRow icon={Phone}     label="Phone number verified" value={place?.phone} status={phoneStatus} />
                <VerifyRow icon={ReceiptIcon} label="Math validation (subtotal + tax = total)" status={mathStatus} />
                <VerifyRow icon={BarChart2} label="Tax rate valid for location" status={taxStatus} />
                <VerifyRow icon={Eye}       label="Image authenticity (AI vision analysis)" status={imageStatus} />
                <VerifyRow icon={Copy}      label="Duplicate submission check" status={dupStatus} />
                <VerifyRow icon={AlertTriangle} label="Approval threshold pattern" status={thresholdStatus} />
              </div>

              {/* Map */}
              {(receipt.merchant_address || place) && (
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 12 }}>Location</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>On receipt</div>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 12 }}>{receipt.merchant_address || '—'}</div>
                      {place && <>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Google Places verified</div>
                        <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{place.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{place.formatted_address}</div>
                        {place.phone && <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={12} />{place.phone}</div>}
                        {place.rating && <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>⭐ {place.rating} ({place.user_ratings_total?.toLocaleString()} reviews)</div>}
                        {place.business_status && place.business_status !== 'OPERATIONAL' && (
                          <div style={{ marginTop: 8, padding: '4px 10px', background: '#fef2f2', borderRadius: 6, fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
                            {place.business_status.replace(/_/g, ' ')}
                          </div>
                        )}
                      </>}
                    </div>
                    {place?.geometry && (
                      <a href={`https://maps.google.com/?q=${place.geometry.lat},${place.geometry.lng}`} target="_blank" rel="noopener noreferrer"
                         style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: RED, textDecoration: 'none', fontWeight: 500, flexShrink: 0 }}>
                        <MapPin size={13} /> View on map <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Flags */}
              {flags.length > 0 && (
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 12 }}>
                    Fraud flags ({flags.filter(f => !f.flag_type?.includes('passed') && !f.flag_type?.includes('verified')).length} detected)
                  </div>
                  {flags.map((flag, i) => <FlagCard key={i} flag={flag} />)}
                </div>
              )}
            </div>

            {/* Right column */}
            <div>

              {/* Receipt data */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 12 }}>Receipt data</div>
                {[
                  [Building2, 'Merchant',    receipt.merchant_name],
                  [MapPin,    'Address',     receipt.merchant_address],
                  [Calendar,  'Date',        fmtShort(receipt.transaction_date)],
                  [Hash,      'Transaction', receipt.transaction_id],
                  [User,      'Submitted by',receipt.submitted_by?.full_name],
                  [Clock,     'Uploaded',    fmtDate(receipt.created_at)],
                ].map(([Icon, label, value]: any) => value && (
                  <div key={label} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '0.5px solid #f9fafb' }}>
                    <Icon size={13} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 1 }}>{label}</div>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{value}</div>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 12, padding: 12, background: '#f8f9fc', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    <span>Subtotal</span><span>{fmt(receipt.subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    <span>Tax ({receipt.tax_rate ? `${receipt.tax_rate}%` : '—'})</span><span>{fmt(receipt.tax_amount)}</span>
                  </div>
                  {receipt.tip_amount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      <span>Tip</span><span>{fmt(receipt.tip_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: NAVY, borderTop: '0.5px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                    <span>Total</span><span style={{ color: mathStatus === 'fail' ? RED : NAVY }}>{fmt(receipt.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Review actions */}
              {receipt.status === 'pending' || receipt.status === 'processing' ? (
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 12 }}>Review decision</div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a note (optional)..."
                    style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#374151', resize: 'none', height: 72, marginBottom: 12, fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAction('approve')} disabled={acting} style={{ flex: 1, padding: '9px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {acting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />} Approve
                    </button>
                    <button onClick={() => handleAction('reject')} disabled={acting} style={{ flex: 1, padding: '9px', background: RED, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {acting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={13} />} Reject
                    </button>
                  </div>
                  <button onClick={() => handleAction('escalate')} disabled={acting} style={{ width: '100%', marginTop: 8, padding: '9px', background: '#fff7ed', color: '#9a3412', border: '0.5px solid #fed7aa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <ShieldAlert size={13} /> Escalate to management
                  </button>
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: NAVY, marginBottom: 8 }}>Decision</div>
                  <div style={{ fontSize: 13, color: '#374151', textTransform: 'capitalize', fontWeight: 500 }}>{receipt.status}</div>
                  {receipt.reviewer_note && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{receipt.reviewer_note}</div>}
                </div>
              )}

              {/* Export */}
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: NAVY, marginBottom: 10 }}>Export</div>
                <button onClick={() => window.print()} style={{ width: '100%', padding: '8px', background: '#f8f9fc', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151', cursor: 'pointer', marginBottom: 6, fontWeight: 500 }}>
                  Print / Save as PDF
                </button>
                <button onClick={copyLink} style={{ width: '100%', padding: '8px', background: '#f8f9fc', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
                  Copy link to share
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 24, textAlign: 'center' }}>
            {receipt.image_url ? (
              <img src={receipt.image_url} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 800, borderRadius: 8, border: '0.5px solid #e5e7eb' }} />
            ) : (
              <div style={{ padding: 60, color: '#9ca3af' }}>
                <FileText size={32} style={{ marginBottom: 12 }} />
                <p>No image available</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <div style={{ background: '#0f0f1a', borderRadius: 12, padding: 24 }}>
            <pre style={{ fontSize: 11, color: '#a5f3fc', overflow: 'auto', lineHeight: 1.6, margin: 0 }}>
              {JSON.stringify({ receipt, fraud_score: score, flags, place_details: place }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
