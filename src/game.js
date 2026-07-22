import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

window.addEventListener('error', e=>{
  const el=document.getElementById('err');
  el.style.display='flex';
  el.textContent='O sonho não carregou: '+(e.message||e.error);
});

/* ====================== paletas & sussurros ====================== */
const PALETTES = [
  { name:'rosa',    top:0xffc2ec, bot:0xb9a7ff, fog:0xd6b6ec, moon:0xfff0fb, glow:0xffb8ec, prop:0xf0d9ff, water:0x2a2148 },
  { name:'menta',   top:0xbdf6e6, bot:0x9fd8ff, fog:0xbfe9e6, moon:0xf0fff8, glow:0x8effe0, prop:0xd9fff2, water:0x143a38 },
  { name:'âmbar',   top:0xffe0b0, bot:0xffb2c9, fog:0xf3cdb6, moon:0xfff4e0, glow:0xffcf9a, prop:0xffe6cf, water:0x3a2820 },
  { name:'violeta', top:0xc9b0ff, bot:0x7f79e0, fog:0xa79ae6, moon:0xefe6ff, glow:0xc7b0ff, prop:0xe0d4ff, water:0x241d4a },
  { name:'noite',   top:0x6a7bd6, bot:0x2b2350, fog:0x4d4a80, moon:0xdfe6ff, glow:0x9fb0ff, prop:0xb9c2ff, water:0x0e1030 },
];
const WHISPERS = [
  'você já esteve aqui, faz muito tempo',
  'o corredor não terminava, você só cansou',
  'alguém deixou a luz acesa pra você',
  'era verão, e a piscina estava vazia',
  'a saída ficava sempre uma sala adiante',
  'você lembra do cheiro, não do lugar',
  'a música vinha de um cômodo sem porta',
  'tudo parecia maior quando você era menor',
  'a tarde não acabava, e ninguém chamava pra jantar',
  'você acenou, mas o reflexo demorou a responder',
  'as escadas subiam pra um céu de carpete',
  'guardaram esse lugar só pra você esquecer',
  'a névoa conhece o seu nome',
  'ficou tudo quieto do jeito que você gostava',
  'a lua te seguiu até em casa',
];

/* ====================== renderer ====================== */
const app=document.getElementById('app');
const renderer=new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', stencil:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=0.98;
renderer.outputColorSpace=THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 1200);
camera.position.set(0,1.75,0);

const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(renderer),0.04).texture;
scene.fog=new THREE.FogExp2(0xd6b6ec,0.011);

/* ====================== luzes ====================== */
const hemi=new THREE.HemisphereLight(0xffd6f2,0x6a6690,0.55);
scene.add(hemi);
const amb=new THREE.AmbientLight(0xffffff,0.14); scene.add(amb);
const moonLight=new THREE.DirectionalLight(0xffffff,1.7);
moonLight.position.set(-60,80,-45);
moonLight.castShadow=true;
moonLight.shadow.mapSize.set(2048,2048);
moonLight.shadow.camera.near=1; moonLight.shadow.camera.far=260;
moonLight.shadow.camera.left=-90; moonLight.shadow.camera.right=90;
moonLight.shadow.camera.top=90; moonLight.shadow.camera.bottom=-90;
moonLight.shadow.bias=-0.0006; moonLight.shadow.radius=5;
scene.add(moonLight);
scene.add(moonLight.target);

// luzes dinâmicas que seguem as memórias mais próximas
const POOL=4, poolLights=[];
for(let i=0;i<POOL;i++){ const p=new THREE.PointLight(0xffb8ec,0,34,2); scene.add(p); poolLights.push(p); }

/* ====================== céu ====================== */
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide, fog:false, depthWrite:false,
  uniforms:{ top:{value:new THREE.Color(0xffc2ec)}, bot:{value:new THREE.Color(0xb9a7ff)} },
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader:`varying vec3 vP; uniform vec3 top; uniform vec3 bot;
    void main(){ float h=clamp(normalize(vP).y*0.5+0.5,0.0,1.0); h=pow(h,0.8);
      gl_FragColor=vec4(mix(bot,top,h),1.0);} `
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(600,48,28),skyMat);
scene.add(sky);

const moon=new THREE.Mesh(new THREE.SphereGeometry(34,64,64),
  new THREE.MeshBasicMaterial({color:0xfff0fb,fog:false}));
moon.position.set(-140,95,-300); scene.add(moon);
const halo=new THREE.Mesh(new THREE.SphereGeometry(52,32,32),
  new THREE.MeshBasicMaterial({color:0xffb8ec,transparent:true,opacity:0.22,fog:false,side:THREE.BackSide}));
