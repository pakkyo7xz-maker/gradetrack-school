import * as XLSX from 'xlsx';
import { saveFile, saveWorkbook } from './download';
import type { ColumnMapping } from './importMapping';
import { cellText, formatThaiDate } from './normalize';
import { sanitizeEnrollment, sanitizeRecords, sanitizeTracking, saveLastBackup } from './storage';
import { statusLabel, type EnrollmentMap, type GradeRecord, type Row, type TrackingMap } from './types';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('รองรับเฉพาะไฟล์ .xlsx .xls และ .csv');
  if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์มีขนาดใหญ่เกิน 20 MB');
  // CSV (เช่น ที่แปลงจาก PDF) อ่านเป็นข้อความ UTF-8 เพื่อให้ภาษาไทยไม่เพี้ยน
  if (/\.csv$/i.test(file.name)) return XLSX.read((await file.text()).replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

export function sheetMatrix(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false });
}

/** แปลง matrix เป็น object ตามหัวคอลัมน์ในแถว headerRow (หัวซ้ำจะเติม _2, _3) */
export function rowsFromMatrix(matrix: unknown[][], headerRow: number): { headers: string[]; rows: Record<string, unknown>[] } {
  const rawHeaders = matrix[headerRow] ?? [];
  const width = Math.max(rawHeaders.length, ...matrix.slice(headerRow + 1).map((r) => r.length), 0);
  const counts: Record<string, number> = {};
  const headers: string[] = [];
  for (let i = 0; i < width; i++) {
    let h = cellText(rawHeaders[i]) || `คอลัมน์ ${i + 1}`;
    counts[h] = (counts[h] ?? 0) + 1;
    if (counts[h] > 1) h = `${h}_${counts[h]}`;
    headers.push(h);
  }
  const rows = matrix.slice(headerRow + 1).map((r) => {
    const o: Record<string, unknown> = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ''));
    return o;
  });
  return { headers, rows };
}

export const stamp = () => new Date().toISOString().slice(0, 16).replace(/\D/g, '');

/** ส่งออกรายการที่กรองอยู่เป็น Excel */
export function exportRowsToExcel(rows: Row[], fileName = `gradetrack-report-${stamp()}.xlsx`) {
  const data = rows.map((r, i) => ({
    ลำดับ: i + 1,
    รหัสนักเรียน: r.studentId,
    'ชื่อ-นามสกุล': r.studentName,
    'ชั้น/ห้อง': r.classroom,
    เลขที่: r.studentNo,
    รหัสวิชา: r.subjectCode,
    ชื่อรายวิชา: r.subjectName,
    ครูผู้สอน: r.teacher,
    ครูประจำชั้น: r.homeroomTeacher,
    ผลการเรียน: r.result,
    สถานะ: statusLabel(r.tracking.status),
    กำหนดแก้ไข: formatThaiDate(r.tracking.dueDate),
    เกินกำหนด: r.overdue ? 'เกินกำหนด' : '',
    หมายเหตุ: r.tracking.note,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [6, 12, 26, 9, 7, 10, 24, 22, 22, 10, 16, 12, 10, 30].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'รายงาน');
  return saveWorkbook(wb, fileName);
}

// ===== สำรองข้อมูล (JSON) =====
export interface Backup {
  app: 'gradetrack';
  version: 1;
  exportedAt: string;
  records: GradeRecord[];
  tracking: TrackingMap;
  mapping?: ColumnMapping;
  enrollment?: EnrollmentMap;
}

export async function exportBackup(records: GradeRecord[], tracking: TrackingMap, mapping: ColumnMapping | undefined, enrollment: EnrollmentMap) {
  const backup: Backup = { app: 'gradetrack', version: 1, exportedAt: new Date().toISOString(), records, tracking, mapping, enrollment };
  const ok = await saveFile(`gradetrack-backup-${stamp()}.json`, new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  if (ok) {
    saveLastBackup(backup.exportedAt);
    window.dispatchEvent(new Event('gradetrack:backup'));
  }
  return ok;
}

export async function readBackup(file: File): Promise<Backup> {
  if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์มีขนาดใหญ่เกินไป');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง');
  }
  const o = parsed as Partial<Backup> | null;
  if (!o || typeof o !== 'object' || o.app !== 'gradetrack') throw new Error('ไม่ใช่ไฟล์สำรองข้อมูลของ GradeTrack');
  const mapping = o.mapping && typeof o.mapping === 'object' && !Array.isArray(o.mapping) ? o.mapping : undefined;
  return {
    app: 'gradetrack',
    version: 1,
    exportedAt: cellText(o.exportedAt),
    records: sanitizeRecords(o.records),
    tracking: sanitizeTracking(o.tracking),
    mapping,
    enrollment: o.enrollment === undefined ? undefined : sanitizeEnrollment(o.enrollment),
  };
}
