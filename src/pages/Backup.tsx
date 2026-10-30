import { useState } from 'react';
import { loadReportSettings, saveReportSettings, type ReportSettings } from '../lib/reportSettings';
import { Alert, ConfirmDialog, PageHeader } from '../components/ui';
import { exportBackup, readBackup, type Backup as BackupData } from '../lib/excel';
import type { ColumnMapping } from '../lib/importMapping';
import type { Meta } from '../lib/storage';
import type { EnrollmentMap, GradeRecord, TrackingMap } from '../lib/types';

interface Props {
  records: GradeRecord[];
  tracking: TrackingMap;
  mapping?: ColumnMapping;
  enrollment: EnrollmentMap;
  meta: Meta | null;
  onRestore: (b: BackupData) => void;
  onLoadSample: () => void;
  onPruneOrphans: () => void;
  onClearAll: () => void;
}

type Pending = { kind: 'restore'; data: BackupData; fileName: string } | { kind: 'sample' } | { kind: 'prune' } | { kind: 'clear' } | null;

export default function Backup({ records, tracking, mapping, enrollment, meta, onRestore, onLoadSample, onPruneOrphans, onClearAll }: Props) {
  const [pending, setPending] = useState<Pending>(null);
  const [msg, setMsg] = useState<{ tone: 'emerald' | 'red'; text: string } | null>(null);
  const keys = new Set(records.map((r) => r.key));
  const orphans = Object.keys(tracking).filter((k) => !keys.has(k)).length;

  async function onFile(file?: File) {
    if (!file) return;
    setMsg(null);
    try {
      const data = await readBackup(file);
      setPending({ kind: 'restore', data, fileName: file.name });
    } catch (e) {
      setMsg({ tone: 'red', text: e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ' });
    }
  }

  function confirm() {
    if (!pending) return;
    if (pending.kind === 'restore') {
      onRestore(pending.data);
      setMsg({ tone: 'emerald', text: `กู้คืนข้อมูลสำเร็จ ${pending.data.records.length} รายการ` });
    } else if (pending.kind === 'sample') onLoadSample();
    else if (pending.kind === 'prune') onPruneOrphans();
    else onClearAll();
    if (pending.kind !== 'restore') setMsg({ tone: 'emerald', text: 'ดำเนินการเรียบร้อย' });
    setPending(null);
  }

  return (
    <div>
      <PageHeader title="สำรองข้อมูล" subtitle="ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ควรส่งออกไฟล์สำรองเป็นประจำ" />
      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <div className="card p-5 text-sm">
          <div className="font-semibold">ข้อมูลปัจจุบัน</div>
          <div className="mt-1 text-slate-600">
            {records.length} รายการ · สถานะที่บันทึกไว้ {Object.keys(tracking).length} รายการ · จำนวนนักเรียน {Object.keys(enrollment).length} ห้อง ·{' '}
            แหล่งที่มา: {meta?.source === 'import' ? `ไฟล์ ${meta.fileName ?? ''}` : meta?.source === 'backup' ? 'ไฟล์สำรอง' : meta?.source === 'empty' ? 'ไม่มีข้อมูล' : 'ข้อมูลตัวอย่าง'}
            {meta?.importedAt && ` (${new Date(meta.importedAt).toLocaleString('th-TH')})`}
          </div>
        </div>

        <ReportHeaderSettings />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <div className="font-semibold">ส่งออกไฟล์สำรอง</div>
            <p className="mt-1 text-sm text-slate-500">บันทึกรายการทั้งหมด พร้อมสถานะ วันกำหนด หมายเหตุ จำนวนนักเรียนต่อห้อง และการจับคู่คอลัมน์ เป็นไฟล์ .json</p>
            <button className="btn-primary mt-4" onClick={() => exportBackup(records, tracking, mapping, enrollment)}>⬇ ดาวน์โหลดไฟล์สำรอง</button>
          </div>
          <div className="card p-5">
            <div className="font-semibold">นำเข้าไฟล์สำรอง</div>
            <p className="mt-1 text-sm text-slate-500">กู้คืนข้อมูลจากไฟล์ .json ที่ส่งออกจาก GradeTrack (จะแทนที่ข้อมูลปัจจุบันหลังยืนยัน)</p>
            <label className="btn-ghost mt-4 cursor-pointer">
              ⬆ เลือกไฟล์สำรอง
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </div>

        <div className="card divide-y divide-slate-100">
          <Action title="ล้างสถานะที่ไม่มีรายการคู่" desc={`สถานะการติดตามที่ไม่ตรงกับรายการปัจจุบัน ${orphans} รายการ (เช่น จากข้อมูลตัวอย่างหรือไฟล์เก่า)`} btn="ล้าง" disabled={orphans === 0} onClick={() => setPending({ kind: 'prune' })} />
          <Action title="โหลดข้อมูลตัวอย่าง" desc="แทนที่รายการและจำนวนนักเรียนด้วยข้อมูลจำลองสำหรับทดลองใช้งาน" btn="โหลด" onClick={() => setPending({ kind: 'sample' })} />
          <Action title="ลบข้อมูลทั้งหมด" desc="ลบรายการ สถานะ จำนวนนักเรียน และการตั้งค่าทั้งหมดออกจากเบราว์เซอร์นี้" btn="ลบทั้งหมด" danger onClick={() => setPending({ kind: 'clear' })} />
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === 'restore' ? 'ยืนยันการกู้คืนข้อมูล' : pending?.kind === 'sample' ? 'โหลดข้อมูลตัวอย่าง' : pending?.kind === 'prune' ? 'ล้างสถานะที่ไม่มีรายการคู่' : 'ลบข้อมูลทั้งหมด'}
        danger={pending?.kind === 'clear' || pending?.kind === 'restore'}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        {pending?.kind === 'restore' && (
          <>
            <p>ไฟล์ <b>{pending.fileName}</b> มี {pending.data.records.length} รายการ, สถานะ {Object.keys(pending.data.tracking).length} รายการ{pending.data.enrollment && `, จำนวนนักเรียน ${Object.keys(pending.data.enrollment).length} ห้อง`}</p>
            {pending.data.exportedAt && <p>ส่งออกเมื่อ {new Date(pending.data.exportedAt).toLocaleString('th-TH')}</p>}
            <p className="text-red-600">ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</p>
          </>
        )}
        {pending?.kind === 'sample' && <p>รายการและจำนวนนักเรียนปัจจุบันจะถูกแทนที่ด้วยข้อมูลตัวอย่าง (สถานะการติดตามเดิมยังเก็บไว้)</p>}
        {pending?.kind === 'prune' && <p>ลบสถานะ {orphans} รายการที่ไม่ตรงกับรายการปัจจุบัน</p>}
        {pending?.kind === 'clear' && <p className="text-red-600">ข้อมูลทั้งหมดจะถูกลบและกู้คืนไม่ได้ กรุณาส่งออกไฟล์สำรองก่อน</p>}
      </ConfirmDialog>
    </div>
  );
}

function Action({ title, desc, btn, danger, disabled, onClick }: { title: string; desc: string; btn: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <button className={danger ? 'btn-danger' : 'btn-ghost'} disabled={disabled} onClick={onClick}>{btn}</button>
    </div>
  );
}

function ReportHeaderSettings() {
  const [s, setS] = useState<ReportSettings>(loadReportSettings);
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<ReportSettings>) => {
    setS({ ...s, ...patch });
    setSaved(false);
  };
  return (
    <div className="card p-5">
      <div className="font-semibold">หัวรายงาน PDF</div>
      <p className="mt-1 text-sm text-slate-500">แสดงที่หัวกระดาษทุกหน้าของรายงาน PDF</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rp-school">ชื่อโรงเรียน</label>
          <input id="rp-school" className="input" value={s.schoolName} onChange={(e) => update({ schoolName: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="rp-term">ภาคเรียน / ปีการศึกษา</label>
          <input id="rp-term" className="input" value={s.termLabel} onChange={(e) => update({ termLabel: e.target.value })} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-ghost" onClick={() => setSaved(saveReportSettings(s))}>บันทึกหัวรายงาน</button>
        {saved && <span className="text-sm text-emerald-700">บันทึกแล้ว</span>}
      </div>
    </div>
  );
}
