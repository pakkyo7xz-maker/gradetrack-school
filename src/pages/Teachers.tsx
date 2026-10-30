import { useMemo, useState } from 'react';
import TeacherDrawer from '../components/TeacherDrawer';
import TeacherTable, { type DrawerPreset } from '../components/TeacherTable';
import type { UpdateTracking } from '../components/TrackingTable';
import { PageHeader } from '../components/ui';
import { compareClassroom } from '../lib/normalize';
import { exportTeacherPdf, exportTeachersPdf } from '../lib/pdf';
import { teacherStats } from '../lib/stats';
import { exportTeachers } from '../lib/statsExport';
import type { Filters, Row } from '../lib/types';

export interface TeacherFocus {
  name: string;
  preset?: DrawerPreset;
}

interface Props {
  rows: Row[];
  focus: TeacherFocus | null;
  setFocus: (f: TeacherFocus | null) => void;
  onUpdate: UpdateTracking;
  goTracking: (f: Partial<Filters>) => void;
}

export default function Teachers({ rows, focus, setFocus, onUpdate, goTracking }: Props) {
  const [q, setQ] = useState('');
  const all = useMemo(() => teacherStats(rows), [rows]);
  const teachers = all.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));
  const current = focus ? all.find((t) => t.label === focus.name) : undefined;

  // ครูประจำชั้น (ถ้ามีในไฟล์)
  const homerooms = Object.entries(
    rows.reduce<Record<string, Set<string>>>((acc, r) => {
      if (r.homeroomTeacher) (acc[r.classroom] ??= new Set()).add(r.homeroomTeacher);
      return acc;
    }, {}),
  ).sort(([a], [b]) => compareClassroom(a, b));

  return (
    <div>
      <PageHeader
        title="ครูผู้สอน"
        subtitle="คลิกชื่อครูหรือตัวเลขเพื่อดูว่านักเรียนคนไหนติดวิชาอะไร · ตัวเลข 0 / ร / มส เป็นจำนวนรายการรายวิชา"
        actions={
          <>
            <button className="btn-ghost" disabled={teachers.length === 0} onClick={() => exportTeachers(teachers)}>⬇ Excel</button>
            <button className="btn-primary" disabled={teachers.length === 0} onClick={() => exportTeachersPdf(teachers)}>⬇ PDF สรุปครู ({teachers.length})</button>
          </>
        }
      />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <label className="sr-only" htmlFor="teacher-q">ค้นหาชื่อครู</label>
          <input id="teacher-q" className="input sm:max-w-xs" placeholder="ค้นหาชื่อครู…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TeacherTable
          teachers={teachers}
          onOpen={(name, preset) => setFocus({ name, preset })}
          onExportPdf={(t) => exportTeacherPdf(t.label, t.subjects, t.rows, '')}
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

      {current && (
        <TeacherDrawer
          key={`${current.label}|${focus?.preset?.result ?? ''}|${focus?.preset?.status ?? ''}`}
          teacher={current}
          allRows={rows}
          preset={focus?.preset}
          onClose={() => setFocus(null)}
          onUpdate={onUpdate}
          goTracking={goTracking}
        />
      )}
    </div>
  );
}
