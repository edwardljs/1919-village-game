import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import './styles.css';

type QuestState = 'bundle_meet' | 'bundle_find' | 'bundle_return' | 'meet_lee' | 'materials_find' | 'materials_return' | 'flag_ready' | 'flag_complete';
type MaterialId = 'paper' | 'red' | 'blue';

interface SaveData { quest: QuestState | 'milestone_complete'; coins: number; collected: MaterialId[]; flagStep?: number }

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="ui">
  <div class="topbar"><div class="quest"><div class="quest-label" id="chapterLabel">1장 · 첫 번째 부탁</div><div class="quest-title" id="questTitle">장터의 사람과 이야기하기</div><div class="quest-step" id="questStep">노란 표식의 김씨 아저씨를 찾아가 보자</div></div><div class="coins"><span class="coin-dot"></span><span id="coins">0</span></div></div>
  <button class="restart-button" id="restartButton">↻ 처음부터</button>
  <button class="sound-button" id="soundButton" aria-pressed="true">🔊 소리 켜짐</button>
  <div class="guide" id="guide"><span class="guide-arrow" id="guideArrow">↑</span><span><b id="guideName">김씨 아저씨</b><small id="guideDistance">찾아가는 중</small></span></div>
  <div class="toast" id="toast"></div><div class="prompt" id="prompt"></div>
  <div class="dialogue" id="dialogue"><div class="speaker" id="speaker"></div><div class="dialogue-text" id="dialogueText"></div><button class="continue" id="continue">계속하기</button></div>
  <div class="workshop" id="workshop"><div class="workshop-card"><div class="workshop-kicker">함께 만드는 태극기</div><h2>태극기를 완성해 보자</h2><p>재료를 차례로 사용해 간단한 태극기를 완성해요.</p><div class="flag-preview" id="flagPreview"><div class="flag-paper"></div><div class="taegeuk"></div><div class="trigram trigram-a">☰</div><div class="trigram trigram-b">☷</div><div class="trigram trigram-c">☵</div><div class="trigram trigram-d">☲</div></div><div class="workshop-progress" id="workshopProgress">준비 완료 · 0/3</div><button class="workshop-action" id="workshopAction">한지 펼치기</button><button class="workshop-close" id="workshopClose">마을로 돌아가기</button></div></div>
  <div class="controls" id="controls"><b>WASD</b> 이동 · <b>마우스</b> 시점<br><b>Space</b> 점프 · <b>Shift</b> 달리기 · <b>E</b> 대화<br><b>F3</b> 상태 정보</div>
  <div class="reticle"></div><div class="debug" id="debug"></div>
  <div class="heritage-credit"><a href="https://kenney.nl/assets/nature-kit" target="_blank" rel="noreferrer">Kenney Nature Kit · CC0</a> · <a href="https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Stork.glb" target="_blank" rel="noreferrer">Three.js Stork</a> · 문화유산 <a href="https://sketchfab.com/3d-models/yongjun-1249db1e427e457f8c18ac73d8b1002a" target="_blank" rel="noreferrer">용준</a>·<a href="https://sketchfab.com/3d-models/gyeongbokgung-gangnyeongjeon-tablea-b16f47a09d0e4399af6274afceb4982f" target="_blank" rel="noreferrer">강녕전 상</a></div>
  <div class="restart-modal" id="restartModal" role="dialog" aria-modal="true" aria-labelledby="restartTitle"><div class="restart-card"><h2 id="restartTitle">1장을 처음부터 시작할까요?</h2><p>현재 진행 상황과 엽전이 초기화됩니다.</p><div class="restart-actions"><button class="restart-cancel" id="restartCancel">계속 플레이</button><button class="restart-confirm" id="restartConfirm">처음부터 다시 시작</button></div></div></div>
  <div class="start-screen" id="startScreen"><div class="start-card"><div class="start-kicker">1919 · 그날의 마을</div><h1>1장 · 함께 만든 태극기</h1><p>장터에서 잃어버린 보따리를 찾고, 마을 사람들과 힘을 모아 태극기를 완성해 보세요.</p><div class="start-actions"><button class="story-button" id="startFresh">1장 시작하기</button></div><div class="save-note">진행 상황은 이 브라우저에 자동으로 저장됩니다.</div></div></div>
