let coreInit, RenderingEngine, Enums, volumeLoader, imageLoader, metaData, addVolumesToViewports, setVolumesForViewports, utilities, cache;
let dicomLoaderInit, wadouri;
let toolsInit, addTool, ToolGroupManager, csToolsEnums, LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool, annotation;
let dicomParser, unzipSync;
let modulesLoaded = false;

async function loadImagingModules(){
  if(modulesLoaded) return;
  const [core, dicomLoader, tools, dicomParserModule, fflate] = await Promise.all([
    import('@cornerstonejs/core'),
    import('@cornerstonejs/dicom-image-loader'),
    import('@cornerstonejs/tools'),
    import('dicom-parser'),
    import('fflate'),
  ]);

  ({
    init: coreInit,
    RenderingEngine,
    Enums,
    volumeLoader,
    imageLoader,
    metaData,
    addVolumesToViewports,
    setVolumesForViewports,
    utilities,
    cache,
  } = core);

  ({ init: dicomLoaderInit, wadouri } = dicomLoader);

  ({
    init: toolsInit,
    addTool,
    ToolGroupManager,
    Enums: csToolsEnums,
    LengthTool,
    ArrowAnnotateTool,
    PanTool,
    ZoomTool,
    StackScrollTool,
    TrackballRotateTool,
    annotation,
  } = tools);

  dicomParser = dicomParserModule.default || dicomParserModule;
  unzipSync = fflate.unzipSync;

  const required = {
    coreInit, RenderingEngine, Enums, volumeLoader, imageLoader, metaData,
    dicomLoaderInit, wadouri, toolsInit, addTool, ToolGroupManager,
    LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool,
    TrackballRotateTool, annotation, dicomParser, unzipSync,
  };
  const missing = Object.entries(required).filter(([,value]) => !value).map(([name]) => name);
  if(missing.length){
    throw new Error(`Medical imaging engine API mismatch: ${missing.join(', ')}`);
  }
  modulesLoaded = true;
}


const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const els = {
  app: $('#app'),
  workspace: $('.workspace'),
  dustCanvas: $('#dustCanvas'),
  volumeViewport: $('#volumeViewport'),
  sliceViewport: $('#sliceViewport'),
  sliceDock: $('#sliceDock'),
  emptyState: $('#emptyState'),
  loading: $('#loading'),
  loadingLabel: $('#loadingText'),
  selectFiles: $('#selectFiles'),
  selectFolder: $('#selectFolder'),
  fileInput: $('#fileInput'),
  folderInput: $('#folderInput'),
  studyType: $('#studyType'),
  studyRegion: $('#studyRegion'),
  confidenceLabel: $('#regionConfidence'),
  metadataList: $('#metadataList'),
  anatomyTree: $('#anatomyTree'),
  anatomySearch: $('#anatomySearch'),
  anatomyResults: $('#anatomyResults'),
  anatomySelection: $('#anatomySelection'),
  selectedAnatomy: $('#selectedAnatomy'),
  selectionMode: $('#selectionMode'),
  selectionDetail: $('#selectionDetail'),
  focusAnatomy: $('#focusAnatomy'),
  isolateAnatomy: $('#isolateAnatomy'),
  resetIsolation: $('#resetIsolation'),
  notice: $('#modeNotice'),
  toast: $('#toast'),
  hud: $('#hud'),
  hudMode: $('#hudMode'),
  hudDims: $('#hudDims'),
  hudPosition: $('#hudStatus'),
  contrast: $('#contrast'),
  brightness: $('#brightness'),
  threshold: $('#threshold'),
  density: $('#density'),
  opacity: $('#opacity'),
  contrastOut: $('#contrastOut'),
  brightnessOut: $('#brightnessOut'),
  thresholdOut: $('#thresholdOut'),
  densityOut: $('#densityOut'),
  opacityOut: $('#opacityOut'),
  slicePosition: $('#slicePosition'),
  sliceOut: $('#sliceOut'),
  sliceTitle: $('#sliceTitle'),
  sliceIndexLabel: $('#sliceCounter'),
  swapViews: $('#swapViews'),
  minimizeSlice: $('#minimizeSlice'),
  measureReadout: $('#toolStatus'),
  splicerToggle: $('#splicerToggle'),
  axisToggle: $('#axisToggle'),
  measureTool: $('#measureTool'),
  markerTool: $('#markerTool'),
  resetView: $('#resetView'),
  clearTools: $('#clearTools'),
  worldOverlay: $('#worldOverlay'),
  splicePlane: $('#splicePlane'),
  axisGroup: $('#axisGroup'),
  axisX: $('#axisX'), axisY: $('#axisY'), axisZ: $('#axisZ'),
  axisXLabel: $('#axisXLabel'), axisYLabel: $('#axisYLabel'), axisZLabel: $('#axisZLabel'),
  anatomyFocusGroup: $('#anatomyFocusGroup'), anatomyFocusLabel: $('#anatomyFocusLabel'),
};

const VIEWPORT_MAIN = 'SCANSPACE_MAIN';
const VIEWPORT_SLICE = 'SCANSPACE_SLICE';
const TOOLGROUP_MAIN = 'SCANSPACE_MAIN_TOOLS';
const TOOLGROUP_SLICE = 'SCANSPACE_SLICE_TOOLS';
const TOOLGROUP_STACK = 'SCANSPACE_STACK_TOOLS';

const state = {
  initialized: false,
  engine: null,
  volumeId: null,
  volume: null,
  mode: null, // volume | stack
  stackImageIds: [],
  seriesMeta: null,
  modality: '—',
  region: 'UNKNOWN',
  regionConfidence: '—',
  scalarRange: [0, 255],
  voiRange: null,
  colorMode: 'gray',
  contrast: 1,
  brightness: 0,
  threshold: .18,
  density: .80,
  interactiveQuality: false,
  qualityRestoreTimer: 0,
  visualRAF: 0,
  sliceJumpTimer: 0,
  opacity: .92,
  plane: 'axial',
  showPlane: true,
  showAxes: true,
  activeTool: null,
  toastTimer: null,
  dustRAF: 0,
  dustT: 0,
  dust: [],
  overlayRAF: 0,
  loadToken: 0,
  imageGeometry: null,
  selectedAnatomy: null,
  selectedAnatomyWorld: null,
  isolationActive: false,
  isolationBounds: null,
  slicePrimary: false,
  sliceMinimized: false,
};

