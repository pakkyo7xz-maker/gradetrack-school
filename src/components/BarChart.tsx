import { useState } from 'react';
import { fmtNum, fmtPct, type GroupStats } from '../lib/stats';
import { GRADE_RESULTS, type GradeResult } from '../lib/types';

// สีผ่านการตรวจ CVD/normal-vision แล้ว (ลำดับคงที่ 0 → ร → มส)
export const RESULT_COLOR: Record<GradeResult, string> = { '0': '#e11d48', ร: '#f59e0b', มส: '#6366f1' };

export type ChartMetric = 'students' | 'pct' | 'records';
const METRICS: { value: ChartMetric; label: string }[] = [
  { value: 'students', label: 'จำนวนคน' },
  { value: 'pct', label: 'ร้อยละ' },
  { value: 'records', label: 'จำนวนรายการ' },
];

function valueOf(g: GroupStats, t: GradeResult, m: ChartMetric): number | null {
  if (m === 'students') return g.studentsByType[t];
  if (m === 'records') return g.recordsByType[t];
  return g.pctByType[t];
}

/** กราฟแท่งแบบกลุ่ม: เปรียบเทียบ 0 / ร / มส ในแต่ละกลุ่ม (ระดับชั้นหรือห้อง) */
export default function GroupedBarChart({ groups, title, onBarClick }: { groups: GroupStats[]; title: string; onBarClick?: (g: GroupStats, t: GradeResult) => void }) {
  const [metric, setMetric] = useState<ChartMetric>('students');
  const [hover, setHover] = useState<{ g: GroupStats; t: GradeResult } | null>(null);
  const values = groups.flatMap((g) => GRADE_RESULTS.map((t) => valueOf(g, t, metric) ?? 0));
  const max = Math.max(1, ...values);
  const missingPct = metric === 'pct' && groups.some((g) => g.enrolled === null);
  const fmt = (v: number | null) => (metric === 'pct' ? fmtPct(v) : fmtNum(v));
  const H = 180;

  return (
    <div className="card min-w-0 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {METRICS.map((m) => (
            <button key={m.value} onClick={() => setMetric(m.value)} className={`rounded-md px-2.5 py-1 font-medium ${metric === m.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
        {GRADE_RESULTS.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: RESULT_COLOR[t] }} />
            ติด {t}
          </span>
        ))}
        <span className="text-slate-400">· {metric === 'records' ? 'นับรายวิชา' : 'นับคนไม่ซ้ำ'}</span>
      </div>

      <div className="relative h-6 text-xs text-slate-700">
        {hover && (
          <span>
            <b>{hover.g.label}</b> · ติด {hover.t}: <b>{fmt(valueOf(hover.g, hover.t, metric))}</b>
            {metric !== 'records' && hover.g.enrolled !== null && <span className="text-slate-400"> (จาก {hover.g.enrolled} คน)</span>}
            {onBarClick && <span className="text-slate-400"> — คลิกเพื่อดูรายชื่อ</span>}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-full items-end gap-3 border-b border-slate-200 px-1" style={{ height: H + 18, minWidth: groups.length * 64 }}>
          {groups.map((g) => (
            <div key={g.key} className="flex flex-1 flex-col items-center">
              <div className="flex items-end gap-[2px]" style={{ height: H }}>
                {GRADE_RESULTS.map((t) => {
                  const v = valueOf(g, t, metric);
                  const h = v === null ? 0 : Math.max(v > 0 ? 3 : 0, (v / max) * (H - 18));
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!onBarClick}
                      onMouseEnter={() => setHover({ g, t })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ g, t })}
                      onClick={() => onBarClick?.(g, t)}
                      className="group flex h-full w-4 flex-col items-center justify-end sm:w-5"
                      aria-label={`${g.label} ติด ${t}: ${fmt(v)}`}
                    >
                      <span className="mb-0.5 text-[10px] tabular-nums text-slate-500">{v === null ? '—' : metric === 'pct' ? v.toFixed(1) : v}</span>
                      <span
                        className="w-full rounded-t transition-opacity group-hover:opacity-80"
                        style={{ height: h, background: RESULT_COLOR[t], opacity: hover && (hover.g !== g || hover.t !== t) ? 0.45 : 1 }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-1 pt-1.5" style={{ minWidth: groups.length * 64 }}>
          {groups.map((g) => (
            <div key={g.key} className="flex-1 text-center text-xs font-medium text-slate-600">{g.label}</div>
          ))}
        </div>
      </div>
      {missingPct && <p className="mt-2 text-xs text-amber-700">กลุ่มที่แสดง "—" ไม่มีจำนวนนักเรียนทั้งหมดที่เชื่อถือได้ จึงไม่คำนวณร้อยละ</p>}
    </div>
  );
}
