import fs from 'node:fs';
if(!fs.existsSync('package-lock.json')){
  console.error('RELEASE BLOCKED: package-lock.json is missing. Run npm install with the supported Node/npm versions, review the resolved tree, and commit the generated lockfile before public deployment.');
  process.exit(1);
}
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
if(!lock.lockfileVersion || !lock.packages){console.error('RELEASE BLOCKED: invalid package-lock.json');process.exit(1);}
console.log(`Lockfile audit passed (lockfileVersion ${lock.lockfileVersion}).`);