const ANATOMY_CATALOG = [
  // Brain / cranial
  {name:'Brain',group:'CRANIAL',regions:['BRAIN','SKULL'],aliases:['cerebrum','intracranial'],center:[.50,.49,.53],size:[.64,.70,.68]},
  {name:'Frontal lobe',group:'BRAIN LOBES',regions:['BRAIN'],aliases:['frontal cortex'],center:[.50,.34,.63],size:[.52,.34,.40]},
  {name:'Parietal lobe',group:'BRAIN LOBES',regions:['BRAIN'],aliases:['parietal cortex'],center:[.50,.43,.76],size:[.54,.34,.32]},
  {name:'Temporal lobes',group:'BRAIN LOBES',regions:['BRAIN'],aliases:['temporal lobe'],center:[.50,.58,.50],size:[.74,.32,.34]},
  {name:'Occipital lobe',group:'BRAIN LOBES',regions:['BRAIN'],aliases:['occipital cortex'],center:[.50,.69,.55],size:[.48,.26,.34]},
  {name:'Ventricles',group:'CRANIAL',regions:['BRAIN'],aliases:['lateral ventricles','ventricular system'],center:[.50,.48,.53],size:[.24,.25,.24]},
  {name:'Cerebellum',group:'CRANIAL',regions:['BRAIN','SKULL'],aliases:['posterior fossa'],center:[.50,.70,.30],size:[.44,.30,.28]},
  {name:'Brainstem',group:'CRANIAL',regions:['BRAIN','SKULL'],aliases:['brain stem','pons','medulla'],center:[.50,.61,.35],size:[.20,.28,.32]},
  {name:'Pituitary region',group:'CRANIAL',regions:['BRAIN','SKULL'],aliases:['pituitary','sella','sella turcica'],center:[.50,.54,.49],size:[.16,.15,.14]},
  {name:'Circle of Willis',group:'VASCULAR',regions:['BRAIN'],aliases:['willis circle','intracranial arteries'],center:[.50,.53,.46],size:[.26,.22,.16]},
  {name:'Skull',group:'CRANIAL',regions:['BRAIN','SKULL'],aliases:['calvarium','cranium'],center:[.50,.50,.52],size:[.94,.94,.94]},
  {name:'Orbits',group:'FACIAL',regions:['SKULL','BRAIN'],aliases:['eye sockets','orbit'],center:[.50,.35,.55],size:[.55,.24,.22]},
  {name:'Sinuses',group:'FACIAL',regions:['SKULL','BRAIN'],aliases:['paranasal sinuses','frontal sinus','maxillary sinus'],center:[.50,.39,.45],size:[.54,.32,.34]},
  {name:'Nasal cavity',group:'FACIAL',regions:['SKULL'],aliases:['nose cavity'],center:[.50,.43,.38],size:[.22,.26,.30]},
  {name:'Mandible',group:'DENTAL',regions:['SKULL'],aliases:['lower jaw','jawbone'],center:[.50,.64,.23],size:[.66,.31,.26]},
  {name:'Maxilla',group:'DENTAL',regions:['SKULL'],aliases:['upper jaw'],center:[.50,.48,.39],size:[.58,.28,.22]},
  {name:'Teeth',group:'DENTAL',regions:['SKULL'],aliases:['dentition','tooth'],center:[.50,.58,.32],size:[.62,.25,.20]},

  // Cervical neck
  {name:'C1',group:'CERVICAL SPINE',regions:['NECK','SKULL'],aliases:['atlas','c1 vertebra'],center:[.50,.51,.84],size:[.30,.25,.12]},
  {name:'C2',group:'CERVICAL SPINE',regions:['NECK','SKULL'],aliases:['axis','c2 vertebra'],center:[.50,.51,.75],size:[.30,.25,.12]},
  {name:'C3',group:'CERVICAL SPINE',regions:['NECK'],aliases:['c3 vertebra'],center:[.50,.51,.65],size:[.30,.25,.12]},
  {name:'C4',group:'CERVICAL SPINE',regions:['NECK'],aliases:['c4 vertebra'],center:[.50,.51,.55],size:[.30,.25,.12]},
  {name:'C5',group:'CERVICAL SPINE',regions:['NECK'],aliases:['c5 vertebra'],center:[.50,.51,.45],size:[.30,.25,.12]},
  {name:'C6',group:'CERVICAL SPINE',regions:['NECK'],aliases:['c6 vertebra'],center:[.50,.51,.35],size:[.30,.25,.12]},
  {name:'C7',group:'CERVICAL SPINE',regions:['NECK'],aliases:['c7 vertebra','vertebra prominens'],center:[.50,.51,.24],size:[.32,.27,.13]},
  {name:'Cervical spinal canal',group:'CERVICAL SPINE',regions:['NECK'],aliases:['spinal canal','cervical canal'],center:[.50,.53,.51],size:[.18,.20,.72]},
  {name:'Thyroid',group:'SOFT TISSUE',regions:['NECK'],aliases:['thyroid gland'],center:[.50,.52,.37],size:[.42,.24,.24]},
  {name:'Trachea',group:'AIRWAY',regions:['NECK','CHEST'],aliases:['windpipe','airway'],center:[.50,.46,.52],size:[.18,.18,.70]},
  {name:'Esophagus',group:'SOFT TISSUE',regions:['NECK','CHEST'],aliases:['oesophagus'],center:[.50,.56,.50],size:[.16,.16,.68]},
  {name:'Carotid arteries',group:'VASCULAR',regions:['NECK'],aliases:['carotids','common carotid','internal carotid'],center:[.50,.49,.52],size:[.56,.26,.76]},
  {name:'Jugular veins',group:'VASCULAR',regions:['NECK'],aliases:['jugulars','internal jugular vein'],center:[.50,.48,.52],size:[.66,.28,.76]},

  // Chest / thorax
  {name:'Lungs',group:'THORACIC',regions:['CHEST'],aliases:['lung','pulmonary'],center:[.50,.46,.55],size:[.90,.68,.78]},
  {name:'Right lung',group:'THORACIC',regions:['CHEST'],aliases:['right pulmonary'],center:[.66,.45,.55],size:[.40,.64,.76]},
  {name:'Left lung',group:'THORACIC',regions:['CHEST'],aliases:['left pulmonary'],center:[.34,.45,.55],size:[.40,.64,.76]},
  {name:'Heart',group:'THORACIC',regions:['CHEST'],aliases:['cardiac','myocardium'],center:[.47,.58,.44],size:[.46,.42,.42]},
  {name:'Aorta',group:'VASCULAR',regions:['CHEST','ABDOMEN'],aliases:['aortic arch','descending aorta','abdominal aorta'],center:[.50,.52,.50],size:[.24,.26,.78]},
  {name:'Pulmonary arteries',group:'VASCULAR',regions:['CHEST'],aliases:['pulmonary artery','pulmonary vessels'],center:[.50,.50,.50],size:[.52,.32,.30]},
  {name:'Superior vena cava',group:'VASCULAR',regions:['CHEST'],aliases:['svc'],center:[.42,.47,.66],size:[.18,.18,.34]},
  {name:'Inferior vena cava',group:'VASCULAR',regions:['CHEST','ABDOMEN'],aliases:['ivc'],center:[.43,.52,.45],size:[.18,.18,.72]},
  {name:'Sternum',group:'SKELETAL',regions:['CHEST'],aliases:['breastbone'],center:[.50,.25,.50],size:[.22,.16,.72]},
  {name:'Ribs',group:'SKELETAL',regions:['CHEST'],aliases:['rib cage','costal'],center:[.50,.47,.53],size:[.96,.82,.82]},
  {name:'Thoracic spine',group:'SKELETAL',regions:['CHEST'],aliases:['t spine','thoracic vertebrae'],center:[.50,.73,.50],size:[.26,.22,.84]},
  {name:'LAD coronary artery',group:'CORONARY',regions:['CHEST'],aliases:['lad','left anterior descending','anterior interventricular artery'],center:[.48,.55,.47],size:[.22,.22,.28]},

  // Abdomen
  {name:'Liver',group:'ABDOMINAL',regions:['ABDOMEN'],aliases:['hepatic','hepatic parenchyma'],center:[.68,.46,.60],size:[.52,.48,.48]},
  {name:'Spleen',group:'ABDOMINAL',regions:['ABDOMEN'],aliases:['splenic'],center:[.25,.43,.60],size:[.28,.28,.36]},
  {name:'Stomach',group:'ABDOMINAL',regions:['ABDOMEN'],aliases:['gastric'],center:[.42,.47,.58],size:[.36,.34,.32]},
  {name:'Pancreas',group:'ABDOMINAL',regions:['ABDOMEN'],aliases:['pancreatic'],center:[.47,.52,.51],size:[.46,.20,.18]},
  {name:'Gallbladder',group:'ABDOMINAL',regions:['ABDOMEN'],aliases:['gall bladder','biliary'],center:[.62,.52,.54],size:[.18,.18,.20]},
  {name:'Small intestine',group:'BOWEL',regions:['ABDOMEN'],aliases:['small bowel','jejunum','ileum'],center:[.50,.60,.39],size:[.64,.58,.52]},
  {name:'Colon',group:'BOWEL',regions:['ABDOMEN','PELVIS'],aliases:['large bowel','large intestine'],center:[.50,.58,.42],size:[.80,.62,.62]},
  {name:'Appendix',group:'BOWEL',regions:['ABDOMEN','PELVIS'],aliases:['vermiform appendix'],center:[.68,.68,.24],size:[.22,.22,.24]},
  {name:'Right kidney',group:'URINARY',regions:['ABDOMEN'],aliases:['right renal','kidney right'],center:[.69,.54,.47],size:[.28,.26,.36]},
  {name:'Left kidney',group:'URINARY',regions:['ABDOMEN'],aliases:['left renal','kidney left'],center:[.29,.52,.49],size:[.28,.26,.36]},
  {name:'Kidneys',group:'URINARY',regions:['ABDOMEN'],aliases:['renal','both kidneys'],center:[.50,.53,.49],size:[.72,.30,.40]},
  {name:'Adrenal glands',group:'ENDOCRINE',regions:['ABDOMEN'],aliases:['adrenals','suprarenal glands'],center:[.50,.48,.62],size:[.64,.22,.22]},
  {name:'Abdominal aorta',group:'VASCULAR',regions:['ABDOMEN'],aliases:['aorta abdomen'],center:[.50,.50,.48],size:[.17,.18,.68]},
  {name:'Lumbar spine',group:'SKELETAL',regions:['ABDOMEN','PELVIS'],aliases:['l spine','lumbar vertebrae'],center:[.50,.74,.46],size:[.28,.24,.70]},

  // Pelvis
  {name:'Bladder',group:'PELVIC',regions:['PELVIS','ABDOMEN'],aliases:['urinary bladder'],center:[.50,.62,.25],size:[.38,.34,.34]},
  {name:'Rectum',group:'PELVIC',regions:['PELVIS'],aliases:['rectal'],center:[.50,.68,.32],size:[.22,.22,.42]},
  {name:'Sacrum',group:'SKELETAL',regions:['PELVIS'],aliases:['sacral spine'],center:[.50,.71,.47],size:[.34,.26,.52]},
  {name:'Pelvis',group:'SKELETAL',regions:['PELVIS'],aliases:['pelvic bones','bony pelvis'],center:[.50,.52,.49],size:[.94,.72,.72]},
  {name:'Hip joints',group:'SKELETAL',regions:['PELVIS','EXTREMITY'],aliases:['hips','acetabulum','femoral heads'],center:[.50,.58,.43],size:[.92,.38,.36]},
  {name:'Iliac vessels',group:'VASCULAR',regions:['PELVIS'],aliases:['iliac arteries','iliac veins'],center:[.50,.50,.42],size:[.68,.26,.48]},
  {name:'Prostate region',group:'PELVIC',regions:['PELVIS'],aliases:['prostate'],center:[.50,.60,.30],size:[.28,.24,.22]},
  {name:'Uterine region',group:'PELVIC',regions:['PELVIS'],aliases:['uterus','uterine'],center:[.50,.58,.38],size:[.34,.30,.30]},

  // Extremity general
  {name:'Bone',group:'SKELETAL',regions:['EXTREMITY'],aliases:['cortex','cortical bone'],center:[.50,.50,.50],size:[.46,.46,.88]},
  {name:'Joint',group:'SKELETAL',regions:['EXTREMITY'],aliases:['articulation'],center:[.50,.50,.50],size:[.62,.62,.40]},
  {name:'Muscle',group:'SOFT TISSUE',regions:['EXTREMITY'],aliases:['musculature'],center:[.50,.50,.50],size:[.86,.86,.84]},
  {name:'Tendon',group:'SOFT TISSUE',regions:['EXTREMITY'],aliases:['tendons'],center:[.50,.50,.50],size:[.46,.46,.70]},

  // Generic navigators
  {name:'Center of study',group:'REFERENCE',regions:['UNKNOWN'],aliases:['center','middle'],center:[.50,.50,.50],size:[.40,.40,.40]},
  {name:'Superior',group:'REFERENCE',regions:['UNKNOWN'],aliases:['top','cranial'],center:[.50,.50,.82],size:[.65,.65,.25]},
  {name:'Inferior',group:'REFERENCE',regions:['UNKNOWN'],aliases:['bottom','caudal'],center:[.50,.50,.18],size:[.65,.65,.25]},
  {name:'Left',group:'REFERENCE',regions:['UNKNOWN'],aliases:['left side'],center:[.25,.50,.50],size:[.36,.70,.70]},
  {name:'Right',group:'REFERENCE',regions:['UNKNOWN'],aliases:['right side'],center:[.75,.50,.50],size:[.36,.70,.70]},
];

const anatomyByName = new Map();
for(const item of ANATOMY_CATALOG){
  anatomyByName.set(item.name.toLowerCase(), item);
  for(const alias of item.aliases || []) anatomyByName.set(alias.toLowerCase(), item);
}


const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const mul = (a,s) => [a[0]*s, a[1]*s, a[2]*s];
const norm = (a) => { const m=Math.hypot(...a)||1; return a.map(v=>v/m); };

