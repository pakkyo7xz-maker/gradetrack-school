// ===== ส่งออกรายงาน PDF (A4) =====
// ใช้ pdfmake + ฟอนต์ Sarabun (SIL Open Font License) ฝังใน PDF เพื่อให้ภาษาไทยแสดงถูกต้อง
// - ตัดบรรทัดภาษาไทยเองตามขอบเขตคำ (Intl.Segmenter) เพราะ pdfmake ตัดคำไทยกลางตัวอักษร
// - ตารางไม่ตัดแถวข้ามหน้า (dontBreakRows) และหัวตารางซ้ำทุกหน้า (headerRows)
import type { Content, ContentTable, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { notify, saveFile } from './download';
import { stamp } from './excel';
import { formatThaiDate } from './normalize';
import { loadReportSettings } from './reportSettings';
import { studentKey } from './selectors';
import { fmtPct, type GroupStats, type TeacherStats } from './stats';
import { GRADE_RESULTS, statusLabel, type Row } from './types';

interface PdfEngine {
  pdfMake: { createPdf: (doc: TDocumentDefinitions, layouts?: unknown, fonts?: unknown, vfs?: unknown) => { getBlob: (cb: (b: Blob) => void) => void } };
  fonts: Record<string, Record<string, string>>;
  vfs: Record<string, string>;
  measure: (text: string, size: number, bold?: boolean) => number;
}

let engine: Promise<PdfEngine> | null = null;

function loadEngine(): Promise<PdfEngine> {
  engine ??= (async () => {
    const [mod, regular, bold] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('../assets/fonts/Sarabun-Regular.ttf?base64'),
      import('../assets/fonts/Sarabun-Bold.ttf?base64'),
    ]);
    const pdfMake = ((mod as { default?: unknown }).default ?? mod) as PdfEngine['pdfMake'];
    const vfs = { 'Sarabun-Regular.ttf': regular.default, 'Sarabun-Bold.ttf': bold.default };
    const fonts = { Sarabun: { normal: 'Sarabun-Regular.ttf', bold: 'Sarabun-Bold.ttf', italics: 'Sarabun-Regular.ttf', bolditalics: 'Sarabun-Bold.ttf' } };

    // วัดความกว้างข้อความด้วยฟอนต์เดียวกับใน PDF (ใช้ตัดบรรทัด)
    let measure: PdfEngine['measure'] = (t, size) => t.length * size * 0.5;
    try {
      const buf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
      const faces = [new FontFace('GTPdfSarabun', buf(regular.default), { weight: '400' }), new FontFace('GTPdfSarabun', buf(bold.default), { weight: '700' })];
      await Promise.all(faces.map((f) => f.load()));
      faces.forEach((f) => document.fonts.add(f));
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx)
        measure = (t, size, b = false) => {
          ctx.font = `${b ? 700 : 400} ${size}px GTPdfSarabun`;
          return ctx.measureText(t).width;
        };
    } catch {
      /* ใช้ค่าประมาณ */
    }
    return { pdfMake, fonts, vfs, measure };
  })();
  return engine;
}

// ---------- ตัดบรรทัดภาษาไทย ----------
const segmenter = (g: 'word' | 'grapheme') => (typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: g }) : null);
const words = (s: string) => {
  const seg = segmenter('word');
  return seg ? [...seg.segment(s)].map((x) => x.segment) : s.split(/(?<=\s)/);
};
const graphemes = (s: string) => {
  const seg = segmenter('grapheme');
  return seg ? [...seg.segment(s)].map((x) => x.segment) : [...s];
};

