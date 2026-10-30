// ส่งออกรายงานสถิติเป็น Excel แยกตามมุมมอง (ภาพรวม / ระดับชั้น / ห้องเรียน / ครูผู้สอน)
import * as XLSX from 'xlsx';
import { saveWorkbook } from './download';
import { stamp } from './excel';
import type { GroupStats, TeacherStats } from './stats';

/** ร้อยละเป็นตัวเลขทศนิยม 2 ตำแหน่ง (ว่างถ้าไม่มีตัวหารที่เชื่อถือได้) */
const pct = (v: number | null) => (v === null ? '' : Math.round(v * 100) / 100);

function groupRow(g: GroupStats, labelHeader: string) {
  return {
    [labelHeader]: g.label,
    นักเรียนทั้งหมด: g.enrolled ?? '',
    'นักเรียนที่ติด (คน)': g.students,
    'ร้อยละนักเรียนที่ติด': pct(g.pct),
    'ติด 0 (คน)': g.studentsByType['0'],
    'ร้อยละ ติด 0': pct(g.pctByType['0']),
    'ติด ร (คน)': g.studentsByType['ร'],
    'ร้อยละ ติด ร': pct(g.pctByType['ร']),
    'ติด มส (คน)': g.studentsByType['มส'],
    'ร้อยละ ติด มส': pct(g.pctByType['มส']),
    'รายการรายวิชาทั้งหมด': g.records,
    'รายการ 0': g.recordsByType['0'],
    'รายการ ร': g.recordsByType['ร'],
    'รายการ มส': g.recordsByType['มส'],
    แก้ไขสำเร็จ: g.status.done,
    ยังไม่ดำเนินการ: g.status.pending,
    'กำลังแก้ไข/รอตรวจสอบ': g.status.in_progress + g.status.review,
    เกินกำหนด: g.overdue,
    หมายเหตุ: g.enrolledIssue,
  };
}

const NOTES = [
  ['หมายเหตุการคำนวณ'],
  ['- นับนักเรียนไม่ซ้ำด้วยรหัสนักเรียน (ถ้าไม่มีรหัสใช้ชื่อ+ห้อง) นักเรียนที่ติดหลายวิชานับเป็น 1 คน'],
  ['- ร้อยละนักเรียนที่ติด = นักเรียนไม่ซ้ำที่ติด / นักเรียนทั้งหมดในกลุ่ม × 100'],
  ['- ร้อยละรายประเภท = นักเรียนไม่ซ้ำที่ติดประเภทนั้น / นักเรียนทั้งหมดในกลุ่ม × 100 (รวมกันอาจเกินร้อยละรวม เพราะ 1 คนติดได้หลายประเภท)'],
  ['- "รายการ" = จำนวนรายวิชาที่ติด ไม่ใช่จำนวนคน'],
  ['- ช่องร้อยละว่าง = ไม่มีจำนวนนักเรียนทั้งหมดที่เชื่อถือได้ ระบบไม่คำนวณแทน'],
];

function sheetFrom(rows: Record<string, unknown>[], withNotes = true) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (withNotes) XLSX.utils.sheet_add_aoa(ws, [[], ...NOTES], { origin: -1 });
  const keys = Object.keys(rows[0] ?? {});
  ws['!cols'] = keys.map((k) => ({ wch: Math.max(10, Math.min(30, k.length + 4)) }));
  return ws;
}

function save(sheets: [string, XLSX.WorkSheet][], name: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([n, ws]) => XLSX.utils.book_append_sheet(wb, ws, n));
  return saveWorkbook(wb, `gradetrack-${name}-${stamp()}.xlsx`);
}

const overviewSheet = (school: GroupStats) => sheetFrom([groupRow(school, 'กลุ่ม')]);
const levelSheet = (levels: GroupStats[], school: GroupStats) => sheetFrom([...levels, school].map((g) => groupRow(g, 'ระดับชั้น')));
const roomSheet = (rooms: GroupStats[]) => sheetFrom(rooms.map((g) => groupRow(g, 'ห้องเรียน')));
const teacherSheet = (teachers: TeacherStats[]) =>
  sheetFrom(
    teachers.map((t) => ({
      ครูผู้สอน: t.label,
      รายวิชาที่รับผิดชอบ: t.subjects.join(', '),
      ห้องที่เกี่ยวข้อง: t.classrooms.join(', '),
      'นักเรียนที่ติด (คน)': t.students,
      'รายการทั้งหมด': t.records,
      'รายการ 0': t.recordsByType['0'],
      'รายการ ร': t.recordsByType['ร'],
      'รายการ มส': t.recordsByType['มส'],
      ยังไม่ดำเนินการ: t.status.pending,
      กำลังแก้ไข: t.status.in_progress,
      รอตรวจสอบ: t.status.review,
      แก้ไขสำเร็จ: t.status.done,
      เกินกำหนด: t.overdue,
    })),
    false,
  );

export const exportOverview = (school: GroupStats) => save([['ภาพรวม', overviewSheet(school)]], 'overview');
export const exportLevels = (levels: GroupStats[], school: GroupStats) => save([['ระดับชั้น', levelSheet(levels, school)]], 'levels');
export const exportRooms = (rooms: GroupStats[]) => save([['ห้องเรียน', roomSheet(rooms)]], 'classrooms');
export const exportTeachers = (teachers: TeacherStats[]) => save([['ครูผู้สอน', teacherSheet(teachers)]], 'teachers');
export const exportAllStats = (school: GroupStats, levels: GroupStats[], rooms: GroupStats[], teachers: TeacherStats[]) =>
  save(
    [
      ['ภาพรวม', overviewSheet(school)],
      ['ระดับชั้น', levelSheet(levels, school)],
      ['ห้องเรียน', roomSheet(rooms)],
      ['ครูผู้สอน', teacherSheet(teachers)],
    ],
    'stats',
  );
