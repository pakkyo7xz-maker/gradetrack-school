import { useEffect, useRef, useState } from 'react';
import { formatThaiDate } from '../lib/normalize';
import { STATUSES, type Row, type Tracking, type TrackingStatus } from '../lib/types';
import { Empty, OverdueBadge, ResultBadge, STATUS_STYLE } from './ui';

export type UpdateTracking = (key: string, patch: Partial<Tracking>) => void;

export function StatusSelect({ row, onUpdate }: { row: Row; onUpdate: UpdateTracking }) {
  return (
    <select
      value={row.tracking.status}
      onChange={(e) => onUpdate(row.key, { status: e.target.value as TrackingStatus })}
      className={`w-full min-w-[8.5rem] cursor-pointer rounded-lg border-0 px-2 py-1.5 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-blue-400 ${STATUS_STYLE[row.tracking.status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  );
}

function DueInput({ row, onUpdate }: { row: Row; onUpdate: UpdateTracking }) {
  return (
    <div className="space-y-1">
      <input
        type="date"
        value={row.tracking.dueDate}
        onChange={(e) => onUpdate(row.key, { dueDate: e.target.value })}
        className={`input min-w-[9rem] px-2 py-1.5 text-xs ${row.overdue ? 'border-red-300 text-red-700' : ''}`}
        title={formatThaiDate(row.tracking.dueDate)}
      />
      {row.overdue && <OverdueBadge />}
    </div>
  );
}

// หมายเหตุที่พิมพ์ค้างอยู่ (ยังไม่ครบเวลาหน่วง) — บันทึกทั้งหมดก่อนปิด/รีเฟรชหน้า
const pendingNotes = new Set<() => void>();
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => pendingNotes.forEach((f) => f()));

/** หมายเหตุ: บันทึกอัตโนมัติขณะพิมพ์ (หน่วง 0.5 วินาที) และทันทีเมื่อออกจากช่อง ปิดหน้าต่าง หรือรีเฟรช */
function NoteInput({ row, onUpdate }: { row: Row; onUpdate: UpdateTracking }) {
  const [value, setValue] = useState(row.tracking.note);
  const pending = useRef<string | null>(null);
  const timer = useRef(0);
  const latest = useRef({ row, onUpdate });
  latest.current = { row, onUpdate };
  const flush = useRef(() => {
    window.clearTimeout(timer.current);
    const v = pending.current;
    pending.current = null;
    pendingNotes.delete(flush.current);
    const { row: r, onUpdate: update } = latest.current;
    if (v !== null && v !== r.tracking.note) update(r.key, { note: v });
  });

  // รับค่าที่เปลี่ยนจากภายนอก (เช่น กู้คืนไฟล์สำรอง) เมื่อไม่ได้พิมพ์ค้างอยู่
  useEffect(() => {
    if (pending.current === null) setValue(row.tracking.note);
  }, [row.tracking.note]);
  useEffect(() => {
    const f = flush.current;
    return () => f();
  }, []);

  return (
    <input
      value={value}
      placeholder="เพิ่มหมายเหตุ…"
      onChange={(e) => {
        setValue(e.target.value);
        pending.current = e.target.value;
        pendingNotes.add(flush.current);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush.current, 500);
      }}
      onBlur={() => flush.current()}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="input min-w-[12rem] px-2 py-1.5 text-xs"
    />
  );
}

const PAGE = 200;

interface TableProps {
  rows: Row[];
  onUpdate: UpdateTracking;
  hideClassroom?: boolean;
  hideTeacher?: boolean;
  /** คลิกชื่อนักเรียนเพื่อดูรายละเอียด (ถ้ามี) */
  onStudentClick?: (r: Row) => void;
}

function StudentName({ r, onClick }: { r: Row; onClick?: (r: Row) => void }) {
  if (!onClick) return <>{r.studentName}</>;
  return (
    <button className="text-left font-medium text-blue-700 hover:underline" onClick={() => onClick(r)}>
      {r.studentName}
    </button>
  );
}

export default function TrackingTable({ rows: allRows, onUpdate, hideClassroom, hideTeacher, onStudentClick }: TableProps) {
  // แสดงทีละ 200 รายการ เพื่อให้หน้าเร็วเมื่อข้อมูลมาก (ตัวกรอง/ส่งออกยังใช้ทุกรายการ)
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => {
    setLimit(PAGE);
  }, [allRows.length]);
  const rows = allRows.slice(0, limit);
  if (allRows.length === 0) return <Empty>ไม่พบรายการที่ตรงกับเงื่อนไข</Empty>;
  return (
    <>
      {/* คอมพิวเตอร์: ตาราง */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="th">รหัส</th>
              <th className="th">ชื่อ-นามสกุล</th>
              {!hideClassroom && <th className="th">ชั้น/ห้อง</th>}
              <th className="th">รายวิชา</th>
              {!hideTeacher && <th className="th">ครูผู้สอน</th>}
              <th className="th text-center">ผล</th>
              <th className="th">สถานะ</th>
              <th className="th">วันที่ติดตาม/กำหนด</th>
              <th className="th">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key} className={r.overdue ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
                <td className="td whitespace-nowrap text-xs text-slate-500">{r.studentId || '-'}</td>
                <td className="td whitespace-nowrap font-medium text-slate-900"><StudentName r={r} onClick={onStudentClick} /></td>
                {!hideClassroom && <td className="td whitespace-nowrap">{r.classroom}{r.studentNo && <div className="text-xs text-slate-400">เลขที่ {r.studentNo}</div>}</td>}
                <td className="td">
                  <div className="min-w-[9rem]">{r.subjectName}</div>
                  {r.subjectCode && r.subjectCode !== r.subjectName && <div className="text-xs text-slate-400">{r.subjectCode}</div>}
                </td>
                {!hideTeacher && <td className="td whitespace-nowrap">{r.teacher || <span className="text-slate-400">ไม่ระบุ</span>}</td>}
                <td className="td text-center"><ResultBadge result={r.result} /></td>
                <td className="td"><StatusSelect row={r} onUpdate={onUpdate} /></td>
                <td className="td"><DueInput row={r} onUpdate={onUpdate} /></td>
                <td className="td"><NoteInput row={r} onUpdate={onUpdate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* โทรศัพท์: การ์ด */}
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => (
          <div key={r.key} className={`space-y-2.5 p-4 ${r.overdue ? 'bg-red-50/40' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900"><StudentName r={r} onClick={onStudentClick} /></div>
                <div className="text-xs text-slate-500">
                  {r.classroom}
                  {r.studentNo && ` · เลขที่ ${r.studentNo}`}
                  {r.studentId && ` · ${r.studentId}`}
                </div>
              </div>
              <ResultBadge result={r.result} />
            </div>
            <div className="text-sm">
              {r.subjectCode && <span className="text-slate-400">{r.subjectCode} </span>}
              {r.subjectName}
              {!hideTeacher && <div className="text-xs text-slate-500">ครู: {r.teacher || 'ไม่ระบุ'}</div>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatusSelect row={r} onUpdate={onUpdate} />
              <DueInput row={r} onUpdate={onUpdate} />
            </div>
            <NoteInput row={r} onUpdate={onUpdate} />
          </div>
        ))}
      </div>
      {allRows.length > limit && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button className="btn-ghost" onClick={() => setLimit(limit + PAGE)}>
            แสดงเพิ่ม ({limit.toLocaleString('th-TH')} จาก {allRows.length.toLocaleString('th-TH')} รายการ)
          </button>
        </div>
      )}
    </>
  );
}
