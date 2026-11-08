import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.__lumoModuleStarted = true;

// LUMO SITES / CONCEPT 001
// Independent demonstration. Internal geometry is an artistic concept,
// not a verified representation of the internal construction of an Apple phone.

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const loading = $('#loading');
const progressBar = $('.loading__bar > span');
const progressText = $('.loading__text');
const experience = $('#experience');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileMedia = window.matchMedia('(max-width: 850px)');
const steps = [
  { at: 0, index: '01 / 07', title: 'Начнём<br><em>с поверхности.</em>', english: 'PROTECTIVE GLASS', description: 'Первый слой — защитное стекло. Оно мягко приподнимается, словно его снимают руками.' },
  { at: .16, index: '02 / 07', title: 'Ближе<br><em>к изображению.</em>', english: 'DISPLAY ASSEMBLY', description: 'Экран постепенно выходит из корпуса, открывая пространство для внутренней конструкции.' },
  { at: .32, index: '03 / 07', title: 'Оптика.<br><em>В деталях.</em>', english: 'CAMERA SYSTEM', description: 'Модуль камеры аккуратно отходит от посадочного места. Отдельные объективы сохраняют свою геометрию.' },
  { at: .48, index: '04 / 07', title: 'Энергия<br><em>внутри.</em>', english: 'BATTERY MODULE', description: 'Демонстрационный аккумулятор выходит вдоль своей оси, а затем плавно перемещается в композицию.' },
  { at: .63, index: '05 / 07', title: 'Сложность<br><em>в миниатюре.</em>', english: 'LOGIC BOARD', description: 'Плата и электронные компоненты отделяются от корпуса. Каждая деталь движется по собственной траектории.' },
  { at: .78, index: '06 / 07', title: 'То, что<br><em>скрыто.</em>', english: 'LOWER MODULE', description: 'Нижний модуль и дополнительные элементы завершают последовательность разборки.' },
  { at: .91, index: '07 / 07', title: 'Всё<br><em>на своём месте.</em>', english: 'EXPLODED VIEW', description: 'Компоненты зависают на расстоянии друг от друга. Прокрутите вверх — и они вернутся обратно.' }
];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (t) => { t = clamp(t); return t*t*(3-2*t); };
const stage = (p, a, b) => smooth((p - a)/(b - a));
const vec = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
let camera, renderer, scene, phone, rig, parts = {};
let frameLast = performance.now();
let currentProgress = 0;
let desiredProgress = 0;
let introScroll = 0;
let activeStep = -1;
let cursor = { x: 0, y: 0 };
let size = { width: 0, height: 0 };
let loaded = false;
let running = true;
let userScrolled = false;

const panelMaterial = new THREE.MeshPhysicalMaterial({
  color: '#201b20', metalness: .24, roughness: .18, clearcoat: .75, clearcoatRoughness: .06,
  transparent: true, opacity: .23, depthWrite: false, side: THREE.DoubleSide
});
const burgundyMetal = new THREE.MeshStandardMaterial({ color: '#56202d', metalness: .88, roughness: .28 });
const titanium = new THREE.MeshStandardMaterial({ color: '#6f666a', metalness: .86, roughness: .31 });
const graphite = new THREE.MeshStandardMaterial({ color: '#1c2025', metalness: .45, roughness: .53 });
const chipBlack = new THREE.MeshStandardMaterial({ color: '#11161b', metalness: .35, roughness: .42 });
const copper = new THREE.MeshStandardMaterial({ color: '#9f765b', metalness: .91, roughness: .31 });

