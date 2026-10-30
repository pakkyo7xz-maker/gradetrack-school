import type { TeacherStats } from '../lib/stats';
import { STATUSES, type TrackingStatus } from '../lib/types';
import { Empty } from './ui';

const STATUS_BAR: Record<TrackingStatus, string> = { pending: 'bg-slate-300', in_progress: 'bg-blue-500', review: 'bg-amber-400', done: 'bg-emerald-500' };

export default function TeacherTable({ teachers, onSelectTeacher, onDrill }: { teachers: TeacherStats[]; onSelectTeacher: (name: string) => void; onDrill: (t: TeacherStats) => void }) {
  if (teachers.length === 0) return <Empty>ไม่พบข้อมูลครู</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr>
            <th className="th">ชื่อ-นามสกุลครู</th>
            <th className="th">รายวิชาที่รับผิดชอบ</th>
            <th className="th text-right">นักเรียนที่ติด</th>
            <th className="th text-right">รายการ (0 / ร / มส)</th>
            <th className="th">สถานะการติดตาม</th>
            <th className="th text-right">ยังไม่แก้ไข</th>
            <th className="th text-right">แก้ไขแล้ว</th>
            <th className="th text-right">เกินกำหนด</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {teachers.map((t) => (
            <tr key={t.key} className="hover:bg-slate-50/60">
              <td className="td">
                <button className="whitespace-nowrap font-medium text-blue-600 hover:underline" onClick={() => onSelectTeacher(t.label)}>{t.label}</button>
                <div className="max-w-[14rem] text-xs text-slate-400">{t.classrooms.length} ห้อง: {t.classrooms.join(', ')}</div>
              </td>
              <td className="td">
                <div className="flex min-w-[12rem] flex-wrap gap-1">
                  {t.subjects.map((s) => <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{s}</span>)}
                </div>
              </td>
              <td className="td whitespace-nowrap text-right">
                <button className="font-semibold tabular-nums text-blue-700 hover:underline" onClick={() => onDrill(t)}>{t.students}</button>
                <span className="text-xs text-slate-400"> คน</span>
              </td>
              <td className="td whitespace-nowrap text-right tabular-nums">
                {t.records} <span className="text-xs text-slate-400">({t.recordsByType['0']} / {t.recordsByType['ร']} / {t.recordsByType['มส']})</span>
              </td>
              <td className="td min-w-[11rem]">
                <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-slate-100" title={STATUSES.map((s) => `${s.label} ${t.status[s.value]}`).join(' · ')}>
                  {STATUSES.map((s) => t.status[s.value] > 0 && <div key={s.value} className={STATUS_BAR[s.value]} style={{ width: `${(t.status[s.value] / t.records) * 100}%` }} />)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {STATUSES.map((s) => `${s.label} ${t.status[s.value]}`).join(' · ')}
                </div>
              </td>
              <td className="td text-right font-semibold tabular-nums text-rose-600">{t.records - t.status.done}</td>
              <td className="td text-right font-semibold tabular-nums text-emerald-600">{t.status.done}</td>
              <td className="td text-right tabular-nums">{t.overdue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
