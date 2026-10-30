// สร้าง GradeTrack เป็น HTML ไฟล์เดียว (CSS + JS ฝังในไฟล์) สำหรับเผยแพร่เป็นเว็บแอป
// ใช้: npm run build:web [ไฟล์ปลายทาง] [--standalone]
//   ค่าเริ่มต้น: dist-artifact/gradetrack.html (เนื้อหาหน้าสำหรับ claude.ai Artifact)
//   --standalone: เอกสาร HTML สมบูรณ์ สำหรับเปิดตรงจากไฟล์หรือวางบนเว็บโฮสต์ใดก็ได้ (เช่น GitHub Pages)
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

execSync('npx tsc -b && npx vite build --mode artifact', { stdio: 'inherit' });

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
// กันไม่ให้ข้อความ "</script" ในโค้ดไปปิดแท็ก script ก่อนเวลา
const safeJs = js
  .replace(/<\/(script)/gi, '<\\/$1')
  // U+FFFD ในโค้ดไลบรารี (pdfmake) เขียนเป็น escape แทน: ความหมายเหมือนเดิม แต่ไม่ถูกมองว่าเป็นอักขระเสีย
  .replace(/\uFFFD/g, '\\uFFFD');
const safeCss = css.replace(/<\/(style)/gi, '<\\/$1');

// เนื้อหาหน้า (แพลตฟอร์มจะครอบ doctype/head/body ให้เอง)
const body = `<title>GradeTrack</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap">
<style>:root{color-scheme:light}html,body{background:#f1f5f9}
${safeCss}</style>
<div id="root"></div>
<script>${safeJs}</script>
`;
const args = process.argv.slice(2);
const standalone = args.includes('--standalone');
const out = args.find((a) => !a.startsWith('--')) ?? 'dist-artifact/gradetrack.html';
const html = standalone
  ? `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232563eb'/%3E%3Cpath d='M9 17l4 4 10-10' stroke='%23fff' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
</head>
<body>
${body}</body>
</html>
`
  : body;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`เขียน ${out} (${(html.length / 1024).toFixed(0)} KB)`);
