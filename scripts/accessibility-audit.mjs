import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
const failures=[];
for(const token of ['class="skip-link"','aria-live="polite"','aria-label="Medical imaging workspace"','role="dialog"']) if(!html.includes(token)) failures.push(`missing accessibility token: ${token}`);
for(const token of [':focus-visible','prefers-reduced-motion']) if(!css.includes(token)) failures.push(`missing CSS accessibility support: ${token}`);
if(failures.length){console.error('ACCESSIBILITY STATIC AUDIT FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log('Accessibility static audit passed: skip link, focus-visible, reduced-motion, live regions, dialog/workspace labels present. Manual WCAG testing is still required.');