function wrap(e: PdfEngine, text: string, width: number, size: number, bold = false): string {
  const avail = (width - 8) * 0.97; // หักระยะขอบเซลล์
  const fits = (t: string) => e.measure(t, size, bold) <= avail;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of words(para)) {
      if (fits(line + w)) {
        line += w;
        continue;
      }
      if (line.trim()) out.push(line.trimEnd());
      line = '';
      const word = w.trimStart();
      if (fits(word)) {
        line = word;
        continue;
      }
      for (const g of graphemes(word)) {
        if (line && !fits(line + g)) {
          out.push(line);
          line = '';
        }
        line += g;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

// ---------- ส่วนประกอบเอกสาร ----------
type Align = 'left' | 'right' | 'center';
interface Col {
  header: string;
  width: number;
  align?: Align;
}
type Val = string | number | null | undefined;

const FONT = 9;
const LAYOUT = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0.8 : 0.4),
  vLineWidth: () => 0.4,
  hLineColor: () => '#94a3b8',
  vLineColor: () => '#cbd5e1',
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

function table(e: PdfEngine, cols: Col[], rows: Val[][], opts: { groupHeader?: TableCell[]; boldLast?: boolean } = {}): ContentTable {
  const head: TableCell[] = cols.map((c) => ({ text: wrap(e, c.header, c.width, FONT, true), bold: true, fillColor: '#e2e8f0', alignment: c.align ?? 'left' }));
  const body: TableCell[][] = rows.map((r, ri) =>
    r.map((v, i) => {
      const c = cols[i];
      const text = v === null || v === undefined || v === '' ? '' : String(v);
      const bold = !!opts.boldLast && ri === rows.length - 1;
      return { text: wrap(e, text, c.width, FONT, bold), alignment: c.align ?? 'left', bold, fillColor: bold ? '#f1f5f9' : undefined };
    }),
  );
  const headerRows = opts.groupHeader ? 2 : 1;
  return {
    table: { headerRows, dontBreakRows: true, keepWithHeaderRows: 1, widths: cols.map((c) => c.width), body: opts.groupHeader ? [opts.groupHeader, head, ...body] : [head, ...body] },
    layout: LAYOUT,
    fontSize: FONT,
  };
}

const thaiToday = () => new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
const num = (n: number | null) => (n === null ? '—' : n.toLocaleString('th-TH'));
const LANDSCAPE_W = 842 - 60;
const PORTRAIT_W = 595 - 60;

function doc(title: string, orientation: 'portrait' | 'landscape', content: Content[]): TDocumentDefinitions {
  const s = loadReportSettings();
  return {
    pageSize: 'A4',
    pageOrientation: orientation,
    pageMargins: [30, 78, 30, 40],
    info: { title: `${s.schoolName} - ${title}`, creator: 'GradeTrack' },
    defaultStyle: { font: 'Sarabun', fontSize: 10, lineHeight: 1.1 },
    header: () => ({
      margin: [30, 22, 30, 0],
      stack: [
        {
          columns: [
            { text: s.schoolName, bold: true, fontSize: 15 },
            { text: `วันที่ออกรายงาน ${thaiToday()}`, alignment: 'right', fontSize: 9, color: '#475569', margin: [0, 4, 0, 0] },
          ],
        },
        { columns: [{ text: title, fontSize: 11.5, bold: true, color: '#1d4ed8' }, { text: s.termLabel, alignment: 'right', fontSize: 9, color: '#475569' }] },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: (orientation === 'landscape' ? 842 : 595) - 60, y2: 4, lineWidth: 0.8, lineColor: '#1d4ed8' }] },
      ],
    }),
    footer: (current: number, total: number) => ({ text: `หน้า ${current} / ${total}`, alignment: 'center', fontSize: 8, color: '#64748b', margin: [0, 14, 0, 0] }),
    content,
  };
}

const para = (text: string, extra: Record<string, unknown> = {}): Content => ({ text, fontSize: 9, color: '#334155', margin: [0, 0, 0, 6], ...extra });
const heading = (text: string): Content => ({ text, bold: true, fontSize: 11, margin: [0, 10, 0, 4] });

const NOTES: Content = {
  margin: [0, 10, 0, 0],
  fontSize: 8,
  color: '#475569',
  stack: [
    'หมายเหตุ: นับนักเรียนไม่ซ้ำด้วยรหัสนักเรียน (นักเรียนที่ติดหลายวิชานับเป็น 1 คน) และแสดงจำนวนรายการรายวิชาแยกต่างหาก',
    'ร้อยละ = จำนวนนักเรียนไม่ซ้ำ / นักเรียนทั้งหมดในกลุ่ม × 100 · ร้อยละรายประเภทรวมกันอาจเกินร้อยละรวม เพราะนักเรียน 1 คนติดได้หลายประเภท',
    '"—" = ไม่มีจำนวนนักเรียนทั้งหมดที่เชื่อถือได้ ระบบไม่คำนวณร้อยละแทน',
  ],
};

/**
 * แยก "ำ" (U+0E33) เป็น "ํ" + "า" ก่อนสร้าง PDF: หน้าตาเหมือนเดิม แต่ข้อความที่คัดลอก/ค้นหาใน PDF ถูกต้อง
 * (ถ้าไม่แยก ตาราง ToUnicode ของ pdfkit จะผูกสระอาเข้ากับ "ำ" ทำให้ "รายการ" คัดลอกออกมาเป็น "ร ยก ร")
 */
