import { useEffect, useState } from 'react';
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

function NoteInput({ row, onUpdate }: { row: Row; onUpdate: UpdateTracking }) {
  return (
    <input
      // key ทำให้ค่าเริ่มต้นอัปเดตเมื่อข้อมูลเปลี่ยนจากภายนอก (เช่น นำเข้าไฟล์สำรอง)
      key={row.tracking.note}
      defaultValue={row.tracking.note}
      placeholder="เพิ่มหมายเหตุ…"
      onBlur={(e) => e.target.value !== row.tracking.note && onUpdate(row.key, { note: e.target.value })}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="input min-w-[12rem] px-2 py-1.5 text-xs"
    />
  );
}

const PAGE = 200;

export default function TrackingTable({ rows: allRows, onUpdate, hideClassroom }: { rows: Row[]; onUpdate: UpdateTracking; hideClassroom?: boolean }) {
  // แสดงทีละ 200 รายการ เพื่อให้หน้าเร็วเมื่อข้อมูลมาก (ตัวกรอง/ส่งออกยังใช้ทุกรายการ)
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [allRows.length]);
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
              <th className="th">ครูผู้สอน</th>
              <th className="th text-center">ผล</th>
              <th className="th">สถานะ</th>
              <th className="th">กำหนดแก้ไข</th>
              <th className="th">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key} className={r.overdue ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
                <td className="td whitespace-nowrap text-xs text-slate-500">{r.studentId || '-'}</td>
                <td className="td whitespace-nowrap font-medium text-slate-900">{r.studentName}</td>
                {!hideClassroom && <td className="td whitespace-nowrap">{r.classroom}{r.studentNo && <div className="text-xs text-slate-400">เลขที่ {r.studentNo}</div>}</td>}
                <td className="td">
                  <div className="min-w-[9rem]">{r.subjectName}</div>
                  {r.subjectCode && r.subjectCode !== r.subjectName && <div className="text-xs text-slate-400">{r.subjectCode}</div>}
                </td>
                <td className="td whitespace-nowrap">{r.teacher || <span className="text-slate-400">ไม่ระบุ</span>}</td>
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
                <div className="font-medium text-slate-900">{r.studentName}</div>
                <div className="text-xs text-slate-500">
                  {r.classroom}
                  {r.studentId && ` · ${r.studentId}`}
                </div>
              </div>
              <ResultBadge result={r.result} />
            </div>
            <div className="text-sm">
              {r.subjectCode && <span className="text-slate-400">{r.subjectCode} </span>}
              {r.subjectName}
              <div className="text-xs text-slate-500">ครู: {r.teacher || 'ไม่ระบุ'}</div>
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
