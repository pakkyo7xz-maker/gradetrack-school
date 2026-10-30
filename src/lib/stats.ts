// ===== สถิติผลการเรียน 0 ร มส =====
// กฎการคำนวณ:
// - นับ "คน" ไม่ซ้ำ ด้วยรหัสนักเรียน (ถ้าไม่มีรหัส ใช้ชื่อ+ห้องแทน) แยกจาก "รายการ" (นักเรียน × วิชา)
// - ร้อยละนักเรียนที่ติด      = คนไม่ซ้ำที่ติด / นักเรียนทั้งหมดในกลุ่ม × 100
// - ร้อยละแยกประเภท 0 ร มส   = คนไม่ซ้ำที่ติดประเภทนั้น / นักเรียนทั้งหมดในกลุ่ม × 100 (รวมกันเกินร้อยละรวมได้)
// - นักเรียนทั้งหมดในกลุ่มต้องมาจากข้อมูลจำนวนนักเรียนที่นำเข้า/กรอกไว้ ถ้าไม่ครบหรือไม่สอดคล้อง → ไม่แสดงร้อยละ
import { compareClassroom, levelOf } from './normalize';
import { studentKey, teacherOf, uniqueSorted } from './selectors';
import { GRADE_RESULTS, type EnrollmentMap, type GradeResult, type Row, type TrackingStatus } from './types';

export type ByType = Record<GradeResult, number>;
const zeroByType = (): ByType => ({ '0': 0, ร: 0, มส: 0 });

export interface GroupStats {
  key: string;
  label: string;
  rows: Row[];
  /** จำนวนนักเรียนทั้งหมดในกลุ่ม (null = ไม่มีข้อมูลที่เชื่อถือได้) */
  enrolled: number | null;
  /** เหตุผลที่ไม่มีร้อยละ */
  enrolledIssue: string;
  students: number;
  studentsByType: ByType;
  records: number;
  recordsByType: ByType;
  pct: number | null;
  pctByType: Record<GradeResult, number | null>;
  status: Record<TrackingStatus, number>;
  overdue: number;
}

function summarize(key: string, label: string, rows: Row[], enrolledInput: number | null, issue: string): GroupStats {
  const all = new Set<string>();
  const byType: Record<GradeResult, Set<string>> = { '0': new Set(), ร: new Set(), มส: new Set() };
  const recordsByType = zeroByType();
  const status: Record<TrackingStatus, number> = { pending: 0, in_progress: 0, review: 0, done: 0 };
  let overdue = 0;
  for (const r of rows) {
    const sk = studentKey(r);
    all.add(sk);
    byType[r.result].add(sk);
    recordsByType[r.result]++;
    status[r.tracking.status]++;
    if (r.overdue) overdue++;
  }
  const students = all.size;
  let enrolled = enrolledInput;
  let enrolledIssue = issue;
  if (enrolled !== null && students > enrolled) {
    enrolledIssue = `จำนวนนักเรียนที่ติด (${students}) มากกว่าจำนวนนักเรียนทั้งหมด (${enrolled}) — ตรวจสอบข้อมูล`;
    enrolled = null;
  }
  const pctOf = (n: number) => (enrolled ? (n / enrolled) * 100 : null);
  const studentsByType = zeroByType();
  GRADE_RESULTS.forEach((g) => (studentsByType[g] = byType[g].size));
  return {
    key,
    label,
    rows,
    enrolled,
    enrolledIssue,
    students,
    studentsByType,
    records: rows.length,
    recordsByType,
    pct: pctOf(students),
    pctByType: { '0': pctOf(studentsByType['0']), ร: pctOf(studentsByType['ร']), มส: pctOf(studentsByType['มส']) },
    status,
    overdue,
  };
}

/** รายการห้องทั้งหมด = ห้องที่มีข้อมูลจำนวนนักเรียน ∪ ห้องที่มีรายการติด */
export function allClassrooms(rows: Row[], enrollment: EnrollmentMap): string[] {
  return uniqueSorted([...Object.keys(enrollment), ...rows.map((r) => r.classroom)], compareClassroom);
}

const STANDARD_LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

export function allLevels(classrooms: string[]): string[] {
  return uniqueSorted([...STANDARD_LEVELS, ...classrooms.map(levelOf)], compareLevel);
}

function compareLevel(a: string, b: string) {
  const na = Number(a.match(/\d/)?.[0] ?? 99);
  const nb = Number(b.match(/\d/)?.[0] ?? 99);
  return na - nb || a.localeCompare(b, 'th');
}

/** จำนวนนักเรียนทั้งหมดของห้อง (null = ไม่มีข้อมูลที่เชื่อถือได้) */
export const enrolledOf = (enrollment: EnrollmentMap, room: string): number | null => enrollment[room]?.total ?? null;

/** รวมจำนวนนักเรียนของหลายห้อง: ต้องมีครบทุกห้อง ไม่งั้นคืน null พร้อมเหตุผล */
function sumEnrollment(rooms: string[], enrollment: EnrollmentMap): { total: number | null; issue: string } {
  if (rooms.length === 0) return { total: null, issue: 'ไม่มีข้อมูลห้องเรียนในระดับนี้' };
  const missing = rooms.filter((r) => enrolledOf(enrollment, r) === null);
  if (missing.length) return { total: null, issue: `ไม่มีจำนวนนักเรียนทั้งหมดของห้อง ${missing.join(', ')}` };
  return { total: rooms.reduce((s, r) => s + enrolledOf(enrollment, r)!, 0), issue: '' };
}

export function roomStats(rows: Row[], enrollment: EnrollmentMap, room: string): GroupStats {
  const total = enrolledOf(enrollment, room);
  return summarize(room, room, rows.filter((r) => r.classroom === room), total, total === null ? `ไม่มีจำนวนนักเรียนทั้งหมดของห้อง ${room}` : '');
}

export function levelStats(rows: Row[], enrollment: EnrollmentMap, level: string, classrooms: string[]): GroupStats {
  const rooms = classrooms.filter((c) => levelOf(c) === level);
  const { total, issue } = sumEnrollment(rooms, enrollment);
  return summarize(level, level, rows.filter((r) => levelOf(r.classroom) === level), total, issue);
}

export function schoolStats(rows: Row[], enrollment: EnrollmentMap, classrooms: string[]): GroupStats {
  const { total, issue } = sumEnrollment(classrooms, enrollment);
  return summarize('school', 'ทั้งโรงเรียน', rows, total, issue);
}

export interface TeacherStats extends GroupStats {
  subjects: string[];
  classrooms: string[];
}

/** ครูไม่มีตัวหาร (จำนวนนักเรียนที่สอนทั้งหมด) จึงไม่มีร้อยละ */
export function teacherStats(rows: Row[]): TeacherStats[] {
  const groups = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[teacherOf(r)] ??= []).push(r);
    return acc;
  }, {});
  return Object.entries(groups)
    .map(([name, items]) => ({
      ...summarize(name, name, items, null, 'ไม่มีจำนวนนักเรียนที่ครูสอนทั้งหมด'),
      subjects: uniqueSorted(items.map((i) => (i.subjectCode ? `${i.subjectCode} ${i.subjectName}` : i.subjectName))),
      classrooms: uniqueSorted(items.map((i) => i.classroom), compareClassroom),
    }))
    .sort((a, b) => b.records - b.status.done - (a.records - a.status.done) || a.label.localeCompare(b.label, 'th'));
}

/** ร้อยละทศนิยม 2 ตำแหน่ง; null → "—" */
export const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}%`);
export const fmtNum = (v: number | null) => (v === null ? '—' : v.toLocaleString('th-TH'));