moon.add(halo);

/* ====================== água reflexiva ====================== */
const waterGeo=new THREE.PlaneGeometry(4000,4000);
const waterNormals=makeWaterNormals();
const water=new Water(waterGeo,{
  textureWidth:1024, textureHeight:1024,
  waterNormals, sunDirection:moonLight.position.clone().normalize(),
  sunColor:0xffffff, waterColor:0x2a2148, distortionScale:2.6, fog:true, alpha:1.0
});
water.rotation.x=-Math.PI/2; water.position.y=0; scene.add(water);

// grade fantasma sob a água (memória de azulejo)
const gridTex=makeGridTexture();
const grid=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),
  new THREE.MeshBasicMaterial({map:gridTex,transparent:true,opacity:0.08,depthWrite:false}));
grid.rotation.x=-Math.PI/2; grid.position.y=-0.02; scene.add(grid);

/* ====================== props surreais ====================== */
const props=new THREE.Group(); scene.add(props);
let propColor=new THREE.Color(0xf0d9ff);
const staticScreens=[]; // telas de TV com estática animada

function mat(extra={}){ return new THREE.MeshStandardMaterial(Object.assign({color:propColor.clone(),roughness:0.5,metalness:0.15},extra)); }
function shade(o){ o.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; } }); return o; }

function doorframe(){ const w=3.4,h=6.4,t=0.5,g=new THREE.Group(),m=mat();
  const side=new THREE.BoxGeometry(t,h,t);
  const l=new THREE.Mesh(side,m); l.position.set(-w/2,h/2,0); g.add(l);
  const r=new THREE.Mesh(side,m); r.position.set(w/2,h/2,0); g.add(r);
  const tb=new THREE.Mesh(new THREE.BoxGeometry(w+t,t,t),m); tb.position.set(0,h,0); g.add(tb);
  const inner=new THREE.Mesh(new THREE.PlaneGeometry(w-t,h-t),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.07,side:THREE.DoubleSide}));
  inner.position.set(0,h/2,0); g.add(inner); return g; }
function stairs(){ const g=new THREE.Group(),m=mat(),n=10;
  for(let i=0;i<n;i++){ const s=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.45,1.3),m); s.position.set(0,i*0.75+0.2,-i*1.05); g.add(s);} return g; }
function monolith(){ const g=new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5,11,1.5),mat({metalness:0.45,roughness:0.18})).translateY(5.5));
  const em=new THREE.Mesh(new THREE.BoxGeometry(0.55,9,0.06),
    new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffb8ec,emissiveIntensity:2.4}));
  em.position.set(0,5.5,0.78); g.add(em); return g; }
function archway(){ const g=new THREE.Group(),m=mat();
  const t=new THREE.Mesh(new THREE.TorusGeometry(3,0.42,14,48,Math.PI),m); t.position.y=3; g.add(t);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,3,0.7),m).translateX(-3).translateY(1.5));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7,3,0.7),m).translateX(3).translateY(1.5)); return g; }
function floatingCube(){ const s=1.4+Math.random()*3.2; return new THREE.Mesh(new THREE.BoxGeometry(s,s,s),mat({roughness:0.22,metalness:0.55})); }
function pillar(){ const h=6+Math.random()*11; const m=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.95,h,20),mat()); m.position.y=h/2; return m; }
function ring(){ const r=2+Math.random()*4; return new THREE.Mesh(new THREE.TorusGeometry(r,0.28,16,60),mat({metalness:0.6,roughness:0.15})); }
function tvSet(){ const g=new THREE.Group(),m=mat({color:0x2a2436,roughness:0.6});
  g.add(new THREE.Mesh(new THREE.BoxGeometry(3,2.4,2.2),m).translateY(1.6));
  const tex=makeStaticTexture();
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.7),
    new THREE.MeshBasicMaterial({map:tex}));
  screen.position.set(0,1.75,1.12); g.add(screen); staticScreens.push(tex);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,0.15),m).translateY(0.6).translateX(-0.6));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,0.15),m).translateY(0.6).translateX(0.6));
  return g; }

