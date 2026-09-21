(() => {
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const els = {
  app: $('#app'),
  workspace: $('.workspace'),
  canvas: $('#volumeCanvas'),
  empty: $('#emptyState'),
  fileInput: $('#fileInput'),
  folderInput: $('#folderInput'),
  demo: $('#demoButton'),
  sliceDock: $('#sliceDock'),
  sliceCanvas: $('#sliceCanvas'),
  sliceOverlay: $('#sliceOverlay'),
  sliceTitle: $('#sliceTitle'),
  sliceIndexLabel: $('#sliceIndexLabel'),
  anatomyTree: $('#anatomyTree'),
  anatomySearch: $('#anatomySearch'),
  metadataList: $('#metadataList'),
  studyType: $('#studyType'),
  studyRegion: $('#studyRegion'),
  confidenceLabel: $('#confidenceLabel'),
  contrast: $('#contrast'),
  brightness: $('#brightness'),
  threshold: $('#threshold'),
  density: $('#density'),
  slicePosition: $('#slicePosition'),
  contrastOut: $('#contrastOut'),
  brightnessOut: $('#brightnessOut'),
  thresholdOut: $('#thresholdOut'),
  densityOut: $('#densityOut'),
  sliceOut: $('#sliceOut'),
  hud: $('#hud'),
  hudMode: $('#hudMode'),
  hudDims: $('#hudDims'),
  hudPosition: $('#hudPosition'),
  notice: $('#modeNotice'),
  toast: $('#toast'),
  theme: $('#themeToggle'),
  splicerToggle: $('#splicerToggle'),
  axisToggle: $('#axisToggle'),
  measureTool: $('#measureTool'),
  markerTool: $('#markerTool'),
  resetView: $('#resetView'),
  clearTools: $('#clearTools'),
  readout: $('#measureReadout')
};

const ctx = els.canvas.getContext('2d', { alpha: false });
const sliceCtx = els.sliceCanvas.getContext('2d');
const overlayCtx = els.sliceOverlay.getContext('2d');

const anatomyMaps = {
  BRAIN: { CRANIAL:['Brain','Ventricles','Cerebellum','Brainstem'], VASCULAR:['Circle of Willis','Major vessels'], REFERENCE:['Skull','Sinuses'] },
  SKULL: { CRANIAL:['Skull','Brain','Sinuses'], DENTAL:['Teeth','Jaw','Mandible','Maxilla'], FACIAL:['Orbits','Nasal cavity'], NECK:['C1','C2','C3','C4','C5','C6','C7'] },
  NECK: { SPINE:['C1','C2','C3','C4','C5','C6','C7'], SOFT_TISSUE:['Trachea','Thyroid','Esophagus'], VASCULAR:['Carotid arteries','Jugular veins'] },
  CHEST: { THORACIC:['Lungs','Heart','Trachea','Esophagus'], VASCULAR:['Aorta','Pulmonary vessels'], SKELETAL:['Ribs','Sternum','Thoracic spine'] },
  ABDOMEN: { ABDOMINAL:['Liver','Spleen','Stomach','Pancreas','Gallbladder','Appendix','Intestines'], VASCULAR:['Aorta','Major vessels'], URINARY:['Kidneys','Bladder'] },
  PELVIS: { PELVIC:['Bladder','Rectum','Pelvic floor'], VASCULAR:['Iliac vessels'], SKELETAL:['Pelvis','Sacrum','Hip joints'] },
  EXTREMITY: { SKELETAL:['Bone','Joint'], SOFT_TISSUE:['Muscle','Tendon','Subcutaneous tissue'] },
  UNKNOWN: { REFERENCE:['Center of study','Superior','Inferior','Left','Right'] }
};

const referencePositions = {
  'brain':[.50,.48,.52], 'ventricles':[.50,.48,.52], 'cerebellum':[.50,.72,.28], 'brainstem':[.50,.62,.36], 'skull':[.50,.50,.50], 'sinuses':[.50,.62,.66],
  'c1':[.50,.36,.82], 'c2':[.50,.39,.74], 'c3':[.50,.43,.64], 'c4':[.50,.47,.54], 'c5':[.50,.51,.44], 'c6':[.50,.55,.34], 'c7':[.50,.60,.24],
  'liver':[.64,.47,.60], 'spleen':[.25,.44,.59], 'stomach':[.43,.50,.62], 'pancreas':[.47,.50,.53], 'gallbladder':[.60,.52,.57], 'appendix':[.62,.68,.28], 'intestines':[.50,.60,.40],
  'aorta':[.50,.47,.48], 'major vessels':[.50,.48,.50], 'kidneys':[.50,.51,.49], 'left kidney':[.29,.50,.50], 'right kidney':[.70,.50,.50], 'bladder':[.50,.72,.18],
  'lungs':[.50,.43,.58], 'heart':[.48,.58,.42], 'trachea':[.50,.30,.64], 'ribs':[.50,.52,.53], 'sternum':[.50,.68,.52],
  'mandible':[.50,.70,.27], 'maxilla':[.50,.61,.50], 'teeth':[.50,.70,.45], 'jaw':[.50,.68,.35]
};

const state = {
  kind: null,
  volume: null,
  image2D: null,
  metadata: {},
  region: 'UNKNOWN',
  modality: '—',
  regionConfidence: '—',
  color: 'gray',
  contrast: 1,
  brightness: 0,
  threshold: .38,
  density: .6,
  plane: 'axial',
  sliceT: .5,
  showPlane: true,
  showAxes: true,
  rotX: -.22,
  rotY: .56,
  zoom: 1,
  panX: 0,
  panY: 0,
  points: [],
  currentSlice: null,
  dragging: false,
  dragMode: 'rotate',
  lastX: 0,
  lastY: 0,
  tool: null,
  measureStart: null,
  measures: [],
  markers: [],
  particleT: 0,
  particles: [],
  particleRAF: 0,
  toastTimer: null,
  dimensions: null,
  spacing: [1,1,1],
  isDemo: false
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function median(a){ if(!a.length) return 1; const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

function showToast(msg, ms=3200){
  clearTimeout(state.toastTimer);
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

function setNotice(msg){
  if(!msg){ els.notice.classList.add('hidden'); return; }
  els.notice.textContent = msg;
  els.notice.classList.remove('hidden');
}

function resizeAll(){
  const wr = els.workspace.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  els.canvas.width = Math.max(1, Math.floor(wr.width * dpr));
  els.canvas.height = Math.max(1, Math.floor(wr.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sr = els.sliceCanvas.getBoundingClientRect();
  if(sr.width){
    els.sliceCanvas.width = Math.floor(sr.width * dpr);
    els.sliceCanvas.height = Math.floor(sr.height * dpr);
    els.sliceOverlay.width = Math.floor(sr.width * dpr);
    els.sliceOverlay.height = Math.floor(sr.height * dpr);
    sliceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  render();
  renderSlice();
}
window.addEventListener('resize', resizeAll);

function bindRange(el, out, fn, fmt){
  el.addEventListener('input', () => {
    fn(+el.value);
    out.textContent = fmt(+el.value);
    render();
    renderSlice();
  });
}

function setTheme(){
  els.app.dataset.theme = els.app.dataset.theme === 'dark' ? 'light' : 'dark';
  render();
  renderSlice();
}
els.theme.addEventListener('click', setTheme);

$$('#colorMode button').forEach((b) => b.addEventListener('click', () => {
  $$('#colorMode button').forEach((x) => x.classList.toggle('active', x === b));
  state.color = b.dataset.value;
  render();
  renderSlice();
}));

$$('#planeMode button').forEach((b) => b.addEventListener('click', () => {
  $$('#planeMode button').forEach((x) => x.classList.toggle('active', x === b));
  state.plane = b.dataset.value;
  state.measures = [];
  state.measureStart = null;
  render();
  renderSlice();
}));

bindRange(els.contrast, els.contrastOut, (v) => state.contrast = v / 100, (v) => v + '%');
bindRange(els.brightness, els.brightnessOut, (v) => state.brightness = v, (v) => v > 0 ? '+' + v : String(v));
bindRange(els.threshold, els.thresholdOut, (v) => state.threshold = v / 100, (v) => v + '%');
bindRange(els.density, els.densityOut, (v) => state.density = v / 100, (v) => v + '%');
bindRange(els.slicePosition, els.sliceOut, (v) => state.sliceT = v / 1000, (v) => Math.round(v / 10) + '%');

els.slicePosition.addEventListener('input', () => {
  state.measures = [];
  state.measureStart = null;
});

els.splicerToggle.addEventListener('click', () => {
  state.showPlane = !state.showPlane;
  els.splicerToggle.classList.toggle('active', state.showPlane);
  els.splicerToggle.setAttribute('aria-pressed', String(state.showPlane));
  render();
});

els.axisToggle.addEventListener('click', () => {
  state.showAxes = !state.showAxes;
  els.axisToggle.classList.toggle('active', state.showAxes);
  els.axisToggle.setAttribute('aria-pressed', String(state.showAxes));
  render();
});

function setTool(tool){
  state.tool = state.tool === tool ? null : tool;
  els.measureTool.classList.toggle('active', state.tool === 'measure');
  els.markerTool.classList.toggle('active', state.tool === 'marker');
  els.sliceOverlay.style.cursor = state.tool ? 'crosshair' : 'default';
}
els.measureTool.addEventListener('click', () => setTool('measure'));
els.markerTool.addEventListener('click', () => setTool('marker'));
els.clearTools.addEventListener('click', () => {
  state.measures = [];
  state.markers = [];
  state.measureStart = null;
  renderSlice();
  showToast('Measurements and markers cleared');
});
els.resetView.addEventListener('click', () => {
  state.rotX = -.22; state.rotY = .56; state.zoom = 1; state.panX = 0; state.panY = 0;
  render();
});

for(const input of [els.fileInput, els.folderInput]) input.addEventListener('change', (e) => handleFiles([...e.target.files]));
els.demo.addEventListener('click', loadDemo);
['dragenter','dragover'].forEach((ev) => els.workspace.addEventListener(ev, (e) => { e.preventDefault(); els.workspace.classList.add('drop-active'); }));
['dragleave','drop'].forEach((ev) => els.workspace.addEventListener(ev, (e) => { e.preventDefault(); els.workspace.classList.remove('drop-active'); }));
els.workspace.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));

function isZipLike(file){ return /\.zip$/i.test(file.name) || /zip/.test(file.type || ''); }
function isImageLike(file){ return /^image\//.test(file.type || '') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name || ''); }
function isDicomLike(file){
  const n = file.name || '';
  if(/\.(dcm|dicom)$/i.test(n)) return true;
  if(file.type === 'application/dicom') return true;
  if(isZipLike(file) || isImageLike(file)) return false;
  return !/\.[a-z0-9]+$/i.test(n) || !file.type;
}

async function handleFiles(files){
  if(!files.length) return;
  setNotice('Reading selected files locally…');
  try {
    const expanded = await expandInputFiles(files);
    const dicomFiles = expanded.filter(isDicomLike);
    const imageFiles = expanded.filter(isImageLike);

    if(dicomFiles.length){
      await loadDicomFiles(dicomFiles);
    } else if(imageFiles.length === 1){
      await loadImage2D(imageFiles[0]);
    } else if(imageFiles.length > 1){
      showToast('Multiple ordinary image files cannot establish medical slice geometry. Select a DICOM series or ZIP for volumetric reconstruction.', 5600);
      await loadImage2D(imageFiles[0]);
    } else {
      throw new Error('No supported DICOM, ZIP, PNG, or JPEG files were found.');
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not read study', 7200);
    setNotice('Study could not be loaded. No files were uploaded.');
  }
}

async function expandInputFiles(files){
  const out = [];
  for(const file of files){
    if(isZipLike(file)){
      const entries = await extractZipEntries(file);
      out.push(...entries);
    } else {
      out.push(file);
    }
  }
  return out;
}

async function extractZipEntries(file){
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let eocd = -1;
  for(let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i--){
    if(view.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('ZIP archive could not be read.');

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  let p = cdOffset;
  const entries = [];

  for(let i = 0; i < totalEntries; i++){
    if(view.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP central directory is invalid.');
    const compression = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.slice(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if(name.endsWith('/')) continue;

    if(view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('ZIP local file header is invalid.');
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = u8.slice(dataStart, dataStart + compressedSize);

    let data;
    if(compression === 0){
      data = compressed;
    } else if(compression === 8){
      if(typeof DecompressionStream === 'undefined') throw new Error('This browser does not support ZIP deflate decompression for local DICOM ZIP archives.');
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Response(new Blob([compressed]).stream().pipeThrough(ds));
      data = new Uint8Array(await stream.arrayBuffer());
    } else {
      throw new Error(`ZIP compression method ${compression} is not supported by this prototype.`);
    }

    if(uncompressedSize && data.byteLength !== uncompressedSize){
      // Accept size mismatch conservatively rather than failing; some browser streams report exact bytes anyway.
    }

    entries.push({
      name,
      type: mimeFromName(name),
      async arrayBuffer(){ return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength); }
    });
  }
  if(!entries.length) throw new Error('ZIP archive did not contain readable files.');
  showToast(`ZIP unpacked locally · ${entries.length} file${entries.length===1?'':'s'} discovered`, 3200);
  return entries;
}

function mimeFromName(name){
  if(/\.(png)$/i.test(name)) return 'image/png';
  if(/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
  if(/\.(webp)$/i.test(name)) return 'image/webp';
  if(/\.(dcm|dicom)$/i.test(name)) return 'application/dicom';
  return '';
}

function readAscii(view, start, len){
  let s = '';
  for(let i = 0; i < len && start + i < view.byteLength; i++){
    const c = view.getUint8(start + i);
    if(c) s += String.fromCharCode(c);
  }
  return s.replace(/\0/g, '').trim();
}
function tagKey(g,e){ return g.toString(16).padStart(4,'0') + e.toString(16).padStart(4,'0'); }
function parseNums(s){ return String(s || '').split('\\').map(Number).filter(Number.isFinite); }
const knownVR = {
  '00080060':'CS','00081030':'LO','0008103e':'LO','00180015':'CS','00180050':'DS','00180088':'DS','0020000e':'UI','00200011':'IS','00200013':'IS','00200032':'DS','00200037':'DS',
  '00280002':'US','00280004':'CS','00280010':'US','00280011':'US','00280030':'DS','00280100':'US','00280101':'US','00280102':'US','00280103':'US','00281050':'DS','00281051':'DS','00281052':'DS','00281053':'DS','7fe00010':'OW'
};

function skipUndefined(view, o, little=true){
  let depth = 1;
  while(o + 8 <= view.byteLength){
    const g = view.getUint16(o, little);
    const e = view.getUint16(o + 2, little);
    const len = view.getUint32(o + 4, little);
    o += 8;
    if(g === 0xfffe && e === 0xe0dd){ depth--; if(!depth) return o; }
    if(g === 0xfffe && e === 0xe000 && len === 0xffffffff) depth++;
    if(len !== 0xffffffff && o + len <= view.byteLength) o += len;
    else if(len === 0xffffffff && !(g === 0xfffe && e === 0xe000)) depth++;
  }
  return view.byteLength;
}

function parseDicom(buffer, name){
  const view = new DataView(buffer);
  let o = 0, explicit = true, little = true, transfer = '';
  if(view.byteLength > 132 && readAscii(view, 128, 4) === 'DICM') o = 132;

  while(o + 8 < view.byteLength){
    const g = view.getUint16(o, true);
    if(g !== 0x0002) break;
    const e = view.getUint16(o + 2, true);
    const vr = readAscii(view, o + 4, 2);
    let len, hs;
    if(['OB','OW','OF','SQ','UT','UN'].includes(vr)){ len = view.getUint32(o + 8, true); hs = 12; }
    else { len = view.getUint16(o + 6, true); hs = 8; }
    const key = tagKey(g, e);
    if(key === '00020010') transfer = readAscii(view, o + hs, len);
    o += hs + len;
  }

  if(transfer === '1.2.840.10008.1.2'){ explicit = false; little = true; }
  else if(!transfer || transfer === '1.2.840.10008.1.2.1'){ explicit = true; little = true; }
  else if(transfer === '1.2.840.10008.1.2.2'){ throw new Error('Big-endian DICOM is not supported by this prototype.'); }
  else { throw new Error('Compressed/encapsulated DICOM transfer syntax is not supported by this prototype: ' + transfer); }

  const tags = { transferSyntax: transfer || '1.2.840.10008.1.2.1', fileName: name };
  let pixel = null;

  while(o + 8 <= view.byteLength){
    const g = view.getUint16(o, little), e = view.getUint16(o + 2, little), key = tagKey(g,e);
    let vr, len, hs;
    if(explicit){
      vr = readAscii(view, o + 4, 2);
      if(['OB','OW','OF','SQ','UT','UN'].includes(vr)){ if(o + 12 > view.byteLength) break; len = view.getUint32(o + 8, little); hs = 12; }
      else { len = view.getUint16(o + 6, little); hs = 8; }
    } else {
      vr = knownVR[key] || 'UN';
      len = view.getUint32(o + 4, little);
      hs = 8;
    }
    const data = o + hs;
    if(key === '7fe00010'){ pixel = { offset: data, length: len, vr }; break; }
    if(len === 0xffffffff){ o = skipUndefined(view, data, little); continue; }
    if(data + len > view.byteLength) break;

    if(knownVR[key]){
      if(vr === 'US' && len >= 2) tags[key] = view.getUint16(data, little);
      else if(vr === 'SS' && len >= 2) tags[key] = view.getInt16(data, little);
      else tags[key] = readAscii(view, data, len);
    }
    o = data + len;
  }

  const rows = Number(tags['00280010']), cols = Number(tags['00280011']);
  const bits = Number(tags['00280100'] || 16), samples = Number(tags['00280002'] || 1), signed = Number(tags['00280103'] || 0) === 1;
  if(!pixel || !rows || !cols) throw new Error('This DICOM file does not expose a readable grayscale pixel matrix.');
  if(samples !== 1) throw new Error('Only single-sample grayscale DICOM is supported in this prototype.');
  if(bits !== 8 && bits !== 16) throw new Error('Only 8-bit and 16-bit uncompressed DICOM is supported.');

  const count = rows * cols;
  if(pixel.length !== 0xffffffff && pixel.length < count * (bits/8)) throw new Error('DICOM pixel data is shorter than expected.');
  let arr;
  if(bits === 8){
    arr = signed ? new Int8Array(buffer, pixel.offset, count) : new Uint8Array(buffer, pixel.offset, count);
  } else {
    if(pixel.offset % 2 === 0){ arr = signed ? new Int16Array(buffer, pixel.offset, count) : new Uint16Array(buffer, pixel.offset, count); }
    else {
      arr = signed ? new Int16Array(count) : new Uint16Array(count);
      for(let i = 0; i < count; i++) arr[i] = signed ? view.getInt16(pixel.offset + i * 2, little) : view.getUint16(pixel.offset + i * 2, little);
    }
  }

  return {
    buffer, tags, rows, cols, bits, signed, pixels: arr,
    modality: tags['00080060'] || 'DICOM',
    body: tags['00180015'] || '',
    studyDesc: tags['00081030'] || '',
    seriesDesc: tags['0008103e'] || '',
    seriesUID: tags['0020000e'] || 'SERIES-DEFAULT',
    instance: +tags['00200013'] || 0,
    position: parseNums(tags['00200032']),
    orientation: parseNums(tags['00200037']),
    pixelSpacing: parseNums(tags['00280030']),
    sliceThickness: +tags['00180050'] || 0,
    spacingBetween: +tags['00180088'] || 0,
    windowCenter: parseNums(tags['00281050'])[0],
    windowWidth: parseNums(tags['00281051'])[0],
    intercept: +tags['00281052'] || 0,
    slope: +tags['00281053'] || 1,
    photo: tags['00280004'] || 'MONOCHROME2'
  };
}

async function loadDicomFiles(files){
  setNotice(`Parsing ${files.length} DICOM file${files.length===1?'':'s'} locally…`);
  const parsed = [];
  for(const file of files){
    try {
      parsed.push(parseDicom(await file.arrayBuffer(), file.name));
    } catch (e) {
      console.warn(file.name, e);
      if(files.length === 1) throw e;
    }
  }
  if(!parsed.length) throw new Error('None of the selected DICOM files could be decoded by the prototype.');

  const groups = new Map();
  for(const p of parsed){
    if(!groups.has(p.seriesUID)) groups.set(p.seriesUID, []);
    groups.get(p.seriesUID).push(p);
  }
  const series = [...groups.values()].sort((a,b) => b.length - a.length)[0];
  const first = series[0];
  state.modality = first.modality;
  const regionInfo = inferRegion(first);
  state.region = regionInfo.region;
  state.regionConfidence = regionInfo.confidence;

  if(series.length < 2){
    const frame = normalizeSingle(first);
    loadNormalized2D(frame, first.cols, first.rows, { source: 'DICOM', seriesDesc: first.seriesDesc || first.tags['00200011'] || 'SINGLE FRAME DICOM' });
    setNotice('Single-frame DICOM detected → faithful 2D mode. No 3D reconstruction was attempted.');
    return;
  }

  if(!series.every((s) => s.rows === first.rows && s.cols === first.cols)) throw new Error('The largest DICOM series contains inconsistent image dimensions.');
  orderSeries(series);
  const zSpacing = deriveZSpacing(series);
  const ps = first.pixelSpacing.length >= 2 ? first.pixelSpacing : [1,1];
  const volume = normalizeSeries(series);
  state.volume = { data: volume, w: first.cols, h: first.rows, d: series.length };
  state.kind = 'volume';
  state.image2D = null;
  state.dimensions = [first.cols, first.rows, series.length];
  state.spacing = [ps[1] || 1, ps[0] || 1, zSpacing || 1];
  state.isDemo = false;
  state.metadata = {
    modality: first.modality,
    series: first.seriesDesc || first.tags['00200011'] || 'DICOM SERIES',
    dimensions: `${first.cols} × ${first.rows} × ${series.length}`,
    voxel: `${state.spacing.map((x) => Number(x).toFixed(2)).join(' × ')} mm`
  };
  finishStudy();
  buildPointCloud();
  setNotice(`Volumetric DICOM series reconstructed from ${series.length} spatially ordered slice${series.length===1?'':'s'}. Individual .dcm files and ZIP-contained DICOM are supported here when the browser can unpack ZIP locally.`);
  showToast(`Loaded ${series.length} DICOM slices · processed locally`, 3600);
}

function orderSeries(series){
  const ori = series.find((s) => s.orientation.length === 6)?.orientation;
  const normal = ori ? cross(ori.slice(0,3), ori.slice(3,6)) : null;
  series.forEach((s, i) => {
    s._order = normal && s.position.length === 3 ? dot(s.position, normal) : (s.position[2] ?? s.instance ?? i);
  });
  series.sort((a,b) => a._order - b._order);
}
function deriveZSpacing(series){
  const dif = [];
  for(let i = 1; i < series.length; i++){
    const d = Math.abs(series[i]._order - series[i-1]._order);
    if(d > 1e-4) dif.push(d);
  }
  return median(dif) || series[0].spacingBetween || series[0].sliceThickness || 1;
}
function rawValue(s, i){ return Number(s.pixels[i]) * s.slope + s.intercept; }
function normalizeSeries(series){
  let lo = Infinity, hi = -Infinity;
  const wc = series[0].windowCenter, ww = series[0].windowWidth;
  if(Number.isFinite(wc) && Number.isFinite(ww) && ww > 1){ lo = wc - ww / 2; hi = wc + ww / 2; }
  else {
    for(const s of series){
      const step = Math.max(1, Math.floor(s.pixels.length / 12000));
      for(let i = 0; i < s.pixels.length; i += step){
        const v = rawValue(s, i); if(v < lo) lo = v; if(v > hi) hi = v;
      }
    }
    if(!(hi > lo)){ lo = 0; hi = 1; }
  }
  const out = new Uint8Array(series[0].rows * series[0].cols * series.length);
  let off = 0;
  for(const s of series){
    const inv = /MONOCHROME1/i.test(s.photo);
    for(let i = 0; i < s.pixels.length; i++){
      let q = clamp((rawValue(s, i) - lo) / (hi - lo), 0, 1);
      if(inv) q = 1 - q;
      out[off++] = Math.round(q * 255);
    }
  }
  return out;
}
function normalizeSingle(s){
  let lo = Infinity, hi = -Infinity;
  const wc = s.windowCenter, ww = s.windowWidth;
  if(Number.isFinite(wc) && Number.isFinite(ww) && ww > 1){ lo = wc - ww / 2; hi = wc + ww / 2; }
  else {
    for(let i = 0; i < s.pixels.length; i++){
      const v = rawValue(s, i); if(v < lo) lo = v; if(v > hi) hi = v;
    }
  }
  const out = new Uint8Array(s.pixels.length);
  const inv = /MONOCHROME1/i.test(s.photo);
  for(let i = 0; i < out.length; i++){
    let q = clamp((rawValue(s, i) - lo) / ((hi - lo) || 1), 0, 1);
    if(inv) q = 1 - q;
    out[i] = Math.round(q * 255);
  }
  return out;
}
function inferRegion(s){
  const t = (s.body + ' ' + s.studyDesc + ' ' + s.seriesDesc).toUpperCase();
  const rules = [
    ['BRAIN', /BRAIN|HEAD.*MR|CRANI/],
    ['SKULL', /SKULL|FACIAL|MANDIBLE|MAXILLA|DENTAL/],
    ['NECK', /NECK|CERVICAL|C-SPINE/],
    ['CHEST', /CHEST|THORAX|LUNG|CARDIAC/],
    ['ABDOMEN', /ABDOM|LIVER|PANCREA|KIDNEY/],
    ['PELVIS', /PELV|HIP/],
    ['EXTREMITY', /KNEE|ANKLE|FOOT|HAND|WRIST|ELBOW|SHOULDER|FEMUR|TIBIA|HUMERUS/]
  ];
  for(const [r, re] of rules) if(re.test(t)) return { region: r, confidence: 'METADATA RULE' };
  return { region: 'UNKNOWN', confidence: 'UNCLASSIFIED' };
}

async function loadImage2D(file){
  const blob = file instanceof Blob ? file : new Blob([await file.arrayBuffer()], { type: file.type || mimeFromName(file.name) || 'application/octet-stream' });
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d');
  x.drawImage(bmp, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height);
  const crop = findImageBounds(im);
  const w = crop.x1 - crop.x0 + 1, h = crop.y1 - crop.y0 + 1;
  const out = new Uint8Array(w * h);
  for(let yy = 0; yy < h; yy++){
    for(let xx = 0; xx < w; xx++){
      const i = ((yy + crop.y0) * im.width + (xx + crop.x0)) * 4;
      out[yy * w + xx] = Math.round(.2126 * im.data[i] + .7152 * im.data[i + 1] + .0722 * im.data[i + 2]);
    }
  }
  state.modality = '2D IMAGE';
  state.region = inferRegionFromName(file.name);
  state.regionConfidence = state.region === 'UNKNOWN' ? 'NO METADATA' : 'FILENAME HEURISTIC';
  loadNormalized2D(out, w, h, { source: file.type || 'IMAGE', seriesDesc: file.name });
  setNotice('Standalone 2D image detected → 2D mode. Empty border space was reduced where possible; no 3D reconstruction was attempted.');
}

function inferRegionFromName(name){
  const t = String(name || '').toUpperCase();
  if(/BRAIN|HEAD|SKULL/.test(t)) return 'SKULL';
  if(/NECK|CERVICAL/.test(t)) return 'NECK';
  if(/CHEST|LUNG|THORAX/.test(t)) return 'CHEST';
  if(/ABDOM|LIVER|KIDNEY|PANCREAS/.test(t)) return 'ABDOMEN';
  if(/PELV|HIP/.test(t)) return 'PELVIS';
  if(/HAND|FOOT|KNEE|ANKLE|WRIST|ELBOW|SHOULDER/.test(t)) return 'EXTREMITY';
  return 'UNKNOWN';
}

function findImageBounds(im){
  const { width, height, data } = im;
  const sample = (x,y) => {
    const i = (y * width + x) * 4;
    return (.2126 * data[i] + .7152 * data[i+1] + .0722 * data[i+2]);
  };
  const cornerMean = (sample(0,0) + sample(width-1,0) + sample(0,height-1) + sample(width-1,height-1)) / 4;
  const darkBG = cornerMean < 127;
  const threshold = darkBG ? 12 : 243;
  let x0 = width-1, y0 = height-1, x1 = 0, y1 = 0, found = false;
  for(let y = 0; y < height; y++){
    for(let x = 0; x < width; x++){
      const v = sample(x,y);
      const meaningful = darkBG ? v > threshold : v < threshold;
      if(meaningful){
        found = true;
        if(x < x0) x0 = x;
        if(y < y0) y0 = y;
        if(x > x1) x1 = x;
        if(y > y1) y1 = y;
      }
    }
  }
  if(!found) return { x0:0, y0:0, x1:width-1, y1:height-1 };
  const pad = 3;
  return { x0: Math.max(0, x0-pad), y0: Math.max(0, y0-pad), x1: Math.min(width-1, x1+pad), y1: Math.min(height-1, y1+pad) };
}

function loadNormalized2D(data, w, h, meta={}){
  state.kind = '2d';
  state.image2D = { data, w, h };
  state.volume = null;
  state.dimensions = [w, h, 1];
  state.spacing = [1,1,1];
  state.metadata = {
    modality: state.modality,
    series: meta.seriesDesc || meta.source || '2D IMAGE',
    dimensions: `${w} × ${h}`,
    voxel: '2D IMAGE'
  };
  finishStudy();
  render();
  renderSlice();
}

function loadDemo(){
  const w = 96, h = 120, d = 88;
  const data = new Uint8Array(w * h * d);
  const cx = w * .5, cy = h * .49, cz = d * .5;
  for(let z = 0; z < d; z++){
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        const nx = (x - cx) / (w * .28), ny = (y - cy) / (h * .36), nz = (z - cz) / (d * .30);
        const head = nx*nx + ny*ny + nz*nz;
        const brain = ((x-cx)/(w*.22))**2 + ((y-cy)/(h*.28))**2 + ((z-cz)/(d*.24))**2;
        const stem = ((x-cx)/(w*.07))**2 + ((y-(cy+h*.17))/(h*.08))**2 + ((z-(cz-d*.12))/(d*.08))**2;
        const ventL = ((x-(cx-w*.07))/(w*.05))**2 + ((y-(cy-h*.01))/(h*.04))**2 + ((z-cz)/(d*.06))**2;
        const ventR = ((x-(cx+w*.07))/(w*.05))**2 + ((y-(cy-h*.01))/(h*.04))**2 + ((z-cz)/(d*.06))**2;
        const sinus = ((x-(cx-w*.08))/(w*.05))**2 + ((y-(cy+h*.16))/(h*.03))**2 + ((z-(cz+d*.08))/(d*.04))**2;
        let v = 0;
        if(head <= 1) v = 70;
        if(head <= .88) v = 108;
        if(brain <= 1) v = 160;
        if(stem <= 1) v = 195;
        if(ventL <= 1 || ventR <= 1) v = 225;
        if(sinus <= 1) v = 210;
        if(v){
          v += Math.sin((x+y+z) * .22) * 10 + Math.cos(z * .16) * 6;
          v = clamp(v, 0, 255);
        }
        data[(z*h + y) * w + x] = v;
      }
    }
  }
  state.kind = 'volume';
  state.volume = { data, w, h, d };
  state.image2D = null;
  state.modality = 'MRI';
  state.region = 'BRAIN';
  state.regionConfidence = 'SYNTHETIC DEMO';
  state.dimensions = [w,h,d];
  state.spacing = [1.2, 1.2, 1.7];
  state.isDemo = true;
  state.metadata = { modality: 'MRI', series: 'DEMO HEAD PHANTOM', dimensions: `${w} × ${h} × ${d}`, voxel: '1.20 × 1.20 × 1.70 mm' };
  finishStudy();
  buildPointCloud();
  setNotice('Synthetic head phantom loaded. It demonstrates the volume explorer, synchronized planes, Splicer, markers, measurements, and thermal colorization without using patient data.');
  showToast('Demo phantom loaded', 2400);
}

function finishStudy(){
  cancelParticles();
  els.empty.classList.add('hidden');
  els.hud.classList.remove('hidden');
  els.sliceDock.classList.remove('hidden');
  els.studyType.textContent = state.modality || 'STUDY';
  els.studyRegion.textContent = state.region || 'UNKNOWN';
  els.confidenceLabel.textContent = state.regionConfidence || 'REFERENCE';
  els.hudMode.textContent = state.kind === 'volume' ? 'VOLUME' : '2D IMAGE';
  els.hudDims.textContent = state.kind === 'volume' ? `${state.dimensions[0]}×${state.dimensions[1]}×${state.dimensions[2]}` : `${state.dimensions[0]}×${state.dimensions[1]}`;
  updateMeta();
  updateAnatomy();
  $$('.volume-only').forEach((el) => el.classList.toggle('hidden', state.kind !== 'volume'));
  els.readout.textContent = 'SPATIAL SLICE · NO DIAGNOSTIC INTERPRETATION';
  state.measures = [];
  state.markers = [];
  state.measureStart = null;
  state.sliceT = .5;
  els.slicePosition.value = '500';
  els.sliceOut.textContent = '50%';
  render();
  renderSlice();
}

function updateMeta(){
  const rows = [
    ['Modality', state.metadata.modality || state.modality || '—'],
    ['Series', state.metadata.series || '—'],
    ['Dimensions', state.metadata.dimensions || '—'],
    ['Voxel', state.metadata.voxel || '—']
  ];
  els.metadataList.innerHTML = rows.map(([dt,dd]) => `<div><dt>${dt}</dt><dd title="${dd}">${dd}</dd></div>`).join('');
}

function updateAnatomy(){
  const groups = anatomyMaps[state.region] || anatomyMaps.UNKNOWN;
  els.anatomyTree.classList.remove('empty-tree');
  els.anatomyTree.innerHTML = Object.entries(groups).map(([g,items]) => `
    <div class="anatomy-group">
      <h3>${g.replace(/_/g,' ')}</h3>
      <div class="anatomy-items">
        ${items.map((item) => `<button class="anatomy-item" data-anatomy="${item}">${item}</button>`).join('')}
      </div>
    </div>
  `).join('');
  $$('.anatomy-item').forEach((b) => b.addEventListener('click', () => navigateReference(b.dataset.anatomy)));
}

function navigateReference(name){
  const p = referencePositions[name.toLowerCase()] || [.5,.5,.5];
  if(state.kind === 'volume'){
    state.plane = 'axial';
    $$('#planeMode button').forEach((x) => x.classList.toggle('active', x.dataset.value === 'axial'));
    state.sliceT = p[2];
    els.slicePosition.value = Math.round(p[2] * 1000);
    els.sliceOut.textContent = Math.round(p[2] * 100) + '%';
    render();
    renderSlice();
  }
  showToast(`${name}: anatomical reference only — not detected in this scan`, 4200);
}

els.anatomySearch.addEventListener('keydown', (e) => {
  if(e.key !== 'Enter') return;
  const q = e.target.value.trim();
  if(!q) return;
  const all = Object.values(anatomyMaps[state.region] || anatomyMaps.UNKNOWN).flat();
  const hit = all.find((x) => x.toLowerCase() === q.toLowerCase()) || all.find((x) => x.toLowerCase().includes(q.toLowerCase()));
  if(hit) navigateReference(hit);
  else if(referencePositions[q.toLowerCase()]) navigateReference(q);
  else showToast(`No predefined reference match for “${q}”`, 3000);
});

function buildPointCloud(){
  if(!state.volume) return;
  const { data, w, h, d } = state.volume;
  const [sx, sy, sz] = state.spacing;
  const phys = [w*sx, h*sy, d*sz];
  const maxP = Math.max(...phys);
  const step = Math.max(1, Math.ceil(Math.cbrt((w*h*d) / 95000)));
  const pts = [];
  for(let z = 0; z < d; z += step){
    for(let y = 0; y < h; y += step){
      for(let x = 0; x < w; x += step){
        const v = data[(z*h + y) * w + x];
        if(v < 12) continue;
        const px = (x / Math.max(1, w-1) - .5) * phys[0] / maxP;
        const py = (y / Math.max(1, h-1) - .5) * phys[1] / maxP;
        const pz = (z / Math.max(1, d-1) - .5) * phys[2] / maxP;
        pts.push([px, py, pz, v/255]);
      }
    }
  }
  state.points = pts;
  render();
}

function adjusted(v){ return clamp((v - .5) * state.contrast + .5 + state.brightness / 255, 0, 1); }
function thermalRGBA(v, a=1){
  v = clamp(v, 0, 1);
  let r,g,b;
  if(v < .18){ const t = v/.18; r = 0; g = 28 + 30*t; b = 70 + 170*t; }
  else if(v < .42){ const t = (v-.18)/.24; r = 0; g = 58 + 176*t; b = 240 - 40*t; }
  else if(v < .68){ const t = (v-.42)/.26; r = 255*t; g = 234 + 21*t; b = 200*(1-t); }
  else { const t = (v-.68)/.32; r = 255; g = 255*(1-t*.92); b = 0; }
  return [r|0, g|0, b|0, a];
}
function thermal(v, a=1){ const c = thermalRGBA(v,a); return `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`; }
function colorRGB(v){
  if(state.color === 'gray'){ const q = Math.round(v * 255); return [q,q,q]; }
  const c = thermalRGBA(v, 1);
  return [c[0], c[1], c[2]];
}

function projectPoint(p, W, H){
  let [x,y,z] = p;
  const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY), cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
  const x1 = x*cy + z*sy;
  const z1 = -x*sy + z*cy;
  const y1 = y*cx - z1*sx;
  const z2 = y*sx + z1*cx;
  const scale = Math.min(W,H) * 1.22 * state.zoom;
  return [W/2 + state.panX + x1*scale, H/2 + state.panY + y1*scale, z2, scale];
}

function render(){
  const r = els.workspace.getBoundingClientRect();
  const W = r.width, H = r.height;
  if(!W || !H) return;
  ctx.fillStyle = getComputedStyle(els.app).getPropertyValue('--bg');
  ctx.fillRect(0,0,W,H);

  if(!state.kind){ renderParticles(W, H); return; }
  if(state.kind === '2d'){ render2DMain(W, H); return; }

  const cutoff = state.threshold;
  const step = Math.max(1, Math.round(1 / Math.max(.15, state.density)));
  const projected = [];
  for(let i = 0; i < state.points.length; i += step){
    const p = state.points[i];
    const v = adjusted(p[3]);
    if(v < cutoff) continue;
    const pr = projectPoint(p, W, H);
    if(pr[0] < -6 || pr[0] > W+6 || pr[1] < -6 || pr[1] > H+6) continue;
    projected.push([pr[2], pr[0], pr[1], v]);
  }
  projected.sort((a,b) => a[0] - b[0]);
  for(const item of projected){
    const v = item[3];
    const size = clamp(.8 + v * 2.0 * state.zoom, .7, 3.4);
    ctx.fillStyle = state.color === 'thermal' ? thermal(v, .18 + v * .58) : `rgba(${Math.round(v*255)},${Math.round(v*255)},${Math.round(v*255)},${.10 + v*.64})`;
    ctx.fillRect(item[1], item[2], size, size);
  }
  if(state.showPlane) drawCuttingPlane(W, H);
  if(state.showAxes) drawAxes(W, H);
  els.hudPosition.textContent = `${state.plane.toUpperCase()} · ${Math.round(state.sliceT*100)}%`;
}

function initParticles(){
  const count = 920;
  state.particles = [];
  for(let i = 0; i < count; i++){
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random());
    state.particles.push({
      baseX: Math.cos(ang) * rad,
      baseY: Math.sin(ang) * rad,
      driftX: 10 + Math.random() * 30,
      driftY: 8 + Math.random() * 24,
      speed: .12 + Math.random() * .45,
      speed2: .08 + Math.random() * .35,
      phase: Math.random() * Math.PI * 2,
      size: .6 + Math.random() * 1.9,
      alpha: .03 + Math.random() * .22,
      temp: Math.random()
    });
  }
}

function cancelParticles(){
  if(state.particleRAF){ cancelAnimationFrame(state.particleRAF); state.particleRAF = 0; }
}

function renderParticles(W, H){
  cancelParticles();
  if(!state.particles.length) initParticles();
  state.particleT += .007;
  const t = state.particleT;
  const cx = W/2, cy = H/2;
  const rx = Math.min(W, H) * .38;
  const ry = Math.min(W, H) * .26;

  const g1 = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(W,H) * .42);
  g1.addColorStop(0, state.color === 'thermal' ? 'rgba(255,92,62,.10)' : 'rgba(230,240,248,.05)');
  g1.addColorStop(.35, state.color === 'thermal' ? 'rgba(56,165,255,.11)' : 'rgba(120,140,150,.04)');
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0,0,W,H);

  for(const p of state.particles){
    const x = cx + p.baseX * rx + Math.sin(t * (1.1 + p.speed) + p.phase) * p.driftX + Math.cos(t * .33 + p.phase) * 8;
    const y = cy + p.baseY * ry + Math.cos(t * (1.0 + p.speed2) + p.phase * 1.4) * p.driftY + Math.sin(t * .27 + p.phase) * 7;
    const z = .5 + .5 * Math.sin(t * .8 + p.phase * 2.1);
    const alpha = p.alpha * (.45 + z * .9);
    const size = p.size * (.75 + z * .95);

    let fill;
    if(state.color === 'thermal' || p.temp > .72){
      const v = state.color === 'thermal' ? clamp(.25 + .65*p.temp, 0, 1) : clamp(.15 + .25*p.temp, 0, 1);
      fill = thermal(v, alpha);
    } else {
      const q = Math.round(145 + z * 70);
      fill = `rgba(${q},${q+10},${q+18},${alpha})`;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, size, size);
  }
  state.particleRAF = requestAnimationFrame(() => { if(!state.kind) render(); });
}

function render2DMain(W, H){
  const img = state.image2D;
  if(!img) return;
  const off = document.createElement('canvas');
  off.width = img.w; off.height = img.h;
  const ox = off.getContext('2d');
  const id = ox.createImageData(img.w, img.h);
  for(let i = 0; i < img.data.length; i++){
    const v = adjusted(img.data[i] / 255);
    const rgb = colorRGB(v);
    const j = i * 4;
    id.data[j] = rgb[0]; id.data[j+1] = rgb[1]; id.data[j+2] = rgb[2]; id.data[j+3] = 255;
  }
  ox.putImageData(id, 0, 0);
  const scale = Math.min(W / img.w, H / img.h) * .88 * state.zoom;
  const dw = img.w * scale, dh = img.h * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, W/2 - dw/2 + state.panX, H/2 - dh/2 + state.panY, dw, dh);
}

function planeCorners(){
  const t = state.sliceT - .5, s = .54;
  if(state.plane === 'axial') return [[-s,-s,t],[s,-s,t],[s,s,t],[-s,s,t]];
  if(state.plane === 'sagittal') return [[t,-s,-s],[t,s,-s],[t,s,s],[t,-s,s]];
  return [[-s,t,-s],[s,t,-s],[s,t,s],[-s,t,s]];
}

function drawCuttingPlane(W, H){
  const pts = planeCorners().map((p) => projectPoint(p, W, H));
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for(let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = state.color === 'thermal' ? 'rgba(56,165,255,.08)' : 'rgba(235,246,255,.05)';
  ctx.strokeStyle = state.color === 'thermal' ? 'rgba(56,165,255,.72)' : 'rgba(220,240,248,.48)';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();
}

function drawAxes(W, H){
  const O = projectPoint([0,0,0], W, H);
  const X = projectPoint([.68,0,0], W, H);
  const Y = projectPoint([0,.68,0], W, H);
  const Z = projectPoint([0,0,.68], W, H);
  const axes = [
    ['X', O, X, '#ff5b3c'],
    ['Y', O, Y, '#7dff8f'],
    ['Z', O, Z, '#38a5ff']
  ];
  ctx.save();
  ctx.font = '11px monospace';
  for(const [label, a, b, color] of axes){
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.fillRect(a[0]-1, a[1]-1, 3, 3);
    ctx.fillText(label, b[0] + 5, b[1] - 5);
  }
  ctx.restore();
}

function extractSlice(){
  if(state.kind === '2d') return { data: state.image2D.data, w: state.image2D.w, h: state.image2D.h, index: 0, total: 1, spacing: [state.spacing[0], state.spacing[1]] };
  const { data, w, h, d } = state.volume;
  if(state.plane === 'axial'){
    const z = Math.round(state.sliceT * (d - 1));
    return { data: data.subarray(z * w * h, (z + 1) * w * h), w, h, index: z, total: d, spacing: [state.spacing[0], state.spacing[1]] };
  }
  if(state.plane === 'sagittal'){
    const x = Math.round(state.sliceT * (w - 1));
    const out = new Uint8Array(d * h);
    for(let z = 0; z < d; z++) for(let y = 0; y < h; y++) out[y * d + z] = data[(z*h + y) * w + x];
    return { data: out, w: d, h, index: x, total: w, spacing: [state.spacing[2], state.spacing[1]] };
  }
  const y = Math.round(state.sliceT * (h - 1));
  const out = new Uint8Array(d * w);
  for(let z = 0; z < d; z++) for(let x = 0; x < w; x++) out[(d-1-z) * w + x] = data[(z*h + y) * w + x];
  return { data: out, w, h: d, index: y, total: h, spacing: [state.spacing[0], state.spacing[2]] };
}

function renderSlice(){
  if(!state.kind || els.sliceDock.classList.contains('hidden')) return;
  const s = extractSlice();
  const r = els.sliceCanvas.getBoundingClientRect();
  if(!r.width || !r.height) return;

  const off = document.createElement('canvas');
  off.width = s.w; off.height = s.h;
  const c = off.getContext('2d');
  const id = c.createImageData(s.w, s.h);
  for(let i = 0; i < s.data.length; i++){
    const v = adjusted(s.data[i] / 255);
    const rgb = colorRGB(v);
    const j = i * 4;
    id.data[j] = rgb[0]; id.data[j+1] = rgb[1]; id.data[j+2] = rgb[2]; id.data[j+3] = 255;
  }
  c.putImageData(id, 0, 0);

  sliceCtx.clearRect(0,0,r.width,r.height);
  sliceCtx.fillStyle = '#000';
  sliceCtx.fillRect(0,0,r.width,r.height);
  const scale = Math.min(r.width / s.w, r.height / s.h);
  const dw = s.w * scale, dh = s.h * scale;
  const dx = (r.width - dw) / 2, dy = (r.height - dh) / 2;
  s._display = { dx, dy, dw, dh, scale };
  state.currentSlice = s;
  sliceCtx.imageSmoothingEnabled = true;
  sliceCtx.drawImage(off, dx, dy, dw, dh);
  els.sliceTitle.textContent = state.kind === '2d' ? '2D IMAGE' : state.plane.toUpperCase() + ' SLICE';
  els.sliceIndexLabel.textContent = state.kind === '2d' ? `${s.w} × ${s.h}` : `${s.index + 1} / ${s.total}`;
  renderOverlay();
}

function renderOverlay(){
  const r = els.sliceOverlay.getBoundingClientRect();
  overlayCtx.clearRect(0,0,r.width,r.height);
  const s = state.currentSlice;
  if(!s || !s._display) return;
  const d = s._display;
  overlayCtx.lineWidth = 1;
  for(const m of state.measures){
    overlayCtx.strokeStyle = '#ff4a39';
    overlayCtx.fillStyle = '#ff4a39';
    overlayCtx.beginPath();
    overlayCtx.moveTo(d.dx + m.a[0]*d.dw, d.dy + m.a[1]*d.dh);
    overlayCtx.lineTo(d.dx + m.b[0]*d.dw, d.dy + m.b[1]*d.dh);
    overlayCtx.stroke();
    const mx = d.dx + (m.a[0] + m.b[0]) * d.dw / 2;
    const my = d.dy + (m.a[1] + m.b[1]) * d.dh / 2;
    overlayCtx.font = '9px monospace';
    overlayCtx.fillText(m.label, mx + 4, my - 4);
  }
  for(const m of state.markers){
    const x = d.dx + m.p[0] * d.dw, y = d.dy + m.p[1] * d.dh;
    overlayCtx.strokeStyle = '#65ff9b';
    overlayCtx.beginPath(); overlayCtx.arc(x, y, 5, 0, Math.PI * 2); overlayCtx.stroke();
    overlayCtx.beginPath(); overlayCtx.moveTo(x-8, y); overlayCtx.lineTo(x+8, y); overlayCtx.moveTo(x, y-8); overlayCtx.lineTo(x, y+8); overlayCtx.stroke();
  }
  if(state.measureStart){
    const x = d.dx + state.measureStart[0] * d.dw, y = d.dy + state.measureStart[1] * d.dh;
    overlayCtx.fillStyle = '#ff4a39';
    overlayCtx.fillRect(x-2, y-2, 4, 4);
  }
}

function sliceNormPoint(ev){
  const s = state.currentSlice, d = s?._display;
  if(!d) return null;
  const r = els.sliceOverlay.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  if(x < d.dx || x > d.dx + d.dw || y < d.dy || y > d.dy + d.dh) return null;
  return [(x - d.dx) / d.dw, (y - d.dy) / d.dh];
}

els.sliceOverlay.addEventListener('click', (e) => {
  const p = sliceNormPoint(e);
  if(!p || !state.tool) return;
  if(state.tool === 'marker'){
    state.markers.push({ p });
    els.readout.textContent = `MARKER ${state.markers.length} · REFERENCE ONLY`;
    renderOverlay();
    return;
  }
  if(state.tool === 'measure'){
    if(!state.measureStart){
      state.measureStart = p;
      els.readout.textContent = 'SELECT SECOND POINT';
      renderOverlay();
    } else {
      const a = state.measureStart, b = p, s = state.currentSlice;
      const dx = (b[0] - a[0]) * s.w * s.spacing[0];
      const dy = (b[1] - a[1]) * s.h * s.spacing[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      state.measures.push({ a, b, label: `${dist.toFixed(1)} mm` });
      state.measureStart = null;
      els.readout.textContent = `DISTANCE ${dist.toFixed(1)} mm · IMAGE-SPACE MEASUREMENT`;
      renderOverlay();
    }
  }
});

els.canvas.addEventListener('pointerdown', (e) => {
  if(!state.kind) return;
  state.dragging = true;
  state.dragMode = (e.shiftKey || state.kind === '2d') ? 'pan' : 'rotate';
  state.lastX = e.clientX; state.lastY = e.clientY;
  els.canvas.setPointerCapture(e.pointerId);
});
els.canvas.addEventListener('pointermove', (e) => {
  if(!state.dragging) return;
  const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
  state.lastX = e.clientX; state.lastY = e.clientY;
  if(state.dragMode === 'pan' || state.kind === '2d'){
    state.panX += dx; state.panY += dy;
  } else {
    state.rotY += dx * .008; state.rotX += dy * .008;
  }
  render();
});
els.canvas.addEventListener('pointerup', () => state.dragging = false);
els.canvas.addEventListener('wheel', (e) => {
  if(!state.kind) return;
  e.preventDefault();
  state.zoom = clamp(state.zoom * (e.deltaY > 0 ? .92 : 1.08), .35, 3.5);
  render();
}, { passive:false });

resizeAll();
render();

})();
