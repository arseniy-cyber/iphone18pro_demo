import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// FORM / LUMO SITES — interactive concept using the user's original GLB.
// Interior modules are a detailed visual study, not verified Apple engineering data.
const canvas = document.getElementById('three');
const anatomy = document.getElementById('anatomy');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
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
  glass:new THREE.MeshPhysicalMaterial({color:'#fdfdff',metalness:0,roughness:.035,transmission:.83,thickness:.00028,ior:1.49,transparent:true,opacity:.19,clearcoat:1,clearcoatRoughness:.04,depthWrite:false,side:THREE.DoubleSide})
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
function thinRibbon(parent,pts,width=.0018,mat=M.black,z=.0013){
  const pts2=pts.map(([x,y])=>new THREE.Vector2(x,y));
  const a=pts2.map((p,i)=>{const before=pts2[Math.max(0,i-1)],after=pts2[Math.min(i+1,pts2.length-1)];const d=after.clone().sub(before).normalize();return p.clone().add(new THREE.Vector2(-d.y,d.x).multiplyScalar(width/2));});
  const b=pts2.map((p,i)=>{const before=pts2[Math.max(0,i-1)],after=pts2[Math.min(i+1,pts2.length-1)];const d=after.clone().sub(before).normalize();return p.clone().sub(new THREE.Vector2(-d.y,d.x).multiplyScalar(width/2));}).reverse();
  const sh=new THREE.Shape();sh.moveTo(a[0].x,a[0].y);for(const p of a.slice(1))sh.lineTo(p.x,p.y);for(const p of b)sh.lineTo(p.x,p.y);sh.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.00012,bevelEnabled:false}),mat);return put(parent,mesh,0,0,z);
}
function cellLabel(){
  const c=document.createElement('canvas');c.width=768;c.height=1152;
  const x=c.getContext('2d');
  x.fillStyle='#25282a';x.fillRect(0,0,c.width,c.height);
  const g=x.createLinearGradient(0,0,768,1152);g.addColorStop(0,'rgba(255,255,255,.075)');g.addColorStop(.54,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(0,0,768,1152);
  x.fillStyle='#919698';x.textAlign='center';x.font='bold 24px Arial';x.fillText('Li-ion rechargeable cell',384,225);
  x.font='16px Arial';x.fillStyle='#888d8d';x.fillText('Battery assembly  •  concept visualization',384,263);
  x.strokeStyle='#565b60';x.lineWidth=2;x.strokeRect(74,316,620,1);
  x.font='15px Arial';x.fillStyle='#7e8386';
  ['Do not bend, puncture or disassemble.','Dispose of through approved recycling channels.','This is an illustrative component.'].forEach((s,i)=>x.fillText(s,384,382+i*39));
  x.strokeStyle='#474b4e';x.strokeRect(74,500,620,1);
  x.font='bold 46px Arial';x.fillStyle='#b0b3b3';x.fillText('Li-ion',384,853);
  x.font='16px Arial';x.fillStyle='#86898a';x.fillText('ILLUSTRATIVE COMPONENT',384,903);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function boardTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#25322e';ctx.fillRect(0,0,1024,1024);
  let seed=71;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.strokeStyle='rgba(158,137,86,.28)';ctx.lineWidth=2;
  for(let i=0;i<185;i++){
    const x=Math.floor(rand()*980)+15,y=Math.floor(rand()*980)+15;
    ctx.beginPath();ctx.moveTo(x,y);const dx=(rand()-.5)*180,dy=(rand()-.5)*170;ctx.lineTo(x+dx,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
  }
  ctx.fillStyle='rgba(216,189,112,.5)';for(let i=0;i<95;i++){const x=rand()*1024,y=rand()*1024;ctx.fillRect(x,y,2+rand()*4,2+rand()*4);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function internalAssembly(){
  const p={};
  const tray=p.tray=group('Internal_chassis');
  put(tray,plate(.0717,.1545,.00055,.0062,M.darkAlu),0,.0815,-.00385);
  // Light-colored structural brackets, visible only when display is removed.
  cub(tray,.066,.003,.0005,0,.153,-.0028,M.alu,.0008);
  cub(tray,.066,.003,.0005,0,.010,-.0028,M.alu,.0008);
  for(let i=0;i<9;i++){
    const y=.017+i*.0163;
    disc(tray,.00063,.00025,-.0328,y,-.0028,M.edge);
    disc(tray,.00063,.00025,.0328,y,-.0028,M.edge);
  }
  const battery=p.battery=group('Battery_assembly');
  put(battery,plate(.0523,.082,.0033,.0047,M.foil),.001,.076,-.00228);
  put(battery,plate(.0504,.0802,.00055,.0041,M.matte),.001,.076,.00105);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.0469,.0755),new THREE.MeshStandardMaterial({map:cellLabel(),roughness:.7,metalness:0}));
  put(battery,label,.001,.076,.00168);
  cub(battery,.012,.0056,.0007,-.011,.118,.0006,M.bronze,.0011);
  for(let i=0;i<4;i++)cub(battery,.001,.002,.0003,-.015+i*.0029,.122,.0014,M.gold);
  cub(battery,.036,.0011,.0002,.001,.032,.0013,M.edge);
  const logic=p.logic=group('Logic_board_assembly');
  // Irregularly profiled PCB, not a simple rectangular block.
  const poly=new THREE.Shape();
  [[-.030,.120],[-.030,.152],[-.021,.156],[-.009,.156],[-.009,.146],[.002,.146],[.002,.131],[-.006,.131],[-.006,.116],[-.018,.116],[-.018,.120]].forEach(([x,y],i)=>i?poly.lineTo(x,y):poly.moveTo(x,y));poly.closePath();
  const pcb=new THREE.Mesh(new THREE.ExtrudeGeometry(poly,{depth:.0019,bevelEnabled:true,bevelSize:.0004,bevelThickness:.00025,bevelSegments:2}),M.pcb);put(logic,pcb,0,0,-.0008);
  // Copper traces as a surface material with no distracting oversized lettering.
  const surf=new THREE.Mesh(new THREE.PlaneGeometry(.032,.035),new THREE.MeshStandardMaterial({map:boardTexture(),roughness:.58,metalness:.28,transparent:true,opacity:.56,side:THREE.DoubleSide}));put(logic,surf,-.014,.136,.00138);
  const chips=[[-.022,.142,.010,.010],[-.012,.124,.009,.006],[-.016,.152,.008,.004],[-.025,.127,.005,.005],[-.005,.136,.004,.006]];
  chips.forEach(([x,y,w,h],i)=>{
    cub(logic,w,h,.0015,x,y,.0020,i===0?M.black:M.ink,.00055);
    for(let j=0;j<5;j++){const off=(j-2)*w/6;cub(logic,.00045,.001,.00027,x+off,y+h/2+.0003,.0026,M.bronze);}
  });
  // EMI shields, individual capacitors and board connectors.
  cub(logic,.009,.007,.00055,-.024,.149,.00225,M.alu,.0006);
  cub(logic,.011,.005,.00055,-.014,.136,.00235,M.darkAlu,.0004);
  for(let i=0;i<20;i++){
    const x=-.026+(i%5)*.0048,y=.117+Math.floor(i/5)*.009;
    if(Math.abs(x+.021)<.007 && Math.abs(y-.144)<.009)continue;
    cub(logic,.0012,.0021,.00055,x,y,.00225,i%4===0?M.gold:M.alu,.00015);
  }
  const lower=p.lower=group('Lower_assembly');
  put(lower,plate(.058,.026,.003,.0035,M.black),0,.018,-.00185);
  const spk=put(lower,plate(.022,.015,.0008,.0025,M.darkAlu),-.016,.016,.00135);
  const mic=put(lower,plate(.013,.015,.0008,.0025,M.darkAlu),.018,.016,.00135);
  for(let i=0;i<11;i++){
    cub(lower,.0006,.003,.00025,-.025+i*.0019,.016,.0023,M.alu,.00015);
  }
  for(let i=0;i<7;i++)cub(lower,.00065,.003,.00028,.013+i*.0018,.016,.0023,M.alu,.00015);
  cub(lower,.020,.007,.00065,0,.007,.0018,M.foil,.002);
  const flex=p.flex=group('Flex_cables');
  thinRibbon(flex,[[-.012,.121],[-.012,.117],[-.007,.114],[.007,.111],[.008,.113]],.003,M.black,.0015);
  thinRibbon(flex,[[-.022,.122],[-.027,.116],[-.027,.105],[-.025,.098]],.0018,M.foil,.0016);
  thinRibbon(flex,[[.023,.031],[.023,.037],[.019,.042],[.012,.044]],.0027,M.black,.00155);
  for(let i=0;i<6;i++)cub(flex,.0004,.0012,.00025,-.014+i*.0009,.122,.00186,M.gold);
  const optics=p.optics=group('Rear_camera_brackets');
  // Subtle camera module fasteners behind original camera lenses.
  put(optics,plate(.032,.033,.0012,.004,M.darkAlu),.015,.139,-.0045);
  for(const [x,y] of [[.007,.142],[.022,.149],[.023,.13]]){
    disc(optics,.0042,.00035,x,y,-.0049,M.alu);
    disc(optics,.0036,.00038,x,y,-.0055,M.black);
  }
  return p;
}
function layerFor(n){
  if(n.startsWith('Front_'))return 'display';
  if(/^Back_Cam|^Back_Flash|^Back_Mic|^Back_IR/.test(n))return 'rearCameras';
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
    }
    if(/COLOUR_Cherry_Backpanel/.test(name)){
      mat.metalness=.42;mat.roughness=.34;mat.envMapIntensity=1.45;mat.transparent=false;mat.opacity=1;mat.color.set('#61303d');
    }
    if(/COLOUR_Cherry_Screen/.test(name)){
      mat.emissiveIntensity=1.65;mat.roughness=.13;mat.envMapIntensity=.32;
    }
    if(/BASE_Cam_Lens/.test(name)){
      mat.roughness=.075;mat.envMapIntensity=1.65;
    }
    if(/BASE_Glass|BASE_Cam_Edge_Black/.test(name)){
      mat.roughness=.09;mat.envMapIntensity=1.5;
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
  const internals=internalAssembly();Object.assign(layers,internals);
  for(const [name,g] of Object.entries(internals))root.add(g);
  // Glass footprint lies within the source display (73.0 x 158.5 mm).
  const glass=layers.glass=group('Tempered_glass');
  const sheet=plate(.0728,.1583,.00023,.0059,M.glass);
  put(glass,sheet,0,.08165,.00441);root.add(glass);
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
  motion(l.glass,p,.005,.16,[-.002,.001,.076],[.035,-.035,-.01]);
  motion(l.display,p,.13,.30,[-.012,.004,.053],[.025,-.06,-.018]);
  motion(l.flex,p,.28,.39,[-.006,.000,.020],[.03,.018,-.02]);
  motion(l.battery,p,.35,.51,[.020,-.007,.040],[-.015,.025,.025]);
  motion(l.logic,p,.49,.64,[-.029,.010,.052],[.045,-.04,-.07]);
  motion(l.lower,p,.61,.73,[.022,-.016,.051],[-.04,.03,.07]);
  motion(l.optics,p,.70,.80,[.010,.002,-.035],[.03,.018,.025]);
  motion(l.rearCameras,p,.76,.88,[.006,.005,-.046],[.025,.035,-.02]);
  motion(l.back,p,.85,.99,[.000,.000,-.073],[.03,.04,0]);
  // Structural chassis retains original position; it is an interior reference layer.
}
const captions=[
  {at:0,name:'PROTECTIVE GLASS',title:'Первый слой<br><em>открывает больше.</em>',desc:'Тонкое защитное стекло медленно отделяется от дисплея.'},
  {at:.15,name:'DISPLAY',title:'Чистота<br><em>изображения.</em>',desc:'Дисплей выходит из посадочного места и открывает внутреннюю конструкцию.'},
  {at:.33,name:'BATTERY',title:'Энергия<br><em>внутри формы.</em>',desc:'Аккумулятор выходит из корпуса, сохраняя свою ориентацию.'},
  {at:.49,name:'LOGIC BOARD',title:'Архитектура<br><em>невидимого.</em>',desc:'Плата, экраны и контакты раскрываются как отдельные элементы.'},
  {at:.69,name:'CAMERA ASSEMBLY',title:'Точность<br><em>каждого слоя.</em>',desc:'Система камер и её крепления смещаются в глубину композиции.'},
  {at:.86,name:'EXPLODED VIEW',title:'Всё на<br><em>своих местах.</em>',desc:'Поверните модель, чтобы рассмотреть разборку с другой стороны.'}
];
let renderer,scene,camera,rig,model,layers,ready=false;
let wanted=0,progress=0,orbit=0,pointer={x:0,y:0},last=performance.now(),lastCaption=-1;
let drag=false,dragStart=null,orbitAtStart=0, introAt=performance.now();
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
function resize(){
  if(!renderer)return;
  const dpr=Math.min(devicePixelRatio||1,mobile()?1.65:2);
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
    try{const built=buildPhone(g.scene);model=built.phone;layers=built.layers;rig.add(model);ready=true;scrollState();loading.classList.add('hidden');requestAnimationFrame(frame);}catch(e){console.error(e);loadingText.textContent='Ошибка подготовки модели: '+e.message;}
  },undefined,e=>{console.error(e);loadingText.textContent='Не удалось загрузить модель. Запустите сайт через HTTP/HTTPS.';});
  resize();addEventListener('resize',resize,{passive:true});addEventListener('scroll',scrollState,{passive:true});
  addEventListener('pointermove',e=>{
    pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2;
    if(!drag||!dragStart)return;
    const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;
    if(e.pointerType==='touch' && Math.abs(dx)<Math.abs(dy)*1.35)return;
    orbit=clamp(orbitAtStart+dx/Math.max(innerWidth,330)*3.1,-1.28,1.28);
  },{passive:true});
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag=true;dragStart={x:e.clientX,y:e.clientY};orbitAtStart=orbit;});
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
  progress+=(wanted-progress)*a;disassemble(progress,layers);updateCaption(progress);
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
  const pitch= (inAnatomy?-.06:.04) + (drag?0:-pointer.y*.08);
  rig.rotation.x+=(pitch-rig.rotation.x)*lerp;
  const inOutro=scrollY>anatomy.offsetTop+anatomy.offsetHeight-innerHeight*.3;
  const shown=!inOutro || !!v;
  canvas.style.opacity=String(clamp((anatomy.offsetTop+anatomy.offsetHeight-scrollY)/Math.max(1,innerHeight*.45)));
  const wantedY=v?0:inAnatomy?(mobile()?2.1:.20):-1.5;
  rig.position.y+=(wantedY-rig.position.y)*lerp;
  const wantScale=v?1:inAnatomy?(mobile()?.78:.96):(mobile()?.72:.84);
  const scale=rig.scale.x+(wantScale-rig.scale.x)*lerp;
  rig.scale.setScalar(scale);
  const desiredZ=mobile()?37+phase(progress,.4,.90)*5:35+phase(progress,.55,.95)*5;
  camera.position.z+=(desiredZ-camera.position.z)*lerp;
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
setup();