const makers=[doorframe,stairs,monolith,archway,floatingCube,pillar,ring,tvSet,doorframe,pillar,tvSet];
const floaters=[];
function buildWorld(){
  props.clear(); floaters.length=0; staticScreens.length=0;
  for(let i=0;i<120;i++){
    const o=shade(makers[(Math.random()*makers.length)|0]());
    const r=16+Math.random()*260, a=Math.random()*Math.PI*2;
    o.position.x=Math.cos(a)*r; o.position.z=Math.sin(a)*r; o.rotation.y=Math.random()*Math.PI*2;
    if(Math.random()<0.5){ o.position.y=2+Math.random()*24;
      floaters.push({o,base:o.position.y,ph:Math.random()*6.28,sp:0.2+Math.random()*0.5,rot:(Math.random()-0.5)*0.3}); }
    props.add(o);
  }
}

/* ====================== memórias ====================== */
const orbs=[]; const orbGeo=new THREE.SphereGeometry(0.55,28,28);
function orbColor(){ return new THREE.Color(PALETTES[level%PALETTES.length].glow); }
function spawnOrb(near){
  const c=orbColor();
  const mesh=new THREE.Mesh(orbGeo,new THREE.MeshStandardMaterial({color:0xffffff,emissive:c,emissiveIntensity:3.4,roughness:0.15,metalness:0}));
  const h=new THREE.Mesh(new THREE.SphereGeometry(1.1,20,20),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.26,side:THREE.BackSide}));
  const ringM=new THREE.Mesh(new THREE.RingGeometry(0.95,1.06,40),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.5,side:THREE.DoubleSide}));
  mesh.add(h); mesh.add(ringM);
  const a=Math.random()*Math.PI*2, r=14+Math.random()*44;
  const cx=near?near.x:0, cz=near?near.z:0;
  mesh.position.set(cx+Math.cos(a)*r, 1.0+Math.random()*2.4, cz+Math.sin(a)*r);
  mesh.userData={ph:Math.random()*6.28, ring:ringM, baseY:mesh.position.y};
  scene.add(mesh); orbs.push(mesh);
}
function refillOrbs(){ while(orbs.length<14) spawnOrb(camera.position); }

