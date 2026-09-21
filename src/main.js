let coreInit, RenderingEngine, Enums, volumeLoader, imageLoader, metaData, addVolumesToViewports, setVolumesForViewports, utilities, cache, eventTarget;
let dicomLoaderInit, wadouri;
let toolsInit, addTool, ToolGroupManager, csToolsEnums, LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool, annotation;
let CrosshairsTool, ProbeTool, RectangleROITool, EllipticalROITool, CircleROITool, AngleTool, BidirectionalTool, CobbAngleTool;
let dicomParser, unzipSync, vtkPlane;
let modulesLoaded = false;

async function loadImagingModules(){
  if(modulesLoaded) return;
  const [core, dicomLoader, tools, dicomParserModule, fflate, vtkPlaneModule] = await Promise.all([
    import('@cornerstonejs/core'),
    import('@cornerstonejs/dicom-image-loader'),
    import('@cornerstonejs/tools'),
    import('dicom-parser'),
    import('fflate'),
    import('@kitware/vtk.js/Common/DataModel/Plane'),
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
    eventTarget,
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

  CrosshairsTool = tools.CrosshairsTool;
  ProbeTool = tools.ProbeTool;
  RectangleROITool = tools.RectangleROITool;
  EllipticalROITool = tools.EllipticalROITool;
  CircleROITool = tools.CircleROITool;
  AngleTool = tools.AngleTool;
  BidirectionalTool = tools.BidirectionalTool;
  CobbAngleTool = tools.CobbAngleTool;

  dicomParser = dicomParserModule.default || dicomParserModule;
  unzipSync = fflate.unzipSync;
  vtkPlane = vtkPlaneModule.default || vtkPlaneModule;

  const required = {
    coreInit, RenderingEngine, Enums, volumeLoader, imageLoader, metaData,
    dicomLoaderInit, wadouri, toolsInit, addTool, ToolGroupManager,
    LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool,
    TrackballRotateTool, annotation, dicomParser, unzipSync, vtkPlane, eventTarget,
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
  identifyResult: $('#identifyResult'),
  identifySummary: $('#identifySummary'),
  identifyCandidates: $('#identifyCandidates'),
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
  sliceAnatomyOverlay: $('#sliceAnatomyOverlay'), sliceAnatomyRing: $('#sliceAnatomyRing'),
  sliceAnatomyH: $('#sliceAnatomyH'), sliceAnatomyV: $('#sliceAnatomyV'), sliceAnatomyLabel: $('#sliceAnatomyLabel'),
  mprSagittalDock: $('#mprSagittalDock'), mprCoronalDock: $('#mprCoronalDock'),
  mprSagittal: $('#mprSagittal'), mprCoronal: $('#mprCoronal'), mprToggle: $('#mprToggle'),
  orientationCube: $('#orientationCube'), cineToggle: $('#cineToggle'), cineFps: $('#cineFps'), cineFpsOut: $('#cineFpsOut'),
  probeTool: $('#probeTool'), rectRoiTool: $('#rectRoiTool'), ellipseRoiTool: $('#ellipseRoiTool'), identifyTool: $('#identifyTool'), angleTool: $('#angleTool'), bidirTool: $('#bidirTool'), cobbTool: $('#cobbTool'),
  bookmarkList: $('#bookmarkList'), bookmarkCount: $('#bookmarkCount'), undoTool: $('#undoTool'), redoTool: $('#redoTool'),
  exportPng: $('#exportPng'), exportJson: $('#exportJson'), seriesChooser: $('#seriesChooser'), seriesList: $('#seriesList'), windowPresets: $('#windowPresets'),
  roiContext: $('#roiContext'), roiContextOut: $('#roiContextOut'), shadingToggle: $('#shadingToggle'),
};

const VIEWPORT_MAIN = 'SCANSPACE_MAIN';
const VIEWPORT_SLICE = 'SCANSPACE_SLICE';
const VIEWPORT_SAG = 'SCANSPACE_SAGITTAL';
const VIEWPORT_COR = 'SCANSPACE_CORONAL';
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
  roiClipPlanes: [],
  roiClipUpdaterOriginal: null,
  roiCameraGuardInstalled: false,
  roiReapplyRAF: 0,
  slicePrimary: false,
  sliceMinimized: false,
  sliceDockPos: null,
  sliceDrag: null,
  measurementCalibrated: false,
  annotationListenerInstalled: false,
  skeletonPreset: false,
  mprMode: false,
  cinePlaying: false,
  cineTimer: 0,
  cineFps: 8,
  bookmarks: [],
  annotationHistory: [],
  annotationRedo: [],
  annotationSnapshotLock: false,
  presetVOI: null,
  selectedSeriesUID: null,
  allSeriesSummary: [],
  isolationContext: 0,
  shading:false,
  identifyMatches: [],
  identifyCenterWorld: null,
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

  [LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool, TrackballRotateTool, CrosshairsTool, ProbeTool, RectangleROITool, EllipticalROITool, CircleROITool, AngleTool, BidirectionalTool, CobbAngleTool].filter(Boolean).forEach((tool) => {
    try { addTool(tool); } catch (_) { /* tool may already be registered after hot reload */ }
  });

  registerWebImageLoader();
  state.engine = new RenderingEngine('SCANSPACE_RENDERING_ENGINE');
  installAnnotationLifecycle();
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
  try { state.engine.disableElement(VIEWPORT_SAG); } catch (_) {}
  try { state.engine.disableElement(VIEWPORT_COR); } catch (_) {}
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
  state.sliceDockPos = null;
  state.measurementCalibrated = false;
  state.skeletonPreset = false;
  stopCine();
  state.isolationContext=0; if(els.roiContext){els.roiContext.value='0';els.roiContextOut.textContent='0%';}
  state.mprMode = false; state.bookmarks = []; state.annotationHistory = []; state.annotationRedo = []; state.presetVOI = null;
  els.workspace.classList.remove('mpr-mode'); els.orientationCube?.classList.add('hidden');
  renderBookmarks();
  els.sliceDock.style.left = ''; els.sliceDock.style.top = ''; els.sliceDock.style.right = ''; els.sliceDock.style.bottom = '';
  els.workspace.classList.remove('slice-primary','slice-minimized');
  els.anatomySelection.classList.add('hidden');
  els.anatomyResults.classList.add('hidden');
  els.identifyResult?.classList.add('hidden');
  if(els.identifyCandidates) els.identifyCandidates.innerHTML = '';
  state.identifyMatches = []; state.identifyCenterWorld = null;
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
    studyDate: str('x00080020'), acquisitionDate: str('x00080022'), seriesNumber: str('x00200011'), patientPosition: str('x00185100'),
    manufacturer: str('x00080070'), model: str('x00081090'), contrastAgent: str('x00180010'), kVp: str('x00180060'), magneticFieldStrength: str('x00180087'),
    rows, cols, numberOfFrames,
  };
}

function chooseDicomSeries(allSeries){
  return new Promise((resolve) => {
    els.seriesList.innerHTML = allSeries.map((series, i) => {
      const m = series[0] || {};
      const desc = m.seriesDesc || m.studyDesc || `Series ${i+1}`;
      return `<button class="series-option" data-series-index="${i}"><span><b>${escapeHtml(desc)}</b><span>${escapeHtml(m.modality || 'DICOM')} · ${escapeHtml(m.body || 'body region not specified')}</span></span><em>${totalFrames(series)} FRAME${totalFrames(series)===1?'':'S'}</em></button>`;
    }).join('');
    els.seriesChooser.classList.remove('hidden');
    const buttons=[...els.seriesList.querySelectorAll('.series-option')];
    const finish=(series)=>{els.seriesChooser.classList.add('hidden');resolve(series);};
    buttons.forEach(btn=>btn.addEventListener('click',()=>finish(allSeries[+btn.dataset.seriesIndex]),{once:true}));
  });
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
  state.allSeriesSummary = allSeries.map(s => ({ uid:s[0]?.seriesUID || '', modality:s[0]?.modality || 'DICOM', description:s[0]?.seriesDesc || s[0]?.studyDesc || 'Unnamed series', frames:totalFrames(s) }));
  const series = allSeries.length > 1 ? await chooseDicomSeries(allSeries) : allSeries[0];
  if(!series) throw new Error('No DICOM series selected.');
  state.selectedSeriesUID = series[0]?.seriesUID || null;

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

  state.stackImageIds = [...imageIds];
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
    { viewportId: VIEWPORT_SAG, type: Enums.ViewportType.ORTHOGRAPHIC, element: els.mprSagittal, defaultOptions: { orientation: Enums.OrientationAxis.SAGITTAL, background:[0,0,0] } },
    { viewportId: VIEWPORT_COR, type: Enums.ViewportType.ORTHOGRAPHIC, element: els.mprCoronal, defaultOptions: { orientation: Enums.OrientationAxis.CORONAL, background:[0,0,0] } },
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
    [VIEWPORT_MAIN, VIEWPORT_SLICE, VIEWPORT_SAG, VIEWPORT_COR],
    true
  );

  setupVolumeTools();
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const slice = state.engine.getViewport(VIEWPORT_SLICE);
  const sag = state.engine.getViewport(VIEWPORT_SAG);
  const cor = state.engine.getViewport(VIEWPORT_COR);

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
  sag?.resetCamera?.();
  cor?.resetCamera?.();
  try { main.setCamera({ parallelProjection: false }); } catch (_) {}
  applyVisualization(true);
  main.render();
  slice.render();
  sag?.render?.();
  cor?.render?.();
  state.engine.render();

  state.imageGeometry = getVolumeGeometry(state.volume, meta);
  state.measurementCalibrated = !!(state.imageGeometry?.spacing?.length === 3 && state.imageGeometry.spacing.every(v => Number.isFinite(v) && v > 0));
  finishStudyUI({
    modality: meta.modality,
    series: meta.seriesDesc || 'DICOM SERIES',
    dimensions: formatVolumeDimensions(state.volume, firstImage, imageIds.length),
    voxel: formatVolumeSpacing(state.volume, meta),
  });
  updateSlicePlane('axial', true);
  els.orientationCube?.classList.remove('hidden');
  snapshotAnnotations('initial');
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
  snapshotAnnotations('initial');
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
  const sliceTools=[LengthTool, ArrowAnnotateTool, PanTool, ZoomTool, StackScrollTool, CrosshairsTool, ProbeTool, RectangleROITool, EllipticalROITool, CircleROITool, AngleTool, BidirectionalTool, CobbAngleTool].filter(Boolean);
  sliceTools.forEach(tool=>{ try{ sliceGroup.addTool(tool.toolName); }catch(_){} });
  [LengthTool,ArrowAnnotateTool,ProbeTool,RectangleROITool,EllipticalROITool,CircleROITool,AngleTool,BidirectionalTool,CobbAngleTool,CrosshairsTool].filter(Boolean).forEach(tool=>{ try{sliceGroup.setToolPassive(tool.toolName);}catch(_){} });
  sliceGroup.setToolActive(PanTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Auxiliary }] });
  sliceGroup.setToolActive(ZoomTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Secondary }] });
  sliceGroup.setToolActive(StackScrollTool.toolName, { bindings:[{ mouseButton:csToolsEnums.MouseBindings.Wheel }] });
  [VIEWPORT_SLICE,VIEWPORT_SAG,VIEWPORT_COR].forEach(id=>sliceGroup.addViewport(id, state.engine.id));
}