function roundedShape(width, height, radius) {
  const x = -width/2, y = -height/2, r = radius;
  const s = new THREE.Shape();
  s.moveTo(x+r,y);
  s.lineTo(x+width-r,y); s.quadraticCurveTo(x+width,y,x+width,y+r);
  s.lineTo(x+width,y+height-r); s.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  s.lineTo(x+r,y+height); s.quadraticCurveTo(x,y+height,x,y+height-r);
  s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
function roundedPlate(width, height, depth, radius, material) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(width,height,radius), {
    steps:1, depth, bevelEnabled:true, bevelThickness:Math.min(.00016,depth/5),
    bevelSize:.00015, bevelSegments:2, curveSegments:8
  });
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
function group(name) { const g = new THREE.Group(); g.name = name; return g; }
function boxAt(parent, material, size, pos, bevel=0) {
  let mesh;
  if (bevel) mesh = roundedPlate(size[0],size[1],size[2],bevel,material);
  else mesh = new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}
function stampCanvas() {
  const c=document.createElement('canvas'); c.width=512; c.height=820;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#17191d';ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle='#373137';ctx.lineWidth=5;ctx.strokeRect(18,18,476,784);
  ctx.fillStyle='#b04d5c';ctx.fillRect(38,38,5,742);
  ctx.fillStyle='#d8d2cf';ctx.font='bold 43px Arial';ctx.fillText('CELL / 001',63,127);
  ctx.fillStyle='#8d9091';ctx.font='23px Arial';ctx.fillText('LITHIUM ION  /  CONCEPT',63,168);
  ctx.strokeStyle='#454b50';ctx.lineWidth=2;
  for(let i=0;i<11;i++){ctx.beginPath();ctx.moveTo(65,220+i*29);ctx.lineTo(450-i*5,220+i*29);ctx.stroke();}
  ctx.fillStyle='#d1b2b7';ctx.font='bold 33px Arial';ctx.fillText('DESIGN STUDY',63,625);
  ctx.fillStyle='#717376';ctx.font='19px Arial';ctx.fillText('NOT AN OFFICIAL COMPONENT',63,667);
  ctx.fillText('LUMO SITES · 2026',63,705);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  return map;
}
function lineOnBoard(parent, points, color='#b38b67') {
  const geo=new THREE.BufferGeometry().setFromPoints(points.map(([x,y,z])=>new THREE.Vector3(x,y,z)));
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.66}));
  parent.add(line);
}
function createProtectiveGlass() {
  const g=group('01_Protective_Glass');
  const shield=roundedPlate(.0755,.1607,.00018,.0061,panelMaterial);
  shield.position.set(0,.08165,.00453); g.add(shield);
  // A contour, not a filled metallic layer: source screen remains visible.
  const outlineMaterial=new THREE.LineBasicMaterial({color:'#c5babe',transparent:true,opacity:.4});
  const outlinePoints=roundedShape(.0756,.1608,.0061).getPoints(12);
  const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(outlinePoints),outlineMaterial);
  edge.position.set(0,.08165,.00478);g.add(edge);
  return g;
}
function createBattery() {
  const g=group('04_Battery_Concept');
  const module=group('battery_body'); module.position.set(.0005,.072,-.0016);g.add(module);
  boxAt(module,titanium,[.055,.083,.00325],[0,0,0],.0035);
  boxAt(module,graphite,[.052,.080,.0034],[0,0,.00007],.003);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.048,.075),new THREE.MeshBasicMaterial({map:stampCanvas()}));
  front.position.z=.00195;module.add(front);
  boxAt(module,copper,[.013,.009,.0003],[.016,.046,.0015],.001);
  return g;
}
function createLogic() {
  const g=group('05_Logic_Board_Concept');
  const board=group('pcb'); board.position.set(-.014,.1275,-.0016);g.add(board);
  boxAt(board,new THREE.MeshStandardMaterial({color:'#22312b',metalness:.35,roughness:.58}),[.033,.037,.00175],[0,0,0],.003);
  for (let i=0;i<6;i++){
    const x=(i%3-.98)*.0095,y=(Math.floor(i/3)-.48)*.016;
    boxAt(board,i===0?graphite:chipBlack,[.007+i%2*.001,.006,.0011],[x,y,.00143],.0007);
    const gold=titanium;
    for(let j=0;j<4;j++) boxAt(board,gold,[.0006,.0013,.0002],[x-.0033+j*.0019,y+.003,.0021]);
  }
  for(let i=0;i<10;i++){
    const x=-.014+i*.0028;
    lineOnBoard(board,[[x,-.0155,.001],[x,-.011+i%3*.003,.001],[x+.003,.010,.001]],i%3===0?'#b69c7b':'#58745e');
  }
  boxAt(board,copper,[.022,.002,.0004],[.0,.019,.0006]);
  return g;
}
function createLower() {
  const g=group('06_Lower_Module_Concept');
  const lower=group('lower');lower.position.set(0,.018,-.0017);g.add(lower);
  boxAt(lower,graphite,[.057,.026,.0033],[0,0,0],.003);
  boxAt(lower,titanium,[.014,.016,.0037],[0,.0005,.0002],.002);
  for(let i=0;i<12;i++)boxAt(lower,chipBlack,[.0016,.005,.0007],[-.022+i*.004,.001,.002]);
  boxAt(lower,copper,[.052,.002,.0004],[0,-.014,.0013]);
  return g;
}
function createCoil() {
  const g=group('07_Induction_Coil_Concept');
  const root=group('coil'); root.position.set(0,.087,-.0047);g.add(root);
  const darkRing=new THREE.Mesh(new THREE.TorusGeometry(.018,.0022,8,80),graphite); root.add(darkRing);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.018,.0013,8,80),copper);ring.position.z=.0003;root.add(ring);
  for(let i=0;i<3;i++){
    const thin=new THREE.Mesh(new THREE.TorusGeometry(.014+i*.0013,.00013,5,80),titanium);
    thin.position.z=.00067;root.add(thin);
  }
  return g;
}
function detectGroup(name) {
  if (/^Front_/.test(name)) return 'display';
  if (/^Back_Cam|^Back_Flash|^Back_Mic|^Back_IR/.test(name)) return 'cameras';
  if (/^Back_Panel|^Back_Logo/.test(name)) return 'back';
  return 'frame';
}
function centerLayerPivot(item) {
  item.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(item);
  if (bounds.isEmpty()) { item.userData.restPosition = item.position.clone(); return; }
  const center = bounds.getCenter(new THREE.Vector3());
  for (const child of item.children) child.position.sub(center);
  item.position.copy(center);
  item.userData.restPosition = center.clone();
}
function splitOriginalModel(gltfScene) {
  let root=null;
  gltfScene.traverse(o=>{if(o.name==='GLTF_SceneRootNode')root=o;});
  if(!root) root=gltfScene;
  for(const label of ['display','cameras','back','frame']){
    parts[label]=group(label.toUpperCase());root.add(parts[label]);
  }
  root.updateMatrixWorld(true);
  const detachable=[...root.children].filter(o=>!Object.values(parts).includes(o));
  for (const obj of detachable) {
    // Nodes are already separate at source. No geometry is duplicated.
    parts[detectGroup(obj.name)].attach(obj);
  }
  parts.glass=createProtectiveGlass();root.add(parts.glass);
  parts.battery=createBattery();root.add(parts.battery);
  parts.logic=createLogic();root.add(parts.logic);
  parts.lower=createLower();root.add(parts.lower);
  parts.coil=createCoil();root.add(parts.coil);
  // Move each layer's pivot to its own geometric centre. Rotations now look
  // like physical parts being lifted, instead of orbiting the phone's origin.
  for (const [name, item] of Object.entries(parts)) {
    if (name !== 'frame') centerLayerPivot(item);
  }
  // The original asset is 0.163m tall. At x100 it is ~16.3 scene units.
  const mount=group('Model_Position');
  mount.position.y=-.08165;
  mount.add(gltfScene);
  const scaled=group('Real_Scale');scaled.scale.setScalar(100);scaled.add(mount);
  return scaled;
}
function interpolatePart(name,p,start,end,position,angles) {
  const obj=parts[name]; if (!obj)return;
  const t=reducedMotion?(p>=end?1:0):stage(p,start,end);
  const lift=reducedMotion?t:stage(p,start,start+(end-start)*.6);
  const lateral=reducedMotion?t:stage(p,start+(end-start)*.22,end);
  // Important: first lift along the physical extraction axis, THEN drift laterally.
  obj.position.copy(obj.userData.restPosition || new THREE.Vector3()).add(vec(position[0]*lateral,position[1]*t,position[2]*lift));
  obj.rotation.set(angles[0]*t,angles[1]*t,angles[2]*t);
}
function animateParts(p) {
  const narrow=mobileMedia.matches;
  const k=narrow?.47:1;
  // Displacements use source model units (metres) before the x100 visual scale.
  interpolatePart('glass',p,.005,.16,[-.081*k,.002,.071*k],[-.10,-.13, .05]);
  interpolatePart('display',p,.15,.32,[-.056*k,-.002,.042*k],[-.05,-.11,-.05]);
  interpolatePart('cameras',p,.32,.49,[.080*k,.017,-.030*k],[.08,.19,.09]);
  interpolatePart('battery',p,.47,.66,[-.033*k,-.020,.035*k],[-.04,-.11,-.05]);
  interpolatePart('logic',p,.62,.80,[.053*k,.019,.037*k],[.08,.12,.10]);
  interpolatePart('lower',p,.76,.90,[.039*k,-.039,.029*k],[.05,.11,.07]);
  interpolatePart('coil',p,.81,.97,[.029*k,.018,-.036*k],[.03,.11,.05]);
  interpolatePart('back',p,.87,.99,[.038*k,-.002,-.058*k],[.06,.17,.05]);
}
function setActiveStep(p) {
  let next=0;
  for(let i=0;i<steps.length;i++) if(p>=steps[i].at) next=i;
  if(next===activeStep)return;
  activeStep=next;
  const s=steps[next];
  $('#stepIndex').textContent=s.index;
  $('#stepTitle').innerHTML=s.title;
  $('#stepEnglish').textContent=s.english;
  $('#stepDescription').textContent=s.description;
}
function onScroll() {
  introScroll=clamp(window.scrollY/Math.max(1,window.innerHeight));
  const rect=experience.getBoundingClientRect();
  const length=Math.max(1,experience.offsetHeight-window.innerHeight);
  desiredProgress=clamp(-rect.top/length);
  userScrolled ||= window.scrollY > 4;
}
function onResize() {
  const width=window.innerWidth,height=window.innerHeight;
  if(size.width===width && size.height===height)return;
  size={width,height};
  const narrow=mobileMedia.matches;
  camera.fov=narrow?41:35;
  camera.position.z=narrow?36:31;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,narrow?1.45:1.85));
  renderer.setSize(width,height,false);
  onScroll();
}
function setup() {
  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  } catch(err) { fail('3D недоступно: браузер не смог запустить WebGL.'); return; }
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.55;
  renderer.setClearColor(0x000000,0);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(35,1,.05,500);
  camera.position.set(0,0,31);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xfff0f4,0x27131b,2.4));
  const key=new THREE.DirectionalLight(0xffffff,5.8);key.position.set(-11,19,20);scene.add(key);
  const edge=new THREE.DirectionalLight(0xd66d88,6.4);edge.position.set(14,7,-9);scene.add(edge);
  const fill=new THREE.DirectionalLight(0x9db3d6,2.3);fill.position.set(5,-7,14);scene.add(fill);
  const rear=new THREE.DirectionalLight(0xffffff,2.6);rear.position.set(-6,-9,-12);scene.add(rear);
  rig=group('Phone_Rig');scene.add(rig);
  const loader=new GLTFLoader();
  loader.load('./assets/iphone18-pro-max-burgundy.glb', (gltf)=>{
    phone=splitOriginalModel(gltf.scene);
    phone.traverse(obj=>{
      if(!obj.isMesh)return;
      obj.frustumCulled=false;
      // Preserve source physically based materials and embedded textures.
      // Keep material-sidedness from the original asset.
    });
    rig.add(phone);
    loaded=true;
    progressBar.style.width='100%';
    progressText.textContent='ГОТОВО К ИССЛЕДОВАНИЮ';
    setTimeout(()=>loading.classList.add('is-hidden'),450);
    onScroll();
    requestAnimationFrame(tick);
  }, (event)=>{
    if(event.total) progressBar.style.width=`${Math.round(event.loaded/event.total*95)}%`;
  }, (error)=>{console.error(error);fail('Не удалось загрузить GLB. Проверьте структуру папки и запуск через локальный сервер.');});
  onResize();
  window.addEventListener('resize',onResize,{passive:true});
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('pointermove',event=>{cursor.x=(event.clientX/window.innerWidth-.5)*2;cursor.y=(event.clientY/window.innerHeight-.5)*2;},{passive:true});
  document.addEventListener('visibilitychange',()=>{running=!document.hidden;if(running&&loaded){frameLast=performance.now();requestAnimationFrame(tick);}});
  if(reducedMotion) $('#reducedNotice').hidden=false;
}
function fail(message){progressText.textContent=message;loading.classList.add('loading--failed');progressBar.style.width='100%';}
function tick(now) {
  if(!running || !loaded)return;
  const dt=Math.min(.05,(now-frameLast)/1000);frameLast=now;
  const alpha=reducedMotion?1:1-Math.exp(-6*dt);
  currentProgress+=(desiredProgress-currentProgress)*alpha;
  animateParts(currentProgress);
  setActiveStep(currentProgress);
  $('#progressLabel').textContent=String(Math.round(currentProgress*100)).padStart(2,'0')+'%';
  $('#trackFill').style.height=`${currentProgress*100}%`;
  const fullyInside=experience.getBoundingClientRect().top<0;
  const introT=smooth(introScroll);
  const time=(now-startTime)/1000;
  let targetRotation;
  if(fullyInside){
    targetRotation=-.27+stage(currentProgress,.0,.37)*.42;
  } else {
    // One ceremonial 360° rotation on entrance, slowing gently to a rear view.
    const opening=reducedMotion?1:smooth(clamp(time/5));
    const openingSpin=-Math.PI-2*Math.PI*(1-opening);
    const scrollTurn=-Math.PI+2.87*introT;
    targetRotation=userScrolled?scrollTurn:openingSpin;
  }
  rig.rotation.y+=(targetRotation-rig.rotation.y)*(reducedMotion?1:1-Math.exp(-2.8*dt));
  const targetX=fullyInside?-.10+currentProgress*.14:-.05;
  const targetZ=fullyInside?.023:0;
  rig.rotation.x+=(targetX-rig.rotation.x)*(1-Math.exp(-2.5*dt));
  rig.rotation.z+=(targetZ-rig.rotation.z)*(1-Math.exp(-2.5*dt));
  const mobile=mobileMedia.matches;
  const expStarted=window.scrollY>=experience.offsetTop-2;
  const heroX=mobile?.05:3.8;
  const expX=mobile?0:3.2;
  const xx=expStarted?expX:heroX;
  const yy=mobile?(expStarted?3.4:-.7):0;
  const float=!reducedMotion?Math.sin(now*.00072)*.14:0;
  rig.position.x+=(xx+(mobile?0:cursor.x*.18)-rig.position.x)*(1-Math.exp(-2*dt));
  rig.position.y+=(yy+float-rig.position.y)*(1-Math.exp(-2*dt));
  // Zoom out to retain the physical layers inside narrow screens.
  const zoom=mobile?36+stage(currentProgress,.15,.80)*11:31+stage(currentProgress,.29,.90)*8;
  camera.position.z+=(zoom-camera.position.z)*(1-Math.exp(-2*dt));
  const expBottom=experience.offsetTop+experience.offsetHeight;
  const fade=clamp((expBottom-window.scrollY-window.innerHeight*.35)/(window.innerHeight*.55));
  canvas.style.opacity=String(fade);
  renderer.render(scene,camera);
  requestAnimationFrame(tick);
}
const startTime=performance.now();
setup();
