import { useState } from 'react';
import { Empty, PageHeader } from '../components/ui';
import { compareClassroom } from '../lib/normalize';
import { studentKey, teacherOf, uniqueSorted } from '../lib/selectors';
import type { Row } from '../lib/types';

interface TeacherStat {
  name: string;
  subjects: string[];
  classrooms: string[];
  students: number;
  total: number;
  open: number;
  done: number;
}

export default function Teachers({ rows, onSelectTeacher }: { rows: Row[]; onSelectTeacher: (t: string) => void }) {
  const [q, setQ] = useState('');
  const groups = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[teacherOf(r)] ??= []).push(r);
    return acc;
  }, {});
  const stats: TeacherStat[] = Object.entries(groups)
    .map(([name, items]) => ({
      name,
      subjects: uniqueSorted(items.map((i) => (i.subjectCode ? `${i.subjectCode} ${i.subjectName}` : i.subjectName))),
      classrooms: uniqueSorted(items.map((i) => i.classroom), compareClassroom),
      students: new Set(items.map(studentKey)).size,
      total: items.length,
      open: items.filter((i) => i.tracking.status !== 'done').length,
      done: items.filter((i) => i.tracking.status === 'done').length,
    }))
    .filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'th'));

  // ครูประจำชั้น (ถ้ามีในไฟล์)
  const homerooms = Object.entries(
    rows.reduce<Record<string, Set<string>>>((acc, r) => {
      if (r.homeroomTeacher) (acc[r.classroom] ??= new Set()).add(r.homeroomTeacher);
      return acc;
    }, {}),
  ).sort(([a], [b]) => compareClassroom(a, b));

  return (
    <div>
      <PageHeader title="ครูผู้สอน" subtitle="คลิกชื่อครูเพื่อดูรายการที่เกี่ยวข้องในหน้าติดตาม" />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <input className="input sm:max-w-xs" placeholder="ค้นหาชื่อครู…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {stats.length === 0 ? (
          <Empty>ไม่พบข้อมูลครู</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  <th className="th">ชื่อ-นามสกุลครู</th>
                  <th className="th">รายวิชาที่รับผิดชอบ</th>
                  <th className="th text-right">นักเรียนที่ติด</th>
                  <th className="th text-right">ยังไม่แก้ไข</th>
                  <th className="th text-right">แก้ไขแล้ว</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((t) => (
                  <tr key={t.name} className="hover:bg-slate-50/60">
                    <td className="td whitespace-nowrap">
                      <button className="font-medium text-blue-600 hover:underline" onClick={() => onSelectTeacher(t.name)}>{t.name}</button>
                      <div className="text-xs text-slate-400">{t.classrooms.join(', ')}</div>
                    </td>
                    <td className="td">
                      <div className="flex min-w-[12rem] flex-wrap gap-1">
                        {t.subjects.map((s) => <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{s}</span>)}
                      </div>
                    </td>
                    <td className="td text-right tabular-nums">{t.students} <span className="text-xs text-slate-400">คน / {t.total} รายการ</span></td>
                    <td className="td text-right tabular-nums font-semibold text-red-600">{t.open}</td>
                    <td className="td text-right tabular-nums font-semibold text-emerald-600">{t.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {homerooms.length > 0 && (
        <div className="card mt-4 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ครูประจำชั้น</div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
            {homerooms.map(([room, names]) => (
              <div key={room} className="flex items-center gap-3 bg-white px-4 py-2.5 text-sm">
                <span className="w-12 font-medium">{room}</span>
                <span className="text-slate-600">{[...names].join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