function setupStackTools(){
  const group=ToolGroupManager.createToolGroup(TOOLGROUP_STACK);
  [LengthTool,ArrowAnnotateTool,PanTool,ZoomTool,StackScrollTool,ProbeTool,RectangleROITool,EllipticalROITool,CircleROITool,AngleTool,BidirectionalTool,CobbAngleTool].filter(Boolean).forEach(tool=>{try{group.addTool(tool.toolName);}catch(_){}});
  [LengthTool,ArrowAnnotateTool,ProbeTool,RectangleROITool,EllipticalROITool,CircleROITool,AngleTool,BidirectionalTool,CobbAngleTool].filter(Boolean).forEach(tool=>{try{group.setToolPassive(tool.toolName);}catch(_){}});
  group.setToolActive(PanTool.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Auxiliary}]});
  group.setToolActive(ZoomTool.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Secondary}]});
  group.setToolActive(StackScrollTool.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Wheel}]});
  group.addViewport(VIEWPORT_MAIN,state.engine.id);
}

function getAnnotationToolGroup(){
  return ToolGroupManager.getToolGroup(state.mode === 'volume' ? TOOLGROUP_SLICE : TOOLGROUP_STACK);
}
function setAnnotationTool(which){
  if(!state.mode) return;
  const group=getAnnotationToolGroup(); if(!group) return;
  allInteractiveAnnotationTools().forEach(t=>{try{group.setToolPassive(t.toolName);}catch(_){}});
  if(state.activeTool===which){ state.activeTool=null; }
  else { state.activeTool=which; const ToolClass=which==='measure'?LengthTool:ArrowAnnotateTool; try{group.setToolActive(ToolClass.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Primary}]});}catch(e){console.warn(e);} }
  clearAnnotationButtonStates();
  els.measureTool.classList.toggle('active',state.activeTool==='measure'); els.markerTool.classList.toggle('active',state.activeTool==='marker');
  els.measureReadout.textContent=state.activeTool==='measure'?`MEASURE ACTIVE · WORLD-SPACE LENGTH · ${state.measurementCalibrated?'DICOM CALIBRATED':'UNCALIBRATED'}`:state.activeTool==='marker'?'MARKER ACTIVE · PLACE AN ARROW AND ENTER A LABEL':'SPATIAL IMAGE TOOLS · NO DIAGNOSTIC INTERPRETATION';
  if(!state.activeTool && state.mprMode) activateCrosshairs();
}

