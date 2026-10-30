// ===== Import Mapping =====
// ปรับไฟล์นี้เมื่อได้รับ Excel จริง: เพิ่มชื่อหัวคอลัมน์ใน aliases ให้ตรงกับไฟล์ของโรงเรียน
import { cellText, compact, normalizeClassroom, normalizeResult, recordKey } from './normalize';
import type { GradeRecord } from './types';

export type FieldKey =
  | 'studentId'
  | 'studentName'
  | 'firstName'
  | 'lastName'
  | 'classroom'
  | 'level'
  | 'room'
  | 'subjectCode'
  | 'subjectName'
  | 'teacher'
  | 'homeroomTeacher'
  | 'result'
  | 'term';

export interface FieldDef {
  key: FieldKey;
  label: string;
  aliases: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'studentId', label: 'รหัสนักเรียน', aliases: ['รหัสนักเรียน', 'เลขประจำตัว', 'เลขประจำตัวนักเรียน', 'รหัส', 'studentid', 'id'] },
  { key: 'studentName', label: 'ชื่อ-นามสกุล', aliases: ['ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ชื่อนามสกุล', 'ชื่อ-สกุล', 'ชื่อสกุล', 'ชื่อนักเรียน', 'นักเรียน', 'name', 'fullname'] },
  { key: 'firstName', label: 'ชื่อ (แยกคอลัมน์)', aliases: ['ชื่อ', 'firstname'] },
  { key: 'lastName', label: 'นามสกุล (แยกคอลัมน์)', aliases: ['นามสกุล', 'สกุล', 'lastname', 'surname'] },
  { key: 'classroom', label: 'ชั้น/ห้อง', aliases: ['ชั้น/ห้อง', 'ระดับชั้น/ห้อง', 'ห้องเรียน', 'ชั้นห้อง', 'class', 'classroom'] },
  { key: 'level', label: 'ระดับชั้น (แยกคอลัมน์)', aliases: ['ระดับชั้น', 'ชั้น', 'ชั้นปี', 'level', 'grade'] },
  { key: 'room', label: 'ห้อง (แยกคอลัมน์)', aliases: ['ห้อง', 'room'] },
  { key: 'subjectCode', label: 'รหัสวิชา', aliases: ['รหัสวิชา', 'รหัสรายวิชา', 'subjectcode', 'code'] },
  { key: 'subjectName', label: 'ชื่อรายวิชา', aliases: ['ชื่อรายวิชา', 'รายวิชา', 'ชื่อวิชา', 'วิชา', 'subject'] },
  { key: 'teacher', label: 'ครูผู้สอน', aliases: ['ครูผู้สอน', 'ชื่อครูผู้สอน', 'ผู้สอน', 'ครูประจำวิชา', 'ครู', 'teacher'] },
  { key: 'homeroomTeacher', label: 'ครูประจำชั้น', aliases: ['ครูประจำชั้น', 'ครูที่ปรึกษา', 'อาจารย์ที่ปรึกษา', 'homeroom', 'advisor'] },
  { key: 'result', label: 'ผลการเรียน (0/ร/มส)', aliases: ['ผลการเรียน', 'เกรด', 'ระดับผลการเรียน', 'ผล', 'ผลการประเมิน', 'grade result', 'result'] },
  { key: 'term', label: 'ภาคเรียน/ปีการศึกษา', aliases: ['ภาคเรียน', 'ภาคเรียน/ปีการศึกษา', 'ปีการศึกษา', 'เทอม', 'term', 'semester'] },
];

/** fieldKey → ชื่อหัวคอลัมน์ในไฟล์ ('' = ไม่ใช้) */
export type ColumnMapping = Partial<Record<FieldKey, string>>;

/** ฟิลด์ที่ชื่อสั้น/กำกวม ให้จับคู่เฉพาะแบบตรงทั้งคำ */
const NO_CONTAINS = new Set<FieldKey>(['firstName', 'lastName', 'level', 'room', 'studentId']);

/** จับคู่หัวคอลัมน์อัตโนมัติ: ตรงทั้งคำก่อน แล้วค่อยดูว่ามีคำนั้นอยู่ในหัวคอลัมน์ */
export function autoDetectMapping(headers: string[], saved?: ColumnMapping): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const norm = headers.map((h) => ({ h, c: compact(h) }));

  // ใช้ mapping ที่ผู้ใช้เคยบันทึกไว้ก่อน ถ้าหัวคอลัมน์ยังอยู่ในไฟล์
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      if (v && headers.includes(v)) {
        mapping[k as FieldKey] = v;
        used.add(v);
      }
    }
  }
  const take = (key: FieldKey, h: string) => {
    mapping[key] = h;
    used.add(h);
  };
  // รอบที่ 1: ตรงทั้งคำ
  for (const f of FIELDS) {
    if (mapping[f.key]) continue;
    const hit = f.aliases.map(compact).map((a) => norm.find(({ h, c }) => !used.has(h) && c === a)).find(Boolean);
    if (hit) take(f.key, hit.h);
  }
  // รอบที่ 2: หัวคอลัมน์มีคำนั้นอยู่ (ลองคำที่ยาวก่อน เพื่อไม่ให้ "ครู" ไปจับ "ครูประจำชั้น")
  const pairs = FIELDS.filter((f) => !NO_CONTAINS.has(f.key))
    .flatMap((f) => f.aliases.map((a) => ({ key: f.key, a: compact(a) })))
    .filter((p) => p.a.length >= 3)
    .sort((x, y) => y.a.length - x.a.length);
  for (const p of pairs) {
    if (mapping[p.key]) continue;
    const hit = norm.find(({ h, c }) => !used.has(h) && c.includes(p.a));
    if (hit) take(p.key, hit.h);
  }
  return mapping;
}

