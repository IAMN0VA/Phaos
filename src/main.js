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
  density: 1,
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
};

const anatomyMaps = {
  BRAIN: { CRANIAL:['Brain','Ventricles','Cerebellum','Brainstem'], VASCULAR:['Circle of Willis','Major vessels'], REFERENCE:['Skull','Sinuses'] },
  SKULL: { CRANIAL:['Skull','Brain','Sinuses'], DENTAL:['Teeth','Jaw','Mandible','Maxilla'], FACIAL:['Orbits','Nasal cavity'], NECK:['C1','C2','C3','C4','C5','C6','C7'] },
  NECK: { SPINE:['C1','C2','C3','C4','C5','C6','C7'], SOFT_TISSUE:['Trachea','Thyroid','Esophagus'], VASCULAR:['Carotid arteries','Jugular veins'] },
  CHEST: { THORACIC:['Lungs','Heart','Trachea','Esophagus'], VASCULAR:['Aorta','Pulmonary vessels'], SKELETAL:['Ribs','Sternum','Thoracic spine'] },
  ABDOMEN: { ABDOMINAL:['Liver','Spleen','Stomach','Pancreas','Gallbladder','Appendix','Intestines'], VASCULAR:['Aorta','Major vessels'], URINARY:['Kidneys','Bladder'] },
  PELVIS: { PELVIC:['Bladder','Rectum','Pelvic floor'], VASCULAR:['Iliac vessels'], SKELETAL:['Pelvis','Sacrum','Hip joints'] },
  EXTREMITY: { SKELETAL:['Bone','Joint'], SOFT_TISSUE:['Muscle','Tendon','Subcutaneous tissue'] },
  UNKNOWN: { REFERENCE:['Center of study','Superior','Inferior','Left','Right'] },
};

const referencePositions = {
  brain:.52, ventricles:.52, cerebellum:.28, brainstem:.36, skull:.50, sinuses:.66,
  c1:.82, c2:.74, c3:.64, c4:.54, c5:.44, c6:.34, c7:.24,
  liver:.60, spleen:.59, stomach:.62, pancreas:.53, gallbladder:.57, appendix:.28, intestines:.40,
  aorta:.48, 'major vessels':.50, kidneys:.49, 'left kidney':.50, 'right kidney':.50, bladder:.18,
  lungs:.58, heart:.42, trachea:.64, ribs:.53, sternum:.52,
  mandible:.27, maxilla:.50, teeth:.45, jaw:.35,
};

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
  const sampleDistanceMultiplier = Math.max(.06, 1.30 - state.density * 1.24); // 100% ≈ .06, dense GPU ray sampling

  try { main.setSampleDistanceMultiplier(sampleDistanceMultiplier); } catch (_) { try { main.setProperties({ sampleDistanceMultiplier }); } catch (_) {} }
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
  state.engine.render();
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
  const tick = () => {
    if(state.mode !== 'volume') return;
    updateSliceUI();
    drawWorldOverlay();
    state.overlayRAF = requestAnimationFrame(tick);
  };
  state.overlayRAF = requestAnimationFrame(tick);
}
function stopOverlayLoop(){ if(state.overlayRAF) cancelAnimationFrame(state.overlayRAF); state.overlayRAF = 0; }

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
function updateAnatomy(){
  const groups = anatomyMaps[state.region] || anatomyMaps.UNKNOWN;
  els.anatomyTree.classList.remove('empty-tree');
  els.anatomyTree.innerHTML = Object.entries(groups).map(([group,items]) => `
    <div class="anatomy-group"><h3>${escapeHtml(group.replaceAll('_',' '))}</h3><div class="anatomy-items">
    ${items.map(item => `<button class="anatomy-item" data-anatomy="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}
    </div></div>`).join('');
  $$('.anatomy-item').forEach(btn => btn.addEventListener('click', () => navigateReference(btn.dataset.anatomy)));
}
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])); }

async function navigateReference(name){
  if(state.mode === 'volume'){
    await updateSlicePlane('axial', false);
    const t = referencePositions[name.toLowerCase()] ?? .5;
    els.slicePosition.value = Math.round(t*1000);
    await jumpToSlider();
  }
  showToast(`${name}: anatomical reference only — not detected in this scan`, 4300);
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

function bindRange(el,out,fn,fmt){el.addEventListener('input',()=>{fn(+el.value);out.textContent=fmt(+el.value);applyVisualization();});}
bindRange(els.contrast,els.contrastOut,v=>state.contrast=v/100,v=>`${v}%`);
bindRange(els.brightness,els.brightnessOut,v=>state.brightness=v,v=>v>0?`+${v}`:`${v}`);
bindRange(els.threshold,els.thresholdOut,v=>state.threshold=v/100,v=>`${v}%`);
bindRange(els.density,els.densityOut,v=>state.density=v/100,v=>`${v}%`);
bindRange(els.opacity,els.opacityOut,v=>state.opacity=v/100,v=>`${v}%`);
els.slicePosition.addEventListener('input',jumpToSlider);
els.splicerToggle.addEventListener('click',()=>{state.showPlane=!state.showPlane;els.splicerToggle.classList.toggle('active',state.showPlane);els.splicerToggle.setAttribute('aria-pressed',String(state.showPlane));drawWorldOverlay();});
els.axisToggle.addEventListener('click',()=>{state.showAxes=!state.showAxes;els.axisToggle.classList.toggle('active',state.showAxes);els.axisToggle.setAttribute('aria-pressed',String(state.showAxes));drawWorldOverlay();});
els.measureTool.addEventListener('click',()=>setAnnotationTool('measure'));
els.markerTool.addEventListener('click',()=>setAnnotationTool('marker'));
els.clearTools.addEventListener('click',()=>{annotation.state.removeAllAnnotations();state.engine?.render();showToast('Measurements and markers cleared');});
els.resetView.addEventListener('click',()=>{if(!state.mode)return;const main=state.engine.getViewport(VIEWPORT_MAIN);main?.resetCamera();if(state.mode==='volume')state.engine.getViewport(VIEWPORT_SLICE)?.resetCamera();state.engine.render();});
els.anatomySearch.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const q=e.target.value.trim();if(!q)return;const all=Object.values(anatomyMaps[state.region]||anatomyMaps.UNKNOWN).flat();const hit=all.find(x=>x.toLowerCase()===q.toLowerCase())||all.find(x=>x.toLowerCase().includes(q.toLowerCase()));if(hit)navigateReference(hit);else showToast(`No predefined anatomy reference for “${q}”`,3200);});

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
