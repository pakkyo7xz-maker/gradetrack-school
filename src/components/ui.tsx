import type { ReactNode } from 'react';
import { statusLabel, type GradeResult, type TrackingStatus } from '../lib/types';

const RESULT_STYLE: Record<GradeResult, string> = {
  '0': 'bg-rose-50 text-rose-700 ring-rose-200',
  ร: 'bg-amber-50 text-amber-800 ring-amber-200',
  มส: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

export function ResultBadge({ result }: { result: GradeResult }) {
  return (
    <span className={`inline-flex min-w-[2.25rem] justify-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${RESULT_STYLE[result]}`}>
      {result}
    </span>
  );
}

export const STATUS_STYLE: Record<TrackingStatus, string> = {
  pending: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  review: 'bg-amber-50 text-amber-700 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ status }: { status: TrackingStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

export function OverdueBadge() {
  return <span className="inline-flex whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">เกินกำหนด</span>;
}

export function StatCard({ label, value, hint, tone = 'slate', onClick }: { label: string; value: number; hint?: string; tone?: 'slate' | 'blue' | 'red' | 'amber' | 'violet' | 'emerald'; onClick?: () => void }) {
  const tones = {
    slate: 'text-slate-900',
    blue: 'text-blue-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    violet: 'text-violet-600',
    emerald: 'text-emerald-600',
  };
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="card p-4 text-left transition enabled:hover:border-blue-300 enabled:hover:shadow disabled:cursor-default">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value.toLocaleString('th-TH')}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function Alert({ tone = 'blue', children }: { tone?: 'blue' | 'amber' | 'red' | 'emerald'; children: ReactNode }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function ConfirmDialog({ open, title, children, confirmText = 'ยืนยัน', danger, onConfirm, onCancel }: { open: boolean; title: string; children: ReactNode; confirmText?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="mt-2 space-y-2 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>ยกเลิก</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
