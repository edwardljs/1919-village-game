import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import './styles.css';

type QuestState = 'bundle_meet' | 'bundle_find' | 'bundle_return' | 'meet_lee' | 'materials_find' | 'materials_return' | 'milestone_complete';
type MaterialId = 'paper' | 'red' | 'blue';

interface SaveData { quest: QuestState; coins: number; collected: MaterialId[] }

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="ui">
  <div class="topbar"><div class="quest"><div class="quest-label">지금 할 일</div><div class="quest-title" id="questTitle">장터의 사람과 이야기하기</div><div class="quest-step" id="questStep">김씨 아저씨를 찾아가 보자</div></div><div class="coins"><span class="coin-dot"></span><span id="coins">0</span></div></div>
  <div class="toast" id="toast"></div><div class="prompt" id="prompt"></div>
  <div class="dialogue" id="dialogue"><div class="speaker" id="speaker"></div><div class="dialogue-text" id="dialogueText"></div><button class="continue" id="continue">계속하기</button></div>
  <div class="controls" id="controls"><b>WASD</b> 이동 · <b>마우스</b> 시점<br><b>Space</b> 점프 · <b>Shift</b> 달리기 · <b>E</b> 대화<br><b>F3</b> 상태 정보</div>
  <div class="reticle"></div><div class="debug" id="debug"></div>
  <div class="start-screen" id="startScreen"><div class="start-card"><div class="start-kicker">1919 · 그날의 마을</div><h1>어디서 시작할까요?</h1><p>보따리 미션을 이미 마쳤다면 두 번째 이야기부터 바로 이어갈 수 있어요.</p><div class="start-actions"><button class="story-button secondary" id="startFresh">처음부터 시작</button><button class="story-button" id="startNext">보따리 다음부터</button></div><div class="save-note">진행 상황은 이 브라우저에 자동으로 저장됩니다.</div></div></div>
