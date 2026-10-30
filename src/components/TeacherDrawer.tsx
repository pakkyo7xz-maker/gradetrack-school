import { useEffect, useMemo, useRef, useState } from 'react';
import { exportRowsToExcel, stamp } from '../lib/excel';
import { compact, compareClassroom, levelOf } from '../lib/normalize';
import { exportTeacherPdf } from '../lib/pdf';
import { studentKey, uniqueSorted } from '../lib/selectors';
import { fmtPct, type TeacherStats } from '../lib/stats';
import { GRADE_RESULTS, STATUSES, type Filters, type GradeResult, type Row, type TrackingStatus } from '../lib/types';
import type { DrawerPreset } from './TeacherTable';
import TrackingTable, { type UpdateTracking } from './TrackingTable';
import { ResultBadge } from './ui';

type StatusFilter = '' | TrackingStatus | 'open' | 'overdue';

interface Props {
  teacher: TeacherStats;
  /** ทุกรายการในระบบ (ใช้แสดงทุกวิชาที่นักเรียนติด ไม่จำกัดครูคนนี้) */
  allRows: Row[];
  preset?: DrawerPreset;
  onClose: () => void;
  onUpdate: UpdateTracking;
  goTracking: (f: Partial<Filters>) => void;
}

const subjectLabel = (r: Row) => (r.subjectCode ? `${r.subjectCode} ${r.subjectName}` : r.subjectName);
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'open', label: 'ยังไม่แก้ไข (ทั้งหมด)' },
  ...STATUSES,
  { value: 'overdue', label: 'เกินกำหนด' },
];

function matchStatus(r: Row, s: StatusFilter) {
  if (!s) return true;
  if (s === 'open') return r.tracking.status !== 'done';
  if (s === 'overdue') return r.overdue;
  return r.tracking.status === s;
}

/** สรุป คน / รายการ / ค้าง / สำเร็จ ของชุดรายการ */
function summarize(rows: Row[]) {
  const people = new Set(rows.map(studentKey)).size;
  const done = rows.filter((r) => r.tracking.status === 'done').length;
  const byType = Object.fromEntries(
    GRADE_RESULTS.map((g) => {
      const rs = rows.filter((r) => r.result === g);
      return [g, { people: new Set(rs.map(studentKey)).size, records: rs.length }];
    }),
  ) as Record<GradeResult, { people: number; records: number }>;
  return { people, records: rows.length, done, open: rows.length - done, byType };
}

