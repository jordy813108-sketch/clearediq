'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, X, FileText, Image, File, AlertCircle,
  CheckCircle2, ArrowLeft, ArrowRight, Loader2,
  CloudUpload, ShieldCheck, Sparkles, Eye
} from 'lucide-react';
import { receiptsApi } from '@/lib/api';
import type { Receipt } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error' | 'duplicate';

interface QueuedFile {
  id: string;
  file: File;
  preview?: string;
  state: UploadState;
  progress: number;
  result?: Receipt;
  error?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf'];
const MAX_MB = 20;

function uid() { return Math.random().toString(36).slice(2); }

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image size={18} />;
  if (mime === 'application/pdf') return <FileText size={18} />;
  return <File size={18} />;
}

function riskBadge(score?: number, level?: string) {
  if (score == null || !level) return null;
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    LOW:      { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
    MEDIUM:   { bg: '#fefce8', text: '#854d0e', dot: '#eab308' },
    HIGH:     { bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
    CRITICAL: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
  };
  const s = styles[level] || styles.LOW;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.text,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {level} · {score}
    </span>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Processing steps animation ────────────────────────────────────────────

const STEPS = [
  { icon: <CloudUpload size={13} />, label: 'Uploading file' },
  { icon: <Eye size={13} />,        label: 'Running OCR extraction' },
  { icon: <ShieldCheck size={13} />,label: 'Validating math & tax' },
  { icon: <Sparkles size={13} />,   label: 'Scoring fraud risk' },
];

function ProcessingSteps({ progress }: { progress: number }) {
  const step = Math.min(Math.floor(progress / 25), 3);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: i > step ? 0.35 : 1,
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: done ? '#dcfce7' : active ? '#eff6ff' : '#f4f4f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: done ? '#16a34a' : active ? '#3b82f6' : '#a1a1aa',
              flexShrink: 0,
              transition: 'all 0.3s',
            }}>
              {done ? <CheckCircle2 size={12} /> : s.icon}
            </div>
            <span style={{
              fontSize: 12,
              color: done ? '#16a34a' : active ? '#1d4ed8' : '#a1a1aa',
              fontWeight: active ? 500 : 400,
              transition: 'color 0.3s',
            }}>
              {s.label}
              {active && <span style={{ marginLeft: 6, animation: 'blink 1s infinite' }}>▋</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── File card ─────────────────────────────────────────────────────────────

function FileCard({ item, onRemove }: { item: QueuedFile; onRemove: () => void }) {
  const router = useRouter();
  const isImg = item.file.type.startsWith('image/');

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${
        item.state === 'done' ? '#bbf7d0' :
        item.state === 'error' || item.state === 'duplicate' ? '#fecaca' :
        '#f0f0f0'
      }`,
      borderRadius: 14,
      padding: '14px 16px',
      transition: 'border-color 0.3s',
      animation: 'slideIn 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Thumb */}
        <div style={{
          width: 44, height: 50, borderRadius: 8,
          background: '#f4f4f5',
          border: '1px solid #ececec',
          overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#a1a1aa',
        }}>
          {isImg && item.preview
            ? <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : fileIcon(item.file.type)
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {item.file.name}
            </div>
            {item.state === 'idle' && (
              <button onClick={onRemove} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#d4d4d8', padding: 2, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#d4d4d8')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
            {fmtSize(item.file.size)} · {item.file.type.split('/')[1]?.toUpperCase()}
          </div>

          {/* Progress bar */}
          {(item.state === 'uploading' || item.state === 'processing') && (
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${item.progress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <ProcessingSteps progress={item.progress} />
            </div>
          )}

          {/* Done state */}
          {item.state === 'done' && item.result && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
                  <CheckCircle2 size={13} /> Analysis complete
                </span>
                {riskBadge(item.result.risk_score, item.result.risk_level)}
              </div>
              {item.result.ocr_result?.merchant_name && (
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                  <span style={{ color: '#a1a1aa' }}>Merchant: </span>
                  {item.result.ocr_result.merchant_name}
                  {item.result.ocr_result.total_amount != null && (
                    <span style={{ marginLeft: 8, color: '#52525b', fontWeight: 500 }}>
                      ${item.result.ocr_result.total_amount.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => router.push(`/dashboard/receipts/${item.result!.id}`)}
                style={{
                  marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#f5f3ff', color: '#6366f1', border: '1px solid #e0e7ff',
                  borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = '#ede9fe';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = '#f5f3ff';
                }}
              >
                View full report <ArrowRight size={11} />
              </button>
            </div>
          )}

          {/* Error state */}
          {(item.state === 'error' || item.state === 'duplicate') && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.4 }}>{item.error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main upload page ──────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: QueuedFile[] = [];

    for (const file of arr) {
      if (!ACCEPTED.includes(file.type)) {
        valid.push({ id: uid(), file, state: 'error', progress: 0, error: `Unsupported type: ${file.type}` });
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        valid.push({ id: uid(), file, state: 'error', progress: 0, error: `File too large (max ${MAX_MB}MB)` });
        continue;
      }
      const item: QueuedFile = { id: uid(), file, state: 'idle', progress: 0 };
      if (file.type.startsWith('image/')) {
        item.preview = URL.createObjectURL(file);
      }
      valid.push(item);
    }

    setQueue(prev => [...prev, ...valid]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(f => f.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const updateItem = (id: string, patch: Partial<QueuedFile>) => {
    setQueue(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const uploadAll = useCallback(async () => {
    const pending = queue.filter(f => f.state === 'idle');
    if (pending.length === 0) return;

    setUploading(true);

    for (const item of pending) {
      updateItem(item.id, { state: 'uploading', progress: 10 });

      // Simulate progress stages
      const tick = (p: number, delay: number) =>
        new Promise<void>(res => setTimeout(() => { updateItem(item.id, { progress: p }); res(); }, delay));

      try {
        await tick(25, 400);   // uploading
        updateItem(item.id, { state: 'processing' });
        await tick(50, 600);   // ocr
        await tick(75, 800);   // validation
        await tick(90, 600);   // scoring

        const res = await receiptsApi.upload(item.file);
        updateItem(item.id, { state: 'done', progress: 100, result: res.data });

      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail || 'Upload failed. Please try again.';
        updateItem(item.id, {
          state: status === 409 ? 'duplicate' : 'error',
          progress: 0,
          error: detail,
        });
      }
    }

    setUploading(false);
  }, [queue]);

  const pendingCount = queue.filter(f => f.state === 'idle').length;
  const doneCount = queue.filter(f => f.state === 'done').length;
  const errorCount = queue.filter(f => f.state === 'error' || f.state === 'duplicate').length;
  const allDone = queue.length > 0 && pendingCount === 0 && !uploading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          70% { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .upload-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #f8f8f9; }
        .drop-zone {
          border: 2px dashed #e4e4e7;
          border-radius: 18px;
          background: #fff;
          padding: 48px 32px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 14px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .drop-zone.dragging {
          border-color: #6366f1;
          background: #f5f3ff;
          transform: scale(1.005);
        }
        .drop-zone:hover { border-color: #a5b4fc; background: #fafafe; }
        .drop-zone-bg {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 60% 50% at 50% 100%, rgba(99,102,241,0.06) 0%, transparent 70%);
        }
        .drop-icon-wrap {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #eff6ff, #f5f3ff);
          border: 1px solid #e0e7ff;
          display: flex; align-items: center; justify-content: center;
          color: #6366f1;
        }
        .drop-zone.dragging .drop-icon-wrap { animation: pulse-ring 1s ease-in-out infinite; }
        .file-type-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .type-tag {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500; color: '#71717a';
          background: #f4f4f5; border: 1px solid #e4e4e7;
          border-radius: 6px; padding: 3px 8px;
          color: #71717a;
        }
        .upload-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff; border: none; border-radius: 11px;
          padding: 12px 28px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          box-shadow: 0 4px 14px rgba(99,102,241,0.35);
          transition: all 0.2s;
          width: 100%;
          justify-content: center;
        }
        .upload-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99,102,241,0.45);
        }
        .upload-btn:disabled { background: #e4e4e7; color: #a1a1aa; cursor: not-allowed; box-shadow: none; transform: none; }
        .tips-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tip-card {
          background: #fff; border: 1px solid #f0f0f0; border-radius: 12px;
          padding: 14px 16px; display: flex; gap: 10px; align-items: flex-start;
        }
        .tip-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: #f5f3ff; border: 1px solid #e0e7ff;
          display: flex; align-items: center; justify-content: center;
          color: #6366f1; flex-shrink: 0;
        }
        .summary-bar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: #fff; border: 1px solid #f0f0f0; border-radius: 12px;
          padding: 12px 16px;
        }
        .summary-chip {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 500;
        }
      `}</style>

      <div className="upload-page" style={{ animation: 'fadeUp 0.35s ease' }}>
        {/* Top bar */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #f0f0f0',
          padding: '12px 28px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#71717a', textDecoration: 'none', fontSize: 13,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#09090b')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#71717a')}
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <span style={{ color: '#e4e4e7' }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>Upload receipts</span>
          </div>

          {allDone && doneCount > 0 && (
            <Link href="/dashboard/receipts" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#f0fdf4', color: '#16a34a',
              border: '1px solid #bbf7d0', borderRadius: 9,
              padding: '6px 14px', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              <CheckCircle2 size={13} />
              View all results
            </Link>
          )}
        </div>

        <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}>

          {/* Drop zone */}
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-zone-bg" />
            <div className="drop-icon-wrap">
              <CloudUpload size={28} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#09090b', marginBottom: 4 }}>
                {dragging ? 'Drop to queue' : 'Drop receipts here'}
              </div>
              <div style={{ fontSize: 13, color: '#71717a', fontWeight: 300 }}>
                or <span style={{ color: '#6366f1', fontWeight: 500 }}>click to browse files</span>
              </div>
            </div>
            <div className="file-type-tags">
              {['JPG', 'PNG', 'HEIC', 'WEBP', 'PDF'].map(t => (
                <span key={t} className="type-tag">{t}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#d4d4d8', fontFamily: 'monospace' }}>
              MAX {MAX_MB}MB PER FILE · BATCH UPLOAD SUPPORTED
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              multiple
              style={{ display: 'none' }}
              onChange={e => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div style={{ marginTop: 20 }}>

              {/* Summary bar */}
              <div className="summary-bar" style={{ marginBottom: 14 }}>
                <div className="summary-chip" style={{ color: '#52525b' }}>
                  <FileText size={13} color="#6366f1" />
                  {queue.length} file{queue.length !== 1 ? 's' : ''}
                </div>
                {pendingCount > 0 && (
                  <div className="summary-chip" style={{ color: '#6366f1' }}>
                    <Upload size={12} /> {pendingCount} ready
                  </div>
                )}
                {doneCount > 0 && (
                  <div className="summary-chip" style={{ color: '#16a34a' }}>
                    <CheckCircle2 size={12} /> {doneCount} complete
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="summary-chip" style={{ color: '#ef4444' }}>
                    <AlertCircle size={12} /> {errorCount} failed
                  </div>
                )}
                <div style={{ flex: 1 }} />
                {pendingCount > 0 && !uploading && (
                  <button
                    onClick={() => setQueue([])}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#a1a1aa', fontSize: 12, fontFamily: 'DM Sans, sans-serif',
                      display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#a1a1aa')}
                  >
                    <X size={12} /> Clear all
                  </button>
                )}
              </div>

              {/* File cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {queue.map(item => (
                  <FileCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeFile(item.id)}
                  />
                ))}
              </div>

              {/* Upload button */}
              {pendingCount > 0 && (
                <button
                  className="upload-btn"
                  onClick={uploadAll}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                      Analyzing receipts…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Analyze {pendingCount} receipt{pendingCount !== 1 ? 's' : ''}
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              )}

              {/* All done CTA */}
              {allDone && doneCount > 0 && errorCount === 0 && (
                <div style={{
                  marginTop: 4, background: '#f0fdf4',
                  border: '1px solid #bbf7d0', borderRadius: 12,
                  padding: '16px 20px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={20} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#14532d' }}>
                        {doneCount} receipt{doneCount !== 1 ? 's' : ''} analyzed
                      </div>
                      <div style={{ fontSize: 12, color: '#16a34a', marginTop: 1 }}>
                        Review the full fraud reports below
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setQueue([])}
                      style={{
                        background: 'none', border: '1px solid #86efac', borderRadius: 8,
                        padding: '7px 14px', fontSize: 12, fontWeight: 500,
                        color: '#16a34a', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      Upload more
                    </button>
                    <Link href="/dashboard/receipts" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: '#16a34a', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '7px 14px', fontSize: 12,
                      fontWeight: 600, textDecoration: 'none',
                    }}>
                      View all receipts <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tips section (shown when queue is empty) */}
          {queue.length === 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                What gets checked
              </div>
              <div className="tips-grid">
                {[
                  { icon: <ShieldCheck size={15} />, title: 'Math validation', desc: 'Subtotal + tax + tip must equal total. Line items verified.' },
                  { icon: <Sparkles size={15} />, title: 'Image forensics', desc: 'Error Level Analysis detects JPEG edits and pasted regions.' },
                  { icon: <Eye size={15} />, title: 'OCR extraction', desc: 'Merchant, date, amounts, transaction ID all extracted and stored.' },
                  { icon: <AlertCircle size={15} />, title: 'Tax rate check', desc: 'Rate validated against merchant state and city tax schedules.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="tip-card">
                    <div className="tip-icon">{icon}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b', marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, fontWeight: 300 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 14, padding: '12px 16px',
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <AlertCircle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  <strong>Analysis takes 2–5 seconds per receipt.</strong> Results include a fraud risk score, OCR data, and specific flag explanations. High-risk receipts are queued for manual review.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