</div>`;

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -18, z: 0 });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3c0);
scene.fog = new THREE.Fog(0x9fc3c0, 34, 75);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf2ef, 0x5a4633, 2.3));
const sun = new THREE.DirectionalLight(0xffe3ad, 3.1); sun.position.set(-18, 28, 14); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-35; sun.shadow.camera.right=35; sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35; scene.add(sun);

const mat = (color:number, roughness=.85) => new THREE.MeshStandardMaterial({color,roughness});
const groundMat = mat(0x8b966b); const wood=mat(0x694833); const plaster=mat(0xd8c9a9); const roof=mat(0x404d4c); const stone=mat(0x7c8076);
const ground = new THREE.Mesh(new THREE.BoxGeometry(62,1,54),groundMat); ground.position.y=-.5; ground.receiveShadow=true; scene.add(ground);
world.createCollider(RAPIER.ColliderDesc.cuboid(31,.5,27).setTranslation(0,-.5,0));

function box(name:string,pos:[number,number,number],size:[number,number,number],material:THREE.Material, collider=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material); m.name=name; m.position.set(...pos); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  if(collider) world.createCollider(RAPIER.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setTranslation(...pos)); return m;
}
function cylinder(pos:[number,number,number],r:number,h:number,material:THREE.Material){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,10),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;scene.add(m);world.createCollider(RAPIER.ColliderDesc.cylinder(h/2,r).setTranslation(...pos));return m;}

// Village paths and boundary
const pathMat=mat(0xb8a681); box('market-road',[0,.025,0],[12,.05,50],pathMat,false); box('cross-road',[0,.03,-3],[48,.06,9],pathMat,false);
for(const [p,s] of [[[-30,1.5,0],[1,3,54]],[[30,1.5,0],[1,3,54]],[[0,1.5,-27],[62,3,1]],[[0,1.5,27],[62,3,1]]] as [[number,number,number],[number,number,number]][]) box('boundary',p,s,stone);

function house(x:number,z:number,w:number,d:number,flip=false){
  const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
  box('house',[x,1.8,z],[w,3.6,d],plaster);
  const base=box('beam',[x,1.1,z+d*(flip?-.501:.501)],[w+.25,.18,.18],wood,false);
  for(const ox of [-w/2+.18,w/2-.18]) box('beam',[x+ox,1.9,z+d*(flip?-.505:.505)],[.2,3.2,.2],wood,false);
  const roofMesh=new THREE.Mesh(new THREE.CylinderGeometry(0,w*.72,d,3,1,false,0,Math.PI),roof); roofMesh.rotation.z=Math.PI/2; roofMesh.rotation.y=Math.PI/2; roofMesh.position.set(x,4.05,z); roofMesh.scale.z=.75; roofMesh.castShadow=true; scene.add(roofMesh);
  const doorZ=z+d/2*(flip?-1:1)+.02; box('door',[x,1.25,doorZ],[1.25,2.45,.08],wood,false);
  return {group,base};
}
house(-15,-14,8,7); house(15,-15,9,7); house(-17,11,10,7,true); house(17,12,8,6,true);

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

function makePerson(name:string,shirtColor:number,hat=false){
  const g=new THREE.Group(); g.name=name;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.48,.62,1.45,8),mat(shirtColor));body.position.y=1.45;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.38,12,9),mat(0xd2a274));head.position.y=2.5;head.castShadow=true;g.add(head);
  if(hat){const brim=new THREE.Mesh(new THREE.CylinderGeometry(.62,.62,.08,12),mat(0x272a27));brim.position.y=2.78;g.add(brim);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.25,12),mat(0x272a27));cap.position.y=2.9;g.add(cap)}
  for(const sx of [-.27,.27]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.8,.28),mat(0x303737));leg.position.set(sx,.45,0);leg.castShadow=true;g.add(leg)}
  scene.add(g); return g;
}
const npc=makePerson('김씨 아저씨',0x5d6650,true); npc.position.set(-4,0,-1); npc.rotation.y=.4;
const npcMarker=new THREE.Group(); const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.28),mat(0xf5c84d));diamond.rotation.z=Math.PI/4;npcMarker.add(diamond);npcMarker.position.set(-4,3.55,-1);scene.add(npcMarker);
const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d')!;ctx.fillStyle='rgba(20,32,31,.82)';ctx.roundRect(60,18,392,92,25);ctx.fill();ctx.fillStyle='#fff6da';ctx.font='bold 45px sans-serif';ctx.textAlign='center';ctx.fillText('김씨 아저씨',256,78);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true}));label.position.set(-4,3.15,-1);label.scale.set(3.4,.85,1);scene.add(label);

const lee=makePerson('이씨 아주머니',0x8d5148);lee.position.set(7,0,5);lee.rotation.y=-.7;
const leeMarker=new THREE.Group();const leeDiamond=new THREE.Mesh(new THREE.OctahedronGeometry(.28),mat(0x68d3c2));leeDiamond.rotation.z=Math.PI/4;leeMarker.add(leeDiamond);leeMarker.position.set(7,3.55,5);scene.add(leeMarker);
const leeLabelCanvas=document.createElement('canvas');leeLabelCanvas.width=512;leeLabelCanvas.height=128;const leeCtx=leeLabelCanvas.getContext('2d')!;leeCtx.fillStyle='rgba(20,32,31,.82)';leeCtx.roundRect(45,18,422,92,25);leeCtx.fill();leeCtx.fillStyle='#fff6da';leeCtx.font='bold 42px sans-serif';leeCtx.textAlign='center';leeCtx.fillText('이씨 아주머니',256,78);const leeLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(leeLabelCanvas),transparent:true}));leeLabel.position.set(7,3.15,5);leeLabel.scale.set(3.7,.9,1);scene.add(leeLabel);

const bundle=new THREE.Group(); const sack=new THREE.Mesh(new THREE.SphereGeometry(.48,10,8),mat(0x9a6c42));sack.scale.y=.72;sack.castShadow=true;bundle.add(sack);const knot=new THREE.Mesh(new THREE.ConeGeometry(.23,.38,7),mat(0x9a6c42));knot.position.y=.48;bundle.add(knot);bundle.position.set(20,.5,17);scene.add(bundle);
const bundleGlow=new THREE.PointLight(0xffc756,2.6,5);bundleGlow.position.set(20,1.5,17);scene.add(bundleGlow);

const materialNames:Record<MaterialId,string>={paper:'한지',red:'붉은 물감',blue:'푸른 물감'};
function makeMaterialItem(id:MaterialId,position:[number,number,number],color:number){
  const group=new THREE.Group();group.name=materialNames[id];group.position.set(...position);
  if(id==='paper'){
    for(let i=0;i<3;i++){const sheet=new THREE.Mesh(new THREE.BoxGeometry(.8,.05,.58),mat(0xeee4c8));sheet.position.y=i*.06;sheet.rotation.y=i*.08;sheet.castShadow=true;group.add(sheet)}
  }else{
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.4,.28,.25,12),mat(0x6f4a31));bowl.castShadow=true;group.add(bowl);const pigment=new THREE.Mesh(new THREE.SphereGeometry(.28,10,7),mat(color));pigment.scale.y=.35;pigment.position.y=.16;group.add(pigment);
  }
  const glow=new THREE.PointLight(color,2.2,4);glow.position.y=.8;group.add(glow);scene.add(group);return group;
}
const materials:Record<MaterialId,THREE.Group>={
  paper:makeMaterialItem('paper',[13,.55,8],0xffe8ae),
  red:makeMaterialItem('red',[-16,.5,13],0xd9483f),
  blue:makeMaterialItem('blue',[20,.5,-12],0x315caa),
};

// Player and Rapier character controller
const player=makePerson('player',0x315d68); player.scale.set(.88,.88,.88); player.position.set(0,1.1,9);
const playerBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1.1,9));
const playerCollider=world.createCollider(RAPIER.ColliderDesc.capsule(.62,.38),playerBody);
const controller=world.createCharacterController(.06);controller.enableAutostep(.45,.25,true);controller.enableSnapToGround(.25);controller.setSlideEnabled(true);
const keys=new Set<string>(); let yaw=0, pitch=.35, cameraDistance=6.5, verticalVelocity=0, grounded=false, quest:QuestState='bundle_meet', coins=0, paused=false, debugVisible=false;
const collected=new Set<MaterialId>();
const clock=new THREE.Clock(); let elapsed=0, frames=0, fps=0, fpsTimer=0;
const questTitle=document.querySelector('#questTitle')!; const questStep=document.querySelector('#questStep')!; const prompt=document.querySelector('#prompt')!; const toast=document.querySelector('#toast')!; const dialogue=document.querySelector('#dialogue')!; const speaker=document.querySelector('#speaker')!; const dialogueText=document.querySelector('#dialogueText')!; const debug=document.querySelector('#debug')!;
const startScreen=document.querySelector('#startScreen')!;

function saveProgress(){try{localStorage.setItem('village1919-save',JSON.stringify({quest,coins,collected:[...collected]} satisfies SaveData))}catch{/* 저장 차단 환경에서도 플레이는 계속된다 */}}
function loadProgress(){try{const raw=localStorage.getItem('village1919-save');if(!raw)return false;const data=JSON.parse(raw) as SaveData;const valid:QuestState[]=['bundle_meet','bundle_find','bundle_return','meet_lee','materials_find','materials_return','milestone_complete'];if(!valid.includes(data.quest))return false;quest=data.quest;coins=Number(data.coins)||0;(data.collected||[]).forEach(id=>collected.add(id));return true}catch{return false}}
function renderQuest(){
  const steps:Record<QuestState,[string,string]>={
    bundle_meet:['장터의 사람과 이야기하기','김씨 아저씨를 찾아가 보자'],
    bundle_find:['잃어버린 보따리','장터 동쪽 큰 집 근처를 살펴보자'],
    bundle_return:['보따리를 찾았다!','김씨 아저씨에게 돌려드리자'],
    meet_lee:['새로운 이야기','이씨 아주머니를 만나보자'],
    materials_find:['태극기 재료 모으기',`한지와 물감 찾기 · ${collected.size}/3`],
    materials_return:['재료를 모두 모았다!','이씨 아주머니에게 가져다드리자'],
    milestone_complete:['함께 만든 작은 용기','Milestone 2 완료 · 마을을 둘러보자'],
  };
  [questTitle.textContent,questStep.textContent]=steps[quest];document.querySelector('#coins')!.textContent=String(coins);
  bundle.visible=quest==='bundle_find';bundleGlow.visible=bundle.visible;
  (Object.keys(materials) as MaterialId[]).forEach(id=>materials[id].visible=quest==='materials_find'&&!collected.has(id));
  npcMarker.visible=['bundle_meet','bundle_find','bundle_return'].includes(quest);
  leeMarker.visible=['meet_lee','materials_find','materials_return'].includes(quest);
}
function setQuest(next:QuestState,toastText?:string){quest=next;renderQuest();saveProgress();if(toastText)showToast(toastText)}
function showToast(text:string){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function openDialogue(who:string,text:string,onClose?:()=>void,buttonText='계속하기'){paused=true;speaker.textContent=who;dialogueText.textContent=text;dialogue.classList.add('show');const button=document.querySelector('#continue') as HTMLButtonElement;button.textContent=buttonText;button.onclick=()=>{dialogue.classList.remove('show');paused=false;onClose?.()};}
function interact(){
  if(paused){(document.querySelector('#continue') as HTMLButtonElement).click();return}
  const p=player.position; const npcDist=p.distanceTo(npc.position); const leeDist=p.distanceTo(lee.position); const bundleDist=p.distanceTo(bundle.position);
  if(quest==='materials_find'){
    for(const id of Object.keys(materials) as MaterialId[]){if(materials[id].visible&&p.distanceTo(materials[id].position)<2.1){collected.add(id);materials[id].visible=false;const done=collected.size===3;if(done)setQuest('materials_return','재료를 모두 모았어요!');else{renderQuest();saveProgress();showToast(`${materialNames[id]}을(를) 찾았다 · ${collected.size}/3`)}return}}
  }
  if(bundle.visible&&quest==='bundle_find'&&bundleDist<2.1){bundle.visible=false;bundleGlow.visible=false;setQuest('bundle_return','보따리를 찾았다!');return}
  if(npcDist<2.7){
    if(quest==='bundle_meet')openDialogue('김씨 아저씨','아이고, 장에 가져온 보따리를 잃어버렸구나. 동쪽 큰 집 근처였던 것 같은데… 혹시 함께 찾아주겠니?',()=>setQuest('bundle_find','새로운 할 일: 잃어버린 보따리'));
    else if(quest==='bundle_find')openDialogue('김씨 아저씨','보따리는 장터 동쪽 큰 집 근처에서 잃어버린 것 같구나. 서두르지 말고 잘 살펴보렴.');
    else if(quest==='bundle_return')openDialogue('김씨 아저씨','정말 찾아왔구나! 남을 위해 애써 준 마음이 참 고맙다. 이 엽전은 작은 답례란다.',()=>{coins=5;setQuest('meet_lee','의뢰 완료! 엽전 5개 · 새로운 이야기가 열렸어요')});
    else openDialogue('김씨 아저씨','이씨 아주머니가 너를 찾던데, 장터 건너편 붉은 옷을 입은 분이란다.');return;
  }
  if(leeDist<2.7){
    if(quest==='meet_lee')openDialogue('이씨 아주머니','보따리를 찾아준 아이가 너구나. 사람들과 함께 쓸 태극기를 만들려는데 한지와 붉은 물감, 푸른 물감이 필요해. 찾아줄 수 있겠니?',()=>setQuest('materials_find','새로운 할 일: 태극기 재료 3개 모으기'));
    else if(quest==='materials_find')openDialogue('이씨 아주머니',`지금까지 ${collected.size}개를 찾았구나. 한지는 큰 집 앞, 물감은 장터와 골목의 소품 근처를 살펴보렴.`);
    else if(quest==='materials_return')openDialogue('이씨 아주머니','모두 찾아왔구나! 여러 사람이 마음을 모으면 큰일도 준비할 수 있단다. 이 엽전은 고마움의 표시야.',()=>{coins+=10;setQuest('milestone_complete','Milestone 2 완료! 엽전 10개를 받았어요');openDialogue('역사 한 조각','1919년 여러 지역의 사람들은 만세운동을 준비하며 태극기를 직접 만들고 서로 나누었습니다. 게임 속 마을과 인물은 가상이에요.',undefined,'기억했어요')});
    else openDialogue('이씨 아주머니','함께 모은 재료로 태극기를 정성껏 만들고 있단다. 고맙구나.');
  }
}
function debugTeleport(){
  let target:THREE.Vector3;if(quest==='bundle_find')target=bundle.position;else if(['bundle_meet','bundle_return'].includes(quest))target=npc.position;else if(quest==='materials_find'){const next=(Object.keys(materials) as MaterialId[]).find(id=>materials[id].visible);target=next?materials[next].position:lee.position}else target=lee.position;
  playerBody.setTranslation({x:target.x,y:1.1,z:target.z+1},true);player.position.set(target.x,.11,target.z+1);verticalVelocity=0;showToast('디버그: 현재 목표 앞으로 이동');
}
const hadSave=loadProgress();renderQuest();
if(!hadSave){paused=true;startScreen.classList.add('show')}
(document.querySelector('#startFresh') as HTMLButtonElement).onclick=()=>{collected.clear();coins=0;startScreen.classList.remove('show');paused=false;setQuest('bundle_meet','처음부터 이야기를 시작합니다')};
(document.querySelector('#startNext') as HTMLButtonElement).onclick=()=>{collected.clear();coins=5;startScreen.classList.remove('show');paused=false;setQuest('meet_lee','두 번째 이야기부터 이어갑니다')};
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&grounded&&!paused){verticalVelocity=7.3;keys.delete('Space')}if(e.code==='KeyE')interact();if(e.code==='F3'){e.preventDefault();debugVisible=!debugVisible;debug.classList.toggle('show',debugVisible)}if(e.code==='F4'&&debugVisible){e.preventDefault();debugTeleport()}});
addEventListener('keyup',e=>keys.delete(e.code));
renderer.domElement.addEventListener('pointerdown',()=>{try{renderer.domElement.requestPointerLock().catch(()=>{})}catch{/* 포인터 잠금을 지원하지 않는 내장 브라우저 */}});
addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement&&!paused){yaw-=e.movementX*.003;pitch=THREE.MathUtils.clamp(pitch+e.movementY*.0025,-.15,1.02)}});
addEventListener('wheel',e=>cameraDistance=THREE.MathUtils.clamp(cameraDistance+e.deltaY*.006,4,9),{passive:true});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

const desired=new THREE.Vector3(), forward=new THREE.Vector3(), right=new THREE.Vector3(), cameraTarget=new THREE.Vector3(), raycaster=new THREE.Raycaster();
function update(dt:number){
  elapsed+=dt;npcMarker.position.y=3.55+Math.sin(elapsed*2.5)*.12;leeMarker.position.y=3.55+Math.sin(elapsed*2.5+1)*.12;diamond.rotation.y+=dt*1.8;leeDiamond.rotation.y-=dt*1.8;bundle.rotation.y+=dt*.7;bundle.position.y=.5+Math.sin(elapsed*2.2)*.08;lee.rotation.y=-.7+Math.sin(elapsed*.7)*.18;
  (Object.keys(materials) as MaterialId[]).forEach((id,index)=>{materials[id].rotation.y+=dt*.8;const base=id==='paper'?0.55:0.5;materials[id].position.y=base+Math.sin(elapsed*2+index)*.08});
  if(!paused){
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); desired.set(0,0,0);
    if(keys.has('KeyW'))desired.add(forward);if(keys.has('KeyS'))desired.sub(forward);if(keys.has('KeyD'))desired.add(right);if(keys.has('KeyA'))desired.sub(right);
    const moving=desired.lengthSq()>0;if(moving){desired.normalize();const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?7:4.5;desired.multiplyScalar(speed*dt);const targetYaw=Math.atan2(desired.x,desired.z);player.rotation.y=THREE.MathUtils.lerp(player.rotation.y,targetYaw,.18)}
    grounded=controller.computedGrounded();if(grounded&&verticalVelocity<0)verticalVelocity=-.5;verticalVelocity-=18*dt;desired.y=verticalVelocity*dt;
    controller.computeColliderMovement(playerCollider,{x:desired.x,y:desired.y,z:desired.z});const mv=controller.computedMovement();const pos=playerBody.translation();playerBody.setNextKinematicTranslation({x:pos.x+mv.x,y:pos.y+mv.y,z:pos.z+mv.z});world.step();const np=playerBody.translation();player.position.set(np.x,np.y-.99,np.z);
    if(player.position.y < -8){playerBody.setNextKinematicTranslation({x:0,y:1.1,z:9});verticalVelocity=0;showToast('길에서 벗어나 장터로 돌아왔어요')}
    const npcDist=player.position.distanceTo(npc.position),leeDist=player.position.distanceTo(lee.position),bundleDist=player.position.distanceTo(bundle.position);let promptText='';
    if(quest==='materials_find'){for(const id of Object.keys(materials) as MaterialId[]){if(materials[id].visible&&player.position.distanceTo(materials[id].position)<2.1){promptText=`<span class="key">E</span>${materialNames[id]} 줍기`;break}}}
    if(!promptText&&bundle.visible&&quest==='bundle_find'&&bundleDist<2.1)promptText='<span class="key">E</span>보따리 줍기';else if(!promptText&&npcDist<2.7)promptText='<span class="key">E</span>김씨 아저씨와 이야기';else if(!promptText&&leeDist<2.7&&['meet_lee','materials_find','materials_return','milestone_complete'].includes(quest))promptText='<span class="key">E</span>이씨 아주머니와 이야기';prompt.innerHTML=promptText;prompt.classList.toggle('show',!!promptText);
  }
  cameraTarget.copy(player.position).add(new THREE.Vector3(0,1.75,0));const cp=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(cameraDistance).add(cameraTarget);
  raycaster.set(cameraTarget,cp.clone().sub(cameraTarget).normalize());raycaster.far=cameraDistance;const hits=raycaster.intersectObjects(scene.children.filter(o=>o!==player&&o!==npc&&o!==lee&&o.type==='Mesh'),false);if(hits.length&&hits[0].distance<cameraDistance)cp.copy(raycaster.ray.at(Math.max(1.2,hits[0].distance-.35),new THREE.Vector3()));camera.position.lerp(cp,1-Math.exp(-12*dt));camera.lookAt(cameraTarget);
  frames++;fpsTimer+=dt;if(fpsTimer>.5){fps=Math.round(frames/fpsTimer);frames=0;fpsTimer=0}if(debugVisible){const p=player.position;debug.innerHTML=`FPS: ${fps}<br>위치: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>바닥 접촉: ${grounded?'YES':'NO'}<br>퀘스트: ${quest}<br>재료: ${collected.size}/3<br>오브젝트: ${scene.children.length}<br>물리: Rapier 3D<br>F4: 현재 목표로 이동`;}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);update(dt);renderer.render(scene,camera)}
animate();
setTimeout(()=>document.querySelector('#controls')?.classList.add('fade'),9000);


