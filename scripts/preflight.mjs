import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const failures = [];
const requiredIds = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]);
for (const id of new Set(requiredIds)) {
  if (!html.includes(`id="${id}"`)) failures.push(`Missing DOM element #${id}`);
}
for (const phrase of ['data-mode="gray"','data-mode="thermal"','data-mode="real"','data-mode="skeletal"','id="measureTool"','id="markerTool"','id="identifyTool"','id="identifyResult"','id="fileInput"','id="folderInput"','id="axisToggle"','id="splicerToggle"']) {
  if (!html.includes(phrase)) failures.push(`Missing required UI binding: ${phrase}`);
}
if (/light mode|themeToggle|data-theme/i.test(html + js + css)) failures.push('Light-mode code is still present');
if (/LOCAL PROCESSING/.test(html)) failures.push('Legacy LOCAL PROCESSING badge is still present');
if (!html.includes('id="sliceAnatomyOverlay"')) failures.push('Missing synchronized slice anatomy overlay');
if (!js.includes('installSliceDockDrag')) failures.push('Movable slice dock behavior missing');
if (!js.includes('clearMeasurementsKeepMarkers')) failures.push('Session marker persistence behavior missing');
if (/point cloud|point density/i.test(html + js)) failures.push('Legacy point-cloud terminology is still present');
if (!css.includes('Work Sans')) failures.push('Work Sans typography is not configured');
if (!js.includes('CircleROITool') || !js.includes('identifyAnatomyAtWorld')) failures.push('Circle & Identify implementation missing');
for (const dep of ['@cornerstonejs/core','@cornerstonejs/dicom-image-loader','@cornerstonejs/tools','dicom-parser','fflate']) {
  if (!pkg.dependencies?.[dep]) failures.push(`Missing dependency ${dep}`);
}
if (!fs.existsSync(path.join(root,'public/_headers'))) failures.push('Missing deployment security headers');

if (failures.length) {
  console.error('SCAN//SPACE preflight FAILED');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('SCAN//SPACE static preflight PASSED');
console.log(`Checked ${new Set(requiredIds).size} DOM bindings, production modes, dependencies, and deployment headers.`);