function allInteractiveAnnotationTools(){ return [LengthTool,ArrowAnnotateTool,ProbeTool,RectangleROITool,EllipticalROITool,CircleROITool,AngleTool,BidirectionalTool,CobbAngleTool,CrosshairsTool].filter(Boolean); }
function clearAnnotationButtonStates(){[els.measureTool,els.markerTool,els.probeTool,els.rectRoiTool,els.ellipseRoiTool,els.identifyTool,els.angleTool,els.bidirTool,els.cobbTool].forEach(b=>b?.classList.remove('active'));}
function setAdvancedTool(which, ToolClass, label){
  if(!state.mode || !ToolClass){ showToast(`${label} is unavailable in this imaging-engine build`,3200); return; }
  const group=getAnnotationToolGroup(); if(!group) return;
  allInteractiveAnnotationTools().forEach(t=>{ try{group.setToolPassive(t.toolName);}catch(_){} });
  state.activeTool = state.activeTool===which ? null : which;
  clearAnnotationButtonStates();
  if(state.activeTool){
    try{ group.setToolActive(ToolClass.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Primary}]}); }catch(e){ console.warn(e); showToast(`${label} could not be activated`,3200); return; }
    const el=els[`${which}Tool`]; el?.classList.add('active');
    els.measureReadout.textContent=`${label.toUpperCase()} ACTIVE · PHYSICAL DICOM SPACE`;
  } else {
    els.measureReadout.textContent='SPATIAL IMAGE TOOLS · NO DIAGNOSTIC INTERPRETATION';
    if(state.mprMode) activateCrosshairs();
  }
}
function activateCrosshairs(){
  if(!CrosshairsTool || state.mode!=='volume') return;
  const group=getAnnotationToolGroup(); if(!group) return;
  allInteractiveAnnotationTools().forEach(t=>{try{group.setToolPassive(t.toolName);}catch(_){}});
  try{group.setToolActive(CrosshairsTool.toolName,{bindings:[{mouseButton:csToolsEnums.MouseBindings.Primary}]}); state.activeTool='crosshairs'; els.measureReadout.textContent='MPR CROSSHAIRS · CLICK/DRAG TO SYNCHRONIZE PLANES';}catch(e){console.warn('Crosshairs unavailable',e);}
}
function cloneState(v){ try{return structuredClone(v);}catch(_){try{return JSON.parse(JSON.stringify(v));}catch(__){return null;}} }
function snapshotAnnotations(reason='change'){
  if(state.annotationSnapshotLock || !annotation?.state?.getAnnotationManager) return;
  try{ const mgr=annotation.state.getAnnotationManager(); const snap=cloneState(mgr.saveAnnotations?.()); if(!snap) return; state.annotationHistory.push({reason,state:snap}); if(state.annotationHistory.length>60) state.annotationHistory.shift(); state.annotationRedo=[]; }catch(e){console.warn('Annotation history snapshot failed',e);}
}
function restoreAnnotationSnapshot(snap){
  if(!snap || !annotation?.state?.getAnnotationManager) return;
  try{ state.annotationSnapshotLock=true; const mgr=annotation.state.getAnnotationManager(); mgr.removeAllAnnotations?.(); mgr.restoreAnnotations?.(cloneState(snap.state)); state.engine?.render?.(); rebuildBookmarksFromAnnotations(); }finally{state.annotationSnapshotLock=false;}
}
function undoAnnotation(){ if(state.annotationHistory.length<2){showToast('Nothing to undo',1800);return;} const current=state.annotationHistory.pop(); state.annotationRedo.push(current); restoreAnnotationSnapshot(state.annotationHistory[state.annotationHistory.length-1]); showToast('Annotation change undone',1800); }
function redoAnnotation(){ const next=state.annotationRedo.pop(); if(!next){showToast('Nothing to redo',1800);return;} state.annotationHistory.push(next); restoreAnnotationSnapshot(next); showToast('Annotation change restored',1800); }
function rebuildBookmarksFromAnnotations(){
  const anns=annotation?.state?.getAllAnnotations?.()||[]; state.bookmarks=[];
  for(const ann of anns){ if(ann?.metadata?.toolName===ArrowAnnotateTool?.toolName){ const p=ann.data?.handles?.points?.[0]; if(p) state.bookmarks.push({uid:ann.annotationUID,world:[...p],label:ann.data?.text||ann.data?.label||`Marker ${state.bookmarks.length+1}`}); }}
  renderBookmarks();
}
function renderBookmarks(){
  if(!els.bookmarkList) return; els.bookmarkCount.textContent=String(state.bookmarks.length);
  if(!state.bookmarks.length){els.bookmarkList.className='bookmark-list empty';els.bookmarkList.textContent='No saved markers yet.';return;}
  els.bookmarkList.className='bookmark-list'; els.bookmarkList.innerHTML=state.bookmarks.map((b,i)=>`<button class="bookmark-item" data-bookmark="${i}"><span>${escapeHtml(b.label||`Marker ${i+1}`)}</span><small>GO TO</small></button>`).join('');
  els.bookmarkList.querySelectorAll('[data-bookmark]').forEach(btn=>btn.addEventListener('click',()=>goToBookmark(state.bookmarks[+btn.dataset.bookmark])));
}
async function goToBookmark(b){
  if(!b?.world || state.mode!=='volume') return;
  for(const id of [VIEWPORT_SLICE,VIEWPORT_SAG,VIEWPORT_COR]){ const vp=state.engine?.getViewport?.(id); try{ vp?.jumpToWorld?.(b.world); }catch(_){ try{utilities.jumpToWorld?.(vp,b.world);}catch(__){} } }
  const main=state.engine?.getViewport?.(VIEWPORT_MAIN); const cam=main?.getCamera?.(); if(cam?.position&&cam?.focalPoint){const d=[b.world[0]-cam.focalPoint[0],b.world[1]-cam.focalPoint[1],b.world[2]-cam.focalPoint[2]];try{main.setCamera({focalPoint:b.world,position:[cam.position[0]+d[0],cam.position[1]+d[1],cam.position[2]+d[2]]});}catch(_){}}
  try{state.engine.render();}catch(_){} showToast(b.label||'Marker',1600);
}
function statsSummary(ann){
  const stats=ann?.data?.cachedStats||{}; const values=Object.values(stats); const st=values.find(v=>v&&typeof v==='object')||{};
  const fields=[]; for(const [k,label] of [['mean','MEAN'],['max','MAX'],['min','MIN'],['stdDev','SD'],['area','AREA'],['length','LENGTH'],['width','WIDTH'],['angle','ANGLE']]){ if(Number.isFinite(st[k])) fields.push(`${label} ${Number(st[k]).toFixed(k==='area'?1:2)}`); } return fields.join(' · ');
}

function installAnnotationLifecycle(){
  if(state.annotationListenerInstalled || !eventTarget || !csToolsEnums?.Events?.ANNOTATION_COMPLETED) return;
  eventTarget.addEventListener(csToolsEnums.Events.ANNOTATION_COMPLETED, (evt) => {
    const ann = evt?.detail?.annotation; if(!ann) return; const toolName=ann.metadata?.toolName;
    if(toolName === LengthTool?.toolName){ const pts=ann.data?.handles?.points||[]; if(pts.length>=2){const a=pts[0],b=pts[1],mm=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);els.measureReadout.textContent=`MEASURE SAVED · ${mm.toFixed(1)} mm · ${state.measurementCalibrated?'DICOM WORLD-SPACE':'UNCALIBRATED'}`;} }
    else if(toolName === ArrowAnnotateTool?.toolName){ const p=ann.data?.handles?.points?.[0]; if(p){state.bookmarks.push({uid:ann.annotationUID,world:[...p],label:ann.data?.text||ann.data?.label||`Marker ${state.bookmarks.length+1}`});renderBookmarks();} els.measureReadout.textContent='MARKER SAVED · BOOKMARKED FOR THIS STUDY SESSION'; }
    else if(toolName === CircleROITool?.toolName && state.activeTool === 'identify'){ handleCircleIdentify(ann); }
    else { const summary=statsSummary(ann); els.measureReadout.textContent=summary ? `${toolName} · ${summary}` : `${toolName || 'ANNOTATION'} SAVED · DICOM WORLD SPACE`; }
    snapshotAnnotations(toolName||'annotation'); try{state.engine?.render();}catch(_){}
  });
  state.annotationListenerInstalled = true;
}

function clearMeasurementsKeepMarkers(){
  const all=annotation?.state?.getAllAnnotations?.()||[]; let removed=0;
  const removable=new Set([LengthTool,ProbeTool,RectangleROITool,EllipticalROITool,CircleROITool,AngleTool,BidirectionalTool,CobbAngleTool].filter(Boolean).map(t=>t.toolName));
  for(const ann of all){ if(removable.has(ann?.metadata?.toolName)&&ann.annotationUID){try{annotation.state.removeAnnotation(ann.annotationUID);removed++;}catch(_){}} }
  try{state.engine?.render();}catch(_){} if(removed)snapshotAnnotations('clear measurements');
  showToast(removed?`Cleared ${removed} measurement/ROI annotation${removed===1?'':'s'} · markers preserved`:'No measurements or ROIs to clear · markers preserved',2600);
}

function setZoomForViewport(viewport, factor){
  if(!viewport?.getZoom || !viewport?.setZoom) return;
  try {
    const current = Number(viewport.getZoom()) || 1;
    const next = clamp(current * factor, .15, 12);
    viewport.setZoom(next);
    viewport.render?.();
  } catch (e) { console.warn('Zoom adjustment failed', e); }
}

function skeletalThresholdFraction(){
  const [min,max] = state.scalarRange || [0,255];
  const span = Math.max(1e-6, max-min);
  if(String(state.modality || '').toUpperCase() === 'CT' && min < 250 && max > 250){
    return clamp((250-min)/span, .05, .80);
  }
  return .52;
}

