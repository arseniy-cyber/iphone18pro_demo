import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// FORM / LUMO SITES — interactive concept using the user's original GLB.
// Interior modules are a detailed visual study, not verified Apple engineering data.
const canvas = document.getElementById('three');
const anatomy = document.getElementById('anatomy');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const loadingBar = document.getElementById('loadingBar');
const chapterTitle = document.getElementById('chapterTitle');
const chapterDescription = document.getElementById('chapterDescription');
const partName = document.getElementById('partName');
const mobile = () => innerWidth < 640;
const clamp = (n,a=0,b=1) => Math.min(b,Math.max(a,n));
const ease = x => {x=clamp(x);return x*x*x*(x*(6*x-15)+10)};
const phase = (p,a,b)=>ease((p-a)/(b-a));
const vec = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const group = name=>{const x=new THREE.Group(); x.name=name; return x;};
const material = (color, metalness=0, roughness=.4, extras={}) => new THREE.MeshPhysicalMaterial({color,metalness,roughness,...extras});

const M = {
  matte:material('#171b1c',.22,.58), foil:material('#393d40',.7,.27),
  alu:material('#8b8d8b',.88,.31), darkAlu:material('#383b3e',.85,.38),
  bronze:material('#bd8f5e',.82,.25), gold:material('#c9aa77',.8,.3),
  black:material('#121516',.2,.47), pcb:material('#1f2b29',.26,.62),
  edge:material('#a7a7a6',.78,.22), ink:material('#212528',.1,.6),
  glass:new THREE.MeshPhysicalMaterial({color:'#ffffff',metalness:0,roughness:.01,transmission:.985,thickness:.00008,ior:1.5,transparent:true,opacity:.05,clearcoat:1,clearcoatRoughness:.01,depthWrite:false,side:THREE.DoubleSide})
};
const textureLoader = new THREE.TextureLoader();
function loadTexture(path,{flipY=true}={}){
  const tex=textureLoader.load(path);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=8;
  tex.flipY=flipY;
  return tex;
}
const assetTex={
  screen:loadTexture('./assets/lumo-screen-live.jpg?v=10',{flipY:false})
};
function shape(w,h,r){
  const s=new THREE.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y); return s;
}
function plate(w,h,d,r,mat){
  const g=new THREE.ExtrudeGeometry(shape(w,h,r),{depth:d,steps:1,bevelEnabled:true,bevelSegments:3,bevelSize:Math.min(.00022,d*.23),bevelThickness:Math.min(.00014,d*.25),curveSegments:12});
  g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
function put(parent,obj,x=0,y=0,z=0){obj.position.set(x,y,z);parent.add(obj);return obj;}
function cub(parent,w,h,d,x,y,z,mat,r=0){return put(parent,r?plate(w,h,d,r,mat):new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),x,y,z);}
function disc(parent,r,thickness,x,y,z,mat){let mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,thickness,18),mat);mesh.rotation.x=Math.PI/2;return put(parent,mesh,x,y,z);}
function thinRibbon(parent,pts,width=.0018,mat=M.bronze,z=.0013){
  const pts2=pts.map(([x,y])=>new THREE.Vector2(x,y));
  const a=pts2.map((p,i)=>{const before=pts2[Math.max(0,i-1)],after=pts2[Math.min(i+1,pts2.length-1)];const d=after.clone().sub(before).normalize();return p.clone().add(new THREE.Vector2(-d.y,d.x).multiplyScalar(width/2));});
  const b=pts2.map((p,i)=>{const before=pts2[Math.max(0,i-1)],after=pts2[Math.min(i+1,pts2.length-1)];const d=after.clone().sub(before).normalize();return p.clone().sub(new THREE.Vector2(-d.y,d.x).multiplyScalar(width/2));}).reverse();
  const sh=new THREE.Shape();sh.moveTo(a[0].x,a[0].y);for(const p of a.slice(1))sh.lineTo(p.x,p.y);for(const p of b)sh.lineTo(p.x,p.y);sh.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.00012,bevelEnabled:false}),mat);return put(parent,mesh,0,0,z);
}
// Shape extrusion with explicit irregular contours, bevels and physically based metal shaders.
// The electronics are *actual geometry*, inspired by teardown references. The engineering layout
// remains a visual concept rather than a verified Apple component assembly.
function contour(points){
  const outline=new THREE.Shape();
  points.forEach(([x,y],i)=>i?outline.lineTo(x,y):outline.moveTo(x,y));
  outline.closePath();return outline;
}
function shaped(parent,points,z,thickness,mat,bevel=.00025){
  const geometry=new THREE.ExtrudeGeometry(contour(points),{depth:thickness,steps:1,
    bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:Math.min(bevel*.55,thickness*.4),
    bevelSegments:3,curveSegments:8});
  geometry.computeVertexNormals();
  return put(parent,new THREE.Mesh(geometry,mat),0,0,z);
}
function fastener(parent,x,y,z,scale=1){
  const outer=new THREE.Mesh(new THREE.TorusGeometry(.00078*scale,.00018*scale,7,22),M.alu);
  put(parent,outer,x,y,z);
  const core=new THREE.Mesh(new THREE.CircleGeometry(.00056*scale,18),M.darkAlu);
  put(parent,core,x,y,z+.00009);
  cub(parent,.00055*scale,.00013*scale,.00008*scale,x,y,z+.00016,M.edge);
}
function batteryPrint(){
  const c=document.createElement('canvas'); c.width=512;c.height=800;
  const g=c.getContext('2d'); g.clearRect(0,0,512,800);
  g.fillStyle='rgba(187,195,197,.64)';g.textAlign='center';
  g.font='600 17px Arial';g.fillText('Li-ion POLYMER BATTERY',256,114);
  g.font='12px Arial';g.fillText('Rechargeable cell  •  Product concept',256,148);
  g.strokeStyle='rgba(180,187,190,.4)';g.lineWidth=2;
  g.beginPath();g.moveTo(98,176);g.lineTo(414,176);g.stroke();
  g.font='13px Arial';
  ['CAUTION · SERVICE ONLY', 'Do not heat, puncture or deform', 'Dispose of through battery recycling'].forEach((line,i)=>g.fillText(line,256,220+i*30));
  g.strokeRect(125,340,70,70);
  g.font='bold 35px Arial';g.fillText('Li',160,389);
  g.font='11px Arial';g.fillText('CE  •  WEEE',315,372);
  g.fillText('DEMONSTRATION MODULE',256,475);
  g.font='12px Arial';g.fillText('Independent visual study',256,506);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
const BATT_PRINT=batteryPrint();
function internalAssembly(){
  const p={};
  const tray=p.tray=group('internal structure with rails');
  put(tray,plate(.071,.152,.00055,.0062,M.darkAlu),0,.0816,-.00325);
  for(const x of [-.032,.032]){
    cub(tray,.0014,.14,.0006,x,.081,-.0022,M.alu,.0003);
    for(let i=0;i<8;i++)fastener(tray,x,.025+i*.0164,-.0018,.65);
  }
  // Asymmetrical Li-ion cell: stepped relief, formed metal rim, flat dark pouch.
  const battery=p.battery=group('battery pouch and bolted tray');
  const batteryOuter=[[-.024,.117],[.025,.117],[.027,.115],[.027,.038],[.025,.035],[-.010,.035],[-.012,.037],[-.012,.047],[-.023,.047],[-.025,.050],[-.025,.114]];
  const batteryInner=[[-.0224,.115],[.0234,.115],[.025,.113],[.025,.040],[.023,.037],[-.0087,.037],[-.010,.039],[-.010,.049],[-.021,.049],[-.023,.052],[-.023,.113]];
  shaped(battery,batteryOuter,-.0025,.0027,M.alu,.00045);
  shaped(battery,batteryInner,-.0009,.0014,material('#202429',.26,.6),.00025);
  shaped(battery,batteryInner,.0008,.00015,material('#1b1e22',.10,.74),.00012);
  const marking=new THREE.Mesh(new THREE.PlaneGeometry(.035,.068),new THREE.MeshBasicMaterial({map:BATT_PRINT,transparent:true,depthWrite:false,opacity:.85,side:THREE.DoubleSide}));
  put(battery,marking,.007,.076,.00108);
  // A black ribbon emerges from the top in a mechanical fold, not a printed decal.
  thinRibbon(battery,[[.011,.116],[.012,.119],[.011,.123],[.006,.125],[.005,.129]],.0041,M.black,.0013);
  cub(battery,.0082,.0033,.00055,.006,.129,.0015,M.darkAlu,.0004);
  for(let i=0;i<7;i++) cub(battery,.00056,.001,.00014,.002+i*.00125,.130,.00185,M.gold);
  // Side mounting tabs / screws
  for(const [x,y] of [[-.022,.113],[.023,.113],[.023,.040],[-.010,.042]]) fastener(battery,x,y,.00105,.62);

  // Main logic board: irregular PCB footprint and separate physical EMI shields / connectors.
  const logic=p.logic=group('black multilayer logic board with shields');
  const pcbOutline=[[-.033,.127],[-.033,.147],[-.027,.154],[-.012,.155],[-.006,.152],[-.004,.144],[.010,.144],[.014,.140],[.014,.132],[.032,.131],[.033,.125],[.030,.120],[.007,.119],[.003,.115],[-.014,.115],[-.019,.120],[-.028,.122]];
  shaped(logic,pcbOutline,-.0019,.0016,material('#14191b',.38,.55),.00034);
  // Main complex black shield with a beveled stamped aluminum rim
  const shieldA=[[-.030,.133],[-.029,.146],[-.024,.151],[-.013,.151],[-.008,.148],[-.008,.136],[-.013,.131],[-.023,.131]];
  const shieldB=[[.000,.121],[.029,.122],[.030,.128],[.011,.129],[.007,.135],[.000,.135],[-.002,.129]];
  shaped(logic,shieldA,.0000,.0009,M.alu,.00025);
  shaped(logic,shieldA,.00083,.00023,material('#1f2328',.42,.56),.00016);
  shaped(logic,shieldB,.00005,.00075,M.alu,.00022);
  shaped(logic,shieldB,.00075,.00020,material('#252a2e',.45,.43),.00012);
  // Shield scoring / bevel-like highlights and visible metal tabs
  cub(logic,.009,.0028,.0004,-.017,.122,.00112,M.gold,.00035);
  cub(logic,.006,.004,.0004,.022,.121,.00106,M.foil,.00025);
  cub(logic,.005,.004,.0007,.005,.138,.00112,M.black,.00025);
  for(const [x,y] of [[-.029,.148],[-.022,.127],[.014,.123],[.029,.128]])fastener(logic,x,y,.00136,.95);
  // 30 tiny SMD elements and pads on the exposed edge — actual 3D meshes.
  for(let i=0;i<30;i++){
    const x=-.031+(i%10)*.0045;
    const y=.119+Math.floor(i/10)*.00255;
    if(x>-.019&&x<.003)continue;
    cub(logic,.0009,.00058,.0004,x,y,.00025,i%4===0?M.bronze:M.alu,.00008);
  }
  // Gold FPC sockets with visible contact ridges.
  for(const [x,y,w] of [[-.016,.117,.012],[.023,.128,.012],[-.028,.133,.006]]){
    cub(logic,w,.003,.0012,x,y,.0010,M.black,.00025);
    for(let j=0;j<9;j++)cub(logic,.0004,.0013,.00013,x-w*.42+j*w*.105,y,.00172,M.gold);
  }
  // Routed FPC flex cables, physically thickened, with distinct tabs.
  thinRibbon(logic,[[-.020,.116],[-.020,.111],[-.014,.106],[-.014,.100]],.0055,M.black,.00155);
  thinRibbon(logic,[[.019,.119],[.023,.115],[.024,.106],[.018,.101]],.003,M.black,.00155);
  cub(logic,.011,.004,.00035,-.014,.099,.00168,M.gold,.00015);
  cub(logic,.008,.003,.00035,.018,.100,.00168,M.darkAlu,.00015);

  const flex=p.flex=group('additional flexible interconnects');
  thinRibbon(flex,[[.015,.114],[.016,.108],[.019,.105],[.017,.097]],.003,M.black,.0018);
  thinRibbon(flex,[[-.029,.118],[-.030,.112],[-.024,.105]],.002,M.black,.0017);
  cub(flex,.007,.002,.00035,.018,.096,.00182,M.gold,.0001);

  const lower=p.lower=group('bottom speaker and port assembly');
  put(lower,plate(.056,.023,.0029,.0032,M.black),0,.018,-.0017);
  put(lower,plate(.025,.016,.0006,.0022,M.darkAlu),-.015,.017,.0014);
  put(lower,plate(.014,.015,.0006,.0022,M.darkAlu),.020,.016,.0014);
  for(let i=0;i<14;i++)cub(lower,.0005,.003,.00024,-.026+i*.0016,.017,.00215,M.edge,.0001);
  for(let i=0;i<6;i++)cub(lower,.0005,.003,.00024,.014+i*.0016,.017,.00215,M.edge,.0001);
  cub(lower,.019,.006,.0005,0,.007,.0017,M.foil,.0015);

  // One compact internal camera carrier behind the ORIGINAL optical components.
  // No duplicate discs/lenses: the original 3D asset already contains them.
  const camera=p.cameraCore=group('compact camera sensor carrier');
  const outline=[[-.001,.123],[.031,.123],[.032,.127],[.032,.153],[.029,.156],[-.001,.156],[-.003,.153],[-.003,.127]];
  shaped(camera,outline,-.0049,.0010,material('#222429',.45,.44),.00033);
  // Dark sensor housings on the inward-facing side only.
  for(const [x,y,r] of [[.0246,.1490,.0045],[.0246,.1297,.0045],[.0065,.1393,.0047]]){
    cub(camera,r*1.44,r*1.44,.0010,x,y,-.00395,M.black,.0005);
  }
  cub(camera,.006,.004,.00065,.007,.131,-.00372,M.alu,.0005);
  return p;
}
function layerFor(n){
  if(n.startsWith('Front_'))return 'display';
  if(n.startsWith('Back_Cam'))return 'rearCameras';
  if(/^Back_Panel|^Back_Logo/.test(n))return 'back';
  return 'frame';
}
function recenter(obj){
  obj.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(obj);
  const c=box.getCenter(new THREE.Vector3());
  // All groups are siblings in the original zero-transform GLTF root.
  for(const item of obj.children)item.position.sub(c);
  obj.position.copy(c);obj.userData.home=c.clone();
}
function tuneMaterials(root){
  root.traverse(o=>{
    if(!o.isMesh)return;
    o.frustumCulled=false;
    const name=o.material?.name||'';
    if(!name)return;
    const mat=o.material=o.material.clone();
    if(/COLOUR_Cherry_Side_Panel|COLOUR_Cherry_Aniso|COLOUR_Cherry_Screws|COLOUR_Cherry_Side_Button/.test(name)){
      mat.metalness=.86;mat.roughness=/Gloss/.test(name)?.22:.31;mat.envMapIntensity=1.35;
      // Original one-sided side panels disappeared when the chassis was viewed from inside.
      mat.side=THREE.DoubleSide;
      mat.transparent=false;
      mat.opacity=1;
      mat.depthWrite=true;
    }
    if(/COLOUR_Cherry_Backpanel/.test(name)){
      mat.metalness=.38;mat.roughness=.36;mat.envMapIntensity=1.32;mat.transparent=false;mat.opacity=1;mat.side=THREE.DoubleSide;mat.depthWrite=true;mat.color.set('#61303d');
    }
    if(/COLOUR_Cherry_Screen/.test(name)){
      mat.map=assetTex.screen; mat.emissiveMap=assetTex.screen;
      mat.emissive=new THREE.Color('#ffffff'); mat.emissiveIntensity=.58;mat.roughness=.11;mat.metalness=.02;mat.envMapIntensity=.38;mat.side=THREE.FrontSide;
    }
    if(/BASE_Cam_Lens/.test(name)){
      mat.roughness=.03;mat.metalness=.15;mat.clearcoat=1;mat.clearcoatRoughness=.02;mat.envMapIntensity=1.95;
    }
    if(/BASE_Glass|BASE_Cam_Edge_Black/.test(name)){
      mat.roughness=.05;mat.clearcoat=1;mat.clearcoatRoughness=.03;mat.envMapIntensity=1.7;
    }
  });
}
function buildPhone(gltfScene){
  tuneMaterials(gltfScene);
  let root=null;
  gltfScene.traverse(o=>{if(o.name==='GLTF_SceneRootNode')root=o;});
  if(!root)root=gltfScene;
  const layers={};
  for(const n of ['display','rearCameras','back','frame']){layers[n]=group(n);root.add(layers[n]);}
  const children=[...root.children].filter(c=>!Object.values(layers).includes(c));
  root.updateWorldMatrix(true,true);
  children.forEach(child=>layers[layerFor(child.name)].attach(child));
  const internals=internalAssembly();
  // Keep the lens assembly and its black sensor carrier separate.
  // The carrier only travels a few millimetres away from the three objective lenses.
  Object.assign(layers,internals);
  for(const [name,g] of Object.entries(internals))root.add(g);
  // The silhouette is measured from the supplied GLB Front_Screen mesh:
  // W 73.03mm, H 158.487mm, true curved corner R 12.0mm.
  const glass=layers.glass=group('Tempered glass / matched silhouette');
  const faceW=.07303, faceH=.158487, faceR=.012;
  const glassY=(.002391+.160878)*.5;
  function roundProfile(w,h,r){
    const x=-w/2,y=-h/2;
    const s=new THREE.Shape();
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);
    s.absarc(x+w-r,y+r,r,-Math.PI/2,0,false);
    s.lineTo(x+w,y+h-r);
    s.absarc(x+w-r,y+h-r,r,0,Math.PI/2,false);
    s.lineTo(x+r,y+h);
    s.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI,false);
    s.lineTo(x,y+r);
    s.absarc(x+r,y+r,r,Math.PI,Math.PI*1.5,false);
    return s;
  }
  // Clear film has negligible opacity: the original screen stays bright.
  put(glass,new THREE.Mesh(new THREE.ShapeGeometry(roundProfile(faceW,faceH,faceR),24),
    new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.018,
      metalness:0,roughness:.02,depthWrite:false,side:THREE.DoubleSide})),
    0,glassY,.00464);
  // Black 0.9mm bezel follows the same rounded profile, including the corners.
  const ring=roundProfile(faceW,faceH,faceR);
  const inner=roundProfile(faceW-.0018,faceH-.0018,faceR-.0009);
  const hole=new THREE.Path(inner.getPoints(128));
  ring.holes.push(hole);
  const rimGeometry=new THREE.ShapeGeometry(ring,32);
  const rim=new THREE.Mesh(rimGeometry,new THREE.MeshBasicMaterial({color:'#111316',
    transparent:true,opacity:.97,side:THREE.DoubleSide,depthWrite:false}));
  put(glass,rim,0,glassY,.00476);
  const borderGeo=new THREE.BufferGeometry().setFromPoints(roundProfile(faceW,faceH,faceR).getPoints(128));
  put(glass,new THREE.LineLoop(borderGeo,new THREE.LineBasicMaterial({color:'#44484c',transparent:true,opacity:.40,depthWrite:false})),0,glassY,.00478);
  root.add(glass);

  // The original GLB front screen is at Z 0.004322 and its glass frame at Z 0.003987.
  // A 1.5 mm solid anodized backplate touches the original display assembly:
  // no detached floating rectangle and no translucent rear face.
  const displayBackPlate=plate(faceW-.0010,faceH-.0011,.00145,faceR-.0007,
    new THREE.MeshPhysicalMaterial({color:'#111518',metalness:.28,roughness:.62,
      transparent:false,opacity:1,side:THREE.DoubleSide,depthWrite:true}));
  displayBackPlate.rotation.x=Math.PI;
  put(layers.display,displayBackPlate,0,glassY,.00384);

  // Keep the supplied GLB's original frame and removable back cover EXACTLY as
  // authored. Do not create a chassis backing plate, inner wall or duplicate
  // back-cover mesh: these were the source of the grey rectangle and pink overlay.
  // The original burgundy frame is hollow and stays visible from both sides via
  // the double-sided native side-panel material in tuneMaterials().

  // Center each detachable object's pivot on its own geometry.
  for(const [name,g] of Object.entries(layers))if(name!=='frame')recenter(g);
  const centered=group('Original_meters_to_center');centered.position.y=-.08165;centered.add(gltfScene);
  const scaled=group('Scale_to_display');scaled.scale.setScalar(100);scaled.add(centered);
  return {phone:scaled,layers};
}
function motion(obj,p,a,b,end,rotation=[0,0,0]){
  if(!obj)return;
  const first=phase(p,a,a+(b-a)*.52),second=phase(p,a+(b-a)*.16,b),rot=phase(p,a+(b-a)*.36,b);
  const v=[end[0]*second,end[1]*second,end[2]*first];
  obj.position.copy(obj.userData.home).add(vec(...v));
  obj.rotation.set(rotation[0]*rot,rotation[1]*rot,rotation[2]*rot);
}
function disassemble(p,l){
  // Compact exploded view. Front parts travel mostly along Z before easing aside.
  // The whole phone eases back first, so the first layer cannot rush at the viewer.
  motion(l.glass,p,.035,.215,[-.060,.004,.078],[.006,0,0]);
  motion(l.display,p,.185,.36,[-.032,0,.064],[.004,0,0]);
  motion(l.flex,p,.30,.43,[-.013,0,.023],[.004,0,0]);
  motion(l.battery,p,.365,.55,[.008,-.001,.047],[0,.008,0]);
  motion(l.logic,p,.50,.68,[.038,.008,.039],[.006,-.008,0]);
  motion(l.lower,p,.64,.77,[.022,-.026,.034],[0,.006,0]);
  // Keep the original three lenses intact, and let their black housing drift
  // only 9 mm relative to them, along the same axis.
  motion(l.rearCameras,p,.76,.91,[0,.008,-.046],[0,0,0]);
  motion(l.cameraCore,p,.76,.91,[0,.008,-.037],[0,0,0]);
  // Original rear cover — no extra geometry, no side movement.
  motion(l.back,p,.86,.998,[0,0,-.080],[0,0,0]);
}