function fixThai<T>(node: T): T {
  if (typeof node === 'string') return node.replace(/\u0E33/g, '\u0E4D\u0E32') as T;
  if (typeof node === 'function') return ((...args: unknown[]) => fixThai((node as (...a: unknown[]) => unknown)(...args))) as T;
  if (Array.isArray(node)) return node.map(fixThai) as T;
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === 'layout' ? v : fixThai(v)])) as T;
  return node;
}

async function render(name: string, build: (e: PdfEngine) => TDocumentDefinitions) {
  notify({ tone: 'blue', text: 'กำลังสร้าง PDF…' });
  try {
    const e = await loadEngine();
    const definition = fixThai(build(e));
    const blob = await new Promise<Blob>((resolve) => e.pdfMake.createPdf(definition, undefined, e.fonts, e.vfs).getBlob(resolve));
    await saveFile(`gradetrack-${name}-${stamp()}.pdf`, blob);
  } catch {
    notify({ tone: 'red', text: 'สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่' });
  }
}

// ---------- ตารางสถิติกลุ่ม (ระดับชั้น / ห้อง) ----------
function groupTable(e: PdfEngine, groups: GroupStats[], label: string, total?: GroupStats): ContentTable {
  const w = [64, 46, 40, 46, 36, 46, 36, 46, 36, 46, 44, 34, 34, 34, 44, 44, 48];
  const extra = LANDSCAPE_W - w.reduce((a, b) => a + b, 0);
  w[0] += extra;
  const cols: Col[] = [
    { header: label, width: w[0] },
    { header: 'นักเรียนทั้งหมด', width: w[1], align: 'right' },
    { header: 'คน', width: w[2], align: 'right' },
    { header: 'ร้อยละ', width: w[3], align: 'right' },
    ...GRADE_RESULTS.flatMap((_g, i): Col[] => [
      { header: 'คน', width: w[4 + i * 2], align: 'right' },
      { header: 'ร้อยละ', width: w[5 + i * 2], align: 'right' },
    ]),
    { header: 'รวม', width: w[10], align: 'right' },
    ...GRADE_RESULTS.map((g, i): Col => ({ header: g, width: w[11 + i], align: 'right' })),
    { header: 'ค้างแก้ไข', width: w[14], align: 'right' },
    { header: 'สำเร็จ', width: w[15], align: 'right' },
    { header: 'เกินกำหนด', width: w[16], align: 'right' },
  ];
  const all = total ? [...groups, total] : groups;
  const rows: Val[][] = all.map((g) => [
    g.label,
    num(g.enrolled),
    num(g.students),
    fmtPct(g.pct),
    ...GRADE_RESULTS.flatMap((t) => [num(g.studentsByType[t]), fmtPct(g.pctByType[t])]),
    num(g.records),
    ...GRADE_RESULTS.map((t) => num(g.recordsByType[t])),
    num(g.records - g.status.done),
    num(g.status.done),
    num(g.overdue),
  ]);
  const gh = (text: string, colSpan: number): TableCell[] => [{ text, colSpan, alignment: 'center', bold: true, fillColor: '#cbd5e1' }, ...Array.from({ length: colSpan - 1 }, () => ({ text: '' }))];
  const groupHeader: TableCell[] = [
    ...gh('', 2),
    ...gh('นักเรียนที่ติด', 2),
    ...GRADE_RESULTS.flatMap((t) => gh(`ติด ${t}`, 2)),
    ...gh('จำนวนรายการรายวิชา', 4),
    ...gh('สถานะการติดตาม (รายการ)', 3),
  ];
  return table(e, cols, rows, { groupHeader, boldLast: !!total });
}