function applySkeletalPreset(){
  state.skeletonPreset = true;
  state.colorMode = 'skeletal';
  state.brightness = 80;
  state.contrast = 1.45;
  state.threshold = skeletalThresholdFraction();
  state.opacity = 1;
  state.density = Math.max(state.density, .85);
  els.brightness.value = '80'; els.brightnessOut.textContent = '+80';
  els.contrast.value = '145'; els.contrastOut.textContent = '145%';
  els.threshold.value = String(Math.round(state.threshold*100)); els.thresholdOut.textContent = `${Math.round(state.threshold*100)}%`;
  els.opacity.value = '100'; els.opacityOut.textContent = '100%';
  els.density.value = String(Math.round(state.density*100)); els.densityOut.textContent = `${Math.round(state.density*100)}%`;
  setNotice(String(state.modality||'').toUpperCase()==='CT'
    ? 'SKELETAL MODE · high-density CT voxels emphasized using a bone-oriented threshold and maximum brightness. Visualization only; not a diagnostic bone segmentation.'
    : 'SKELETAL MODE · high-intensity structures emphasized. Non-CT modalities do not map intensity to bone density reliably, so this is an approximate visualization preset.');
  applyVisualization();
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
  const base = state.presetVOI || state.voiRange || { lower:state.scalarRange[0], upper:state.scalarRange[1] };
  const rawSpan = Math.max(1e-6, base.upper - base.lower);
  const center = (base.lower + base.upper)/2 + (state.brightness/80) * rawSpan * .4;
  const span = rawSpan / Math.max(.3, state.contrast);
  return { lower:center-span/2, upper:center+span/2 };
}

const CT_PRESETS = {
  soft:{name:'SOFT TISSUE',center:40,width:400},
  lung:{name:'LUNG',center:-600,width:1500},
  bone:{name:'BONE',center:400,width:1800},
  brain:{name:'BRAIN',center:40,width:80},
  abdomen:{name:'ABDOMEN',center:50,width:350},
  vessel:{name:'VESSEL',center:200,width:600},
};
function applyWindowPreset(key){
  const p=CT_PRESETS[key]; if(!p) return;
  state.skeletonPreset=false; state.presetVOI={lower:p.center-p.width/2,upper:p.center+p.width/2}; state.brightness=0; state.contrast=1;
  els.brightness.value='0'; els.brightnessOut.textContent='0'; els.contrast.value='100'; els.contrastOut.textContent='100%';
  $$('#windowPresets button').forEach(b=>b.classList.toggle('active',b.dataset.preset===key));
  setNotice(`${p.name} PRESET · deterministic window/level visualization. No diagnosis or tissue detection is performed.`);
  applyVisualization();
}
function clearWindowPreset(){ state.presetVOI=null; $$('#windowPresets button').forEach(b=>b.classList.remove('active')); }

