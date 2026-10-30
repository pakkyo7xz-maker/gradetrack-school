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
  | 'term'
  | 'total'
  | 'male'
  | 'female';

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
const NO_CONTAINS = new Set<FieldKey>(['firstName', 'lastName', 'level', 'room', 'studentId', 'male', 'female']);

/** จับคู่หัวคอลัมน์อัตโนมัติ: ตรงทั้งคำก่อน แล้วค่อยดูว่ามีคำนั้นอยู่ในหัวคอลัมน์ */
export function autoDetectMapping(headers: string[], saved?: ColumnMapping, fields: FieldDef[] = FIELDS): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const norm = headers.map((h) => ({ h, c: compact(h) }));

  // ใช้ mapping ที่ผู้ใช้เคยบันทึกไว้ก่อน ถ้าหัวคอลัมน์ยังอยู่ในไฟล์
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      if (v && headers.includes(v) && fields.some((f) => f.key === k)) {
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
  for (const f of fields) {
    if (mapping[f.key]) continue;
    const hit = f.aliases.map(compact).map((a) => norm.find(({ h, c }) => !used.has(h) && c === a)).find(Boolean);
    if (hit) take(f.key, hit.h);
  }
  // รอบที่ 2: หัวคอลัมน์มีคำนั้นอยู่ (ลองคำที่ยาวก่อน เพื่อไม่ให้ "ครู" ไปจับ "ครูประจำชั้น")
  const pairs = fields.filter((f) => !NO_CONTAINS.has(f.key))
    .flatMap((f) => f.aliases.map((a) => ({ key: f.key, a: compact(a) })))
    .filter((p) => p.a.length >= 3)
    .sort((x, y) => y.a.length - x.a.length);
  for (const p of pairs) {
    if (mapping[p.key]) continue;
    const hit = norm.find(({ h, c }) => !used.has(h) && c.includes(p.a));
    if (hit) take(p.key, hit.h);
  }
  // คอลัมน์ "ห้อง" อย่างเดียว (ไม่มีระดับชั้นแยก) มักเก็บค่าเต็ม เช่น "ม.1/1" → ใช้เป็นชั้น/ห้อง
  if (mapping.room && !mapping.classroom && !mapping.level && fields.some((f) => f.key === 'classroom')) {
    mapping.classroom = mapping.room;
    delete mapping.room;
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
export function detectHeaderRow(rows: unknown[][], fields: FieldDef[] = FIELDS): number {
  const aliasSet = new Set(fields.flatMap((f) => f.aliases.map(compact)));
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

/** ให้คะแนน Sheet ว่าเหมาะเป็นข้อมูลผลการเรียนแค่ไหน (ใช้เลือก Sheet อัตโนมัติ) */
export function scoreGradeSheet(headers: string[], m: ColumnMapping): number {
  if (headers.length === 0) return -1;
  return (missingFields(m).length === 0 ? 100 : 0) + Object.values(m).filter(Boolean).length + (m.teacher ? 5 : 0);
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

// ===== นำเข้าจำนวนนักเรียนทั้งหมด (ตัวหารของร้อยละ) =====
// รองรับ 2 รูปแบบ: (ก) ตารางจำนวนต่อห้อง เช่น ชั้น/ห้อง | ชาย | หญิง | รวม  (ข) รายชื่อนักเรียนทั้งหมด → นับคนไม่ซ้ำต่อห้อง

const pick = (keys: FieldKey[]) => keys.map((k) => FIELDS.find((f) => f.key === k)!);
export const ENROLL_FIELDS: FieldDef[] = [
  ...pick(['classroom', 'level', 'room']),
  { key: 'total', label: 'จำนวนนักเรียนทั้งหมด', aliases: ['จำนวนนักเรียนทั้งหมด', 'จำนวนนักเรียน', 'นักเรียนทั้งหมด', 'รวมทั้งหมด', 'รวม', 'จำนวน', 'total'] },
  { key: 'male', label: 'ชาย (ถ้าไม่มีคอลัมน์รวม)', aliases: ['ชาย', 'male'] },
  { key: 'female', label: 'หญิง (ถ้าไม่มีคอลัมน์รวม)', aliases: ['หญิง', 'female'] },
  ...pick(['studentId', 'studentName']),
];

export type EnrollMode = 'count' | 'roster';
export const enrollModeOf = (m: ColumnMapping): EnrollMode | null =>
  m.total || m.male || m.female ? 'count' : m.studentId || m.studentName ? 'roster' : null;

export function enrollMissing(m: ColumnMapping): string[] {
  const out: string[] = [];
  if (!m.classroom && !(m.level && m.room)) out.push('ชั้น/ห้อง (หรือ ระดับชั้น + ห้อง)');
  if (!enrollModeOf(m)) out.push('จำนวนนักเรียน (หรือ ชาย/หญิง) หรือ รายชื่อ/รหัสนักเรียน');
  return out;
}

export interface EnrollParseResult {
  mode: EnrollMode;
  counts: Record<string, number>;
  invalidRows: { row: number; reason: string }[];
  duplicates: string[];
}

const toCount = (v: unknown): number | null => {
  const s = cellText(v).replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export function parseEnrollment(rows: Record<string, unknown>[], m: ColumnMapping, headerRowIndex = 0): EnrollParseResult {
  const mode = enrollModeOf(m) ?? 'count';
  const get = (r: Record<string, unknown>, k: FieldKey) => (m[k] ? r[m[k]!] : undefined);
  const res: EnrollParseResult = { mode, counts: {}, invalidRows: [], duplicates: [] };
  const rosterSets: Record<string, Set<string>> = {};

  rows.forEach((r, i) => {
    const excelRow = headerRowIndex + i + 2;
    if (Object.values(r).map(cellText).filter(Boolean).length === 0) return;
    const room = normalizeClassroom(get(r, 'classroom'), get(r, 'level'), get(r, 'room'));
    // ข้ามแถวสรุป เช่น "รวม" / "รวมทั้งหมด"
    if (!room || !/^ม\.\d\/\d+$/.test(room)) {
      if (/รวม|total/i.test(Object.values(r).map(cellText).join(' '))) return;
      return void res.invalidRows.push({ row: excelRow, reason: room ? `รูปแบบชั้น/ห้องไม่ถูกต้อง: "${room}"` : 'ไม่มีชั้น/ห้อง' });
    }
    if (mode === 'roster') {
      const id = cellText(get(r, 'studentId'));
      const name = cellText(get(r, 'studentName'));
      if (!id && !name) return void res.invalidRows.push({ row: excelRow, reason: 'ไม่มีรหัสหรือชื่อนักเรียน' });
      (rosterSets[room] ??= new Set()).add(id ? `id:${compact(id)}` : `n:${compact(name)}`);
      return;
    }
    let total = toCount(get(r, 'total'));
    if (total === null) {
      const male = toCount(get(r, 'male'));
      const female = toCount(get(r, 'female'));
      total = male === null && female === null ? null : (male ?? 0) + (female ?? 0);
    }
    if (total === null) return void res.invalidRows.push({ row: excelRow, reason: `${room}: ไม่มีจำนวนนักเรียน` });
    if (!Number.isInteger(total) || total <= 0 || total > 2000)
      return void res.invalidRows.push({ row: excelRow, reason: `${room}: จำนวนไม่ถูกต้อง (${cellText(get(r, 'total'))})` });
    if (room in res.counts) {
      res.duplicates.push(`แถว ${excelRow}: ${room} ซ้ำ (ใช้ค่าแรก ${res.counts[room]} ไม่ใช้ ${total})`);
      return;
    }
    res.counts[room] = total;
  });
  if (mode === 'roster') for (const [room, set] of Object.entries(rosterSets)) res.counts[room] = set.size;
  return res;
}
