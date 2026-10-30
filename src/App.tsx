import { useEffect, useMemo, useState } from 'react';
import { Alert } from './components/ui';
import type { Backup as BackupData } from './lib/excel';
import type { ColumnMapping } from './lib/importMapping';
import { sampleEnrollment, sampleRecords, sampleTracking } from './lib/sampleData';
import { buildRows } from './lib/selectors';
import * as store from './lib/storage';
import { emptyFilters, emptyTracking, type EnrollmentMap, type Filters, type GradeRecord, type Tracking, type TrackingMap } from './lib/types';
import Backup from './pages/Backup';
import Classrooms from './pages/Classrooms';
import Dashboard from './pages/Dashboard';
import Enrollment from './pages/Enrollment';
import Import, { type ImportMode } from './pages/Import';
import Teachers from './pages/Teachers';
import TrackingPage from './pages/Tracking';

type Page = 'dashboard' | 'classrooms' | 'tracking' | 'teachers' | 'enrollment' | 'import' | 'backup';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'สถิติ/ภาพรวม', icon: '📊' },
  { id: 'classrooms', label: 'ห้องเรียน', icon: '🏫' },
  { id: 'tracking', label: 'ติดตาม/รายงาน', icon: '📋' },
  { id: 'teachers', label: 'ครูผู้สอน', icon: '👩‍🏫' },
  { id: 'enrollment', label: 'จำนวนนักเรียน', icon: '👥' },
  { id: 'import', label: 'นำเข้า Excel', icon: '📥' },
  { id: 'backup', label: 'สำรองข้อมูล', icon: '💾' },
];

/** จำนวนนักเรียนตัวอย่างห้ามใช้กับข้อมูลจริง (จะกลายเป็นตัวหารปลอม) */
const withoutSampleEnrollment = (e: EnrollmentMap): EnrollmentMap => Object.fromEntries(Object.entries(e).filter(([, v]) => v.source !== 'sample'));

function initialState() {
  const stored = store.loadRecords();
  const meta = store.loadMeta();
  if (stored) {
    // ผู้ใช้เวอร์ชันก่อนที่ยังใช้ข้อมูลตัวอย่าง: เติมจำนวนนักเรียนตัวอย่างให้
    const saved = store.loadEnrollment();
    const enrollment = meta?.source === 'sample' ? saved ?? sampleEnrollment() : withoutSampleEnrollment(saved ?? {});
    return { records: stored, tracking: store.loadTracking(), meta, enrollment };
  }
  // ครั้งแรก: แสดงข้อมูลตัวอย่าง
  const records = sampleRecords();
  return {
    records,
    tracking: { ...sampleTracking(records), ...store.loadTracking() },
    meta: { source: 'sample' } as store.Meta,
    enrollment: store.loadEnrollment() ?? sampleEnrollment(),
  };
}

