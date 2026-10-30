import { useMemo, useState, type ReactNode } from 'react';
import GroupedBarChart from '../components/BarChart';
import StatsTable, { type DrillRequest } from '../components/StatsTable';
import StudentListModal, { type Drill } from '../components/StudentListModal';
import TeacherTable from '../components/TeacherTable';
import { Alert, Empty, OverdueBadge, PageHeader, ResultBadge } from '../components/ui';
import { formatThaiDate, levelOf } from '../lib/normalize';
import { allClassrooms, allLevels, fmtNum, fmtPct, levelStats, roomStats, schoolStats, teacherStats, type GroupStats } from '../lib/stats';
import { exportAllStats, exportLevels, exportOverview, exportRooms, exportTeachers } from '../lib/statsExport';
import { GRADE_RESULTS, type EnrollmentMap, type Filters, type GradeResult, type Row } from '../lib/types';

type Tab = 'overview' | 'levels' | 'rooms' | 'teachers';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'ภาพรวมโรงเรียน' },
  { id: 'levels', label: 'รายระดับชั้น' },
  { id: 'rooms', label: 'รายห้องเรียน' },
  { id: 'teachers', label: 'ครูผู้สอน' },
];

interface Props {
  rows: Row[];
  enrollment: EnrollmentMap;
  goTracking: (f: Partial<Filters>) => void;
  goEnrollment: () => void;
}

/** ตัวกรองหน้าติดตามที่ตรงกับกลุ่ม */
function filtersFor(g: GroupStats, result?: GradeResult): Partial<Filters> {
  const f: Partial<Filters> = result ? { result } : {};
  if (/^ม\.\d$/.test(g.key)) f.level = g.key;
  else if (g.key !== 'school') f.classroom = g.key;
  return f;
}

export default function Dashboard({ rows, enrollment, goTracking, goEnrollment }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [drill, setDrill] = useState<Drill | null>(null);
  const [room, setRoom] = useState('');

  const classrooms = useMemo(() => allClassrooms(rows, enrollment), [rows, enrollment]);
  const levels = useMemo(() => allLevels(classrooms), [classrooms]);
  const school = useMemo(() => schoolStats(rows, enrollment, classrooms), [rows, enrollment, classrooms]);
  const levelGroups = useMemo(() => levels.map((l) => levelStats(rows, enrollment, l, classrooms)), [rows, enrollment, levels, classrooms]);
  const roomGroups = useMemo(() => classrooms.map((c) => roomStats(rows, enrollment, c)), [rows, enrollment, classrooms]);
  const teachers = useMemo(() => teacherStats(rows), [rows]);

  const openDrill = ({ group, result, view }: DrillRequest) =>
    setDrill({
      title: `${group.label}${result ? ` · ติด ${result}` : ''} · ${view === 'students' ? 'รายชื่อนักเรียน' : 'รายการรายวิชา'}`,
      rows: result ? group.rows.filter((r) => r.result === result) : group.rows,
      view,
      filters: filtersFor(group, result),
    });

  const exportCurrent = () => {
    if (tab === 'overview') exportOverview(school);
    else if (tab === 'levels') exportLevels(levelGroups, school);
    else if (tab === 'rooms') exportRooms(roomGroups);
    else exportTeachers(teachers);
  };

  return (
    <div>
      <PageHeader
        title="สถิติผลการเรียน 0 ร มส"
        subtitle="นับนักเรียนไม่ซ้ำด้วยรหัสนักเรียน แยกจากจำนวนรายการรายวิชา · คลิกตัวเลขเพื่อดูรายชื่อ"
        actions={
          <>
            <button className="btn-ghost" onClick={exportCurrent}>⬇ ส่งออก{TABS.find((t) => t.id === tab)!.label}</button>
            <button className="btn-primary" onClick={() => exportAllStats(school, levelGroups, roomGroups, teachers)}>⬇ ส่งออกรายงานทั้งหมด</button>
          </>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {school.enrolled === null && (
        <div className="mb-4">
          <Alert tone="amber">
            ยังไม่แสดงร้อยละของทั้งโรงเรียน: {school.enrolledIssue}{' '}
            <button className="font-semibold underline" onClick={goEnrollment}>เพิ่มจำนวนนักเรียน</button>
          </Alert>
        </div>
      )}

      {tab === 'overview' && <Overview school={school} levelGroups={levelGroups} onDrill={openDrill} goTracking={goTracking} />}

      {tab === 'levels' && (
        <div className="space-y-4">
          <GroupedBarChart title="เปรียบเทียบ 0 ร มส รายระดับชั้น" groups={levelGroups} onBarClick={(g, t) => openDrill({ group: g, result: t, view: 'students' })} />
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ตารางเปรียบเทียบรายระดับชั้น</div>
            <StatsTable groups={levelGroups} total={school} labelHeader="ระดับชั้น" onDrill={openDrill} />
          </div>
        </div>
      )}

      {tab === 'rooms' && <Rooms levels={levels} classrooms={classrooms} roomGroups={roomGroups} room={room} setRoom={setRoom} onDrill={openDrill} />}

      {tab === 'teachers' && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ครูผู้สอน ({teachers.length} คน)</div>
          <TeacherTable
            teachers={teachers}
            onSelectTeacher={(t) => goTracking({ teacher: t })}
            onDrill={(t) => setDrill({ title: `${t.label} · รายชื่อนักเรียน`, rows: t.rows, view: 'students', filters: { teacher: t.label } })}
          />
          <p className="px-4 py-2 text-xs text-slate-500">ไม่มีร้อยละรายครู เพราะไม่มีจำนวนนักเรียนที่ครูแต่ละคนสอนทั้งหมด</p>
        </div>
      )}

      <StudentListModal drill={drill} onClose={() => setDrill(null)} onOpenTracking={(f) => { setDrill(null); goTracking(f); }} />
    </div>
  );
}

