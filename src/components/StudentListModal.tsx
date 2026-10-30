import { studentKey } from '../lib/selectors';
import type { Filters, Row } from '../lib/types';
import { OverdueBadge, ResultBadge, StatusBadge } from './ui';

export interface Drill {
  title: string;
  rows: Row[];
  /** 'students' = จัดกลุ่มตามคน, 'records' = แสดงทีละรายการ */
  view: 'students' | 'records';
  /** ตัวกรองที่ใช้เมื่อเปิดในหน้าติดตาม */
  filters: Partial<Filters>;
}

export default function StudentListModal({ drill, onClose, onOpenTracking }: { drill: Drill | null; onClose: () => void; onOpenTracking?: (f: Partial<Filters>) => void }) {
  if (!drill) return null;
  const groups = Object.values(
    drill.rows.reduce<Record<string, Row[]>>((acc, r) => {
      (acc[studentKey(r)] ??= []).push(r);
      return acc;
    }, {}),
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-slate-900">{drill.title}</h2>
            <p className="text-xs text-slate-500">นักเรียน {groups.length} คน · {drill.rows.length} รายการรายวิชา</p>
          </div>
          <button className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">ไม่มีรายการ</div>
          ) : drill.view === 'students' ? (
            <ul className="divide-y divide-slate-100">
              {groups.map((items, i) => (
                <li key={studentKey(items[0])} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="w-6 text-xs text-slate-400">{i + 1}.</span>
                    <span className="font-medium">{items[0].studentName}</span>
                    <span className="text-xs text-slate-400">{items[0].classroom}{items[0].studentId && ` · ${items[0].studentId}`}</span>
                  </div>
                  <div className="ml-8 mt-1 space-y-1">
                    {items.map((r) => (
                      <div key={r.key} className="flex flex-wrap items-center gap-2 text-xs">
                        <ResultBadge result={r.result} />
                        <span>{r.subjectName}</span>
                        <span className="text-slate-400">({r.teacher || 'ไม่ระบุครู'})</span>
                        <StatusBadge status={r.tracking.status} />
                        {r.overdue && <OverdueBadge />}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {drill.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="td"><div className="font-medium">{r.studentName}</div><div className="text-xs text-slate-400">{r.classroom}</div></td>
                    <td className="td">{r.subjectName}<div className="text-xs text-slate-400">{r.teacher || 'ไม่ระบุครู'}</div></td>
                    <td className="td"><ResultBadge result={r.result} /></td>
                    <td className="td"><StatusBadge status={r.tracking.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {onOpenTracking && (
          <div className="border-t border-slate-100 p-3 text-right">
            <button className="btn-primary" onClick={() => onOpenTracking(drill.filters)}>เปิดในหน้าติดตามเพื่อแก้ไขสถานะ →</button>
          </div>
        )}
      </div>
    </div>
  );
}