// ---------- รายชื่อนักเรียน ----------
function studentTable(e: PdfEngine, rows: Row[], opts: { teacher: boolean; classroom?: boolean }): ContentTable {
  const cols: Col[] = [
    ...(opts.classroom === false ? [] : [{ header: 'ห้อง', width: 40 }]),
    { header: 'เลขที่', width: 30, align: 'right' as Align },
    { header: 'รหัส', width: 52 },
    { header: 'ชื่อ-นามสกุล', width: 140 },
    { header: 'รหัสวิชา', width: 48 },
    { header: 'รายวิชา', width: 118 },
    ...(opts.teacher ? [{ header: 'ครูผู้สอน', width: 84 }] : []),
    { header: 'ผล', width: 28, align: 'center' as Align },
    { header: 'สถานะ', width: 66 },
    { header: 'วันที่ติดตาม', width: 62 },
    { header: 'หมายเหตุ', width: 0 },
  ];
  const used = cols.reduce((a, c) => a + c.width, 0);
  cols[cols.length - 1].width = LANDSCAPE_W - used;
  const body: Val[][] = rows.map((r) => [
    ...(opts.classroom === false ? [] : [r.classroom]),
    r.studentNo,
    r.studentId,
    r.studentName,
    r.subjectCode,
    r.subjectName,
    ...(opts.teacher ? [r.teacher || 'ไม่ระบุ'] : []),
    r.result,
    statusLabel(r.tracking.status) + (r.overdue ? ' (เกินกำหนด)' : ''),
    formatThaiDate(r.tracking.dueDate),
    r.tracking.note,
  ]);
  return table(e, cols, body);
}

function rowSummary(rows: Row[]): string {
  const people = new Set(rows.map(studentKey)).size;
  const byType = GRADE_RESULTS.map((t) => {
    const rs = rows.filter((r) => r.result === t);
    const p = new Set(rs.map(studentKey)).size;
    return `ติด ${t}: ${p} คน / ${rs.length} รายการ`;
  });
  const done = rows.filter((r) => r.tracking.status === 'done').length;
  return `นักเรียน ${people} คน (ไม่นับซ้ำ) · ${rows.length} รายการรายวิชา · ค้างแก้ไข ${rows.length - done} · แก้ไขสำเร็จ ${done}\n${byType.join(' · ')}`;
}

// ==================== รายงานแต่ละแบบ ====================

/** ภาพรวมโรงเรียน (แนวตั้ง) */
export const exportOverviewPdf = (school: GroupStats, levels: GroupStats[]) =>
  render('overview', (e) => {
    const kv: Val[][] = [
      ['นักเรียนทั้งหมด', num(school.enrolled), ''],
      ['นักเรียนที่ติด 0 ร มส (คนไม่ซ้ำ)', num(school.students), fmtPct(school.pct)],
      ...GRADE_RESULTS.map((t): Val[] => [`นักเรียนที่ติด ${t}`, num(school.studentsByType[t]), fmtPct(school.pctByType[t])]),
      ['จำนวนรายการรายวิชาทั้งหมด', num(school.records), ''],
      ...GRADE_RESULTS.map((t): Val[] => [`รายการติด ${t}`, num(school.recordsByType[t]), '']),
      ['รายการแก้ไขสำเร็จ', num(school.status.done), school.records ? `${((school.status.done / school.records) * 100).toFixed(2)}% ของรายการ` : ''],
      ['รายการค้างแก้ไข', num(school.records - school.status.done), ''],
      ['รายการเกินกำหนด', num(school.overdue), ''],
    ];
    const lv: Val[][] = [...levels, school].map((g) => [g.label, num(g.enrolled), num(g.students), fmtPct(g.pct), ...GRADE_RESULTS.map((t) => num(g.studentsByType[t])), num(g.records), num(g.status.done)]);
    return doc('รายงานภาพรวมนักเรียนที่มีผลการเรียน 0 ร มส', 'portrait', [
      heading('สรุปทั้งโรงเรียน'),
      table(e, [{ header: 'รายการ', width: 300 }, { header: 'จำนวน', width: 100, align: 'right' }, { header: 'ร้อยละ', width: PORTRAIT_W - 400, align: 'right' }], kv),
      heading('สรุปรายระดับชั้น'),
      table(
        e,
        [
          { header: 'ระดับชั้น', width: 75 },
          { header: 'นักเรียนทั้งหมด', width: 55, align: 'right' },
          { header: 'ติด (คน)', width: 50, align: 'right' },
          { header: 'ร้อยละ', width: 60, align: 'right' },
          ...GRADE_RESULTS.map((t): Col => ({ header: `ติด ${t} (คน)`, width: 50, align: 'right' })),
          { header: 'รายการ', width: 60, align: 'right' },
          { header: 'สำเร็จ', width: PORTRAIT_W - 75 - 55 - 50 - 60 - 150 - 60, align: 'right' },
        ],
        lv,
        { boldLast: true },
      ),
      NOTES,
    ]);
  });