</div>`;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -18, z: 0 });
const scene = new THREE.Scene();
const skyCanvas=document.createElement('canvas');skyCanvas.width=32;skyCanvas.height=512;const skyCtx=skyCanvas.getContext('2d')!;const skyGradient=skyCtx.createLinearGradient(0,0,0,512);skyGradient.addColorStop(0,'#6f9fa5');skyGradient.addColorStop(.48,'#b8d4ca');skyGradient.addColorStop(1,'#ead6ad');skyCtx.fillStyle=skyGradient;skyCtx.fillRect(0,0,32,512);const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;scene.background=skyTexture;
scene.fog = new THREE.Fog(0xb7cbbd, 38, 84);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const deviceMemory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8;const lowPowerDevice=navigator.hardwareConcurrency<=2||deviceMemory<=4;
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPowerDevice?1.15:1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f3e8, 0x66503d, 2.05));
const sun = new THREE.DirectionalLight(0xffd99a, 3.35); sun.position.set(-18, 28, 14); sun.castShadow = true; const shadowSize=lowPowerDevice?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize); sun.shadow.camera.left=-35; sun.shadow.camera.right=35; sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35;sun.shadow.bias=-.00035;sun.shadow.normalBias=.025; scene.add(sun);
const sunCanvas=document.createElement('canvas');sunCanvas.width=128;sunCanvas.height=128;const sunCtx=sunCanvas.getContext('2d')!;const sunGlow=sunCtx.createRadialGradient(64,64,4,64,64,62);sunGlow.addColorStop(0,'rgba(255,244,194,.95)');sunGlow.addColorStop(.35,'rgba(255,220,140,.65)');sunGlow.addColorStop(1,'rgba(255,211,128,0)');sunCtx.fillStyle=sunGlow;sunCtx.fillRect(0,0,128,128);const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sunCanvas),transparent:true,depthWrite:false}));sunSprite.position.set(-25,23,-58);sunSprite.scale.set(12,12,1);scene.add(sunSprite);

const mat = (color:number, roughness=.85) => new THREE.MeshStandardMaterial({color,roughness});
const textureLoader=new THREE.TextureLoader();
const groundTexture=textureLoader.load('./textures/village-ground.png');groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(5,4);groundTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const roofTexture=textureLoader.load('./textures/hanok-roof.png');roofTexture.colorSpace=THREE.SRGBColorSpace;roofTexture.wrapS=roofTexture.wrapT=THREE.RepeatWrapping;roofTexture.repeat.set(2.4,1.8);roofTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const groundMat = new THREE.MeshStandardMaterial({map:groundTexture,color:0xc4b78d,roughness:1}); const wood=mat(0x4b2f20,.76); const plaster=mat(0xd9c9a8,1); const roof=new THREE.MeshStandardMaterial({map:roofTexture,color:0x77746d,roughness:.96}); const stone=mat(0x77786f,1);
const mountainMatFar=mat(0x748d83,1),mountainMatNear=mat(0x61786f,1);
for(const [x,z,r,h,material] of [[-34,-49,15,20,mountainMatFar],[-10,-55,18,25,mountainMatNear],[18,-51,14,21,mountainMatFar],[41,-56,19,27,mountainMatNear],[-47,-42,12,16,mountainMatNear]] as [number,number,number,number,THREE.Material][]){const mountain=new THREE.Mesh(new THREE.ConeGeometry(r,h,6),material);mountain.position.set(x,h/2-1,z);mountain.rotation.y=x*.07;mountain.receiveShadow=true;scene.add(mountain)}
const clouds:THREE.Group[]=[];const cloudMaterial=new THREE.MeshBasicMaterial({color:0xf3ead8,transparent:true,opacity:.48,depthWrite:false});
for(const [x,y,z,s] of [[-20,14,-35,1.3],[13,17,-44,1.7],[32,12,-29,1.1]] as [number,number,number,number][]){const cloud=new THREE.Group();for(const [ox,oy,scale] of [[-1.5,0,.9],[0,.35,1.25],[1.5,0,1]] as [number,number,number][]){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,1),cloudMaterial);puff.position.set(ox,oy,0);puff.scale.set(scale*1.45,scale*.62,scale);cloud.add(puff)}cloud.position.set(x,y,z);cloud.scale.setScalar(s);scene.add(cloud);clouds.push(cloud)}
const groundBase = new THREE.Mesh(new THREE.BoxGeometry(62,1,54),mat(0x685f43,1)); groundBase.position.y=-.55; groundBase.receiveShadow=true; scene.add(groundBase);
const groundGeometry=new THREE.PlaneGeometry(62,54,42,36);const groundPosition=groundGeometry.attributes.position as THREE.BufferAttribute;for(let i=0;i<groundPosition.count;i++){const x=groundPosition.getX(i),y=groundPosition.getY(i);const edge=Math.min(1,(31-Math.abs(x))/2,(27-Math.abs(y))/2);groundPosition.setZ(i,(Math.sin(x*.47)+Math.cos(y*.39)+Math.sin((x+y)*.21))*.045*Math.max(0,edge))}groundGeometry.computeVertexNormals();
const ground = new THREE.Mesh(groundGeometry,groundMat); ground.rotation.x=-Math.PI/2;ground.position.y=.015;ground.receiveShadow=true; scene.add(ground);
world.createCollider(RAPIER.ColliderDesc.cuboid(31,.5,27).setTranslation(0,-.5,0));

function box(name:string,pos:[number,number,number],size:[number,number,number],material:THREE.Material, collider=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material); m.name=name; m.position.set(...pos); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  if(collider) world.createCollider(RAPIER.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setTranslation(...pos)); return m;
}
function cylinder(pos:[number,number,number],r:number,h:number,material:THREE.Material){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);world.createCollider(RAPIER.ColliderDesc.cylinder(h/2,r).setTranslation(...pos));return m;}

// Village paths and boundary
const pathCanvas=document.createElement('canvas');pathCanvas.width=256;pathCanvas.height=256;const pathCtx=pathCanvas.getContext('2d')!;pathCtx.fillStyle='#a88454';pathCtx.fillRect(0,0,256,256);for(let i=0;i<560;i++){const shade=110+(i*37)%65;pathCtx.fillStyle=`rgba(${shade},${Math.round(shade*.82)},${Math.round(shade*.55)},${.08+(i%5)*.025})`;pathCtx.beginPath();pathCtx.ellipse((i*73)%256,(i*47)%256,1+(i%4),.5+(i%3),i*.4,0,Math.PI*2);pathCtx.fill()}const pathTexture=new THREE.CanvasTexture(pathCanvas);pathTexture.colorSpace=THREE.SRGBColorSpace;pathTexture.wrapS=pathTexture.wrapT=THREE.RepeatWrapping;pathTexture.repeat.set(2,9);const pathMat=new THREE.MeshStandardMaterial({map:pathTexture,color:0xc7ae7d,roughness:1});
box('market-road',[0,.07,0],[10.5,.11,50],pathMat,false);const crossPath=pathMat.clone();crossPath.map=pathTexture.clone();crossPath.map!.repeat.set(10,2);box('cross-road',[0,.075,-3],[48,.12,8],crossPath,false);
for(const [p,s] of [[[-30,1.5,0],[1,3,54]],[[30,1.5,0],[1,3,54]],[[0,1.5,-27],[62,3,1]],[[0,1.5,27],[62,3,1]]] as [[number,number,number],[number,number,number]][]) box('boundary',p,s,stone);

function house(x:number,z:number,w:number,d:number,flip=false){
  const group=new THREE.Group();group.name='한옥';group.position.set(x,0,z);scene.add(group);
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number],rotation:[number,number,number]=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh};
  add(new THREE.BoxGeometry(w+.7,.45,d+.55),stone,[0,.22,0]);
  add(new THREE.BoxGeometry(w,3.15,d),plaster,[0,2,0]);
  world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,1.8,d/2).setTranslation(x,1.8,z));
  const front=(flip?-1:1)*d/2;
  for(const ox of [-w/2+.16,-w/6,w/6,w/2-.16])add(new THREE.BoxGeometry(.22,3.35,.24),wood,[ox,2.05,front+(flip?-.04:.04)]);
  add(new THREE.BoxGeometry(w+.24,.24,.28),wood,[0,.65,front+(flip?-.05:.05)]);add(new THREE.BoxGeometry(w+.24,.22,.28),wood,[0,3.42,front+(flip?-.05:.05)]);
  const paper=mat(0xeee2c2,1),doorWood=mat(0x573624,.82);const doorX=-w*.19;
  add(new THREE.BoxGeometry(w*.29,2.35,.1),paper,[doorX,1.82,front+(flip?-.18:.18)]);
  for(const ox of [-.42,-.14,.14,.42])add(new THREE.BoxGeometry(.055,2.32,.055),doorWood,[doorX+ox*w*.26,1.82,front+(flip?-.245:.245)]);
  for(const oy of [.82,1.28,1.74,2.2,2.66])add(new THREE.BoxGeometry(w*.285,.055,.055),doorWood,[doorX,oy,front+(flip?-.25:.25)]);
  const windowX=w*.23;add(new THREE.BoxGeometry(w*.29,1.65,.1),paper,[windowX,2.02,front+(flip?-.18:.18)]);
  for(const ox of [-.38,-.12,.12,.38])add(new THREE.BoxGeometry(.05,1.62,.055),doorWood,[windowX+ox*w*.27,2.02,front+(flip?-.245:.245)]);
  for(const oy of [1.45,1.82,2.19,2.56])add(new THREE.BoxGeometry(w*.285,.05,.055),doorWood,[windowX,oy,front+(flip?-.25:.25)]);
  const roofAngle=Math.atan2(1.45,d*.53),slopeLength=Math.sqrt((d*.53)**2+1.45**2);for(const side of [-1,1])add(new THREE.BoxGeometry(w+1.75,.18,slopeLength+1),roof,[0,4.08,side*d*.25],[side*roofAngle,0,0]);
  const ridge=add(new THREE.CylinderGeometry(.18,.18,w+2.05,12),roof,[0,4.86,0],[0,0,Math.PI/2]);ridge.castShadow=true;
  for(const sx of [-1,1])for(let i=0;i<Math.max(6,Math.floor(d*1.3));i++){const tile=add(new THREE.CylinderGeometry(.055,.075,w+1.82,7),roof,[0,3.78+i*.12,sx*(d*.51-i*.38)],[0,0,Math.PI/2]);tile.scale.y=.7}
  add(new THREE.BoxGeometry(1.6,.2,1.2),stone,[doorX,.52,front+(flip?-.72:.72)]);add(new THREE.BoxGeometry(1.15,.18,.78),stone,[doorX,.29,front+(flip?-1.28:1.28)]);
  return group;
}
house(-15,-14,8,7); house(15,-15,9,7); house(-17,11,10,7,true); house(17,12,8,6,true);

// 국가유산청 계열 CC BY 4.0 모델. GLB 내부 변환에 cm→m 배율이 이미 포함되어 있다.
const heritageLoader=new GLTFLoader();
function placeHeritageModel(file:string,position:[number,number,number],rotationY=0,scale=1,collider?:[number,number,number]){
  heritageLoader.load(`./models/${file}`,gltf=>{const model=gltf.scene;model.position.set(...position);model.rotation.y=rotationY;model.scale.setScalar(scale);model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true}});scene.add(model)},undefined,error=>console.error(`문화유산 모델 로드 실패: ${file}`,error));
  if(collider)world.createCollider(RAPIER.ColliderDesc.cuboid(collider[0]/2,collider[1]/2,collider[2]/2).setTranslation(position[0],position[1]+collider[1]/2,position[2]));
}
placeHeritageModel('gangnyeongjeon-table.glb',[4.5,0,4],-Math.PI/2,1.8,[1.5,.7,2.05]);
placeHeritageModel('yongjun.glb',[4.5,.7,4],-Math.PI/2,1.5);

type NaturePlacement=[number,number,number,number];
function scatterNature(file:string,placements:NaturePlacement[]){
  heritageLoader.load(`./models/kenney/${file}`,gltf=>{for(const [x,z,scale,rotation] of placements){const model=gltf.scene.clone(true);model.position.set(x,0,z);model.rotation.y=rotation;model.scale.setScalar(scale);model.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true}});scene.add(model)}},undefined,error=>console.error(`자연 모델 로드 실패: ${file}`,error));
}
scatterNature('tree-oak.glb',[[-24,-15,3.4,.2],[-25,12,3.8,1.4],[23,-14,3.2,2.1],[24,16,3.6,.7],[-13,22,3.1,2.7],[15,22,3.5,1.9]]);
scatterNature('pine-tall.glb',[[-21,-23,3.4,.1],[-8,-24,3.1,1.2],[7,-24,3.5,2.3],[21,-22,3.2,.8]]);
scatterNature('grass-large.glb',[[-20,-7,1.5,.2],[-22,7,1.2,2],[-13,18,1.5,1],[-18,17,1.15,2.5],[19,18,1.4,.6],[22,8,1.2,2.4],[20,-9,1.5,1.5],[-12,-20,1.25,.8],[12,-20,1.4,2.2]]);
scatterNature('stone-large.glb',[[-21,-9,1.7,.5],[-22,15,1.3,2.1],[21,12,1.55,1.4],[19,-17,1.4,.2]]);
scatterNature('log-stack.glb',[[-20,7,2.1,.5],[20,-11,1.9,2.4]]);
scatterNature('flower-yellow.glb',[[-19,10,2.2,.2],[-18.5,10.4,1.8,1.3],[19,14,2.1,2.1],[18.6,14.4,1.7,.7]]);

const birdFlights:{root:THREE.Object3D;mixer:THREE.AnimationMixer;angle:number;radius:number;speed:number;height:number}[]=[];
heritageLoader.load('./models/stork.glb',gltf=>{for(let i=0;i<2;i++){const bird=gltf.scene.clone(true);bird.scale.setScalar(.007);bird.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true});scene.add(bird);const mixer=new THREE.AnimationMixer(bird);if(gltf.animations[0])mixer.clipAction(gltf.animations[0]).setDuration(.75+i*.12).play();birdFlights.push({root:bird,mixer,angle:i*Math.PI,radius:14+i*5,speed:.12+i*.025,height:10.5+i*2})}},undefined,error=>console.error('새 모델 로드 실패',error));

// Market stalls and dressing
function stall(x:number,z:number,color:number){
  for(const ox of [-1.65,1.65]) cylinder([x+ox,1.25,z],.09,2.5,wood);
  box('stall-table',[x,1,z],[3.6,.18,1.5],wood);
  const canopy=box('canopy',[x,2.65,z],[4,.13,2],mat(color),false); canopy.rotation.z=.05;
  for(let i=0;i<5;i++){const produce=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),mat(i%2?0x9e4b35:0xc78b38));produce.position.set(x-1.1+i*.52,1.22,z);produce.castShadow=true;scene.add(produce)}
}
stall(-6,-4,0x9c4a3f); stall(7,-5,0x335c62); stall(-7,5,0xb28a3d);
for(const [x,z] of [[-23,-2],[24,3],[-25,18],[24,-20]] as [number,number][]) {cylinder([x,1.5,z],.35,3,wood); const crown=new THREE.Mesh(new THREE.SphereGeometry(1.8,9,7),mat(0x49613b));crown.scale.set(1.2,.9,1);crown.position.set(x,3.6,z);crown.castShadow=true;scene.add(crown)}
for(const [x,z] of [[-11,-9],[-8,14],[11,7],[20,-6]] as [number,number][]) box('crate',[x,.45,z],[1.3,.9,1.3],wood);

// Quiet village details: earthenware jars, stepping stones, grass and drifting dust.
const jarMat=mat(0x6e4935,.72);for(const [x,z,s] of [[-12,-10,.8],[-14,-10,.62],[-20,9,.72],[18,-10,.7],[20,-10,.52]] as [number,number,number][]){const jar=new THREE.Group();const body=new THREE.Mesh(new THREE.SphereGeometry(.52*s,12,9),jarMat);body.scale.y=.82;body.position.y=.45*s;body.castShadow=true;jar.add(body);const rim=new THREE.Mesh(new THREE.TorusGeometry(.27*s,.06*s,6,14),jarMat);rim.rotation.x=Math.PI/2;rim.position.y=.83*s;jar.add(rim);jar.position.set(x,0,z);scene.add(jar)}
const steppingMat=mat(0x929083,1);for(let i=0;i<9;i++){const step=new THREE.Mesh(new THREE.CylinderGeometry(.42+Math.sin(i)*.05,.48,.08,8),steppingMat);step.position.set(-2.2+Math.sin(i*.8)*.28,.07,13-i*2.3);step.rotation.y=i*.7;step.receiveShadow=true;scene.add(step)}
const grassMat=new THREE.MeshBasicMaterial({color:0x617746,side:THREE.DoubleSide});for(let i=0;i<34;i++){const x=((i*17)%55)-27,z=((i*29)%47)-23;if(Math.abs(x)<7||Math.abs(z+3)<5)continue;const tuft=new THREE.Mesh(new THREE.ConeGeometry(.18,.62,3),grassMat);tuft.position.set(x,.28,z);tuft.rotation.y=i*.91;scene.add(tuft)}
const dustPositions=new Float32Array(120*3);for(let i=0;i<120;i++){dustPositions[i*3]=((i*37)%580)/10-29;dustPositions[i*3+1]=.8+((i*19)%60)/10;dustPositions[i*3+2]=((i*53)%500)/10-25}const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xffe8bd,size:.055,transparent:true,opacity:.34,depthWrite:false}));scene.add(dust);

function makePerson(name:string,shirtColor:number,role:'child'|'man'|'woman'='child'){
  const g=new THREE.Group();g.name=name;const skin=mat(0xd7a276,.72),cloth=mat(shirtColor,.92),cream=mat(0xeee0bd,.95),hair=mat(0x24201d,.82),pants=mat(role==='child'?0x50606b:0xc7b999,.96),shoeMat=mat(0x292622,.9);
  const add=(parent:THREE.Object3D,geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number],rotation:[number,number,number]=[0,0,0])=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh};
  const legs:THREE.Group[]=[];
  if(role==='woman'){
    const skirt=add(g,new THREE.ConeGeometry(.72,.98,20),mat(0x5b7180,.94),[0,.67,0]);skirt.scale.z=.84;
    for(const sx of [-.25,.25])add(g,new THREE.SphereGeometry(.24,12,8),shoeMat,[sx,.16,.18]);
  }else{
    for(const sx of [-.24,.24]){const pivot=new THREE.Group();pivot.position.set(sx,.98,0);g.add(pivot);add(pivot,new THREE.CapsuleGeometry(.17,.45,5,10),pants,[0,-.38,0]);const foot=add(pivot,new THREE.CapsuleGeometry(.15,.2,4,10),shoeMat,[0,-.77,.12],[Math.PI/2,0,0]);foot.scale.z=1.15;legs.push(pivot)}
  }
  const body=add(g,new THREE.CapsuleGeometry(.43,.55,7,14),cloth,[0,1.65,0]);body.scale.set(1.05,1,0.86);
  const jacketHem=add(g,new THREE.ConeGeometry(.53,.5,18),cloth,[0,1.25,0]);jacketHem.scale.z=.84;
  add(g,new THREE.BoxGeometry(.12,.65,.035),cream,[-.13,1.85,.38],[0,0,-.42]);add(g,new THREE.BoxGeometry(.12,.65,.035),cream,[.13,1.85,.38],[0,0,.42]);
  add(g,new THREE.CapsuleGeometry(.035,.34,4,8),mat(role==='woman'?0x8a3436:0xa95d42),[-.08,1.45,.47],[0,0,.18]);add(g,new THREE.CapsuleGeometry(.035,.28,4,8),mat(role==='woman'?0x8a3436:0xa95d42),[.08,1.48,.47],[0,0,-.18]);
  const arms:THREE.Group[]=[];for(const sx of [-1,1]){const pivot=new THREE.Group();pivot.position.set(sx*.5,2.02,0);pivot.rotation.z=sx*.11;g.add(pivot);add(pivot,new THREE.CapsuleGeometry(.15,.48,5,10),cloth,[0,-.4,0]);add(pivot,new THREE.SphereGeometry(.145,12,8),skin,[0,-.81,.015]);arms.push(pivot)}
  add(g,new THREE.CylinderGeometry(.16,.18,.2,12),skin,[0,2.3,0]);
  const head=add(g,new THREE.SphereGeometry(.39,24,18),skin,[0,2.66,0]);head.scale.set(.88,1.06,.9);
  for(const sx of [-1,1]){add(g,new THREE.SphereGeometry(.07,10,8),skin,[sx*.35,2.65,0]);const eye=add(g,new THREE.SphereGeometry(.038,10,8),hair,[sx*.13,2.7,.34]);eye.scale.set(1,.7,.45);add(g,new THREE.BoxGeometry(.13,.025,.025),hair,[sx*.13,2.8,.335],[0,0,-sx*.07])}
  const nose=add(g,new THREE.SphereGeometry(.055,10,8),skin,[0,2.61,.36]);nose.scale.set(.8,1.2,.75);
  const mouth=add(g,new THREE.TorusGeometry(.075,.014,6,12,Math.PI),mat(0x8d4f45,.7),[0,2.5,.35],[0,0,Math.PI]);mouth.scale.y=.5;
  const hairCap=add(g,new THREE.SphereGeometry(.39,20,12),hair,[0,2.88,-.025]);hairCap.scale.set(.91,.48,.91);
  if(role==='man'){const brim=add(g,new THREE.CylinderGeometry(.69,.69,.055,24),hair,[0,3.03,0]);brim.scale.z=.88;add(g,new THREE.CylinderGeometry(.29,.36,.31,18),hair,[0,3.19,0]);add(g,new THREE.CylinderGeometry(.018,.018,1.65,8),hair,[0,2.69,.02],[0,0,Math.PI/2])}
  if(role==='woman'){add(g,new THREE.SphereGeometry(.2,14,10),hair,[0,2.82,-.3]);add(g,new THREE.TorusGeometry(.15,.035,8,18),mat(0x77463f),[0,2.81,-.42],[Math.PI/2,0,0])}
  if(role==='child'){add(g,new THREE.TorusGeometry(.31,.035,7,18),mat(0x9c5650),[0,2.89,.02],[Math.PI/2,0,0])}
  g.userData.limbs={arms,legs,body};scene.add(g);return g;
}
const npc=makePerson('김씨 아저씨',0x52654e,'man'); npc.position.set(-4,0,-1); npc.rotation.y=.4;
const npcMarker=new THREE.Group(); const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.28),mat(0xf5c84d));diamond.rotation.z=Math.PI/4;npcMarker.add(diamond);npcMarker.position.set(-4,4.05,-1);scene.add(npcMarker);
const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d')!;ctx.fillStyle='rgba(20,32,31,.82)';ctx.roundRect(60,18,392,92,25);ctx.fill();ctx.fillStyle='#fff6da';ctx.font='bold 45px sans-serif';ctx.textAlign='center';ctx.fillText('김씨 아저씨',256,78);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true}));label.position.set(-4,3.62,-1);label.scale.set(3.4,.85,1);scene.add(label);

const lee=makePerson('이씨 아주머니',0x91504c,'woman');lee.position.set(7,0,5);lee.rotation.y=-.7;
const leeMarker=new THREE.Group();const leeDiamond=new THREE.Mesh(new THREE.OctahedronGeometry(.28),mat(0x68d3c2));leeDiamond.rotation.z=Math.PI/4;leeMarker.add(leeDiamond);leeMarker.position.set(7,4.05,5);scene.add(leeMarker);
const leeLabelCanvas=document.createElement('canvas');leeLabelCanvas.width=512;leeLabelCanvas.height=128;const leeCtx=leeLabelCanvas.getContext('2d')!;leeCtx.fillStyle='rgba(20,32,31,.82)';leeCtx.roundRect(45,18,422,92,25);leeCtx.fill();leeCtx.fillStyle='#fff6da';leeCtx.font='bold 42px sans-serif';leeCtx.textAlign='center';leeCtx.fillText('이씨 아주머니',256,78);const leeLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(leeLabelCanvas),transparent:true}));leeLabel.position.set(7,3.62,5);leeLabel.scale.set(3.7,.9,1);scene.add(leeLabel);

const bundle=new THREE.Group(); const sack=new THREE.Mesh(new THREE.SphereGeometry(.68,12,9),mat(0xb86b3f));sack.scale.y=.78;sack.castShadow=true;bundle.add(sack);const knot=new THREE.Mesh(new THREE.ConeGeometry(.32,.5,8),mat(0xd49355));knot.position.y=.62;bundle.add(knot);
const bundleRing=new THREE.Mesh(new THREE.TorusGeometry(.95,.08,8,32),new THREE.MeshBasicMaterial({color:0xffd45f,transparent:true,opacity:.9}));bundleRing.rotation.x=Math.PI/2;bundleRing.position.y=-.4;bundle.add(bundleRing);
const bundleBeam=new THREE.Mesh(new THREE.CylinderGeometry(.1,.42,4.6,12,1,true),new THREE.MeshBasicMaterial({color:0xffc843,transparent:true,opacity:.36,side:THREE.DoubleSide}));bundleBeam.position.y=2.25;bundle.add(bundleBeam);
const bundleCanvas=document.createElement('canvas');bundleCanvas.width=480;bundleCanvas.height=112;const bundleCtx=bundleCanvas.getContext('2d')!;bundleCtx.fillStyle='rgba(20,32,31,.92)';bundleCtx.roundRect(25,12,430,88,22);bundleCtx.fill();bundleCtx.fillStyle='#fff6da';bundleCtx.font='bold 38px sans-serif';bundleCtx.textAlign='center';bundleCtx.fillText('잃어버린 보따리',240,70);const bundleLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(bundleCanvas),transparent:true,depthTest:false}));bundleLabel.position.y=3.7;bundleLabel.scale.set(3.5,.82,1);bundleLabel.renderOrder=20;bundle.add(bundleLabel);
bundle.position.set(20,.65,17);scene.add(bundle);
const bundleGlow=new THREE.PointLight(0xffc756,4.5,9);bundleGlow.position.set(20,1.7,17);scene.add(bundleGlow);

const materialNames:Record<MaterialId,string>={paper:'한지',red:'붉은 물감',blue:'푸른 물감'};
function makeMaterialItem(id:MaterialId,position:[number,number,number],color:number){
  const group=new THREE.Group();group.name=materialNames[id];group.position.set(...position);
  if(id==='paper'){
    for(let i=0;i<3;i++){const sheet=new THREE.Mesh(new THREE.BoxGeometry(.8,.05,.58),mat(0xeee4c8));sheet.position.y=i*.06;sheet.rotation.y=i*.08;sheet.castShadow=true;group.add(sheet)}
  }else{
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.55,.36,.32,12),mat(0x6f4a31));bowl.castShadow=true;group.add(bowl);const pigment=new THREE.Mesh(new THREE.SphereGeometry(.39,12,8),mat(color));pigment.scale.y=.35;pigment.position.y=.2;group.add(pigment);
  }
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.32,3.4,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,side:THREE.DoubleSide}));beam.position.y=1.8;group.add(beam);
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color}));marker.position.y=3.65;marker.userData.materialMarker=true;group.add(marker);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.82,.07,8,30),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85}));ring.rotation.x=Math.PI/2;ring.position.y=-.42;group.add(ring);
  const canvas=document.createElement('canvas');canvas.width=420;canvas.height=112;const itemCtx=canvas.getContext('2d')!;itemCtx.fillStyle='rgba(20,32,31,.9)';itemCtx.roundRect(30,12,360,88,22);itemCtx.fill();itemCtx.fillStyle='#fff6da';itemCtx.font='bold 40px sans-serif';itemCtx.textAlign='center';itemCtx.fillText(materialNames[id],210,70);const itemLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthTest:false}));itemLabel.position.y=3.15;itemLabel.scale.set(2.8,.75,1);itemLabel.renderOrder=20;group.add(itemLabel);
  const glow=new THREE.PointLight(color,3.4,7);glow.position.y=1.1;group.add(glow);scene.add(group);return group;
}
const materials:Record<MaterialId,THREE.Group>={
  paper:makeMaterialItem('paper',[10,.55,8],0xffe8ae),
  red:makeMaterialItem('red',[-9,.5,5],0xff493f),
  blue:makeMaterialItem('blue',[12,.5,-3],0x3f7dff),
};

// Player and Rapier character controller
const player=makePerson('player',0x315d68,'child'); player.scale.set(.88,.88,.88); player.position.set(0,1.1,9);
const playerBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1.1,9));
const playerCollider=world.createCollider(RAPIER.ColliderDesc.capsule(.62,.38),playerBody);
const controller=world.createCharacterController(.06);controller.enableAutostep(.45,.25,true);controller.enableSnapToGround(.25);controller.setSlideEnabled(true);
const keys=new Set<string>(); let yaw=0, pitch=.35, cameraDistance=6.5, verticalVelocity=0, grounded=false, quest:QuestState='bundle_meet', coins=0, flagStep=0, paused=false, debugVisible=false;
let orbitDragging=false, orbitPointerX=0, orbitPointerY=0;
const collected=new Set<MaterialId>();
const clock=new THREE.Clock(); let elapsed=0, frames=0, fps=0, fpsTimer=0;
const chapterLabel=document.querySelector('#chapterLabel')!;const questTitle=document.querySelector('#questTitle')!; const questStep=document.querySelector('#questStep')!; const prompt=document.querySelector('#prompt')!; const toast=document.querySelector('#toast')!; const dialogue=document.querySelector('#dialogue')!; const speaker=document.querySelector('#speaker')!; const dialogueText=document.querySelector('#dialogueText')!; const debug=document.querySelector('#debug')!;
const guide=document.querySelector('#guide')!;const guideArrow=document.querySelector('#guideArrow') as HTMLElement;const guideName=document.querySelector('#guideName')!;const guideDistance=document.querySelector('#guideDistance')!;
const startScreen=document.querySelector('#startScreen')!;
const restartModal=document.querySelector('#restartModal')!;const restartButton=document.querySelector('#restartButton') as HTMLButtonElement;const restartCancel=document.querySelector('#restartCancel') as HTMLButtonElement;const restartConfirm=document.querySelector('#restartConfirm') as HTMLButtonElement;
const soundButton=document.querySelector('#soundButton') as HTMLButtonElement;
const workshop=document.querySelector('#workshop')!;const flagPreview=document.querySelector('#flagPreview')!;const workshopProgress=document.querySelector('#workshopProgress')!;const workshopAction=document.querySelector('#workshopAction') as HTMLButtonElement;const workshopClose=document.querySelector('#workshopClose') as HTMLButtonElement;

// Original, lightweight Web Audio score and feedback. Audio starts only after player input.
let audioContext:AudioContext|undefined,masterGain:GainNode|undefined,musicGain:GainNode|undefined,sfxGain:GainNode|undefined,musicTimer:number|undefined,melodyIndex=0;
let audioEnabled=true;try{audioEnabled=localStorage.getItem('village1919-audio')!=='off'}catch{/* 기본값 유지 */}
const melody=[293.66,392,440,392,329.63,293.66,261.63,293.66,329.63,392,329.63,293.66];
function updateSoundButton(){soundButton.textContent=audioEnabled?'🔊 소리 켜짐':'🔇 소리 꺼짐';soundButton.setAttribute('aria-pressed',String(audioEnabled));soundButton.dataset.audio=audioContext?.state??'ready'}
function tone(destination:AudioNode,frequency:number,duration:number,volume:number,type:OscillatorType='sine',delay=0){if(!audioContext)return;const now=audioContext.currentTime+delay;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.045);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(destination);oscillator.start(now);oscillator.stop(now+duration+.04)}
function scheduleMusic(){if(!audioEnabled||!audioContext||!musicGain)return;const note=melody[melodyIndex++%melody.length];tone(musicGain,note,1.05,.12,'sine');tone(musicGain,note/2,1.25,.045,'triangle',.03)}
function ensureAudio(){if(!audioEnabled)return;if(!audioContext){audioContext=new AudioContext();masterGain=audioContext.createGain();musicGain=audioContext.createGain();sfxGain=audioContext.createGain();musicGain.gain.value=.24;sfxGain.gain.value=.68;masterGain.gain.value=.88;musicGain.connect(masterGain);sfxGain.connect(masterGain);masterGain.connect(audioContext.destination);const drone=audioContext.createOscillator(),droneGain=audioContext.createGain(),filter=audioContext.createBiquadFilter();drone.type='sine';drone.frequency.value=146.83;droneGain.gain.value=.012;filter.type='lowpass';filter.frequency.value=520;drone.connect(filter).connect(droneGain).connect(musicGain);drone.start();scheduleMusic();musicTimer=window.setInterval(scheduleMusic,1180)}void audioContext.resume().then(updateSoundButton);updateSoundButton()}
function playSfx(kind:'talk'|'pickup'|'reward'|'jump'|'craft'){if(!audioEnabled){return}ensureAudio();if(!audioContext||!sfxGain)return;const output=sfxGain;if(kind==='talk')tone(output,392,.14,.055,'sine');if(kind==='pickup'){tone(output,587,.2,.11,'sine');tone(output,880,.28,.09,'sine',.11)}if(kind==='reward'){[523.25,659.25,783.99].forEach((note,index)=>tone(output,note,.42,.105,'triangle',index*.11))}if(kind==='jump'){tone(output,220,.24,.07,'triangle');tone(output,330,.2,.045,'sine',.07)}if(kind==='craft'){tone(output,440,.18,.08,'triangle');tone(output,554.37,.24,.065,'sine',.09)}}
soundButton.onclick=()=>{audioEnabled=!audioEnabled;try{localStorage.setItem('village1919-audio',audioEnabled?'on':'off')}catch{/* 설정 저장 차단 시 현재 세션 유지 */}if(audioEnabled)ensureAudio();if(masterGain&&audioContext){masterGain.gain.setTargetAtTime(audioEnabled ? .88 : 0,audioContext.currentTime,.04)}updateSoundButton()};updateSoundButton();

function saveProgress(){try{localStorage.setItem('village1919-save',JSON.stringify({quest,coins,collected:[...collected],flagStep} satisfies SaveData))}catch{/* 저장 차단 환경에서도 플레이는 계속된다 */}}
function loadProgress(){try{const raw=localStorage.getItem('village1919-save');if(!raw)return false;const data=JSON.parse(raw) as SaveData;const valid:QuestState[]=['bundle_meet','bundle_find','bundle_return','meet_lee','materials_find','materials_return','flag_ready','flag_complete'];if(data.quest==='milestone_complete')quest='flag_ready';else if(valid.includes(data.quest as QuestState))quest=data.quest as QuestState;else return false;coins=Number(data.coins)||0;flagStep=Math.max(0,Math.min(3,Number(data.flagStep)||0));(data.collected||[]).filter(id=>id in materials).forEach(id=>collected.add(id));return true}catch{return false}}
function materialChecklist(){return (Object.keys(materialNames) as MaterialId[]).map(id=>`${collected.has(id)?'✓':'○'} ${materialNames[id]}`).join(' · ')}
function renderQuest(){
  const steps:Record<QuestState,[string,string]>={
    bundle_meet:['첫 번째 부탁','노란 표식의 김씨 아저씨를 찾아가 보자'],
    bundle_find:['잃어버린 보따리','노란 빛기둥을 따라 동쪽 큰 집 뒤로 가 보자'],
    bundle_return:['보따리를 찾았다!','김씨 아저씨에게 돌려드리자'],
    meet_lee:['두 번째 부탁','청록색 표식의 이씨 아주머니를 만나보자'],
    materials_find:['태극기 재료 모으기',materialChecklist()],
    materials_return:['재료를 모두 모았다!','이씨 아주머니에게 가져다드리자'],
    flag_ready:['태극기 완성하기','이씨 아주머니와 함께 재료를 사용해 보자'],
    flag_complete:['1장 완료 · 함께 만든 태극기','마을 사람들과 힘을 모아 태극기를 완성했다!'],
  };
  [questTitle.textContent,questStep.textContent]=steps[quest];document.querySelector('#coins')!.textContent=String(coins);
  chapterLabel.textContent=quest==='flag_complete'?'1장 · 완료':(['bundle_meet','bundle_find','bundle_return'].includes(quest)?'1장 · 1/3 보따리 찾기':(['meet_lee','materials_find','materials_return'].includes(quest)?'1장 · 2/3 재료 모으기':'1장 · 3/3 태극기 완성'));
  bundle.visible=quest==='bundle_find';bundleGlow.visible=bundle.visible;
  if(quest==='flag_complete')guide.classList.remove('show');
  (Object.keys(materials) as MaterialId[]).forEach(id=>materials[id].visible=quest==='materials_find'&&!collected.has(id));
  npcMarker.visible=['bundle_meet','bundle_find','bundle_return'].includes(quest);
  leeMarker.visible=['meet_lee','materials_find','materials_return','flag_ready'].includes(quest);
}
function setQuest(next:QuestState,toastText?:string){quest=next;renderQuest();saveProgress();if(toastText)showToast(toastText)}
function showToast(text:string){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function openDialogue(who:string,text:string,onClose?:()=>void,buttonText='계속하기'){playSfx('talk');paused=true;speaker.textContent=who;dialogueText.textContent=text;dialogue.classList.add('show');const button=document.querySelector('#continue') as HTMLButtonElement;button.textContent=buttonText;button.onclick=()=>{dialogue.classList.remove('show');paused=false;onClose?.()};}
function renderWorkshop(){flagPreview.className=`flag-preview step-${flagStep}`;const labels=['준비 완료 · 0/3','한지를 펼쳤어요 · 1/3','태극 문양을 그렸어요 · 2/3','태극기를 완성했어요 · 3/3'];const actions=['한지 펼치기','태극 문양 그리기','괘 배치하기','완성!'];workshopProgress.textContent=labels[flagStep];workshopAction.textContent=actions[flagStep];workshopAction.disabled=flagStep===3;workshopClose.textContent=flagStep===3?'완성한 태극기 들고 돌아가기':'잠시 마을로 돌아가기'}
function openWorkshop(){paused=true;renderWorkshop();workshop.classList.add('show')}
workshopAction.onclick=()=>{if(flagStep>=3)return;flagStep++;playSfx(flagStep===3?'reward':'craft');renderWorkshop();saveProgress();if(flagStep===3){coins+=5;setQuest('flag_complete','태극기 완성! 엽전 5개를 받았어요')}};
workshopClose.onclick=()=>{workshop.classList.remove('show');paused=false;if(flagStep===3)openDialogue('1장 완료','김씨 아저씨의 보따리를 찾고, 이씨 아주머니와 재료를 모아 태극기를 완성했어요. 여러 사람의 작은 도움이 큰 힘이 되었습니다.',undefined,'완료한 마을 둘러보기')};
function interact(){
  if(paused){(document.querySelector('#continue') as HTMLButtonElement).click();return}
  const p=player.position; const npcDist=p.distanceTo(npc.position); const leeDist=p.distanceTo(lee.position); const bundleDist=p.distanceTo(bundle.position);
  if(quest==='materials_find'){
    for(const id of Object.keys(materials) as MaterialId[]){if(materials[id].visible&&p.distanceTo(materials[id].position)<2.1){playSfx('pickup');collected.add(id);materials[id].visible=false;const done=collected.size===3;if(done)setQuest('materials_return','재료를 모두 모았어요!');else{renderQuest();saveProgress();showToast(`${materialNames[id]}을(를) 찾았다 · ${collected.size}/3`)}return}}
  }
  if(bundle.visible&&quest==='bundle_find'&&bundleDist<2.1){playSfx('pickup');bundle.visible=false;bundleGlow.visible=false;setQuest('bundle_return','보따리를 찾았다!');return}
  if(npcDist<2.7){
    if(quest==='bundle_meet')openDialogue('김씨 아저씨','아이고, 장에 가져온 보따리를 잃어버렸구나. 동쪽 큰 집 뒤에서 노란 천이 보였던 것 같은데… 함께 찾아주겠니?',()=>setQuest('bundle_find','1장 1/3 · 노란 빛기둥을 따라 보따리를 찾아보자'),'찾아볼게요');
    else if(quest==='bundle_find')openDialogue('김씨 아저씨','보따리는 장터 동쪽 큰 집 근처에서 잃어버린 것 같구나. 서두르지 말고 잘 살펴보렴.');
    else if(quest==='bundle_return')openDialogue('김씨 아저씨','정말 찾아왔구나! 남을 위해 애써 준 마음이 참 고맙다. 이 엽전은 작은 답례란다.',()=>{coins=5;playSfx('reward');setQuest('meet_lee','1장 1/3 완료 · 엽전 5개! 이제 청록색 표식의 이씨 아주머니를 만나자')},'고맙습니다');
    else openDialogue('김씨 아저씨','이씨 아주머니가 너를 찾던데, 장터 건너편 붉은 옷을 입은 분이란다.');return;
  }
  if(leeDist<2.7){
    if(quest==='meet_lee')openDialogue('이씨 아주머니','보따리를 찾아준 아이가 너구나. 사람들과 함께 쓸 태극기를 만들려는데 한지와 붉은 물감, 푸른 물감이 필요해. 빛기둥과 길잡이를 따라 찾아줄 수 있겠니?',()=>setQuest('materials_find','1장 2/3 · 빛기둥을 따라 태극기 재료 3개를 모으자'),'제가 찾아볼게요');
    else if(quest==='materials_find')openDialogue('이씨 아주머니',`지금까지 ${collected.size}개를 찾았구나. 화면 위 수집 목록을 확인하고, 마을에 솟은 이름표와 빛기둥을 따라가 보렴.`);
    else if(quest==='materials_return')openDialogue('이씨 아주머니','모두 찾아왔구나! 여러 사람이 마음을 모으면 큰일도 준비할 수 있단다. 이 엽전은 고마움의 표시야.',()=>{coins+=10;flagStep=0;playSfx('reward');setQuest('flag_ready','재료 찾기 완료! 엽전 10개 · 태극기 만들기가 열렸어요');openDialogue('역사 한 조각','1919년 여러 지역의 사람들은 만세운동을 준비하며 태극기를 직접 만들고 서로 나누었습니다. 게임 속 마을과 인물은 가상이에요.',undefined,'기억했어요')});
    else if(quest==='flag_ready')openDialogue('이씨 아주머니','모아 온 재료가 모두 준비되었구나. 한지를 펼치고, 태극 문양과 네 괘를 차례로 완성해 보자.',openWorkshop,'만들기 시작');
    else openDialogue('이씨 아주머니','함께 만든 태극기를 잘 간직하렴. 다음 이야기가 열리기 전까지 마을을 자유롭게 둘러봐도 좋단다.');
  }
}
function currentTarget(){
  if(quest==='bundle_find')return {position:bundle.position,name:'잃어버린 보따리'};
  if(['bundle_meet','bundle_return'].includes(quest))return {position:npc.position,name:'김씨 아저씨'};
  if(quest==='materials_find'){const visible=(Object.keys(materials) as MaterialId[]).filter(id=>materials[id].visible).sort((a,b)=>player.position.distanceTo(materials[a].position)-player.position.distanceTo(materials[b].position));const id=visible[0];if(id)return {position:materials[id].position,name:materialNames[id]}}
  if(['meet_lee','materials_return','flag_ready'].includes(quest))return {position:lee.position,name:'이씨 아주머니'};
  return undefined;
}
function debugTeleport(){
  const goal=currentTarget();if(!goal)return;const target=goal.position;
  playerBody.setTranslation({x:target.x,y:1.1,z:target.z+1},true);player.position.set(target.x,.11,target.z+1);verticalVelocity=0;showToast('디버그: 현재 목표 앞으로 이동');
}
const hadSave=loadProgress();renderQuest();
if(!hadSave){paused=true;startScreen.classList.add('show')}
(document.querySelector('#startFresh') as HTMLButtonElement).onclick=()=>{ensureAudio();playSfx('reward');collected.clear();coins=0;flagStep=0;startScreen.classList.remove('show');paused=false;setQuest('bundle_meet','1장 시작 · 노란 표식의 김씨 아저씨를 만나자')};
let pausedBeforeRestart=false;
restartButton.onclick=()=>{pausedBeforeRestart=paused;paused=true;restartModal.classList.add('show');restartCancel.focus()};
restartCancel.onclick=()=>{restartModal.classList.remove('show');paused=pausedBeforeRestart;restartButton.focus()};
restartConfirm.onclick=()=>{try{localStorage.removeItem('village1919-save')}finally{location.reload()}};
addEventListener('keydown',e=>{ensureAudio();if(restartModal.classList.contains('show')){if(e.code==='Escape')restartCancel.click();return}if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&grounded&&!paused){verticalVelocity=7.3;playSfx('jump');keys.delete('Space')}if(e.code==='KeyE')interact();if(e.code==='F3'){e.preventDefault();debugVisible=!debugVisible;debug.classList.toggle('show',debugVisible)}if(e.code==='F4'&&debugVisible){e.preventDefault();debugTeleport()}});
addEventListener('keyup',e=>keys.delete(e.code));
renderer.domElement.addEventListener('pointerdown',e=>{
  ensureAudio();
  orbitDragging=true;orbitPointerX=e.clientX;orbitPointerY=e.clientY;
  try{renderer.domElement.requestPointerLock?.().catch(()=>{})}catch{/* 드래그 시점으로 계속 플레이 */}
});
addEventListener('pointerup',()=>orbitDragging=false);
addEventListener('blur',()=>orbitDragging=false);
addEventListener('mousemove',e=>{
  if(paused)return;
  const pointerLocked=document.pointerLockElement===renderer.domElement;
  if(!pointerLocked&&!orbitDragging)return;
  const movementX=pointerLocked?e.movementX:e.clientX-orbitPointerX;
  const movementY=pointerLocked?e.movementY:e.clientY-orbitPointerY;
  orbitPointerX=e.clientX;orbitPointerY=e.clientY;
  yaw-=movementX*.003;pitch=THREE.MathUtils.clamp(pitch+movementY*.0025,-.15,1.02);
});
addEventListener('wheel',e=>cameraDistance=THREE.MathUtils.clamp(cameraDistance+e.deltaY*.006,4,9),{passive:true});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

const desired=new THREE.Vector3(), forward=new THREE.Vector3(), right=new THREE.Vector3(), cameraTarget=new THREE.Vector3(), raycaster=new THREE.Raycaster();
function animatePerson(person:THREE.Group,moving:boolean,time:number){const limbs=person.userData.limbs as {arms:THREE.Group[];legs:THREE.Group[];body:THREE.Mesh};if(!limbs)return;const swing=moving?Math.sin(time*9)*.62:Math.sin(time*1.7)*.035;limbs.arms[0].rotation.x=swing;limbs.arms[1].rotation.x=-swing;if(limbs.legs.length>1){limbs.legs[0].rotation.x=-swing*.72;limbs.legs[1].rotation.x=swing*.72}limbs.body.scale.y=1+Math.sin(time*2)*.012}
function update(dt:number){
  elapsed+=dt;npcMarker.position.y=3.55+Math.sin(elapsed*2.5)*.12;leeMarker.position.y=3.55+Math.sin(elapsed*2.5+1)*.12;diamond.rotation.y+=dt*1.8;leeDiamond.rotation.y-=dt*1.8;bundle.rotation.y+=dt*.7;bundle.position.y=.65+Math.sin(elapsed*2.2)*.08;bundleRing.scale.setScalar(1+Math.sin(elapsed*3)*.12);lee.rotation.y=-.7+Math.sin(elapsed*.7)*.18;clouds.forEach((cloud,index)=>{cloud.position.x+=dt*(.12+index*.035);if(cloud.position.x>48)cloud.position.x=-48});dust.rotation.y+=dt*.006;
  (Object.keys(materials) as MaterialId[]).forEach((id,index)=>{materials[id].rotation.y+=dt*.8;const base=id==='paper'?0.55:0.5;materials[id].position.y=base+Math.sin(elapsed*2+index)*.08;const marker=materials[id].children.find(child=>child.userData.materialMarker);if(marker)marker.rotation.y+=dt*2.4});
  let playerMoving=false;
  if(!paused){
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); desired.set(0,0,0);
    if(keys.has('KeyW'))desired.add(forward);if(keys.has('KeyS'))desired.sub(forward);if(keys.has('KeyD'))desired.add(right);if(keys.has('KeyA'))desired.sub(right);
    const moving=desired.lengthSq()>0;playerMoving=moving;if(moving){desired.normalize();const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?7:4.5;desired.multiplyScalar(speed*dt);const targetYaw=Math.atan2(desired.x,desired.z);player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,targetYaw,.18)}
    grounded=controller.computedGrounded();if(grounded&&verticalVelocity<0)verticalVelocity=-.5;verticalVelocity-=18*dt;desired.y=verticalVelocity*dt;
    controller.computeColliderMovement(playerCollider,{x:desired.x,y:desired.y,z:desired.z});const mv=controller.computedMovement();const pos=playerBody.translation();playerBody.setNextKinematicTranslation({x:pos.x+mv.x,y:pos.y+mv.y,z:pos.z+mv.z});world.step();const np=playerBody.translation();player.position.set(np.x,np.y-.99,np.z);
    if(player.position.y < -8){playerBody.setNextKinematicTranslation({x:0,y:1.1,z:9});verticalVelocity=0;showToast('길에서 벗어나 장터로 돌아왔어요')}
    const npcDist=player.position.distanceTo(npc.position),leeDist=player.position.distanceTo(lee.position),bundleDist=player.position.distanceTo(bundle.position);let promptText='';
    if(quest==='materials_find'){for(const id of Object.keys(materials) as MaterialId[]){if(materials[id].visible&&player.position.distanceTo(materials[id].position)<2.1){promptText=`<span class="key">E</span>${materialNames[id]} 줍기`;break}}}
    if(!promptText&&bundle.visible&&quest==='bundle_find'&&bundleDist<2.1)promptText='<span class="key">E</span>보따리 줍기';else if(!promptText&&npcDist<2.7)promptText='<span class="key">E</span>김씨 아저씨와 이야기';else if(!promptText&&leeDist<2.7&&['meet_lee','materials_find','materials_return','flag_ready','flag_complete'].includes(quest))promptText='<span class="key">E</span>이씨 아주머니와 이야기';prompt.innerHTML=promptText;prompt.classList.toggle('show',!!promptText);
    const goal=currentTarget();guide.classList.toggle('show',!!goal);if(goal){const dx=goal.position.x-player.position.x,dz=goal.position.z-player.position.z;const distance=Math.hypot(dx,dz);const side=dx*Math.cos(yaw)-dz*Math.sin(yaw);const ahead=-dx*Math.sin(yaw)-dz*Math.cos(yaw);guideArrow.style.transform=`rotate(${Math.atan2(side,ahead)}rad)`;guideName.textContent=goal.name;guideDistance.textContent=distance<3?'바로 앞이에요':`${Math.round(distance)}m 남았어요`}
  }
  animatePerson(player,playerMoving,elapsed);animatePerson(npc,false,elapsed+.7);animatePerson(lee,false,elapsed+1.4);
  cameraTarget.copy(player.position).add(new THREE.Vector3(0,1.75,0));const cp=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(cameraDistance).add(cameraTarget);
  raycaster.set(cameraTarget,cp.clone().sub(cameraTarget).normalize());raycaster.far=cameraDistance;const hits=raycaster.intersectObjects(scene.children.filter(o=>o!==player&&o!==npc&&o!==lee&&o.type==='Mesh'),false);if(hits.length&&hits[0].distance<cameraDistance)cp.copy(raycaster.ray.at(Math.max(1.2,hits[0].distance-.35),new THREE.Vector3()));camera.position.lerp(cp,1-Math.exp(-12*dt));camera.lookAt(cameraTarget);
  frames++;fpsTimer+=dt;if(fpsTimer>.5){fps=Math.round(frames/fpsTimer);frames=0;fpsTimer=0}if(debugVisible){const p=player.position;debug.innerHTML=`FPS: ${fps}<br>위치: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>바닥 접촉: ${grounded?'YES':'NO'}<br>퀘스트: ${quest}<br>재료: ${collected.size}/3<br>오브젝트: ${scene.children.length}<br>품질: ${lowPowerDevice?'CHROMEBOOK':'STANDARD'}<br>물리: Rapier 3D<br>F4: 현재 목표로 이동`;}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);for(const bird of birdFlights){bird.mixer.update(dt);bird.angle+=dt*bird.speed;bird.root.position.set(Math.cos(bird.angle)*bird.radius,bird.height+Math.sin(bird.angle*2)*.65,-8+Math.sin(bird.angle)*bird.radius);bird.root.rotation.y=-bird.angle}update(dt);renderer.render(scene,camera)}
animate();
setTimeout(()=>document.querySelector('#controls')?.classList.add('fade'),9000);