function showToast(msg, ms=3600){
  clearTimeout(state.toastTimer);
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  state.toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}
function setNotice(msg){
  els.notice.textContent = msg || '';
  els.notice.classList.toggle('hidden', !msg);
}
function showLoading(label){
  els.loadingLabel.textContent = label;
  els.loading.classList.remove('hidden');
}
function setLoading(label){ els.loadingLabel.textContent = label; }
function hideLoading(){ els.loading.classList.add('hidden'); }

async function initialize(){
  if(state.initialized) return;
  showLoading('INITIALIZING MEDICAL IMAGING ENGINE');
  await loadImagingModules();
  await coreInit();
  await dicomLoaderInit({
    // Local files are registered through wadouri.fileManager.add(), which
    // produces dicomfile: imageIds. Cornerstone 5.8 defaults to the new
    // NATURALIZED metadata path; that path expects the metadata cache to be
    // populated with pixel data first and therefore fails for these local
    // fileManager imageIds with "no pixel data in NATURALIZED". Bind the
    // dicomfile scheme to the proven wadouri dataset loader instead.
    useLegacyMetadataProvider: true,
    maxWebWorkers: Math.max(1, Math.min(8, Math.floor((navigator.hardwareConcurrency || 4) / 2))),
  });
  await toolsInit();

  [LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool].forEach((tool) => {
    try { addTool(tool); } catch (_) { /* tool may already be registered after hot reload */ }
  });

  registerWebImageLoader();
  state.engine = new RenderingEngine('SCANSPACE_RENDERING_ENGINE');
  state.initialized = true;
  hideLoading();
  startDust();
}

function destroyToolGroup(id){
  try { ToolGroupManager.destroyToolGroup(id); } catch (_) {}
}
function resetRuntime(){
  state.loadToken++;
  stopOverlayLoop();
  destroyToolGroup(TOOLGROUP_MAIN);
  destroyToolGroup(TOOLGROUP_SLICE);
  destroyToolGroup(TOOLGROUP_STACK);
  state.activeTool = null;
  els.measureTool.classList.remove('active');
  els.markerTool.classList.remove('active');
  try { state.engine.disableElement(VIEWPORT_MAIN); } catch (_) {}
  try { state.engine.disableElement(VIEWPORT_SLICE); } catch (_) {}
  try { cache.purgeCache(); } catch (_) {}
  try { wadouri.fileManager.purge(); } catch (_) {}
  state.volumeId = null;
  state.volume = null;
  state.stackImageIds = [];
  state.imageGeometry = null;
  state.selectedAnatomy = null;
  state.selectedAnatomyWorld = null;
  state.isolationActive = false;
  state.isolationBounds = null;
  state.slicePrimary = false;
  state.sliceMinimized = false;
  els.workspace.classList.remove('slice-primary','slice-minimized');
  els.anatomySelection.classList.add('hidden');
  els.anatomyResults.classList.add('hidden');
  els.anatomySearch.value = '';
  annotation.state.removeAllAnnotations();
}

async function handleFiles(files){
  if(!files?.length) return;
  showLoading(`SELECTED ${files.length} FILE${files.length === 1 ? '' : 'S'} · INITIALIZING ENGINE`);
  try {
    await initialize();
    resetRuntime();
    showLoading('READING FILES LOCALLY');
    const expanded = await expandArchives(files);
    const dicomCandidates = [];
    const webImages = [];

    for(const file of expanded){
      if(isOrdinaryImage(file)) webImages.push(file);
      else if(await looksLikeDicom(file)) dicomCandidates.push(file);
    }

    if(dicomCandidates.length){
      await loadDicomStudy(dicomCandidates);
    } else if(webImages.length === 1){
      await loadWebImage(webImages[0]);
    } else if(webImages.length > 1){
      throw new Error('Multiple ordinary image files do not contain medical slice geometry. Load DICOM files for a reconstructable volume.');
    } else {
      throw new Error('No readable DICOM, ZIP-contained DICOM, PNG, or JPEG images were found.');
    }
  } catch (err) {
    console.error(err);
    hideLoading();
    setNotice('The selected study could not be opened. Nothing was uploaded to a server.');
    showToast(err?.message || 'Unable to open study', 7000);
    returnToEmpty();
  }
}

