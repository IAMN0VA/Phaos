import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
const intended=fs.readFileSync(path.join(root,'public/intended-use.html'),'utf8');
const partner=fs.readFileSync(path.join(root,'public/partner-use.html'),'utf8');
const all=[html,readme,intended,partner].join('\n');
const failures=[];
const required=[
  'data-audience="explore"','data-audience="study"','data-audience="demo"',
  'supplemental educational','not intended for diagnosis','equipment calibration','acceptance testing'
];
for(const token of required){ if(!all.toLowerCase().includes(token.toLowerCase())) failures.push(`missing positioning token: ${token}`); }
// Public claim surface: the actual app shell plus the opening positioning section of README.
// Policy/partner docs intentionally name prohibited uses in order to disclaim them.
const publicSurface=html+'\n'+readme.split('\n').slice(0,35).join('\n');
const positiveClaims=[
  /(?:is|provides|offers|serves as) (?:an? )?diagnostic workstation/i,
  /(?:is|provides|offers|serves as) (?:an? )?pacs replacement/i,
  /(?:detects|identifies|diagnoses) (?:tumou?r|cancer|fracture|disease|pathology)/i,
  /(?:certifies|validates) (?:scanner|machine|equipment|diagnostic image quality)/i,
  /(?:calibrates|performs calibration of) (?:the )?(?:scanner|machine|equipment)/i,
  /(?:performs|provides) acceptance testing/i,
  /intended for (?:primary )?diagnostic interpretation/i
];
for(const re of positiveClaims){const m=publicSurface.match(re);if(m)failures.push(`prohibited positive public claim: ${m[0]}`);}
if(failures.length){console.error('CLAIMS AUDIT FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log('Claims audit passed: Explore/Study/Demo positioning present; no positive clinical/device-certification claims found on the primary public claim surface.');
