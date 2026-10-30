import { useMemo } from 'react';
import TrackingTable, { type UpdateTracking } from '../components/TrackingTable';
import { Empty, PageHeader, ResultBadge, StatCard, StatusBadge } from '../components/ui';
import { compareClassroom, levelOf } from '../lib/normalize';
import { classroomsOf, computeStats, studentKey, uniqueSorted } from '../lib/selectors';
import type { Row } from '../lib/types';

export default function Classrooms({ rows, classroom, setClassroom, onUpdate }: { rows: Row[]; classroom: string; setClassroom: (c: string) => void; onUpdate: UpdateTracking }) {
  const classrooms = useMemo(() => classroomsOf(rows), [rows]);
  const levels = useMemo(() => uniqueSorted(classrooms.map(levelOf), compareClassroom), [classrooms]);
  const current = classrooms.includes(classroom) ? classroom : classrooms[0] ?? '';
  const level = levelOf(current);
  const roomsInLevel = classrooms.filter((c) => levelOf(c) === level);

  const roomRows = rows.filter((r) => r.classroom === current);
  const stats = computeStats(roomRows);
  const homeroom = uniqueSorted(roomRows.map((r) => r.homeroomTeacher));
  const teachers = uniqueSorted(roomRows.map((r) => r.teacher));

  const students = Object.values(
    roomRows.reduce<Record<string, Row[]>>((acc, r) => {
      (acc[studentKey(r)] ??= []).push(r);
      return acc;
    }, {}),
  );

  return (
    <div>
      <PageHeader title="ห้องเรียน" subtitle="เลือกระดับชั้นและห้องเพื่อดูรายชื่อนักเรียนที่ติดผลการเรียน" />

      {classrooms.length === 0 ? (
        <div className="card"><Empty>ยังไม่มีข้อมูลห้องเรียน — นำเข้าไฟล์ Excel ก่อน</Empty></div>
      ) : (
        <>
          <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:max-w-md">
            <div>
              <label className="label">ระดับชั้น</label>
              <select className="input" value={level} onChange={(e) => setClassroom(classrooms.find((c) => levelOf(c) === e.target.value) ?? '')}>
                {levels.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">ห้อง</label>
              <select className="input" value={current} onChange={(e) => setClassroom(e.target.value)}>
                {roomsInLevel.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="นักเรียนที่ติด" value={stats.students} hint="คน" tone="blue" />
            <StatCard label="รายการทั้งหมด" value={stats.total} hint={`0: ${stats.zero} · ร: ${stats.r} · มส: ${stats.ms}`} />
            <StatCard label="แก้ไขสำเร็จ" value={stats.done} tone="emerald" />
            <StatCard label="เกินกำหนด" value={stats.overdue} tone="red" />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <div className="card p-4 text-sm">
              <div className="mb-1 font-semibold">ครูประจำชั้น</div>
              <div className="text-slate-600">{homeroom.length ? homeroom.join(', ') : <span className="text-slate-400">ไม่มีข้อมูลในไฟล์</span>}</div>
              <div className="mb-1 mt-3 font-semibold">ครูผู้สอนที่เกี่ยวข้อง</div>
              <div className="flex flex-wrap gap-1.5">
                {teachers.length ? teachers.map((t) => <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t}</span>) : <span className="text-slate-400">ไม่ระบุ</span>}
              </div>
            </div>
            <div className="card overflow-hidden lg:col-span-2">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">รายชื่อนักเรียน ({students.length} คน)</div>
              <ul className="divide-y divide-slate-100">
                {students.map((items) => {
                  const done = items.filter((i) => i.tracking.status === 'done').length;
                  return (
                    <li key={studentKey(items[0])} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {items[0].studentName}
                          {items[0].studentId && <span className="ml-2 text-xs font-normal text-slate-400">{items[0].studentId}</span>}
                        </div>
                        <span className="text-xs text-slate-500">{items.length} วิชา · สำเร็จ {done}</span>
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {items.map((i) => (
                          <div key={i.key} className="flex flex-wrap items-center gap-2 text-xs">
                            <ResultBadge result={i.result} />
                            <span className="text-slate-700">{i.subjectName}</span>
                            <span className="text-slate-400">({i.teacher || 'ไม่ระบุครู'})</span>
                            <StatusBadge status={i.tracking.status} />
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">แก้ไขสถานะรายการของห้อง {current}</div>
            <TrackingTable rows={roomRows} onUpdate={onUpdate} hideClassroom />
          </div>
        </>
      )}
    </div>
  );
}