async function expandArchives(files){
  const out = [];
  for(const f of files){
    if(/\.zip$/i.test(f.name) || /zip/i.test(f.type || '')){
      setLoading(`UNPACKING ${f.name} LOCALLY`);
      const bytes = new Uint8Array(await f.arrayBuffer());
      let entries;
      try { entries = unzipSync(bytes); }
      catch (e) { throw new Error(`Could not unpack ZIP archive “${f.name}”.`); }
      for(const [name, data] of Object.entries(entries)){
        if(name.endsWith('/') || /^__MACOSX\//.test(name) || /\.(DS_Store|txt|json|xml)$/i.test(name)) continue;
        out.push(new File([data], name, { type: mimeFromName(name) }));
      }
    } else out.push(f);
  }
  return out;
}

function mimeFromName(name){
  if(/\.png$/i.test(name)) return 'image/png';
  if(/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if(/\.webp$/i.test(name)) return 'image/webp';
  if(/\.(dcm|dicom)$/i.test(name)) return 'application/dicom';
  return 'application/octet-stream';
}
function isOrdinaryImage(f){ return /^image\//.test(f.type || '') || /\.(png|jpe?g|webp)$/i.test(f.name || ''); }
async function looksLikeDicom(file){
  if(/\.(dcm|dicom)$/i.test(file.name || '') || file.type === 'application/dicom') return true;
  try {
    const buf = await file.slice(0, 140).arrayBuffer();
    const u8 = new Uint8Array(buf);
    if(u8.length >= 132 && String.fromCharCode(...u8.slice(128,132)) === 'DICM') return true;
    if(!isOrdinaryImage(file) && !(file.name || '').includes('.')) return true;
  } catch (_) {}
  return false;
}

function parseDicomMeta(file, bytes){
  const ds = dicomParser.parseDicom(bytes, { untilTag: 'x7fe00010' });
  const str = (tag) => { try { return ds.string(tag) || ''; } catch (_) { return ''; } };
  const int = (tag) => { const v = Number(str(tag)); return Number.isFinite(v) ? v : 0; };
  const nums = (tag) => str(tag).split('\\').map(Number).filter(Number.isFinite);
  const rows = ds.uint16?.('x00280010') || int('x00280010');
  const cols = ds.uint16?.('x00280011') || int('x00280011');
  const numberOfFrames = Math.max(1, int('x00280008') || 1);
  return {
    file, ds,
    modality: str('x00080060') || 'DICOM',
    body: str('x00180015'),
    studyDesc: str('x00081030'),
    seriesDesc: str('x0008103e'),
    seriesUID: str('x0020000e') || 'UNKNOWN_SERIES',
    instance: int('x00200013'),
    position: nums('x00200032'),
    orientation: nums('x00200037'),
    pixelSpacing: nums('x00280030'),
    sliceThickness: Number(str('x00180050')) || 0,
    spacingBetween: Number(str('x00180088')) || 0,
    rows, cols, numberOfFrames,
  };
}

async function loadDicomStudy(files){
  setLoading(`PARSING ${files.length} DICOM FILE${files.length === 1 ? '' : 'S'}`);
  const parsed = [];
  for(let i=0;i<files.length;i++){
    try {
      const bytes = new Uint8Array(await files[i].arrayBuffer());
      parsed.push(parseDicomMeta(files[i], bytes));
    } catch (e) {
      console.warn('Skipped non-DICOM/unreadable file', files[i].name, e);
    }
  }
  if(!parsed.length) throw new Error('No valid DICOM instances were found.');

  const groups = new Map();
  for(const p of parsed){
    if(!groups.has(p.seriesUID)) groups.set(p.seriesUID, []);
    groups.get(p.seriesUID).push(p);
  }
  const allSeries = [...groups.values()].sort((a,b) => totalFrames(b) - totalFrames(a));
  const series = allSeries[0];
  if(allSeries.length > 1) showToast(`Multiple DICOM series found. Loaded the largest (${totalFrames(series)} frames).`, 5000);

  orderSeries(series);
  const imageIds = [];
  const metadataByImageId = new Map();
  for(const item of series){
    const base = wadouri.fileManager.add(item.file);
    if(item.numberOfFrames > 1){
      for(let frame=1; frame<=item.numberOfFrames; frame++){
        const id = `${base}?frame=${frame}`;
        imageIds.push(id);
        metadataByImageId.set(id, item);
      }
    } else {
      imageIds.push(base);
      metadataByImageId.set(base, item);
    }
  }

  setLoading(`DECODING ${imageIds.length} FRAME${imageIds.length === 1 ? '' : 'S'}`);
  const sampleImages = await preloadImages(imageIds);
  const firstImage = sampleImages.find(Boolean) || await imageLoader.loadAndCacheImage(imageIds[0]);
  const firstMeta = series[0];
  state.seriesMeta = firstMeta;
  state.modality = firstMeta.modality;
  const reg = inferRegion(firstMeta);
  state.region = reg.region;
  state.regionConfidence = reg.confidence;
  deriveScalarAndVOI(sampleImages, firstImage);

  if(imageIds.length > 1){
    await configureVolume(imageIds, firstImage, firstMeta);
  } else {
    await configureStack(imageIds, firstImage, firstMeta);
  }
}

function totalFrames(series){ return series.reduce((s,x) => s + Math.max(1,x.numberOfFrames||1), 0); }
function orderSeries(series){
  const ori = series.find(s => s.orientation?.length === 6)?.orientation;
  const normal = ori ? cross(ori.slice(0,3), ori.slice(3,6)) : null;
  series.forEach((s,i) => {
    s._order = normal && s.position?.length === 3 ? dot(s.position, normal) : (s.position?.[2] ?? s.instance ?? i);
  });
  series.sort((a,b) => a._order - b._order);
}

async function preloadImages(imageIds){
  const results = new Array(imageIds.length);
  let cursor = 0;
  const workers = Math.min(6, imageIds.length);
  async function work(){
    while(true){
      const i = cursor++;
      if(i >= imageIds.length) return;
      try { results[i] = await imageLoader.loadAndCacheImage(imageIds[i]); }
      catch (e) { console.warn('Frame decode failed', imageIds[i], e); }
      if(i % 10 === 0) setLoading(`DECODING FRAMES · ${Math.min(i+1,imageIds.length)} / ${imageIds.length}`);
    }
  }
  await Promise.all(Array.from({length:workers}, work));
  const decoded = results.filter(Boolean).length;
  if(!decoded) throw new Error('The DICOM decoder could not decode this study.');
  return results;
}

function deriveScalarAndVOI(images, firstImage){
  let min = Infinity, max = -Infinity;
  for(const im of images){
    if(!im) continue;
    if(Number.isFinite(im.minPixelValue)) min = Math.min(min, im.minPixelValue);
    if(Number.isFinite(im.maxPixelValue)) max = Math.max(max, im.maxPixelValue);
  }
  if(!(max > min)){ min = Number(firstImage.minPixelValue ?? 0); max = Number(firstImage.maxPixelValue ?? 255); }
  state.scalarRange = [min, max];
  const wc = Array.isArray(firstImage.windowCenter) ? firstImage.windowCenter[0] : firstImage.windowCenter;
  const ww = Array.isArray(firstImage.windowWidth) ? firstImage.windowWidth[0] : firstImage.windowWidth;
  state.voiRange = Number.isFinite(wc) && Number.isFinite(ww) && ww > 1 ? { lower: wc - ww/2, upper: wc + ww/2 } : { lower:min, upper:max };
}

async function configureVolume(imageIds, firstImage, meta){
  state.mode = 'volume';
  els.volumeViewport.classList.remove('hidden');
  els.sliceDock.classList.remove('hidden');
  $$('.volume-only').forEach(el => el.classList.remove('hidden'));
  // Build the volume from the already-decoded/cached local DICOM images when
  // Cornerstone exposes that path. It avoids a second streaming-loader path
  // and guarantees the assembled volume is backed by the same pixel data that
  // successfully rendered in the 2D stack loader.
  state.volumeId = `scanspace-volume-${Date.now()}`;
  setLoading('ASSEMBLING VOLUME FROM SPATIAL DICOM DATA');
  if(typeof volumeLoader.createAndCacheVolumeFromImages === 'function'){
    state.volume = await volumeLoader.createAndCacheVolumeFromImages(state.volumeId, imageIds);
  } else {
    state.volumeId = `cornerstoneStreamingImageVolume:${state.volumeId}`;
    state.volume = await volumeLoader.createAndCacheVolume(state.volumeId, { imageIds });
    const maybeLoad = state.volume?.load?.();
    if(maybeLoad && typeof maybeLoad.then === 'function') await maybeLoad;
  }

  state.engine.setViewports([
    { viewportId: VIEWPORT_MAIN, type: Enums.ViewportType.VOLUME_3D, element: els.volumeViewport, defaultOptions: { background:[0.018,0.024,0.03] } },
    { viewportId: VIEWPORT_SLICE, type: Enums.ViewportType.ORTHOGRAPHIC, element: els.sliceViewport, defaultOptions: { orientation: Enums.OrientationAxis.AXIAL, background:[0,0,0] } },
  ]);

  // Make sure Cornerstone/VTK has the final DOM dimensions before creating
  // the volume actors. A zero-sized viewport can otherwise look like a valid
  // but completely blank 3D reconstruction.
  try { state.engine.resize(true, false); } catch (_) {}

  // Use one authoritative attachment path for both MPR and 3D. This mirrors
  // Cornerstone's volume examples and ensures VOLUME_3D receives a real actor.
  await setVolumesForViewports(
    state.engine,
    [{ volumeId: state.volumeId }],
    [VIEWPORT_MAIN, VIEWPORT_SLICE],
    true
  );

  setupVolumeTools();
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const slice = state.engine.getViewport(VIEWPORT_SLICE);

  const actorEntry = main?.getDefaultActor?.();
  const actor = actorEntry?.actor;
  if(!actor){
    throw new Error('3D volume actor was not created. The DICOM slices loaded, but Cornerstone could not attach the assembled volume to the 3D viewport.');
  }

  // Use the scalar range of the ACTUAL assembled volume rather than the first
  // image's stored range/window. Rescale slope/intercept and modality LUTs can
  // make those ranges very different (especially CT).
  const actorRange = getActorScalarRange(actor);
  if(actorRange){
    console.info('SCAN//SPACE 3D actor scalar range', actorRange, 'volumeId', state.volumeId);
    state.scalarRange = actorRange;
    // If the DICOM-provided VOI falls completely outside the assembled scalar
    // range, use the true volume range as a safe visible default.
    const voi = state.voiRange;
    if(!voi || voi.upper <= actorRange[0] || voi.lower >= actorRange[1]){
      state.voiRange = { lower: actorRange[0], upper: actorRange[1] };
    }
  }

  main.resetCamera();
  slice.resetCamera();
  try { main.setCamera({ parallelProjection: false }); } catch (_) {}
  applyVisualization(true);
  main.render();
  slice.render();
  state.engine.render();

  state.imageGeometry = getVolumeGeometry(state.volume, meta);
  finishStudyUI({
    modality: meta.modality,
    series: meta.seriesDesc || 'DICOM SERIES',
    dimensions: formatVolumeDimensions(state.volume, firstImage, imageIds.length),
    voxel: formatVolumeSpacing(state.volume, meta),
  });
  updateSlicePlane('axial', true);
  startOverlayLoop();
  setNotice(`Volumetric ${meta.modality || 'DICOM'} study reconstructed from ${imageIds.length} spatial frames. The 3D object and Splicer are derived from the scan data; anatomy labels remain references, not detections.`);
  hideLoading();
  showToast(`Loaded ${imageIds.length} DICOM frames locally`, 3200);
}

async function configureStack(imageIds, firstImage, meta){
  state.mode = 'stack';
  els.volumeViewport.classList.remove('hidden');
  state.engine.setViewports([
    { viewportId: VIEWPORT_MAIN, type: Enums.ViewportType.STACK, element: els.volumeViewport, defaultOptions: { background:[0,0,0] } },
  ]);
  const vp = state.engine.getViewport(VIEWPORT_MAIN);
  await vp.setStack(imageIds);
  setupStackTools();
  vp.resetCamera();
  applyStackVOI();
  vp.render();

  finishStudyUI({
    modality: meta.modality,
    series: meta.seriesDesc || 'SINGLE-FRAME DICOM',
    dimensions: `${firstImage.columns || meta.cols || '—'} × ${firstImage.rows || meta.rows || '—'}`,
    voxel: '2D DICOM',
  });
  els.sliceDock.classList.add('hidden');
  els.worldOverlay.classList.add('hidden');
  $$('.volume-only').forEach(el => el.classList.add('hidden'));
  setNotice('Single-frame DICOM detected. It remains a faithful 2D image; SCAN//SPACE does not invent a 3D body from one radiograph.');
  hideLoading();
  showToast('Single DICOM loaded locally', 2800);
}

function setupVolumeTools(){
  const mainGroup = ToolGroupManager.createToolGroup(TOOLGROUP_MAIN);
  mainGroup.addTool(TrackballRotateTool.toolName);
  mainGroup.addTool(PanTool.toolName);
  mainGroup.addTool(ZoomTool.toolName);
  mainGroup.setToolActive(TrackballRotateTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Primary }] });
  mainGroup.setToolActive(PanTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Auxiliary }] });
  mainGroup.setToolActive(ZoomTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Secondary }] });
  mainGroup.addViewport(VIEWPORT_MAIN, state.engine.id);

  const sliceGroup = ToolGroupManager.createToolGroup(TOOLGROUP_SLICE);
  [LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool].forEach(tool => sliceGroup.addTool(tool.toolName));
  sliceGroup.setToolPassive(LengthTool.toolName);
  sliceGroup.setToolPassive(ArrowAnnotateTool.toolName);
  sliceGroup.setToolActive(PanTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Auxiliary }] });
  sliceGroup.setToolActive(ZoomTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Secondary }] });
  sliceGroup.setToolActive(StackScrollTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Wheel }] });
  sliceGroup.addViewport(VIEWPORT_SLICE, state.engine.id);
}

function setupStackTools(){
  const group = ToolGroupManager.createToolGroup(TOOLGROUP_STACK);
  [LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool].forEach(tool => group.addTool(tool.toolName));
  group.setToolPassive(LengthTool.toolName);
  group.setToolPassive(ArrowAnnotateTool.toolName);
  group.setToolActive(PanTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Auxiliary }] });
  group.setToolActive(ZoomTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Secondary }] });
  group.setToolActive(StackScrollTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Wheel }] });
  group.addViewport(VIEWPORT_MAIN, state.engine.id);
}

function getAnnotationToolGroup(){
  return ToolGroupManager.getToolGroup(state.mode === 'volume' ? TOOLGROUP_SLICE : TOOLGROUP_STACK);
}
function setAnnotationTool(which){
  if(!state.mode) return;
  const group = getAnnotationToolGroup();
  if(!group) return;
  const length = LengthTool.toolName;
  const marker = ArrowAnnotateTool.toolName;
  try { group.setToolPassive(length); } catch (_) {}
  try { group.setToolPassive(marker); } catch (_) {}
  if(state.activeTool === which){
    state.activeTool = null;
  } else {
    state.activeTool = which;
    const name = which === 'measure' ? length : marker;
    group.setToolActive(name, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Primary }] });
  }
  els.measureTool.classList.toggle('active', state.activeTool === 'measure');
  els.markerTool.classList.toggle('active', state.activeTool === 'marker');
  els.measureReadout.textContent = state.activeTool === 'measure'
    ? 'MEASURE ACTIVE · DRAG BETWEEN TWO POINTS ON THE SLICE'
    : state.activeTool === 'marker'
      ? 'MARKER ACTIVE · PLACE AN ARROW AND ENTER A LABEL'
      : 'SPATIAL IMAGE TOOLS · NO DIAGNOSTIC INTERPRETATION';
}

function applyStackVOI(){
  if(state.mode !== 'stack') return;
  const vp = state.engine.getViewport(VIEWPORT_MAIN);
  if(!vp) return;
  const { lower, upper } = effectiveVOIRange();
  try { vp.setProperties({ voiRange:{lower,upper} }); } catch (_) {}

  // Apply the same deterministic grayscale / thermal / warm real-life pseudo-color
  // transfer function used by the volume renderer to 2D DICOM and ordinary images.
  try {
    const actorEntry = vp.getDefaultActor?.();
    const prop = actorEntry?.actor?.getProperty?.();
    const cfun = prop?.getRGBTransferFunction?.(0);
    if(cfun){
      cfun.removeAllPoints();
      addColorTransferPoints(cfun, lower, upper, state.colorMode);
    }
  } catch (_) {}

  vp.render();
}

