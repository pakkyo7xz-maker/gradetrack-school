// ตรวจคุณภาพข้อมูลก่อนนำเข้า/ก่อนคำนวณสถิติ (ใช้กับข้อมูลจาก Excel หรือ PDF ที่แปลงเป็นตารางแล้ว)
import { compact } from './normalize';
import { studentKey } from './selectors';
import { enrolledOf } from './stats';
import type { EnrollmentMap, GradeRecord } from './types';

export type IssueLevel = 'error' | 'warning' | 'info';
export interface Issue {
  level: IssueLevel;
  title: string;
  details: string[];
}

const MAX_DETAILS = 30;
const cap = (xs: string[]) => (xs.length > MAX_DETAILS ? [...xs.slice(0, MAX_DETAILS), `… และอีก ${xs.length - MAX_DETAILS} รายการ`] : xs);

export function validateRecords(records: GradeRecord[], enrollment: EnrollmentMap): Issue[] {
  const issues: Issue[] = [];

  // 1) ไม่มีรหัสนักเรียน → นับคนด้วยชื่อ+ห้อง (เสี่ยงนับซ้ำ/นับขาดถ้าสะกดต่างกัน)
  const noId = records.filter((r) => !r.studentId);
  if (noId.length)
    issues.push({
      level: 'warning',
      title: `${noId.length} รายการไม่มีรหัสนักเรียน — ระบบจะใช้ชื่อ+ห้องแทนในการนับคน`,
      details: cap([...new Set(noId.map((r) => `${r.studentName} (${r.classroom})`))]),
    });

  // 2) รหัสเดียวกันแต่ชื่อหรือห้องต่างกัน
  const byId = new Map<string, GradeRecord[]>();
  records.forEach((r) => r.studentId && byId.set(compact(r.studentId), [...(byId.get(compact(r.studentId)) ?? []), r]));
  const nameConflicts: string[] = [];
  const roomConflicts: string[] = [];
  byId.forEach((rs) => {
    const names = [...new Set(rs.map((r) => compact(r.studentName)))];
    const rooms = [...new Set(rs.map((r) => r.classroom))];
    if (names.length > 1) nameConflicts.push(`${rs[0].studentId}: ${[...new Set(rs.map((r) => r.studentName))].join(' / ')}`);
    if (rooms.length > 1) roomConflicts.push(`${rs[0].studentId} ${rs[0].studentName}: ${rooms.join(', ')}`);
  });
  if (nameConflicts.length) issues.push({ level: 'error', title: `รหัสนักเรียนเดียวกันแต่ชื่อต่างกัน ${nameConflicts.length} รหัส`, details: cap(nameConflicts) });
  if (roomConflicts.length) issues.push({ level: 'error', title: `นักเรียนคนเดียวอยู่หลายห้อง ${roomConflicts.length} คน`, details: cap(roomConflicts) });

  // 3) ชื่อเดียวกันในห้องเดียวกันแต่รหัสต่างกัน (อาจพิมพ์รหัสผิด)
  const byNameRoom = new Map<string, Set<string>>();
  records.forEach((r) => {
    if (!r.studentId) return;
    const k = `${compact(r.studentName)}@${r.classroom}`;
    byNameRoom.set(k, (byNameRoom.get(k) ?? new Set()).add(r.studentId));
  });
  const idConflicts = [...byNameRoom.entries()].filter(([, ids]) => ids.size > 1).map(([k, ids]) => `${k.split('@')[1]}: รหัส ${[...ids].join(', ')}`);
  if (idConflicts.length) issues.push({ level: 'warning', title: `ชื่อเดียวกันในห้องเดียวกันแต่รหัสต่างกัน ${idConflicts.length} กรณี`, details: cap(idConflicts) });

  // 4) รูปแบบห้องไม่มาตรฐาน
  const oddRooms = [...new Set(records.map((r) => r.classroom).filter((c) => !/^ม\.\d\/\d+$/.test(c)))];
  if (oddRooms.length) issues.push({ level: 'warning', title: `ชั้น/ห้องที่อ่านรูปแบบไม่ได้ ${oddRooms.length} ค่า (จะไม่ถูกจัดเข้าระดับ ม.1–ม.6)`, details: cap(oddRooms) });

  // 5) เทียบกับจำนวนนักเรียนทั้งหมด
  const rooms = [...new Set(records.map((r) => r.classroom))];
  const noEnroll = rooms.filter((c) => enrolledOf(enrollment, c) === null);
  if (noEnroll.length)
    issues.push({
      level: 'info',
      title: `${noEnroll.length} ห้องยังไม่มีจำนวนนักเรียนทั้งหมด — จะไม่แสดงร้อยละของห้อง/ระดับ/โรงเรียนที่เกี่ยวข้อง`,
      details: cap(noEnroll),
    });
  const over = rooms
    .map((c) => ({ c, n: new Set(records.filter((r) => r.classroom === c).map(studentKey)).size, total: enrolledOf(enrollment, c) }))
    .filter((x) => x.total !== null && x.n > x.total);
  if (over.length)
    issues.push({ level: 'error', title: `ห้องที่จำนวนคนติดมากกว่าจำนวนนักเรียนทั้งหมด ${over.length} ห้อง`, details: over.map((x) => `${x.c}: ติด ${x.n} คน / ทั้งหมด ${x.total} คน`) });

  return issues;
}
