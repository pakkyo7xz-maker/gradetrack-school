import { useMemo, useState } from 'react';
import TeacherTable from '../components/TeacherTable';
import type { UpdateTracking } from '../components/TrackingTable';
import { PageHeader } from '../components/ui';
import { compareClassroom } from '../lib/normalize';
import { teacherStats } from '../lib/stats';
import type { Filters, Row } from '../lib/types';
import TeacherDetail from './TeacherDetail';

interface Props {
  rows: Row[];
  selected: string;
  setSelected: (name: string) => void;
  onUpdate: UpdateTracking;
  goTracking: (f: Partial<Filters>) => void;
}

export default function Teachers({ rows, selected, setSelected, onUpdate, goTracking }: Props) {
  const [q, setQ] = useState('');
  const all = useMemo(() => teacherStats(rows), [rows]);
  const current = all.find((t) => t.label === selected);
  const open = (name: string) => {
    setSelected(name);
    window.scrollTo({ top: 0 });
  };
  const teachers = all.filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()));

  // ครูประจำชั้น (ถ้ามีในไฟล์)
  const homerooms = Object.entries(
    rows.reduce<Record<string, Set<string>>>((acc, r) => {
      if (r.homeroomTeacher) (acc[r.classroom] ??= new Set()).add(r.homeroomTeacher);
      return acc;
    }, {}),
  ).sort(([a], [b]) => compareClassroom(a, b));

  if (current) return <TeacherDetail name={current.label} rows={current.rows} onBack={() => setSelected('')} onUpdate={onUpdate} goTracking={goTracking} />;

  return (
    <div>
      <PageHeader title="ครูผู้สอน" subtitle="คลิกชื่อครูเพื่อดูว่านักเรียนคนไหนติดวิชาอะไร" />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <input className="input sm:max-w-xs" placeholder="ค้นหาชื่อครู…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <TeacherTable
          teachers={teachers}
          onSelectTeacher={open}
          onDrill={(t) => open(t.label)}
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
    </div>
  );
}