function getActorScalarRange(actor){
  try {
    const mapper = actor?.getMapper?.();
    const input = mapper?.getInputData?.();
    const scalars = input?.getPointData?.()?.getScalars?.();
    const range = scalars?.getRange?.();
    if(Array.isArray(range) && range.length >= 2 && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[1] > range[0]){
      return [range[0], range[1]];
    }
  } catch (e) {
    console.warn('Could not read 3D actor scalar range', e);
  }
  try {
    const range = state.volume?.getScalarData?.()?.reduce ? null : null;
    void range;
  } catch (_) {}
  return null;
}

function effectiveVOIRange(){
  const base = state.voiRange || { lower:state.scalarRange[0], upper:state.scalarRange[1] };
  const rawSpan = Math.max(1e-6, base.upper - base.lower);
  const center = (base.lower + base.upper)/2 + (state.brightness/80) * rawSpan * .4;
  const span = rawSpan / Math.max(.3, state.contrast);
  return { lower:center-span/2, upper:center+span/2 };
}

function applyVisualization(forceVisible=false){
  if(state.mode === 'stack'){ applyStackVOI(); return; }
  if(state.mode !== 'volume') return;
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const slice = state.engine.getViewport(VIEWPORT_SLICE);
  let { lower, upper } = effectiveVOIRange();
  // 3D rendering must be driven by the actual actor scalar range. VOI remains
  // useful for MPR display, but a narrow or mismatched VOI can make an entire
  // ray-cast volume transparent.
  const actor = main?.getDefaultActor?.()?.actor;
  const actorRange = actor ? getActorScalarRange(actor) : null;
  if(actorRange){
    const [amin, amax] = actorRange;
    if(forceVisible || upper <= amin || lower >= amax || (upper-lower) < (amax-amin)*0.01){
      lower = amin;
      upper = amax;
    }
  }
  const rangeSpan = Math.max(1e-6, upper-lower);
  const thresholdFraction = forceVisible ? Math.min(state.threshold, .08) : state.threshold;
  const threshold = lower + rangeSpan * thresholdFraction;
  // Keep final still quality high without making interaction unusably expensive.
  // 100% quality now maps to ~0.35 instead of the previous ~0.06. During
  // rotation/zoom we temporarily raise the multiplier further (fewer samples)
  // and restore the selected quality when interaction stops.
  applySampleQuality(state.interactiveQuality, false);
  try { slice.setProperties({ voiRange:{lower,upper} }); } catch (_) {}

  for(const [vp, isMain] of [[main,true],[slice,false]]){
    const actorEntry = vp?.getDefaultActor?.();
    const prop = actorEntry?.actor?.getProperty?.();
    if(!prop) continue;
    const cfun = prop.getRGBTransferFunction?.(0);
    const ofun = prop.getScalarOpacity?.(0);
    if(cfun){
      cfun.removeAllPoints();
      addColorTransferPoints(cfun, lower, upper, state.colorMode);
    }
    if(ofun){
      ofun.removeAllPoints();
      if(isMain){
        const op = clamp(state.opacity, .05, 1);
        // A deliberately forgiving initial opacity curve: the first visible
        // voxels become faintly translucent rather than jumping from 0 to 0.
        // This guarantees a reconstruction is visible while keeping air / very
        // low intensity data mostly transparent. The threshold control can then
        // be raised interactively.
        ofun.addPoint(lower, 0);
        ofun.addPoint(threshold, 0);
        ofun.addPoint(threshold + rangeSpan*.015, op*.10);
        ofun.addPoint(lower + rangeSpan*.28, op*.22);
        ofun.addPoint(lower + rangeSpan*.52, op*.45);
        ofun.addPoint(lower + rangeSpan*.76, op*.72);
        ofun.addPoint(upper, op);
      } else {
        ofun.addPoint(lower, 1);
        ofun.addPoint(upper, 1);
      }
    }
  }
  try { state.engine.renderViewports([VIEWPORT_MAIN, VIEWPORT_SLICE]); } catch (_) { main.render(); slice.render(); }
}

function qualitySampleMultiplier(interactive=false){
  // User quality 20–100% -> idle multiplier ~1.15–0.35. Larger multiplier =
  // fewer ray samples / faster rendering. Interaction never renders denser
  // than ~1.10, which keeps trackball rotation responsive on laptop GPUs.
  const q = clamp(state.density, .20, 1);
  const idle = 1.35 - q * 1.00;
  return interactive ? Math.max(1.10, idle * 2.4) : Math.max(.35, idle);
}

function applySampleQuality(interactive=false, render=true){
  if(state.mode !== 'volume' || !state.engine) return;
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  if(!main) return;
  const multiplier = qualitySampleMultiplier(interactive);
  try { main.setSampleDistanceMultiplier(multiplier); }
  catch (_) { try { main.setProperties({ sampleDistanceMultiplier: multiplier }); } catch (_) {} }
  if(render){ try { state.engine.renderViewport(VIEWPORT_MAIN); } catch (_) { main.render(); } }
}

function setInteractiveQuality(active){
  if(state.mode !== 'volume') return;
  clearTimeout(state.qualityRestoreTimer);
  state.interactiveQuality = active;
  applySampleQuality(active, true);
  if(active){
    state.qualityRestoreTimer = setTimeout(() => {
      state.interactiveQuality = false;
      applySampleQuality(false, true);
    }, 180);
  }
}

function scheduleVisualization(){
  if(state.visualRAF) return;
  state.visualRAF = requestAnimationFrame(() => {
    state.visualRAF = 0;
    applyVisualization();
  });
}

function addColorTransferPoints(cfun, low, high, mode){
  const span = Math.max(1e-6, high-low);
  const p = (t,r,g,b) => cfun.addRGBPoint(low + span*t, r,g,b);
  if(mode === 'thermal'){
    p(0,.01,.02,.09); p(.18,0,.22,.72); p(.40,0,.85,1); p(.62,.28,1,.35); p(.78,1,.88,.05); p(1,1,.08,.015);
  } else if(mode === 'real'){
    // Physically inspired pseudo-color only: warm soft tissue / ivory high-density structures.
    p(0,.05,.025,.018); p(.18,.18,.055,.035); p(.38,.52,.18,.11); p(.58,.80,.42,.28); p(.74,.95,.70,.54); p(.90,.95,.88,.74); p(1,1,.98,.90);
  } else {
    p(0,0,0,0); p(.25,.18,.18,.18); p(.55,.52,.52,.52); p(.82,.82,.82,.82); p(1,1,1,1);
  }
}

async function updateSlicePlane(plane, reset=false){
  if(state.mode !== 'volume') return;
  state.plane = plane;
  $$('#planeMode button').forEach(b => b.classList.toggle('active', b.dataset.plane === plane));
  const vp = state.engine.getViewport(VIEWPORT_SLICE);
  const orient = plane === 'sagittal' ? Enums.OrientationAxis.SAGITTAL : plane === 'coronal' ? Enums.OrientationAxis.CORONAL : Enums.OrientationAxis.AXIAL;
  try { vp.setOrientation(orient, true); } catch (_) { try { vp.setOrientation(orient); } catch (_) {} }
  if(reset) vp.resetCamera();
  state.engine.renderViewport(VIEWPORT_SLICE);
  const n = Math.max(1, vp.getNumberOfSlices?.() || 1);
  const target = reset ? Math.floor((n-1)/2) : Math.round((+els.slicePosition.value/1000)*(n-1));
  try { await utilities.jumpToSlice(els.sliceViewport, { imageIndex:target }); } catch (_) {}
  updateSliceUI();
}

async function jumpToSlider(){
  if(state.mode !== 'volume') return;
  const vp = state.engine.getViewport(VIEWPORT_SLICE);
  const n = Math.max(1, vp.getNumberOfSlices?.() || 1);
  const idx = Math.round((+els.slicePosition.value/1000)*(n-1));
  try { await utilities.jumpToSlice(els.sliceViewport, { imageIndex:idx }); } catch (e) { console.warn(e); }
  updateSliceUI();
}

function updateSliceUI(){
  if(state.mode !== 'volume') return;
  const vp = state.engine.getViewport(VIEWPORT_SLICE);
  const n = Math.max(1, vp.getNumberOfSlices?.() || 1);
  let idx = 0;
  try {
    const info = utilities.getVolumeViewportScrollInfo(vp, state.volumeId);
    idx = clamp(info.currentStepIndex ?? 0, 0, n-1);
  } catch (_) {
    try { idx = clamp(vp.getCurrentImageIdIndex?.() ?? 0, 0, n-1); } catch (_) {}
  }
  if(document.activeElement !== els.slicePosition) els.slicePosition.value = n <= 1 ? 0 : Math.round((idx/(n-1))*1000);
  els.sliceOut.textContent = n <= 1 ? '0%' : `${Math.round((idx/(n-1))*100)}%`;
  els.sliceTitle.textContent = `${state.plane.toUpperCase()} SLICE`;
  els.sliceIndexLabel.textContent = `${idx+1} / ${n}`;
  els.hudPosition.textContent = `${state.plane.toUpperCase()} · ${idx+1}/${n}`;
}

function startOverlayLoop(){
  stopOverlayLoop();
  // XYZ / Splicer overlays do not need 60 updates/sec. 20 fps is visually
  // smooth enough and avoids repeated worldToCanvas work competing with VTK.
  const tick = () => {
    if(state.mode !== 'volume') return;
    updateSliceUI();
    drawWorldOverlay();
    state.overlayRAF = setTimeout(() => requestAnimationFrame(tick), 50);
  };
  state.overlayRAF = setTimeout(() => requestAnimationFrame(tick), 50);
}
function stopOverlayLoop(){ if(state.overlayRAF) clearTimeout(state.overlayRAF); state.overlayRAF = 0; }

