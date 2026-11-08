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

// True WebGL volumetric fog: a 3D density field integrated through the depth of
// several independently positioned smoke volumes. It is not a CSS blur layer.
const smokeVolumes=[];
let smokeClock=0;
let smokeLoaded=false;
function createVolumetricSmoke(renderer,scene){
  fetch('./assets/smoke-volume-64.raw').then(r=>{
    if(!r.ok) throw new Error('Smoke density HTTP '+r.status);
    return r.arrayBuffer();
  }).then(buffer=>{
    if(buffer.byteLength !== 64*64*64) throw new Error('Incorrect smoke volume data');
    const vol=new THREE.Data3DTexture(new Uint8Array(buffer),64,64,64);
    vol.format=THREE.RedFormat;
    vol.type=THREE.UnsignedByteType;
    vol.minFilter=THREE.LinearFilter;
    vol.magFilter=THREE.LinearFilter;
    vol.wrapS=THREE.RepeatWrapping;
    vol.wrapT=THREE.RepeatWrapping;
    vol.wrapR=THREE.RepeatWrapping;
    vol.unpackAlignment=1;
    vol.generateMipmaps=false;
    vol.needsUpdate=true;
    const vertex=`
      out vec3 vLocal;
      void main(){
        vLocal=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `;
    const fragment=`
      precision highp float;
      precision highp sampler3D;
      in vec3 vLocal;
      uniform sampler3D uNoise;
      uniform vec3 uCameraLocal;
      uniform vec3 uTint;
      uniform vec3 uOffset;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uScroll;
      uniform int uSteps;
      out vec4 outColor;
      float densityAt(vec3 p){
        vec3 uv=p*.335+uOffset+vec3(uTime*.0035,-uTime*.0075,uTime*.0025);
        float n=texture(uNoise,fract(uv)).r;
        float detail=texture(uNoise,fract(uv*2.15+vec3(.37,.21,.13))).r;
        float f=n*.76+detail*.24;
        float soft=1.0-smoothstep(.46,1.22,length(p*vec3(.89,1.07,.80)));
        float wisps=smoothstep(.38,.71,f);
        return soft*wisps;
      }
      void main(){
        vec3 dir=normalize(vLocal-uCameraLocal);
        vec3 safeDir=vec3(
          dir.x<0.0?min(dir.x,-.0001):max(dir.x,.0001),
          dir.y<0.0?min(dir.y,-.0001):max(dir.y,.0001),
          dir.z<0.0?min(dir.z,-.0001):max(dir.z,.0001)
        );
        vec3 tA=(-vec3(1.0)-uCameraLocal)/safeDir;
        vec3 tB=(vec3(1.0)-uCameraLocal)/safeDir;
        vec3 tn=min(tA,tB);
        vec3 tf=max(tA,tB);
        float enter=max(max(tn.x,tn.y),tn.z);
        float leave=min(min(tf.x,tf.y),tf.z);
        float startT=max(0.0,enter);
        float endT=min(leave,length(vLocal-uCameraLocal));
        if(endT<=startT){discard;}
        float stepT=(endT-startT)/float(uSteps);
        float a=0.0;
        vec3 rgb=vec3(0.0);
        for(int i=0;i<18;i++){
          if(i>=uSteps)break;
          vec3 p=uCameraLocal+dir*(startT+(float(i)+.5)*stepT);
          float density=densityAt(p);
          // Exponential absorption in a 3D density field: a smoke volume,
          // not a stack of flat images.
          float da=(1.0-exp(-density*stepT*uOpacity*2.8))*(1.0-a);
          float light=clamp(.26+.27*(p.y+1.0)+.18*(p.x+1.0),.14,.85);
          vec3 smokeColor=mix(uTint,vec3(.89,.91,.93),light*.46);
          rgb+=smokeColor*da;
          a+=da;
          if(a>.985)break;
        }
        if(a<.002)discard;
        outColor=vec4(rgb/max(a,.00001), a);
      }
    `;
    // Positions are in the same physical 3D world as the phone. Volumes are
    // deliberately behind the subject so its silhouette remains crisp.
    const configs=[
      {pos:[-14,-3,-14],scale:[13,12,6],rot:[.04,.18,-.12],tint:'#4d5258',opacity:1.34,offset:[.11,.32,.55]},
      {pos:[14,2,-17],scale:[12,13,8],rot:[.03,-.23,.12],tint:'#64676c',opacity:1.27,offset:[.64,.17,.39]},
      {pos:[-3,-11,-20],scale:[17,8,7],rot:[.12,.09,-.10],tint:'#92959b',opacity:1.18,offset:[.37,.76,.13]},
      {pos:[2,12,-26],scale:[19,7,9],rot:[-.09,.13,.06],tint:'#8b8d91',opacity:.93,offset:[.15,.55,.78]},
      {pos:[17,-9,-24],scale:[10,10,6],rot:[.07,-.08,.21],tint:'#4b5057',opacity:1.14,offset:[.83,.41,.68]}
    ];
    const low=innerWidth<700;
    for(let i=0;i<configs.length;i++){
      if(low && i===3)continue;
      const c=configs[i];
      const mat=new THREE.ShaderMaterial({
        glslVersion:THREE.GLSL3,
        vertexShader:vertex,fragmentShader:fragment,
        uniforms:{
          uNoise:{value:vol},
          uCameraLocal:{value:new THREE.Vector3()},
          uTint:{value:new THREE.Color(c.tint)},
          uOffset:{value:new THREE.Vector3(...c.offset)},
          uTime:{value:0},uScroll:{value:0},
          uOpacity:{value:c.opacity},
          uSteps:{value:low?10:16}
        },
        transparent:true,depthWrite:false,depthTest:true,
        side:THREE.BackSide,
        blending:THREE.NormalBlending,
        toneMapped:false
      });
      const obj=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mat);
      obj.position.set(...c.pos);
      obj.scale.set(...c.scale);
      obj.rotation.set(...c.rot);
      obj.renderOrder=-2;
      obj.frustumCulled=false;
      obj.userData.basePos=obj.position.clone();
      obj.userData.baseRotation=obj.rotation.clone();
      obj.userData.phase=i*.91;
      scene.add(obj);
      smokeVolumes.push(obj);
    }
    smokeLoaded=true;
  }).catch(err=>{console.warn('3D smoke unavailable; showing grey atmospheric fallback.',err);});
}
function updateVolumetricSmoke(now,cam,pointer,progress,reduced){
  if(!smokeLoaded)return;
  const time=reduced?0:now*.001;
  for(const obj of smokeVolumes){
    const k=obj.userData.phase;
    obj.position.copy(obj.userData.basePos);
    obj.position.x+=pointer.x*(.18+.11*k)+Math.sin(time*.12+k)*.36;
    obj.position.y+=Math.cos(time*.095+k*1.2)*.29;
    obj.rotation.y=obj.userData.baseRotation.y+Math.sin(time*.08+k)*.035;
    obj.rotation.z=obj.userData.baseRotation.z+Math.cos(time*.07+k)*.015;
    obj.updateMatrixWorld();
    obj.material.uniforms.uCameraLocal.value.copy(obj.worldToLocal(cam.position.clone()));
    obj.material.uniforms.uTime.value=time;
    obj.material.uniforms.uScroll.value=progress;
  }
}
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
  screen:loadTexture('./assets/screen-lumosites.jpg',{flipY:false}),
  battery:loadTexture('./assets/battery-real.png'),
  board:loadTexture('./assets/board-real.png')
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
function cellLabel(){
  const c=document.createElement('canvas');c.width=768;c.height=1152;
  const x=c.getContext('2d');
  x.fillStyle='#25282a';x.fillRect(0,0,c.width,c.height);
  const g=x.createLinearGradient(0,0,768,1152);g.addColorStop(0,'rgba(255,255,255,.075)');g.addColorStop(.54,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(0,0,768,1152);
  x.fillStyle='#b8bcbe';x.textAlign='center';x.font='bold 24px Arial';x.fillText('Li-ion Polymer Battery',384,225);
  x.font='16px Arial';x.fillStyle='#888d8d';x.fillText('Rechargeable battery  •  assembled in tray',384,263);
  x.strokeStyle='#565b60';x.lineWidth=2;x.strokeRect(74,316,620,1);
  x.font='15px Arial';x.fillStyle='#7e8386';
  ['Do not bend, puncture or incinerate.','Service by trained personnel only.','Recycle according to local regulations.'].forEach((s,i)=>x.fillText(s,384,382+i*39));
  x.strokeStyle='#474b4e';x.strokeRect(74,500,620,1);
  x.font='bold 46px Arial';x.fillStyle='#b0b3b3';x.fillText('Li-ion',384,853);
  x.font='16px Arial';x.fillStyle='#86898a';x.fillText('ASSEMBLED CELL MODULE',384,903);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function boardTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#1f2e2a';ctx.fillRect(0,0,1024,1024);
  let seed=71;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.strokeStyle='rgba(181,150,93,.23)';ctx.lineWidth=2;
  for(let i=0;i<210;i++){
    const x=Math.floor(rand()*980)+15,y=Math.floor(rand()*980)+15;
    ctx.beginPath();ctx.moveTo(x,y);const dx=(rand()-.5)*180,dy=(rand()-.5)*170;ctx.lineTo(x+dx,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
  }
  ctx.fillStyle='rgba(216,189,112,.55)';for(let i=0;i<125;i++){const x=rand()*1024,y=rand()*1024;ctx.fillRect(x,y,2+rand()*4,2+rand()*4);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

function portfolioScreenTexture(){
  const c=document.createElement('canvas'); c.width=900; c.height=1950;
  const x=c.getContext('2d');
  const bg=x.createLinearGradient(0,0,0,c.height); bg.addColorStop(0,'#0f0f12'); bg.addColorStop(1,'#1b1b20');
  x.fillStyle=bg; x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#8d3346'; x.fillRect(0,0,c.width,18);
  x.fillStyle='#f5f5f3'; x.font='700 72px Arial'; x.fillText('Lumo Sites',70,150);
  x.fillStyle='#b2b2b6'; x.font='28px Arial'; x.fillText('web design · interfaces · 3D experiences',70,200);
  x.fillStyle='#ffffff'; x.font='bold 130px Arial'; x.fillText('Digital',68,410); x.fillText('craft',68,540);
  x.fillStyle='#8d3346'; x.fillRect(70,605,240,7);
  x.fillStyle='#dfdfe3'; x.font='30px Arial';
  x.fillText('Modern portfolio presentation',70,690);
  x.fillText('Fast, aesthetic and interactive',70,738);
  const cards=[['Project · Tattoo artist','#20181c'],['Project · Premium product','#15171b'],['Project · Perfume catalog','#1a1718']];
  cards.forEach((card,i)=>{
    const y=820+i*250; x.fillStyle=card[1]; roundRect(x,70,y,760,180,24,true,false); x.strokeStyle='rgba(255,255,255,.12)'; roundRect(x,70,y,760,180,24,false,true); x.fillStyle='#ececee'; x.font='600 38px Arial'; x.fillText(card[0],110,y+72); x.fillStyle='#b1b1b5'; x.font='24px Arial'; x.fillText('Interactive layout / motion / mobile-first',110,y+118); x.fillStyle='#8d3346'; x.fillRect(110,y+138,180,5);
  });
  x.fillStyle='#f6f6f4'; x.font='700 42px Arial'; x.fillText('lumosites.ru',70,1710); x.fillStyle='#a6a6aa'; x.font='24px Arial'; x.fillText('Conceptual preview on device display',70,1755);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); if(fill)ctx.fill(); if(stroke)ctx.stroke(); }
function internalAssembly(){
  const p={};
  const tray=p.tray=group('Internal_chassis');
  put(tray,plate(.0717,.1545,.00055,.0062,M.darkAlu),0,.0815,-.00385);
  cub(tray,.066,.003,.0005,0,.153,-.0028,M.alu,.0008);
  cub(tray,.066,.003,.0005,0,.010,-.0028,M.alu,.0008);
  for(let i=0;i<9;i++){
    const y=.017+i*.0163;
    disc(tray,.00063,.00025,-.0328,y,-.0028,M.edge);
    disc(tray,.00063,.00025,.0328,y,-.0028,M.edge);
  }

  const battery=p.battery=group('Battery_assembly');
  put(battery,plate(.054,.084,.00135,.0055,M.alu),.0015,.0758,-.00215);
  put(battery,plate(.0514,.0808,.0009,.0048,M.foil),.0015,.0758,-.00065);
  const battMat=new THREE.MeshStandardMaterial({map:assetTex.battery,alphaMap:assetTex.battery,transparent:true,side:THREE.DoubleSide,roughness:.9,metalness:.04});
  const battPlane=new THREE.Mesh(new THREE.PlaneGeometry(.0506,.0694),battMat);
  put(battery,battPlane,.0024,.0782,.00155);
  cub(battery,.012,.0054,.0007,-.011,.1186,.00095,M.black,.0011);
  for(let i=0;i<4;i++)cub(battery,.001,.002,.0003,-.015+i*.0029,.122,.0014,M.gold);
  cub(battery,.034,.0011,.0002,.003,.032,.0013,M.edge);

  const logic=p.logic=group('Logic_board_assembly');
  const logicBack=plate(.041,.053,.0014,.0048,M.black);
  put(logic,logicBack,-.016,.135,-.0005);
  logicBack.rotation.z=.09;
  const boardMat=new THREE.MeshStandardMaterial({map:assetTex.board,alphaMap:assetTex.board,transparent:true,side:THREE.DoubleSide,roughness:.72,metalness:.08});
  const boardPlane=new THREE.Mesh(new THREE.PlaneGeometry(.048,.042),boardMat);
  put(logic,boardPlane,-.015,.136,.0012);
  boardPlane.rotation.z=.06;
  cub(logic,.006,.003,.0007,-.028,.115,.0017,M.gold,.0002);
  cub(logic,.008,.004,.00075,-.025,.149,.0017,M.darkAlu,.0003);
  cub(logic,.009,.0045,.00075,-.003,.128,.0017,M.darkAlu,.0003);

  const cameraCore=p.cameraCore=group('Camera_core');
  put(cameraCore,plate(.026,.029,.00125,.0045,M.darkAlu),.015,.139,-.0115);
  for(const [x,y,ro,ri] of [[.007,.142,.0065,.005],[.022,.149,.0061,.0048],[.023,.1305,.0057,.0044]]){
    disc(cameraCore,ro,.0011,x,y,-.0106,M.edge);
    disc(cameraCore,ri,.00125,x,y,-.0096,M.black);
    disc(cameraCore,ri*.52,.0006,x,y,-.0088,M.alu);
  }
  cub(cameraCore,.006,.009,.0014,.0115,.138,-.0121,M.black,.001);
  cub(cameraCore,.009,.0046,.0011,.025,.142,-.0118,M.darkAlu,.0009);

  const lower=p.lower=group('Lower_assembly');
  put(lower,plate(.058,.026,.003,.0035,M.black),0,.018,-.00185);
  put(lower,plate(.022,.015,.0008,.0025,M.darkAlu),-.016,.016,.00135);
  put(lower,plate(.013,.015,.0008,.0025,M.darkAlu),.018,.016,.00135);
  for(let i=0;i<11;i++) cub(lower,.0006,.003,.00025,-.025+i*.0019,.016,.0023,M.alu,.00015);
  for(let i=0;i<7;i++) cub(lower,.00065,.003,.00028,.013+i*.0018,.016,.0023,M.alu,.00015);
  cub(lower,.020,.007,.00065,0,.007,.0018,M.foil,.002);

  const flex=p.flex=group('Flex_cables');
  thinRibbon(flex,[[-.010,.120],[-.010,.116],[-.004,.113],[.008,.110],[.009,.112]],.0024,M.black,.0015);
  thinRibbon(flex,[[-.022,.123],[-.026,.117],[-.026,.106],[-.025,.097]],.0015,M.foil,.00152);
  thinRibbon(flex,[[.023,.031],[.023,.037],[.019,.042],[.012,.044]],.0022,M.black,.00155);
  for(let i=0;i<6;i++) cub(flex,.0004,.0012,.00025,-.014+i*.0009,.122,.00186,M.gold);

  const optics=p.optics=group('Rear_camera_brackets');
  put(optics,plate(.028,.029,.00095,.004,M.darkAlu),.015,.139,-.0077);
  for(const [x,y] of [[.007,.142],[.022,.149],[.023,.1305]]){
    disc(optics,.0039,.0003,x,y,-.0084,M.alu);
    disc(optics,.0032,.0003,x,y,-.0089,M.black);
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
const previewScreenTexture = portfolioScreenTexture();
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
      mat.map=assetTex.screen || previewScreenTexture; mat.emissiveMap=assetTex.screen || previewScreenTexture;
      mat.emissive=new THREE.Color('#ffffff'); mat.emissiveIntensity=1.05;mat.roughness=.06;mat.envMapIntensity=.55;
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
  const internals=internalAssembly();Object.assign(layers,internals);
  for(const [name,g] of Object.entries(internals))root.add(g);
  // Glass footprint lies within the source display (73.0 x 158.5 mm).
  const glass=layers.glass=group('Tempered_glass');
  const glassY=.0823;
  const sheet=plate(.0666,.1464,.00018,.0049,M.glass);
  put(glass,sheet,0,glassY,.0048);
  const borderShape=shape(.0666,.1464,.0049); borderShape.holes.push(shape(.0644,.1442,.0042));
  const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(borderShape,{depth:.00006,bevelEnabled:false,curveSegments:18}),new THREE.MeshPhysicalMaterial({color:'#111215',metalness:.08,roughness:.2,transparent:true,opacity:.92}));
  put(glass,rim,0,glassY,.00487);
  const edgeGlow=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape(.06645,.14625,.00485).getPoints(24)),new THREE.LineBasicMaterial({color:'#dfe2e6',transparent:true,opacity:.28}));
  put(glass,edgeGlow,0,glassY,.00494);
  root.add(glass);
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
  if(l.optics) l.optics.visible = p > .63;
  if(l.cameraCore) l.cameraCore.visible = p > .69;
  motion(l.glass,p,.005,.16,[-.010,.002,.084],[.015,-.02,-.006]);
  motion(l.display,p,.12,.30,[-.016,.004,.058],[.018,-.04,-.012]);
  motion(l.flex,p,.27,.39,[-.006,.000,.020],[.02,.014,-.018]);
  motion(l.battery,p,.34,.52,[.018,-.005,.038],[-.012,.02,.02]);
  motion(l.logic,p,.48,.64,[-.030,.014,.055],[.03,-.02,-.04]);
  motion(l.lower,p,.60,.72,[.022,-.016,.052],[-.03,.025,.06]);
  motion(l.optics,p,.70,.81,[.004,.004,-.036],[.02,.015,.015]);
  motion(l.cameraCore,p,.73,.85,[.012,.006,-.046],[.015,.025,-.02]);
  motion(l.rearCameras,p,.77,.90,[.017,.010,-.052],[.02,.03,-.015]);
  motion(l.back,p,.84,.99,[.056,.000,-.010],[.01,.14,0]);
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
  createVolumetricSmoke(renderer,scene);
  new GLTFLoader().load('./assets/iphone18-burgundy.glb', g=>{
    try{const built=buildPhone(g.scene);model=built.phone;layers=built.layers;rig.add(model);ready=true;scrollState();loading.classList.add('hidden');requestAnimationFrame(frame);}catch(e){console.error(e);loadingText.textContent='Ошибка подготовки модели: '+e.message;}
  },undefined,e=>{console.error(e);loadingText.textContent='Не удалось загрузить модель. Запустите сайт через HTTP/HTTPS.';});
  resize();addEventListener('resize',resize,{passive:true});addEventListener('scroll',scrollState,{passive:true});
  addEventListener('pointermove',e=>{
    pointer.x=(e.clientX/innerWidth-.5)*2;pointer.y=(e.clientY/innerHeight-.5)*2;
    if(!drag||!dragStart)return;
    const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;
    if(e.pointerType==='touch' && Math.abs(dx)<Math.abs(dy)*1.35)return;
orbit=orbitAtStart+dx/Math.max(innerWidth,330)*6.2;
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
  const wantedY=v?0:inAnatomy?(mobile()?1.85:-.12):-4.2;
  rig.position.y+=(wantedY-rig.position.y)*lerp;
  const wantScale=v?1:inAnatomy?(mobile()?.74:.92):(mobile()?.62:.70);
  const scale=rig.scale.x+(wantScale-rig.scale.x)*lerp;
  rig.scale.setScalar(scale);
  const desiredZ=mobile()?37+phase(progress,.4,.90)*5:35+phase(progress,.55,.95)*5;
  camera.position.z+=(desiredZ-camera.position.z)*lerp;
  updateVolumetricSmoke(now,camera,pointer,progress,reduced);
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
setup();