/** ตรวจคอลัมน์ที่จำเป็น คืนรายการข้อความแจ้งเตือน */
export function missingFields(m: ColumnMapping): string[] {
  const out: string[] = [];
  if (!m.studentName && !m.firstName) out.push('ชื่อ-นามสกุลนักเรียน');
  if (!m.classroom && !(m.level && m.room)) out.push('ชั้น/ห้อง (หรือ ระดับชั้น + ห้อง)');
  if (!m.subjectName && !m.subjectCode) out.push('ชื่อรายวิชา หรือ รหัสวิชา');
  if (!m.result) out.push('ผลการเรียน');
  return out;
}

export function optionalWarnings(m: ColumnMapping): string[] {
  const out: string[] = [];
  if (!m.teacher) out.push('ไม่พบคอลัมน์ครูผู้สอน — หน้าครูจะแสดงเป็น "ไม่ระบุ"');
  if (!m.studentId) out.push('ไม่พบรหัสนักเรียน — จะใช้ชื่อ+ห้องแทนในการจับคู่สถานะเดิม');
  return out;
}

/** หาแถวหัวตาราง: แถวแรก (ใน 15 แถวแรก) ที่ตรงกับ alias มากที่สุด */
export function detectHeaderRow(rows: unknown[][]): number {
  const aliasSet = new Set(FIELDS.flatMap((f) => f.aliases.map(compact)));
  let best = 0;
  let bestScore = -1;
  rows.slice(0, 15).forEach((r, i) => {
    const score = r.filter((c) => aliasSet.has(compact(cellText(c)))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export interface ParseResult {
  records: GradeRecord[];
  skippedNoResult: number; // แถวที่ผลการเรียนไม่ใช่ 0/ร/มส (เช่น ได้เกรดปกติ)
  invalidRows: { row: number; reason: string }[];
  duplicates: { row: number; name: string; subject: string }[];
}

/** แปลงแถวข้อมูล (object ตามหัวคอลัมน์) เป็น GradeRecord ตาม mapping */
export function parseRows(rows: Record<string, unknown>[], m: ColumnMapping, headerRowIndex = 0): ParseResult {
  const get = (r: Record<string, unknown>, k: FieldKey) => (m[k] ? r[m[k]!] : undefined);
  const res: ParseResult = { records: [], skippedNoResult: 0, invalidRows: [], duplicates: [] };
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    const excelRow = headerRowIndex + i + 2; // เลขแถวใน Excel (1-based, ถัดจากหัวตาราง)
    const values = Object.values(r).map(cellText).filter(Boolean);
    if (values.length === 0) return; // แถวว่าง

    const result = normalizeResult(get(r, 'result'));
    if (!result) {
      res.skippedNoResult++;
      return;
    }
    const studentName =
      cellText(get(r, 'studentName')) || [cellText(get(r, 'firstName')), cellText(get(r, 'lastName'))].filter(Boolean).join(' ');
    const classroom = normalizeClassroom(get(r, 'classroom'), get(r, 'level'), get(r, 'room'));
    const subjectCode = cellText(get(r, 'subjectCode'));
    const subjectName = cellText(get(r, 'subjectName')) || subjectCode;

    if (!studentName) return void res.invalidRows.push({ row: excelRow, reason: 'ไม่มีชื่อนักเรียน' });
    if (!classroom) return void res.invalidRows.push({ row: excelRow, reason: 'ไม่มีชั้น/ห้อง' });
    if (!subjectName) return void res.invalidRows.push({ row: excelRow, reason: 'ไม่มีรายวิชา' });

    const base = {
      studentId: cellText(get(r, 'studentId')),
      studentName,
      classroom,
      subjectCode,
      subjectName,
      teacher: cellText(get(r, 'teacher')),
      homeroomTeacher: cellText(get(r, 'homeroomTeacher')),
      result,
      term: cellText(get(r, 'term')),
    };
    const key = recordKey(base);
    if (seen.has(key)) {
      res.duplicates.push({ row: excelRow, name: studentName, subject: subjectName });
      return;
    }
    seen.add(key);
    res.records.push({ key, ...base });
  });
  return res;
}
