import { fmtPct, type TeacherStats } from '../lib/stats';
import { GRADE_RESULTS, type GradeResult } from '../lib/types';
import { Empty, ResultBadge } from './ui';

/** ตัวกรองเริ่มต้นเมื่อเปิดรายละเอียดครูจากตัวเลขที่คลิก */
export interface DrawerPreset {
  result?: GradeResult;
  status?: 'open' | 'done';
}

interface Props {
  teachers: TeacherStats[];
  onOpen: (name: string, preset?: DrawerPreset) => void;
  onExportPdf?: (t: TeacherStats) => void;
}

const progressOf = (t: TeacherStats) => (t.records ? (t.status.done / t.records) * 100 : 0);

function Count({ n, onClick, className = '' }: { n: number; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} disabled={n === 0} className={`tabular-nums enabled:hover:underline disabled:text-slate-300 ${className}`}>
      {n.toLocaleString('th-TH')}
    </button>
  );
}

function Progress({ t }: { t: TeacherStats }) {
  const p = progressOf(t);
  return (
    <div className="flex min-w-[8rem] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
      </div>
      <span className="w-14 text-right text-xs tabular-nums text-slate-600">{fmtPct(t.records ? p : null)}</span>
    </div>
  );
}

/** ตารางสรุปครูผู้สอน: แสดงเฉพาะตัวเลข รายวิชาทั้งหมดอยู่ในหน้ารายละเอียด */
export default function TeacherTable({ teachers, onOpen, onExportPdf }: Props) {
  if (teachers.length === 0) return <Empty>ไม่พบข้อมูลครู</Empty>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="th">ครูผู้สอน</th>
              <th className="th text-right">รายวิชา</th>
              <th className="th text-right">นักเรียนที่ติด<div className="font-normal text-slate-400">(คนไม่ซ้ำ)</div></th>
              {GRADE_RESULTS.map((g) => (
                <th key={g} className="th text-right">รายการ {g}</th>
              ))}
              <th className="th text-right">ยังไม่แก้ไข</th>
              <th className="th text-right">แก้ไขสำเร็จ</th>
              <th className="th">ความคืบหน้า</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teachers.map((t) => (
              <tr key={t.key} className="hover:bg-slate-50/60">
                <td className="td whitespace-nowrap">
                  <button className="font-medium text-blue-700 hover:underline" onClick={() => onOpen(t.label)}>{t.label}</button>
                </td>
                <td className="td text-right tabular-nums">{t.subjects.length}</td>
                <td className="td text-right">
                  <Count n={t.students} onClick={() => onOpen(t.label)} className="font-semibold text-blue-700" />
                </td>
                {GRADE_RESULTS.map((g) => (
                  <td key={g} className="td text-right">
                    <Count n={t.recordsByType[g]} onClick={() => onOpen(t.label, { result: g })} className="text-slate-700" />
                  </td>
                ))}
                <td className="td text-right"><Count n={t.records - t.status.done} onClick={() => onOpen(t.label, { status: 'open' })} className="font-semibold text-rose-600" /></td>
                <td className="td text-right"><Count n={t.status.done} onClick={() => onOpen(t.label, { status: 'done' })} className="font-semibold text-emerald-600" /></td>
                <td className="td"><Progress t={t} /></td>
                <td className="td whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => onOpen(t.label)}>ดูรายละเอียด</button>
                    {onExportPdf && <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => onExportPdf(t)}>ส่งออก PDF</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* โทรศัพท์: การ์ด */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {teachers.map((t) => (
          <li key={t.key} className="space-y-2.5 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <button className="text-left font-semibold text-blue-700" onClick={() => onOpen(t.label)}>{t.label}</button>
              <span className="text-xs text-slate-500">{t.subjects.length} วิชา</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                <Count n={t.students} onClick={() => onOpen(t.label)} className="font-semibold text-blue-700" /> <span className="text-xs text-slate-500">คน</span>
              </span>
              {GRADE_RESULTS.map((g) => (
                <span key={g} className="inline-flex items-center gap-1">
                  <ResultBadge result={g} />
                  <Count n={t.recordsByType[g]} onClick={() => onOpen(t.label, { result: g })} />
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span>ยังไม่แก้ไข <b className="text-rose-600">{t.records - t.status.done}</b></span>
              <span>สำเร็จ <b className="text-emerald-600">{t.status.done}</b></span>
              <div className="flex-1"><Progress t={t} /></div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={() => onOpen(t.label)}>ดูรายละเอียด</button>
              {onExportPdf && <button className="btn-ghost flex-1 py-1.5 text-xs" onClick={() => onExportPdf(t)}>ส่งออก PDF</button>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