/** รายระดับชั้น (แนวนอน) */
export const exportLevelsPdf = (levels: GroupStats[], school: GroupStats) =>
  render('levels', (e) => doc('รายงานนักเรียนที่มีผลการเรียน 0 ร มส รายระดับชั้น', 'landscape', [groupTable(e, levels, 'ระดับชั้น', school), NOTES]));

/** รายห้องเรียน: เปรียบเทียบห้องในระดับ + รายชื่อนักเรียนของห้องที่เลือก (แนวนอน) */
export const exportRoomPdf = (room: GroupStats, levelRooms: GroupStats[]) =>
  render('classroom', (e) =>
    doc(`รายงานห้องเรียน ${room.label}`, 'landscape', [
      heading(`เปรียบเทียบห้องเรียนในระดับเดียวกัน`),
      groupTable(e, levelRooms, 'ห้อง'),
      heading(`รายชื่อนักเรียนที่มีผลการเรียน 0 ร มส ห้อง ${room.label}`),
      para(rowSummary(room.rows)),
      studentTable(e, room.rows, { teacher: true, classroom: false }),
      NOTES,
    ]),
  );

/** รายครู 1 คน ตามตัวกรองที่เลือก (แนวนอน) */
export const exportTeacherPdf = (teacher: string, subjects: string[], rows: Row[], filterText: string) =>
  render('teacher', (e) =>
    doc(`รายงานนักเรียนที่มีผลการเรียน 0 ร มส · ${teacher}`, 'landscape', [
      { text: [{ text: 'ครูผู้สอน: ', bold: true }, teacher], fontSize: 11, margin: [0, 0, 0, 2] },
      para(`รายวิชาที่รับผิดชอบ (${subjects.length}): ${subjects.join(', ')}`),
      ...(filterText ? [para(`ตัวกรอง: ${filterText}`, { color: '#1d4ed8' })] : []),
      para(rowSummary(rows)),
      studentTable(e, rows, { teacher: false }),
    ]),
  );

/** สรุปครูผู้สอนทุกคน (แนวนอน) */
export const exportTeachersPdf = (teachers: TeacherStats[]) =>
  render('teachers', (e) => {
    const cols: Col[] = [
      { header: 'ครูผู้สอน', width: 110 },
      { header: 'รายวิชาที่รับผิดชอบ', width: 0 },
      { header: 'จำนวนวิชา', width: 40, align: 'right' },
      { header: 'นักเรียนที่ติด (คน)', width: 48, align: 'right' },
      { header: 'รายการ', width: 42, align: 'right' },
      ...GRADE_RESULTS.map((t): Col => ({ header: t, width: 32, align: 'right' })),
      { header: 'ค้างแก้ไข', width: 44, align: 'right' },
      { header: 'สำเร็จ', width: 40, align: 'right' },
      { header: 'ความคืบหน้า', width: 54, align: 'right' },
    ];
    cols[1].width = LANDSCAPE_W - cols.reduce((a, c) => a + c.width, 0);
    const rows: Val[][] = teachers.map((t) => [
      t.label,
      t.subjects.join(', '),
      t.subjects.length,
      num(t.students),
      num(t.records),
      ...GRADE_RESULTS.map((g) => num(t.recordsByType[g])),
      num(t.records - t.status.done),
      num(t.status.done),
      fmtPct(t.records ? (t.status.done / t.records) * 100 : null),
    ]);
    return doc('สรุปนักเรียนที่มีผลการเรียน 0 ร มส รายครูผู้สอน', 'landscape', [
      para(`ครูผู้สอน ${teachers.length} คน · ตัวเลข 0 / ร / มส เป็นจำนวนรายการรายวิชา · ความคืบหน้า = รายการแก้ไขสำเร็จ / รายการทั้งหมด`),
      table(e, cols, rows),
    ]);
  });

/** รายชื่อนักเรียนที่ติด 0 ร มส ตามตัวกรองหน้าติดตาม (แนวนอน) */
export const exportStudentListPdf = (rows: Row[], filterText: string) =>
  render('students', (e) =>
    doc('รายชื่อนักเรียนที่มีผลการเรียน 0 ร มส', 'landscape', [
      ...(filterText ? [para(`ตัวกรอง: ${filterText}`, { color: '#1d4ed8' })] : []),
      para(rowSummary(rows)),
      studentTable(e, rows, { teacher: true }),
    ]),
  );