function drawWorldOverlay(){
  if(state.mode !== 'volume') return;
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const slice = state.engine.getViewport(VIEWPORT_SLICE);
  if(!main || !slice) return;
  const bounds = els.volumeViewport.getBoundingClientRect();
  els.worldOverlay.setAttribute('viewBox', `0 0 ${Math.max(1,bounds.width)} ${Math.max(1,bounds.height)}`);
  els.worldOverlay.classList.remove('hidden');

  if(state.showPlane){
    const cam = slice.getCamera?.();
    const focal = cam?.focalPoint;
    const vpn = cam?.viewPlaneNormal;
    const vup = cam?.viewUp;
    if(focal && vpn && vup){
      const up = norm(vup);
      const right = norm(cross(up, norm(vpn)));
      const ext = state.imageGeometry?.maxExtent || 220;
      const half = ext * .62;
      const corners = [
        add(add(focal,mul(right,-half)),mul(up,-half)),
        add(add(focal,mul(right,half)),mul(up,-half)),
        add(add(focal,mul(right,half)),mul(up,half)),
        add(add(focal,mul(right,-half)),mul(up,half)),
      ];
      const pts = corners.map(w => main.worldToCanvas(w)).filter(p => p?.length >= 2);
      if(pts.length === 4){
        els.splicePlane.setAttribute('points', pts.map(p => `${p[0]},${p[1]}`).join(' '));
        els.splicePlane.style.display = '';
      } else els.splicePlane.style.display = 'none';
    }
  } else els.splicePlane.style.display = 'none';

  if(state.showAxes && state.imageGeometry){
    const { center, axes, maxExtent } = state.imageGeometry;
    const L = maxExtent * .34;
    const o = main.worldToCanvas(center);
    const ex = main.worldToCanvas(add(center, mul(axes[0],L)));
    const ey = main.worldToCanvas(add(center, mul(axes[1],L)));
    const ez = main.worldToCanvas(add(center, mul(axes[2],L)));
    if([o,ex,ey,ez].every(Boolean)){
      setLine(els.axisX,o,ex); setLine(els.axisY,o,ey); setLine(els.axisZ,o,ez);
      setText(els.axisXLabel,ex,'X'); setText(els.axisYLabel,ey,'Y'); setText(els.axisZLabel,ez,'Z');
      els.axisGroup.style.display = '';
    } else els.axisGroup.style.display = 'none';
  } else els.axisGroup.style.display = 'none';

  if(state.selectedAnatomyWorld && state.selectedAnatomy){
    const p = main.worldToCanvas(state.selectedAnatomyWorld);
    if(p?.length >= 2){
      els.anatomyFocusGroup.classList.remove('hidden');
      els.anatomyFocusGroup.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
      els.anatomyFocusLabel.textContent = state.isolationActive ? `${state.selectedAnatomy.name} · ROI` : state.selectedAnatomy.name;
    } else els.anatomyFocusGroup.classList.add('hidden');
  } else els.anatomyFocusGroup.classList.add('hidden');
}
function setLine(el,a,b){ el.setAttribute('x1',a[0]);el.setAttribute('y1',a[1]);el.setAttribute('x2',b[0]);el.setAttribute('y2',b[1]); }
function setText(el,p,t){ el.setAttribute('x',p[0]+6);el.setAttribute('y',p[1]-6);el.textContent=t; }

function getVolumeGeometry(volume, meta){
  try {
    const imageData = volume.imageData || volume.imageData?.getDimensions?.();
    const dims = volume.dimensions || volume.imageData?.getDimensions?.() || [meta.cols||256,meta.rows||256,1];
    const spacing = volume.spacing || volume.imageData?.getSpacing?.() || [meta.pixelSpacing?.[1]||1,meta.pixelSpacing?.[0]||1,meta.spacingBetween||meta.sliceThickness||1];
    const origin = volume.origin || volume.imageData?.getOrigin?.() || [0,0,0];
    const direction = volume.direction || volume.imageData?.getDirection?.() || [1,0,0,0,1,0,0,0,1];
    const axes = [norm([direction[0],direction[1],direction[2]]),norm([direction[3],direction[4],direction[5]]),norm([direction[6],direction[7],direction[8]])];
    const lengths = [dims[0]*spacing[0],dims[1]*spacing[1],dims[2]*spacing[2]];
    let center = [...origin];
    for(let i=0;i<3;i++) center = add(center,mul(axes[i],lengths[i]/2));
    return { dims, spacing, origin, axes, lengths, center, maxExtent:Math.max(...lengths) };
  } catch (e) {
    console.warn('Could not derive volume geometry', e);
    return null;
  }
}

function formatVolumeDimensions(volume, firstImage, frameCount){
  const d = volume.dimensions || volume.imageData?.getDimensions?.();
  if(d?.length === 3) return `${d[0]} × ${d[1]} × ${d[2]}`;
  return `${firstImage.columns || '—'} × ${firstImage.rows || '—'} × ${frameCount}`;
}
function formatVolumeSpacing(volume, meta){
  const s = volume.spacing || volume.imageData?.getSpacing?.() || [meta.pixelSpacing?.[1]||1,meta.pixelSpacing?.[0]||1,meta.spacingBetween||meta.sliceThickness||1];
  return `${s.slice(0,3).map(v => Number(v).toFixed(2)).join(' × ')} mm`;
}

function finishStudyUI(info){
  stopDust();
  els.emptyState.classList.add('hidden');
  els.volumeViewport.classList.remove('hidden');
  els.hud.classList.remove('hidden');
  els.studyType.textContent = state.modality || info.modality || 'STUDY';
  els.studyRegion.textContent = state.region;
  els.confidenceLabel.textContent = state.regionConfidence;
  els.hudMode.textContent = state.mode === 'volume' ? 'VOLUME' : '2D IMAGE';
  els.hudDims.textContent = info.dimensions;
  els.sliceDock.classList.toggle('hidden', state.mode !== 'volume');
  $$('.volume-only').forEach(el => el.classList.toggle('hidden', state.mode !== 'volume'));
  updateMetadata(info);
  updateAnatomy();
  resizeOverlay();
}

function updateMetadata(info){
  const rows = [['Modality',info.modality],['Series',info.series],['Dimensions',info.dimensions],['Voxel',info.voxel]];
  els.metadataList.innerHTML = rows.map(([k,v]) => `<div><dt>${escapeHtml(k)}</dt><dd title="${escapeHtml(v)}">${escapeHtml(v)}</dd></div>`).join('');
}
function catalogForRegion(region=state.region){
  const exact = ANATOMY_CATALOG.filter(item => item.regions.includes(region));
  if(exact.length) return exact;
  return ANATOMY_CATALOG.filter(item => item.regions.includes('UNKNOWN'));
}

function updateAnatomy(){
  const items = catalogForRegion();
  const groups = new Map();
  for(const item of items){
    if(!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }
  els.anatomyTree.classList.remove('empty');
  els.anatomyTree.innerHTML = [...groups.entries()].map(([group,entries]) => `
    <div class="anatomy-group"><h3>${escapeHtml(group)}</h3><div class="anatomy-items">
    ${entries.map(item => `<button class="anatomy-item" data-anatomy="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('')}
    </div></div>`).join('');
  $$('.anatomy-item').forEach(btn => btn.addEventListener('click', () => {
    const item = anatomyByName.get(btn.dataset.anatomy.toLowerCase());
    if(item) selectAnatomy(item, { autoIsolate: state.mode === 'volume' });
  }));
}
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])); }

function anatomySearchMatches(query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  const scored = [];
  for(const item of ANATOMY_CATALOG){
    const names = [item.name, ...(item.aliases || [])].map(v => v.toLowerCase());
    let score = 0;
    if(names.some(v => v === q)) score = 100;
    else if(item.name.toLowerCase().startsWith(q)) score = 80;
    else if(names.some(v => v.startsWith(q))) score = 70;
    else if(item.name.toLowerCase().includes(q)) score = 55;
    else if(names.some(v => v.includes(q))) score = 45;
    if(!score) continue;
    if(item.regions.includes(state.region)) score += 20;
    scored.push({ item, score });
  }
  return scored.sort((a,b) => b.score-a.score || a.item.name.localeCompare(b.item.name)).slice(0,14).map(x => x.item);
}

function renderAnatomyResults(query){
  const matches = anatomySearchMatches(query);
  if(!query.trim()){
    els.anatomyResults.classList.add('hidden');
    els.anatomyResults.innerHTML = '';
    return;
  }
  els.anatomyResults.classList.remove('hidden');
  if(!matches.length){
    els.anatomyResults.innerHTML = '<div class="anatomy-result"><span>No reference match</span><small>TRY ANOTHER TERM</small></div>';
    return;
  }
  els.anatomyResults.innerHTML = matches.map(item => `<button class="anatomy-result" data-anatomy="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.group)} · ${escapeHtml(item.regions[0])}</small></button>`).join('');
  $$('.anatomy-result[data-anatomy]').forEach(btn => btn.addEventListener('click', () => {
    const item = anatomyByName.get(btn.dataset.anatomy.toLowerCase());
    if(item){
      els.anatomySearch.value = item.name;
      els.anatomyResults.classList.add('hidden');
      selectAnatomy(item, { autoIsolate: state.mode === 'volume' });
    }
  }));
}

function normalizedPointToWorld(normPoint){
  const g = state.imageGeometry;
  if(!g) return null;
  let p = [...g.origin];
  for(let i=0;i<3;i++) p = add(p, mul(g.axes[i], g.lengths[i] * clamp(normPoint[i],0,1)));
  return p;
}

function anatomyWorldBounds(item){
  if(!state.imageGeometry) return null;
  const half = item.size.map(v => v/2);
  const lo = item.center.map((v,i) => clamp(v-half[i],0,1));
  const hi = item.center.map((v,i) => clamp(v+half[i],0,1));
  const pts = [];
  for(const x of [lo[0],hi[0]]) for(const y of [lo[1],hi[1]]) for(const z of [lo[2],hi[2]]) pts.push(normalizedPointToWorld([x,y,z]));
  if(pts.some(p => !p)) return null;
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), zs=pts.map(p=>p[2]);
  return [Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys),Math.min(...zs),Math.max(...zs)];
}

function getMainActorMapper(){
  if(state.mode !== 'volume' || !state.engine) return {};
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const actor = main?.getDefaultActor?.()?.actor;
  return { main, actor, mapper: actor?.getMapper?.() };
}

function updateSelectionUI(item){
  if(!item){
    els.anatomySelection.classList.add('hidden');
    return;
  }
  els.anatomySelection.classList.remove('hidden');
  els.selectedAnatomy.textContent = item.name;
  els.selectionMode.textContent = 'REFERENCE ROI';
  const applicable = item.regions.includes(state.region) || state.region === 'UNKNOWN';
  els.selectionDetail.textContent = !applicable
    ? `This reference belongs to ${item.regions.join(' / ')} and is not mapped into the detected ${state.region} study.`
    : state.mode === 'volume'
      ? 'Reference location mapped into this scan volume. Cropping isolates the ROI, not an automatically segmented organ boundary.'
      : 'Reference anatomy selected. Exact patient-structure isolation requires volumetric data and a segmentation mask.';
  $$('.anatomy-item').forEach(btn => btn.classList.toggle('active', btn.dataset.anatomy?.toLowerCase() === item.name.toLowerCase()));
}

