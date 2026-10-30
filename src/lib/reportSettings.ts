// หัวรายงาน PDF (ชื่อโรงเรียน / ภาคเรียน) — แก้ได้ที่หน้า "สำรองข้อมูล"
export interface ReportSettings {
  schoolName: string;
  termLabel: string;
}

const KEY = 'gradetrack.report.v1';
export const DEFAULT_REPORT: ReportSettings = { schoolName: 'โรงเรียนสักงามวิทยา', termLabel: 'ภาคเรียนที่ 1 ปีการศึกษา 2569' };

export function loadReportSettings(): ReportSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ReportSettings> | null;
    return {
      schoolName: typeof v?.schoolName === 'string' && v.schoolName.trim() ? v.schoolName : DEFAULT_REPORT.schoolName,
      termLabel: typeof v?.termLabel === 'string' ? v.termLabel : DEFAULT_REPORT.termLabel,
    };
  } catch {
    return { ...DEFAULT_REPORT };
  }
}

export function saveReportSettings(s: ReportSettings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
