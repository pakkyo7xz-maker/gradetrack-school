import { computeStats } from '../lib/selectors';
import type { Filters, Row } from '../lib/types';
import { Empty, OverdueBadge, PageHeader, ResultBadge, StatCard } from '../components/ui';
import { compareClassroom, formatThaiDate } from '../lib/normalize';

export default function Dashboard({ rows, goTracking }: { rows: Row[]; goTracking: (f: Partial<Filters>) => void }) {
  const s = computeStats(rows);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;

  const byRoom = Object.entries(
    rows.reduce<Record<string, { total: number; done: number }>>((acc, r) => {
      const o = (acc[r.classroom] ??= { total: 0, done: 0 });
      o.total++;
      if (r.tracking.status === 'done') o.done++;
      return acc;
    }, {}),
  ).sort(([a], [b]) => compareClassroom(a, b));

  const overdue = rows.filter((r) => r.overdue).sort((a, b) => a.tracking.dueDate.localeCompare(b.tracking.dueDate));

  return (
    <div>
      <PageHeader title="ภาพรวม" subtitle="สรุปนักเรียนที่มีผลการเรียน 0 ร มส และความคืบหน้าการแก้ไข" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="นักเรียนที่ติดผลการเรียน" value={s.students} hint={`คน (ไม่นับซ้ำ) · ${s.total} รายการ`} tone="blue" onClick={() => goTracking({})} />
        <StatCard label="รายการติด 0" value={s.zero} tone="red" onClick={() => goTracking({ result: '0' })} />
        <StatCard label="รายการติด ร" value={s.r} tone="amber" onClick={() => goTracking({ result: 'ร' })} />
        <StatCard label="รายการติด มส" value={s.ms} tone="violet" onClick={() => goTracking({ result: 'มส' })} />
        <StatCard label="แก้ไขสำเร็จ" value={s.done} hint={`${pct}% ของทั้งหมด`} tone="emerald" onClick={() => goTracking({ status: 'done' })} />
        <StatCard label="ยังไม่ดำเนินการ" value={s.pending} onClick={() => goTracking({ status: 'pending' })} />
        <StatCard label="กำลังแก้ไข / รอตรวจสอบ" value={s.inProgress} tone="blue" />
        <StatCard label="เกินกำหนด" value={s.overdue} hint="ยังไม่สำเร็จและเลยวันกำหนด" tone="red" onClick={() => goTracking({ status: 'overdue' })} />
      </div>

      <div className="mt-4 card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">ความคืบหน้าการแก้ไข</span>
          <span className="tabular-nums text-slate-500">{s.done}/{s.total} รายการ</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">แยกตามห้องเรียน</div>
          {byRoom.length === 0 ? (
            <Empty>ยังไม่มีข้อมูล</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {byRoom.map(([room, v]) => (
                <li key={room}>
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => goTracking({ classroom: room })}>
                    <span className="w-14 font-medium">{room}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${(v.done / v.total) * 100}%` }} />
                    </div>
                    <span className="w-20 text-right tabular-nums text-xs text-slate-500">{v.done}/{v.total} สำเร็จ</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">รายการเกินกำหนด</div>
          {overdue.length === 0 ? (
            <Empty>ไม่มีรายการเกินกำหนด 🎉</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdue.slice(0, 8).map((r) => (
                <li key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <ResultBadge result={r.result} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.studentName} <span className="text-xs font-normal text-slate-400">{r.classroom}</span></div>
                    <div className="truncate text-xs text-slate-500">{r.subjectName} · {r.teacher || 'ไม่ระบุครู'}</div>
                  </div>
                  <div className="text-right">
                    <OverdueBadge />
                    <div className="mt-0.5 text-[11px] text-slate-400">{formatThaiDate(r.tracking.dueDate)}</div>
                  </div>
                </li>
              ))}
              {overdue.length > 8 && (
                <li><button className="w-full px-4 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50" onClick={() => goTracking({ status: 'overdue' })}>ดูทั้งหมด {overdue.length} รายการ →</button></li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