async function selectAnatomy(item, { autoIsolate=false }={}){
  state.selectedAnatomy = item;
  const applicable = item.regions.includes(state.region) || state.region === 'UNKNOWN';
  state.selectedAnatomyWorld = applicable ? normalizedPointToWorld(item.center) : null;
  updateSelectionUI(item);
  if(!applicable){
    showToast(`${item.name} is outside the detected ${state.region} study region`, 3600);
    return;
  }
  if(state.mode === 'volume'){
    await focusSelectedAnatomy();
    if(autoIsolate) isolateSelectedAnatomy();
  } else {
    showToast(`${item.name}: reference selected · exact structure detection is not enabled`, 3600);
  }
}

async function focusSelectedAnatomy(){
  const item = state.selectedAnatomy;
  if(!item || state.mode !== 'volume') return;
  const world = normalizedPointToWorld(item.center);
  if(!world) return;
  state.selectedAnatomyWorld = world;

  // Put the synchronized slice at the selected superior/inferior reference.
  await updateSlicePlane('axial', false);
  const t = clamp(item.center[2],0,1);
  els.slicePosition.value = Math.round(t*1000);
  await jumpToSlider();

  // Re-center the 3D camera without changing the user's viewing direction.
  const { main } = getMainActorMapper();
  const cam = main?.getCamera?.();
  if(main && cam?.position && cam?.focalPoint){
    const delta = [world[0]-cam.focalPoint[0], world[1]-cam.focalPoint[1], world[2]-cam.focalPoint[2]];
    const pos = [cam.position[0]+delta[0],cam.position[1]+delta[1],cam.position[2]+delta[2]];
    try { main.setCamera({ focalPoint:world, position:pos }); } catch (_) {}
    try { main.render(); } catch (_) {}
  }
  drawWorldOverlay();
  showToast(`${item.name} · reference focus`, 2200);
}

function isolateSelectedAnatomy(){
  const item = state.selectedAnatomy;
  if(!item || state.mode !== 'volume') return;
  const bounds = anatomyWorldBounds(item);
  const { main, mapper } = getMainActorMapper();
  if(!bounds || !mapper){
    showToast('This volume does not expose a crop-capable 3D mapper.', 4200);
    return;
  }
  try {
    if(typeof mapper.setCropping === 'function') mapper.setCropping(true);
    else if(typeof mapper.croppingOn === 'function') mapper.croppingOn();
    else throw new Error('cropping API unavailable');

    if(typeof mapper.setCroppingRegionPlanes === 'function'){
      try { mapper.setCroppingRegionPlanes(...bounds); }
      catch (_) { mapper.setCroppingRegionPlanes(bounds); }
    } else {
      throw new Error('cropping planes API unavailable');
    }
    if(typeof mapper.setCroppingRegionFlagsToSubVolume === 'function') mapper.setCroppingRegionFlagsToSubVolume();
    state.isolationActive = true;
    state.isolationBounds = bounds;
    try { main.render(); } catch (_) { state.engine.renderViewport(VIEWPORT_MAIN); }
    els.isolateAnatomy.textContent = 'ROI ISOLATED';
    els.selectionMode.textContent = 'REFERENCE ROI';
    setNotice(`${item.name}: the 3D render is cropped to a predefined anatomical reference ROI. This is spatial isolation, not patient-specific segmentation or diagnosis.`);
    showToast(`${item.name} · reference ROI isolated`, 3000);
  } catch (e) {
    console.warn('SCAN//SPACE ROI crop unavailable', e);
    showToast('ROI cropping is unavailable in this renderer; focus was preserved.', 4200);
  }
}

function resetAnatomyIsolation({clearSelection=false}={}){
  if(state.mode === 'volume'){
    const { main, mapper } = getMainActorMapper();
    try {
      if(typeof mapper?.setCropping === 'function') mapper.setCropping(false);
      else if(typeof mapper?.croppingOff === 'function') mapper.croppingOff();
      main?.resetCamera?.();
      main?.render?.();
    } catch (e) { console.warn('Could not reset ROI cropping', e); }
  }
  state.isolationActive = false;
  state.isolationBounds = null;
  els.isolateAnatomy.textContent = 'ISOLATE ROI';
  if(clearSelection){
    state.selectedAnatomy = null;
    state.selectedAnatomyWorld = null;
    updateSelectionUI(null);
  }
  setNotice(state.mode === 'volume' ? 'Full volume restored. Anatomy references remain navigation aids unless a segmentation is available.' : '');
  drawWorldOverlay();
}

function inferRegion(meta){
  const t = `${meta.body || ''} ${meta.studyDesc || ''} ${meta.seriesDesc || ''}`.toUpperCase();
  const rules = [
    ['BRAIN',/BRAIN|HEAD.*MR|CRANI/],['SKULL',/SKULL|FACIAL|MANDIBLE|MAXILLA|DENTAL/],['NECK',/NECK|CERVICAL|C-SPINE/],
    ['CHEST',/CHEST|THORAX|LUNG|CARDIAC/],['ABDOMEN',/ABDOM|LIVER|PANCREA|KIDNEY/],['PELVIS',/PELV|HIP/],
    ['EXTREMITY',/KNEE|ANKLE|FOOT|HAND|WRIST|ELBOW|SHOULDER|FEMUR|TIBIA|HUMERUS/],
  ];
  for(const [r,re] of rules) if(re.test(t)) return {region:r,confidence:'METADATA RULE'};
  return {region:'UNKNOWN',confidence:'UNCLASSIFIED'};
}

function returnToEmpty(){
  state.mode = null;
  els.emptyState.classList.remove('hidden');
  els.volumeViewport.classList.add('hidden');
  els.sliceDock.classList.add('hidden');
  els.hud.classList.add('hidden');
  els.worldOverlay.classList.add('hidden');
  els.studyType.textContent = 'NO STUDY';
  els.studyRegion.textContent = 'WAITING FOR INPUT';
  els.confidenceLabel.textContent = 'NO STUDY';
  els.anatomyTree.classList.add('empty');
  els.anatomyTree.textContent = 'Upload a study to organize relevant anatomy.';
  els.anatomySelection.classList.add('hidden');
  els.anatomyResults.classList.add('hidden');
  startDust();
}

