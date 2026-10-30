import { compareClassroom, compareStudentNo, compact, levelOf, todayIso } from './normalize';
import { emptyTracking, type Filters, type GradeRecord, type Row, type TrackingMap } from './types';

export function buildRows(records: GradeRecord[], tracking: TrackingMap): Row[] {
  const today = todayIso();
  return records
    .map((r) => {
      const t = tracking[r.key] ?? emptyTracking();
      return { ...r, tracking: t, overdue: !!t.dueDate && t.dueDate < today && t.status !== 'done' };
    })
    .sort((a, b) => compareClassroom(a.classroom, b.classroom) || compareStudentNo(a.studentNo, b.studentNo) || a.studentName.localeCompare(b.studentName, 'th') || a.subjectName.localeCompare(b.subjectName, 'th'));
}

export const NO_TEACHER = 'ไม่ระบุครู';
export const teacherOf = (r: GradeRecord) => r.teacher || NO_TEACHER;
/** นับนักเรียนไม่ซ้ำ: ใช้รหัส (ถ้ามี) ไม่งั้นใช้ชื่อ+ห้อง */
export const studentKey = (r: GradeRecord) => (r.studentId ? `id:${compact(r.studentId)}` : `n:${compact(r.studentName)}@${r.classroom}`);

export function applyFilters(rows: Row[], f: Filters): Row[] {
  const q = compact(f.search);
  return rows.filter(
    (r) =>
      (!f.level || levelOf(r.classroom) === f.level) &&
      (!f.classroom || r.classroom === f.classroom) &&
      (!f.teacher || teacherOf(r) === f.teacher) &&
      (!f.result || r.result === f.result) &&
      (!f.status || (f.status === 'overdue' ? r.overdue : r.tracking.status === f.status)) &&
      (!q || compact(r.studentName).includes(q) || compact(r.studentId).includes(q)),
  );
}

export function computeStats(rows: Row[]) {
  return {
    students: new Set(rows.map(studentKey)).size,
    total: rows.length,
    zero: rows.filter((r) => r.result === '0').length,
    r: rows.filter((r) => r.result === 'ร').length,
    ms: rows.filter((r) => r.result === 'มส').length,
    done: rows.filter((r) => r.tracking.status === 'done').length,
    pending: rows.filter((r) => r.tracking.status === 'pending').length,
    inProgress: rows.filter((r) => r.tracking.status === 'in_progress' || r.tracking.status === 'review').length,
    overdue: rows.filter((r) => r.overdue).length,
  };
}

export const uniqueSorted = (values: string[], cmp: (a: string, b: string) => number = (a, b) => a.localeCompare(b, 'th')) =>
  [...new Set(values.filter(Boolean))].sort(cmp);

export const classroomsOf = (rows: GradeRecord[]) => uniqueSorted(rows.map((r) => r.classroom), compareClassroom);
export const teachersOf = (rows: GradeRecord[]) => uniqueSorted(rows.map(teacherOf));
