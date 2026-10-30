import { GRADE_RESULTS, STATUSES, type Filters } from '../lib/types';

export default function FilterBar({ filters, onChange, classrooms, teachers }: { filters: Filters; onChange: (f: Filters) => void; classrooms: string[]; teachers: string[] }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <div className="col-span-2 sm:col-span-3 lg:col-span-2">
        <label className="label">ค้นหาชื่อ / รหัสนักเรียน</label>
        <input className="input" value={filters.search} onChange={(e) => set('search', e.target.value)} placeholder="พิมพ์ชื่อนักเรียน…" />
      </div>
      <div>
        <label className="label">ห้องเรียน</label>
        <select className="input" value={filters.classroom} onChange={(e) => set('classroom', e.target.value)}>
          <option value="">ทุกห้อง</option>
          {classrooms.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="label">ครูผู้สอน</label>
        <select className="input" value={filters.teacher} onChange={(e) => set('teacher', e.target.value)}>
          <option value="">ทุกคน</option>
          {teachers.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="label">ผลการเรียน</label>
        <select className="input" value={filters.result} onChange={(e) => set('result', e.target.value as Filters['result'])}>
          <option value="">ทั้งหมด</option>
          {GRADE_RESULTS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="label">สถานะ</label>
        <select className="input" value={filters.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
          <option value="">ทุกสถานะ</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          <option value="overdue">เกินกำหนด</option>
        </select>
      </div>
      {active && (
        <div className="col-span-2 sm:col-span-3 lg:col-span-6">
          <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => onChange({ classroom: '', teacher: '', result: '', status: '', search: '' })}>
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      )}
    </div>
  );
}