export default function App() {
  const [init] = useState(initialState);
  const [records, setRecords] = useState<GradeRecord[]>(init.records);
  const [tracking, setTracking] = useState<TrackingMap>(init.tracking);
  const [meta, setMeta] = useState<store.Meta | null>(init.meta);
  const [enrollment, setEnrollment] = useState<EnrollmentMap>(init.enrollment);
  const [mapping, setMapping] = useState<ColumnMapping | undefined>(store.loadMapping);
  const [page, setPage] = useState<Page>('dashboard');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [classroom, setClassroom] = useState('');
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const ok = store.saveRecords(records) && store.saveTracking(tracking) && store.saveEnrollment(enrollment);
    setSaveError(!ok);
  }, [records, tracking, enrollment]);
  useEffect(() => void (meta && store.saveMeta(meta)), [meta]);
  useEffect(() => void (mapping && store.saveMapping(mapping)), [mapping]);

  const rows = useMemo(() => buildRows(records, tracking), [records, tracking]);

  const updateTracking = (key: string, patch: Partial<Tracking>) =>
    setTracking((t) => ({ ...t, [key]: { ...(t[key] ?? emptyTracking()), ...patch, updatedAt: new Date().toISOString() } }));

  const go = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  const goTracking = (f: Partial<Filters>) => {
    setFilters({ ...emptyFilters(), ...f });
    go('tracking');
  };

  function handleImport(newRecords: GradeRecord[], mode: ImportMode, fileName: string, m: ColumnMapping) {
    // ไม่แตะ tracking — สถานะเดิมจะผูกกลับอัตโนมัติด้วย key ของนักเรียน+วิชา
    setRecords((old) => {
      if (mode === 'replace') return newRecords;
      const map = new Map(old.map((r) => [r.key, r]));
      newRecords.forEach((r) => map.set(r.key, r));
      return [...map.values()];
    });
    setEnrollment(withoutSampleEnrollment);
    setMapping(m);
    setMeta({ source: 'import', fileName, importedAt: new Date().toISOString() });
    setFilters(emptyFilters());
  }

  function handleRestore(b: BackupData) {
    setRecords(b.records);
    setTracking(b.tracking);
    if (b.enrollment) setEnrollment(b.enrollment);
    if (b.mapping) setMapping(b.mapping);
    setMeta({ source: 'backup', importedAt: new Date().toISOString() });
    setFilters(emptyFilters());
  }

  function loadSample() {
    const s = sampleRecords();
    setRecords(s);
    setTracking((t) => ({ ...sampleTracking(s), ...t }));
    setEnrollment(sampleEnrollment());
    setMeta({ source: 'sample' });
    setFilters(emptyFilters());
  }

  function pruneOrphans() {
    const keys = new Set(records.map((r) => r.key));
    setTracking((t) => Object.fromEntries(Object.entries(t).filter(([k]) => keys.has(k))));
  }

  function clearAll() {
    setRecords([]);
    setTracking({});
    setEnrollment({});
    setMeta({ source: 'empty' });
    setFilters(emptyFilters());
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (คอมพิวเตอร์) */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <Brand />
          <nav className="mt-6 space-y-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${page === n.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto text-xs text-slate-400">ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น</div>
        </div>
      </aside>

      {/* Top bar (โทรศัพท์/แท็บเล็ต) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="px-4 pt-3"><Brand /></div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${page === n.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          {meta?.source === 'sample' && page !== 'import' && (
            <Alert tone="amber">
              กำลังแสดง <b>ข้อมูลตัวอย่าง (สมมติ)</b> — ไปที่{' '}
              <button className="font-semibold underline" onClick={() => go('import')}>นำเข้า Excel</button> เพื่อใช้ข้อมูลจริง
            </Alert>
          )}
          {saveError && <Alert tone="red">บันทึกลงเบราว์เซอร์ไม่สำเร็จ (พื้นที่อาจเต็มหรือถูกปิดกั้น) — กรุณาส่งออกไฟล์สำรองข้อมูล</Alert>}

          {page === 'dashboard' && <Dashboard rows={rows} enrollment={enrollment} goTracking={goTracking} goEnrollment={() => go('enrollment')} />}
          {page === 'classrooms' && <Classrooms rows={rows} classroom={classroom} setClassroom={setClassroom} onUpdate={updateTracking} />}
          {page === 'tracking' && <TrackingPage rows={rows} filters={filters} setFilters={setFilters} onUpdate={updateTracking} />}
          {page === 'teachers' && <Teachers rows={rows} goTracking={goTracking} />}
          {page === 'enrollment' && <Enrollment rows={rows} enrollment={enrollment} setEnrollment={setEnrollment} />}
          {page === 'import' && <Import existingCount={records.length} isSample={meta?.source === 'sample'} tracking={tracking} enrollment={enrollment} savedMapping={mapping} onImport={handleImport} />}
          {page === 'backup' && (
            <Backup records={records} tracking={tracking} mapping={mapping} enrollment={enrollment} meta={meta} onRestore={handleRestore} onLoadSample={loadSample} onPruneOrphans={pruneOrphans} onClearAll={clearAll} />
          )}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">G</div>
      <div>
        <div className="font-bold leading-tight text-slate-900">GradeTrack</div>
        <div className="text-[11px] leading-tight text-slate-500">ติดตามนักเรียนติด 0 ร มส</div>
      </div>
    </div>
  );
}