/* ====================== poeira ====================== */
const DUST=2600; const dustGeo=new THREE.BufferGeometry();
const dpos=new Float32Array(DUST*3);
for(let i=0;i<DUST;i++){ dpos[i*3]=(Math.random()-0.5)*200; dpos[i*3+1]=Math.random()*45; dpos[i*3+2]=(Math.random()-0.5)*200; }
dustGeo.setAttribute('position',new THREE.BufferAttribute(dpos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xffffff,size:0.15,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
scene.add(dust);

/* ====================== pós-processamento ====================== */
let heavy=true;
const composer=new EffectComposer(renderer);
const renderPass=new RenderPass(scene,camera);
const ssao=new SSAOPass(scene,camera,innerWidth,innerHeight);
ssao.kernelRadius=10; ssao.minDistance=0.002; ssao.maxDistance=0.09;
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.7,0.6,0.72);
const bokeh=new BokehPass(scene,camera,{focus:20.0,aperture:0.00006,maxblur:0.006});
const output=new OutputPass();
const GradeShader={
  uniforms:{tDiffuse:{value:null},time:{value:0},tint:{value:new THREE.Color(0xffd9f2)}},
  vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time; uniform vec3 tint;
    float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
    void main(){ vec2 uv=vUv; vec2 d=uv-0.5; float r2=dot(d,d);
      float ca=0.0022+r2*0.007; vec3 col;
      col.r=texture2D(tDiffuse,uv-d*ca).r; col.g=texture2D(tDiffuse,uv).g; col.b=texture2D(tDiffuse,uv+d*ca).b;
      col=mix(col,col*tint,0.12);
      float vig=smoothstep(0.9,0.22,r2*1.6); col*=mix(0.5,1.0,vig);
      col+=rand(uv*vec2(1920.,1080.)+time)*0.085-0.0425;
      gl_FragColor=vec4(col,1.0);} `
};
const gradePass=new ShaderPass(GradeShader);
function buildComposer(){
  composer.passes.length=0;
  if(heavy){ composer.addPass(renderPass); composer.addPass(ssao); }
  else composer.addPass(renderPass);
  composer.addPass(bloom);
  if(heavy) composer.addPass(bokeh);
  composer.addPass(output);
  composer.addPass(gradePass);
}
buildComposer();

/* ====================== controles ====================== */
const controls=new PointerLockControls(camera,renderer.domElement);
scene.add(controls.getObject());
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyM') toggleAudio();
  if(e.code==='Equal'||e.code==='NumpadAdd'){ heavy=true; buildComposer(); }
  if(e.code==='Minus'||e.code==='NumpadSubtract'){ heavy=false; buildComposer(); }
});
addEventListener('keyup',e=>keys[e.code]=false);
const veil=document.getElementById('veil'), hud=document.getElementById('hud');
veil.addEventListener('click',()=>controls.lock());
controls.addEventListener('lock',()=>{ veil.classList.add('hide'); hud.classList.add('on'); startAudio(); });
controls.addEventListener('unlock',()=>{ veil.classList.remove('hide'); hud.classList.remove('on');
  document.querySelector('.go').textContent='clique para voltar ao sonho'; });

/* ====================== estado ====================== */
let memories=0, level=0;
const vel=new THREE.Vector3();
const memEl=document.querySelector('#mem b'), depthEl=document.getElementById('depth'), toastEl=document.getElementById('toast');
let toastT=0;
function whisper(txt){ toastEl.textContent='“'+txt+'”'; toastEl.style.opacity='1'; toastT=4.4; }
function applyPalette(i){
  const p=PALETTES[i%PALETTES.length];
  skyMat.uniforms.top.value.setHex(p.top); skyMat.uniforms.bot.value.setHex(p.bot);
  scene.fog.color.setHex(p.fog); moon.material.color.setHex(p.moon); halo.material.color.setHex(p.glow);
  hemi.color.setHex(p.top); propColor.setHex(p.prop);
  water.material.uniforms['waterColor'].value.setHex(p.water);
  gradePass.uniforms.tint.value.setHex(p.glow);
  depthEl.textContent='nível do sonho · '+(i+1)+' — '+p.name;
  document.documentElement.style.setProperty('--glow','#'+p.glow.toString(16).padStart(6,'0'));
}
function collect(orb){
  memories++; memEl.textContent=memories;
  whisper(WHISPERS[(Math.random()*WHISPERS.length)|0]); chime();
  scene.remove(orb); orbs.splice(orbs.indexOf(orb),1);
  bloom.strength=1.3;
  if(memories%8===0){ level++; applyPalette(level); buildWorld(); }
  spawnOrb(camera.position);
}

/* ====================== áudio ====================== */
let actx=null,padGain=null,audioOn=true,started=false;
function startAudio(){ if(started)return; started=true;
  try{ actx=new (window.AudioContext||window.webkitAudioContext)();
    padGain=actx.createGain(); padGain.gain.value=audioOn?0.11:0; padGain.connect(actx.destination);
    [110,164.81,220,277.18].forEach((f,i)=>{ const o=actx.createOscillator(); o.type='sine'; o.frequency.value=f;
      const g=actx.createGain(); g.gain.value=0.25; const lfo=actx.createOscillator(); lfo.frequency.value=0.05+i*0.02;
      const lg=actx.createGain(); lg.gain.value=0.12; lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(padGain); o.start(); lfo.start(); });
  }catch(e){}
}
function toggleAudio(){ audioOn=!audioOn; if(padGain&&actx) padGain.gain.linearRampToValueAtTime(audioOn?0.11:0,actx.currentTime+0.4); }
function chime(){ if(!actx||!audioOn)return; const t=actx.currentTime; const f=[523.25,659.25,783.99][(Math.random()*3)|0];
  const o=actx.createOscillator(); o.type='triangle'; o.frequency.value=f;
  const g=actx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+1.5); }

/* ====================== loop ====================== */
const clock=new THREE.Clock(); const tmp=new THREE.Vector3();
let frames=0,fpsT=0; const fpsEl=document.getElementById('fps');
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05), t=clock.elapsedTime;

  if(controls.isLocked){
    const sp=(keys['ShiftLeft']||keys['ShiftRight']?9:4.6);
    const f=(keys['KeyW']?1:0)-(keys['KeyS']?1:0), s=(keys['KeyD']?1:0)-(keys['KeyA']?1:0);
    vel.x-=vel.x*4*dt; vel.z-=vel.z*4*dt;
    if(f) vel.z-=f*sp*dt*4; if(s) vel.x+=s*sp*dt*4;
    controls.moveForward(-vel.z*dt); controls.moveRight(vel.x*dt);
    const spd=Math.min(1,Math.abs(vel.x)+Math.abs(vel.z));
    controls.getObject().position.y=1.75+Math.sin(t*1.4)*0.04+Math.sin(t*6)*0.02*spd;
  }
  const cp=camera.position;

  // memórias
  for(let i=orbs.length-1;i>=0;i--){ const o=orbs[i];
    o.position.y=o.userData.baseY+Math.sin(t*1.6+o.userData.ph)*0.35; o.rotation.y+=dt*0.8;
    o.userData.ring.lookAt(cp); o.userData.ring.rotation.z+=dt*1.5;
    const dx=o.position.x-cp.x,dz=o.position.z-cp.z,dy=o.position.y-cp.y;
    if(dx*dx+dz*dz+dy*dy<2.2*2.2) collect(o);
  }
  // luzes dinâmicas -> memórias mais próximas
  const sorted=orbs.map(o=>({o,d:o.position.distanceToSquared(cp)})).sort((a,b)=>a.d-b.d);
  for(let i=0;i<POOL;i++){ const L=poolLights[i];
    if(sorted[i]){ L.position.copy(sorted[i].o.position); L.color.copy(sorted[i].o.material.emissive); L.intensity=9; }
    else L.intensity=0; }

  for(const fl of floaters){ fl.o.position.y=fl.base+Math.sin(t*fl.sp+fl.ph)*1.4; fl.o.rotation.y+=fl.rot*dt; }

  sky.position.copy(cp); moon.position.set(cp.x-140,95,cp.z-300);
  moonLight.position.set(cp.x-60,80,cp.z-45); moonLight.target.position.copy(cp);

  const pa=dustGeo.attributes.position;
  for(let i=0;i<DUST;i++){ let y=pa.getY(i)+dt*0.6; if(y>45)y=0; pa.setY(i,y); }
  pa.needsUpdate=true; dust.position.set(cp.x,0,cp.z);

  water.position.set(cp.x,0,cp.z); water.material.uniforms['time'].value+=dt*0.55;
  grid.position.set(cp.x,-0.02,cp.z);

  for(const tex of staticScreens){ if(Math.random()<0.5) refreshStatic(tex); }

  bloom.strength+=(0.7-bloom.strength)*Math.min(1,dt*3);
  if(toastT>0){ toastT-=dt; if(toastT<=0) toastEl.style.opacity='0'; }
  refillOrbs();

  gradePass.uniforms.time.value=t;
  composer.render();

  frames++; fpsT+=dt; if(fpsT>=0.5){ fpsEl.textContent=Math.round(frames/fpsT)+' fps · '+(heavy?'ultra':'leve'); frames=0; fpsT=0; }
}

/* ====================== texturas procedurais ====================== */
function makeWaterNormals(){
  const N=256, c=document.createElement('canvas'); c.width=c.height=N; const x=c.getContext('2d');
  const img=x.createImageData(N,N), d=img.data;
  const h=(i,j)=>{ const u=i/N*Math.PI*2, v=j/N*Math.PI*2;
    return Math.sin(u*3)*0.5+Math.cos(v*3)*0.5+Math.sin((u+v)*2)*0.35+Math.cos((u-v)*4)*0.2; };
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    const hx=h((i+1)%N,j)-h((i-1+N)%N,j), hy=h(i,(j+1)%N)-h(i,(j-1+N)%N);
    let nx=-hx, ny=-hy, nz=1.0; const l=Math.hypot(nx,ny,nz); nx/=l;ny/=l;nz/=l;
    const o=(j*N+i)*4; d[o]=(nx*0.5+0.5)*255; d[o+1]=(ny*0.5+0.5)*255; d[o+2]=(nz*0.5+0.5)*255; d[o+3]=255;
  }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
function makeGridTexture(){
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d');
  x.strokeStyle='rgba(255,255,255,0.9)'; x.lineWidth=2; const n=8,s=512/n;
  for(let i=0;i<=n;i++){ x.beginPath(); x.moveTo(i*s,0); x.lineTo(i*s,512); x.stroke();
    x.beginPath(); x.moveTo(0,i*s); x.lineTo(512,i*s); x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(120,120); return t;
}
function makeStaticTexture(){
  const c=document.createElement('canvas'); c.width=c.height=64; const t=new THREE.CanvasTexture(c);
  t._canvas=c; refreshStatic(t); return t;
}
function refreshStatic(t){
  const c=t._canvas, x=c.getContext('2d'), img=x.createImageData(64,64), d=img.data;
  for(let i=0;i<d.length;i+=4){ const v=(Math.random()*255)|0; d[i]=d[i+1]=d[i+2]=v; d[i+3]=255; }
  x.putImageData(img,0,0); t.needsUpdate=true;
}

/* ====================== resize ====================== */
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight);
  bloom.setSize(innerWidth,innerHeight); ssao.setSize(innerWidth,innerHeight);
});

/* ====================== go ====================== */
applyPalette(0); buildWorld(); refillOrbs();
document.getElementById('loading').remove();
veil.classList.remove('hide');
animate();