const captions=[
  {at:0,name:'01 / PROTECTIVE GLASS',title:'Прозрачная<br><em>граница.</em>',desc:'Закалённое стекло с тонкой тёмной окантовкой. Первый слой поднимается, не затеняя изображение.'},
  {at:.16,name:'02 / DISPLAY',title:'Свет<br><em>в каждом пикселе.</em>',desc:'Дисплей выходит из корпуса и открывает доступ к деталям внутренней сборки.'},
  {at:.34,name:'03 / BATTERY',title:'Энергия<br><em>обретает форму.</em>',desc:'Асимметричная аккумуляторная ячейка, металлический лоток и гибкий соединительный шлейф.'},
  {at:.51,name:'04 / LOGIC BOARD',title:'Архитектура<br><em>под поверхностью.</em>',desc:'Многослойная чёрная плата: экранирующие пластины, контактные группы, разъёмы и крепёж.'},
  {at:.72,name:'05 / CAMERA SYSTEM',title:'Точность<br><em>в оптике.</em>',desc:'Объективы и внутренний камерный блок раздвигаются строго по оси, без отсоединённых элементов.'},
  {at:.87,name:'06 / EXPLODED VIEW',title:'Увидеть<br><em>невидимое.</em>',desc:'Вся конструкция раскрыта. Вращайте модель для обзора — и прокрутите вверх, чтобы собрать её.'}
];
let renderer,scene,camera,rig,model,layers,ready=false;
let wanted=0,progress=0,orbit=0,orbitPitch=0,pointer={x:0,y:0},last=performance.now(),lastCaption=-1;
let drag=false,dragStart=null,orbitAtStart=0,pitchAtStart=0,introAt=performance.now();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function scrollState(){
  const height=anatomy.offsetHeight-innerHeight;
  wanted=clamp((scrollY-anatomy.offsetTop)/Math.max(1,height));
}
function updateCaption(p){
  let i=0;for(let j=0;j<captions.length;j++)if(p>=captions[j].at)i=j;
  if(i===lastCaption)return;
  lastCaption=i;
  const c=captions[i];chapterTitle.innerHTML=c.title;chapterDescription.textContent=c.desc;partName.textContent=c.name;
}
function updateAtmosphere(p){
  // The backgrounds are real transparent CSS layers; only their opacity changes.
  // Dark graphite arrives during the central technical section, then fades back
  // to pale silver as the reconstruction completes.
  const dark=phase(p,.31,.58)*(1-phase(p,.79,.985));
  const wine=phase(p,.53,.74)*(1-phase(p,.82,1));
  document.documentElement.style.setProperty('--scene-dark',dark.toFixed(3));
  document.documentElement.style.setProperty('--scene-wine',wine.toFixed(3));
  document.body.classList.toggle('theme-dark',dark>.48);
}
function resize(){
  if(!renderer)return;
  const dpr=Math.min(devicePixelRatio||1,mobile()?1.4:1.75);
  renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.fov=mobile()?39:35;camera.updateProjectionMatrix();
}
function setup(){
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:false});}
  catch(e){loadingText.textContent='В этом браузере WebGL недоступен.';return;}
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.32;
  renderer.setClearColor(0xffffff,0);
  scene=new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const env=new RoomEnvironment();const envRender=pmrem.fromScene(env,.045);
  scene.environment=envRender.texture;scene.environmentIntensity=1.15;
  env.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0xd9d8d5,1.65));
  let l=new THREE.DirectionalLight(0xffffff,3.1);l.position.set(-8,15,18);scene.add(l);
  l=new THREE.DirectionalLight(0xffffff,2.1);l.position.set(10,4,-14);scene.add(l);
  l=new THREE.DirectionalLight(0xd4e0ee,.85);l.position.set(4,-8,14);scene.add(l);
  camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,250);camera.position.set(0,0,34);
  rig=group('View_Rig');scene.add(rig);
  new GLTFLoader().load('./assets/iphone18-burgundy.glb', g=>{
    try{const built=buildPhone(g.scene);model=built.phone;layers=built.layers;rig.add(model);ready=true;window.__FORM_READY=true;scrollState();if(loadingBar)loadingBar.style.width='100%';loadingText.textContent='Готово';loading.classList.add('hidden');requestAnimationFrame(frame);}catch(e){console.error(e);loadingText.textContent='Ошибка подготовки модели: '+e.message;}
  },xhr=>{if(xhr.total>0 && loadingBar)loadingBar.style.width=Math.min(95,Math.max(7,xhr.loaded/xhr.total*93))+'%';},e=>{console.error(e);loadingText.textContent='Не удалось загрузить модель. Обновите страницу.';});
  resize();addEventListener('resize',resize,{passive:true});addEventListener('scroll',scrollState,{passive:true});
  addEventListener('pointermove',e=>{
    pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2;
    if(!drag||!dragStart)return;
    const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;
    if(e.pointerType==='touch' && Math.abs(dx)<Math.abs(dy)*1.35)return;
orbit=orbitAtStart+dx/Math.max(innerWidth,330)*Math.PI*2;
    orbitPitch=pitchAtStart+dy/Math.max(innerHeight,390)*Math.PI*1.55;
  },{passive:true});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag=true;dragStart={x:e.clientX,y:e.clientY};orbitAtStart=orbit;pitchAtStart=orbitPitch;});
  addEventListener('pointerup',()=>{drag=false;dragStart=null;});
  addEventListener('pointercancel',()=>{drag=false;dragStart=null;});
  // Optional reproducible states for comparing actual browser renders: ?view=front|rear|exploded.
  const view=new URLSearchParams(location.search).get('view');
  if(view==='front'||view==='rear'||view==='exploded'){document.documentElement.dataset.preview=view;}
}
function frame(now){
  if(!ready)return;
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const a=reduced?1:1-Math.exp(-7*dt);
  progress+=(wanted-progress)*a;disassemble(progress,layers);updateCaption(progress);updateAtmosphere(progress);
  const rect=anatomy.getBoundingClientRect();
  const inAnatomy=rect.top<=innerHeight*.3&&rect.bottom>=0;
  const fromIntro=clamp(scrollY/Math.max(1,innerHeight));
  const v=document.documentElement.dataset.preview;
  let turn;
  if(v==='front'){turn=0;progress=0;disassemble(0,layers);}
  else if(v==='rear'){turn=Math.PI;progress=0;disassemble(0,layers);}
  else if(v==='exploded'){turn=-.83;progress=1;disassemble(1,layers);}
  else {
    const time=clamp((now-introAt)/4500);
    const intro=-Math.PI*1.05 - (1-ease(time))*Math.PI*.55;
    turn=inAnatomy?(-1.12+phase(progress,.0,.60)*.4):intro+ease(fromIntro)*.2;
  }
  const pose=turn+orbit+(drag?0:pointer.x*.15);
  const lerp=1-Math.exp(-3.7*dt);
  rig.rotation.y+=(pose-rig.rotation.y)*lerp;
  const pitch= orbitPitch+(inAnatomy?-.06:.04) + (drag?0:-pointer.y*.055);
  rig.rotation.x+=(pitch-rig.rotation.x)*lerp;
  const inOutro=scrollY>anatomy.offsetTop+anatomy.offsetHeight-innerHeight*.3;
  const shown=!inOutro || !!v;
  canvas.style.opacity=String(clamp((anatomy.offsetTop+anatomy.offsetHeight-scrollY)/Math.max(1,innerHeight*.45)));
  const wantedY=v?0:inAnatomy?(mobile()?1.55:-.10):(mobile()?-4.25:-4.5);
  rig.position.y+=(wantedY-rig.position.y)*lerp;
  const wantScale=v?1:inAnatomy?(mobile()?(.77-phase(progress,.0,.17)*.055-phase(progress,.4,.95)*.02):(.95-phase(progress,.0,.17)*.052-phase(progress,.4,.95)*.018)):(mobile()?.64:.73);
  const scale=rig.scale.x+(wantScale-rig.scale.x)*lerp;
  rig.scale.setScalar(scale);
  const desiredZ=mobile()?36.5+phase(progress,.00,.18)*5.8+phase(progress,.24,.96)*6.2:35+phase(progress,.00,.18)*4.2+phase(progress,.24,.96)*3.8;
  camera.position.z+=(desiredZ-camera.position.z)*lerp;
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
setup();