function applyVisualization(forceVisible=false){
  if(state.mode === 'stack'){ applyStackVOI(); return; }
  if(state.mode !== 'volume') return;
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  const slice = state.engine.getViewport(VIEWPORT_SLICE);
  const sag = state.engine.getViewport(VIEWPORT_SAG);
  const cor = state.engine.getViewport(VIEWPORT_COR);
  let { lower, upper } = effectiveVOIRange();
  // 3D rendering must be driven by the actual actor scalar range. VOI remains
  // useful for MPR display, but a narrow or mismatched VOI can make an entire
  // ray-cast volume transparent.
  const actor = main?.getDefaultActor?.()?.actor;
  const actorRange = actor ? getActorScalarRange(actor) : null;
  let sliceVOI = {lower,upper};
  if(actorRange){
    const [amin, amax] = actorRange;
    if(state.colorMode === 'skeletal'){
      // Skeletal volume rendering needs the full calibrated scalar range so the
      // threshold can target high-density voxels. Keep the MPR slice on a
      // bone-oriented CT window where possible.
      lower = amin; upper = amax;
      if(String(state.modality||'').toUpperCase() === 'CT'){
        sliceVOI = {lower:Math.max(amin,-500), upper:Math.min(amax,1500)};
      } else {
        sliceVOI = {lower:amin + (amax-amin)*.30, upper:amax};
      }
    } else if(forceVisible || upper <= amin || lower >= amax || (upper-lower) < (amax-amin)*0.01){
      lower = amin;
      upper = amax;
      sliceVOI = {lower,upper};
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
  for(const vp of [slice,sag,cor]){ try { vp?.setProperties?.({ voiRange:sliceVOI }); } catch (_) {} }

  for(const [vp, isMain] of [[main,true],[slice,false],[sag,false],[cor,false]]){
    const actorEntry = vp?.getDefaultActor?.();
    const prop = actorEntry?.actor?.getProperty?.();
    if(!prop) continue;
    if(isMain){ try{prop.setShade?.(!!state.shading); if(state.shading){prop.setAmbient?.(.28);prop.setDiffuse?.(.72);prop.setSpecular?.(.18);prop.setSpecularPower?.(12);}}catch(_){} }
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
  try { state.engine.renderViewports([VIEWPORT_MAIN, VIEWPORT_SLICE, VIEWPORT_SAG, VIEWPORT_COR]); } catch (_) { main.render(); slice.render(); sag?.render?.(); cor?.render?.(); }
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
  } else if(mode === 'skeletal'){
    p(0,0,0,0); p(.45,.03,.03,.03); p(.62,.44,.44,.42); p(.78,.82,.82,.78); p(.90,.97,.97,.92); p(1,1,1,.98);
  } else if(mode === 'real'){
    // Physically inspired pseudo-color only: warm soft tissue / ivory high-density structures.
    p(0,.05,.025,.018); p(.18,.18,.055,.035); p(.38,.52,.18,.11); p(.58,.80,.42,.28); p(.74,.95,.70,.54); p(.90,.95,.88,.74); p(1,1,.98,.90);
  } else {
    p(0,0,0,0); p(.25,.18,.18,.18); p(.55,.52,.52,.52); p(.82,.82,.82,.82); p(1,1,1,1);
  }
}

function setSliceOrientationLabels(plane){
  const labels=els.sliceDock?.querySelectorAll?.('.orientation-label'); if(!labels?.length)return;
  const map={axial:{top:'A',bottom:'P',left:'R',right:'L'},sagittal:{top:'S',bottom:'I',left:'A',right:'P'},coronal:{top:'S',bottom:'I',left:'R',right:'L'}}[plane]||{};
  for(const el of labels){ for(const pos of ['top','bottom','left','right']) if(el.classList.contains(pos)) el.textContent=map[pos]||''; }
}

async function updateSlicePlane(plane, reset=false){
  if(state.mode !== 'volume') return;
  state.plane = plane;
  setSliceOrientationLabels(plane);
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
  drawSliceAnatomyOverlay();
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
  drawSliceAnatomyOverlay();
}

function drawSliceAnatomyOverlay(){
  if(state.mode !== 'volume' || !state.isolationActive || !state.selectedAnatomyWorld || !state.selectedAnatomy || state.sliceMinimized){
    els.sliceAnatomyOverlay?.classList.add('hidden');
    return;
  }
  const vp = state.engine?.getViewport?.(VIEWPORT_SLICE);
  if(!vp) return;
  try {
    const r = els.sliceViewport.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const g = state.imageGeometry;
    const cam = vp.getCamera?.();
    if(g && cam?.focalPoint && cam?.viewPlaneNormal){
      const vpn = norm(cam.viewPlaneNormal);
      const delta = [state.selectedAnatomyWorld[0]-cam.focalPoint[0],state.selectedAnatomyWorld[1]-cam.focalPoint[1],state.selectedAnatomyWorld[2]-cam.focalPoint[2]];
      const planeDistance = Math.abs(dot(delta,vpn));
      let roiHalfThickness = 0;
      for(let i=0;i<3;i++){
        const halfWorld = g.lengths[i] * (state.selectedAnatomy.size?.[i] || .15) * .5;
        roiHalfThickness += Math.abs(dot(g.axes[i],vpn)) * halfWorld;
      }
      if(planeDistance > roiHalfThickness){
        els.sliceAnatomyOverlay.classList.add('hidden');
        return;
      }
    }
    const center = vp.worldToCanvas(state.selectedAnatomyWorld);
    if(!center?.length) return;
    let radius = Math.min(r.width,r.height) * .10;
    if(g){
      const candidates=[];
      for(let i=0;i<3;i++){
        const halfWorld = g.lengths[i] * (state.selectedAnatomy.size?.[i] || .15) * .5;
        const q = vp.worldToCanvas(add(state.selectedAnatomyWorld, mul(g.axes[i], halfWorld)));
        if(q?.length) candidates.push(Math.hypot(q[0]-center[0], q[1]-center[1]));
      }
      const visible = candidates.filter(v=>Number.isFinite(v) && v>4).sort((a,b)=>b-a);
      if(visible.length) radius = visible[Math.min(1,visible.length-1)] || visible[0];
    }
    radius = clamp(radius, 18, Math.min(92, Math.min(r.width,r.height)*.28));
    els.sliceAnatomyOverlay.setAttribute('viewBox', `0 0 ${Math.max(1,r.width)} ${Math.max(1,r.height)}`);
    els.sliceAnatomyOverlay.classList.remove('hidden');
    els.sliceAnatomyRing.setAttribute('cx', center[0]); els.sliceAnatomyRing.setAttribute('cy', center[1]); els.sliceAnatomyRing.setAttribute('r', radius);
    els.sliceAnatomyH.setAttribute('x1', center[0]-radius*.32); els.sliceAnatomyH.setAttribute('x2', center[0]+radius*.32); els.sliceAnatomyH.setAttribute('y1',center[1]); els.sliceAnatomyH.setAttribute('y2',center[1]);
    els.sliceAnatomyV.setAttribute('x1', center[0]); els.sliceAnatomyV.setAttribute('x2', center[0]); els.sliceAnatomyV.setAttribute('y1',center[1]-radius*.32); els.sliceAnatomyV.setAttribute('y2',center[1]+radius*.32);
    els.sliceAnatomyLabel.setAttribute('x', clamp(center[0]+radius+8, 6, Math.max(6,r.width-150)));
    els.sliceAnatomyLabel.setAttribute('y', clamp(center[1]-radius*.45, 14, Math.max(14,r.height-8)));
    els.sliceAnatomyLabel.textContent = `${state.selectedAnatomy.name} · REFERENCE ROI`;
  } catch (e) {
    console.warn('Could not draw anatomy target on slice', e);
    els.sliceAnatomyOverlay?.classList.add('hidden');
  }
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

function formatDicomDate(v){ if(!v||v.length<8)return v||'—'; return `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`; }
function updateMetadata(info){
  const m=state.seriesMeta||{};
  const rows=[['Modality',info.modality],['Series',info.series],['Series #',m.seriesNumber||'—'],['Dimensions',info.dimensions],['Voxel',info.voxel],['Frames',state.mode==='volume'?(state.volume?.dimensions?.[2]||state.stackImageIds.length||'—'):'1'],['Slice thickness',m.sliceThickness?`${m.sliceThickness} mm`:'—'],['Study date',formatDicomDate(m.studyDate||m.acquisitionDate)],['Patient position',m.patientPosition||'—'],['Manufacturer',m.manufacturer||'—'],['Scanner',m.model||'—']];
  if(m.contrastAgent)rows.push(['Contrast',m.contrastAgent]); if(m.kVp)rows.push(['kVp',m.kVp]); if(m.magneticFieldStrength)rows.push(['Field strength',`${m.magneticFieldStrength} T`]);
  els.metadataList.innerHTML=rows.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd title="${escapeHtml(v)}">${escapeHtml(v)}</dd></div>`).join('');
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


function worldToNormalized(world){
  const g = state.imageGeometry;
  if(!g || !world) return null;
  const rel = [world[0]-g.origin[0], world[1]-g.origin[1], world[2]-g.origin[2]];
  return g.axes.map((axis,i) => clamp(dot(rel,axis) / Math.max(1e-6,g.lengths[i]), 0, 1));
}

function identifyAnatomyAtWorld(world, circleRadiusMm=0, roiMean=null){
  const normPoint = worldToNormalized(world);
  if(!normPoint) return [];
  const candidates = catalogForRegion(state.region);
  const modality = String(state.modality || '').toUpperCase();
  const boneName = /skull|rib|sternum|spine|vertebra|sacrum|pelvis|femur|tibia|fibula|humerus|radius|ulna|patella|mandible|maxilla|teeth|bone/i;
  const airName = /lung|trachea|airway|sinus|nasal cavity/i;
  const ranked = candidates.map(item => {
    const half = item.size.map(v => Math.max(.045, v/2));
    const delta = item.center.map((v,i) => Math.abs(normPoint[i]-v));
    const scaled = delta.map((v,i) => v/half[i]);
    const rawDist = Math.hypot(...delta) / Math.sqrt(3);
    const shapeDist = Math.hypot(...scaled) / Math.sqrt(3);
    const inside = scaled.every(v => v <= 1.05);
    let score = 100 - shapeDist*38 - rawDist*85 + (inside ? 12 : 0);
    if(circleRadiusMm > 0 && state.imageGeometry){
      const roiNorm = circleRadiusMm / Math.max(1,state.imageGeometry.maxExtent);
      const structureScale = (item.size[0]+item.size[1]+item.size[2])/6;
      const sizePenalty = Math.min(20, Math.abs(roiNorm-structureScale)*55);
      score -= sizePenalty;
    }
    // Deterministic CT intensity hint: only a small reranking bonus. Spatial
    // location remains primary, and the UI never calls this a detection.
    if(modality === 'CT' && Number.isFinite(roiMean)){
      if(roiMean < -450){ score += airName.test(item.name) ? 18 : -4; }
      else if(roiMean > 250){ score += (boneName.test(item.name) || /SKELETAL|CERVICAL SPINE|DENTAL/.test(item.group)) ? 18 : -4; }
      else if(roiMean > -120 && roiMean < 220){ score += /THORACIC|ABDOMINAL|URINARY|PELVIC|VASCULAR|SOFT TISSUE|CRANIAL/.test(item.group) ? 4 : 0; }
    }
    return {item, score:clamp(score,0,100), inside, rawDist, normPoint, roiMean};
  }).sort((a,b)=>b.score-a.score);
  return ranked.slice(0,5);
}

function circleAnnotationCenterAndRadius(ann){
  const pts = ann?.data?.handles?.points || [];
  let center = ann?.data?.handles?.center;
  if(!Array.isArray(center) || center.length < 3) center = pts[0];
  if(!center || center.length < 3) return null;
  let radius = 0;
  if(pts.length >= 2){
    const edge = pts[1];
    radius = Math.hypot(edge[0]-center[0], edge[1]-center[1], edge[2]-center[2]);
  }
  return {center:[center[0],center[1],center[2]], radius};
}

function renderIdentifyMatches(matches, centerWorld){
  if(!els.identifyResult || !els.identifyCandidates || !els.identifySummary) return;
  state.identifyMatches = matches;
  state.identifyCenterWorld = centerWorld ? [...centerWorld] : null;
  els.identifyResult.classList.remove('hidden');
  if(!matches.length){
    els.identifySummary.textContent = 'No anatomical reference in the current study region is close enough to this ROI.';
    els.identifyCandidates.innerHTML = '';
    return;
  }
  const best = matches[0];
  const strength = best.score >= 78 ? 'STRONG' : best.score >= 58 ? 'MODERATE' : 'WEAK';
  els.identifySummary.innerHTML = `Closest reference: <b>${escapeHtml(best.item.name)}</b>. Spatial match ${strength.toLowerCase()} (${Math.round(best.score)}/100). This compares location with the anatomy atlas; it does not detect tissue or diagnose the circled object.`;
  els.identifyCandidates.innerHTML = matches.slice(0,3).map((m,i)=>`<button class="identify-candidate" data-identify-index="${i}"><span><b>${escapeHtml(m.item.name)}</b><small>${escapeHtml(m.item.group)} · ${escapeHtml(m.item.regions.join(' / '))}</small></span><em>${Math.round(m.score)}/100</em></button>`).join('') + '<div class="identify-note">Click a candidate to select/focus that anatomical reference. Exact structure naming requires a registered atlas or segmentation; this tool is deterministic and non-AI.</div>';
  els.identifyCandidates.querySelectorAll('[data-identify-index]').forEach(btn=>btn.addEventListener('click',()=>{
    const match=state.identifyMatches[+btn.dataset.identifyIndex];
    if(!match) return;
    els.anatomySearch.value=match.item.name;
    selectAnatomy(match.item,{autoIsolate:false});
  }));
}

function annotationMeanValue(ann){
  const stats = ann?.data?.cachedStats || {};
  for(const value of Object.values(stats)){
    if(value && typeof value === 'object' && Number.isFinite(value.mean)) return Number(value.mean);
  }
  return null;
}

function handleCircleIdentify(ann){
  const geometry = circleAnnotationCenterAndRadius(ann);
  if(!geometry){
    showToast('Could not read the circled ROI geometry',2600);
    return;
  }
  if(state.mode !== 'volume' || !state.imageGeometry){
    els.identifyResult?.classList.remove('hidden');
    if(els.identifySummary) els.identifySummary.textContent='Circle & Identify needs a calibrated volumetric DICOM study so the ROI can be mapped into patient/world coordinates.';
    if(els.identifyCandidates) els.identifyCandidates.innerHTML='';
    return;
  }
  const roiMean = annotationMeanValue(ann);
  const matches = identifyAnatomyAtWorld(geometry.center, geometry.radius, roiMean);
  renderIdentifyMatches(matches, geometry.center);
  if(Number.isFinite(roiMean) && els.identifySummary) els.identifySummary.innerHTML += ` <span class="identify-hu">ROI mean ${roiMean.toFixed(1)}${String(state.modality||'').toUpperCase()==='CT' ? ' HU' : ''}.</span>`;
  if(matches[0]){
    els.measureReadout.textContent=`IDENTIFY · CLOSEST REFERENCE ${matches[0].item.name.toUpperCase()} · ${Math.round(matches[0].score)}/100 · NOT A DETECTION`;
    showToast(`Reference match: ${matches[0].item.name} · ${Math.round(matches[0].score)}/100`,3200);
  }
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

function anatomyClipPlanes(item){
  const g = state.imageGeometry;
  if(!g || !vtkPlane) return [];
  const context=clamp(state.isolationContext||0,0,1);
  const half = item.size.map(v => (v/2)*(1-context) + .5*context);
  const lo = item.center.map((v,i) => clamp(v - half[i], 0, 1));
  const hi = item.center.map((v,i) => clamp(v + half[i], 0, 1));
  const planes = [];

  // VTK clipping keeps the positive side of each plane. Build six inward-facing
  // planes in the scan's own I/J/K axes, so oblique acquisitions are handled
  // correctly instead of approximating the ROI with a world-axis-aligned box.
  for(let axisIndex = 0; axisIndex < 3; axisIndex++){
    const axis = g.axes[axisIndex];
    const centerPoint = [...item.center];

    const minPoint = [...centerPoint];
    minPoint[axisIndex] = lo[axisIndex];
    const minOrigin = normalizedPointToWorld(minPoint);
    planes.push(vtkPlane.newInstance({ origin:minOrigin, normal:[...axis] }));

    const maxPoint = [...centerPoint];
    maxPoint[axisIndex] = hi[axisIndex];
    const maxOrigin = normalizedPointToWorld(maxPoint);
    planes.push(vtkPlane.newInstance({ origin:maxOrigin, normal:axis.map(v => -v) }));
  }
  return planes;
}

function applyFixedROIPlanes({render=true}={}){
  if(!state.isolationActive || !state.roiClipPlanes?.length) return false;
  const { main, actor, mapper } = getMainActorMapper();
  if(!main || !mapper) return false;
  try {
    if(typeof mapper.removeAllClippingPlanes === 'function') mapper.removeAllClippingPlanes();
    if(typeof mapper.setClippingPlanes === 'function'){
      mapper.setClippingPlanes(state.roiClipPlanes);
    } else if(typeof mapper.addClippingPlane === 'function'){
      for(const plane of state.roiClipPlanes) mapper.addClippingPlane(plane);
    } else {
      return false;
    }
    mapper.modified?.();
    actor?.modified?.();
    if(render) main.render?.();
    return true;
  } catch (e) {
    console.warn('Could not reapply fixed anatomy ROI planes', e);
    return false;
  }
}

function installROICameraGuard(){
  if(state.mode !== 'volume' || !state.engine) return;
  const main = state.engine.getViewport(VIEWPORT_MAIN);
  if(!main || state.roiCameraGuardInstalled) return;

  // Cornerstone's BaseVolumeViewport normally updates actor clipping-plane
  // orientation whenever the camera changes. That is useful for slab/slice
  // viewports, but an anatomy-isolation box must remain fixed in patient/world
  // space while the user orbits the 3D camera. Override the instance method
  // only while isolation is active; restore it when the ROI is reset.
  if(typeof main.updateClippingPlanesForActors === 'function'){
    state.roiClipUpdaterOriginal = main.updateClippingPlanesForActors;
    main.updateClippingPlanesForActors = async function(updatedCamera){
      if(state.isolationActive){
        if(state.roiReapplyRAF) cancelAnimationFrame(state.roiReapplyRAF);
        state.roiReapplyRAF = requestAnimationFrame(() => {
          state.roiReapplyRAF = 0;
          applyFixedROIPlanes({render:true});
        });
        return;
      }
      return state.roiClipUpdaterOriginal?.call(this, updatedCamera);
    };
  }

  const cameraEvent = Enums?.Events?.CAMERA_MODIFIED;
  if(cameraEvent){
    const onCameraModified = () => {
      if(!state.isolationActive) return;
      if(state.roiReapplyRAF) cancelAnimationFrame(state.roiReapplyRAF);
      state.roiReapplyRAF = requestAnimationFrame(() => {
        state.roiReapplyRAF = 0;
        applyFixedROIPlanes({render:true});
      });
    };
    els.volumeViewport.addEventListener(cameraEvent, onCameraModified);
    state.roiCameraGuardHandler = onCameraModified;
  }
  state.roiCameraGuardInstalled = true;
}

function removeROICameraGuard(){
  if(state.roiReapplyRAF){
    cancelAnimationFrame(state.roiReapplyRAF);
    state.roiReapplyRAF = 0;
  }
  const main = state.mode === 'volume' && state.engine ? state.engine.getViewport(VIEWPORT_MAIN) : null;
  if(main && state.roiClipUpdaterOriginal){
    main.updateClippingPlanesForActors = state.roiClipUpdaterOriginal;
  }
  if(state.roiCameraGuardHandler){
    const cameraEvent = Enums?.Events?.CAMERA_MODIFIED;
    if(cameraEvent) els.volumeViewport.removeEventListener(cameraEvent, state.roiCameraGuardHandler);
  }
  state.roiClipUpdaterOriginal = null;
  state.roiCameraGuardHandler = null;
  state.roiCameraGuardInstalled = false;
}

function updateIsolationContext(value){
  state.isolationContext=clamp(value/100,0,1); if(els.roiContextOut)els.roiContextOut.textContent=`${Math.round(value)}%`;
  if(!state.isolationActive||!state.selectedAnatomy)return;
  state.roiClipPlanes=anatomyClipPlanes(state.selectedAnatomy); applyFixedROIPlanes({render:true}); drawSliceAnatomyOverlay();
}

function isolateSelectedAnatomy(){
  const item = state.selectedAnatomy;
  if(!item || state.mode !== 'volume') return;
  const bounds = anatomyWorldBounds(item);
  const { main, actor, mapper } = getMainActorMapper();
  if(!bounds || !mapper){
    showToast('This volume does not expose a clip-capable 3D mapper.', 4200);
    return;
  }
  try {
    const planes = anatomyClipPlanes(item);
    if(planes.length !== 6) throw new Error('Could not construct six ROI clipping planes');

    // vtkVolumeMapper inherits the hardware clipping-plane API from
    // vtkAbstractMapper. This is supported by the mapper Cornerstone uses,
    // unlike the vtkImageCropping API that was attempted in the prior build.
    state.roiClipPlanes = planes;
    state.isolationActive = true;
    state.isolationBounds = bounds;
    installROICameraGuard();
    if(!applyFixedROIPlanes({render:false})){
      throw new Error('VTK clipping-plane API unavailable on this volume mapper');
    }
    mapper.modified?.();
    actor?.modified?.();
    try { main.render(); } catch (_) { state.engine.renderViewport(VIEWPORT_MAIN); }
    els.isolateAnatomy.textContent = 'ROI ISOLATED';
    els.selectionMode.textContent = 'REFERENCE ROI';
    setNotice(`${item.name}: the 3D patient volume is isolated to a fixed anatomical reference ROI. Orbit, pan, and zoom now move the camera around the intact isolated volume; the ROI does not rotate into slice planes. This is spatial isolation, not patient-specific organ segmentation or diagnosis.`);
    showToast(`${item.name} · reference ROI isolated`, 3000);
  } catch (e) {
    console.warn('SCAN//SPACE ROI clipping unavailable', e);
    setNotice(`Could not isolate ${item.name}: ${e?.message || e}. Reference focus is still active.`);
    showToast(`ROI isolation failed: ${e?.message || 'renderer clipping unavailable'}`, 5200);
  }
}

function resetAnatomyIsolation({clearSelection=false}={}){
  removeROICameraGuard();
  if(state.mode === 'volume'){
    const { main, actor, mapper } = getMainActorMapper();
    try {
      if(typeof mapper?.removeAllClippingPlanes === 'function') mapper.removeAllClippingPlanes();
      else if(typeof mapper?.removeClippingPlane === 'function'){
        for(const plane of state.roiClipPlanes || []) mapper.removeClippingPlane(plane);
      }
      mapper?.modified?.();
      actor?.modified?.();
      main?.resetCamera?.();
      main?.render?.();
    } catch (e) { console.warn('Could not reset ROI clipping', e); }
  }
  state.roiClipPlanes = [];
  state.isolationActive = false;
  state.isolationContext=0; if(els.roiContext){els.roiContext.value='0';els.roiContextOut.textContent='0%';}
  state.isolationBounds = null;
  els.sliceAnatomyOverlay?.classList.add('hidden');
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
  if(!state.slicePrimary && !state.sliceMinimized) applySliceDockPosition();
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

function applySliceDockPosition(){
  if(!state.sliceDockPos || state.slicePrimary || state.sliceMinimized) return;
  const wr = els.workspace.getBoundingClientRect();
  const dr = els.sliceDock.getBoundingClientRect();
  const x = clamp(state.sliceDockPos.x, 8, Math.max(8, wr.width-dr.width-8));
  const y = clamp(state.sliceDockPos.y, 8, Math.max(8, wr.height-dr.height-8));
  state.sliceDockPos = {x,y};
  els.sliceDock.style.left = `${x}px`;
  els.sliceDock.style.top = `${y}px`;
  els.sliceDock.style.right = 'auto';
  els.sliceDock.style.bottom = 'auto';
}

function installSliceDockDrag(){
  const header = els.sliceDock?.querySelector('header');
  if(!header) return;
  header.addEventListener('pointerdown', (e) => {
    if(state.mode !== 'volume' || state.slicePrimary || state.sliceMinimized || e.button !== 0 || e.target.closest('button')) return;
    const wr=els.workspace.getBoundingClientRect(), dr=els.sliceDock.getBoundingClientRect();
    state.sliceDrag={pointerId:e.pointerId, dx:e.clientX-dr.left, dy:e.clientY-dr.top, workspaceLeft:wr.left, workspaceTop:wr.top};
    state.sliceDockPos={x:dr.left-wr.left,y:dr.top-wr.top};
    els.sliceDock.classList.add('dragging');
    try { header.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  header.addEventListener('pointermove', (e) => {
    if(!state.sliceDrag || state.sliceDrag.pointerId !== e.pointerId) return;
    state.sliceDockPos={x:e.clientX-state.sliceDrag.workspaceLeft-state.sliceDrag.dx,y:e.clientY-state.sliceDrag.workspaceTop-state.sliceDrag.dy};
    applySliceDockPosition();
  });
  const end=(e)=>{
    if(!state.sliceDrag || (e?.pointerId!=null && state.sliceDrag.pointerId!==e.pointerId)) return;
    state.sliceDrag=null; els.sliceDock.classList.remove('dragging');
    requestAnimationFrame(()=>{try{state.engine?.resize(true,false);}catch(_){ } drawSliceAnatomyOverlay();});
  };
  header.addEventListener('pointerup',end); header.addEventListener('pointercancel',end);
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
  if(state.slicePrimary){ els.sliceDock.style.left=''; els.sliceDock.style.top=''; els.sliceDock.style.right=''; els.sliceDock.style.bottom=''; }
  applyWorkspaceLayout();
}

function resizeOverlay(){
  const r=els.volumeViewport.getBoundingClientRect(); els.worldOverlay.setAttribute('viewBox',`0 0 ${Math.max(1,r.width)} ${Math.max(1,r.height)}`);
  try { state.engine?.resize(true,true); } catch (_) {}
}
window.addEventListener('resize', ()=>{ resizeOverlay(); applySliceDockPosition(); drawSliceAnatomyOverlay(); });

function toggleMPRMode(){
  if(state.mode!=='volume') return;
  state.mprMode=!state.mprMode;
  state.slicePrimary=false; state.sliceMinimized=false;
  els.workspace.classList.toggle('mpr-mode',state.mprMode);
  els.workspace.classList.remove('slice-primary','slice-minimized');
  els.mprToggle.classList.toggle('active',state.mprMode);
  if(state.mprMode){
    els.sliceDock.style.left='';els.sliceDock.style.top='';els.sliceDock.style.right='';els.sliceDock.style.bottom='';
    updateSlicePlane('axial',false);
  }
  requestAnimationFrame(()=>{
    try{state.engine.resize(true,false);}catch(_){}
    for(const id of [VIEWPORT_MAIN,VIEWPORT_SLICE,VIEWPORT_SAG,VIEWPORT_COR]){try{state.engine.getViewport(id)?.resetCamera?.();}catch(_){} }
    if(state.mprMode) activateCrosshairs(); else if(state.activeTool==='crosshairs'){const g=getAnnotationToolGroup();try{g?.setToolPassive(CrosshairsTool?.toolName);}catch(_){}state.activeTool=null;els.measureReadout.textContent='SPATIAL IMAGE TOOLS · NO DIAGNOSTIC INTERPRETATION';}
    try{state.engine.renderViewports([VIEWPORT_MAIN,VIEWPORT_SLICE,VIEWPORT_SAG,VIEWPORT_COR]);}catch(_){try{state.engine.render();}catch(__){}}
    resizeOverlay(); drawWorldOverlay();
  });
  setNotice(state.mprMode?'4-UP MPR · synchronized axial, sagittal and coronal views share the same physical volume. Crosshairs move all three planes in patient space.':'MPR 4-up closed. The movable slice viewport remains available.');
}

async function cineStep(){
  if(!state.cinePlaying || state.mode!=='volume') return;
  const vp=state.engine.getViewport(VIEWPORT_SLICE), n=Math.max(1,vp?.getNumberOfSlices?.()||1); let idx=0;
  try{const info=utilities.getVolumeViewportScrollInfo(vp,state.volumeId);idx=info.currentStepIndex??0;}catch(_){idx=vp?.getCurrentImageIdIndex?.()??0;}
  idx=(idx+1)%n;
  try{await utilities.jumpToSlice(els.sliceViewport,{imageIndex:idx});}catch(_){}
  updateSliceUI();
}
function scheduleCine(){
  clearInterval(state.cineTimer); state.cineTimer=0;
  if(!state.cinePlaying) return;
  state.cineTimer=setInterval(cineStep,Math.max(40,1000/state.cineFps));
}
function toggleCine(){
  if(state.mode!=='volume') return;
  state.cinePlaying=!state.cinePlaying; els.cineToggle.classList.toggle('active',state.cinePlaying); els.cineToggle.querySelector('b').textContent=state.cinePlaying?'Ⅱ':'▶'; scheduleCine();
}
function stopCine(){state.cinePlaying=false;if(state.cineTimer)clearInterval(state.cineTimer);state.cineTimer=0;els.cineToggle?.classList.remove('active');if(els.cineToggle?.querySelector('b'))els.cineToggle.querySelector('b').textContent='▶';}

function snap3DOrientation(view){
  if(state.mode!=='volume'||!state.imageGeometry) return; const vp=state.engine.getViewport(VIEWPORT_MAIN), c=state.imageGeometry.center,d=Math.max(100,state.imageGeometry.maxExtent*1.6);
  const map={anterior:{v:[0,-1,0],up:[0,0,1]},posterior:{v:[0,1,0],up:[0,0,1]},left:{v:[1,0,0],up:[0,0,1]},right:{v:[-1,0,0],up:[0,0,1]},superior:{v:[0,0,1],up:[0,-1,0]},inferior:{v:[0,0,-1],up:[0,1,0]}};
  const o=map[view]; if(!o)return; const pos=[c[0]+o.v[0]*d,c[1]+o.v[1]*d,c[2]+o.v[2]*d]; try{vp.setCamera({focalPoint:c,position:pos,viewUp:o.up});vp.render();}catch(e){console.warn(e);}
}

function exportCurrentPng(){
  const element=state.slicePrimary?els.sliceViewport:els.volumeViewport; const canvas=element?.querySelector('canvas'); if(!canvas){showToast('No rendered canvas available',2200);return;}
  try{canvas.toBlob(blob=>{if(!blob)return;downloadBlob(blob,`scanspace-${state.modality||'study'}-${Date.now()}.png`);},'image/png');}catch(e){showToast('PNG export failed',2400);}
}
function exportStudyData(){
  const data={version:'1.1.1',modality:state.modality,region:state.region,series:state.seriesMeta?{seriesUID:state.seriesMeta.seriesUID,seriesDescription:state.seriesMeta.seriesDesc,studyDescription:state.seriesMeta.studyDesc}:null,geometry:state.imageGeometry?{dimensions:state.imageGeometry.dims,spacing:state.imageGeometry.spacing,origin:state.imageGeometry.origin}:null,bookmarks:state.bookmarks,annotations:annotation?.state?.getAnnotationManager?.()?.saveAnnotations?.()||null,exportedAt:new Date().toISOString()};
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`scanspace-data-${Date.now()}.json`);
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}

function installWorkstationShortcuts(){
  window.addEventListener('keydown',(e)=>{
    if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const mod=e.metaKey||e.ctrlKey;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoAnnotation():undoAnnotation();return;}
    if(e.key==='Escape'){const g=getAnnotationToolGroup();allInteractiveAnnotationTools().forEach(t=>{try{g?.setToolPassive(t.toolName);}catch(_){}});state.activeTool=null;clearAnnotationButtonStates();if(state.mprMode)activateCrosshairs();else els.measureReadout.textContent='SPATIAL IMAGE TOOLS · NO DIAGNOSTIC INTERPRETATION';return;}
    const k=e.key.toLowerCase();
    if(k==='m') setAnnotationTool('measure'); else if(k==='p') setAnnotationTool('marker'); else if(k==='h') setAdvancedTool('probe',ProbeTool,'HU / PROBE'); else if(k==='i') setAdvancedTool('identify',CircleROITool,'CIRCLE & IDENTIFY'); else if(k==='4') toggleMPRMode(); else if(k==='c') toggleCine(); else if(k==='1') updateSlicePlane('axial',true); else if(k==='2') updateSlicePlane('sagittal',true); else if(k==='3') updateSlicePlane('coronal',true); else if(k==='b'){$$('#colorMode button').find(x=>x.dataset.mode==='gray')?.click();} else if(k==='t'){$$('#colorMode button').find(x=>x.dataset.mode==='thermal')?.click();} else if(k==='s'){$$('#colorMode button').find(x=>x.dataset.mode==='skeletal')?.click();}
  });
}

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

$$('#colorMode button').forEach(btn=>btn.addEventListener('click',()=>{
  $$('#colorMode button').forEach(x=>x.classList.toggle('active',x===btn));
  if(btn.dataset.mode === 'skeletal') applySkeletalPreset();
  else { state.skeletonPreset=false; state.colorMode=btn.dataset.mode; applyVisualization(); }
}));
$$('#planeMode button').forEach(btn=>btn.addEventListener('click',()=>{if(state.mprMode){showToast('4-UP MPR already shows axial, sagittal and coronal together',2200);return;}updateSlicePlane(btn.dataset.plane,true);}));

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
els.clearTools.addEventListener('click', clearMeasurementsKeepMarkers);
els.resetView.addEventListener('click',()=>{if(!state.mode)return;const ids=state.mode==='volume'?[VIEWPORT_MAIN,VIEWPORT_SLICE,VIEWPORT_SAG,VIEWPORT_COR]:[VIEWPORT_MAIN];for(const id of ids){try{state.engine.getViewport(id)?.resetCamera?.();}catch(_){}}try{state.engine.renderViewports(ids);}catch(_){state.engine.render();}});
// Adaptive volume quality: coarse while the user rotates/zooms, selected
// quality again almost immediately after interaction ends.
els.volumeViewport.addEventListener('pointerdown',()=>setInteractiveQuality(true),{passive:true});
window.addEventListener('pointerup',()=>{if(state.mode==='volume'){clearTimeout(state.qualityRestoreTimer);state.qualityRestoreTimer=setTimeout(()=>{state.interactiveQuality=false;applySampleQuality(false,true);},80);}}, {passive:true});
els.volumeViewport.addEventListener('wheel',(e)=>{
  if(state.mode !== 'volume') return;
  e.preventDefault();
  setInteractiveQuality(true);
  const vp=state.engine?.getViewport?.(VIEWPORT_MAIN);
  setZoomForViewport(vp, e.deltaY < 0 ? 1.12 : 1/1.12);
},{passive:false});
// Slice wheel remains slice-scroll. Hold Command/Control while wheeling for
// smooth zoom so navigation and zoom never fight over the same gesture.
els.sliceViewport.addEventListener('wheel',(e)=>{
  if(state.mode !== 'volume' || !(e.metaKey || e.ctrlKey)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const vp=state.engine?.getViewport?.(VIEWPORT_SLICE);
  setZoomForViewport(vp, e.deltaY < 0 ? 1.12 : 1/1.12);
  drawSliceAnatomyOverlay();
},{passive:false,capture:true});
els.volumeViewport.addEventListener('dblclick',()=>{const vp=state.engine?.getViewport?.(VIEWPORT_MAIN);vp?.resetCamera?.();vp?.render?.();});
els.sliceViewport.addEventListener('dblclick',()=>{const vp=state.engine?.getViewport?.(VIEWPORT_SLICE);vp?.resetCamera?.();vp?.render?.();drawSliceAnatomyOverlay();});
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
els.mprToggle?.addEventListener('click',toggleMPRMode);
els.cineToggle?.addEventListener('click',toggleCine);
els.cineFps?.addEventListener('input',()=>{state.cineFps=+els.cineFps.value;els.cineFpsOut.textContent=`${state.cineFps} FPS`;if(state.cinePlaying)scheduleCine();});
els.probeTool?.addEventListener('click',()=>setAdvancedTool('probe',ProbeTool,'HU / PROBE'));
els.rectRoiTool?.addEventListener('click',()=>setAdvancedTool('rectRoi',RectangleROITool,'RECT ROI'));
els.ellipseRoiTool?.addEventListener('click',()=>setAdvancedTool('ellipseRoi',EllipticalROITool,'ELLIPSE ROI'));
els.identifyTool?.addEventListener('click',()=>setAdvancedTool('identify',CircleROITool,'CIRCLE & IDENTIFY'));
els.angleTool?.addEventListener('click',()=>setAdvancedTool('angle',AngleTool,'ANGLE'));
els.bidirTool?.addEventListener('click',()=>setAdvancedTool('bidir',BidirectionalTool,'BIDIRECTIONAL'));
els.cobbTool?.addEventListener('click',()=>setAdvancedTool('cobb',CobbAngleTool,'COBB ANGLE'));
els.undoTool?.addEventListener('click',undoAnnotation);
els.redoTool?.addEventListener('click',redoAnnotation);
els.exportPng?.addEventListener('click',exportCurrentPng);
els.exportJson?.addEventListener('click',exportStudyData);
els.windowPresets?.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>applyWindowPreset(btn.dataset.preset)));
els.orientationCube?.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>snap3DOrientation(btn.dataset.view)));
els.roiContext?.addEventListener('input',()=>updateIsolationContext(+els.roiContext.value));
els.shadingToggle?.addEventListener('click',()=>{state.shading=!state.shading;els.shadingToggle.classList.toggle('active',state.shading);applyVisualization();});

installSliceDockDrag();
installWorkstationShortcuts();

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
