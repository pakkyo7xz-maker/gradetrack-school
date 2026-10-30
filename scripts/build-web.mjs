// สร้าง GradeTrack เป็น HTML ไฟล์เดียว (CSS + JS ฝังในไฟล์) สำหรับเผยแพร่เป็นเว็บแอป
// ใช้: npm run build:web [ไฟล์ปลายทาง]   (ค่าเริ่มต้น: dist-artifact/gradetrack.html)
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx tsc -b && npx vite build --mode artifact', { stdio: 'inherit' });

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
// กันไม่ให้ข้อความ "</script" ในโค้ดไปปิดแท็ก script ก่อนเวลา
const safeJs = js.replace(/<\/(script)/gi, '<\\/$1');
const safeCss = css.replace(/<\/(style)/gi, '<\\/$1');

// เนื้อหาหน้า (แพลตฟอร์มจะครอบ doctype/head/body ให้เอง)
const html = `<title>GradeTrack</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap">
<style>:root{color-scheme:light}html,body{background:#f1f5f9}
${safeCss}</style>
<div id="root"></div>
<script>${safeJs}</script>
`;
const out = process.argv[2] ?? 'dist-artifact/gradetrack.html';
writeFileSync(out, html);
console.log(`เขียน ${out} (${(html.length / 1024).toFixed(0)} KB)`);
