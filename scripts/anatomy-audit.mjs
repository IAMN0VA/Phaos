import { ANATOMY_CATALOG, REGION_LABELS } from '../src/anatomyCatalog.js';
const failures=[];
const names=new Set();
const requiredRegions=['BRAIN','SKULL','NECK','CHEST','BREAST','ABDOMEN','PELVIS','CERVICAL_SPINE','THORACIC_SPINE','LUMBAR_SPINE','SHOULDER','UPPER_ARM','ELBOW','FOREARM','WRIST','HAND','HIP','THIGH','KNEE','LOWER_LEG','ANKLE','FOOT','WHOLE_BODY'];
for(const item of ANATOMY_CATALOG){
  const key=String(item.name||'').trim().toLowerCase();
  if(!key) failures.push('an anatomy entry is missing a name');
  if(names.has(key)) failures.push(`duplicate canonical anatomy name: ${item.name}`); names.add(key);
  if(!item.group) failures.push(`${item.name}: missing group`);
  if(!Array.isArray(item.regions)||!item.regions.length) failures.push(`${item.name}: missing regions`);
  if(!Array.isArray(item.center)||item.center.length!==3||item.center.some(v=>!Number.isFinite(v)||v<0||v>1)) failures.push(`${item.name}: invalid normalized center`);
  if(!Array.isArray(item.size)||item.size.length!==3||item.size.some(v=>!Number.isFinite(v)||v<=0||v>1.5)) failures.push(`${item.name}: invalid normalized size`);
}
for(const region of requiredRegions){
  if(!REGION_LABELS[region]) failures.push(`missing region label: ${region}`);
  if(!ANATOMY_CATALOG.some(item=>item.regions.includes(region))) failures.push(`no anatomy entries for region: ${region}`);
}
const kindCounts=ANATOMY_CATALOG.reduce((m,x)=>(m[x.kind]=(m[x.kind]||0)+1,m),{});
for(const kind of ['bone','muscle','tendon','ligament','organ']) if(!(kindCounts[kind]>0)) failures.push(`missing anatomy kind coverage: ${kind}`);
if(failures.length){console.error('ANATOMY AUDIT FAILED\n- '+failures.join('\n- '));process.exit(1);}
console.log(`Anatomy audit passed: ${ANATOMY_CATALOG.length} canonical references across ${requiredRegions.length} launch regions.`);
console.log('Kinds:',kindCounts);
