import { useMemo, useState } from 'react';
import StudentListModal, { type Drill } from '../components/StudentListModal';
import TeacherTable from '../components/TeacherTable';
import { PageHeader } from '../components/ui';
import { compareClassroom } from '../lib/normalize';
import { teacherStats } from '../lib/stats';
import type { Filters, Row } from '../lib/types';

export default function Teachers({ rows, goTracking }: { rows: Row[]; goTracking: (f: Partial<Filters>) => void }) {
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<Drill | null>(null);
  const all = useMemo(() => teacherStats(rows), [rows]);
  const teachers = all.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));

  // ครูประจำชั้น (ถ้ามีในไฟล์)
  const homerooms = Object.entries(
    rows.reduce<Record<string, Set<string>>>((acc, r) => {
      if (r.homeroomTeacher) (acc[r.classroom] ??= new Set()).add(r.homeroomTeacher);
      return acc;
    }, {}),
  ).sort(([a], [b]) => compareClassroom(a, b));

  return (
    <div>
      <PageHeader title="ครูผู้สอน" subtitle="คลิกชื่อครูเพื่อดูรายการในหน้าติดตาม · คลิกจำนวนนักเรียนเพื่อดูรายชื่อ" />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <input className="input sm:max-w-xs" placeholder="ค้นหาชื่อครู…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TeacherTable
          teachers={teachers}
          onSelectTeacher={(t) => goTracking({ teacher: t })}
          onDrill={(t) => setDrill({ title: `${t.label} · รายชื่อนักเรียน`, rows: t.rows, view: 'students', filters: { teacher: t.label } })}
        />
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
      <StudentListModal drill={drill} onClose={() => setDrill(null)} onOpenTracking={(f) => { setDrill(null); goTracking(f); }} />
    </div>
  );
}
