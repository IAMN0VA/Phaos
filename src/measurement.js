export function distanceMm(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<3||b.length<3) return NaN;
  const values=[...a.slice(0,3),...b.slice(0,3)].map(Number);
  if(values.some(v=>!Number.isFinite(v))) return NaN;
  return Math.hypot(values[3]-values[0],values[4]-values[1],values[5]-values[2]);
}

export function hasCalibratedSpacing(spacing){
  return Array.isArray(spacing) && spacing.length===3 && spacing.every(v=>Number.isFinite(Number(v)) && Number(v)>0);
}