// Ordinary PNG/JPEG support through a local Cornerstone image loader.
let localWebFiles = new Map();
let localWebMeta = new Map();
let localWebCounter = 0;
function registerWebImageLoader(){
  imageLoader.registerImageLoader('localweb', (imageId) => {
    const key = imageId.slice('localweb:'.length);
    const file = localWebFiles.get(key);
    return { promise: createWebImageObject(imageId, file) };
  });
  metaData.addProvider((type,imageId) => {
    if(!imageId.startsWith('localweb:')) return;
    if(type === 'imagePlaneModule') {
      const key = imageId.slice('localweb:'.length);
      const m = localWebMeta.get(key) || {};
      return {
        frameOfReferenceUID:`LOCALWEB-${key}`, rows:m.rows, columns:m.columns,
        rowCosines:[1,0,0], columnCosines:[0,1,0], imagePositionPatient:[0,0,0],
        rowPixelSpacing:1, columnPixelSpacing:1,
      };
    }
    if(type === 'generalSeriesModule') return { modality:'OT' };
  }, 10000);
}
async function createWebImageObject(imageId, file){
  if(!file) throw new Error('Image file no longer available.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
  const c = canvas.getContext('2d',{willReadFrequently:true}); c.drawImage(bitmap,0,0);
  const rgba = c.getImageData(0,0,canvas.width,canvas.height).data;
  const gray = new Uint8Array(canvas.width*canvas.height);
  for(let i=0,j=0;i<rgba.length;i+=4,j++) gray[j] = Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
  const key = imageId.slice('localweb:'.length);
  localWebMeta.set(key,{rows:canvas.height,columns:canvas.width});
  return {
    imageId, minPixelValue:0,maxPixelValue:255,slope:1,intercept:0,windowCenter:127.5,windowWidth:255,
    rows:canvas.height,columns:canvas.width,height:canvas.height,width:canvas.width,color:false,rgba:false,
    numberOfComponents:1,dataType:'Uint8Array',voiLUTFunction:'LINEAR',photometricInterpretation:'MONOCHROME2',
    FrameOfReferenceUID:`LOCALWEB-${key}`,columnPixelSpacing:1,rowPixelSpacing:1,invert:false,sizeInBytes:gray.byteLength,
    getPixelData:()=>gray,getCanvas:()=>canvas,
  };
}
async function loadWebImage(file){
  const key = String(++localWebCounter); localWebFiles.set(key,file);
  const imageId = `localweb:${key}`;
  setLoading('PREPARING 2D IMAGE');
  const im = await imageLoader.loadAndCacheImage(imageId);
  state.modality = '2D IMAGE'; state.region = inferRegionFromFilename(file.name); state.regionConfidence = state.region === 'UNKNOWN' ? 'NO METADATA' : 'FILENAME HEURISTIC';
  state.scalarRange=[0,255];state.voiRange={lower:0,upper:255};
  state.mode='stack';
  state.engine.setViewports([{viewportId:VIEWPORT_MAIN,type:Enums.ViewportType.STACK,element:els.volumeViewport,defaultOptions:{background:[0,0,0]}}]);
  const vp=state.engine.getViewport(VIEWPORT_MAIN); await vp.setStack([imageId]); setupStackTools(); vp.resetCamera(); applyStackVOI(); vp.render();
  finishStudyUI({modality:'2D IMAGE',series:file.name,dimensions:`${im.columns} × ${im.rows}`,voxel:'UNSCALED 2D IMAGE'});
  els.sliceDock.classList.add('hidden'); els.worldOverlay.classList.add('hidden'); $$('.volume-only').forEach(el=>el.classList.add('hidden'));
  setNotice('Standalone 2D image detected. It remains 2D; measurements are uncalibrated unless pixel spacing is present in a medical format.');
  hideLoading();
}
function inferRegionFromFilename(name){ const t=(name||'').toUpperCase(); if(/BRAIN|HEAD|SKULL/.test(t))return'SKULL';if(/NECK|CERVICAL/.test(t))return'NECK';if(/CHEST|LUNG|THORAX/.test(t))return'CHEST';if(/ABDOM|LIVER|KIDNEY|PANCREAS/.test(t))return'ABDOMEN';if(/PELV|HIP/.test(t))return'PELVIS';if(/HAND|FOOT|KNEE|ANKLE|WRIST|ELBOW|SHOULDER/.test(t))return'EXTREMITY';return'UNKNOWN'; }

function initDust(){
  state.dust = Array.from({length:1600},(_,i) => {
    const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random());
    return {x:Math.cos(a)*r,y:Math.sin(a)*r,z:Math.random(),s:.4+Math.random()*2.2,a:.018+Math.random()*.16,p:Math.random()*Math.PI*2,v:.15+Math.random()*.7,heat:Math.random()};
  });
}
function startDust(){
  stopDust(); if(!state.dust.length)initDust();
  const ctx=els.dustCanvas.getContext('2d');
  const draw=()=>{
    const r=els.workspace.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(els.dustCanvas.width!==Math.floor(r.width*dpr)||els.dustCanvas.height!==Math.floor(r.height*dpr)){els.dustCanvas.width=Math.floor(r.width*dpr);els.dustCanvas.height=Math.floor(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
    ctx.clearRect(0,0,r.width,r.height);state.dustT+=.005;const t=state.dustT,cx=r.width/2,cy=r.height/2,rx=Math.min(r.width,r.height)*.48,ry=Math.min(r.width,r.height)*.34;
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.min(r.width,r.height)*.52);glow.addColorStop(0,'rgba(255,76,45,.06)');glow.addColorStop(.3,'rgba(45,160,255,.08)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,r.width,r.height);
    for(const p of state.dust){const driftX=Math.sin(t*(.7+p.v)+p.p)*34+Math.cos(t*.23+p.p)*15,driftY=Math.cos(t*(.55+p.v*.6)+p.p*1.3)*25+Math.sin(t*.18+p.p)*11;const x=cx+p.x*rx+driftX,y=cy+p.y*ry+driftY;const z=.35+.65*(.5+.5*Math.sin(t*.9+p.p*2));const alpha=p.a*z,sz=p.s*(.7+z);if(p.heat>.84){ctx.fillStyle=p.heat>.94?`rgba(255,84,38,${alpha})`:`rgba(40,155,255,${alpha})`;}else{const q=Math.round(135+90*z);ctx.fillStyle=`rgba(${q},${Math.min(255,q+11)},${Math.min(255,q+20)},${alpha})`;}ctx.fillRect(x,y,sz,sz);}
    state.dustRAF=requestAnimationFrame(draw);
  };draw();
}
function stopDust(){ if(state.dustRAF)cancelAnimationFrame(state.dustRAF);state.dustRAF=0;const c=els.dustCanvas.getContext('2d');c.clearRect(0,0,els.dustCanvas.width,els.dustCanvas.height); }

function applyWorkspaceLayout(){
  els.workspace.classList.toggle('slice-primary', state.slicePrimary);
  els.workspace.classList.toggle('slice-minimized', state.sliceMinimized);
  els.swapViews.title = state.slicePrimary ? 'Restore 3D as main view' : 'Make slice the main view';
  els.minimizeSlice.textContent = state.sliceMinimized ? '□' : '—';
  els.minimizeSlice.title = state.sliceMinimized ? 'Restore slice' : 'Minimize slice';
  requestAnimationFrame(() => {
    try { state.engine?.resize(true, false); } catch (_) {}
    try {
      if(state.mode === 'volume') state.engine?.renderViewports([VIEWPORT_MAIN, VIEWPORT_SLICE]);
      else state.engine?.renderViewport(VIEWPORT_MAIN);
    } catch (_) { try { state.engine?.render(); } catch (_) {} }
    resizeOverlay();
    drawWorldOverlay();
  });
}

function toggleSliceMinimize(){
  if(state.mode !== 'volume') return;
  state.sliceMinimized = !state.sliceMinimized;
  if(state.sliceMinimized) state.slicePrimary = false;
  applyWorkspaceLayout();
}

function toggleViewSwap(){
  if(state.mode !== 'volume') return;
  if(state.sliceMinimized) state.sliceMinimized = false;
  state.slicePrimary = !state.slicePrimary;
  applyWorkspaceLayout();
}

function resizeOverlay(){
  const r=els.volumeViewport.getBoundingClientRect(); els.worldOverlay.setAttribute('viewBox',`0 0 ${Math.max(1,r.width)} ${Math.max(1,r.height)}`);
  try { state.engine?.resize(true,true); } catch (_) {}
}
window.addEventListener('resize', resizeOverlay);

// UI events
for(const input of [els.fileInput, els.folderInput]){
  input.addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])];
    if(!files.length){
      showToast('No files selected', 2200);
      return;
    }
    setNotice(`Selected ${files.length} local file${files.length === 1 ? '' : 's'}. Preparing imaging pipeline…`);
    await handleFiles(files);
  });
}

['dragenter','dragover'].forEach(ev=>els.workspace.addEventListener(ev,e=>{e.preventDefault();els.workspace.classList.add('drop-active');}));
['dragleave','drop'].forEach(ev=>els.workspace.addEventListener(ev,e=>{e.preventDefault();els.workspace.classList.remove('drop-active');}));
els.workspace.addEventListener('drop',e=>handleFiles([...e.dataTransfer.files]));

$$('#colorMode button').forEach(btn=>btn.addEventListener('click',()=>{ $$('#colorMode button').forEach(x=>x.classList.toggle('active',x===btn));state.colorMode=btn.dataset.mode;applyVisualization(); }));
$$('#planeMode button').forEach(btn=>btn.addEventListener('click',()=>updateSlicePlane(btn.dataset.plane,true)));

function bindRange(el,out,fn,fmt){
  el.addEventListener('input',()=>{
    fn(+el.value);
    out.textContent=fmt(+el.value);
    scheduleVisualization();
  });
}
bindRange(els.contrast,els.contrastOut,v=>state.contrast=v/100,v=>`${v}%`);
bindRange(els.brightness,els.brightnessOut,v=>state.brightness=v,v=>v>0?`+${v}`:`${v}`);
bindRange(els.threshold,els.thresholdOut,v=>state.threshold=v/100,v=>`${v}%`);
// Quality only changes ray sampling; do not rebuild color/opacity transfer
// functions or re-render the synchronized slice on every slider tick.
els.density.addEventListener('input',()=>{
  const v=+els.density.value; state.density=v/100; els.densityOut.textContent=`${v}%`;
  applySampleQuality(false, true);
});
bindRange(els.opacity,els.opacityOut,v=>state.opacity=v/100,v=>`${v}%`);
// Coalesce rapid slider events so old asynchronous slice jumps cannot queue.
els.slicePosition.addEventListener('input',()=>{
  clearTimeout(state.sliceJumpTimer);
  state.sliceJumpTimer=setTimeout(jumpToSlider, 35);
});
els.splicerToggle.addEventListener('click',()=>{state.showPlane=!state.showPlane;els.splicerToggle.classList.toggle('active',state.showPlane);els.splicerToggle.setAttribute('aria-pressed',String(state.showPlane));drawWorldOverlay();});
els.axisToggle.addEventListener('click',()=>{state.showAxes=!state.showAxes;els.axisToggle.classList.toggle('active',state.showAxes);els.axisToggle.setAttribute('aria-pressed',String(state.showAxes));drawWorldOverlay();});
els.measureTool.addEventListener('click',()=>setAnnotationTool('measure'));
els.markerTool.addEventListener('click',()=>setAnnotationTool('marker'));
els.clearTools.addEventListener('click',()=>{annotation.state.removeAllAnnotations();state.engine?.render();showToast('Measurements and markers cleared');});
els.resetView.addEventListener('click',()=>{if(!state.mode)return;const main=state.engine.getViewport(VIEWPORT_MAIN);main?.resetCamera();if(state.mode==='volume')state.engine.getViewport(VIEWPORT_SLICE)?.resetCamera();try{state.engine.renderViewports(state.mode==='volume'?[VIEWPORT_MAIN,VIEWPORT_SLICE]:[VIEWPORT_MAIN]);}catch(_){state.engine.render();}});
// Adaptive volume quality: coarse while the user rotates/zooms, selected
// quality again almost immediately after interaction ends.
els.volumeViewport.addEventListener('pointerdown',()=>setInteractiveQuality(true),{passive:true});
window.addEventListener('pointerup',()=>{if(state.mode==='volume'){clearTimeout(state.qualityRestoreTimer);state.qualityRestoreTimer=setTimeout(()=>{state.interactiveQuality=false;applySampleQuality(false,true);},80);}}, {passive:true});
els.volumeViewport.addEventListener('wheel',()=>setInteractiveQuality(true),{passive:true});
els.anatomySearch.addEventListener('input', e => renderAnatomyResults(e.target.value));
els.anatomySearch.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ els.anatomyResults.classList.add('hidden'); return; }
  if(e.key !== 'Enter') return;
  const hit = anatomySearchMatches(e.target.value)[0];
  if(hit){
    els.anatomyResults.classList.add('hidden');
    selectAnatomy(hit, {autoIsolate:state.mode === 'volume'});
  } else {
    showToast(`No anatomical reference for “${e.target.value.trim()}”`, 3200);
  }
});
els.focusAnatomy.addEventListener('click', focusSelectedAnatomy);
els.isolateAnatomy.addEventListener('click', isolateSelectedAnatomy);
els.resetIsolation.addEventListener('click', () => resetAnatomyIsolation());
els.swapViews.addEventListener('click', toggleViewSwap);
els.minimizeSlice.addEventListener('click', toggleSliceMinimize);

// Start the visual shell immediately. Cornerstone is initialized lazily after the
// user selects a study so a worker/WASM problem can never block the native file picker.
hideLoading();
startDust();

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled SCAN//SPACE promise rejection:', event.reason);
  hideLoading();
  setNotice(`ENGINE ERROR: ${event.reason?.message || event.reason || 'Unknown asynchronous error'}`);
});

window.addEventListener('error', (event) => {
  console.error('SCAN//SPACE runtime error:', event.error || event.message);
});
