import { useMemo, useState } from 'react';
import type { WorkBook } from 'xlsx';
import { Alert, ConfirmDialog, PageHeader } from '../components/ui';
import { readWorkbook, rowsFromMatrix, sheetMatrix } from '../lib/excel';
import { ENROLL_FIELDS, autoDetectMapping, detectHeaderRow, enrollMissing, parseEnrollment, type ColumnMapping, type FieldKey } from '../lib/importMapping';
import { cellText, normalizeClassroom } from '../lib/normalize';
import { studentKey } from '../lib/selectors';
import { allClassrooms, enrolledOf, fmtPct } from '../lib/stats';
import type { EnrollmentMap, Row } from '../lib/types';

interface Props {
  rows: Row[];
  enrollment: EnrollmentMap;
  setEnrollment: (e: EnrollmentMap) => void;
}

const SOURCE_LABEL = { import: 'นำเข้า', manual: 'กรอกเอง', sample: 'ตัวอย่าง' } as const;

export default function Enrollment({ rows, enrollment, setEnrollment }: Props) {
  const classrooms = useMemo(() => allClassrooms(rows, enrollment), [rows, enrollment]);
  const failing = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    rows.forEach((r) => (m[r.classroom] ??= new Set()).add(studentKey(r)));
    return m;
  }, [rows]);
  const [newRoom, setNewRoom] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [msg, setMsg] = useState<{ tone: 'emerald' | 'red'; text: string } | null>(null);

  const total = classrooms.reduce((s, c) => s + (enrolledOf(enrollment, c) ?? 0), 0);
  const missing = classrooms.filter((c) => enrolledOf(enrollment, c) === null);

  function setRoomTotal(room: string, value: string) {
    const next = { ...enrollment };
    // ล้างค่า = ยังมีห้องนี้อยู่ แต่ไม่ทราบจำนวน (ไม่ลบห้อง เพื่อไม่ให้ตัวหารของระดับ/โรงเรียนลดลงเงียบๆ)
    if (value.trim() === '') {
      if (enrolledOf(enrollment, room) === null) return;
      next[room] = { total: null, source: 'manual', updatedAt: new Date().toISOString() };
    } else {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0 || n > 2000) return setMsg({ tone: 'red', text: `${room}: จำนวนต้องเป็นจำนวนเต็ม 1–2000` });
      if (n < (failing[room]?.size ?? 0)) return setMsg({ tone: 'red', text: `${room}: จำนวน (${n}) น้อยกว่านักเรียนที่ติด (${failing[room].size} คน)` });
      if (enrollment[room]?.total === n) return;
      next[room] = { total: n, source: 'manual', updatedAt: new Date().toISOString() };
    }
    setMsg(null);
    setEnrollment(next);
  }

  function removeRoom(room: string) {
    const next = { ...enrollment };
    delete next[room];
    setEnrollment(next);
    setMsg({ tone: 'emerald', text: `ลบห้อง ${room} ออกจากรายการแล้ว` });
  }

  function addRoom() {
    const room = normalizeClassroom(newRoom);
    if (!/^ม\.\d\/\d+$/.test(room)) return setMsg({ tone: 'red', text: 'รูปแบบห้องไม่ถูกต้อง ตัวอย่าง: ม.1/4 หรือ 1/4' });
    setRoomTotal(room, newTotal);
    setNewRoom('');
    setNewTotal('');
  }

  return (
    <div>
      <PageHeader title="จำนวนนักเรียนทั้งหมด" subtitle="ใช้เป็นตัวหารของร้อยละ — ต้องมาจากทะเบียนนักเรียนที่เชื่อถือได้ ระบบจะไม่คำนวณร้อยละให้กลุ่มที่ข้อมูลไม่ครบ" />
      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {missing.length > 0 ? (
          <Alert tone="amber">ยังขาดจำนวนนักเรียน {missing.length} ห้อง: {missing.join(', ')} — ร้อยละของห้อง ระดับชั้น และทั้งโรงเรียนที่เกี่ยวข้องจะแสดงเป็น "—"</Alert>
        ) : (
          classrooms.length > 0 && <Alert tone="emerald">มีจำนวนนักเรียนครบทุกห้อง รวม {total.toLocaleString('th-TH')} คน</Alert>
        )}

        <EnrollmentImport rows={rows} enrollment={enrollment} setEnrollment={setEnrollment} />

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-4">
            <div>
              <label className="label">เพิ่มห้อง (ห้องที่ไม่มีนักเรียนติด)</label>
              <input className="input w-32" placeholder="ม.1/4" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
            </div>
            <div>
              <label className="label">จำนวนนักเรียน</label>
              <input className="input w-28" type="number" min={1} value={newTotal} onChange={(e) => setNewTotal(e.target.value)} />
            </div>
            <button className="btn-ghost" disabled={!newRoom || !newTotal} onClick={addRoom}>+ เพิ่ม</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/80">
                <tr>
                  <th className="th">ห้อง</th>
                  <th className="th">นักเรียนทั้งหมด</th>
                  <th className="th text-right">นักเรียนที่ติด</th>
                  <th className="th text-right">ร้อยละ</th>
                  <th className="th">แหล่งข้อมูล</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classrooms.map((c) => {
                  const e = enrollment[c];
                  const t = enrolledOf(enrollment, c);
                  const n = failing[c]?.size ?? 0;
                  return (
                    <tr key={c} className={t !== null ? '' : 'bg-amber-50/50'}>
                      <td className="td font-medium">{c}</td>
                      <td className="td">
                        <input
                          key={`${c}-${t ?? ''}`}
                          className="input w-28 py-1.5"
                          type="number"
                          min={1}
                          defaultValue={t ?? ''}
                          placeholder="ไม่มีข้อมูล"
                          onBlur={(ev) => setRoomTotal(c, ev.target.value)}
                          onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                        />
                      </td>
                      <td className="td text-right tabular-nums">{n}</td>
                      <td className="td text-right tabular-nums">{fmtPct(t !== null && n <= t ? (n / t) * 100 : null)}</td>
                      <td className="td text-xs text-slate-500">{e && t !== null ? SOURCE_LABEL[e.source] : <span className="text-amber-700">ยังไม่มีจำนวน</span>}</td>
                      <td className="td text-right">
                        {e && n === 0 && (
                          <button className="text-xs text-slate-400 hover:text-rose-600" title="ลบห้องนี้ (ใช้เมื่อห้องนี้ไม่มีอยู่จริง)" onClick={() => removeRoom(c)}>ลบห้อง</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnrollmentImport({ rows, enrollment, setEnrollment }: Props) {
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheet, setSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<'replace' | 'merge'>('merge');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState('');

  const matrix = useMemo(() => (wb && sheet ? sheetMatrix(wb, sheet) : []), [wb, sheet]);
  const { headers, rows: data } = useMemo(() => rowsFromMatrix(matrix, headerRow), [matrix, headerRow]);
  const missing = enrollMissing(mapping);
  const parsed = useMemo(() => (data.length && missing.length === 0 ? parseEnrollment(data, mapping, headerRow) : null), [data, mapping, headerRow, missing.length]);

  // ตรวจสอบเทียบกับข้อมูลผลการเรียน
  const checks = useMemo(() => {
    if (!parsed) return null;
    const failing: Record<string, Set<string>> = {};
    rows.forEach((r) => (failing[r.classroom] ??= new Set()).add(studentKey(r)));
    const over = Object.entries(parsed.counts).filter(([c, n]) => (failing[c]?.size ?? 0) > n).map(([c, n]) => `${c}: ไฟล์ระบุ ${n} คน แต่มีนักเรียนติด ${failing[c].size} คน`);
    const finalMap: Record<string, number | null> = mode === 'replace' ? parsed.counts : { ...Object.fromEntries(Object.entries(enrollment).map(([k, v]) => [k, v.total])), ...parsed.counts };
    const stillMissing = [...new Set([...Object.keys(failing), ...Object.keys(finalMap)])].filter((c) => (finalMap[c] ?? null) === null);
    const changed = Object.entries(parsed.counts).filter(([c, n]) => enrolledOf(enrollment, c) !== null && enrolledOf(enrollment, c) !== n).map(([c, n]) => `${c}: ${enrolledOf(enrollment, c)} → ${n}`);
    return { over, stillMissing, changed };
  }, [parsed, rows, enrollment, mode]);

  function selectSheet(name: string, book = wb) {
    if (!book) return;
    setSheet(name);
    const m = sheetMatrix(book, name);
    const hr = detectHeaderRow(m, ENROLL_FIELDS);
    setHeaderRow(hr);
    setMapping(autoDetectMapping(rowsFromMatrix(m, hr).headers, undefined, ENROLL_FIELDS));
  }

  async function onFile(file?: File) {
    if (!file) return;
    setError('');
    setDone('');
    try {
      const book = await readWorkbook(file);
      if (!book.SheetNames.length) throw new Error('ไม่พบ Sheet ในไฟล์');
      setWb(book);
      setFileName(file.name);
      selectSheet(book.SheetNames[0], book);
    } catch (e) {
      setWb(null);
      setError(e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ');
    }
  }

  function apply() {
    if (!parsed) return;
    const now = new Date().toISOString();
    const incoming: EnrollmentMap = Object.fromEntries(Object.entries(parsed.counts).map(([c, total]) => [c, { total, source: 'import' as const, updatedAt: now }]));
    setEnrollment(mode === 'replace' ? incoming : { ...enrollment, ...incoming });
    setDone(`นำเข้าจำนวนนักเรียน ${Object.keys(incoming).length} ห้องเรียบร้อย`);
    setConfirm(false);
    setWb(null);
  }

  const roomCount = parsed ? Object.keys(parsed.counts).length : 0;
  const blocked = !parsed || roomCount === 0 || (checks?.over.length ?? 0) > 0;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">นำเข้าจาก Excel / CSV</div>
          <p className="text-xs text-slate-500">รองรับ (ก) ตารางจำนวนต่อห้อง เช่น ชั้น/ห้อง | ชาย | หญิง | รวม หรือ (ข) รายชื่อนักเรียนทั้งหมด (นับคนไม่ซ้ำต่อห้อง) — ไฟล์จาก PDF ให้แปลงเป็น Excel/CSV ก่อน</p>
        </div>
        <label className="btn-ghost cursor-pointer">
          ⬆ เลือกไฟล์
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {error && <div className="mt-3"><Alert tone="red">{error}</Alert></div>}
      {done && <div className="mt-3"><Alert tone="emerald">{done}</Alert></div>}

      {wb && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="text-sm text-slate-600">ไฟล์: <b>{fileName}</b></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Sheet</label>
              <select className="input" value={sheet} onChange={(e) => selectSheet(e.target.value)}>
                {wb.SheetNames.map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="label">แถวหัวตาราง</label>
              <select className="input" value={headerRow} onChange={(e) => { const hr = Number(e.target.value); setHeaderRow(hr); setMapping(autoDetectMapping(rowsFromMatrix(matrix, hr).headers, undefined, ENROLL_FIELDS)); }}>
                {matrix.slice(0, 15).map((r, i) => <option key={i} value={i}>แถว {i + 1}: {r.map(cellText).filter(Boolean).slice(0, 4).join(' | ').slice(0, 60)}</option>)}
              </select>
            </div>
          </div>

          <div className="max-h-56 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50"><tr>{headers.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.slice(0, 8).map((r, i) => <tr key={i}>{headers.map((h) => <td key={h} className="whitespace-nowrap px-3 py-1.5">{cellText(r[h])}</td>)}</tr>)}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ENROLL_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <select className={`input ${mapping[f.key] ? 'border-blue-300 bg-blue-50/40' : ''}`} value={mapping[f.key] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.key as FieldKey]: e.target.value || undefined })}>
                  <option value="">— ไม่ใช้ —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {missing.length > 0 && <Alert tone="red">ขาดคอลัมน์: <b>{missing.join(', ')}</b></Alert>}

          {parsed && checks && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3">
                <span>รูปแบบ: <b>{parsed.mode === 'count' ? 'ตารางจำนวนต่อห้อง' : 'รายชื่อนักเรียน (นับคนไม่ซ้ำ)'}</b></span>
                <span>ห้องที่อ่านได้: <b>{roomCount}</b></span>
                <span>รวม: <b>{Object.values(parsed.counts).reduce((a, b) => a + b, 0).toLocaleString('th-TH')}</b> คน</span>
                <span>แถวผิดรูปแบบ: <b className="text-rose-600">{parsed.invalidRows.length}</b></span>
                <span>ห้องซ้ำ: <b className="text-amber-600">{parsed.duplicates.length}</b></span>
              </div>
              {checks.over.length > 0 && <Alert tone="red"><b>นำเข้าไม่ได้:</b> จำนวนนักเรียนน้อยกว่าจำนวนที่ติด<ul className="mt-1 list-disc pl-5">{checks.over.map((x) => <li key={x}>{x}</li>)}</ul></Alert>}
              {(parsed.invalidRows.length > 0 || parsed.duplicates.length > 0) && (
                <details className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium">ดูแถวที่ถูกข้าม</summary>
                  <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto">
                    {parsed.invalidRows.map((d) => <li key={`i${d.row}`}>แถว {d.row}: {d.reason}</li>)}
                    {parsed.duplicates.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </details>
              )}
              {checks.changed.length > 0 && <Alert tone="amber">ค่าที่จะเปลี่ยนจากเดิม: {checks.changed.join(', ')}</Alert>}
              {checks.stillMissing.length > 0 && <Alert tone="amber">หลังนำเข้า ยังขาดจำนวนนักเรียนของห้อง: {checks.stillMissing.join(', ')}</Alert>}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5"><input type="radio" className="accent-blue-600" checked={mode === 'merge'} onChange={() => setMode('merge')} /> รวม/อัปเดตกับข้อมูลเดิม</label>
                  <label className="flex items-center gap-1.5"><input type="radio" className="accent-blue-600" checked={mode === 'replace'} onChange={() => setMode('replace')} /> แทนที่ทั้งหมด</label>
                </div>
                <button className="btn-primary" disabled={blocked} onClick={() => setConfirm(true)}>นำเข้าจำนวนนักเรียน</button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={confirm} title="ยืนยันการนำเข้าจำนวนนักเรียน" confirmText="นำเข้า" danger={mode === 'replace'} onCancel={() => setConfirm(false)} onConfirm={apply}>
        <p>นำเข้าจำนวนนักเรียน <b>{roomCount}</b> ห้อง จากไฟล์ <b>{fileName}</b></p>
        {mode === 'replace' ? <p className="text-rose-600">จำนวนนักเรียนเดิมทุกห้องจะถูกแทนที่</p> : <p>ห้องที่มีในไฟล์จะถูกอัปเดต ห้องอื่นคงค่าเดิม</p>}
      </ConfirmDialog>
    </div>
  );
}