function Metric({ label, value, pct, sub, color, onClick }: { label: string; value: number | null; pct?: string; sub?: ReactNode; color?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick || !value} className="card p-4 text-left transition enabled:hover:border-blue-300 enabled:hover:shadow disabled:cursor-default">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-slate-900">{fmtNum(value)}</span>
        {pct !== undefined && <span className="text-sm font-semibold tabular-nums text-blue-700">{pct}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </button>
  );
}

const TYPE_COLOR: Record<GradeResult, string> = { '0': '#e11d48', ร: '#f59e0b', มส: '#6366f1' };

function Overview({ school, levelGroups, onDrill, goTracking }: { school: GroupStats; levelGroups: GroupStats[]; onDrill: (d: DrillRequest) => void; goTracking: (f: Partial<Filters>) => void }) {
  const s = school;
  const progress = s.records ? (s.status.done / s.records) * 100 : 0;
  const overdue = s.rows.filter((r) => r.overdue).sort((a, b) => a.tracking.dueDate.localeCompare(b.tracking.dueDate));
  return (
    <div className="space-y-4">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">จำนวนนักเรียน (คนไม่ซ้ำ)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="นักเรียนทั้งหมด" value={s.enrolled} sub={s.enrolled === null ? 'ไม่มีข้อมูลที่เชื่อถือได้' : 'จากข้อมูลจำนวนนักเรียน'} />
          <Metric label="นักเรียนที่ติด 0 ร มส" value={s.students} pct={fmtPct(s.pct)} sub="ติดหลายวิชานับเป็น 1 คน" onClick={() => onDrill({ group: s, view: 'students' })} />
          {GRADE_RESULTS.map((t) => (
            <Metric key={t} label={`นักเรียนที่ติด ${t}`} color={TYPE_COLOR[t]} value={s.studentsByType[t]} pct={fmtPct(s.pctByType[t])} onClick={() => onDrill({ group: s, result: t, view: 'students' })} />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">ร้อยละรายประเภทรวมกันอาจเกินร้อยละรวม เพราะนักเรียน 1 คนอาจติดหลายประเภท</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">จำนวนรายการรายวิชา (ไม่ใช่จำนวนคน)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="รายการทั้งหมด" value={s.records} onClick={() => onDrill({ group: s, view: 'records' })} />
          {GRADE_RESULTS.map((t) => (
            <Metric key={t} label={`รายการติด ${t}`} color={TYPE_COLOR[t]} value={s.recordsByType[t]} onClick={() => onDrill({ group: s, result: t, view: 'records' })} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">สถานะการติดตาม (รายการ)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="แก้ไขสำเร็จ" value={s.status.done} sub={`${progress.toFixed(2)}% ของรายการทั้งหมด`} onClick={() => goTracking({ status: 'done' })} />
          <Metric label="ยังไม่ดำเนินการ" value={s.status.pending} onClick={() => goTracking({ status: 'pending' })} />
          <Metric label="กำลังแก้ไข / รอตรวจสอบ" value={s.status.in_progress + s.status.review} sub={`กำลังแก้ไข ${s.status.in_progress} · รอตรวจสอบ ${s.status.review}`} />
          <Metric label="เกินกำหนด" value={s.overdue} sub="ยังไม่สำเร็จและเลยวันกำหนด" onClick={() => goTracking({ status: 'overdue' })} />
        </div>
        <div className="card mt-3 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">ความคืบหน้าการแก้ไข</span>
            <span className="tabular-nums text-slate-500">{s.status.done}/{s.records} รายการ</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <GroupedBarChart title="0 ร มส รายระดับชั้น" groups={levelGroups} onBarClick={(g, t) => onDrill({ group: g, result: t, view: 'students' })} />
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">รายการเกินกำหนด</div>
          {overdue.length === 0 ? (
            <Empty>ไม่มีรายการเกินกำหนด 🎉</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdue.slice(0, 6).map((r) => (
                <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <ResultBadge result={r.result} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.studentName} <span className="text-xs font-normal text-slate-400">{r.classroom}</span></div>
                    <div className="truncate text-xs text-slate-500">{r.subjectName} · {r.teacher || 'ไม่ระบุครู'}</div>
                  </div>
                  <div className="text-right">
                    <OverdueBadge />
                    <div className="mt-0.5 text-[11px] text-slate-400">{formatThaiDate(r.tracking.dueDate)}</div>
                  </div>
                </li>
              ))}
              {overdue.length > 6 && (
                <li><button className="w-full px-4 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50" onClick={() => goTracking({ status: 'overdue' })}>ดูทั้งหมด {overdue.length} รายการ →</button></li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Rooms({ levels, classrooms, roomGroups, room, setRoom, onDrill }: { levels: string[]; classrooms: string[]; roomGroups: GroupStats[]; room: string; setRoom: (r: string) => void; onDrill: (d: DrillRequest) => void }) {
  const usableLevels = levels.filter((l) => classrooms.some((c) => levelOf(c) === l));
  const current = classrooms.includes(room) ? room : classrooms[0] ?? '';
  const level = levelOf(current);
  const inLevel = roomGroups.filter((g) => levelOf(g.key) === level);
  const g = roomGroups.find((x) => x.key === current);
  if (!g) return <div className="card"><Empty>ยังไม่มีข้อมูลห้องเรียน</Empty></div>;
  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 gap-3 p-4 sm:max-w-md">
        <div>
          <label className="label">1. เลือกระดับชั้น</label>
          <select className="input" value={level} onChange={(e) => setRoom(classrooms.find((c) => levelOf(c) === e.target.value) ?? '')}>
            {usableLevels.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">2. เลือกห้อง</label>
          <select className="input" value={current} onChange={(e) => setRoom(e.target.value)}>
            {inLevel.map((r) => <option key={r.key}>{r.key}</option>)}
          </select>
        </div>
      </div>

      {g.enrolled === null && <Alert tone="amber">{g.enrolledIssue} — จึงไม่แสดงร้อยละของห้องนี้</Alert>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label={`นักเรียนทั้งหมด ${g.label}`} value={g.enrolled} />
        <Metric label="นักเรียนที่ติด" value={g.students} pct={fmtPct(g.pct)} sub={`${g.records} รายการรายวิชา`} onClick={() => onDrill({ group: g, view: 'students' })} />
        {GRADE_RESULTS.map((t) => (
          <Metric key={t} label={`ติด ${t}`} color={TYPE_COLOR[t]} value={g.studentsByType[t]} pct={fmtPct(g.pctByType[t])} sub={`${g.recordsByType[t]} รายการ`} onClick={() => onDrill({ group: g, result: t, view: 'students' })} />
        ))}
      </div>

      <GroupedBarChart title={`เปรียบเทียบ 0 ร มส รายห้อง ระดับ ${level}`} groups={inLevel} onBarClick={(x, t) => onDrill({ group: x, result: t, view: 'students' })} />
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ตารางห้องเรียนระดับ {level}</div>
        <StatsTable groups={inLevel} labelHeader="ห้อง" onDrill={onDrill} />
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">ทุกห้องเรียน ({roomGroups.length} ห้อง)</div>
        <StatsTable groups={roomGroups} labelHeader="ห้อง" onDrill={onDrill} />
      </div>
    </div>
  );
}
