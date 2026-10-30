import type { GradeResult } from './types';

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** แปลงค่าใดๆ จาก Excel เป็นข้อความที่ตัดช่องว่างแล้ว (กันค่า null/undefined/ตัวเลข) */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return String(v)
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ใช้เปรียบเทียบหัวคอลัมน์/คีย์: ตัดช่องว่าง จุด ขีด (รวม – —) และตัวพิมพ์ */
export function compact(s: string): string {
  return cellText(s).toLowerCase().replace(/[\s._\-–—:()]/g, '');
}

/** แปลงผลการเรียนเป็น 0 / ร / มส — คืน null ถ้าไม่ใช่ 3 ประเภทนี้ (เช่น เกรด 1-4) */
export function normalizeResult(v: unknown): GradeResult | null {
  const s = compact(cellText(v));
  if (/^0+$/.test(s)) return '0'; // 0, 0.0, 0.00
  if (s === 'ร' || s === 'r' || s === 'รอ' || s === 'incomplete') return 'ร';
  if (s === 'มส' || s === 'ms' || s === 'ไม่มีสิทธิ์สอบ' || s === 'ไม่มีสิทธิสอบ') return 'มส';
  return null;
}

/**
 * แปลงชั้น/ห้องเป็นรูปแบบ "ม.X/Y"
 * รองรับ: "ม.1/1", "ม1/1", "ม. 1 / 1", "1/1", "มัธยมศึกษาปีที่ 1/1", หรือแยกคอลัมน์ ชั้น="ม.1" ห้อง="1"
 */
export function normalizeClassroom(classroom: unknown, level?: unknown, room?: unknown): string {
  const raw = cellText(classroom);
  const m = raw.match(/(\d)\s*\/\s*(\d{1,2})/) ?? (raw ? null : cellText(room).match(/(\d)\s*\/\s*(\d{1,2})/));
  if (m) return `ม.${m[1]}/${Number(m[2])}`;
  const lv = cellText(level).match(/(\d)/);
  const rm = cellText(room).match(/(\d{1,2})\s*$/) ?? cellText(room).match(/(\d{1,2})/);
  if (lv && rm) return `ม.${lv[1]}/${Number(rm[1])}`;
  if (raw) {
    // มีแค่ชั้น + คอลัมน์ห้องแยก
    const lv2 = raw.match(/(\d)/);
    if (lv2 && rm) return `ม.${lv2[1]}/${Number(rm[1])}`;
    return raw;
  }
  return '';
}

/** เรียงห้องตามระดับชั้นและเลขห้อง */
export function compareClassroom(a: string, b: string): number {
  const pa = a.match(/(\d)\/(\d+)/);
  const pb = b.match(/(\d)\/(\d+)/);
  if (pa && pb) return Number(pa[1]) - Number(pb[1]) || Number(pa[2]) - Number(pb[2]);
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b, 'th');
}

export function levelOf(classroom: string): string {
  const m = classroom.match(/^ม\.(\d)\//);
  return m ? `ม.${m[1]}` : classroom;
}

/** วันที่จาก Excel (serial / Date / ข้อความ) → YYYY-MM-DD หรือ '' */
export function normalizeDate(v: unknown): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : toIsoLocal(v);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = cellText(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

export function toIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayIso(): string {
  return toIsoLocal(new Date());
}

export function formatThaiDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${m}/${y + 543}`;
}

/** คีย์คงที่ของรายการ: ใช้รหัสนักเรียน (ถ้ามี) หรือชื่อ+ห้อง และรหัสวิชา (ถ้ามี) หรือชื่อวิชา */
export function recordKey(r: { studentId: string; studentName: string; classroom: string; subjectCode: string; subjectName: string }): string {
  const student = r.studentId ? `id:${compact(r.studentId)}` : `n:${compact(r.studentName)}@${compact(r.classroom)}`;
  const subject = r.subjectCode ? `c:${compact(r.subjectCode)}` : `s:${compact(r.subjectName)}`;
  return `${student}|${subject}`;
}
