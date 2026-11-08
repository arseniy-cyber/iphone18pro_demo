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
        float r=length(p*vec3(.88,.95,.76));
        float soft=1.0-smoothstep(.14,.97,r);
        soft=soft*soft*(3.0-2.0*soft);
        float wisps=smoothstep(.30,.66,f);
        return soft*wisps*.40;
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
          float light=clamp(.40+.22*(p.y+1.0)+.12*(p.x+1.0),.26,.93);
          vec3 smokeColor=mix(uTint,vec3(.94,.945,.95),light*.48);
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
      {pos:[-14,-4,-25],scale:[12,12,6],rot:[.03,.16,-.06],tint:'#acb0b6',opacity:.48,offset:[.11,.32,.55]},
      {pos:[ 13, 1,-25],scale:[12,13,7],rot:[0,-.17,.06],tint:'#a2a6ae',opacity:.53,offset:[.64,.17,.39]},
      {pos:[ -6,-12,-29],scale:[17, 8,6],rot:[.07,.06,-.04],tint:'#b4b8be',opacity:.42,offset:[.37,.76,.13]},
      {pos:[  4,11,-31],scale:[15, 7,8],rot:[-.04,.10,.03],tint:'#c1c3c6',opacity:.35,offset:[.15,.55,.78]}
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
          uSteps:{value:low?9:13}
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
    obj.position.x+=pointer.x*(.35+.10*k)+Math.sin(time*.11+k)*.42;
    obj.position.y+=pointer.y*.08+Math.cos(time*.07+k*1.2)*.33;
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
  screen:loadTexture('./assets/screen-lumosites.jpg',{flipY:false})
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

  // Recessed camera hardware is packed behind the original external lenses.
  // One rigid unit, no duplicated floating circles or disconnected slabs.
  const camera=p.cameraCore=group('camera module and sensor carriers');
  const cameraOutline=[[-.001,.124],[.030,.124],[.032,.127],[.032,.153],[.029,.156],[-.001,.156],[-.003,.153],[-.003,.127]];
  shaped(camera,cameraOutline,-.0047,.0023,material('#202326',.48,.42),.00045);
  // Their centers match the original mesh lens coordinates.
  const lensCentres=[[.0246,.1490,.0046],[.0246,.1297,.0048],[.0065,.1393,.0050]];
  for(const [x,y,r] of lensCentres){
    const bracket=new THREE.Mesh(new THREE.TorusGeometry(r,.00052,10,48),M.edge);
    put(camera,bracket,x,y,-.00195);
    const lens=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r*.78,.0015,40),M.black);
    lens.rotation.x=Math.PI/2;put(camera,lens,x,y,-.0026);
    const darkGlass=new THREE.Mesh(new THREE.CircleGeometry(r*.52,40),material('#0a111b',.42,.095,{clearcoat:1,clearcoatRoughness:.02}));
    put(camera,darkGlass,x,y,-.00177);
  }
  cub(camera,.006,.004,.00085,.007,.131,-.0021,M.alu,.00055);
  cub(camera,.007,.004,.0008,.014,.128,-.0021,M.darkAlu,.00045);
  for(const [x,y] of [[.000,.128],[.029,.128],[.000,.152]])fastener(camera,x,y,-.00168,.52);
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
    }
    if(/COLOUR_Cherry_Backpanel/.test(name)){
      mat.metalness=.42;mat.roughness=.34;mat.envMapIntensity=1.45;mat.transparent=false;mat.opacity=1;mat.color.set('#61303d');
    }
    if(/COLOUR_Cherry_Screen/.test(name)){
      mat.map=assetTex.screen; mat.emissiveMap=assetTex.screen;
      mat.emissive=new THREE.Color('#ffffff'); mat.emissiveIntensity=.88;mat.roughness=.06;mat.envMapIntensity=.55;
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
  // Unify interior camera sensors with the original exterior cameras: one rigid unit.
  const sensorBlock=internals.cameraCore;delete internals.cameraCore;
  Object.assign(layers,internals);
  for(const [name,g] of Object.entries(internals))root.add(g);
  layers.rearCameras.add(sensorBlock);
  // Source display bounds: x = ±0.036515, y = 0.002391..0.160878.
  // Detachable tempered glass is exactly aligned with this perimeter.
  const glass=layers.glass=group('tempered glass with 0.9mm black perimeter');
  const faceW=.07303,faceH=.158487,glassY=(.002391+.160878)*.5;
  const glassSheet=new THREE.Mesh(new THREE.ShapeGeometry(shape(faceW,faceH,.0064),20),
    new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.012,depthWrite:false,side:THREE.DoubleSide}));
  put(glass,glassSheet,0,glassY,.00459);
  // Draw a mesh ring rather than using Shape.holes, which can fill the screen on
  // different GPU paths depending on winding order.
  const makeRim=(width,height,r,stroke,z,mat)=>{
    const N=96;
    const a=shape(width,height,r).getSpacedPoints(N-1);
    const b=shape(width-stroke*2,height-stroke*2,r-stroke).getSpacedPoints(N-1);
    const positions=[],normals=[];
    for(let k=0;k<N;k++){
      const j=(k+1)%N;
      for(const v of [a[k],a[j],b[k],a[j],b[j],b[k]]){
        positions.push(v.x,v.y,z);normals.push(0,0,1);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    const mesh=new THREE.Mesh(geo,mat);mesh.material.side=THREE.DoubleSide;return mesh;
  };
  put(glass,makeRim(faceW,faceH,.0064,.00085,0,
    new THREE.MeshBasicMaterial({color:'#15171b',transparent:true,opacity:.91,depthWrite:false})),0,glassY,.00466);
  put(glass,makeRim(faceW,faceH,.0064,.00010,0,
    new THREE.MeshBasicMaterial({color:'#fbfbfd',transparent:true,opacity:.48,depthWrite:false})),0,glassY,.00469);
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
  motion(l.glass,p,.008,.18,[0,.001,.081],[.010,0,0]);
  motion(l.display,p,.15,.34,[0,0,.054],[.012,0,0]);
  motion(l.flex,p,.26,.42,[-.010,.001,.020],[.01,0,0]);
  motion(l.battery,p,.35,.55,[.006,-.002,.046],[0,.018,0]);
  motion(l.logic,p,.49,.68,[-.010,.003,.060],[.015,-.018,0]);
  motion(l.lower,p,.63,.77,[0,-.005,.064],[0,.012,0]);
  // Move both camera layers along the optical axis, not sideways.
  // The external original model remains a single rigid assembly.
  motion(l.rearCameras,p,.73,.91,[0,0,-.056],[.008,0,0]);
  // Rear plate travels straight backwards, parallel to the chassis.
  motion(l.back,p,.86,.998,[0,0,-.083],[0,0,0]);
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
  const pitch= orbitPitch+(inAnatomy?-.06:.04) + (drag?0:-pointer.y*.055);
  rig.rotation.x+=(pitch-rig.rotation.x)*lerp;
  const inOutro=scrollY>anatomy.offsetTop+anatomy.offsetHeight-innerHeight*.3;
  const shown=!inOutro || !!v;
  canvas.style.opacity=String(clamp((anatomy.offsetTop+anatomy.offsetHeight-scrollY)/Math.max(1,innerHeight*.45)));
  const wantedY=v?0:inAnatomy?(mobile()?1.55:-.10):(mobile()?-4.25:-4.5);
  rig.position.y+=(wantedY-rig.position.y)*lerp;
  const wantScale=v?1:inAnatomy?(mobile()?.75:.93):(mobile()?.63:.72);
  const scale=rig.scale.x+(wantScale-rig.scale.x)*lerp;
  rig.scale.setScalar(scale);
  const desiredZ=mobile()?37+phase(progress,.4,.90)*5:35+phase(progress,.55,.95)*5;
  camera.position.z+=(desiredZ-camera.position.z)*lerp;
  updateVolumetricSmoke(now,camera,pointer,progress,reduced);
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
setup();
