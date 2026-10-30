// บันทึกไฟล์ให้ผู้ใช้: บน claude.ai (Artifact) ใช้ความสามารถ downloads ของแพลตฟอร์ม
// บน localhost ใช้ลิงก์ดาวน์โหลดปกติ ผลลัพธ์แจ้งผ่านอีเวนต์ "gradetrack:notice"
import * as XLSX from 'xlsx';

export interface Notice {
  tone: 'emerald' | 'red';
  text: string;
}

export const notify = (n: Notice) => window.dispatchEvent(new CustomEvent<Notice>('gradetrack:notice', { detail: n }));

interface DownloadsApi {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: 'saved' | 'delivered' }>;
}
interface ClaudeHost {
  use(name: 'downloads'): Promise<DownloadsApi | null>;
}

function browserDownload(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveFile(filename: string, data: Blob) {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) {
    browserDownload(data, filename);
    return;
  }
  const downloads = await host.use('downloads');
  if (!downloads) {
    notify({ tone: 'red', text: 'หน้านี้ดาวน์โหลดไฟล์ไม่ได้ ลองเปิดผ่าน claude.ai โดยตรง' });
    return;
  }
  try {
    const res = await downloads.save({ filename, data });
    if (res.status === 'saved') notify({ tone: 'emerald', text: `บันทึกไฟล์ ${filename} แล้ว` });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') return;
    notify({
      tone: 'red',
      text: code === 'rate_limited' ? 'มีหน้าต่างยืนยันการบันทึกเปิดอยู่ กรุณารอสักครู่แล้วลองใหม่' : `บันทึกไฟล์ไม่สำเร็จ (${code ?? 'ไม่ทราบสาเหตุ'})`,
    });
  }
}

export function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return saveFile(filename, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
