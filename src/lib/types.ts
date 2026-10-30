// ===== Data Model =====
// แยกจาก Import Mapping (ดู importMapping.ts) เพื่อให้ปรับตามไฟล์ Excel จริงได้โดยไม่กระทบส่วนอื่น

export type GradeResult = '0' | 'ร' | 'มส';
export const GRADE_RESULTS: GradeResult[] = ['0', 'ร', 'มส'];

export type TrackingStatus = 'pending' | 'in_progress' | 'review' | 'done';
export const STATUSES: { value: TrackingStatus; label: string }[] = [
  { value: 'pending', label: 'ยังไม่ดำเนินการ' },
  { value: 'in_progress', label: 'กำลังแก้ไข' },
  { value: 'review', label: 'รอตรวจสอบ' },
  { value: 'done', label: 'แก้ไขสำเร็จ' },
];
export const statusLabel = (s: TrackingStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;

/** ข้อมูลผลการเรียน 1 รายการ (นักเรียน 1 คน × 1 วิชา) ที่มาจากไฟล์ Excel */
export interface GradeRecord {
  /** คีย์คงที่ ใช้ผูกกับสถานะการติดตาม (สร้างจากนักเรียน + วิชา) */
  key: string;
  studentId: string;
  studentName: string;
  /** รูปแบบมาตรฐาน เช่น "ม.1/1" */
  classroom: string;
  subjectCode: string;
  subjectName: string;
  teacher: string;
  homeroomTeacher: string;
  result: GradeResult;
  term: string;
}

/** สถานะการติดตาม เก็บแยกจากข้อมูลนำเข้า เพื่อไม่ให้หายเมื่อนำเข้าไฟล์ใหม่ */
export interface Tracking {
  status: TrackingStatus;
  dueDate: string; // YYYY-MM-DD
  note: string;
  updatedAt: string;
}

export type TrackingMap = Record<string, Tracking>;

export const emptyTracking = (): Tracking => ({ status: 'pending', dueDate: '', note: '', updatedAt: '' });

export interface Row extends GradeRecord {
  tracking: Tracking;
  overdue: boolean;
}

export interface Filters {
  level: string;
  classroom: string;
  teacher: string;
  result: '' | GradeResult;
  status: '' | TrackingStatus | 'overdue';
  search: string;
}

export const emptyFilters = (): Filters => ({ level: '', classroom: '', teacher: '', result: '', status: '', search: '' });

/**
 * จำนวนนักเรียนทั้งหมดต่อห้อง (ตัวหารของร้อยละ)
 * ต้องมาจากข้อมูลที่เชื่อถือได้ (นำเข้าจากทะเบียน/กรอกเอง) — ห้ามประมาณค่า
 */
export interface Enrollment {
  /** null = รู้ว่ามีห้องนี้ แต่ยังไม่มีจำนวนที่เชื่อถือได้ */
  total: number | null;
  source: 'import' | 'manual' | 'sample';
  updatedAt: string;
}
export type EnrollmentMap = Record<string, Enrollment>;
