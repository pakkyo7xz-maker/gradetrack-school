import { useMemo, useState } from 'react';
import type { WorkBook } from 'xlsx';
import { Alert, ConfirmDialog, PageHeader, ResultBadge } from '../components/ui';
import { readWorkbook, rowsFromMatrix, sheetMatrix } from '../lib/excel';
import { FIELDS, autoDetectMapping, detectHeaderRow, missingFields, optionalWarnings, parseRows, type ColumnMapping, type FieldKey } from '../lib/importMapping';
import { cellText } from '../lib/normalize';
import type { EnrollmentMap, GradeRecord, TrackingMap } from '../lib/types';
import { validateRecords } from '../lib/validation';

export type ImportMode = 'replace' | 'merge';

interface Props {
  existingCount: number;
  isSample: boolean;
  tracking: TrackingMap;
  enrollment: EnrollmentMap;
  savedMapping?: ColumnMapping;
  onImport: (records: GradeRecord[], mode: ImportMode, fileName: string, mapping: ColumnMapping) => void;
}

export default function Import({ existingCount, isSample, tracking, enrollment, savedMapping, onImport }: Props) {
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<ImportMode>('replace');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState('');

  const matrix = useMemo(() => (wb && sheet ? sheetMatrix(wb, sheet) : []), [wb, sheet]);
  const { headers, rows } = useMemo(() => rowsFromMatrix(matrix, headerRow), [matrix, headerRow]);
  const parsed = useMemo(() => (rows.length ? parseRows(rows, mapping, headerRow) : null), [rows, mapping, headerRow]);
  const missing = missingFields(mapping);
  const warnings = optionalWarnings(mapping);
  const withTracking = parsed ? parsed.records.filter((r) => tracking[r.key]).length : 0;
  const issues = useMemo(() => (parsed && missing.length === 0 ? validateRecords(parsed.records, enrollment) : []), [parsed, missing.length, enrollment]);
  const hasErrors = issues.some((i) => i.level === 'error');
  const [ackErrors, setAckErrors] = useState(false);

  function selectSheet(name: string, book = wb) {
    if (!book) return;
    setSheet(name);
    const m = sheetMatrix(book, name);
    const hr = detectHeaderRow(m);
    setHeaderRow(hr);
    setMapping(autoDetectMapping(rowsFromMatrix(m, hr).headers, savedMapping));
  }

  function changeHeaderRow(hr: number) {
    setHeaderRow(hr);
    setMapping(autoDetectMapping(rowsFromMatrix(matrix, hr).headers, savedMapping));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setDone('');
    setAckErrors(false);
    setLoading(true);
    try {
      const book = await readWorkbook(file);
      if (!book.SheetNames.length) throw new Error('ไม่พบ Sheet ในไฟล์');
      setWb(book);
      setFileName(file.name);
      selectSheet(book.SheetNames[0], book);
    } catch (e) {
      setWb(null);
      setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  function doImport() {
    if (!parsed) return;
    onImport(parsed.records, mode, fileName, mapping);
    setConfirm(false);
    setDone(`นำเข้าสำเร็จ ${parsed.records.length} รายการ (${mode === 'replace' ? 'แทนที่ข้อมูลเดิม' : 'รวมกับข้อมูลเดิม'}) — สถานะการติดตามเดิมยังอยู่ครบ`);
    setWb(null);
    setSheet('');
  }

  const canImport = !!parsed && missing.length === 0 && parsed.records.length > 0 && (!hasErrors || ackErrors);

  return (
    <div>
      <PageHeader title="นำเข้า Excel" subtitle="รองรับ .xlsx / .xls / .csv (รวมไฟล์ที่แปลงจาก PDF) — จับคู่หัวคอลัมน์อัตโนมัติ ปรับเองได้ และตรวจสอบก่อนนำเข้า" />

      <div className="space-y-4">
        {done && <Alert tone="emerald">{done}</Alert>}
        {error && <Alert tone="red">{error}</Alert>}

        {/* 1. เลือกไฟล์ */}
        <div className="card p-5">
          <div className="mb-3 text-sm font-semibold">1. เลือกไฟล์</div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center hover:border-blue-300 hover:bg-blue-50/30">
            <span className="text-3xl">📄</span>
            <span className="mt-2 text-sm font-medium text-slate-700">{loading ? 'กำลังอ่านไฟล์…' : fileName && wb ? fileName : 'คลิกเพื่อเลือกไฟล์ Excel'}</span>
            <span className="text-xs text-slate-400">ไฟล์จะถูกอ่านในเบราว์เซอร์เท่านั้น ไม่มีการอัปโหลดออกนอกเครื่อง</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>

        {wb && (
          <>
            {/* 2. Sheet และหัวตาราง */}
            <div className="card grid gap-3 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2 text-sm font-semibold">2. เลือก Sheet และแถวหัวตาราง</div>
              <div>
                <label className="label">Sheet</label>
                <select className="input" value={sheet} onChange={(e) => selectSheet(e.target.value)}>
                  {wb.SheetNames.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="label">แถวหัวตาราง (ตรวจพบอัตโนมัติ)</label>
                <select className="input" value={headerRow} onChange={(e) => changeHeaderRow(Number(e.target.value))}>
                  {matrix.slice(0, 15).map((r, i) => (
                    <option key={i} value={i}>แถว {i + 1}: {r.map(cellText).filter(Boolean).slice(0, 4).join(' | ').slice(0, 60)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. ตัวอย่างข้อมูล */}
            <div className="card overflow-hidden">
              <div className="px-5 pt-5 text-sm font-semibold">3. ตัวอย่างข้อมูล (10 แถวแรก จาก {rows.length} แถว)</div>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>{headers.map((h) => <th key={h} className="th">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i}>{headers.map((h) => <td key={h} className="whitespace-nowrap px-3 py-1.5">{cellText(r[h])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. จับคู่คอลัมน์ */}
            <div className="card p-5">
              <div className="mb-3 text-sm font-semibold">4. จับคู่คอลัมน์</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <select
                      className={`input ${mapping[f.key] ? 'border-blue-300 bg-blue-50/40' : ''}`}
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [f.key as FieldKey]: e.target.value || undefined })}
                    >
                      <option value="">— ไม่ใช้ —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {missing.length > 0 && <Alert tone="red">ขาดคอลัมน์ที่จำเป็น: <b>{missing.join(', ')}</b></Alert>}
                {warnings.map((w) => <Alert key={w} tone="amber">{w}</Alert>)}
              </div>
            </div>

            {/* 5. ตรวจสอบและยืนยัน */}
            {parsed && missing.length === 0 && (
              <div className="card p-5">
                <div className="mb-3 text-sm font-semibold">5. ตรวจสอบผลและนำเข้า</div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Mini label="รายการที่จะนำเข้า" value={parsed.records.length} tone="text-blue-600" />
                  <Mini label="ข้ามแถว (ไม่ใช่ 0/ร/มส)" value={parsed.skippedNoResult} />
                  <Mini label="รายการซ้ำ (ข้าม)" value={parsed.duplicates.length} tone="text-amber-600" />
                  <Mini label="ข้อมูลไม่ครบ (ข้าม)" value={parsed.invalidRows.length} tone="text-red-600" />
                </div>

                {(parsed.duplicates.length > 0 || parsed.invalidRows.length > 0) && (
                  <details className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium">ดูรายละเอียดแถวที่ถูกข้าม</summary>
                    <ul className="mt-2 max-h-48 space-y-0.5 overflow-auto">
                      {parsed.duplicates.map((d) => <li key={`d${d.row}`}>แถว {d.row}: ซ้ำ — {d.name} / {d.subject}</li>)}
                      {parsed.invalidRows.map((d) => <li key={`i${d.row}`}>แถว {d.row}: {d.reason}</li>)}
                    </ul>
                  </details>
                )}

                {parsed.records.length > 0 && (
                  <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-100">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr><th className="th">ชื่อ</th><th className="th">ห้อง</th><th className="th">วิชา</th><th className="th">ครู</th><th className="th">ผล</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsed.records.slice(0, 20).map((r) => (
                          <tr key={r.key}>
                            <td className="whitespace-nowrap px-3 py-1.5">{r.studentName}</td>
                            <td className="px-3 py-1.5">{r.classroom}</td>
                            <td className="whitespace-nowrap px-3 py-1.5">{r.subjectName}</td>
                            <td className="whitespace-nowrap px-3 py-1.5">{r.teacher || '-'}</td>
                            <td className="px-3 py-1.5"><ResultBadge result={r.result} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {issues.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold">ผลการตรวจสอบความถูกต้อง</div>
                    {issues.map((i) => (
                      <Alert key={i.title} tone={i.level === 'error' ? 'red' : i.level === 'warning' ? 'amber' : 'blue'}>
                        <details>
                          <summary className="cursor-pointer font-medium">{i.level === 'error' ? '✖ ' : i.level === 'warning' ? '⚠ ' : 'ℹ '}{i.title}</summary>
                          <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs">{i.details.map((d) => <li key={d}>{d}</li>)}</ul>
                        </details>
                      </Alert>
                    ))}
                    {hasErrors && (
                      <label className="flex items-center gap-2 text-sm text-rose-700">
                        <input type="checkbox" className="accent-rose-600" checked={ackErrors} onChange={(e) => setAckErrors(e.target.checked)} />
                        ตรวจสอบแล้ว ยืนยันนำเข้าแม้มีข้อผิดพลาด (แนะนำให้แก้ไฟล์ต้นทางก่อน)
                      </label>
                    )}
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ModeOption checked={mode === 'replace'} onSelect={() => setMode('replace')} title="แทนที่รายการเดิมทั้งหมด" desc="ใช้รายการจากไฟล์นี้แทนรายการเดิม (สถานะการติดตามเดิมยังเก็บไว้ และจะผูกคืนอัตโนมัติถ้านักเรียน+วิชาตรงกัน)" />
                  <ModeOption checked={mode === 'merge'} onSelect={() => setMode('merge')} title="รวมกับรายการเดิม" desc="เพิ่มรายการใหม่ และอัปเดตรายการที่ตรงกัน โดยไม่ลบรายการเดิม" />
                </div>
                <p className="mt-3 text-xs text-slate-500">พบสถานะการติดตามเดิมที่ตรงกับไฟล์นี้ {withTracking} รายการ — จะไม่ถูกลบหรือรีเซ็ต</p>

                <div className="mt-4 flex justify-end">
                  <button className="btn-primary" disabled={!canImport} onClick={() => setConfirm(true)}>นำเข้าข้อมูล</button>
                </div>
              </div>
            )}
          </>
        )}

        <Alert tone="blue">
          <b>คำแนะนำ:</b> ไฟล์ควรมี 1 แถวต่อ 1 รายวิชาที่ติด และมีคอลัมน์อย่างน้อย ชื่อนักเรียน, ชั้น/ห้อง, รายวิชา, ผลการเรียน (แถวที่ผลการเรียนไม่ใช่ 0 ร มส จะถูกข้ามอัตโนมัติ)
          ระบบจำการจับคู่คอลัมน์ล่าสุดไว้ใช้กับไฟล์ครั้งถัดไป
        </Alert>
      </div>

      <ConfirmDialog
        open={confirm}
        title={mode === 'replace' ? 'ยืนยันการแทนที่ข้อมูล' : 'ยืนยันการรวมข้อมูล'}
        confirmText={mode === 'replace' ? 'แทนที่ข้อมูล' : 'รวมข้อมูล'}
        danger={mode === 'replace' && existingCount > 0 && !isSample}
        onCancel={() => setConfirm(false)}
        onConfirm={doImport}
      >
        <p>นำเข้า <b>{parsed?.records.length ?? 0}</b> รายการจากไฟล์ <b>{fileName}</b> (Sheet: {sheet})</p>
        {mode === 'replace' && existingCount > 0 && (
          <p>รายการเดิม <b>{existingCount}</b> รายการ{isSample ? ' (ข้อมูลตัวอย่าง)' : ''} จะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้</p>
        )}
        <p className="text-emerald-700">สถานะการติดตาม วันกำหนด และหมายเหตุเดิม จะไม่ถูกลบ</p>
        <p className="text-xs text-slate-400">แนะนำ: ส่งออกไฟล์สำรองข้อมูลก่อนนำเข้า</p>
      </ConfirmDialog>
    </div>
  );
}

function Mini({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function ModeOption({ checked, onSelect, title, desc }: { checked: boolean; onSelect: () => void; title: string; desc: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${checked ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'}`}>
      <input type="radio" checked={checked} onChange={onSelect} className="mt-1 accent-blue-600" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </label>
  );
}
