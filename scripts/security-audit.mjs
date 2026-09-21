import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const headers=fs.readFileSync(path.join(root,'public/_headers'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const requiredHeaders=[
  'Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Opener-Policy','Cross-Origin-Embedder-Policy','frame-ancestors \'none\'','form-action \'none\''
];
const failures=[];
for(const h of requiredHeaders) if(!headers.includes(h)) failures.push(`missing header/policy: ${h}`);
for(const [group,deps] of Object.entries({dependencies:pkg.dependencies||{},devDependencies:pkg.devDependencies||{},overrides:pkg.overrides||{}})){
  for(const [name,version] of Object.entries(deps)) if(/[~^*><|]/.test(String(version))) failures.push(`${group} ${name} is not exactly pinned: ${version}`);
}
if(/\beval\s*\(/.test(main)||/new\s+Function\s*\(/.test(main)) failures.push('dynamic JS evaluation found in app source');
if(!main.includes('escapeHtml')) failures.push('HTML escaping helper missing');
if(failures.length){console.error('SECURITY AUDIT FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log('Security audit passed: core response headers present, dependencies pinned, no app-source eval/new Function detected.');
