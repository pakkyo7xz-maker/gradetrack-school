import { fmtNum, fmtPct, type GroupStats } from '../lib/stats';
import { GRADE_RESULTS, type GradeResult } from '../lib/types';
import { RESULT_COLOR } from './BarChart';

export type DrillRequest = { group: GroupStats; result?: GradeResult; view: 'students' | 'records' };

function Num({ n, onClick, strong }: { n: number; onClick: () => void; strong?: boolean }) {
  return (
    <button onClick={onClick} disabled={n === 0} className={`tabular-nums enabled:text-blue-700 enabled:hover:underline disabled:text-slate-400 ${strong ? 'font-semibold' : ''}`}>
      {fmtNum(n)}
    </button>
  );
}

/** ตารางเปรียบเทียบจำนวนคน (ไม่ซ้ำ) / ร้อยละ / จำนวนรายการ ของแต่ละกลุ่ม */
export default function StatsTable({ groups, total, labelHeader, onDrill }: { groups: GroupStats[]; total?: GroupStats; labelHeader: string; onDrill: (d: DrillRequest) => void }) {
  const all = total ? [...groups, total] : groups;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            <th className="th" rowSpan={2}>{labelHeader}</th>
            <th className="th text-right" rowSpan={2}>นักเรียน<br />ทั้งหมด</th>
            <th className="th border-l border-slate-200 text-center" colSpan={2}>นักเรียนที่ติด</th>
            {GRADE_RESULTS.map((t) => (
              <th key={t} className="th border-l border-slate-200 text-center" colSpan={2}>
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: RESULT_COLOR[t] }} />ติด {t}
              </th>
            ))}
            <th className="th border-l border-slate-200 text-center" colSpan={4}>จำนวนรายการรายวิชา</th>
            <th className="th border-l border-slate-200 text-right" rowSpan={2}>สำเร็จ</th>
            <th className="th text-right" rowSpan={2}>เกิน<br />กำหนด</th>
          </tr>
          <tr>
            <th className="th border-l border-slate-200 text-right">คน</th>
            <th className="th text-right">ร้อยละ</th>
            {GRADE_RESULTS.map((t) => [
              <th key={t + 'n'} className="th border-l border-slate-200 text-right">คน</th>,
              <th key={t + 'p'} className="th text-right">ร้อยละ</th>,
            ])}
            <th className="th border-l border-slate-200 text-right">รวม</th>
            {GRADE_RESULTS.map((t) => <th key={t} className="th text-right">{t}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {all.map((g) => {
            const isTotal = g === total;
            return (
              <tr key={g.key} className={isTotal ? 'bg-slate-50 font-semibold' : 'hover:bg-slate-50/60'}>
                <td className="td whitespace-nowrap font-medium">{g.label}</td>
                <td className="td text-right tabular-nums" title={g.enrolledIssue}>
                  {g.enrolled === null ? <span className="cursor-help text-amber-600">—</span> : fmtNum(g.enrolled)}
                </td>
                <td className="td border-l border-slate-100 text-right"><Num n={g.students} strong onClick={() => onDrill({ group: g, view: 'students' })} /></td>
                <td className="td text-right tabular-nums" title={g.enrolledIssue}>{fmtPct(g.pct)}</td>
                {GRADE_RESULTS.map((t) => [
                  <td key={t + 'n'} className="td border-l border-slate-100 text-right"><Num n={g.studentsByType[t]} onClick={() => onDrill({ group: g, result: t, view: 'students' })} /></td>,
                  <td key={t + 'p'} className="td text-right tabular-nums text-slate-600">{fmtPct(g.pctByType[t])}</td>,
                ])}
                <td className="td border-l border-slate-100 text-right"><Num n={g.records} onClick={() => onDrill({ group: g, view: 'records' })} /></td>
                {GRADE_RESULTS.map((t) => (
                  <td key={t} className="td text-right"><Num n={g.recordsByType[t]} onClick={() => onDrill({ group: g, result: t, view: 'records' })} /></td>
                ))}
                <td className="td border-l border-slate-100 text-right tabular-nums text-emerald-700">{g.status.done}</td>
                <td className="td text-right tabular-nums text-rose-700">{g.overdue}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {all.some((g) => g.enrolled === null) && (
        <p className="px-4 py-2 text-xs text-amber-700">"—" = ไม่มีจำนวนนักเรียนทั้งหมดที่เชื่อถือได้ (วางเมาส์เพื่อดูเหตุผล) ระบบจะไม่คำนวณร้อยละแทน — เพิ่มได้ที่เมนู "จำนวนนักเรียน"</p>
      )}
    </div>
  );
}
