import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const scanFiles=[
  'index.html','src/main.js','src/styles.css','public/_headers','public/privacy.html','public/terms.html','public/intended-use.html','public/accessibility.html','public/partner-use.html'
].map(f=>path.join(root,f)).filter(fs.existsSync);
const forbidden=[
  ['third-party HTTP request',/https?:\/\/(?!localhost|127\.0\.0\.1)/i],
  ['analytics SDK',/google-analytics|googletagmanager|segment\.com|mixpanel|amplitude|hotjar/i],
  ['crash reporting SDK',/sentry|bugsnag|rollbar/i],
  ['beacon/network telemetry',/sendBeacon\s*\(|XMLHttpRequest\s*\(|new\s+WebSocket\s*\(/i],
];
let failures=[];
for(const file of scanFiles){
  const text=fs.readFileSync(file,'utf8');
  for(const [label,re] of forbidden){
    if(re.test(text)) failures.push(`${path.relative(root,file)}: ${label}`);
  }
}
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
for(const required of ['educational-imaging-safe-export-v2','DICOM UIDs and raw DICOM metadata are intentionally excluded','safeAnnotationExport']){
  if(!main.includes(required)) failures.push(`safe export requirement missing: ${required}`);
}
if(/console\.(log|info|warn|error)\(/.test(main.replace(/console\[level\]/g,''))){
  const lines=main.split('\n').map((x,i)=>[i+1,x]).filter(([,x])=>/console\.(log|info|warn|error)\(/.test(x));
  const unsafe=lines.filter(([,x])=>!x.includes('const fn=console[level]'));
  if(unsafe.length) failures.push(`unsanitized console logging at lines ${unsafe.map(x=>x[0]).join(', ')}`);
}
if(failures.length){console.error('PRIVACY AUDIT FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log(`Privacy audit passed (${scanFiles.length} files): no analytics/crash telemetry, no third-party runtime URLs, PHI-minimized export present.`);
