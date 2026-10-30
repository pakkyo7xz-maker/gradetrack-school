// เก็บข้อมูลใน localStorage ของเบราว์เซอร์ (ไม่มีการส่งข้อมูลออกนอกเครื่อง)
import type { ColumnMapping } from './importMapping';
import { GRADE_RESULTS, STATUSES, type EnrollmentMap, type GradeRecord, type Tracking, type TrackingMap } from './types';

const KEYS = {
  records: 'gradetrack.records.v1',
  tracking: 'gradetrack.tracking.v1',
  mapping: 'gradetrack.mapping.v1',
  meta: 'gradetrack.meta.v1',
  enrollment: 'gradetrack.enrollment.v1',
  lastBackup: 'gradetrack.lastBackup.v1',
};

export interface Meta {
  source: 'sample' | 'import' | 'backup' | 'empty';
  fileName?: string;
  importedAt?: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

/** ตรวจและทำความสะอาดข้อมูลที่อ่านมา (จาก localStorage หรือไฟล์สำรอง) */
export function sanitizeRecords(v: unknown): GradeRecord[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      key: str(r.key),
      studentId: str(r.studentId),
      studentNo: str(r.studentNo),
      studentName: str(r.studentName),
      classroom: str(r.classroom),
      subjectCode: str(r.subjectCode),
      subjectName: str(r.subjectName),
      teacher: str(r.teacher),
      homeroomTeacher: str(r.homeroomTeacher),
      result: r.result as GradeRecord['result'],
      term: str(r.term),
    }))
    .filter((r) => r.key && r.studentName && GRADE_RESULTS.includes(r.result));
}

export function sanitizeTracking(v: unknown): TrackingMap {
  const out: TrackingMap = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
    if (!t || typeof t !== 'object') continue;
    const o = t as Record<string, unknown>;
    const status = STATUSES.some((s) => s.value === o.status) ? (o.status as Tracking['status']) : 'pending';
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(str(o.dueDate)) ? str(o.dueDate) : '';
    out[k] = { status, dueDate, note: str(o.note), updatedAt: str(o.updatedAt) };
  }
  return out;
}

export const loadRecords = () => {
  const v = read<unknown>(KEYS.records);
  return v === null ? null : sanitizeRecords(v);
};
export const loadTracking = () => sanitizeTracking(read<unknown>(KEYS.tracking));
export const loadMapping = () => read<ColumnMapping>(KEYS.mapping) ?? undefined;
export const loadMeta = () => read<Meta>(KEYS.meta);

export const saveRecords = (r: GradeRecord[]) => write(KEYS.records, r);
export const saveTracking = (t: TrackingMap) => write(KEYS.tracking, t);
export const saveMapping = (m: ColumnMapping) => write(KEYS.mapping, m);
export const saveMeta = (m: Meta) => write(KEYS.meta, m);

export function sanitizeEnrollment(v: unknown): EnrollmentMap {
  const out: EnrollmentMap = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [room, e] of Object.entries(v as Record<string, unknown>)) {
    if (!room || !e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    const total = o.total === null ? null : Number(o.total);
    if (total !== null && (!Number.isInteger(total) || total <= 0 || total > 2000)) continue;
    const source = o.source === 'import' || o.source === 'manual' || o.source === 'sample' ? o.source : 'manual';
    out[room] = { total, source, updatedAt: str(o.updatedAt) };
  }
  return out;
}

/** null = ยังไม่เคยบันทึก (ใช้ตัดสินว่าจะโหลดข้อมูลตัวอย่างหรือไม่) */
export const loadEnrollment = () => {
  const v = read<unknown>(KEYS.enrollment);
  return v === null ? null : sanitizeEnrollment(v);
};
export const saveEnrollment = (e: EnrollmentMap) => write(KEYS.enrollment, e);

/** เวลาที่ส่งออกไฟล์สำรองล่าสุด (ISO) */
export const loadLastBackup = () => read<string>(KEYS.lastBackup);
export const saveLastBackup = (iso: string) => write(KEYS.lastBackup, iso);

/** ขอให้เบราว์เซอร์เก็บข้อมูลถาวร ไม่ลบอัตโนมัติเมื่อพื้นที่เครื่องเหลือน้อย */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}