export default function TeacherDrawer({ teacher, allRows, preset, onClose, onUpdate, goTracking }: Props) {
  const rows = teacher.rows;
  const [level, setLevel] = useState('');
  const [room, setRoom] = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult] = useState<'' | GradeResult>(preset?.result ?? '');
  const [status, setStatus] = useState<StatusFilter>(preset?.status ?? '');
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // ปิดด้วย Esc และล็อกการเลื่อนหน้าหลักขณะเปิด
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (student ? setStudent(null) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, student]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    // ต้องไม่คืนค่าจาก scrollTo (เบราว์เซอร์ใหม่คืน Promise ซึ่ง React จะเข้าใจว่าเป็นฟังก์ชัน cleanup)
    panel.current?.scrollTo({ top: 0 });
  }, [student]);

  const subjects = useMemo(() => uniqueSorted(rows.map(subjectLabel)), [rows]);
  const levels = useMemo(() => uniqueSorted(rows.map((r) => levelOf(r.classroom)), compareClassroom), [rows]);
  const rooms = useMemo(() => uniqueSorted(rows.filter((r) => !level || levelOf(r.classroom) === level).map((r) => r.classroom), compareClassroom), [rows, level]);

  const filtered = useMemo(() => {
    const s = compact(q);
    return rows.filter(
      (r) =>
        (!level || levelOf(r.classroom) === level) &&
        (!room || r.classroom === room) &&
        (!subject || subjectLabel(r) === subject) &&
        (!result || r.result === result) &&
        matchStatus(r, status) &&
        (!s || compact(r.studentName).includes(s) || compact(r.studentId).includes(s)),
    );
  }, [rows, level, room, subject, result, status, q]);
  const sum = summarize(filtered);
  const subjectCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(subjectLabel(r), (m.get(subjectLabel(r)) ?? 0) + 1));
    return m;
  }, [rows]);

  const filterText = [
    level && `ระดับ ${level}`,
    room && `ห้อง ${room}`,
    subject && `วิชา ${subject}`,
    result && `ผล ${result}`,
    status && STATUS_OPTIONS.find((o) => o.value === status)?.label,
    q && `ค้นหา "${q}"`,
  ]
    .filter(Boolean)
    .join(' · ');
  const clear = () => {
    setLevel('');
    setRoom('');
    setSubject('');
    setResult('');
    setStatus('');
    setQ('');
  };

  const studentRows = student ? allRows.filter((r) => studentKey(r) === student) : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`รายละเอียด ${teacher.label}`}>
      <div className="absolute inset-0 hidden bg-slate-900/30 md:block" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className="relative flex h-full w-full flex-col overflow-y-auto bg-slate-100 shadow-2xl outline-none md:w-[min(68rem,94vw)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {student ? (
                <button className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setStudent(null)}>← กลับไปรายการของ {teacher.label}</button>
              ) : (
                <>
                  <div className="text-xs text-slate-500">ครูผู้สอน</div>
                  <h2 className="truncate text-lg font-bold text-slate-900">{teacher.label}</h2>
                </>
              )}
            </div>
            <button className="rounded-lg px-2.5 py-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="ปิด">✕</button>
          </div>
          {!student && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary py-1.5 text-xs" disabled={filtered.length === 0} onClick={() => exportTeacherPdf(teacher.label, subjects, filtered, filterText)}>⬇ ส่งออก PDF ({filtered.length})</button>
              <button className="btn-ghost py-1.5 text-xs" disabled={filtered.length === 0} onClick={() => exportRowsToExcel(filtered, `gradetrack-teacher-${stamp()}.xlsx`)}>⬇ Excel</button>
              <button className="btn-ghost py-1.5 text-xs" onClick={() => { onClose(); goTracking({ teacher: teacher.label }); }}>เปิดในหน้าติดตาม</button>
            </div>
          )}
        </header>

        {student ? (
          <StudentPanel rows={studentRows} teacher={teacher.label} onUpdate={onUpdate} />
        ) : (
          <div className="space-y-4 p-4 sm:p-6">
            <section className="card p-4">
              <div className="mb-2 text-sm font-semibold">รายวิชาที่รับผิดชอบ ({subjects.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(subject === s ? '' : s)}
                    className={`rounded-md px-2 py-1 text-xs ring-1 ring-inset transition ${subject === s ? 'bg-blue-600 text-white ring-blue-600' : 'bg-slate-50 text-slate-700 ring-slate-200 hover:ring-blue-300'}`}
                  >
                    {s} <span className={subject === s ? 'text-blue-100' : 'text-slate-400'}>({subjectCounts.get(s)})</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="นักเรียน (คนไม่ซ้ำ)" value={sum.people} tone="text-blue-700" />
              <Tile label="รายการรายวิชา" value={sum.records} />
              <Tile label="ค้างแก้ไข" value={sum.open} tone="text-rose-600" />
              <Tile label="แก้ไขสำเร็จ" value={sum.done} tone="text-emerald-600" sub={fmtPct(sum.records ? (sum.done / sum.records) * 100 : null)} />
              {GRADE_RESULTS.map((g) => (
                <button
                  key={g}
                  onClick={() => setResult(result === g ? '' : g)}
                  className={`card flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${result === g ? 'ring-2 ring-blue-500' : 'hover:border-blue-300'}`}
                >
                  <ResultBadge result={g} />
                  <span className="tabular-nums"><b>{sum.byType[g].people}</b> <span className="text-xs text-slate-500">คน</span> · <b>{sum.byType[g].records}</b> <span className="text-xs text-slate-500">รายการ</span></span>
                </button>
              ))}
            </section>

            <section className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <label className="label" htmlFor="dr-q">ค้นหาชื่อ / รหัสนักเรียน</label>
                <input id="dr-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อนักเรียน…" />
              </div>
              <Pick id="dr-level" label="ระดับชั้น" value={level} onChange={(v) => { setLevel(v); setRoom(''); }} options={levels.map((l) => [l, l])} all="ทุกระดับ" />
              <Pick id="dr-room" label="ห้องเรียน" value={room} onChange={setRoom} options={rooms.map((r) => [r, r])} all="ทุกห้อง" />
              <Pick id="dr-subject" label="รายวิชา" value={subject} onChange={setSubject} options={subjects.map((s) => [s, s])} all="ทุกวิชา" />
              <Pick id="dr-result" label="ผลการเรียน" value={result} onChange={(v) => setResult(v as GradeResult | '')} options={GRADE_RESULTS.map((g) => [g, g])} all="ทั้งหมด" />
              <Pick id="dr-status" label="สถานะการติดตาม" value={status} onChange={(v) => setStatus(v as StatusFilter)} options={STATUS_OPTIONS.slice(1).map((o) => [o.value, o.label])} all="ทุกสถานะ" />
              <div className="flex items-end">
                {filterText && <button className="mb-2 text-xs font-medium text-blue-600 hover:underline" onClick={clear}>ล้างตัวกรอง</button>}
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 text-sm">
                <b>รายชื่อนักเรียน</b> <span className="text-slate-500">· คลิกชื่อเพื่อดูทุกวิชาที่นักเรียนติด</span>
              </div>
              <TrackingTable rows={filtered} onUpdate={onUpdate} hideTeacher onStudentClick={(r) => setStudent(studentKey(r))} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** ทุกวิชาที่นักเรียนคนนี้ติด (ทุกครู) */
function StudentPanel({ rows, teacher, onUpdate }: { rows: Row[]; teacher: string; onUpdate: UpdateTracking }) {
  if (rows.length === 0) return <div className="p-6 text-sm text-slate-500">ไม่พบข้อมูลนักเรียน</div>;
  const s = rows[0];
  const sum = summarize(rows);
  const teachers = uniqueSorted(rows.map((r) => r.teacher || 'ไม่ระบุครู'));
  const mine = rows.filter((r) => r.teacher === teacher).length;
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <section className="card p-4">
        <div className="text-xs text-slate-500">นักเรียน</div>
        <h3 className="text-lg font-bold text-slate-900">{s.studentName}</h3>
        <div className="mt-0.5 text-sm text-slate-600">
          {s.classroom}
          {s.studentNo && ` · เลขที่ ${s.studentNo}`}
          {s.studentId && ` · รหัส ${s.studentId}`}
          {s.homeroomTeacher && ` · ครูประจำชั้น ${s.homeroomTeacher}`}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="รายการรายวิชาที่ติด" value={sum.records} sub={`ของ ${teacher} ${mine} วิชา`} />
        <Tile label="ครูที่เกี่ยวข้อง" value={teachers.length} unit="คน" />
        <Tile label="ค้างแก้ไข" value={sum.open} tone="text-rose-600" />
        <Tile label="แก้ไขสำเร็จ" value={sum.done} tone="text-emerald-600" />
      </section>
      <div className="flex flex-wrap gap-3 text-sm">
        {GRADE_RESULTS.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5"><ResultBadge result={g} /> {sum.byType[g].records} วิชา</span>
        ))}
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ทุกวิชาที่ติด (รวมวิชาของครูท่านอื่น)</div>
        <TrackingTable rows={rows} onUpdate={onUpdate} hideClassroom />
      </section>
    </div>
  );
}

function Tile({ label, value, tone = 'text-slate-900', sub, unit }: { label: string; value: number; tone?: string; sub?: string; unit?: string }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>
        {value.toLocaleString('th-TH')}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function Pick({ id, label, value, onChange, options, all }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; all: string }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
