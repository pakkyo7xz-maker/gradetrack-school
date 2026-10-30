import { useMemo } from 'react';
import FilterBar from '../components/FilterBar';
import TrackingTable, { type UpdateTracking } from '../components/TrackingTable';
import { PageHeader } from '../components/ui';
import { exportRowsToExcel } from '../lib/excel';
import { applyFilters, classroomsOf, computeStats, teachersOf } from '../lib/selectors';
import type { Filters, Row } from '../lib/types';

export default function Tracking({ rows, filters, setFilters, onUpdate }: { rows: Row[]; filters: Filters; setFilters: (f: Filters) => void; onUpdate: UpdateTracking }) {
  const classrooms = useMemo(() => classroomsOf(rows), [rows]);
  const teachers = useMemo(() => teachersOf(rows), [rows]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const s = computeStats(filtered);

  return (
    <div>
      <PageHeader
        title="ติดตามและรายงาน"
        subtitle="แก้ไขสถานะ วันกำหนด และหมายเหตุได้ทันที (บันทึกอัตโนมัติในเบราว์เซอร์)"
        actions={
          <button className="btn-primary" disabled={filtered.length === 0} onClick={() => exportRowsToExcel(filtered)}>
            ⬇ ส่งออก Excel ({filtered.length})
          </button>
        }
      />
      <div className="card overflow-hidden">
        <FilterBar filters={filters} onChange={setFilters} classrooms={classrooms} teachers={teachers} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-y border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
          <span>นักเรียน <b className="text-slate-900">{s.students}</b> คน</span>
          <span><b className="text-slate-900">{s.total}</b> รายการ</span>
          <span>0: <b className="text-red-600">{s.zero}</b></span>
          <span>ร: <b className="text-amber-600">{s.r}</b></span>
          <span>มส: <b className="text-violet-600">{s.ms}</b></span>
          <span>สำเร็จ <b className="text-emerald-600">{s.done}</b></span>
          <span>เกินกำหนด <b className="text-red-600">{s.overdue}</b></span>
        </div>
        <TrackingTable rows={filtered} onUpdate={onUpdate} />
      </div>
    </div>
  );
}
