import { useMemo, useState } from 'react';
import { StatusSelect, type UpdateTracking } from '../components/TrackingTable';
import { Empty, OverdueBadge, ResultBadge, StatusBadge } from '../components/ui';
import { exportRowsToExcel, stamp } from '../lib/excel';
import { compact, compareClassroom } from '../lib/normalize';
import { studentKey, uniqueSorted } from '../lib/selectors';
import { GRADE_RESULTS, STATUSES, type Filters, type GradeResult, type Row, type TrackingStatus } from '../lib/types';

type View = 'subject' | 'student';

interface Props {
  name: string;
  rows: Row[];
  onBack: () => void;
  onUpdate: UpdateTracking;
  goTracking: (f: Partial<Filters>) => void;
}

const subjectLabel = (r: Row) => (r.subjectCode ? `${r.subjectCode} ${r.subjectName}` : r.subjectName);

/** รายละเอียดครู 1 คน: นักเรียนคนไหนติดวิชาอะไร */
export default function TeacherDetail({ name, rows, onBack, onUpdate, goTracking }: Props) {
  const [view, setView] = useState<View>('subject');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [result, setResult] = useState<'' | GradeResult>('');
  const [status, setStatus] = useState<'' | TrackingStatus>('');
  const [q, setQ] = useState('');

  const subjects = useMemo(() => uniqueSorted(rows.map(subjectLabel)), [rows]);
  const rooms = useMemo(() => uniqueSorted(rows.map((r) => r.classroom), compareClassroom), [rows]);
  const filtered = useMemo(() => {
    const s = compact(q);
    return rows.filter(
      (r) =>
        (!subject || subjectLabel(r) === subject) &&
        (!room || r.classroom === room) &&
        (!result || r.result === result) &&
        (!status || r.tracking.status === status) &&
        (!s || compact(r.studentName).includes(s) || compact(r.studentId).includes(s)),
    );
  }, [rows, subject, room, result, status, q]);

  const students = new Set(filtered.map(studentKey)).size;
  const count = (g: GradeResult) => filtered.filter((r) => r.result === g).length;
  const done = filtered.filter((r) => r.tracking.status === 'done').length;
  const overdue = filtered.filter((r) => r.overdue).length;
  const filtering = !!(subject || room || result || status || q);

  const bySubject = useMemo(() => groupBy(filtered, subjectLabel).sort(([a], [b]) => a.localeCompare(b, 'th')), [filtered]);
  const byStudent = useMemo(() => groupBy(filtered, studentKey), [filtered]);

  return (
    <div>
      <button className="mb-3 text-sm font-medium text-blue-600 hover:underline" onClick={onBack}>← ครูผู้สอนทั้งหมด</button>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{name}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{subjects.length} รายวิชา · {rooms.length} ห้อง</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => goTracking({ teacher: name })}>เปิดในหน้าติดตาม</button>
          <button className="btn-primary" disabled={filtered.length === 0} onClick={() => exportRowsToExcel(filtered, `gradetrack-teacher-${stamp()}.xlsx`)}>
            ⬇ ส่งออก Excel ({filtered.length})
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label="นักเรียนที่ติด" value={students} unit="คน" tone="text-blue-700" />
        <Stat label="รายการ" value={filtered.length} unit="วิชา" />
        <Stat label="ติด 0" value={count('0')} tone="text-rose-600" />
        <Stat label="ติด ร" value={count('ร')} tone="text-amber-600" />
        <Stat label="ติด มส" value={count('มส')} tone="text-indigo-600" />
        <Stat label="แก้ไขสำเร็จ" value={done} unit={overdue ? `· เกินกำหนด ${overdue}` : ''} tone="text-emerald-600" />
      </div>

      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <label className="label" htmlFor="td-q">ค้นหาชื่อ / รหัสนักเรียน</label>
          <input id="td-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อนักเรียน…" />
        </div>
        <Select id="td-subject" label="รายวิชา" value={subject} onChange={setSubject} all="ทุกวิชา" options={subjects} />
        <Select id="td-room" label="ห้อง" value={room} onChange={setRoom} all="ทุกห้อง" options={rooms} />
        <Select id="td-result" label="ผลการเรียน" value={result} onChange={(v) => setResult(v as GradeResult | '')} all="ทั้งหมด" options={GRADE_RESULTS} />
        <Select id="td-status" label="สถานะ" value={status} onChange={(v) => setStatus(v as TrackingStatus | '')} all="ทุกสถานะ" options={STATUSES.map((s) => s.value)} labels={Object.fromEntries(STATUSES.map((s) => [s.value, s.label]))} />
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-3 lg:col-span-6">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
            {(['subject', 'student'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 font-medium ${view === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                {v === 'subject' ? 'แยกตามรายวิชา' : 'แยกตามนักเรียน'}
              </button>
            ))}
          </div>
          {filtering && (
            <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => { setSubject(''); setRoom(''); setResult(''); setStatus(''); setQ(''); }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty>ไม่พบรายการที่ตรงกับเงื่อนไข</Empty></div>
      ) : view === 'subject' ? (
        <div className="space-y-4">
          {bySubject.map(([label, items]) => (
            <section key={label} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h2 className="font-semibold text-slate-900">{label}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span><b className="text-slate-800">{new Set(items.map(studentKey)).size}</b> คน</span>
                  {GRADE_RESULTS.map((g) => {
                    const n = items.filter((i) => i.result === g).length;
                    return n > 0 && <span key={g} className="inline-flex items-center gap-1"><ResultBadge result={g} /> {n}</span>;
                  })}
                  <span>· {uniqueSorted(items.map((i) => i.classroom), compareClassroom).join(', ')}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] table-fixed">
                  <thead className="border-b border-slate-100">
                    <tr>
                      <th className="th w-20">ห้อง</th>
                      <th className="th w-16 text-right">เลขที่</th>
                      <th className="th w-24">รหัส</th>
                      <th className="th">ชื่อ-นามสกุล</th>
                      <th className="th w-16 text-center">ผล</th>
                      <th className="th w-44">สถานะ</th>
                      <th className="th w-48">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((r) => (
                      <tr key={r.key} className={r.overdue ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'}>
                        <td className="td whitespace-nowrap">{r.classroom}</td>
                        <td className="td text-right tabular-nums text-slate-500">{r.studentNo || '-'}</td>
                        <td className="td whitespace-nowrap text-xs text-slate-500">{r.studentId || '-'}</td>
                        <td className="td font-medium text-slate-900">{r.studentName} {r.overdue && <OverdueBadge />}</td>
                        <td className="td text-center"><ResultBadge result={r.result} /></td>
                        <td className="td"><StatusSelect row={r} onUpdate={onUpdate} /></td>
                        <td className="td break-words text-xs text-slate-500">{r.tracking.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {byStudent.map(([k, items]) => (
              <li key={k} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="w-14 text-xs text-slate-500">{items[0].classroom}</span>
                  <span className="w-12 text-xs tabular-nums text-slate-400">{items[0].studentNo ? `เลขที่ ${items[0].studentNo}` : ''}</span>
                  <span className="font-medium">{items[0].studentName}</span>
                  <span className="text-xs text-slate-400">{items[0].studentId}</span>
                  <span className="ml-auto text-xs text-slate-500">{items.length} วิชา</span>
                </div>
                <div className="mt-1.5 space-y-1 sm:pl-28">
                  {items.map((r) => (
                    <div key={r.key} className="flex flex-wrap items-center gap-2 text-sm">
                      <ResultBadge result={r.result} />
                      <span>{subjectLabel(r)}</span>
                      <StatusBadge status={r.tracking.status} />
                      {r.overdue && <OverdueBadge />}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function groupBy(rows: Row[], key: (r: Row) => string): [string, Row[]][] {
  const m = new Map<string, Row[]>();
  rows.forEach((r) => m.set(key(r), [...(m.get(key(r)) ?? []), r]));
  return [...m.entries()];
}

function Stat({ label, value, unit, tone = 'text-slate-900' }: { label: string; value: number; unit?: string; tone?: string }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>
        {value.toLocaleString('th-TH')} {unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

function Select({ id, label, value, onChange, all, options, labels }: { id: string; label: string; value: string; onChange: (v: string) => void; all: string; options: readonly string[]; labels?: Record<string, string> }) {
  return (
    <div className="min-w-0">
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </div>
  );
}
