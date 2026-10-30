// ข้อมูลจำลองสำหรับทดลองระบบเท่านั้น — ชื่อทั้งหมดสมมติขึ้น ไม่ใช่ข้อมูลนักเรียน/ครูจริง
import { recordKey } from './normalize';
import type { EnrollmentMap, GradeRecord, GradeResult, TrackingMap } from './types';

type S = [studentId: string, name: string, classroom: string, code: string, subject: string, teacher: string, result: GradeResult];

const HOMEROOM: Record<string, string> = {
  'ม.1/1': 'ครูตัวอย่าง หนึ่ง',
  'ม.1/2': 'ครูตัวอย่าง สอง',
  'ม.2/1': 'ครูตัวอย่าง สาม',
  'ม.3/2': 'ครูตัวอย่าง สี่',
  'ม.4/1': 'ครูตัวอย่าง ห้า',
  'ม.5/3': 'ครูตัวอย่าง หก',
  'ม.6/2': 'ครูตัวอย่าง เจ็ด',
};

const ROWS: S[] = [
  ['DEMO001', 'เด็กชายทดสอบ ก', 'ม.1/1', 'ค21101', 'คณิตศาสตร์ 1', 'ครูสมมติ คณิตดี', '0'],
  ['DEMO001', 'เด็กชายทดสอบ ก', 'ม.1/1', 'ว21101', 'วิทยาศาสตร์ 1', 'ครูสมมติ วิทยาเด่น', 'ร'],
  ['DEMO002', 'เด็กหญิงทดสอบ ข', 'ม.1/1', 'อ21101', 'ภาษาอังกฤษ 1', 'ครูสมมติ ภาษาสวย', 'มส'],
  ['DEMO003', 'เด็กชายตัวอย่าง ค', 'ม.1/2', 'ค21101', 'คณิตศาสตร์ 1', 'ครูสมมติ คณิตดี', 'ร'],
  ['DEMO004', 'เด็กหญิงตัวอย่าง ง', 'ม.1/2', 'ท21101', 'ภาษาไทย 1', 'ครูสมมติ ไทยงาม', '0'],
  ['DEMO005', 'เด็กชายจำลอง จ', 'ม.2/1', 'ส22101', 'สังคมศึกษา 3', 'ครูสมมติ สังคมสุข', 'มส'],
  ['DEMO005', 'เด็กชายจำลอง จ', 'ม.2/1', 'พ22101', 'สุขศึกษาและพลศึกษา 3', 'ครูสมมติ กีฬาแกร่ง', 'มส'],
  ['DEMO006', 'เด็กหญิงจำลอง ฉ', 'ม.2/1', 'ว22101', 'วิทยาศาสตร์ 3', 'ครูสมมติ วิทยาเด่น', '0'],
  ['DEMO007', 'เด็กชายสมมติ ช', 'ม.3/2', 'ค23101', 'คณิตศาสตร์ 5', 'ครูสมมติ เลขคล่อง', 'ร'],
  ['DEMO008', 'เด็กหญิงสมมติ ซ', 'ม.3/2', 'อ23101', 'ภาษาอังกฤษ 5', 'ครูสมมติ ภาษาสวย', '0'],
  ['DEMO009', 'นายทดลอง ฌ', 'ม.4/1', 'ค31101', 'คณิตศาสตร์พื้นฐาน 1', 'ครูสมมติ เลขคล่อง', '0'],
  ['DEMO009', 'นายทดลอง ฌ', 'ม.4/1', 'ว31101', 'ฟิสิกส์ 1', 'ครูสมมติ ฟิสิกส์ใส', 'ร'],
  ['DEMO009', 'นายทดลอง ฌ', 'ม.4/1', 'ท31101', 'ภาษาไทย 1', 'ครูสมมติ ไทยงาม', 'มส'],
  ['DEMO010', 'นางสาวทดลอง ญ', 'ม.4/1', 'ศ31101', 'ศิลปะ 1', 'ครูสมมติ ศิลป์ใจ', 'ร'],
  ['DEMO011', 'นายตัวอย่าง ฎ', 'ม.5/3', 'ว32201', 'เคมี 3', 'ครูสมมติ เคมีชัด', '0'],
  ['DEMO012', 'นางสาวตัวอย่าง ฏ', 'ม.5/3', 'ส32101', 'สังคมศึกษา 3', 'ครูสมมติ สังคมสุข', 'ร'],
  ['DEMO013', 'นายจำลอง ฐ', 'ม.6/2', 'อ33101', 'ภาษาอังกฤษ 5', 'ครูสมมติ ภาษาสวย', 'มส'],
  ['DEMO014', 'นางสาวจำลอง ฑ', 'ม.6/2', 'ว33201', 'ชีววิทยา 5', 'ครูสมมติ ชีวะดี', '0'],
];

export function sampleRecords(): GradeRecord[] {
  return ROWS.map(([studentId, studentName, classroom, subjectCode, subjectName, teacher, result]) => {
    const base = { studentId, studentNo: String(Number(studentId.slice(4))), studentName, classroom, subjectCode, subjectName, teacher, result, homeroomTeacher: HOMEROOM[classroom] ?? '', term: '1/2569' };
    return { key: recordKey(base), ...base };
  });
}

/** สถานะตัวอย่างบางรายการ (กำหนดวันที่สัมพันธ์กับวันนี้ เพื่อให้เห็นรายการเกินกำหนด) */
export function sampleTracking(records: GradeRecord[]): TrackingMap {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const now = new Date().toISOString();
  const t: TrackingMap = {};
  const set = (i: number, status: TrackingMap[string]['status'], due: number | null, note: string) => {
    if (records[i]) t[records[i].key] = { status, dueDate: due === null ? '' : day(due), note, updatedAt: now };
  };
  set(0, 'in_progress', 7, 'นัดสอบแก้ตัว');
  set(1, 'done', -3, 'ส่งงานครบแล้ว');
  set(2, 'pending', -5, '');
  set(4, 'review', 2, 'ส่งงานแล้ว รอครูตรวจ');
  set(8, 'done', -10, '');
  set(10, 'pending', -1, 'ติดต่อผู้ปกครองแล้ว');
  set(13, 'in_progress', 14, '');
  return t;
}

/** จำนวนนักเรียนทั้งหมดต่อห้อง (สมมติ) — รวมห้องที่ไม่มีนักเรียนติด เพื่อให้ร้อยละคำนวณได้ครบ */
const SAMPLE_ENROLLMENT: Record<string, number> = {
  'ม.1/1': 38, 'ม.1/2': 37, 'ม.1/3': 36,
  'ม.2/1': 40, 'ม.2/2': 39,
  'ม.3/1': 35, 'ม.3/2': 36,
  'ม.4/1': 32, 'ม.4/2': 30,
  'ม.5/1': 31, 'ม.5/2': 29, 'ม.5/3': 28,
  'ม.6/1': 30, 'ม.6/2': 27,
};

export function sampleEnrollment(): EnrollmentMap {
  const now = new Date().toISOString();
  return Object.fromEntries(Object.entries(SAMPLE_ENROLLMENT).map(([room, total]) => [room, { total, source: 'sample' as const, updatedAt: now }]));
}
