(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),onlineButton=document.getElementById('onlineButton'),roomCodeInput=document.getElementById('roomCode'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status'),playerNameInput=document.getElementById('playerName');
const authGate=document.getElementById('authGate'),loginForm=document.getElementById('loginForm'),loginEmailInput=document.getElementById('loginEmail'),loginPasswordInput=document.getElementById('loginPassword'),authMessage=document.getElementById('authMessage'),logoutButton=document.getElementById('logoutButton');
const controlsButton=document.getElementById('controlsButton'),controlsPanel=document.getElementById('controlsPanel'),controlsBackdrop=document.getElementById('controlsBackdrop'),controlsCaptureMessage=document.getElementById('controlsCaptureMessage');
const DEMO_ACCOUNTS=[
 {id:'sonic',email:'sonic@bluerush.demo',password:'RUSH2026!',name:'Sonic'},
 {id:'tails',email:'tails@bluerush.demo',password:'FLY2026!',name:'Tails'},
 {id:'amy',email:'amy@bluerush.demo',password:'AMY2026!',name:'Amy'}
];
const AUTH_SESSION_KEY='blueRushDemoSession';
const SCORE_STORAGE_KEY='blueRushScoreRecordsV1';
const bestScoreValue=document.getElementById('bestScoreValue'),totalScoreValue=document.getElementById('totalScoreValue'),scoreMeta=document.getElementById('scoreMeta'),scoreRanking=document.getElementById('scoreRanking');
const CHARACTER_STORAGE_KEY='blueRushSelectedCharacter:';
const CHARACTER_DATA={
 sonic:{name:'Sonic',description:'El erizo azul original de Blue Rush.'},
 tails:{name:'Tails',description:'Salta con el primer toque y pulsa salto una segunda vez en el aire para volar. Mantén el botón para impulsarte; tiene 7 segundos de resistencia acumulada. Se cansa y planea hasta aterrizar. También nada bajo los puentes y ataca con sus dos colas.'},
 knuckles:{name:'Knuckles',description:'Salta un poco menos que Sonic. Pulsa salto otra vez en el aire y mantenlo para planear; dirige con ←/→. Usa Z para encadenar tres puñetazos contra rivales online y reducir su velocidad.'},
 amy:{name:'Amy',description:'Eriza rosa de vestido rojo · diseño vectorial provisional.'},
 shadow:{name:'Shadow',description:'Erizo oscuro con detalles rojos · diseño vectorial provisional.'}
};
// El estado del jugador debe existir antes de restaurar la sesión guardada.
let running=false,lastTime=0,elapsed=0,camera=0,cameraY=0,score=0,lives=3,player=null;
let selectedCharacterId='sonic';
let authenticatedUser=null;
let playerName='';
let currentRunRecorded=true;
function readScoreRecords(){
 try{const data=JSON.parse(localStorage.getItem(SCORE_STORAGE_KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}
 catch(_){return {}}
}
function cleanScoreStats(raw){
 const s=raw&&typeof raw==='object'?raw:{};
 return {bestScore:Math.max(0,Math.floor(Number(s.bestScore)||0)),totalScore:Math.max(0,Math.floor(Number(s.totalScore)||0)),runs:Math.max(0,Math.floor(Number(s.runs)||0)),wins:Math.max(0,Math.floor(Number(s.wins)||0)),bestTime:Number.isFinite(Number(s.bestTime))&&Number(s.bestTime)>0?Number(s.bestTime):0,lastScore:Math.max(0,Math.floor(Number(s.lastScore)||0)),lastOutcome:String(s.lastOutcome||'')};
}
function writeScoreRecords(records){
 try{localStorage.setItem(SCORE_STORAGE_KEY,JSON.stringify(records));return true}
 catch(error){console.warn('[Blue Rush] No se pudo guardar el ranking:',error);return false}
}
function renderScoreboard(){
 const records=readScoreRecords(),stats=authenticatedUser?cleanScoreStats(records[authenticatedUser.id]):cleanScoreStats(null);
 if(bestScoreValue)bestScoreValue.textContent=stats.bestScore.toLocaleString('es-EC');
 if(totalScoreValue)totalScoreValue.textContent=stats.totalScore.toLocaleString('es-EC');
 if(scoreMeta)scoreMeta.textContent='PARTIDAS '+stats.runs+' · VICTORIAS '+stats.wins;
 if(!scoreRanking)return;
 scoreRanking.replaceChildren();
 DEMO_ACCOUNTS.map(account=>({account,stats:cleanScoreStats(records[account.id])}))
  .sort((a,b)=>b.stats.bestScore-a.stats.bestScore||a.account.name.localeCompare(b.account.name))
  .slice(0,3).forEach(entry=>{
   const item=document.createElement('li'),name=document.createElement('span'),points=document.createElement('strong');
   if(authenticatedUser&&authenticatedUser.id===entry.account.id)item.classList.add('is-current');
   name.textContent=entry.account.name+(authenticatedUser&&authenticatedUser.id===entry.account.id?' · TÚ':'');
   points.textContent=entry.stats.bestScore.toLocaleString('es-EC')+' pts';
   item.append(name,points);scoreRanking.append(item);
  });
}
function saveBestScore(){
 if(!authenticatedUser||!Number.isFinite(score)||score<=0)return;
 const records=readScoreRecords(),stats=cleanScoreStats(records[authenticatedUser.id]);
 if(score>stats.bestScore){stats.bestScore=Math.floor(score);records[authenticatedUser.id]=stats;if(writeScoreRecords(records))renderScoreboard()}
}
function addScore(points){
 const amount=Math.max(0,Math.floor(Number(points)||0));
 if(!amount)return;
 score+=amount;saveBestScore();
}
function recordRun(outcome){
 if(currentRunRecorded||!authenticatedUser)return;
 currentRunRecorded=true;
 const records=readScoreRecords(),stats=cleanScoreStats(records[authenticatedUser.id]),finalScore=Math.max(0,Math.floor(Number(score)||0));
 stats.totalScore+=finalScore;stats.runs+=1;stats.lastScore=finalScore;stats.lastOutcome=outcome;
 stats.bestScore=Math.max(stats.bestScore,finalScore);
 if(outcome==='complete'||outcome==='win'){
  stats.wins+=1;
  const time=Math.max(0,Number(elapsed)||0);
  if(time>0&&(!stats.bestTime||time<stats.bestTime))stats.bestTime=time;
 }
 records[authenticatedUser.id]=stats;
 if(writeScoreRecords(records))renderScoreboard();
}
function normalizeCharacterId(value){return Object.prototype.hasOwnProperty.call(CHARACTER_DATA,String(value||''))?String(value):'sonic'}
function setSelectedCharacter(value,save=true){
 const previousCharacterId=selectedCharacterId;
 selectedCharacterId=normalizeCharacterId(value);
 if(previousCharacterId!==selectedCharacterId&&player){
  player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;
  player.homingActive=false;player.homingTargetId=null;player.homingTimer=0;
  player.spinDashCharging=false;player.spinDashCharge=0;player.spinDashRolling=false;player.spinDashRollTime=0;
  player.knucklesGliding=false;player.knucklesJumpTapPending=false;player.knucklesPunchTimer=0;
  player.tailsFlying=false;player.tailsTired=false;player.tailsFlightTime=0;player.tailsSwimming=false;player.tailsAttackTimer=0;
  if(!running){player.vx=0;player.vy=0;player.onGround=true;player.platformId=null;player.y=groundSurfaceAt(player.x+player.w/2)-player.h;}
 }
 document.querySelectorAll('[data-character]').forEach(button=>{
  const active=button.dataset.character===selectedCharacterId;
  button.classList.toggle('is-selected',active);
  button.setAttribute('aria-pressed',active?'true':'false');
 });
 const note=document.getElementById('characterSelectNote');
 if(note)note.textContent=CHARACTER_DATA[selectedCharacterId].description;
 const jumpHelp=document.querySelector('[data-binding-label="jump"]');
 const jumpCaption=jumpHelp&&jumpHelp.parentElement?jumpHelp.parentElement.querySelector('small'):null;
 if(jumpCaption)jumpCaption.textContent=selectedCharacterId==='tails'?'2 TOQUES: SALTO / VUELO':selectedCharacterId==='knuckles'?'2 TOQUES: SALTO / PLANEO HASTA ATERRIZAR':'SPIN ATTACK';
 const downHelp=document.querySelector('[data-binding-label="down"]');
 const downCaption=downHelp&&downHelp.parentElement?downHelp.parentElement.querySelector('small'):null;
 if(downCaption)downCaption.textContent=selectedCharacterId==='tails'?'BUCEAR / RODAR':'RODAR';
 const attackHelp=document.querySelector('[data-binding-label="homing"]');
 const attackCaption=attackHelp&&attackHelp.parentElement?attackHelp.parentElement.querySelector('small'):null;
 if(attackCaption)attackCaption.textContent=selectedCharacterId==='tails'?'ATAQUE COLAS':selectedCharacterId==='knuckles'?'PUÑETAZO':'HOMING';
 const jumpTouch=document.querySelector('[data-control="jump"]');
 if(jumpTouch){jumpTouch.textContent=selectedCharacterId==='tails'?'VOLAR':selectedCharacterId==='knuckles'?'PLANEAR':'SPIN ATTACK';jumpTouch.setAttribute('aria-label',selectedCharacterId==='tails'?'Saltar y volar':selectedCharacterId==='knuckles'?'Saltar y planear':'Saltar y hacer Spin Attack')}
 const downTouch=document.querySelector('[data-control="down"]');
 if(downTouch){downTouch.textContent='RODAR ↓';downTouch.setAttribute('aria-label','Rodar o bajar al túnel')}
 const attackTouch=document.querySelector('[data-control="homing"]');
 if(attackTouch){attackTouch.textContent=selectedCharacterId==='tails'?'COLAS':selectedCharacterId==='knuckles'?'PUÑO':'HOMING';attackTouch.setAttribute('aria-label',selectedCharacterId==='knuckles'?'Dar un puñetazo':'Activar ataque del personaje')}
 if(save&&authenticatedUser){
  try{localStorage.setItem(CHARACTER_STORAGE_KEY+authenticatedUser.id,selectedCharacterId)}
  catch(error){console.warn('[Blue Rush] No se pudo guardar el personaje elegido:',error)}
 }
}
function restoreSelectedCharacter(){
 let saved='sonic';
 if(authenticatedUser){try{saved=localStorage.getItem(CHARACTER_STORAGE_KEY+authenticatedUser.id)||'sonic'}catch(_){}}
 setSelectedCharacter(saved,false);
}
document.querySelectorAll('[data-character]').forEach(button=>{
 button.addEventListener('click',()=>setSelectedCharacter(button.dataset.character,true));
});
function showAuthMessage(message,isError=false){
 authMessage.textContent=message;
 authMessage.classList.toggle('is-error',isError);
}
function setAuthenticatedUser(user,saveSession=true){
 authenticatedUser=user?{email:user.email,name:user.name}:null;
 const loggedIn=Boolean(authenticatedUser);
 authGate.classList.toggle('hidden',loggedIn);
 document.body.classList.toggle('auth-locked',!loggedIn);
 logoutButton.hidden=!loggedIn;
 if(loggedIn){
  playerName=authenticatedUser.name;
  playerNameInput.value=authenticatedUser.name;
  restoreSelectedCharacter();
  logoutButton.textContent='CAMBIAR USUARIO';
  status.textContent='SESIÓN ACTIVA · '+authenticatedUser.name.toUpperCase();
  if(saveSession){
   // La sesión solo vive en esta pestaña: desaparece al cerrarla.
   try{sessionStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(authenticatedUser))}
   catch(_){showAuthMessage('Sesión iniciada, pero no se pudo guardar en esta pestaña. No cierres la página.',true)}
  }
 }else{
  logoutButton.hidden=true;
  if(loginPasswordInput)loginPasswordInput.value='';
  restoreSelectedCharacter();
 }
 renderScoreboard();
}
function restoreDemoSession(){
 // Recupera la sesión solo al recargar la misma pestaña.
 // sessionStorage se limpia cuando el usuario cierra la pestaña o ventana.
 try{
  const saved=JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY)||'null');
  const account=DEMO_ACCOUNTS.find(item=>item.email===String(saved&&saved.email||'').toLowerCase());
  if(account){setAuthenticatedUser(account,false);return}
 }catch(_){}
 // Borra cualquier sesión antigua que hubiera quedado guardada de forma permanente.
 try{localStorage.removeItem(AUTH_SESSION_KEY)}catch(_){}
 setAuthenticatedUser(null,false);
}
function handleDemoLogin(event){
 event.preventDefault();
 const email=String(loginEmailInput.value||'').trim().toLowerCase();
 const password=String(loginPasswordInput.value||'');
 const account=DEMO_ACCOUNTS.find(item=>item.email===email&&item.password===password);
 if(!account){showAuthMessage('Correo o contraseña incorrectos. Prueba con una de las cuentas ficticias.',true);loginPasswordInput.select();return}
 setAuthenticatedUser(account,true);
 showAuthMessage('¡Bienvenido, '+account.name+'! Ya puedes jugar.');
}
loginForm.addEventListener('submit',handleDemoLogin);
document.querySelectorAll('[data-demo-account]').forEach(button=>{
 button.addEventListener('click',()=>{
  const account=DEMO_ACCOUNTS.find(item=>item.id===button.dataset.demoAccount);
  if(!account)return;
  loginEmailInput.value=account.email;loginPasswordInput.value=account.password;
  showAuthMessage('Datos de '+account.name+' cargados. Pulsa INICIAR SESIÓN.');
  loginPasswordInput.focus();
 });
});
function switchDemoAccount(){
 if(onlineMode)leaveOnlineRoom();
 running=false;
 keys.left=keys.right=keys.jump=keys.down=keys.spindash=keys.peelout=keys.homing=false;keys.up=false;
 resetPlayer();
 startScreen.classList.remove('hidden');
 try{sessionStorage.removeItem(AUTH_SESSION_KEY);localStorage.removeItem(AUTH_SESSION_KEY)}catch(error){console.warn('[Blue Rush] No se pudo limpiar la sesión guardada:',error)}
 setAuthenticatedUser(null,false);
 loginEmailInput.value='';
 loginPasswordInput.value='';
 showAuthMessage('Sesión cerrada. Selecciona otra cuenta o introduce otros datos para iniciar sesión.');
 status.textContent='ELIGE UNA CUENTA PARA CONTINUAR';
 authGate.classList.remove('hidden');
 document.body.classList.add('auth-locked');
 loginEmailInput.focus();
}
logoutButton.addEventListener('click',switchDemoAccount);
restoreDemoSession();
const multiplayerId=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():('br-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
let multiplayerClient=null,multiplayerChannel=null,multiplayerRoom='',onlineMode=false,lastNetworkSend=0;
const remotePlayers=new Map();
const NETWORK_SEND_INTERVAL=120;
const W=canvas.width,H=canvas.height,GROUND=530,keys={left:false,right:false,jump:false,down:false,up:false,spindash:false,peelout:false,homing:false};
// Cámara de primer plano: muestra menos escenario y mantiene a Sonic como foco.
const GAME_ZOOM=1.7,VIEW_W=Math.ceil(W/GAME_ZOOM),VIEW_H=Math.ceil(H/GAME_ZOOM),CAMERA_FILL_MARGIN=65;
// Spritesheet Green Island (edición gratuita).
const greenIsland=new Image();greenIsland.src='./assets/green-island/free_edition.png';let greenIslandReady=false;greenIsland.onload=()=>{greenIslandReady=true};
// Acto largo, pensado para durar aproximadamente 1,5–2 minutos a velocidad normal.
const worldWidth=60000;
const RING_VERTICAL_RADIUS=18;
const terrainSections=[
 [0,530],[350,530],[700,520],[1050,493],[1400,464],[1750,475],[2100,515],[2450,549],[2800,558],[3150,530],
 [3500,493],[3850,450],[4200,440],[4550,473],[4900,520],[5250,569],[5600,578],[5950,535],[6300,490],[6650,468],
 [7000,485],[7350,528],[7700,558],[8050,545],[8400,499],[8750,458],[9100,450],[9450,480],[9800,539],[10150,565],
 [10500,530],[10850,480],[11200,453],[11550,470],[11900,515],[12250,545],[12600,555],[12950,543],[13300,520],[13650,488],
 [14000,470],[14350,495],[14700,540],[15050,573],[15400,565],[15750,525],[16100,480],[16450,455],[16800,468],[17150,510],
 [17500,551],[17850,560],[18200,526],[18550,480],[18900,450],[19250,470],[19600,524],[19950,569],[20300,579],[20650,540],
 [21000,490],[21300,455],[21600,393],[21900,318],[22200,249],[22500,218],[22800,236],[23100,305],[23400,393],[23700,474],[24000,530],
 [24300,493],[24600,430],[24900,349],[25200,274],[25500,218],[25800,230],[26100,280],[26400,361],[26700,455],[27000,536],
 [27300,486],[27600,418],[27900,330],[28200,249],[28500,208],[28800,230],[29100,299],[29400,386],[29700,474],[30000,555],
 [30300,518],[30600,455],[30900,368],[31200,280],[31500,218],[31800,230],[32100,311],[32400,399],[32700,480],[33000,555],
 [33300,530],[33600,480],[33900,405],[34200,343],[34500,286],[34800,318],[35100,393],[35400,474],[35700,518],[36000,530],
 // Cuatro montañas grandes con laderas escalables y valles para recuperar velocidad.
 [36300,511],[36600,461],[36900,405],[37200,349],[37500,324],[37800,343],[38100,393],[38400,455],[38700,530],[39000,568],
 [39300,543],[39600,486],[39900,424],[40200,368],[40500,324],[40800,333],[41100,380],[41400,449],[41700,524],[42000,568],
 [42300,530],[42600,468],[42900,399],[43200,336],[43500,318],[43800,340],[44100,399],[44400,468],[44700,536],[45000,568],
 [45300,524],[45600,455],[45900,386],[46200,330],[46500,324],[46800,361],[47100,430],[47400,499],[47700,530],[48000,530],
 [48300,498],[48600,455],[48900,418],[49200,436],[49500,486],[49800,543],[50100,570],[50400,536],[50700,480],[51000,436],
 [51300,399],[51600,424],[51900,480],[52200,530],[52500,568],[52800,549],[53100,499],[53400,455],[53700,424],[54000,443],
 [54300,499],[54600,549],[54900,568],[55200,530],[55500,480],[55800,443],[56100,411],[56400,430],[56700,480],[57000,530],
 [57300,558],[57600,524],[57900,474],[58200,443],[58500,455],[58800,505],[59100,549],[59400,555],[59700,524],[60000,530]
];
// Interpolación suave entre puntos para evitar escalones en las laderas.
function terrainHeight(x){
 x=Math.max(0,Math.min(worldWidth,x));
 let i=0;while(i<terrainSections.length-2&&terrainSections[i+1][0]<x)i++;
 const [x0,y0]=terrainSections[i],[x1,y1]=terrainSections[i+1];
 const t=(x-x0)/(x1-x0),smooth=t*t*(3-2*t);
 const rawY=y0+(y1-y0)*smooth;
 // Conserva la forma general, pero eleva la superficie 180 px para abrir espacio
 // debajo del suelo para una futura entrada y zona subterránea.
 const shapedY=rawY>=530?rawY:Math.max(145,530-(530-rawY)*2);
 return Math.max(95,shapedY-180);
}
const levelSections=[
 {start:0,end:3000,name:"COSTA VERDE",kind:"coast"},
 {start:3000,end:7000,name:"COLINAS DE LA ISLA",kind:"hills"},
 {start:7000,end:12000,name:"SENDEROS SECRETOS",kind:"routes"},
 {start:12000,end:17000,name:"PUENTES DE LA LAGUNA",kind:"lagoon"},
 {start:17000,end:21000,name:"RUINAS DE LA ISLA",kind:"ruins"},
 {start:21000,end:27000,name:"GRAN CORDILLERA",kind:"mountain"},
 {start:27000,end:33000,name:"CORDILLERA CENTRAL",kind:"mountain"},
 {start:33000,end:35700,name:"CORDILLERA DEL VIENTO",kind:"mountain"},
 {start:35700,end:36600,name:"VALLE ROCOSO",kind:"mountain"},
 {start:36600,end:39000,name:"LADERAS ROCOSAS",kind:"mountain"},
 {start:39000,end:42000,name:"MONTAÑA DEL VIENTO",kind:"mountain"},
 {start:42000,end:44700,name:"PICOS DEL VIENTO",kind:"mountain"},
 {start:44700,end:48000,name:"CORDILLERA FINAL",kind:"mountain"},
 {start:48000,end:52000,name:"COLINAS LEJANAS",kind:"mountain"},
 {start:52000,end:56000,name:"PASO DE PIEDRA",kind:"mountain"},
 {start:56000,end:59000,name:"COLINAS FINALES",kind:"mountain"},
 {start:59000,end:60000,name:"RECTA FINAL",kind:"finish"}
];
function sectionAt(x){return levelSections.find(section=>x>=section.start&&x<section.end)||levelSections[levelSections.length-1]}


const bridgeSpecs=[{x:12650,w:390,label:"LAGUNA"},{x:22630,w:420,label:"VIENTO"}];
// Los tramos de puente sustituyen la superficie del terreno por una pasarela sólida.
function bridgeAt(x){return bridgeSpecs.find(bridge=>x>=bridge.x&&x<=bridge.x+bridge.w)||null}
function bridgeSurfaceY(bridge){return terrainHeight(bridge.x+bridge.w/2)-6}
function groundSurfaceAt(x){const bridge=bridgeAt(x);return bridge?bridgeSurfaceY(bridge):terrainHeight(x)}
const undergroundZone={entryX:14350,exitX:18750,depth:128};
let inUnderground=false;
function undergroundPathY(x){
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 const entering=smooth((x-(undergroundZone.entryX-28))/235);
 const leaving=smooth((undergroundZone.exitX+28-x)/235);
 return groundSurfaceAt(x)+undergroundZone.depth*Math.min(entering,leaving);
}
// Ruta aérea elevada: los valores y bajos colocan las plataformas muy por encima del terreno.
const aerialPlatforms=[
 {id:11,x:6700,lift:215,w:700}, // Plataforma amplia justo encima del trampolín
  {id:0,x:7420,lift:210,w:360},{id:1,x:7840,lift:223,w:280},
 {id:2,x:8170,lift:237,w:270},{id:3,x:8490,lift:215,w:280},
 {id:4,x:8820,lift:207,w:290},{id:5,x:9160,lift:219,w:270},
 {id:6,x:9480,lift:235,w:280},{id:7,x:9810,lift:225,w:300},
 {id:8,x:10160,lift:210,w:300},{id:9,x:10520,lift:220,w:300},
 {id:10,x:10870,lift:230,w:300}
];
const aerialSpring={x:6800,w:72,cooldownUntil:0,flashUntil:0};
// Eleva toda la ruta aérea otras 120 unidades; el límite inferior se elimina para que no se amontonen en la misma altura.
function aerialPlatformY(platform){return terrainHeight(platform.x+platform.w/2)-platform.lift-120}
function platformUnderPlayer(x,w){return aerialPlatforms.find(p=>x+w>p.x+5&&x<p.x+p.w-5)||null}
function platformById(id){return id===null||id===undefined?null:aerialPlatforms.find(p=>p.id===id)||null}
function springTopY(){return groundSurfaceAt(aerialSpring.x+aerialSpring.w/2)-8}
let rings=[],enemies=[],beeProjectiles=[],enemyExplosions=[],collected=new Set(),checkpoints=[];
const destroyedEnemyIds=new Set();
let checkpointX=90,levelCompleted=false;
let raceFinished=false,raceWinner=null;
function buildLevel(){
 rings=[];collected=new Set();enemyExplosions=[];
 if(!onlineMode)destroyedEnemyIds.clear();
 let group=0;
 // Anillos repartidos por el recorrido principal.
 for(let x=220;x<worldWidth-280;x+=820,group++){
  const zone=sectionAt(x),pattern=(group+(Math.floor(x/5000)*2))%5,count=2+(group%2);
  for(let i=0;i<count;i++){
   const rx=x+i*38,base=groundSurfaceAt(rx);
   let offset;
   if(pattern===0)offset=44;
   else if(pattern===1)offset=52+Math.sin(i/(count-1)*Math.PI)*54;
   else if(pattern===2)offset=zone.kind==="ruins"?110:86;
   else if(pattern===3)offset=46+Math.sin(i/(count-1)*Math.PI)*34;
   else offset=zone.kind==="finish"?70:42;
   // Mantiene el anillo por encima de la superficie incluso en los picos altos.
   const ringY=Math.min(base-36,Math.max(26,base-offset));
   rings.push({id:group+"-"+i,x:rx,y:ringY,got:false});
  }
 }
 const enemyPositions=[980,2180,3700,5050,6550,8150,9550,11050,13900,15100,17450,19350,21100,23850,25500,27600,29450,31250,32950,34600,36080,38800,39480,41850,44580,47520,48900,51050,53200,55100,58000,59200];
 beeProjectiles=[];
 enemies=enemyPositions.map((x,index)=>({
  id:'enemy-'+index,
  x,
  y:index%3===2?terrainHeight(x)-190:terrainHeight(x)-28,
  alive:!destroyedEnemyIds.has('enemy-'+index),base:x,kind:index%3,
  hasFiredFirst:false,nextShot:0
 }));

 checkpoints=[9000,18000,27000,36000,42000,51000,57000].map((x,index)=>({x,y:terrainHeight(x),active:false,index}));
}

function spawnEnemyExplosion(x,y,kind=0){
 const colors=kind===2?["#fff09a","#8feeff","#ffd35c","#ffffff"]:["#fff09a","#ff9858","#8feeff","#ffffff"];
 const particles=Array.from({length:14},(_,i)=>{
  const angle=(Math.PI*2*i/14)+(Math.random()-.5)*.22;
  const speed=95+Math.random()*155;
  return {x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-35,size:2+Math.random()*2.8,color:colors[i%colors.length]};
 });
 enemyExplosions.push({x,y,kind,age:0,duration:.68,particles});
}
function updateEnemyExplosions(dt){
 for(const effect of enemyExplosions){
  effect.age+=dt;
  for(const p of effect.particles){
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.22,dt);p.vy+=430*dt;
  }
 }
 enemyExplosions=enemyExplosions.filter(effect=>effect.age<effect.duration);
}
function drawEnemyExplosions(){
 for(const effect of enemyExplosions){
  const progress=Math.min(1,effect.age/effect.duration),alpha=1-progress;
  const x=effect.x-camera,y=effect.y-10;
  g.save();g.globalAlpha=alpha;g.lineWidth=3;
  g.strokeStyle=effect.kind===2?"#8feeff":"#ffd35c";
  g.beginPath();g.arc(x,y,7+progress*27,0,Math.PI*2);g.stroke();
  g.strokeStyle="#ffffff";g.lineWidth=1.6;g.beginPath();
  for(let i=0;i<8;i++){
   const angle=i*Math.PI/4,r1=9+progress*10,r2=16+progress*27;
   g.moveTo(x+Math.cos(angle)*r1,y+Math.sin(angle)*r1);
   g.lineTo(x+Math.cos(angle)*r2,y+Math.sin(angle)*r2);
  }
  g.stroke();
  for(const p of effect.particles){g.fillStyle=p.color;g.beginPath();g.arc(p.x-camera,p.y,p.size*(1-progress*.35),0,Math.PI*2);g.fill()}
  g.restore();
 }
}
function markEnemyDestroyed(enemyId,x,y,kind,showEffect=true){
 const id=String(enemyId||'');
 if(!/^enemy-[0-9]+$/.test(id)||destroyedEnemyIds.has(id))return false;
 const enemy=enemies.find(item=>item.id===id);
 if(!enemy)return false;
 destroyedEnemyIds.add(id);enemy.alive=false;
 const effectX=Number.isFinite(x)?x:enemy.x,effectY=Number.isFinite(y)?y:enemy.y;
 if(showEffect)spawnEnemyExplosion(effectX,effectY,Number.isFinite(kind)?kind:enemy.kind);
 return true;
}
function trackOnlineEnemyPresence(){
 if(!onlineMode||!multiplayerChannel||!player)return;
 multiplayerChannel.track({id:multiplayerId,name:playerName,characterId:selectedCharacterId,x:player.x,y:player.y,at:Date.now(),destroyedEnemies:Array.from(destroyedEnemyIds)})
  .catch(error=>console.warn('[Blue Rush] No se pudo actualizar el estado de enemigos:',error));
}
function destroyEnemy(enemy){
 if(!enemy||!markEnemyDestroyed(enemy.id,enemy.x,enemy.y,enemy.kind,true))return false;
 if(onlineMode&&multiplayerChannel){
  const payload={enemyId:enemy.id,x:enemy.x,y:enemy.y,kind:enemy.kind,by:multiplayerId,at:Date.now()};
  multiplayerChannel.send({type:'broadcast',event:'enemy-destroyed',payload})
   .catch(error=>console.warn('[Blue Rush] No se pudo sincronizar la destrucción del enemigo:',error));
  trackOnlineEnemyPresence();
 }
 return true;
}


function resetPlayer(){
 keys.left=keys.right=keys.jump=keys.down=keys.up=keys.spindash=keys.peelout=keys.homing=false;
 player={x:90,y:terrainHeight(90)-43,w:34,h:43,vx:0,vy:0,speed:900,speedCharge:0,jump:625,onGround:true,facing:1,invincible:0,spin:0,spinAngle:0,runPhase:0,fallPhase:0,spinPhase:0,spinDashCharging:false,spinDashCharge:0,spinDashAnimTime:0,spinDashRolling:false,spinDashRollTime:0,rolling:false,spinAttack:false,homingActive:false,homingTargetId:null,homingTimer:0,peelOutCharging:false,peelOutCharge:0,peelOutAnimTime:0,peelOutBurst:0,peelOutBurstTime:0,peelOutSpeedFade:0,tailsFlying:false,tailsTired:false,tailsFlightTime:0,tailsSwimming:false,tailsAttackTimer:0,tailsAttackCooldown:0,tailsSwimStrokeCooldown:0,knucklesGliding:false,knucklesJumpTapPending:false,knucklesPunchTimer:0,knucklesPunchCooldown:0,knucklesPunchStage:0,knucklesPunchComboAge:0,knucklesPunchInputAt:-1e9,hitSlowTimer:0,hitSlowFactor:1,platformId:null};keys.spindash=false;keys.peelout=false;keys.homing=false;keys.up=false;camera=0;cameraY=0;elapsed=0;score=0;lives=3;checkpointX=90;levelCompleted=false;raceFinished=false;raceWinner=null;inUnderground=false;aerialSpring.cooldownUntil=0;aerialSpring.flashUntil=0;buildLevel()}
function showLobbyMessage(title,message){
 startScreen.querySelector('h2').textContent=title;
 startScreen.querySelector('p:not(.start-kicker)').textContent=message;
 startScreen.classList.remove('hidden');
}
function startGame(){
 if(!authenticatedUser){authGate.classList.remove('hidden');document.body.classList.add('auth-locked');showAuthMessage('Inicia sesión para comenzar a jugar.',true);return}
 if(!running){
  if(levelCompleted)resetPlayer();
  startScreen.querySelector('h2').textContent='¡Vamos, '+CHARACTER_DATA[selectedCharacterId].name+'!';
  startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';
  startButton.textContent='JUGAR SOLO';
  playerName=(playerNameInput.value||playerName||'').trim().slice(0,16)||'Sonic';playerNameInput.value=playerName;
  currentRunRecorded=false;running=true;startScreen.classList.add('hidden');
  status.textContent=onlineMode?'ONLINE · SALA '+multiplayerRoom:'¡CORRE POR LA ISLA Y DESCUBRE SUS RUTAS!';
  lastTime=performance.now();
 }
}
async function startOnlineGame(){
 if(!authenticatedUser){authGate.classList.remove('hidden');document.body.classList.add('auth-locked');showAuthMessage('Inicia sesión para jugar online.',true);return}
 const config=window.BLUE_RUSH_SUPABASE||{},url=String(config.url||'').trim(),key=String(config.publishableKey||config.key||'').trim();
 if(!url||!key){showLobbyMessage('Configura Supabase','Añade la URL del proyecto y la publishable key en supabase-config.js y vuelve a cargar la página.');status.textContent='FALTA CONFIGURAR SUPABASE';return}
 if(!window.supabase||typeof window.supabase.createClient!=='function'){showLobbyMessage('No se cargó Supabase','No se pudo cargar la librería online. Revisa tu conexión a internet y recarga la página.');status.textContent='SUPABASE NO DISPONIBLE';return}
 playerName=(playerNameInput.value||'').trim().slice(0,16)||'Sonic';playerNameInput.value=playerName;
 multiplayerRoom=String(roomCodeInput.value||'GREEN-ISLAND').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'GREEN-ISLAND';roomCodeInput.value=multiplayerRoom;
 onlineButton.disabled=true;startButton.disabled=true;onlineButton.textContent='CONECTANDO…';
 showLobbyMessage('Conectando online…','Conectando a Supabase Realtime para entrar en la sala '+multiplayerRoom+'.');status.textContent='CONECTANDO A SUPABASE…';
 try{
  leaveOnlineRoom();
  multiplayerRoom=String(roomCodeInput.value||'GREEN-ISLAND').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'GREEN-ISLAND';
  multiplayerClient=window.supabase.createClient(url,key,{realtime:{params:{eventsPerSecond:10}}});const client=multiplayerClient;
  const roomChannel=client.channel('blue-rush:'+multiplayerRoom.toLowerCase(),{config:{broadcast:{self:false},presence:{key:multiplayerId},private:false}});
  roomChannel.on('broadcast',{event:'player-finished'},({payload})=>{
    if(!payload||payload.id===multiplayerId||raceFinished)return;
    const name=String(payload.name||'El rival').replace(/[<>]/g,'').slice(0,16)||'El rival';
    recordRun('loss');raceFinished=true;raceWinner=name;levelCompleted=true;running=false;
    startScreen.querySelector('h2').textContent='🏁 ¡'+name+' ganó la carrera!';
    startScreen.querySelector('p:not(.start-kicker)').textContent='Tu rival llegó primero a la meta. ¡Vuelve a correr para intentar ganar!';
    startButton.textContent='CORRER OTRA VEZ';startScreen.classList.remove('hidden');
    status.textContent='CARRERA TERMINADA · GANADOR: '+name;
   });
   roomChannel.on('broadcast',{event:'enemy-destroyed'},({payload})=>{
    if(!payload||payload.by===multiplayerId)return;
    const enemyId=String(payload.enemyId||'');
    if(markEnemyDestroyed(enemyId,payload.x,payload.y,payload.kind,true))trackOnlineEnemyPresence();
   });
   roomChannel.on('broadcast',{event:'player-punched'},({payload})=>{
    if(!payload||payload.by===multiplayerId)return;
    const targetId=String(payload.targetId||''),direction=Number(payload.direction)<0?-1:1;
    const remoteTarget=remotePlayers.get(targetId);
    if(remoteTarget)remoteTarget.hitFlashUntil=performance.now()+420;
    if(targetId!==multiplayerId||!running||!player)return;
    const stage=Math.max(1,Math.min(3,Math.floor(Number(payload.stage)||1)));
    player.hitSlowFactor=stage===3?.2:.28;
    player.hitSlowTimer=Math.max(player.hitSlowTimer||0,stage===3?1.8:1.55);
    player.speedCharge=0;
    player.spin=0;player.spinAttack=false;player.rolling=false;player.spinDashRolling=false;player.spinDashCharging=false;
    player.peelOutCharging=false;player.peelOutBurst=0;player.homingActive=false;player.homingTargetId=null;
    const limit=player.speed*player.hitSlowFactor;
    player.vx=Math.max(-limit,Math.min(limit,player.vx*.12+direction*110));
    status.textContent='¡TE GOLPEARON! · VELOCIDAD AL '+Math.round(player.hitSlowFactor*100)+'%';
   });
   roomChannel.on('broadcast',{event:'player-state'},({payload})=>{
   if(!payload||payload.id===multiplayerId)return;const x=Number(payload.x),y=Number(payload.y);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x< -200||x>worldWidth+200||y< -1000||y>5000)return;
   const id=String(payload.id||'');if(!id||id.length>100)return;let other=remotePlayers.get(id);
   if(!other){other={id,x,targetX:x,y,targetY:y,facing:1,name:'Jugador',characterId:'sonic',animation:'idle',phase:0,lastSeen:performance.now(),spinAngle:0,progress:0};remotePlayers.set(id,other)}else{other.targetX=x;other.targetY=y}
   other.name=String(payload.name||'Jugador').replace(/[<>]/g,'').slice(0,16)||'Jugador';other.characterId=normalizeCharacterId(payload.characterId);other.progress=Math.max(0,Math.min(100,Number(payload.progress)||0));other.facing=Number(payload.facing)<0?-1:1;
   const animations=['idle','run','dash','speeddash','jump','spin','spindash','fall','fly','swim','tired','tailsAttack','knucklesGlide','knucklesPunch','knucklesMaxSpeed','peeloutCharge','peeloutLoop','peeloutBurst'];other.animation=animations.includes(payload.animation)?payload.animation:'idle';
   other.phase=Number.isFinite(Number(payload.phase))?Number(payload.phase):0;other.spinAngle=Number.isFinite(Number(payload.spinAngle))?Number(payload.spinAngle):0;other.lastSeen=performance.now();
  });
  roomChannel.on('presence',{event:'sync'},()=>{
   const presence=roomChannel.presenceState(),seen=new Set();
   let mergedEnemyState=false;
   for(const entries of Object.values(presence))for(const person of entries||[]){
    if(!person||!person.id||person.id===multiplayerId)continue;
    if(Array.isArray(person.destroyedEnemies))for(const enemyId of person.destroyedEnemies){if(markEnemyDestroyed(enemyId,NaN,NaN,NaN,true))mergedEnemyState=true;}
    const id=String(person.id);seen.add(id);let other=remotePlayers.get(id);
    if(!other){const x=Number.isFinite(Number(person.x))?Number(person.x):90,y=Number.isFinite(Number(person.y))?Number(person.y):terrainHeight(x)-43;other={id,x,targetX:x,y,targetY:y,facing:1,name:'Jugador',characterId:normalizeCharacterId(person.characterId),animation:'idle',phase:0,lastSeen:performance.now(),spinAngle:0};remotePlayers.set(id,other)}
    if(person.name)other.name=String(person.name).replace(/[<>]/g,'').slice(0,16)||'Jugador';
    other.characterId=normalizeCharacterId(person.characterId);
   }
   for(const id of remotePlayers.keys())if(!seen.has(id))remotePlayers.delete(id);
   if(mergedEnemyState)trackOnlineEnemyPresence();
   if(onlineMode)status.textContent='ONLINE · SALA '+multiplayerRoom+' · '+(remotePlayers.size+1)+' JUGADOR(ES)';
  });
  multiplayerChannel=roomChannel;
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Se agotó el tiempo de conexión.')),12000);roomChannel.subscribe(state=>{if(state==='SUBSCRIBED'){clearTimeout(timeout);resolve()}else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){clearTimeout(timeout);reject(new Error('Supabase respondió: '+state))}})});
  await roomChannel.track({id:multiplayerId,name:playerName,characterId:selectedCharacterId,x:player.x,y:player.y,at:Date.now(),destroyedEnemies:Array.from(destroyedEnemyIds)});
  onlineMode=true;trackOnlineEnemyPresence();lastNetworkSend=0;startGame();status.textContent='ONLINE · SALA '+multiplayerRoom+' · 1+ JUGADOR(ES)';
 }catch(error){
  console.error('[Blue Rush] Error de multijugador online:',error);onlineMode=false;const oldChannel=multiplayerChannel,oldClient=multiplayerClient;multiplayerChannel=null;multiplayerClient=null;remotePlayers.clear();
  if(oldChannel&&oldClient){try{await oldClient.removeChannel(oldChannel)}catch(_){}}
  showLobbyMessage('No se pudo conectar','Revisa la URL, la publishable key y que Realtime esté habilitado en Supabase. Detalle: '+String(error&&error.message||error).slice(0,100));status.textContent='ERROR DE CONEXIÓN ONLINE';
 }finally{onlineButton.disabled=false;startButton.disabled=false;onlineButton.innerHTML='JUGAR ONLINE <span aria-hidden="true">↗</span>'}
}
function leaveOnlineRoom(){
 onlineMode=false;remotePlayers.clear();destroyedEnemyIds.clear();enemyExplosions=[];enemies.forEach(enemy=>enemy.alive=true);const channel=multiplayerChannel,client=multiplayerClient;multiplayerChannel=null;multiplayerClient=null;multiplayerRoom='';
 if(player){player.knucklesPunchTimer=0;player.knucklesPunchCooldown=0;player.knucklesPunchInputAt=-1e9;}
 if(channel&&client)client.removeChannel(channel).catch(error=>console.warn('[Blue Rush] No se pudo cerrar la sala:',error));
}
function sendOnlineState(now){
 if(!onlineMode||!multiplayerChannel||now-lastNetworkSend<NETWORK_SEND_INTERVAL)return;lastNetworkSend=now;const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);let animation='idle',phase=0;
 if(running){
  if(selectedCharacterId==='knuckles'&&player.knucklesGliding)animation='knucklesGlide';
  else if(selectedCharacterId==='knuckles'&&player.knucklesPunchTimer>0)animation='knucklesPunch';
  else if(selectedCharacterId==='knuckles'&&player.onGround&&player.spinDashRolling&&(player.spinDashRollTime||0)>0&&Math.abs(player.vx)>=115)animation='spin';
  else if(selectedCharacterId==='knuckles'&&!player.onGround)animation=player.vy<0?'jump':'fall';
  else if(selectedCharacterId==='knuckles'&&Math.abs(player.vx)>=SONIC_MAX_SPEED_THRESHOLD)animation='knucklesMaxSpeed';
  else if(selectedCharacterId==='knuckles'&&Math.abs(player.vx)/Math.max(1,player.speed)>=.58)animation='dash';
  else if(selectedCharacterId==='knuckles'&&Math.abs(player.vx)>25)animation='run';
  else if(selectedCharacterId==='knuckles')animation='idle';
  else if(selectedCharacterId==='tails'&&player.tailsSwimming)animation='swim';
  else if(selectedCharacterId==='tails'&&player.tailsFlying)animation='fly';
  else if(selectedCharacterId==='tails'&&player.tailsTired&&!player.onGround)animation='tired';
  else if(selectedCharacterId==='tails'&&player.tailsAttackTimer>0)animation='tailsAttack';
  else if(selectedCharacterId==='tails'&&speedRatio>=.85)animation='speeddash';
  else if(player.peelOutCharging){
   if(player.peelOutAnimTime<.5){
    animation='peeloutCharge';phase=Math.min(1,player.peelOutAnimTime/.5);
   }else{
    animation='peeloutLoop';
    phase=(((player.peelOutAnimTime-.5)*30)/Math.max(1,sonicAnimations.peelOutLoop.length))%1;
   }
  }else if(player.peelOutBurst>0&&player.peelOutBurstTime<SUPER_PEELOUT_LAUNCH_ANIM_DURATION){
   animation='peeloutBurst';phase=Math.min(1,player.peelOutBurstTime/SUPER_PEELOUT_LAUNCH_ANIM_DURATION);
  }else if(player.spinDashCharging){
   animation='spindash';
   phase=getSpinDashChargeFrameIndex()/Math.max(1,sonicAnimations.spindash.length);
  }
  else if(player.spin||player.rolling||player.homingActive)animation='spin';
  else if(!player.onGround)animation=player.vy<0?'jump':'fall';
  else if(selectedCharacterId==='sonic'&&player.onGround&&!player.rolling&&Math.abs(player.vx)>=SONIC_MAX_SPEED_THRESHOLD)animation='speeddash'; 
  else if(speedRatio>=0.58)animation='dash';
  else if(speedRatio>=0.38)animation='dash';
  else if(Math.abs(player.vx)>25)animation='run';
 }
 if(animation==='spindash'){
  phase=getSpinDashChargeFrameIndex()/Math.max(1,sonicAnimations.spindash.length);
 }else if(!animation.startsWith('peelout')&&selectedCharacterId==='tails'){
  if(animation==='idle')phase=elapsed;
  else if(animation==='fly')phase=player.tailsFlightTime||0;
  else if(animation==='tailsAttack')phase=Math.max(0,.34-(player.tailsAttackTimer||0));
  else if(animation==='spin')phase=player.spinPhase;
  else if(animation==='fall'||animation==='jump'||animation==='swim'||animation==='tired')phase=player.fallPhase;
  else phase=player.runPhase;
 }else if(!animation.startsWith('peelout')&&selectedCharacterId==='knuckles'){
  if(animation==='knucklesPunch'){const duration=player.knucklesPunchStage===3?.4:.25;phase=1-Math.max(0,player.knucklesPunchTimer)/duration;}
  else phase=elapsed;
 }else if(!animation.startsWith('peelout')){
  phase=animation==='spin'||animation==='tailsAttack'?player.spinPhase:
   (animation==='fall'||animation==='jump'||animation==='fly'||animation==='swim'||animation==='tired'?player.fallPhase:player.runPhase);
  if(animation==='speeddash')phase=(elapsed*10/Math.max(1,sonicAnimations.speeddash.length))%1;
 }
 const payload={id:multiplayerId,name:playerName,characterId:selectedCharacterId,x:Math.round(player.x*10)/10,y:Math.round(player.y*10)/10,vx:Math.round(player.vx*10)/10,vy:Math.round(player.vy*10)/10,facing:player.facing,animation,phase,spinAngle:player.spinAngle||0,progress:Math.round(player.x/(worldWidth-player.w-90)*1000)/10,playing:running,sentAt:Date.now()};
 const channel=multiplayerChannel;channel.send({type:'broadcast',event:'player-state',payload}).then(result=>{if(result==='error')console.warn('[Blue Rush] Supabase no pudo enviar la posición del jugador.')}).catch(error=>console.warn('[Blue Rush] Error al enviar posición:',error));
}

function drawVectorCharacter(characterId,screenX,screenY,options={}){
 const id=normalizeCharacterId(characterId),phase=Number(options.phase)||0;
 const moving=Boolean(options.moving),rolling=Boolean(options.rolling),falling=Boolean(options.falling);
 const gliding=Boolean(options.gliding),climbing=Boolean(options.climbing),punching=Boolean(options.punching);
 const footSwing=moving?Math.sin(phase*6)*5:0;
 g.save();g.translate(Math.round(screenX),Math.round(screenY));
 if(rolling)g.rotate(Number(options.spinAngle)||phase*7);else{if(falling)g.rotate(-.16);if(Number(options.facing)<0)g.scale(-1,1)}
 const ellipse=(x,y,rx,ry,fill,stroke='#17314f',line=1.8)=>{g.fillStyle=fill;g.strokeStyle=stroke;g.lineWidth=line;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();if(stroke)g.stroke()};
 const poly=(pts,fill,stroke='#17314f',line=1.8)=>{g.fillStyle=fill;g.strokeStyle=stroke;g.lineWidth=line;g.lineJoin='round';g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fill();if(stroke)g.stroke()};
 ellipse(0,25,19,4,'rgba(8,38,69,.24)',null,0);
 if(id==='tails'){
  poly([[-8,8],[-31,-12],[-21,0],[-5,10]],'#f28b28','#9d4b20',2);poly([[-7,12],[-31,8],[-20,2],[-5,8]],'#f28b28','#9d4b20',2);
  poly([[-30,-12],[-34,-17],[-24,-15]],'#fff4df','#c1d1db',1);poly([[-31,8],[-35,4],[-25,7]],'#fff4df','#c1d1db',1);
  poly([[-12,-19],[-16,-32],[-3,-24],[2,-30],[8,-17]],'#f28b28','#9d4b20',2);poly([[3,-21],[5,-33],[15,-24],[18,-14]],'#f28b28','#9d4b20',2);
  ellipse(0,2,13,17,'#f28b28','#9d4b20',2);ellipse(5,-8,13,13,'#f28b28','#9d4b20',2);ellipse(9,-3,8,6,'#fff0d9','#b46a36',1.2);ellipse(10,-13,3.1,6,'#fff','#587b9a',.8);ellipse(11,-12,1.5,3,'#164577',null,0);
  poly([[7,1],[13,5],[10,13],[4,10]],'#fff0d9','#b46a36',1);ellipse(-8,24+footSwing*.18,9,4,'#e53b3e','#81252e',1.5);ellipse(8,24-footSwing*.18,9,4,'#e53b3e','#81252e',1.5);
  g.fillStyle='#fff';g.fillRect(-13,23+footSwing*.18,8,2);g.fillRect(3,23-footSwing*.18,8,2);
 }else if(id==='knuckles'){
  poly([[-5,-11],[-20,-18],[-14,-7],[-27,-4],[-14,1],[-23,10],[-8,8]],'#d72d32','#76222d',2);poly([[-10,-18],[-18,-27],[-4,-23],[4,-29],[8,-17]],'#e93438','#76222d',2);
  ellipse(0,2,13,18,'#e93438','#76222d',2);ellipse(6,-9,14,13,'#ed4141','#76222d',2);ellipse(11,-4,8,6,'#f4d4b5','#8b5e4c',1);ellipse(11,-13,3.2,6,'#fff','#647e91',.8);ellipse(12,-12,1.6,3,'#16864c',null,0);ellipse(-3,14,8,7,'#f4d4b5','#8b5e4c',1);
  const leftArmSwing=moving?footSwing*.7:0,rightArmSwing=-leftArmSwing;
  g.strokeStyle='#76222d';g.lineWidth=5;g.lineCap='round';g.beginPath();
  g.moveTo(-9,-1);g.lineTo(-15,5+leftArmSwing);
  g.moveTo(9,-1);g.lineTo(15,5+rightArmSwing);g.stroke();
  ellipse(-17,7+leftArmSwing,7,8,'#fff','#7c8fa0',1.1);
  poly([[-20,1+leftArmSwing],[-26,-5+leftArmSwing],[-23,4+leftArmSwing],[-29,8+leftArmSwing],[-20,9+leftArmSwing]],'#fff','#7c8fa0',1);
  ellipse(19,8+rightArmSwing,7,8,'#fff','#7c8fa0',1.1);
  poly([[20,1+rightArmSwing],[27,-5+rightArmSwing],[24,5+rightArmSwing],[30,8+rightArmSwing],[20,10+rightArmSwing]],'#fff','#7c8fa0',1);
  poly([[-12,24+footSwing*.18],[-4,22+footSwing*.18],[5,25+footSwing*.18],[9,29+footSwing*.18],[-13,29+footSwing*.18]],'#d52d35','#79232a',1.5);poly([[4,23-footSwing*.18],[14,22-footSwing*.18],[22,26-footSwing*.18],[20,30-footSwing*.18],[2,29-footSwing*.18]],'#d52d35','#79232a',1.5);
  g.fillStyle='#f5d76c';g.fillRect(-4,25+footSwing*.18,7,2);g.fillRect(12,25-footSwing*.18,6,2);
 }else if(id==='amy'){
  poly([[-7,-15],[-21,-23],[-14,-9],[-25,-3],[-12,1],[-21,10],[-6,8]],'#f27cae','#9b3d76',2);poly([[-9,-19],[-15,-30],[-2,-23],[5,-31],[9,-16]],'#ff91bd','#9b3d76',2);
  ellipse(0,1,13,17,'#f58ab8','#9b3d76',2);ellipse(6,-9,14,13,'#ff9bc4','#9b3d76',2);ellipse(10,-4,8,6,'#ffe0d4','#b66b82',1);ellipse(10,-13,3.2,6,'#fff','#647e91',.8);ellipse(11,-12,1.5,3,'#248a65',null,0);ellipse(-2,13,7,7,'#ffe0d4','#b66b82',1);
  poly([[-12,7],[11,7],[17,22],[0,26],[-16,22]],'#e83a52','#8f243d',2);g.fillStyle='#ffd9e3';g.fillRect(-8,14,15,2);ellipse(-17,7,6,7,'#fff','#a1b3c0',1);ellipse(18,7,6,7,'#fff','#a1b3c0',1);
  ellipse(-8,26+footSwing*.18,8,4,'#d92d4c','#81243a',1.2);ellipse(9,26-footSwing*.18,8,4,'#d92d4c','#81243a',1.2);g.fillStyle='#ffe78d';g.fillRect(-11,23+footSwing*.18,5,2);g.fillRect(6,23-footSwing*.18,5,2);g.strokeStyle='#ffe37b';g.lineWidth=2;g.beginPath();g.arc(4,-19,9,Math.PI,Math.PI*2);g.stroke();
 }else{
  poly([[-6,-12],[-22,-20],[-14,-9],[-28,-4],[-14,2],[-24,11],[-7,9]],'#171e2b','#080d18',2);poly([[-15,-19],[-19,-30],[-5,-24],[1,-32],[8,-17]],'#202938','#090f1b',2);poly([[-16,-18],[-21,-24],[-12,-22]],'#e53849',null,0);poly([[-8,-25],[-2,-31],[2,-24]],'#e53849',null,0);
  ellipse(0,2,13,18,'#202938','#080f18',2);ellipse(6,-9,14,13,'#2a3442','#080f18',2);ellipse(10,-4,8,6,'#e7d3bd','#6e5b54',1);ellipse(10,-13,3.2,6,'#fff','#647e91',.8);ellipse(11,-12,1.5,3,'#d83243',null,0);
  poly([[-5,8],[3,10],[8,20],[0,15],[-6,19],[-10,12]],'#f4f0e8','#9099a1',1);ellipse(-17,7,6,7,'#fff','#9caab5',1);ellipse(18,7,6,7,'#fff','#9caab5',1);
  ellipse(-8,26+footSwing*.18,10,4,'#d83243','#641d31',1.5);ellipse(9,26-footSwing*.18,10,4,'#d83243','#641d31',1.5);g.fillStyle='#f7d56e';g.fillRect(-14,23+footSwing*.18,7,2);g.fillRect(3,23-footSwing*.18,7,2);
  g.strokeStyle='#f1c84e';g.lineWidth=2;g.beginPath();g.ellipse(-18,7,4,6,0,0,Math.PI*2);g.stroke();g.beginPath();g.ellipse(19,8,4,6,0,0,Math.PI*2);g.stroke();
 }
 if(id==='knuckles'&&gliding){g.strokeStyle='#fff';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(7,-2);g.lineTo(28,-8);g.moveTo(-7,1);g.lineTo(-28,-5);g.stroke();ellipse(30,-9,10,7,'#fff','#aebbc8',1);ellipse(-30,-6,10,7,'#fff','#aebbc8',1);}
 if(id==='knuckles'&&climbing){g.strokeStyle='#fff';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(-5,-11);g.lineTo(17,-29);g.moveTo(7,-3);g.lineTo(23,-21);g.stroke();ellipse(18,-30,8,6,'#fff','#aebbc8',1);ellipse(24,-22,8,6,'#fff','#aebbc8',1);}
 if(id==='knuckles'&&punching){g.strokeStyle='#d72d32';g.lineWidth=8;g.lineCap='round';g.beginPath();g.moveTo(10,-2);g.lineTo(29,-2);g.stroke();ellipse(34,-2,10,8,'#fff','#aebbc8',1);g.strokeStyle='#ffe68a';g.lineWidth=2;g.beginPath();g.moveTo(40,-13);g.lineTo(49,-18);g.moveTo(42,-2);g.lineTo(54,-2);g.stroke();}
 if(rolling){g.strokeStyle=id==='tails'?'#fff0d9':id==='knuckles'?'#ffbbbb':id==='amy'?'#ffd2e7':'#ff6575';g.lineWidth=3;g.beginPath();g.arc(0,0,25,.2,Math.PI*1.7);g.stroke()}
 g.restore();
}

function drawRemotePlayers(){
 if(!onlineMode)return;const now=performance.now();
 for(const [id,other] of remotePlayers){
  if(now-other.lastSeen>9000){remotePlayers.delete(id);continue}
  other.x+=(other.targetX-other.x)*0.32;other.y+=(other.targetY-other.y)*0.32;
  const animation=other.animation||'idle',sx=other.x-camera+player.w/2,sy=other.y+player.h/2;
  if(other.characterId==='tails'){
   drawTailsCharacter(Math.round(sx),Math.round(sy),{facing:other.facing,animation,phase:other.phase,spinAngle:other.spinAngle});
  }else if(other.characterId==='knuckles'){
   const kAnimation=animation==='knucklesGlide'?'glide':animation==='knucklesPunch'?'punch':animation==='knucklesMaxSpeed'?'maxSpeed':animation==='spin'||animation==='spindash'?'spin':animation==='dash'?'dash':animation==='run'||animation==='speeddash'?'run':animation==='jump'?'jump':animation==='fall'?'fall':'idle';
   drawKnucklesCharacter(Math.round(sx),Math.round(sy),{facing:other.facing,animation:kAnimation,phase:other.phase,spinAngle:other.spinAngle,anchorOffsetY:player.h/2});
  }else if(other.characterId&&other.characterId!=='sonic'){
   drawVectorCharacter(other.characterId,Math.round(sx),Math.round(sy),{facing:other.facing,moving:['run','dash','speeddash'].includes(animation),rolling:['spin','spindash'].includes(animation),falling:['fall','jump'].includes(animation),phase:other.phase,spinAngle:other.spinAngle});
  }else{
   const frames=sonicAnimations[animation]&&sonicAnimations[animation].length?sonicAnimations[animation]:sonicAnimations.idle;
   if(frames&&frames.length){
    let frameIndex;
    if(animation==='peeloutCharge'||animation==='peeloutBurst'){
     frameIndex=Math.min(frames.length-1,Math.floor(Math.max(0,other.phase)*frames.length));
    }else if(animation==='peeloutLoop'){
     frameIndex=Math.floor(Math.max(0,other.phase)*frames.length)%frames.length;
    }else{
     frameIndex=Math.floor(Math.max(0,other.phase)*frames.length)%frames.length;
    }
    const frame=frames[frameIndex];
    if(frame&&frame.img&&frame.img.naturalWidth){
     const img=frame.img,b=frame.bounds||{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
     const rolling=animation==='spin';
     const falling=animation==='fall'||animation==='jump';
     const cell=frame.cell||{width:img.naturalWidth/SONIC_ATLAS_COLUMNS,height:img.naturalHeight/SONIC_ATLAS_ROWS};
     const scale=Math.min(88/Math.max(1,cell.width),86/Math.max(1,cell.height)),dw=b.width*scale,dh=b.height*scale;
     g.save();g.translate(Math.round(sx),Math.round(sy));
     if(rolling)g.rotate(other.spinAngle||0);else if(other.facing<0)g.scale(-1,1);
     g.imageSmoothingEnabled=false;g.drawImage(img,b.x,b.y,b.width,b.height,-dw/2,(rolling||falling)?-dh/2:player.h/2-dh-1,dw,dh);g.restore();
    }
   }
  }
  if(other.hitFlashUntil>now){g.save();g.strokeStyle='#fff09a';g.lineWidth=3;g.globalAlpha=.9;g.beginPath();g.arc(Math.round(sx),Math.round(sy),29,0,Math.PI*2);g.stroke();g.restore();}
  g.save();g.font='900 12px Arial, sans-serif';g.textAlign='center';g.textBaseline='bottom';g.lineJoin='round';g.lineWidth=3;g.strokeStyle='#082b53';g.strokeText(other.name,Math.round(sx),Math.round(other.y-7));g.fillStyle='#fff3a2';g.fillText(other.name,Math.round(sx),Math.round(other.y-7));g.restore();
 }
}
function resetGame(){
 leaveOnlineRoom();running=false;keys.left=keys.right=keys.jump=keys.down=keys.spindash=keys.peelout=keys.homing=false;keys.up=false;resetPlayer();startScreen.querySelector('h2').textContent='¡Vamos, '+CHARACTER_DATA[selectedCharacterId].name+'!';startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';
 startButton.textContent='JUGAR SOLO';onlineButton.disabled=false;startButton.disabled=false;startScreen.classList.remove('hidden');status.textContent='PULSA JUGAR PARA EMPEZAR';draw();
}
function finishRunAfterDeath(){
 running=false;
 keys.left=keys.right=keys.jump=false;
 if(onlineMode){
  // En online Sonic vuelve al inicio del nivel, pero sigue en la misma sala.
  resetPlayer();
  running=true;
  lastTime=performance.now();
  startScreen.classList.add('hidden');
  status.textContent='ONLINE · '+multiplayerRoom+' · VOLVISTE AL INICIO';
  return;
 }
 recordRun('gameover');
 resetPlayer();
 startScreen.querySelector('h2').textContent='GAME OVER';
 startScreen.querySelector('p:not(.start-kicker)').textContent='Sonic recibió daño sin anillos. Pulsa VOLVER A JUGAR para intentarlo de nuevo.';
 startButton.textContent='VOLVER A JUGAR';
 onlineButton.disabled=false;
 startButton.disabled=false;
 startScreen.classList.remove('hidden');
 status.textContent='GAME OVER · SIN ANILLOS';
 draw();
}
function applyPlayerDamage(){
 if(player.invincible>0)return;
 player.spinDashCharging=false;player.spinDashCharge=0;player.spinDashRolling=false;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;player.tailsFlying=false;player.tailsTired=false;player.tailsSwimming=false;player.tailsFlightTime=0;player.tailsAttackTimer=0;player.peelOutCharging=false;player.peelOutCharge=0;player.peelOutAnimTime=0;player.peelOutBurst=0;player.peelOutBurstTime=0;player.peelOutSpeedFade=0;player.speed=900;
 const hasRings=rings.some(r=>r.got);
 if(!hasRings){
  finishRunAfterDeath();
  return;
 }
 const ownedRings=rings.filter(r=>r.got);
 // Se pierde aproximadamente el 80 % del inventario (redondeado a anillos enteros).
 const dropCount=Math.min(ownedRings.length,Math.max(1,Math.round(ownedRings.length*.8)));
 ownedRings.slice(0,dropCount).forEach((r,index)=>{
  const side=index%2===0?-1:1;
  r.got=false;
  // Los anillos salen desde Sonic hacia ambos lados y con un impulso hacia arriba.
  r.x=player.x+player.w/2+side*(8+Math.floor(index/2)*8);
  const dropFloor=inUnderground?undergroundPathY(r.x):groundSurfaceAt(r.x);
  r.y=Math.min(player.y+player.h/2-8,dropFloor-RING_VERTICAL_RADIUS);
  r.underground=inUnderground;
  r.vx=side*(150+Math.random()*250)+player.vx*.12;
  r.vy=-(260+Math.random()*300);
  r.bouncing=true;
  r.bounceCount=0;
  // Evita recogerlos otra vez inmediatamente.
  r.dropSafeUntil=elapsed+0.85;
 });
 player.invincible=1.5;
 player.speedCharge=0;
 player.vy=-300;
 player.onGround=false;
 player.vx=-player.facing*180;
}
function startKnucklesGlide(){
 if(selectedCharacterId!=='knuckles'||player.onGround||player.knucklesGliding||!player.knucklesJumpTapPending)return false;
 // El planeo cancela cualquier animación de ataque anterior.
 player.knucklesPunchTimer=0;player.knucklesPunchStage=0;player.knucklesPunchComboAge=0;
 // El planeo es un estado aéreo independiente: nunca puede conservar poses de bola.
 player.knucklesGliding=true;player.knucklesJumpTapPending=false;player.onGround=false;
 player.spinDashRolling=false;player.spinDashRollTime=0;
 player.spinDashCharging=false;player.spinDashCharge=0;player.spinDashAnimTime=0;
 player.spin=0;player.spinAngle=0;player.spinAttack=false;player.rolling=false;
 status.textContent='KNUCKLES · PLANEANDO · ←/→ PARA DIRIGIR';
 return true;
}
function jump(){
 if(!running)startGame();if(inUnderground)return;
 if(selectedCharacterId==='tails'){
  if(player.tailsSwimming){if(player.tailsSwimStrokeCooldown<=0){player.vy=-410;player.tailsSwimStrokeCooldown=.2;}return;}
  if(player.onGround){
   player.vy=-player.jump;player.onGround=false;player.platformId=null;
   player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;
   player.tailsFlying=false;player.tailsTired=false;player.tailsFlightTime=0;
   return;
  }
  if(!player.tailsTired){
   player.tailsFlying=true;
   player.spin=0;player.spinAngle=0;player.spinAttack=false;
  }
  return;
 }
 if(player.onGround){
  player.vy=-player.jump*(selectedCharacterId==='knuckles'?0.86:1);
  player.onGround=false;player.platformId=null;
  player.spin=selectedCharacterId==='knuckles'?0:1;player.spinAngle=0;player.rolling=false;
  player.spinAttack=selectedCharacterId==='sonic';player.homingActive=false;
  player.knucklesGliding=false;
  if(selectedCharacterId==='knuckles'){
   player.spinDashRolling=false;player.spinDashRollTime=0;player.spinDashCharging=false;player.spinDashCharge=0;
   player.knucklesJumpTapPending=true;
  }
  return;
 }
 if(selectedCharacterId==='knuckles')startKnucklesGlide();
}

function beginSpinDash(){
 if(!running||inUnderground||!player||!player.onGround||player.platformId!==null||player.spinDashCharging||player.peelOutCharging||player.homingActive)return;
 player.spinDashCharging=true;player.spinDashCharge=0;player.spinDashAnimTime=0;player.spinDashRolling=false;
 player.vx=0;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0;
}
function getSpinDashChargeFrameIndex(){
 const t=player.spinDashAnimTime||0,charge=player.spinDashCharge||0;
 if(t<.1)return 0;                         // Crouch: 35
 if(t<.22)return 1+Math.min(1,Math.floor((t-.1)/.06)); // Revcharge: 57,58
 if(charge<.76)return 3+Math.floor(t*12)%3; // Revup: 40,41,42
 return 6+Math.floor(t*10)%3;               // Revdown: 54,55,56
}
function releaseSpinDash(){
 if(!player||!player.spinDashCharging)return;
 const charge=Math.max(.12,Math.min(1,player.spinDashCharge||0));
 const direction=keys.left&&!keys.right?-1:(keys.right&&!keys.left?1:(player.facing||1));
 player.spinDashCharging=false;player.spinDashCharge=0;player.spinDashRolling=true;
 player.spinDashRollTime=2.4+charge*2.4;player.facing=direction;
 player.vx=direction*(420+450*charge);player.vy=0;player.onGround=true;
 player.platformId=null;player.spin=1;player.spinAngle=0;
 player.speedCharge=Math.max(player.speedCharge,.25+.75*charge);
}

function beginSuperPeelOut(){
 if(!running)startGame();
 if(!running||selectedCharacterId!=='sonic'||inUnderground||!player.onGround||
    player.platformId!==null||player.spinDashCharging||player.spinDashRolling||player.peelOutCharging||player.homingActive||
    Math.abs(player.vx)>260)return;
 player.peelOutCharging=true;player.peelOutCharge=0;player.peelOutAnimTime=0;player.rolling=false;
 player.spinDashRolling=false;player.vx=0;player.vy=0;player.spin=0;player.spinAngle=0;
}
function releaseSuperPeelOut(){
 if(!player||!player.peelOutCharging)return;
 const charge=Math.max(.12,Math.min(1,player.peelOutCharge||0));
 const direction=player.facing||1;
 player.peelOutCharging=false;player.peelOutCharge=0;
 player.peelOutBurst=SUPER_PEELOUT_BURST_DURATION;player.peelOutBurstTime=0;player.peelOutSpeedFade=1.35;
 player.speed=2250;player.speedCharge=1;player.facing=direction;
 player.vx=direction*(1450+800*charge);player.vy=0;player.onGround=true;
 player.platformId=null;player.spin=0;player.rolling=false;player.spinAngle=0;
}
function homingAttack(){
 if(!running)startGame();
 if(!running||selectedCharacterId!=='sonic'||inUnderground||player.onGround||
    player.homingActive||player.spinDashCharging||player.peelOutCharging)return false;
 const cx=player.x+player.w/2,cy=player.y+player.h/2;
 const candidates=enemies.filter(enemy=>{
  if(!enemy.alive)return false;
  const dx=enemy.x-cx,dy=(enemy.y-8)-cy,distance=Math.hypot(dx,dy);
  return dx*(player.facing||1)>=-55&&Math.abs(dy)<=285&&distance<=455;
 }).map(enemy=>({enemy,distance:Math.hypot(enemy.x-cx,(enemy.y-8)-cy)}))
   .sort((a,b)=>a.distance-b.distance);
 if(!candidates.length){
  status.textContent='HOMING ATTACK · NO HAY ENEMIGO CERCA';
  return false;
 }
 const target=candidates[0].enemy,dx=target.x-cx,dy=(target.y-8)-cy,distance=Math.max(1,Math.hypot(dx,dy));
 player.homingActive=true;player.homingTargetId=target.id;
 player.homingTimer=Math.max(.38,Math.min(.82,distance/980+.24));
 player.spinAttack=false;player.rolling=false;player.onGround=false;player.platformId=null;
 player.spin=1;player.spinAngle=0;player.facing=dx<0?-1:1;
 player.vx=dx/distance*980;player.vy=dy/distance*980;
 return true;
}

function tailsAttack(){
 if(!running)startGame();
 if(!running||selectedCharacterId!=='tails'||player.tailsSwimming||(player.tailsAttackCooldown||0)>0)return false;
 player.tailsAttackTimer=.34;player.tailsAttackCooldown=.48;player.spinAttack=false;player.rolling=false;player.homingActive=false;player.homingTargetId=null;status.textContent='ATAQUE DE COLAS';return true;
}
function knucklesPunch(inputSource){
 // Solo entradas reales del teclado o del botón táctil pueden solicitar el golpe.
 if(inputSource!=='keyboard'&&inputSource!=='touch')return false;
 if(!running||selectedCharacterId!=='knuckles'||(player.knucklesPunchCooldown||0)>0)return false;
 const inputNow=performance.now();
 if(inputNow-(player.knucklesPunchInputAt||-1e9)<240)return false;
 const now=elapsed,stage=now-(player.knucklesPunchComboAge||0)<.72?((player.knucklesPunchStage||0)%3)+1:1;
 const facing=player.facing||1;
 // La animación siempre se muestra al pulsar ataque, incluso al practicar en solitario
 // o cuando no hay un rival dentro del alcance.
 player.knucklesPunchInputAt=inputNow;player.knucklesPunchStage=stage;player.knucklesPunchComboAge=now;
 player.knucklesPunchTimer=.35;player.knucklesPunchCooldown=.2;
 player.knucklesGliding=false;player.knucklesJumpTapPending=false;
 player.spinDashCharging=false;player.spinDashCharge=0;
 player.spinDashRolling=false;player.spinDashRollTime=0;
 player.rolling=false;player.spin=0;player.spinAngle=0;player.spinAttack=false;
 if(!onlineMode||!multiplayerChannel){
  status.textContent='KNUCKLES · ¡PUÑETAZO!';
  return true;
 }
 const reach=stage===3?166:132,centerX=player.x+player.w/2,centerY=player.y+player.h/2;
 const target=[...remotePlayers.values()]
  .filter(other=>performance.now()-(other.lastSeen||0)<1800)
  .map(other=>({other,dx:(Number(other.targetX??other.x)+player.w/2-centerX)*facing,dy:Math.abs(Number(other.targetY??other.y)+player.h/2-centerY)}))
  .filter(item=>item.dx>=-12&&item.dx<=reach+28&&item.dy<86)
  .sort((a,b)=>a.dx-b.dx)[0];
 if(!target){
  status.textContent='PUÑETAZO · ACÉRCATE A TU RIVAL PARA GOLPEARLO';
  return true;
 }
 const payload={by:multiplayerId,targetId:target.other.id,stage,direction:facing,at:Date.now(),slowDuration:stage===3?1.8:1.55,slowFactor:stage===3?.2:.28};
 multiplayerChannel.send({type:'broadcast',event:'player-punched',payload})
  .catch(error=>console.warn('[Blue Rush] No se pudo sincronizar el golpe al rival:',error));
 target.other.hitFlashUntil=performance.now()+420;
 status.textContent='¡GOLPEASTE A '+String(target.other.name||'TU RIVAL').toUpperCase()+'! · PIERDE VELOCIDAD';
 return true;
}
function activateCharacterAttack(inputSource){return selectedCharacterId==='tails'?tailsAttack():selectedCharacterId==='knuckles'?knucklesPunch(inputSource):homingAttack()}

const CONTROL_BINDINGS_STORAGE_KEY='blueRushControlBindingsV1';
const DEFAULT_CONTROL_BINDINGS={left:'ArrowLeft',right:'ArrowRight',down:'ArrowDown',jump:'Space',spindash:'KeyX',peelout:'KeyC',homing:'KeyZ'};
const CONTROL_LABELS={left:'Izquierda',right:'Derecha',down:'Rodar',jump:'Saltar / Spin Attack',spindash:'Spin Dash',peelout:'Super Peel-Out',homing:'Homing Attack'};
let controlBindings={...DEFAULT_CONTROL_BINDINGS};
let listeningForControl=null;
function isUsableControlCode(code){
 if(!code||['Escape','Tab','Enter','Backspace','Delete','CapsLock','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code))return false;
 if(/^F(?:[1-9]|1[0-2])$/.test(code))return false;
 return true;
}
function loadControlBindings(){
 try{
  const saved=JSON.parse(localStorage.getItem(CONTROL_BINDINGS_STORAGE_KEY)||'null');
  if(saved&&typeof saved==='object'){
   const used=new Set();
   for(const action of Object.keys(DEFAULT_CONTROL_BINDINGS)){
    const code=String(saved[action]||'');
    // Shift ya no puede activar Spin Dash por accidente; los datos guardados
    // de versiones anteriores también se normalizan a la tecla X.
    if(action==='spindash'&&(code==='ShiftLeft'||code==='ShiftRight'))continue;
    if(isUsableControlCode(code)&&!used.has(code)){controlBindings[action]=code;used.add(code)}
   }
  }
 }catch(error){console.warn('[Blue Rush] No se pudieron cargar los controles:',error)}
}
function saveControlBindings(){
 try{localStorage.setItem(CONTROL_BINDINGS_STORAGE_KEY,JSON.stringify(controlBindings));return true}
 catch(error){console.warn('[Blue Rush] No se pudieron guardar los controles:',error);return false}
}
function displayControlCode(code){
 if(code==='Space')return 'ESPACIO';
 if(code==='ArrowLeft')return '←';
 if(code==='ArrowRight')return '→';
 if(code==='ArrowUp')return '↑';
 if(code==='ArrowDown')return '↓';
 if(code==='ShiftLeft'||code==='ShiftRight')return 'SHIFT';
 if(code==='ControlLeft'||code==='ControlRight')return 'CTRL';
 if(code==='AltLeft'||code==='AltRight')return 'ALT';
 if(code.startsWith('Key'))return code.slice(3).toUpperCase();
 if(code.startsWith('Digit'))return code.slice(5);
 if(code.startsWith('Numpad'))return 'NUM '+code.slice(6);
 if(code==='Comma')return ',';
 if(code==='Period')return '.';
 if(code==='Slash')return '/';
 if(code==='Semicolon')return ';';
 if(code==='Quote')return "'";
 if(code==='BracketLeft')return '[';
 if(code==='BracketRight')return ']';
 if(code==='Backslash')return '\\';
 if(code==='Minus')return '-';
 if(code==='Equal')return '=';
 return code.replace(/([A-Z])/g,' $1').toUpperCase();
}
function renderControlBindings(){
 document.querySelectorAll('[data-binding-label]').forEach(node=>{
  const action=node.dataset.bindingLabel;
  if(controlBindings[action])node.textContent=displayControlCode(controlBindings[action]);
 });
 document.querySelectorAll('[data-rebind]').forEach(button=>{
  const action=button.dataset.rebind;
  const waiting=listeningForControl===action;
  button.textContent=waiting?'PULSA UNA TECLA':'CAMBIAR';
  button.classList.toggle('is-listening',waiting);
 });
}
function setControlMessage(message,isError=false){
 if(!controlsCaptureMessage)return;
 controlsCaptureMessage.textContent=message;
 controlsCaptureMessage.classList.toggle('is-error',isError);
}
function stopGameInputForMenu(){
 keys.left=keys.right=keys.jump=keys.down=keys.spindash=keys.peelout=keys.homing=false;keys.up=false;
 if(player){
  if(player.spinDashCharging){player.spinDashCharging=false;player.spinDashCharge=0;player.spin=0}
  if(selectedCharacterId==='knuckles'){
   player.spinDashRolling=false;player.spinDashRollTime=0;player.spinDashCharging=false;player.spinDashCharge=0;player.spin=0;player.spinAngle=0;
  }
  if(player.peelOutCharging){player.peelOutCharging=false;player.peelOutCharge=0;player.spin=0}
 }
}
function openControlsPanel(){
 if(!controlsPanel||!controlsBackdrop)return;
 stopGameInputForMenu();
 listeningForControl=null;
 controlsPanel.classList.remove('hidden');
 controlsBackdrop.classList.remove('hidden');
 setControlMessage('Selecciona CAMBIAR y pulsa una tecla del teclado.');
 renderControlBindings();
 const firstButton=controlsPanel.querySelector('[data-rebind]');
 if(firstButton)firstButton.focus();
}
function closeControlsPanel(){
 if(!controlsPanel||!controlsBackdrop)return;
 listeningForControl=null;
 controlsPanel.classList.add('hidden');
 controlsBackdrop.classList.add('hidden');
 renderControlBindings();
 if(controlsButton)controlsButton.focus();
}
function beginControlCapture(action){
 if(!Object.prototype.hasOwnProperty.call(controlBindings,action))return;
 listeningForControl=action;
 setControlMessage('Esperando una tecla para '+CONTROL_LABELS[action]+'. Pulsa ESC para cancelar.');
 renderControlBindings();
 const button=controlsPanel.querySelector('[data-rebind="'+action+'"]');
 if(button)button.focus();
}
function captureControlKey(event){
 if(!listeningForControl)return false;
 event.preventDefault();event.stopImmediatePropagation();
 if(event.repeat)return true;
 if(event.code==='Escape'){
  const previous=listeningForControl;
  listeningForControl=null;
  setControlMessage('Cambio cancelado. Se conserva '+displayControlCode(controlBindings[previous])+'.');
  renderControlBindings();
  return true;
 }
 if(event.ctrlKey||event.altKey||event.metaKey||!isUsableControlCode(event.code)){
  setControlMessage('Esa tecla está reservada. Prueba con una letra, número, flecha o ESPACIO.',true);
  return true;
 }
 const conflict=Object.keys(controlBindings).find(action=>action!==listeningForControl&&controlBindings[action]===event.code);
 if(conflict){
  setControlMessage('Esa tecla ya está asignada a '+CONTROL_LABELS[conflict]+'. Elige otra.',true);
  return true;
 }
 const action=listeningForControl;
 controlBindings[action]=event.code;
 listeningForControl=null;
 const saved=saveControlBindings();
 setControlMessage(saved?'Control actualizado: '+CONTROL_LABELS[action]+' = '+displayControlCode(event.code)+'.':'Cambio aplicado, pero el navegador no permitió guardar la configuración.',!saved);
 renderControlBindings();
 return true;
}
loadControlBindings();
renderControlBindings();
controlsButton.addEventListener('click',openControlsPanel);
controlsBackdrop.addEventListener('click',closeControlsPanel);
document.getElementById('closeControlsButton').addEventListener('click',closeControlsPanel);
document.getElementById('doneControlsButton').addEventListener('click',closeControlsPanel);
document.getElementById('restoreControlsButton').addEventListener('click',()=>{
 controlBindings={...DEFAULT_CONTROL_BINDINGS};
 const saved=saveControlBindings();
 listeningForControl=null;
 renderControlBindings();
 setControlMessage(saved?'Se restauraron los controles originales.':'Controles restaurados, pero no se pudieron guardar.',!saved);
});
controlsPanel.querySelectorAll('[data-rebind]').forEach(button=>{
 button.addEventListener('click',()=>beginControlCapture(button.dataset.rebind));
});
const DEFAULT_CONTROL_ALIASES={left:['KeyA'],right:['KeyD'],down:['KeyS'],jump:['ArrowUp','KeyW']};
function resolveControlAction(code){
 const direct=Object.keys(controlBindings).find(action=>controlBindings[action]===code);
 if(direct)return direct;
 return Object.keys(DEFAULT_CONTROL_ALIASES).find(action=>
  controlBindings[action]===DEFAULT_CONTROL_BINDINGS[action]&&DEFAULT_CONTROL_ALIASES[action].includes(code)
 )||null;
}
function setKey(key,down,code=''){
 const pressedCode=code||key;
  const action=resolveControlAction(pressedCode);
 if(action==='left')keys.left=down;
 if(action==='right')keys.right=down;
 if(action==='down')keys.down=down;
 if(action==='spindash'){
  const wasHeld=keys.spindash;keys.spindash=down;
  if(down&&!wasHeld)beginSpinDash();
  if(!down&&wasHeld)releaseSpinDash();
 }
 if(action==='peelout'){
  const wasHeld=keys.peelout;keys.peelout=down;
  if(down&&!wasHeld)beginSuperPeelOut();
  if(!down&&wasHeld)releaseSuperPeelOut();
 }
 if(action==='homing'){
  const wasHeld=keys.homing;keys.homing=down;
  if(down&&!wasHeld)activateCharacterAttack('keyboard');
 }
 if(action==='jump'){
  const wasHeld=keys.jump;keys.jump=down;
  if(down&&!wasHeld)jump();
 }
 if(down&&pressedCode==='Enter'&&!running)startGame();
}
window.addEventListener('keydown',e=>{
 if(captureControlKey(e))return;
 if(e.repeat)return;
 if(!controlsPanel.classList.contains('hidden')){
  e.preventDefault();
  if(e.code==='Escape')closeControlsPanel();
  return;
 }
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();
 setKey(e.key,true,e.code);
},true);
window.addEventListener('keyup',e=>{
 if(!controlsPanel.classList.contains('hidden')){e.preventDefault();return}
 setKey(e.key,false,e.code);
});
window.addEventListener('blur',()=>{
 if(listeningForControl!==null){
  const action=listeningForControl;listeningForControl=null;
  setControlMessage('Asignación cancelada. Vuelve a pulsar CAMBIAR para intentarlo.');
  renderControlBindings();
 }
 keys.left=keys.right=keys.jump=keys.down=keys.spindash=keys.peelout=keys.homing=false;keys.up=false;
 if(player){
  if(player.spinDashCharging){player.spinDashCharging=false;player.spinDashCharge=0;player.spin=0}
  if(player.peelOutCharging){player.peelOutCharging=false;player.peelOutCharge=0;player.spin=0}
 }
});
startButton.addEventListener('click',()=>{leaveOnlineRoom();startGame()});onlineButton.addEventListener('click',startOnlineGame);resetButton.addEventListener('click',resetGame);window.addEventListener('beforeunload',leaveOnlineRoom);
document.querySelectorAll('[data-control]').forEach(b=>{
 const c=b.dataset.control;
 let pointerPressed=false;
 const press=e=>{
  e.preventDefault();
  if(pointerPressed)return;
  pointerPressed=true;
  if(c==='jump'){keys.jump=true;jump()}
  else if(c==='up'){if(!running)startGame();keys.up=true}
  else if(c==='spindash'){if(!running)startGame();keys.spindash=true;beginSpinDash()}
  else if(c==='peelout'){if(!running)startGame();keys.peelout=true;beginSuperPeelOut()}
  else if(c==='homing'){if(!running)startGame();activateCharacterAttack('touch')}
  else{if(!running)startGame();keys[c]=true}
 };
 const release=e=>{
  e.preventDefault();
  pointerPressed=false;
  if(c==='jump')keys.jump=false;
  else if(c==='up')keys.up=false;
  else if(c==='spindash'){keys.spindash=false;releaseSpinDash()}
  else if(c==='peelout'){keys.peelout=false;releaseSuperPeelOut()}
  else if(c==='homing')keys.homing=false;
  else keys[c]=false;
 };
 b.addEventListener('pointerdown',press);
 b.addEventListener('pointerup',release);
 b.addEventListener('pointercancel',release);
 b.addEventListener('pointerleave',release);
});
// Tras el segundo toque, mantener salto permite a Tails compensar la gravedad y mantener el vuelo.
function applyAirMotion(dt){
 if(selectedCharacterId==='knuckles'&&player.knucklesGliding){
  // Mantén el cuerpo extendido y evita que Spin Dash u otras banderas
  // puedan devolverlo a la animación de bola mientras está planeando.
  player.spinDashRolling=false;player.spinDashRollTime=0;
  player.spinDashCharging=false;player.spinDashCharge=0;
  player.spin=0;player.spinAngle=0;player.spinAttack=false;player.rolling=false;
  const descent=78;player.vy+=(descent-player.vy)*Math.min(1,5.2*dt);player.y+=player.vy*dt;return;
 }
 if(selectedCharacterId==='tails'&&player.tailsFlying){
  const flightLift=-360;
  player.vy+=(flightLift-player.vy)*Math.min(1,9*dt);
  player.y+=player.vy*dt;
  return;
 }
 if(selectedCharacterId==='tails'&&player.tailsTired){
  // Al agotarse, Tails entra en planeo: su velocidad vertical converge
  // a una caída moderada en vez de desplomarse a velocidad máxima.
  const tiredGlideSpeed=280;
  player.vy+=(tiredGlideSpeed-player.vy)*Math.min(1,2.1*dt);
  player.y+=player.vy*dt;
  return;
 }
 player.vy+=1550*dt;player.y+=player.vy*dt;
}
function update(dt){
 updateEnemyExplosions(dt);
 if(!running||!controlsPanel.classList.contains('hidden'))return;elapsed+=dt;
 if(player.tailsAttackTimer>0)player.tailsAttackTimer=Math.max(0,player.tailsAttackTimer-dt);
 if(player.tailsAttackCooldown>0)player.tailsAttackCooldown=Math.max(0,player.tailsAttackCooldown-dt);
 if(player.tailsSwimStrokeCooldown>0)player.tailsSwimStrokeCooldown=Math.max(0,player.tailsSwimStrokeCooldown-dt);
 if(player.knucklesPunchTimer>0)player.knucklesPunchTimer=Math.max(0,player.knucklesPunchTimer-dt);
 if(player.knucklesPunchCooldown>0)player.knucklesPunchCooldown=Math.max(0,player.knucklesPunchCooldown-dt);
 if(player.hitSlowTimer>0){player.hitSlowTimer=Math.max(0,player.hitSlowTimer-dt);if(player.hitSlowTimer===0)player.hitSlowFactor=1;}
  if(selectedCharacterId==='tails'&&player.tailsFlying&&!keys.jump){
  // El segundo toque activa el vuelo; al soltarlo, Tails deja de impulsarse.
  player.tailsFlying=false;
 }
 if(selectedCharacterId==='tails'&&player.tailsFlying){
  player.tailsFlightTime=(player.tailsFlightTime||0)+dt;
  if(player.tailsFlightTime>=7){
   player.tailsFlightTime=7;player.tailsFlying=false;player.tailsTired=true;
   status.textContent='TAILS CANSADO · PLANEANDO HACIA EL SUELO';
  }
 }

 if(player.spinDashRolling){
  player.spinDashRollTime=Math.max(0,(player.spinDashRollTime||0)-dt);
  if(player.spinDashRollTime<=0||Math.abs(player.vx)<115)player.spinDashRolling=false;
 }
 if(player.peelOutBurst>0){
  player.peelOutBurstTime=(player.peelOutBurstTime||0)+dt;
  player.peelOutBurst=Math.max(0,player.peelOutBurst-dt);
  if(player.peelOutBurst===0){
   // Conserva el límite alto un momento y después lo reduce suavemente.
   player.peelOutBurstTime=0;
   player.peelOutSpeedFade=1.35;
  }
 }else if(player.peelOutSpeedFade>0){
  player.peelOutSpeedFade=Math.max(0,player.peelOutSpeedFade-dt);
  player.speed+=(900-player.speed)*(1-Math.exp(-2.8*dt));
  if(player.peelOutSpeedFade===0)player.speed=900;
 }
 const tunnelCenterBeforeMove=player.x+player.w/2;
 const nearTunnelEntry=!inUnderground&&tunnelCenterBeforeMove>=undergroundZone.entryX-78&&tunnelCenterBeforeMove<=undergroundZone.entryX+72;
 if(selectedCharacterId==='tails'&&keys.down&&player.onGround&&!player.tailsSwimming&&!player.spinDashCharging&&!player.peelOutCharging){
  const diveBridge=bridgeAt(player.x+player.w/2);
  if(diveBridge){player.tailsSwimming=true;player.tailsFlying=false;player.tailsTired=false;player.tailsFlightTime=0;player.onGround=false;player.platformId=null;player.vx*=.35;player.vy=0;player.y=bridgeSurfaceY(diveBridge)+88;player.spin=0;player.spinAngle=0;player.spinAttack=false;keys.down=false;status.textContent='TAILS SE SUMERGE · PULSA SALTO PARA SUBIR';}
 }
 if(selectedCharacterId==='sonic'&&keys.down&&player.onGround&&!inUnderground&&!nearTunnelEntry&&
    Math.abs(player.vx)>145&&!player.spinDashCharging&&!player.peelOutCharging){
  player.rolling=true;
 }else if(!keys.down||!player.onGround||inUnderground||selectedCharacterId!=='sonic'){
  player.rolling=false;
 }
 let homingTarget=null;
 if(player.homingActive){
  player.homingTimer=Math.max(0,(player.homingTimer||0)-dt);
  homingTarget=enemies.find(enemy=>enemy.id===player.homingTargetId&&enemy.alive)||null;
  if(!homingTarget||player.homingTimer<=0){
   player.homingActive=false;player.homingTargetId=null;homingTarget=null;
  }else{
   const dx=homingTarget.x-(player.x+player.w/2);
   const dy=(homingTarget.y-8)-(player.y+player.h/2);
   const distance=Math.max(1,Math.hypot(dx,dy));
   player.vx=dx/distance*980;player.vy=dy/distance*980;
   player.facing=dx<0?-1:1;player.onGround=false;player.platformId=null;player.spin=1;
  }
 }
 if(player.tailsSwimming){
  const swimBridge=bridgeAt(player.x+player.w/2);
  if(!swimBridge){player.tailsSwimming=false;player.onGround=true;player.platformId=null;player.y=groundSurfaceAt(player.x+player.w/2)-player.h;player.vy=0;}
  else{
   const deckY=bridgeSurfaceY(swimBridge),waterY=deckY+72,swimDirection=Number(keys.right)-Number(keys.left);
   if(swimDirection){player.facing=swimDirection;player.vx+=(swimDirection*260-player.vx)*Math.min(1,4*dt);}else player.vx*=Math.pow(.15,dt);
   player.x=Math.max(swimBridge.x+14,Math.min(swimBridge.x+swimBridge.w-14-player.w,player.x+player.vx*dt));
   player.vy+=(keys.down?560:250)*dt;player.vy=Math.max(-440,Math.min(270,player.vy));player.y+=player.vy*dt;
   const shallowLimit=deckY-player.h+2,deepLimit=waterY+150;
   if(player.y<=shallowLimit){player.y=deckY-player.h;player.tailsSwimming=false;player.onGround=true;player.platformId=null;player.vy=0;player.vx*=.7;keys.down=false;}
   else{player.y=Math.min(deepLimit,player.y);player.onGround=false;player.platformId=null;player.spin=0;player.spinAngle=0;player.spinAttack=false;}
  }
 }else if(player.spinDashCharging||player.peelOutCharging){
  if(player.spinDashCharging){
   player.spinDashCharge=Math.min(1,(player.spinDashCharge||0)+dt*.82);
   player.spinDashAnimTime=(player.spinDashAnimTime||0)+dt;
  }
  if(player.peelOutCharging){
   player.peelOutCharge=Math.min(1,(player.peelOutCharge||0)+dt*.78);
   player.peelOutAnimTime=(player.peelOutAnimTime||0)+dt;
  }
  player.vx=0;player.vy=0;player.onGround=true;player.platformId=null;
  player.y=groundSurfaceAt(player.x+player.w/2)-player.h;
  if(keys.left&&!keys.right)player.facing=-1;else if(keys.right&&!keys.left)player.facing=1;
  // Both charging poses stay upright. Rotation begins only after Spin Dash release.
  player.spin=0;player.spinAngle=0;
 }else{
  const homingSteering=Boolean(homingTarget);
  const dir=Number(keys.right)-Number(keys.left);
  if(selectedCharacterId==='knuckles'&&player.knucklesGliding){const glideDirection=dir||(player.facing||1);player.facing=glideDirection;player.vx+=(glideDirection*430-player.vx)*Math.min(1,5.4*dt);player.speedCharge=Math.max(player.speedCharge,.55);
  }else if(selectedCharacterId==='tails'&&player.tailsTired){
   // Ya no puede impulsarse ni acelerar en el aire; pierde velocidad
   // horizontal progresivamente mientras planea hacia el suelo.
   player.vx*=Math.pow(.42,dt);player.speedCharge=Math.max(0,player.speedCharge-1.8*dt);if(Math.abs(player.vx)<12)player.vx=0;
  }else if(homingSteering){
   player.speedCharge=Math.max(player.speedCharge,.7);
  }else if(dir){
   if(player.vx!==0&&Math.sign(player.vx)!==dir)player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);
   else player.speedCharge=Math.min(1,player.speedCharge+0.4*dt);
   player.facing=dir;const targetSpeed=dir*(215+515*player.speedCharge);
   player.vx+=(targetSpeed-player.vx)*Math.min(1,6.4*dt);
  }else{
   const rollingFriction=player.spinDashRolling||player.rolling;
   player.speedCharge=Math.max(0,player.speedCharge-(rollingFriction ? .22 : 2.4)*dt);
   player.vx*=Math.pow(rollingFriction ? .78 : .12,dt);
   if(Math.abs(player.vx)<8)player.vx=0;
  }
  const wasGrounded=player.onGround,oldBottom=player.y+player.h,oldX=player.x,oldY=player.y,oldPlatformId=player.platformId,oldGround=groundSurfaceAt(oldX+player.w/2);
  if(wasGrounded&&oldPlatformId===null&&!inUnderground){
   const slope=(terrainHeight(player.x+42)-terrainHeight(player.x-42))/84;
   player.vx+=Math.max(-230,Math.min(230,slope*720))*dt;
  }
  const speedLimit=player.hitSlowTimer>0?player.speed*(Number(player.hitSlowFactor)||.28):player.speed;
  player.vx=Math.max(-speedLimit,Math.min(speedLimit,player.vx));
  player.x=Math.max(0,Math.min(worldWidth-player.w,player.x+player.vx*dt));
  if(player.spin)player.spinAngle=(player.spinAngle||0)+player.vx*dt/45;
  const worldCenter=player.x+player.w/2,groundNow=groundSurfaceAt(worldCenter);
  if(wasGrounded&&oldPlatformId!==null){
   const oldPlatform=platformById(oldPlatformId);
   if(oldPlatform&&player.x+player.w>oldPlatform.x&&player.x<oldPlatform.x+oldPlatform.w){
    player.y=aerialPlatformY(oldPlatform)-player.h;player.vy=0;player.onGround=true;player.platformId=oldPlatform.id;
   }else{
    // Al salir del borde aéreo, Sonic cae en lugar de teletransportarse al suelo inferior.
    player.platformId=null;applyAirMotion(dt);player.onGround=false;
   }
  }else if(wasGrounded){
   player.platformId=null;player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=player.spinDashRolling||player.rolling?1:0;if(!player.spin)player.spinAngle=0;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
  }else{
   applyAirMotion(dt);player.onGround=false;
   const descending=player.vy>=0;
   const landingPlatform=descending&&oldBottom<=player.y+player.h&&platformUnderPlayer(player.x,player.w);
   const landingY=landingPlatform?aerialPlatformY(landingPlatform):Infinity;
   if(landingPlatform&&oldBottom<=landingY+Math.max(28,Math.abs(player.vx)*dt*1.4)&&player.y+player.h>=landingY){
    player.y=landingY-player.h;player.vy=0;player.onGround=true;player.platformId=landingPlatform.id;player.spin=player.rolling?1:0;player.spinAngle=0;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
   }else if(descending&&player.y+player.h>=groundNow&&oldBottom<=oldGround+Math.max(28,Math.abs(player.vx)*dt*1.4)){
    player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.platformId=null;player.spin=player.rolling?1:0;player.spinAngle=0;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
   }
  }
  // El trampolín impulsa a Sonic a la primera plataforma de la ruta aérea.
  if(!inUnderground&&player.onGround&&player.platformId===null&&player.vx>80&&elapsed>=aerialSpring.cooldownUntil&&player.x+player.w>aerialSpring.x&&player.x<aerialSpring.x+aerialSpring.w){
   player.vy=-1050;player.onGround=false;player.platformId=null;player.spin=1;player.spinAngle=0;player.spinAttack=selectedCharacterId==='sonic';
   player.speedCharge=Math.max(player.speedCharge,.78);player.vx=Math.max(player.vx,430);
   aerialSpring.cooldownUntil=elapsed+1.0;aerialSpring.flashUntil=elapsed+.45;addScore(25);
  }
 const tunnelCenter=player.x+player.w/2;
  if(!inUnderground&&keys.down&&player.onGround&&player.platformId===null&&
     tunnelCenter>=undergroundZone.entryX-78&&tunnelCenter<=undergroundZone.entryX+72){
   inUnderground=true;keys.down=false;
   player.x=undergroundZone.entryX+40-player.w/2;
   player.y=undergroundPathY(player.x+player.w/2)-player.h;
   player.vy=0;player.onGround=true;player.platformId=null;player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
  }
  if(inUnderground){
   const center=player.x+player.w/2;
   if(center<=undergroundZone.entryX+3){
    inUnderground=false;
    player.x=undergroundZone.entryX-30-player.w/2;
    player.y=groundSurfaceAt(undergroundZone.entryX-30)-player.h;
    player.vy=0;player.onGround=true;player.platformId=null;player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
   }else if(center>=undergroundZone.exitX){
    inUnderground=false;
    player.x=undergroundZone.exitX-player.w/2;
    player.y=groundSurfaceAt(undergroundZone.exitX)-player.h;
    player.vy=0;player.onGround=true;player.platformId=null;player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
    player.vx=Math.max(170,player.vx);
   }else{
    player.y=undergroundPathY(center)-player.h;
    player.vy=0;player.onGround=true;player.platformId=null;player.spin=0;player.spinAngle=0;player.rolling=false;player.spinAttack=false;player.homingActive=false;player.homingTargetId=null;
   }
  }
  for(const cp of checkpoints){if(!cp.active&&player.x+player.w/2>=cp.x){cp.active=true;checkpointX=cp.x;addScore(250)}}
  }
 if(selectedCharacterId==='tails'&&player.onGround){player.tailsFlying=false;player.tailsTired=false;player.tailsFlightTime=0;}
 if(selectedCharacterId==='knuckles'&&player.onGround){player.knucklesGliding=false;player.knucklesJumpTapPending=false;}
 const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);
 if(selectedCharacterId==='tails'){
  if(player.onGround){
   player.fallPhase=0;
   if(player.spinDashCharging||player.spinDashRolling||player.rolling||player.peelOutCharging)player.spinPhase+=dt;
   else if(Math.abs(player.vx)>25)player.runPhase+=dt;
  }else if(player.spin)player.spinPhase+=dt;
  else player.fallPhase+=dt;
 }else{
  if(player.onGround){player.fallPhase=0;if(player.spinDashCharging||player.spinDashRolling||player.rolling||player.peelOutCharging||player.homingActive||player.tailsAttackTimer>0)player.spinPhase+=dt*(2+speedRatio*7);else if(Math.abs(player.vx)>25)player.runPhase+=dt*(0.9+speedRatio*3.0)}
  else if(player.spin)player.spinPhase+=dt*(0.8+speedRatio*1.7);
  else player.fallPhase+=dt*(0.9+speedRatio*1.1);
 }
 if(player.invincible>0)player.invincible-=dt;
 rings.forEach(r=>{
  if(!r.got&&r.bouncing){
   // Física de los anillos lanzados: gravedad, desplazamiento y rebote sobre el terreno.
   r.vy=(r.vy||0)+980*dt;
   r.x+=(r.vx||0)*dt;
   r.y+=r.vy*dt;
   r.vx=(r.vx||0)*Math.pow(.62,dt);
   if(r.x<10){r.x=10;r.vx=Math.abs(r.vx)*.7}
   if(r.x>worldWidth-10){r.x=worldWidth-10;r.vx=-Math.abs(r.vx)*.7}
   const ringFloor=r.underground?undergroundPathY(r.x):groundSurfaceAt(r.x);
   // La elipse y su borde ocupan 18 px desde el centro; evita que atraviese el césped.
   if(r.y+RING_VERTICAL_RADIUS>=ringFloor){
    r.y=ringFloor-RING_VERTICAL_RADIUS;
    if(r.vy>100&&(r.bounceCount||0)<4){
     r.vy=-r.vy*.46;
     r.vx*=.72;
     r.bounceCount=(r.bounceCount||0)+1;
    }else if(r.vy>=0){
     r.vy=0;r.vx=0;r.bouncing=false;
    }
   }
  }
  if(!r.got&&elapsed>=(r.dropSafeUntil||0)&&Math.abs((player.x+player.w/2)-r.x)<24&&Math.abs((player.y+player.h/2)-r.y)<29){
   r.got=true;r.bouncing=false;r.vx=0;r.vy=0;r.dropSafeUntil=0;addScore(10);
  }
 });
 enemies.forEach(e=>{
  if(!e.alive)return;
  e.x=e.base+Math.sin(elapsed*1.6+e.base)*32;
  // Las abejas vuelan sobre el terreno con una oscilación suave.
  e.y=e.kind===2
   ? terrainHeight(e.x)-190+Math.sin(elapsed*2.3+e.base*.014)*13
   : terrainHeight(e.x)-28;
  if(e.kind===2){
   const targetX=player.x+player.w/2-e.x;
   const targetY=player.y+player.h/2-(e.y-9);
   const distance=Math.hypot(targetX,targetY);
   // Al entrar por primera vez en pantalla, la abeja dispara sin retraso.
   // Luego repite el ataque cada cinco segundos exactos mientras siga visible.
   const beeVisible=e.x>=camera-32&&e.x<=camera+VIEW_W+32;
   if(beeVisible&&distance>0&&(!e.hasFiredFirst||elapsed>=e.nextShot)){
    const shotSpeed=340;
    beeProjectiles.push({
     x:e.x+(targetX>=0?17:-17),y:e.y-9,
     vx:targetX/distance*shotSpeed,vy:targetY/distance*shotSpeed,
     radius:8,life:4.2,alive:true
    });
    e.hasFiredFirst=true;
    e.nextShot=elapsed+5;
   }
  }
  const enemyY=e.y+(e.kind===2?-7:0);
  const bodyHit=player.x+player.w>e.x-28&&player.x<e.x+28&&player.y+player.h>enemyY-27&&player.y<enemyY+22;
  const tailsSwipeHit=selectedCharacterId==='tails'&&player.tailsAttackTimer>0&&Math.abs(e.x-(player.x+player.w/2+player.facing*34))<48&&Math.abs(enemyY-(player.y+player.h/2))<54;
  // El puñetazo de Knuckles alcanza enemigos delante de él mientras dura la animación.
  // La comprobación direccional evita golpear enemigos que estén detrás del personaje.
  const punchOffset=(e.x-(player.x+player.w/2))*(player.facing||1);
  const knucklesPunchHit=selectedCharacterId==='knuckles'&&player.knucklesPunchTimer>0&&
   punchOffset>=-4&&punchOffset<=104&&Math.abs(enemyY-(player.y+player.h/2))<54;
  const knucklesGlideHit=selectedCharacterId==='knuckles'&&player.knucklesGliding&&bodyHit;
  const hit=bodyHit||tailsSwipeHit||knucklesPunchHit;
  if(hit){
   const rollingHit=player.rolling&&Math.abs(player.vx)>160;
   const tailsFlightHit=selectedCharacterId==='tails'&&player.tailsFlying&&!player.tailsTired&&bodyHit;
   const attackHit=player.homingActive||player.spinAttack||rollingHit||tailsFlightHit||tailsSwipeHit||knucklesGlideHit||knucklesPunchHit;
   if(attackHit){
    const homingHit=player.homingActive;
    destroyEnemy(e);
    addScore(100);
    if(homingHit){
     player.homingActive=false;player.homingTargetId=null;player.homingTimer=0;
     player.vx=player.facing*300;player.vy=-410;player.onGround=false;player.spin=1;
     player.spinAttack=true;
    }else if(player.spinAttack){
     player.vy=-370;player.onGround=false;player.spin=1;
    }else if(rollingHit){
     player.spin=1;player.spinAngle=(player.spinAngle||0)+.8;
    }else if(knucklesGlideHit){player.vy=Math.min(player.vy,-80);player.knucklesGliding=true;}
    else if(knucklesPunchHit){status.textContent='¡PUÑETAZO! · ENEMIGO DESTRUIDO · +100 PTS';}
   }else if(player.vy>100&&player.y+player.h<enemyY+12){
    destroyEnemy(e);player.vy=-370;player.onGround=false;addScore(100);
   }else if(player.invincible<=0){
    applyPlayerDamage();
   }
  }
 });
 if(!running)return;
  // Mover las bolitas y comprobar sus colisiones con Sonic.
 for(const shot of beeProjectiles){
  if(!shot.alive)continue;
  shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.life-=dt;
  if(shot.life<=0||shot.x<0||shot.x>worldWidth||shot.y>VIEW_H+Math.max(0,cameraY)+900||shot.y< -900){
   shot.alive=false;continue;
  }
  const shotHitsPlayer=shot.x+shot.radius>player.x&&shot.x-shot.radius<player.x+player.w&&
   shot.y+shot.radius>player.y&&shot.y-shot.radius<player.y+player.h;
  if(shotHitsPlayer){
   shot.alive=false;
   applyPlayerDamage();
   if(!running)return;
  }
 }
 beeProjectiles=beeProjectiles.filter(shot=>shot.alive&&shot.life>0);
 if(!inUnderground&&player.y>VIEW_H+100){
  player.x=Math.max(30,checkpointX);player.y=terrainHeight(player.x)-player.h;player.vy=0;player.vx=0;player.speedCharge=0;lives--;
  if(lives<=0){running=false;recordRun('gameover');startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Caíste fuera del recorrido. Pulsa jugar para volver a empezar.';resetPlayer()}
 }
 if(player.x>=worldWidth-player.w-90&&!levelCompleted){
  levelCompleted=true;
  if(onlineMode&&!raceFinished){
   raceFinished=true;raceWinner=playerName;addScore(1000);recordRun('win');running=false;
   if(multiplayerChannel)multiplayerChannel.send({type:'broadcast',event:'player-finished',payload:{id:multiplayerId,name:playerName,time:Math.round(elapsed*100)/100,progress:100,finishedAt:Date.now()}}).catch(error=>console.warn('[Blue Rush] No se pudo anunciar la meta:',error));
   startScreen.querySelector('h2').textContent='🏁 ¡Ganaste la carrera!';
   startScreen.querySelector('p:not(.start-kicker)').textContent='¡Premio por ganar: +1.000 puntos! Puntaje final: '+score+'. Tiempo: '+elapsed.toFixed(1)+' s. ¡Desafía a tu rival otra vez!';
   status.textContent='CARRERA TERMINADA · GANADOR: '+playerName;
  }else{
   recordRun('complete');running=false;startScreen.querySelector('h2').textContent='¡Nivel completado!';
   startScreen.querySelector('p:not(.start-kicker)').textContent='¡Llegaste al final de Blue Rush! Puntos: '+score+'. Pulsa para correr otra vez.';
  }
  startScreen.classList.remove('hidden');startButton.innerHTML='CORRER OTRA VEZ <span aria-hidden="true">↻</span>';
 }
 // Cámara fija sobre el centro de Sonic: no intenta encuadrar el terreno ni las cimas.
 // Se calcula desde la posición actual del personaje en cada frame, sin límites
 // de borde ni suavizado, para que Sonic permanezca exactamente centrado en pantalla.
 const playerCenter=player.x+player.w/2;
 camera=playerCenter-VIEW_W/2;
 cameraY=player.y+player.h/2-VIEW_H/2-35;
 const zone=sectionAt(player.x);
 if(onlineMode){
  const rival=[...remotePlayers.values()].sort((a,b)=>(b.progress||0)-(a.progress||0))[0];
  status.textContent=raceFinished?'CARRERA TERMINADA · GANADOR: '+(raceWinner||playerName):'SALA '+multiplayerRoom+' · TÚ '+Math.min(100,Math.floor(player.x/(worldWidth-player.w-90)*100))+'%'+(rival?' · '+rival.name+' '+Math.floor(rival.progress||0)+'%':' · ESPERANDO RIVAL');
 }else status.textContent=(inUnderground?'ZONA SUBTERRÁNEA · ':zone.name+' · ')+'ANILLOS '+rings.filter(r=>r.got).length+' · '+score+' PTS · VIDAS '+lives;
  if(player.spinDashCharging)status.textContent='SPIN DASH '+Math.round(player.spinDashCharge*100)+'% · SUELTA SHIFT / X';
 if(player.hitSlowTimer>0)status.textContent='¡TE GOLPEARON! · VELOCIDAD REDUCIDA';
 else if(selectedCharacterId==='knuckles'){
  if(player.knucklesGliding)status.textContent='KNUCKLES PLANEANDO · MANTÉN ESPACIO · FLECHAS PARA DIRIGIR';
  else if(player.knucklesPunchTimer>0)status.textContent='KNUCKLES · COMBO DE PUÑETAZOS '+player.knucklesPunchStage+'/3';
 }
 if(selectedCharacterId==='tails'){
  if(player.tailsSwimming)status.textContent='TAILS NADANDO · PULSA SALTO PARA SUBIR';else if(player.tailsFlying)status.textContent='TAILS VOLANDO · '+Math.ceil(Math.max(0,7-player.tailsFlightTime))+' S · SUELTA ESPACIO PARA DESCENDER';else if(player.tailsTired&&!player.onGround)status.textContent='TAILS CANSADO · DESCENDIENDO';else if(!player.onGround)status.textContent='MANTÉN ESPACIO PARA VOLAR · '+Math.ceil(Math.max(0,7-player.tailsFlightTime))+' S';else if(player.tailsAttackTimer>0)status.textContent='ATAQUE DE COLAS';
 }
 }
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
// Render pixel-art compartido por Sonic y todo el escenario.
// Se renderiza a tamaño lógico completo y después se reduce a una rejilla de píxeles.
const PIXEL=1.5;
const scene=document.createElement('canvas');
scene.width=VIEW_W;scene.height=VIEW_H;
const g=scene.getContext('2d');
g.imageSmoothingEnabled=false;
const pixelScene=document.createElement('canvas');
pixelScene.width=Math.max(1,Math.ceil(VIEW_W/PIXEL));
pixelScene.height=Math.max(1,Math.ceil(VIEW_H/PIXEL));
const pixelCtx=pixelScene.getContext('2d');
pixelCtx.imageSmoothingEnabled=false;
function pxRect(x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))}
function pxCircle(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(Math.round(x),Math.round(y),r,0,Math.PI*2);g.fill()}

function roundedRectPath(c,x,y,w,h,r){
 r=Math.max(0,Math.min(r,w/2,h/2));
 c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
 c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
 c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
function drawCloud(x,y,s=1){
 g.save();g.translate(x,y);g.scale(s,s);
 g.fillStyle="rgba(10,57,92,.17)";g.beginPath();
 g.ellipse(2,15,50,11,0,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.strokeStyle="#beeaff";g.lineWidth=1.5;
 g.beginPath();g.ellipse(-21,2,20,13,0,0,Math.PI*2);g.ellipse(-1,-7,24,21,0,0,Math.PI*2);g.ellipse(24,2,22,14,0,0,Math.PI*2);g.ellipse(2,5,40,13,0,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle="#e6f9ff";g.beginPath();g.ellipse(-5,5,27,7,0,0,Math.PI*2);g.fill();
 g.restore();
}
function drawHillLayer(base,amp,speed,color,phase,outline){
 g.beginPath();g.moveTo(0,scene.height);
 for(let x=-8;x<=scene.width+8;x+=4){
  const wx=x+camera*speed;
  const y=base+Math.sin(wx*.009+phase)*amp+Math.sin(wx*.021+phase*.7)*amp*.24;
  g.lineTo(x,y);
 }
 g.lineTo(scene.width,scene.height);g.closePath();g.fillStyle=color;g.fill();
 if(outline){g.beginPath();for(let x=-8;x<=scene.width+8;x+=4){const wx=x+camera*speed;const y=base+Math.sin(wx*.009+phase)*amp+Math.sin(wx*.021+phase*.7)*amp*.24;if(x===-8)g.moveTo(x,y);else g.lineTo(x,y)}g.strokeStyle=outline;g.lineWidth=2;g.stroke()}
}
function drawBackground(){
 const w=scene.width,h=scene.height;
 g.imageSmoothingEnabled=false;
 // Fondo tropical pixel-art con cielo, nubes en bloques e islas detalladas.
 g.fillStyle="#0878dc";g.fillRect(0,0,w,h);
 g.fillStyle="#169bea";g.fillRect(0,0,w,230);
 g.fillStyle="#39baf5";g.fillRect(0,0,w,120);
 g.fillStyle="#73d9ff";g.fillRect(0,0,w,58);
 // Rayos suaves de luz en el cielo.
 for(let i=0;i<12;i++){const x=((i*97-camera*.025)%(w+120)+(w+120))%(w+120)-60;g.fillStyle="rgba(177,239,255,.14)";g.fillRect(x,0,18,225);g.fillRect(x+18,0,9,165)}
 // Nubes con sombras escalonadas y luces blancas.
 for(let i=0;i<11;i++){
  const x=((i*143-camera*.075)%(w+220)+(w+220))%(w+220)-110;
  const y=24+(i%4)*42,ww=54+(i%3)*18;
  g.fillStyle="#258fd6";g.fillRect(x+8,y+15,ww+20,14);g.fillRect(x+20,y+25,ww,7);
  g.fillStyle="#b0eaff";g.fillRect(x+3,y+10,ww,14);g.fillRect(x+15,y+1,ww*.45,16);g.fillRect(x+ww*.55,y+7,ww*.35,15);
  g.fillStyle="#f3fdff";g.fillRect(x+8,y+7,ww-6,12);g.fillRect(x+19,y,ww*.39,13);g.fillRect(x+ww*.58,y+5,ww*.29,12);
  g.fillStyle="#fff";g.fillRect(x+21,y+2,ww*.2,4);g.fillRect(x+ww*.62,y+7,ww*.14,3);
 }
 // Islas cafés lejanas, detrás de las capas verdes y de los detalles cercanos.
 g.save();g.translate(0,0); // Baja 70 px el paisaje para equilibrar el horizonte con el nivel.
 island(115+((camera*.035)%(w+260)),336,.95);
 island(420+((camera*.045)%(w+300)),340,.7);
 island(690+((camera*.03)%(w+320)),326,1.12);
 island(980+((camera*.04)%(w+340)),341,.82);
 island(1250+((camera*.035)%(w+360)),333,1.02);
 // Islas pequeñas, vegetación en terrazas y cascadas en primer plano del horizonte.
 for(let i=0;i<18;i++){
  const ix=((i*83-camera*.055)%(w+100)+(w+100))%(w+100)-40;
  const iy=294+(i%4)*11,iw=22+(i%4)*9;
  g.fillStyle="#9e6254";g.fillRect(ix,iy,iw,15);g.fillRect(ix+5,iy-6,iw-12,8);
  g.fillStyle="#176f43";g.fillRect(ix-3,iy-2,iw+6,5);
  g.fillStyle="#40bb50";g.fillRect(ix+3,iy-5,iw-5,3);
  g.fillStyle="#55cde8";g.fillRect(ix+iw*.55,iy+5,3,10);
  g.fillStyle="#b6f4ff";g.fillRect(ix+iw*.55,iy+7,1,6);
 }

 // Mar azul visible detrás de las islas, con bandas de luz pixeladas.
 g.fillStyle="#138fe0";g.fillRect(0,236,w,96);
 g.fillStyle="#36b5ef";g.fillRect(0,242,w,18);
 g.fillStyle="#75d9f6";g.fillRect(0,246,w,4);
 for(let i=0;i<42;i++){
  const x=((i*53-camera*.14)%(w+60)+(w+60))%(w+60)-30;
  const y=264+(i*37%63),ww=10+(i%5)*5;
  g.fillStyle=i%3===0?"#77d9f5":i%3===1?"#238fda":"#4bc0ef";g.fillRect(x,y,ww,3);
  if(i%4===0){g.fillStyle="#a2e8fa";g.fillRect(x+4,y-3,ww*.55,2)}
 }
 // Islas escalonadas: roca cálida, vegetación exuberante y cascadas.
 function island(cx,base,scale){
  const pts=[[-100,0],[-76,-18],[-58,-34],[-43,-31],[-27,-57],[-9,-70],[5,-47],[22,-54],[42,-29],[63,-22],[85,0]];
  g.save();g.translate(cx,base);g.scale(scale,scale);
  g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.lineTo(100,35);g.lineTo(-105,35);g.closePath();g.fillStyle="#b66b54";g.fill();
  // Capas de roca pixelada.
  g.fillStyle="#d58a66";g.fillRect(-66,-20,36,7);g.fillRect(-28,-42,22,6);g.fillRect(14,-33,30,7);g.fillRect(47,-17,26,6);
  g.fillStyle="#8b5265";g.fillRect(-57,-5,22,12);g.fillRect(-17,-22,14,14);g.fillRect(29,-11,17,13);g.fillRect(59,-4,13,9);
  // Césped sobre cada terraza.
  g.fillStyle="#167e49";g.fillRect(-91,-4,46,7);g.fillRect(-56,-22,31,7);g.fillRect(-23,-42,28,7);g.fillRect(4,-34,40,7);g.fillRect(39,-21,35,7);
  g.fillStyle="#39bb50";g.fillRect(-86,-7,35,4);g.fillRect(-51,-25,23,4);g.fillRect(-19,-45,21,4);g.fillRect(9,-37,28,4);g.fillRect(44,-24,24,4);
  g.fillStyle="#a0e65a";g.fillRect(-75,-8,10,2);g.fillRect(-43,-26,8,2);g.fillRect(13,-38,9,2);g.fillRect(49,-25,8,2);
  // Pequeñas líneas de cascada en los acantilados.
  g.fillStyle="#65d5ed";g.fillRect(-6,-28,4,22);g.fillRect(-2,-10,5,8);g.fillRect(50,-13,3,17);
  g.fillStyle="#b6f6ff";g.fillRect(-5,-25,2,13);g.fillRect(51,-11,2,9);
  // Arbustos y árboles en píxeles.
  for(let i=0;i<7;i++){const tx=-72+i*22,ty=-8-(i%3)*10;g.fillStyle="#075c3a";g.fillRect(tx,ty-8,8,11);g.fillStyle="#24a94a";g.fillRect(tx-4,ty-11,11,7);g.fillStyle="#70d94e";g.fillRect(tx-1,ty-13,5,3)}
  g.restore();
 }
 // Montañas lejanas: sus bases se esconden detrás de las colinas para que no parezcan suspendidas.
 const mountain=(x,base,peak,wide)=>{
  g.fillStyle="#287eae";g.beginPath();g.moveTo(x-wide,base);g.lineTo(x-wide*.58,base-peak*.42);g.lineTo(x-wide*.28,base-peak*.72);g.lineTo(x,base-peak);g.lineTo(x+wide*.22,base-peak*.62);g.lineTo(x+wide*.48,base-peak*.77);g.lineTo(x+wide,base);g.lineTo(x+wide*.94,360);g.lineTo(x-wide*.94,360);g.closePath();g.fill();
  g.fillStyle="#4ca8c5";g.beginPath();g.moveTo(x-wide*.28,base-peak*.72);g.lineTo(x,base-peak);g.lineTo(x+wide*.22,base-peak*.62);g.lineTo(x+wide*.08,base-peak*.66);g.lineTo(x,base-peak*.79);g.lineTo(x-wide*.12,base-peak*.56);g.closePath();g.fill();
  g.fillStyle="#d5f5f3";g.fillRect(x-4,base-peak+10,8,4);g.fillRect(x+10,base-peak+20,6,3);
 };
 for(let i=0;i<22;i++){
  const spacing=92;
  const span=w+spacing*2;
  const mx=((i*spacing-camera*.025)%span+span)%span-spacing;
  const peak=26+(i%5)*5;
  const wide=58+(i%3)*12;
  mountain(mx,270,peak,wide);
 }
 // Islas tropicales elevadas y delante del mar: ahora quedan dentro del encuadre.
 // Las colinas verdes que se dibujan después cubren sus bases y las integran en el paisaje.
 island(115+((camera*.035)%(w+260)),336,.95);
 island(420+((camera*.045)%(w+300)),340,.7);
 island(690+((camera*.03)%(w+320)),326,1.12);
 island(980+((camera*.04)%(w+340)),341,.82);
 island(1250+((camera*.035)%(w+360)),333,1.02);
 // Las colinas verdes se dibujan como una masa continua hasta el horizonte;
 // así no quedan picos sueltos flotando sobre el mar.
 // Más nubes pequeñas en distintas distancias para que el cielo no se vea vacío.
 for(let i=0;i<24;i++){
  const cx=((i*61-camera*(.035+(i%3)*.012))%(w+80)+(w+80))%(w+80)-30;
  const cy=94+(i*29%116),cw=12+(i%4)*7;
  g.fillStyle="#2b9edc";g.fillRect(cx+3,cy+5,cw,4);
  g.fillStyle=i%3===0?"#f5fdff":"#b8ecff";g.fillRect(cx,cy+2,cw,4);g.fillRect(cx+4,cy,cw*.55,4);
  g.fillStyle="#fff";g.fillRect(cx+5,cy+1,cw*.25,2);
 }
 // Parchecitos de hojas y flores pixeladas en las islas cercanas.
 for(let i=0;i<64;i++){
  const px=((i*41-camera*.07)%(w+48)+(w+48))%(w+48)-24;
  const py=285+(i*17%72),sz=3+(i%4)*2;
  g.fillStyle=["#0b633c","#158748","#48c84d","#8ee45c"][i%4];
  g.fillRect(px,py,sz*2,4);g.fillRect(px+sz,py-4,sz,4);
  if(i%7===0){g.fillStyle="#f4d86a";g.fillRect(px+sz,py-7,3,3)}
 }
 // Detalles extra para dar profundidad al paisaje: vetas de roca, vegetación y reflejos del mar.
 // Líneas de roca en las montañas, siempre dentro de la zona del horizonte.
 for(let i=0;i<16;i++){
  const mx=((i*97-camera*.025)%(w+180)+(w+180))%(w+180)-70;
  const my=267+(i*19%54),len=9+(i%5)*5;
  g.fillStyle=i%2===0?"rgba(13,79,119,.62)":"rgba(116,205,190,.65)";
  g.fillRect(mx,my,len,2);
  g.fillRect(mx+4,my+4,Math.max(4,len-9),2);
 }
 // Palmeras lejanas en silueta para reforzar el ambiente tropical.
 for(let i=0;i<9;i++){
  const tx=((i*151-camera*.045)%(w+130)+(w+130))%(w+130)-45;
  const ty=292+(i%3)*9,th=17+(i%4)*5;
  g.fillStyle="#8b654c";
  g.fillRect(tx,ty-th,3,th);
  g.fillStyle="#176b43";
  g.fillRect(tx-10,ty-th-3,10,3);g.fillRect(tx-8,ty-th-7,8,4);
  g.fillRect(tx+2,ty-th-5,11,3);g.fillRect(tx+4,ty-th-9,9,4);
  g.fillRect(tx-5,ty-th-12,7,4);g.fillRect(tx-2,ty-th-15,5,4);
  g.fillStyle="#55c84c";
  g.fillRect(tx-8,ty-th-6,7,2);g.fillRect(tx+5,ty-th-8,6,2);
 }
 // Destellos y pequeñas olas horizontales en varias profundidades del océano.
 for(let i=0;i<76;i++){
  const ox=((i*37-camera*(.09+(i%4)*.035))%(w+40)+(w+40))%(w+40)-20;
  const oy=244+(i*23%83),ow=4+(i%6)*3;
  g.fillStyle=i%5===0?"#c1f6ff":i%3===0?"#82e6fb":"rgba(8,102,190,.7)";
  g.fillRect(ox,oy,ow,1+(i%3===0?1:0));
  if(i%8===0){g.fillStyle="#e1fcff";g.fillRect(ox+2,oy-2,Math.max(3,ow*.45),1)}
 }
 // Motitas de luz y pequeñas aves en el cielo.
 for(let i=0;i<13;i++){
  const bx=((i*89-camera*.04)%(w+60)+(w+60))%(w+60)-25;
  const by=35+(i*31%125);
  g.fillStyle="#e9fbff";
  g.fillRect(bx,by,4,2);g.fillRect(bx+4,by-2,4,2);g.fillRect(bx+8,by,4,2);
 }
 // Colinas verdes cercanas con bordes escalonados.
 const hill=(base,amp,step,offset,color)=>{g.beginPath();g.moveTo(0,h);for(let x=-step;x<=w+step;x+=step){const wx=x+camera*offset;const y=Math.round((base+Math.sin(wx*.008)*amp+Math.sin(wx*.019+1.3)*amp*.24)/step)*step;g.lineTo(x,y)}g.lineTo(w,h);g.closePath();g.fillStyle=color;g.fill()};
 hill(304,17,8,.07,"#70d75d");
 hill(325,14,8,.12,"#36b950");
 hill(345,10,8,.18,"#147d45");
 for(let i=0;i<58;i++){
  const x=((i*59-camera*(.06+(i%3)*.025))%(w+44)+(w+44))%(w+44)-22;
  const y=306+(i*23%60),sz=4+(i%4)*3;
  g.fillStyle=["#a4ec62","#65d94b","#2eb84b","#d5f68c"][i%4];g.fillRect(x,y,sz*2,3);g.fillRect(x+sz,y-3,sz,3);
 }

 // Se elimina la capa duplicada de montañas verdes aisladas; las colinas inferiores
 // conectan el paisaje con el terreno y las islas permanecen visibles al fondo.
 g.restore();
}
function traceTerrain(){
 g.beginPath();
 g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=scene.width;x+=4)g.lineTo(x,terrainHeight(camera+x));
}
function drawGround(){
 // Suelo de estilo plataformas clásico: bloques de tierra cálida y una capa
 // de césped gruesa, brillante y legible junto al sprite pixel-art de Sonic.
 const w=scene.width,h=scene.height+CAMERA_FILL_MARGIN+Math.max(0,cameraY),tile=40,grassDepth=23;
 g.save();
 // La tierra sigue exactamente el perfil del terreno, incluso en pendientes.
 g.beginPath();g.moveTo(0,h);g.lineTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,h);g.closePath();g.clip();

 const offsetX=-(((camera%tile)+tile)%tile);
 let minTop=Infinity;
 for(let x=0;x<=w;x+=12)minTop=Math.min(minTop,terrainHeight(camera+x));
 const startY=Math.floor(minTop/tile)*tile;
 for(let y=startY;y<h;y+=tile){
  const row=Math.floor(y/tile);
  const shift=(row%2===0)?0:tile/2;
  for(let x=offsetX-tile;x<w+tile;x+=tile){
   const xx=x+shift,col=Math.floor((xx+camera)/tile);
   const dark=((col+row)%2===0);
   // Cuadrícula checker discreta, sin marcos negros alrededor de cada bloque.
   g.fillStyle=dark?"#a95b36":"#c77740";
   g.fillRect(xx,y,tile,tile);
   g.fillStyle=dark?"#bd7042":"#dc914f";
   g.fillRect(xx+2,y+2,tile-5,2);
   g.fillStyle=dark?"#87472f":"#a65c36";
   g.fillRect(xx+3,y+tile-3,tile-7,2);
   const mark=Math.abs(col*13+row*7)%6;
   if(mark===0){
    g.fillStyle="rgba(246,177,102,.38)";
    g.fillRect(xx+8,y+12,7,2);g.fillRect(xx+13,y+14,5,2);
   }else if(mark===2){
    g.fillStyle="rgba(89,45,31,.24)";
    g.fillRect(xx+20,y+20,9,2);g.fillRect(xx+24,y+22,5,2);
   }else if(mark===4){
    g.fillStyle="rgba(255,199,119,.24)";
    g.fillRect(xx+9,y+27,5,2);
   }
  }
 }
 const soilShade=g.createLinearGradient(0,startY,0,h);
 soilShade.addColorStop(0,"rgba(255,190,103,.02)");
 soilShade.addColorStop(.45,"rgba(83,43,31,.06)");
 soilShade.addColorStop(1,"rgba(35,24,25,.27)");
 g.fillStyle=soilShade;g.fillRect(0,startY,w,h-startY);
 g.restore();

 // Capa de césped continua que acompaña las subidas y bajadas del suelo.
 g.save();g.imageSmoothingEnabled=false;
 g.beginPath();g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,terrainHeight(camera+w)+grassDepth);
 for(let x=w;x>=0;x-=4)g.lineTo(x,terrainHeight(camera+x)+grassDepth);
 g.closePath();g.fillStyle="#12582f";g.fill();

 // Banda media de hierba, con variación pixelada pero sin líneas duras.
 g.beginPath();g.moveTo(0,terrainHeight(camera)+3);
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x)+3);
 g.lineTo(w,terrainHeight(camera+w)+14);
 for(let x=w;x>=0;x-=4)g.lineTo(x,terrainHeight(camera+x)+14);
 g.closePath();g.fillStyle="#218b3c";g.fill();

 // Destellos verdes sobre la parte superior de la hierba.
 for(let x=0;x<w+8;x+=4){
  const gy=terrainHeight(camera+x),slot=Math.abs(Math.floor((camera+x)/24))%5;
  g.fillStyle=slot===0?"#b1f36a":slot===1?"#63d94a":slot===2?"#39bd43":slot===3?"#8de95a":"#2ca747";
  g.fillRect(x,gy+2,4,3);
  if(slot===1||slot===4){g.fillStyle="#d6ff82";g.fillRect(x+1,gy+1,2,1)}
 }

 // Pequeñas briznas sobre el borde: se calculan desde la posición del mundo
 // para que no parpadeen cuando la cámara avanza.
 for(let x=-12;x<w+16;x+=12){
  const wx=Math.floor(camera+x),gy=terrainHeight(wx),seed=Math.abs(Math.floor(wx/12)*17)%7;
  if(seed===0||seed===3||seed===5){
   g.fillStyle=seed===5?"#b5f46b":"#49c947";
   g.fillRect(x,gy-2,3,5);
   g.fillRect(x+2,gy-4-(seed===3?2:0),2,5+(seed===3?2:0));
   if(seed===0){g.fillStyle="#e0ff91";g.fillRect(x+1,gy-2,2,2)}
  }
 }

 // Flores diminutas y espaciadas para dar escala al paisaje sin tapar a Sonic.
 const firstFlower=Math.floor(camera/156)*156;
 for(let wx=firstFlower;wx<camera+w+156;wx+=156){
  const seed=Math.abs(Math.floor(wx/156)*7)%5;
  if(seed!==1&&seed!==4)continue;
  const x=wx-camera+8,gy=terrainHeight(wx+8);
  g.fillStyle="#277f3c";g.fillRect(x+1,gy-3,2,4);
  g.fillStyle=seed===1?"#fff0a1":"#ffd45b";
  g.fillRect(x-1,gy-7,3,3);g.fillRect(x+2,gy-6,3,3);
  g.fillStyle="#f6a52f";g.fillRect(x+1,gy-6,2,2);
 }

 // Sombra fina bajo el borde y línea superior luminosa para separar el camino.
 g.beginPath();g.moveTo(0,terrainHeight(camera)+grassDepth-2);
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x)+grassDepth-2);
 g.strokeStyle="#0b4829";g.lineWidth=2;g.stroke();
 g.beginPath();g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.strokeStyle="#b9f36c";g.lineWidth=2;g.stroke();
 g.restore();

 // Corta visualmente la tierra bajo cada puente y conserva el agua debajo de la pasarela.
 const channelBottom=scene.height+Math.max(0,cameraY)+220;
 for(const bridge of bridgeSpecs){
  const sx=bridge.x-camera,wBridge=bridge.w;
  if(sx>scene.width+10||sx+wBridge< -10)continue;
  let highestGround=Infinity;
  for(let wx=bridge.x;wx<=bridge.x+wBridge;wx+=12)highestGround=Math.min(highestGround,terrainHeight(wx));
  const deckY=bridgeSurfaceY(bridge);
  const cutTop=Math.min(highestGround,deckY)-4;
  const waterY=deckY+72;
  g.save();
  g.fillStyle="#123d59";g.fillRect(sx,cutTop,wBridge,channelBottom-cutTop);
  g.fillStyle="#71442f";g.fillRect(sx,cutTop,9,Math.max(0,waterY-cutTop));
  g.fillRect(sx+wBridge-9,cutTop,9,Math.max(0,waterY-cutTop));
  g.fillStyle="#b56d3d";g.fillRect(sx,cutTop,wBridge,4);
  g.fillStyle="#8b5238";g.fillRect(sx+9,cutTop+8,3,Math.max(0,waterY-cutTop-8));
  g.fillRect(sx+wBridge-12,cutTop+8,3,Math.max(0,waterY-cutTop-8));
  const waterGradient=g.createLinearGradient(0,waterY,0,channelBottom);
  waterGradient.addColorStop(0,"#32b8e4");
  waterGradient.addColorStop(.12,"#1686c5");
  waterGradient.addColorStop(1,"#073c83");
  g.fillStyle=waterGradient;g.fillRect(sx+9,waterY,wBridge-18,channelBottom-waterY);
  g.fillStyle="#8cf4ff";g.fillRect(sx+10,waterY,wBridge-20,3);
  g.fillStyle="#d2fbff";
  for(let i=0;i<12;i++){
   const waveX=sx+14+((i*37+elapsed*38)%(wBridge-34));
   const waveY=waterY+8+(i%3)*15;
   g.fillRect(waveX,waveY,12+(i%4)*5,2);
  }
  g.restore();
 }
}
function drawMountainDetails(){
 const peaks=[22500,25500,28500,31500,34500,37500,40500,43500,46500,49500,51600,54000,56400,58500];
 for(let index=0;index<peaks.length;index++){
  const wx=peaks[index],x=wx-camera,y=terrainHeight(wx);
  if(x< -130||x>scene.width+130)continue;
  g.save();g.imageSmoothingEnabled=false;
  // Las piedras terminan exactamente en la línea del suelo: ninguna parte invade la hierba.
  g.fillStyle="#53676b";g.beginPath();
  g.moveTo(x-74,y);g.lineTo(x-48,y-15);g.lineTo(x-30,y-20);g.lineTo(x-11,y-35);
  g.lineTo(x+5,y-29);g.lineTo(x+27,y-20);g.lineTo(x+66,y);g.closePath();g.fill();
  g.fillStyle="#899e98";g.beginPath();
  g.moveTo(x-48,y);g.lineTo(x-30,y-20);g.lineTo(x-11,y-35);g.lineTo(x+5,y-29);
  g.lineTo(x+17,y-13);g.lineTo(x-2,y-17);g.lineTo(x-15,y-8);g.closePath();g.fill();
  // Nieve y vetas rocosas se mantienen por encima de la superficie.
  g.fillStyle="#e6f7e9";g.beginPath();
  g.moveTo(x-17,y-30);g.lineTo(x-11,y-35);g.lineTo(x+5,y-29);
  g.lineTo(x+11,y-21);g.lineTo(x+1,y-23);g.lineTo(x-5,y-20);g.closePath();g.fill();
  g.fillStyle="#b5d7d5";g.fillRect(x-37,y-14,12,3);g.fillRect(x+23,y-10,15,3);
  g.restore();
 }
}
function drawPalm(wx,variant=0){
 const x=wx-camera;if(x< -340||x>scene.width+340)return;
 const base=terrainHeight(wx);
 // Altura mucho mayor: la copa queda cerca del borde superior y el tronco llega hasta el piso.
 const trunkH=variant%3===0?342:variant%3===1?318:354;
 const crownY=base-trunkH;
 g.save();g.imageSmoothingEnabled=false;
 // Tronco ancho, alto y con bandas pixeladas.
 g.fillStyle="#4d3025";g.fillRect(x-9,crownY+45,18,trunkH-45);
 g.fillStyle="#80502e";g.fillRect(x-6,crownY+48,8,trunkH-53);
 g.fillStyle="#c18343";g.fillRect(x+2,crownY+53,3,trunkH-60);
 for(let yy=crownY+62;yy<base-8;yy+=21){
  g.fillStyle="#4b2d23";g.fillRect(x-9,yy,18,4);
  g.fillStyle="#9b6034";g.fillRect(x-6,yy+5,12,4);
  g.fillStyle="#d08a45";g.fillRect(x-3,yy+6,5,2);
 }
 // Copa amplia, por capas, con hojas que se extienden mucho a ambos lados.
 g.fillStyle="#06452e";
 g.fillRect(x-110,crownY+27,64,13);g.fillRect(x-96,crownY+7,65,13);g.fillRect(x-69,crownY-8,57,13);
 g.fillRect(x-44,crownY-22,43,13);g.fillRect(x+4,crownY-22,43,13);g.fillRect(x+14,crownY-8,57,13);
 g.fillRect(x+31,crownY+7,65,13);g.fillRect(x+46,crownY+27,64,13);
 g.fillStyle="#08743b";
 g.fillRect(x-101,crownY+18,65,13);g.fillRect(x-83,crownY-1,58,13);g.fillRect(x-54,crownY-16,48,13);
 g.fillRect(x+6,crownY-16,48,13);g.fillRect(x+25,crownY-1,58,13);g.fillRect(x+36,crownY+18,65,13);
 g.fillStyle="#20a447";
 g.fillRect(x-88,crownY+13,52,9);g.fillRect(x-68,crownY-6,46,9);g.fillRect(x-43,crownY-22,37,9);
 g.fillRect(x+7,crownY-22,37,9);g.fillRect(x+22,crownY-6,46,9);g.fillRect(x+36,crownY+13,52,9);
 g.fillStyle="#5bd34c";
 g.fillRect(x-77,crownY+14,31,5);g.fillRect(x-58,crownY-5,27,5);g.fillRect(x-34,crownY-21,21,5);
 g.fillRect(x+13,crownY-21,21,5);g.fillRect(x+31,crownY-5,27,5);g.fillRect(x+46,crownY+14,31,5);
 g.fillStyle="#a5ec63";
 g.fillRect(x-66,crownY+15,12,3);g.fillRect(x-48,crownY-4,10,3);g.fillRect(x-26,crownY-20,8,3);
 g.fillRect(x+16,crownY-20,8,3);g.fillRect(x+36,crownY-4,10,3);g.fillRect(x+53,crownY+15,12,3);
 // Cocos y pequeñas sombras bajo la copa.
 g.fillStyle="#754321";g.fillRect(x-8,crownY+28,6,9);g.fillRect(x+1,crownY+30,6,9);g.fillRect(x+8,crownY+26,5,8);
 g.fillStyle="#c4873e";g.fillRect(x-7,crownY+29,2,4);g.fillRect(x+2,crownY+31,2,4);
 g.restore();
}
function drawWoodBridge(bridge){
 const x=bridge.x-camera,w=bridge.w;
 if(x>scene.width+20||x+w< -20)return;
 const top=bridgeSurfaceY(bridge),waterY=top+72;
 g.save();
 // Pilotes de madera que bajan desde la estructura y terminan justo sobre el agua.
 for(let i=22;i<w-10;i+=92){
  g.fillStyle="#513425";g.fillRect(x+i,top+8,9,Math.max(0,waterY-top-10));
  g.fillStyle="#a96b3a";g.fillRect(x+i+2,top+13,3,Math.max(0,waterY-top-17));
  g.fillStyle="#6b4029";g.fillRect(x+i-4,waterY-3,17,4);
 }
 // Vigas inferiores y tablas superiores transitables.
 g.fillStyle="#6f4029";g.fillRect(x,top+7,w,9);
 for(let i=0;i<w;i+=24){
  g.fillStyle=i%48===0?"#bd8246":"#d49a55";g.fillRect(x+i,top,Math.min(21,w-i),10);
  g.fillStyle="#70462d";g.fillRect(x+i,top+8,Math.min(21,w-i),3);
  g.fillStyle="#ffe0a0";g.fillRect(x+i+2,top+1,Math.min(14,w-i-2),2);
 }
 g.fillStyle="#80502d";g.fillRect(x,top-4,w,4);
 // Barandilla baja a ambos lados para dar silueta de puente.
 for(let i=0;i<=w;i+=52){
  g.fillStyle="#7f4b2e";g.fillRect(x+i,top-12,5,12);
  g.fillStyle="#e4bd7a";g.fillRect(x+i+1,top-11,2,7);
 }
 g.restore();
}
function drawRuin(wx,variant=0){
 const x=wx-camera;if(x< -100||x>scene.width+100)return;
 const base=terrainHeight(wx),height=variant%3===0?76:variant%3===1?58:92;
 g.save();g.fillStyle="rgba(24,49,42,.25)";g.fillRect(x-18,base-5,42,6);
 g.fillStyle="#8a6750";g.fillRect(x-15,base-height,30,height);g.fillStyle="#b58c63";g.fillRect(x-10,base-height+4,9,height-8);
 g.fillStyle="#684e45";g.fillRect(x+5,base-height+8,6,height-12);g.fillStyle="#d6b17b";g.fillRect(x-22,base-height-7,44,10);
 g.fillStyle="#73523f";g.fillRect(x-22,base-height-2,44,5);
 for(let y=base-height+20;y<base-12;y+=20){g.fillStyle="#694d40";g.fillRect(x-14,y,28,3);g.fillStyle="#d0a879";g.fillRect(x-11,y+4,7,2)}
 g.fillStyle="#297e45";g.fillRect(x-14,base-height-10,12,3);g.fillRect(x+5,base-height-13,13,4);g.restore();
}
function drawCheckpoint(cp){
 const x=cp.x-camera,base=terrainHeight(cp.x);if(x< -40||x>scene.width+40)return;
 g.save();g.fillStyle="#6b4a32";g.fillRect(x,base-57,5,57);
 g.fillStyle=cp.active?"#ffe45c":"#b9eaff";g.beginPath();g.moveTo(x+5,base-56);g.lineTo(x+35,base-46);g.lineTo(x+5,base-35);g.closePath();g.fill();
 g.fillStyle=cp.active?"#ff9b26":"#1d7bca";g.fillRect(x+8,base-48,8,5);g.restore();
}
function drawFinish(){
 const wx=worldWidth-145,x=wx-camera,base=terrainHeight(wx);if(x< -90||x>scene.width+90)return;
 g.save();g.fillStyle="#74442d";g.fillRect(x,base-104,7,104);g.fillStyle="#fff";g.fillRect(x+7,base-102,50,30);
 for(let row=0;row<3;row++)for(let col=0;col<5;col++){g.fillStyle=(row+col)%2===0?"#fff":"#18324d";g.fillRect(x+7+col*10,base-102+row*10,10,10)}
 g.fillStyle="#ffe45c";g.fillRect(x-6,base-109,19,7);g.fillStyle="#47c85b";g.fillRect(x-12,base-4,30,4);g.restore();
}
function drawUndergroundZone(){
 const left=undergroundZone.entryX-42,right=undergroundZone.exitX+42;
 if(right-camera< -120||left-camera>scene.width+120)return;
 const strokePath=(offset)=>{
  g.beginPath();
  let first=true;
  for(let wx=left;wx<=right;wx+=12){
   const sx=wx-camera,sy=undergroundPathY(wx)-40+offset;
   if(first){g.moveTo(sx,sy);first=false}else g.lineTo(sx,sy);
  }
  g.lineTo(right-camera,undergroundPathY(right)+offset);
 };
 g.save();g.lineCap="round";g.lineJoin="round";
 strokePath(0);g.strokeStyle="#403027";g.lineWidth=112;g.stroke();
 strokePath(0);g.strokeStyle="#76503a";g.lineWidth=101;g.stroke();
 strokePath(0);g.strokeStyle="#211f24";g.lineWidth=84;g.stroke();
 strokePath(-37);g.strokeStyle="#98734d";g.lineWidth=5;g.stroke();
 strokePath(-32);g.strokeStyle="#574234";g.lineWidth=3;g.stroke();
 strokePath(38);g.strokeStyle="#8a6748";g.lineWidth=7;g.stroke();
 strokePath(35);g.strokeStyle="#c08a52";g.lineWidth=2;g.stroke();
 for(let wx=undergroundZone.entryX+310;wx<undergroundZone.exitX-180;wx+=280){
  const sx=wx-camera,sy=undergroundPathY(wx)-40;
  if(sx< -30||sx>scene.width+30)continue;
  g.fillStyle="#574638";g.beginPath();g.moveTo(sx-10,sy-39);g.lineTo(sx-4,sy-53);g.lineTo(sx+3,sy-41);g.lineTo(sx+12,sy-49);g.lineTo(sx+15,sy-37);g.closePath();g.fill();
  if(Math.floor(wx/280)%3===0){
   g.fillStyle="#61e8de";g.beginPath();g.moveTo(sx+25,sy+12);g.lineTo(sx+32,sy+27);g.lineTo(sx+25,sy+37);g.lineTo(sx+19,sy+26);g.closePath();g.fill();
   g.fillStyle="#d1ffff";g.fillRect(sx+23,sy+20,3,8);
  }
 }
 for(const wx of [undergroundZone.entryX,undergroundZone.exitX]){
  const sx=wx-camera,top=groundSurfaceAt(wx);
  if(sx< -100||sx>scene.width+100)continue;
  g.fillStyle="#211b20";g.beginPath();g.ellipse(sx,top+6,42,18,-.05,0,Math.PI*2);g.fill();
  g.strokeStyle="#725039";g.lineWidth=8;g.beginPath();g.ellipse(sx,top+6,43,19,-.05,0,Math.PI*2);g.stroke();
  g.strokeStyle="#a0e75b";g.lineWidth=4;g.beginPath();g.ellipse(sx,top-1,42,10,0,Math.PI,Math.PI*2);g.stroke();
 }
 const entryScreen=undergroundZone.entryX-camera,entryTop=groundSurfaceAt(undergroundZone.entryX);
 if(entryScreen>-120&&entryScreen<scene.width+120){
  g.font="bold 11px Arial";g.textAlign="center";g.textBaseline="bottom";
  g.lineWidth=3;g.strokeStyle="#17452a";g.strokeText("↓ / S  ENTRAR",entryScreen,entryTop-10);
  g.fillStyle="#eaffae";g.fillText("↓ / S  ENTRAR",entryScreen,entryTop-10);
 }
 const exitScreen=undergroundZone.exitX-camera,exitTop=groundSurfaceAt(undergroundZone.exitX);
 if(exitScreen>-120&&exitScreen<scene.width+120){
  g.font="bold 11px Arial";g.textAlign="center";g.textBaseline="bottom";
  g.lineWidth=3;g.strokeStyle="#17452a";g.strokeText("↑  SALIDA",exitScreen,exitTop-10);
  g.fillStyle="#eaffae";g.fillText("↑  SALIDA",exitScreen,exitTop-10);
 }
 g.restore();
}
function drawDecorations(){
 drawAerialRoute();
 for(let wx=260;wx<6800;wx+=610)drawPalm(wx,Math.floor(wx/610)%3);
 for(let wx=7050;wx<11900;wx+=1120)drawPalm(wx,Math.floor(wx/1120)%3);
 bridgeSpecs.forEach(drawWoodBridge);
 for(let wx=17300;wx<20500;wx+=470)drawRuin(wx,Math.floor(wx/470)%3);
 for(let wx=22000;wx<26800;wx+=1320){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/1320)%3);else drawRuin(wx,1)}
 for(let wx=27100;wx<32900;wx+=1050){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/1050)%3);else drawRuin(wx,1)}
 for(let wx=33100;wx<35800;wx+=740)drawPalm(wx,Math.floor(wx/740)%3);
 for(let wx=36100;wx<48100;wx+=980){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/980)%3);else drawRuin(wx,1)}
 for(let wx=48100;wx<59800;wx+=940){if(Math.floor(wx/940)%3===1)drawRuin(wx,Math.floor(wx/940)%3);else drawPalm(wx,Math.floor(wx/940)%3)}
 drawUndergroundZone();checkpoints.forEach(drawCheckpoint);drawFinish();
}
function drawAerialRoute(){
 // El trampolín se dibuja solo cuando está en cámara, pero NO oculta las plataformas cuando queda lejos.
 const sx=aerialSpring.x-camera,sy=springTopY(),sw=aerialSpring.w;
 if(sx>=-sw-20&&sx<=scene.width+20){
  g.save();
  g.fillStyle="rgba(13,43,63,.24)";g.beginPath();g.ellipse(sx+sw/2,sy+10,sw*.72,6,0,0,Math.PI*2);g.fill();
  g.fillStyle="#344e69";g.fillRect(sx+5,sy+5,sw-10,8);g.fillStyle="#8bbed5";g.fillRect(sx+9,sy+7,sw-18,3);
  const compression=elapsed<aerialSpring.flashUntil?7:0,coilBottom=sy+3;
  g.strokeStyle="#e7f4ff";g.lineWidth=4;g.beginPath();g.moveTo(sx+sw/2,coilBottom);
  for(let i=0;i<5;i++)g.lineTo(sx+(i%2===0?sw*.29:sw*.71),coilBottom+4+i*1.2+compression*.18);
  g.stroke();g.fillStyle=elapsed<aerialSpring.flashUntil?"#fff27a":"#ffcb42";g.fillRect(sx,sy-7-compression,sw,9);
  g.fillStyle="#fff4b0";g.fillRect(sx+5,sy-6-compression,sw-10,2);g.fillStyle="#d85831";g.fillRect(sx+4,sy-1-compression,sw-8,3);
  g.fillStyle="#153d65";g.font="bold 10px Arial";g.textAlign="center";g.textBaseline="bottom";g.fillText("¡SALTA!",sx+sw/2,sy-12-compression);g.restore();
 }
 // Plataformas elevadas sobre el relieve y con contornos contrastantes para que se vean contra el cielo.
 for(const p of aerialPlatforms){
  const x=p.x-camera,y=aerialPlatformY(p),w=p.w;
  if(x>scene.width+30||x+w< -30)continue;
  g.save();
  g.fillStyle="rgba(7,42,67,.28)";g.fillRect(x+8,y+22,w-16,7);
  g.fillStyle="#173b55";g.fillRect(x+2,y+6,w-4,21);
  g.fillStyle="#75452e";g.fillRect(x+5,y+8,w-10,15);g.fillStyle="#b87948";g.fillRect(x+8,y+10,w-16,5);
  for(let bx=18;bx<w-14;bx+=38){g.fillStyle="#6c412d";g.fillRect(x+bx,y+15,19,6);g.fillStyle="#d18a50";g.fillRect(x+bx+2,y+16,10,2)}
  g.fillStyle="#115c36";g.fillRect(x,y+3,w,8);g.fillStyle="#24a943";g.fillRect(x+2,y,w-4,6);
  g.fillStyle="#76e64e";for(let gx=10;gx<w-8;gx+=28){g.fillRect(x+gx,y-3,7,5);g.fillRect(x+gx+5,y-1,5,3)}
  g.fillStyle="#eaff91";g.fillRect(x+12,y+1,Math.min(48,w-24),2);
  g.fillStyle="#905735";g.fillRect(x+w*.25,y+27,10,5);g.fillRect(x+w*.68,y+27,12,4);
  g.strokeStyle="#102f49";g.lineWidth=2;g.strokeRect(x+1,y+2,w-2,24);g.restore();
 }
}
function drawBeeProjectile(shot){
 if(!shot.alive)return;
 const x=shot.x-camera,y=shot.y,angle=Math.atan2(shot.vy,shot.vx);
 g.save();g.translate(x,y);g.rotate(angle);
 g.fillStyle="rgba(255,72,34,.25)";g.beginPath();g.ellipse(-5,0,12,6,0,0,Math.PI*2);g.fill();
 g.fillStyle="#6f2036";g.beginPath();g.arc(0,0,8.2,0,Math.PI*2);g.fill();
 const fire=g.createRadialGradient(-2,-2,1,0,0,8);
 fire.addColorStop(0,"#fff7b1");fire.addColorStop(.28,"#ffd34c");fire.addColorStop(.68,"#ff713b");fire.addColorStop(1,"#e63242");
 g.fillStyle=fire;g.beginPath();g.arc(0,0,6.6,0,Math.PI*2);g.fill();
 g.strokeStyle="#fff2a8";g.lineWidth=1.2;g.beginPath();g.arc(-.5,-.5,4.5,Math.PI*1.1,Math.PI*1.75);g.stroke();
 g.fillStyle="#fff";g.beginPath();g.arc(-2.2,-2.2,1.7,0,Math.PI*2);g.fill();g.restore();
}
function drawRing(r){
 if(r.got)return;
 const x=r.x-camera,y=r.y+(r.bouncing?0:Math.sin(elapsed*5+r.x)*2.3);
 const squash=r.bouncing ? .82+.18*Math.abs(Math.sin(elapsed*8+r.x*.018)) : .34+.66*Math.abs(Math.sin(elapsed*3.1+r.x*.018));
 g.save();g.translate(x,y);
 if(r.bouncing)g.rotate(Math.sin(elapsed*13+r.x*.04)*.24);
 g.scale(squash,1);
 // Gold ring: thick shadow, warm gradient, bright edge and a white glint.
 g.strokeStyle="#7c430f";g.lineWidth=9;g.beginPath();g.ellipse(1.5,2,10,13,0,0,Math.PI*2);g.stroke();
 const gold=g.createLinearGradient(-10,-13,10,14);gold.addColorStop(0,"#fff9aa");gold.addColorStop(.26,"#ffed57");gold.addColorStop(.63,"#ffb617");gold.addColorStop(1,"#d97810");
 g.strokeStyle=gold;g.lineWidth=6;g.beginPath();g.ellipse(0,0,9.5,12,0,0,Math.PI*2);g.stroke();
 g.strokeStyle="#fffbd4";g.lineWidth=2.2;g.beginPath();g.ellipse(-1.8,-2,5.4,7.5,0,Math.PI*1.12,Math.PI*1.82);g.stroke();
 g.restore();
}
// Hoja de sprites original de Blue Rush: 4 cuadros por tipo, celdas de 64x64.
const enemySpriteSheet=new Image();
enemySpriteSheet.decoding="async";
enemySpriteSheet.src="./assets/enemies/blue-rush-enemies.svg?v=2";
function drawEnemy(e){
 if(!e.alive)return;
 const type=((e.kind%3)+3)%3;
 if(enemySpriteSheet.complete&&enemySpriteSheet.naturalWidth>=256&&enemySpriteSheet.naturalHeight>=192){
  const frame=((Math.floor(elapsed*8+e.base*.013)%4)+4)%4;
  const screenX=e.x-camera;
  const screenY=e.y+Math.sin(elapsed*(type===2?5.5:4)+e.base)*1.7+(type===2?-7:0);
  const facing=player.x+player.w/2<e.x?-1:1;
  const drawOffsetY=type===2?-39:-33;
  g.save();
  g.translate(screenX,screenY);
  g.scale(facing,1);
  const smoothing=g.imageSmoothingEnabled;
  g.imageSmoothingEnabled=false;
  g.drawImage(enemySpriteSheet,frame*64,type*64,64,64,-32,drawOffsetY,64,64);
  g.imageSmoothingEnabled=smoothing;
  g.restore();
  return;
 }
 // Si la hoja aún no termina de cargar, dibuja la versión de respaldo.
 drawEnemyFallback(e);
}
function drawEnemyFallback(e){
  if(!e.alive)return;
  const type=((e.kind%3)+3)%3,x=e.x-camera,hover=type===2?-7:0;
  const y=e.y+Math.sin(elapsed*(type===2?5.5:4)+e.base)*1.7+hover;
  // Tres diseños originales de robots retro, inspirados en los enemigos de plataformas clásicos.
  g.save();g.translate(x,y);
  if(type!==2)g.scale(player.x+player.w/2<e.x?-1:1,1);
  g.fillStyle="rgba(13,49,76,.24)";g.beginPath();g.ellipse(0,type===2?31:23,type===2?18:24,5,0,0,Math.PI*2);g.fill();
  if(type===0){
   // Robot rodante de caparazón rojo.
   g.fillStyle="#182b43";g.strokeStyle="#07192d";g.lineWidth=2.5;g.beginPath();g.roundRect(-20,-8,40,23,8);g.fill();g.stroke();
   for(const wx of [-14,14]){g.fillStyle="#101b2b";g.beginPath();g.arc(wx,13,8,0,Math.PI*2);g.fill();g.strokeStyle="#617184";g.lineWidth=2;g.stroke();g.fillStyle="#f6a83a";g.beginPath();g.arc(wx,13,3.5,0,Math.PI*2);g.fill();g.fillStyle="#fff0ac";g.fillRect(wx-1,10,2,2)}
   g.fillStyle="#667d91";g.fillRect(-13,-18,8,12);g.fillStyle="#d7e6ed";g.fillRect(-12,-17,3,8);g.fillStyle="#203950";g.fillRect(-16,-9,31,7);
   const red=g.createLinearGradient(0,-17,0,9);red.addColorStop(0,"#ff8168");red.addColorStop(.35,"#f43e3d");red.addColorStop(1,"#a91932");
   g.fillStyle=red;g.strokeStyle="#651b32";g.lineWidth=2.3;g.beginPath();g.moveTo(-20,1);g.lineTo(-18,-9);g.quadraticCurveTo(-14,-17,0,-17);g.quadraticCurveTo(16,-16,19,-7);g.lineTo(20,2);g.quadraticCurveTo(0,11,-20,2);g.closePath();g.fill();g.stroke();
   g.fillStyle="#ffd5b9";g.beginPath();g.ellipse(8,-5,6,7,0,0,Math.PI*2);g.fill();g.fillStyle="#f8ffff";g.beginPath();g.ellipse(10,-5,3.4,4.5,0,0,Math.PI*2);g.fill();g.fillStyle="#172943";g.beginPath();g.ellipse(11,-4,1.7,3.1,0,0,Math.PI*2);g.fill();g.fillStyle="#ffdf78";g.fillRect(15,2,5,3);g.fillStyle="#82e8ff";g.fillRect(-13,-3,4,3);g.fillStyle="#ffb25b";g.fillRect(-8,-13,9,2);
  }else if(type===1){
   // Cangrejo mecánico con pinzas, patas articuladas y ojos elevados.
   g.strokeStyle="#273c55";g.lineWidth=3.5;g.lineCap="round";
   for(const leg of [-15,-5,6,16]){g.beginPath();g.moveTo(leg*.72,8);g.lineTo(leg+(leg<0?-3:3),16);g.lineTo(leg+(leg<0?-5:5),19);g.stroke()}
   g.strokeStyle="#8c2735";g.lineWidth=5;g.beginPath();g.moveTo(-13,-1);g.lineTo(-20,-8);g.lineTo(-23,-5);g.moveTo(13,-1);g.lineTo(20,-8);g.lineTo(23,-5);g.stroke();
   g.fillStyle="#ef5146";g.strokeStyle="#6e1b35";g.lineWidth=2.4;g.beginPath();g.ellipse(-23,-5,5.5,7,-.45,0,Math.PI*2);g.ellipse(23,-5,5.5,7,.45,0,Math.PI*2);g.fill();g.stroke();g.fillStyle="#ffd16b";g.beginPath();g.arc(-24,-7,2,0,Math.PI*2);g.arc(24,-7,2,0,Math.PI*2);g.fill();
   g.fillStyle="#b9233d";g.strokeStyle="#641b33";g.lineWidth=2.5;g.beginPath();g.moveTo(-17,2);g.quadraticCurveTo(-19,-12,-10,-16);g.quadraticCurveTo(0,-21,10,-16);g.quadraticCurveTo(19,-11,17,2);g.quadraticCurveTo(0,15,-17,2);g.closePath();g.fill();g.stroke();g.fillStyle="#ff7960";g.beginPath();g.ellipse(-2,-12,11,4,-.08,0,Math.PI*2);g.fill();
   g.strokeStyle="#d8e5ec";g.lineWidth=2.5;g.beginPath();g.moveTo(-7,-13);g.lineTo(-8,-21);g.moveTo(6,-13);g.lineTo(8,-21);g.stroke();g.fillStyle="#f9f5de";g.strokeStyle="#69263b";g.lineWidth=1.5;g.beginPath();g.ellipse(-8,-22,4.5,5.5,0,0,Math.PI*2);g.ellipse(8,-22,4.5,5.5,0,0,Math.PI*2);g.fill();g.stroke();g.fillStyle="#192b43";g.beginPath();g.ellipse(-6.5,-21,1.8,3,0,0,Math.PI*2);g.ellipse(9.5,-21,1.8,3,0,0,Math.PI*2);g.fill();g.fillStyle="#ffdc77";g.fillRect(-7,4,14,3);g.fillStyle="#8defff";g.fillRect(-3,-2,6,3);
  }else{
   // Robot volador con alas, abdomen rayado y pequeño aguijón.
   const flap=Math.sin(elapsed*17+e.base)*3;g.fillStyle="rgba(93,207,255,.72)";g.strokeStyle="#214b70";g.lineWidth=1.8;g.beginPath();g.ellipse(-10,-13,8,12,-.55+flap*.025,0,Math.PI*2);g.ellipse(7,-14,8,12,.55-flap*.025,0,Math.PI*2);g.fill();g.stroke();g.strokeStyle="#b6f5ff";g.lineWidth=1.2;g.beginPath();g.moveTo(-14,-20);g.lineTo(-10,-14);g.moveTo(4,-21);g.lineTo(7,-14);g.stroke();
   g.fillStyle="#26374b";g.strokeStyle="#0b1d35";g.lineWidth=2.5;g.beginPath();g.ellipse(-1,3,12,15,-.08,0,Math.PI*2);g.fill();g.stroke();g.fillStyle="#f7c737";g.strokeStyle="#80521b";g.lineWidth=1.6;g.beginPath();g.ellipse(1,4,10,13,-.08,0,Math.PI*2);g.fill();g.stroke();
   g.save();g.beginPath();g.ellipse(1,4,9,12,-.08,0,Math.PI*2);g.clip();g.fillStyle="#26374b";g.beginPath();g.moveTo(-9,-8);g.lineTo(-3,-8);g.lineTo(8,14);g.lineTo(2,16);g.closePath();g.fill();g.beginPath();g.moveTo(1,-9);g.lineTo(7,-8);g.lineTo(12,1);g.lineTo(7,3);g.closePath();g.fill();g.restore();
   g.fillStyle="#d6e1e9";g.strokeStyle="#26374b";g.lineWidth=2;g.beginPath();g.ellipse(7,-8,10,8,-.15,0,Math.PI*2);g.fill();g.stroke();g.fillStyle="#ffdf4d";g.beginPath();g.ellipse(8,-8,7,5,0,0,Math.PI*2);g.fill();g.fillStyle="#fff";g.beginPath();g.ellipse(10,-9,3.1,3.8,0,0,Math.PI*2);g.fill();g.fillStyle="#162944";g.beginPath();g.arc(11,-8,1.7,0,Math.PI*2);g.fill();g.fillStyle="#e83c4a";g.strokeStyle="#791f37";g.lineWidth=1.5;g.beginPath();g.moveTo(-10,7);g.lineTo(-22,11);g.lineTo(-12,1);g.closePath();g.fill();g.stroke();g.fillStyle="#172a43";g.fillRect(-5,14,6,5);g.fillRect(7,13,6,5);g.fillStyle="#79eaff";g.fillRect(12,-4,4,3);g.fillStyle="#fff3a1";g.fillRect(4,-14,5,2);
  }
  g.restore();
}
/* Atlas de Tails: hoja de sprites de 9 × 9 celdas, ya incluida en assets/Tails. */
const TAILS_SHEET_PATH="./assets/Tails/tailssheet.png";
const TAILS_ATLAS_COLUMNS=9,TAILS_ATLAS_ROWS=9;
let tailsAnimations={idle:[],run:[],dash:[],speeddash:[],jump:[],fall:[],tired:[],fly:[],swim:[],tailsAttack:[],spin:[],spindash:[],spinDashCrouch:[],spinDashRevCharge:[],spinDashRevUp:[],spinDashRevDown:[],peeloutCharge:[],peeloutLoop:[],peeloutBurst:[],turn:[],airspin:[],airup:[],stomp:[],flick:[],wait:[],ready:false};
const TAILS_ANIMATION_TIMINGS={
 idle:{times:[0,.1,.2,.3,.4,.5],duration:.56,loop:true},
 run:{times:[0,.142857,.285714,.428571,.571429,.714286],duration:.9,loop:true},
 dash:{times:[0,.1,.2,.3,.4,.5,.6],duration:.7,loop:true},
 speeddash:{times:[0,.1,.2],duration:.3,loop:true},
 jump:{times:[0,.05,.1,.15],duration:.2,loop:true},
 fall:{times:[0],duration:.15,loop:true},
 tired:{times:[0],duration:.15,loop:true},
 fly:{times:[0,.1,.2],duration:.3,loop:true},
 swim:{times:[0,.1,.2],duration:.3,loop:true},
 tailsAttack:{times:[0,.066667,.133333,.2,.233333],duration:.25,loop:false},
 spin:{times:[0,.05,.1,.15],duration:.2,loop:true},
 spinDashCrouch:{times:[0],duration:.11,loop:false},
 spinDashRevCharge:{times:[0,.033333],duration:.0667,loop:false},
 spinDashRevUp:{times:[0,.066667,.133333],duration:.2,loop:true},
 spinDashRevDown:{times:[0,.1,.2],duration:.3,loop:true},
 turn:{times:[0,.033333,.066667],duration:.3,loop:false},
 airspin:{times:[0,.05,.1,.15],duration:.2,loop:true},
 airup:{times:[0,.05,.1,.15,.2,.25,.3,.35,.4],duration:.45,loop:true},
 stomp:{times:[0,.1],duration:.2,loop:false},
 flick:{times:[0,.066667],duration:.15,loop:false},
 wait:{times:[0,.1,.2,.5,.6],duration:.8,loop:true}
};
function tailsAnimationFrameIndex(animation,phase,frames){
 const meta=TAILS_ANIMATION_TIMINGS[animation]||{step:.1,duration:frames.length*.1,loop:true};
 const time=Math.max(0,Number(phase)||0);
 if(animation==="spindash"||animation.startsWith("peelout"))
  return Math.max(0,Math.min(frames.length-1,Math.floor(Math.min(.999999,time)*frames.length)));
 const t=meta.loop&&meta.duration?time%meta.duration:Math.min(time,Math.max(0,(meta.duration||time)-.000001));
 let index=0;
 if(meta.times){for(let i=1;i<meta.times.length;i++){if(t>=meta.times[i])index=i;else break;}}
 else index=Math.floor(t/(meta.step||.1));
 return Math.max(0,Math.min(frames.length-1,index));
}
function loadTailsSheetFrame(sheet,frameIndex){
 const total=TAILS_ATLAS_COLUMNS*TAILS_ATLAS_ROWS;if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=total)return null;
 const cw=sheet.naturalWidth/TAILS_ATLAS_COLUMNS,ch=sheet.naturalHeight/TAILS_ATLAS_ROWS,col=frameIndex%TAILS_ATLAS_COLUMNS,row=Math.floor(frameIndex/TAILS_ATLAS_COLUMNS);
 const sx=Math.round(col*cw),sy=Math.round(row*ch),sw=Math.round((col+1)*cw)-sx,sh=Math.round((row+1)*ch)-sy;
 const probe=document.createElement("canvas");probe.width=sw;probe.height=sh;const pctx=probe.getContext("2d",{willReadFrequently:true});if(!pctx)return null;
 try{pctx.drawImage(sheet,sx,sy,sw,sh,0,0,sw,sh);const px=pctx.getImageData(0,0,sw,sh).data;let l=sw,t=sh,r=-1,b=-1;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(px[(y*sw+x)*4+3]>18){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}
  if(r<l||b<t)return null;
  // Conserva la celda original: el recorte transparente no debe cambiar el pivote
  // del personaje entre fotogramas de una misma animación.
  return {img:sheet,cell:{x:sx,y:sy,width:sw,height:sh},bounds:{x:sx+l,y:sy+t,width:r-l+1,height:b-t+1}};
 }catch(error){
  console.warn("[Blue Rush] No se pudo recortar un sprite de Tails:",error);
  return {img:sheet,cell:{x:sx,y:sy,width:sw,height:sh},bounds:{x:sx,y:sy,width:sw,height:sh}};
 }
}
function tailsSheetFrames(sheet,indices){return indices.map(index=>loadTailsSheetFrame(sheet,index)).filter(Boolean)}
// Hoja original de Knuckles usada por la escena fuente: 10 columnas x 9 filas,
// celdas de 64 px. Los índices de animación son los mismos que Godot Sprite2D.
const KNUCKLES_SHEET_PATH='./assets/knuckles/knucklesheet-sauce.png';
const KNUCKLES_ATLAS_COLUMNS=10,KNUCKLES_ATLAS_ROWS=9,KNUCKLES_CELL_SIZE=64;
const KNUCKLES_SOURCE_FRAME_MAP={
 idle:[0,1,2,3,4,0],
 spin:[7,8,9,10],
 run:[11,12,13,14,15,16],
 dash:[21,22,23,24,25,26,27,28],
 maxSpeed:[47,48,49],
 glide:[58,59], // Cuadros fly declarados por la animación oficial de Knuckles.tscn.
 jump:[29,30,31,32],
 fall:[81,82],
 punch:[70,71,72,73,19]
};
// La hoja del juego es una copia exacta de la hoja fuente: no se desplaza,
// elimina ni recalcula ninguna columna.
const KNUCKLES_FRAME_MAP=Object.fromEntries(Object.entries(KNUCKLES_SOURCE_FRAME_MAP).map(([name,indices])=>[
 name,indices.slice()
]));
let knucklesAnimations={idle:[],run:[],dash:[],maxSpeed:[],spin:[],glide:[],jump:[],fall:[],punch:[],ready:false};
function loadKnucklesFrames(sheet,indices){
 const columns=KNUCKLES_ATLAS_COLUMNS,rows=KNUCKLES_ATLAS_ROWS,size=KNUCKLES_CELL_SIZE;
 if(sheet.naturalWidth!==columns*size||sheet.naturalHeight!==rows*size){
  console.error('[Blue Rush] El atlas original de Knuckles debe medir 640 × 576:',sheet.naturalWidth,sheet.naturalHeight);
  return [];
 }
 const scan=document.createElement('canvas');scan.width=size;scan.height=size;
 const scanCtx=scan.getContext('2d',{willReadFrequently:true});
 return indices.map(index=>{
  if(!Number.isInteger(index)||index<0||index>=columns*rows)return null;
  const col=index%columns,row=Math.floor(index/columns),x=col*size,y=row*size;
  const cell={x,y,width:size,height:size};
  // Recorta transparencia y centra el contenido real de cada fotograma.
  scanCtx.clearRect(0,0,size,size);
  scanCtx.drawImage(sheet,x,y,size,size,0,0,size,size);
  const pixels=scanCtx.getImageData(0,0,size,size).data;
  let minX=size,minY=size,maxX=-1,maxY=-1;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
   if(pixels[(py*size+px)*4+3]>18){
    if(px<minX)minX=px;if(px>maxX)maxX=px;
    if(py<minY)minY=py;if(py>maxY)maxY=py;
   }
  }
  const bounds=maxX>=minX&&maxY>=minY
   ?{x:x+minX,y:y+minY,width:maxX-minX+1,height:maxY-minY+1}
   :cell;
  return {img:sheet,cell,bounds,index};
 }).filter(Boolean);
}
function loadKnucklesSprites(){
 const sheet=new Image();
 sheet.onload=()=>{
  const frames=name=>loadKnucklesFrames(sheet,KNUCKLES_FRAME_MAP[name]);
  knucklesAnimations={
   idle:frames('idle'),run:frames('run'),dash:frames('dash'),maxSpeed:frames('maxSpeed'),
   spin:frames('spin'),glide:frames('glide'),jump:frames('jump'),fall:frames('fall'),
   punch:frames('punch'),ready:true
  };
  console.info('[Blue Rush] Atlas local de Knuckles cargado',{
   size:[sheet.naturalWidth,sheet.naturalHeight],grid:'10x9 original (sin conversión)',cell:[64,64],
   sourceFrames:KNUCKLES_SOURCE_FRAME_MAP,atlasFrames:KNUCKLES_FRAME_MAP,animations:Object.fromEntries(Object.entries(knucklesAnimations).filter(([name])=>name!=='ready').map(([name,items])=>[name,items.length]))
  });
 };
 sheet.onerror=()=>{knucklesAnimations.ready=false;console.error('[Blue Rush] No se pudo cargar:',KNUCKLES_SHEET_PATH)};
 sheet.src=KNUCKLES_SHEET_PATH+'?v=knuckles-glide-source-frames-58-59-20261107-3';
}
function drawKnucklesCharacter(screenX,screenY,options={}){
 const animation=options.animation||'idle',phase=Math.max(0,Number(options.phase)||0);
 if(!knucklesAnimations.ready){
  drawVectorCharacter('knuckles',screenX,screenY,{
   facing:options.facing,moving:animation==='run'||animation==='dash'||animation==='maxSpeed',
   rolling:animation==='spin',falling:animation==='jump'||animation==='fall',
   phase,spinAngle:options.spinAngle,gliding:animation==='glide',punching:animation==='punch'
  });
  return;
 }
 const name=['idle','run','dash','maxSpeed','spin','glide','jump','fall','punch'].includes(animation)?animation:'idle';
 const frames=knucklesAnimations[name]||[];
 // Respaldo seguro: si falta una secuencia, no reutiliza cuadros de otra acción.
 if(!frames.length){
  drawVectorCharacter('knuckles',screenX,screenY,{
   facing:options.facing,moving:animation==='run'||animation==='dash'||animation==='maxSpeed',
   rolling:animation==='spin',falling:animation==='jump'||animation==='fall',
   phase,spinAngle:options.spinAngle,gliding:animation==='glide',punching:animation==='punch'
  });
  return;
 }
 const fps=name==='idle'?10:name==='run'||name==='glide'?6.7:name==='dash'?13.3:name==='maxSpeed'?10:name==='fall'?13.3:name==='punch'?15:20;
 const frameIndex=name==='punch'
  ?Math.min(frames.length-1,Math.floor(phase*frames.length))
  :Math.floor(phase*fps)%frames.length;
 const entry=frames[frameIndex],img=entry.img,c=entry.cell,b=entry.bounds||c;
 const scale=Math.min(88/c.width,86/c.height);
 const dw=b.width*scale,dh=b.height*scale;
 // Pivote fijo en el centro de la celda, igual que Sprite2D en la escena original.
 const dx=(b.x-c.x-c.width/2)*scale;
 const dy=(b.y-c.y-c.height/2)*scale;
 const smoothing=g.imageSmoothingEnabled;
 g.save();g.translate(Math.round(screenX),Math.round(screenY));
 if(Number(options.facing)<0)g.scale(-1,1);
 if(animation==='maxSpeed'){
  g.save();g.strokeStyle='#c9f4ff';g.lineWidth=2;g.globalAlpha=.72;g.beginPath();
  for(let i=0;i<3;i++){const yy=-14+i*12;g.moveTo(-42,yy);g.lineTo(-23,yy-2);}
  g.stroke();g.restore();
 }
 g.imageSmoothingEnabled=false;
 g.drawImage(img,b.x,b.y,b.width,b.height,dx,dy,dw,dh);
 g.imageSmoothingEnabled=smoothing;g.restore();
}
loadKnucklesSprites();

function loadTailsSprites(){
 const sheet=new Image();sheet.onload=()=>{
  // Mapeo de las animaciones del proyecto original Sonic Escape de SauceK.
  // La escena Tails.tscn confirma una cuadrícula de 9 × 9 celdas.
  tailsAnimations={
   idle:tailsSheetFrames(sheet,[0,1,2,3,4,0]),             // stance
   run:tailsSheetFrames(sheet,[11,12,13,14,15,16]),         // run
   dash:tailsSheetFrames(sheet,[21,22,23,24,26,27,28]),     // Dash
   speeddash:tailsSheetFrames(sheet,[47,48,49]),            // Dash max
   jump:tailsSheetFrames(sheet,[7,8,9,10]),               // jump: Tails se encoge en una bolita
   fall:tailsSheetFrames(sheet,[7,8,9,10]),                  // mantiene la bolita durante toda la caída
   tired:tailsSheetFrames(sheet,[69]),                 // pose hurt del atlas: Tails agotado
   fly:tailsSheetFrames(sheet,[76,77,78]),                  // fly
   swim:tailsSheetFrames(sheet,[76,77,78]),                 // custom swim reuses tail-propeller frames
   tailsAttack:tailsSheetFrames(sheet,[70,71,72,73,19]),    // swipe
   spin:tailsSheetFrames(sheet,[7,8,9,10]),                  // ball
   spindash:tailsSheetFrames(sheet,[35,56,57,38,39,40,53,54,55]),
   spinDashCrouch:tailsSheetFrames(sheet,[35]),
   spinDashRevCharge:tailsSheetFrames(sheet,[56,57]),
   spinDashRevUp:tailsSheetFrames(sheet,[38,39,40]),
   spinDashRevDown:tailsSheetFrames(sheet,[53,54,55]),
   peeloutCharge:tailsSheetFrames(sheet,[74,75,76,77]),
   peeloutLoop:tailsSheetFrames(sheet,[74,75,76,77]),
   peeloutBurst:tailsSheetFrames(sheet,[47,48,49]),
   turn:tailsSheetFrames(sheet,[17,18,19]),
   airspin:tailsSheetFrames(sheet,[36,37,38,39]),
   airup:tailsSheetFrames(sheet,[68,61,62,63,64,65,66,67,68]),
   stomp:tailsSheetFrames(sheet,[59,60]),
   flick:tailsSheetFrames(sheet,[33,34]),
   wait:tailsSheetFrames(sheet,[50,51,52]),
   ready:true
  };
  for(const name of Object.keys(tailsAnimations)){
   if(name==="ready")continue;
   if(!tailsAnimations[name].length)tailsAnimations[name]=tailsAnimations.idle;
  }
  console.info("[Blue Rush] Sprites de Tails cargados",{width:sheet.naturalWidth,height:sheet.naturalHeight,run:tailsAnimations.run.length,fly:tailsAnimations.fly.length,swim:tailsAnimations.swim.length,attack:tailsAnimations.tailsAttack.length});
 };
 sheet.onerror=()=>{tailsAnimations.ready=false;console.error("[Blue Rush] No se pudo cargar la hoja de sprites de Tails:",TAILS_SHEET_PATH)};
 sheet.src=TAILS_SHEET_PATH+"?v=tails-ball-jump-4";
}
function drawTailsCharacter(screenX,screenY,options={}){
 const animation=options.animation||"idle",phase=Number(options.phase)||0;
 const frames=tailsAnimations[animation]&&tailsAnimations[animation].length?tailsAnimations[animation]:tailsAnimations.idle;
 if(!frames.length){drawVectorCharacter("tails",screenX,screenY,{facing:options.facing,moving:["run","dash","speeddash"].includes(animation),falling:["jump","fall","tired","fly","swim"].includes(animation),phase});return}
 const index=tailsAnimationFrameIndex(animation,phase,frames),entry=frames[index],img=entry&&entry.img,b=entry&&entry.bounds;
 if(!img||!img.naturalWidth||!b||!b.width||!b.height){drawVectorCharacter("tails",screenX,screenY,{facing:options.facing,moving:["run","dash","speeddash"].includes(animation),falling:["jump","fall","tired","fly","swim"].includes(animation),phase});return}
 const cell=entry.cell||{x:b.x,y:b.y,width:b.width,height:b.height};
 // Igual que Sprite2D en Tails.tscn: centro de la celda y escala constante.
 // Tails necesitaba mayor presencia visual: aumenta el tamaño un 35 % aprox.,
 // conservando la escala uniforme y el centro de cada celda.
 // Aumenta ligeramente la escala de Tails conservando el centro de cada fotograma.
 const scale=Math.min(88/cell.width,86/cell.height),dw=b.width*scale,dh=b.height*scale;
 const drawX=(b.x-cell.x-cell.width/2)*scale;
 const drawY=(b.y-cell.y-cell.height/2)*scale;
 const smoothing=g.imageSmoothingEnabled;
 g.save();g.translate(Math.round(screenX),Math.round(screenY));
 if(Number(options.facing)<0)g.scale(-1,1);
 g.imageSmoothingEnabled=false;g.drawImage(img,b.x,b.y,b.width,b.height,drawX,drawY,dw,dh);
 g.imageSmoothingEnabled=smoothing;g.restore();
}
loadTailsSprites();

/* Atlas de juego de SauceKye: 10 columnas × 9 filas.
   La animación run usa los fotogramas 11–16, igual que Sonic Escape. */
const SONIC_SHEET_PATH="./assets/Sonic/sonicsheet-game-atlas.png";
const SONIC_ATLAS_COLUMNS=10;
const SONIC_ATLAS_ROWS=9;
const SONIC_MAX_SPEED_THRESHOLD=640;
const SUPER_PEELOUT_LAUNCH_ANIM_DURATION=.3;
const SUPER_PEELOUT_BURST_DURATION=1.9;
let sonicAnimations={idle:[],run:[],dash:[],speeddash:[],jump:[],spin:[],spindash:[],spinDashCrouch:[],spinDashRevCharge:[],spinDashRevUp:[],spinDashRevDown:[],spinDashBall:[],fall:[],peelOutCharge:[],peelOutLoop:[],peelOutBurst:[],ready:false};

function loadSonicSheetFrame(sheet,frameIndex){
 const totalFrames=SONIC_ATLAS_COLUMNS*SONIC_ATLAS_ROWS;
 if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=totalFrames)return null;
 const cellWidth=sheet.naturalWidth/SONIC_ATLAS_COLUMNS;
 const cellHeight=sheet.naturalHeight/SONIC_ATLAS_ROWS;
 const col=frameIndex%SONIC_ATLAS_COLUMNS,row=Math.floor(frameIndex/SONIC_ATLAS_COLUMNS);
 const sx=Math.round(col*cellWidth),sy=Math.round(row*cellHeight);
 const sw=Math.round((col+1)*cellWidth)-sx,sh=Math.round((row+1)*cellHeight)-sy;
 const probe=document.createElement("canvas");
 probe.width=sw;probe.height=sh;
 const pctx=probe.getContext("2d",{willReadFrequently:true});
 if(!pctx)return null;
 try{
  pctx.drawImage(sheet,sx,sy,sw,sh,0,0,sw,sh);
  const pixels=pctx.getImageData(0,0,sw,sh).data;
  let left=sw,top=sh,right=-1,bottom=-1;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   if(pixels[(y*sw+x)*4+3]>18){
    if(x<left)left=x;if(x>right)right=x;
    if(y<top)top=y;if(y>bottom)bottom=y;
   }
  }
  if(right<left||bottom<top)return null;
  return {file:"frame-"+frameIndex,img:sheet,cell:{x:sx,y:sy,width:sw,height:sh},bounds:{x:sx+left,y:sy+top,width:right-left+1,height:bottom-top+1}};
 }catch(error){
  console.warn("[Blue Rush] No se pudo recortar el fotograma "+frameIndex,error);
  return {file:"frame-"+frameIndex,img:sheet,bounds:{x:sx,y:sy,width:sw,height:sh}};
 }
}
function sonicSheetFrames(sheet,indices){
 return indices.map(index=>loadSonicSheetFrame(sheet,index)).filter(Boolean);
}
function loadSonicCostumes(){
 const sheet=new Image();
 sheet.onload=()=>{
  const stance=sonicSheetFrames(sheet,[0,1,2,3,4,0]);
  const run=sonicSheetFrames(sheet,[11,12,13,14,15,16]);
  const result={
   idle:stance,
   run,
   // Mantén la misma zancada a cualquier velocidad: no se usan poses de ataque al correr.
   dash:run,
   // Fotogramas originales de la animación Dash max de SauceKye.
   speeddash:sonicSheetFrames(sheet,[48,49,50]),
   jump:sonicSheetFrames(sheet,[29,30,31,32]),
   spin:sonicSheetFrames(sheet,[7,8,9,10]),
   // Secuencia oficial Spin Dash de SauceKye/Sonic Escape.
   spinDashCrouch:sonicSheetFrames(sheet,[35]),
   spinDashRevCharge:sonicSheetFrames(sheet,[57,58]),
   spinDashRevUp:sonicSheetFrames(sheet,[40,41,42]),
   spinDashRevDown:sonicSheetFrames(sheet,[54,55,56]),
   spinDashBall:sonicSheetFrames(sheet,[7,8,9,10]),
   spindash:sonicSheetFrames(sheet,[35,57,58,40,41,42,54,55,56]),
   fall:sonicSheetFrames(sheet,[80,81]),
   // Secuencias originales de Sonic Escape:
   // Revpeelout = preparación, peel out = carga sostenida, Dash max = salida.
   peelOutCharge:sonicSheetFrames(sheet,[82,83,84,85,86,87]),
   peelOutLoop:sonicSheetFrames(sheet,[74,75,76,77]),
   peelOutBurst:sonicSheetFrames(sheet,[48,49,50])
  };
  if(!result.idle.length&&result.run.length)result.idle=[result.run[0]];
  if(!result.run.length&&result.idle.length)result.run=result.idle;
  if(!result.jump.length)result.jump=result.run;
  if(!result.fall.length)result.fall=result.jump;
  if(!result.spin.length)result.spin=result.run;
  if(!result.spindash.length)result.spindash=result.spin;
  if(!result.speeddash.length)result.speeddash=result.run;
  sonicAnimations={
   idle:result.idle,run:result.run,dash:result.dash,speeddash:result.speeddash,
   jump:result.jump,spin:result.spin,spindash:result.spindash,
   spinDashCrouch:result.spinDashCrouch,spinDashRevCharge:result.spinDashRevCharge,
   spinDashRevUp:result.spinDashRevUp,spinDashRevDown:result.spinDashRevDown,spinDashBall:result.spinDashBall,
   fall:result.fall,peelOutCharge:result.peelOutCharge,peelOutLoop:result.peelOutLoop,peelOutBurst:result.peelOutBurst,
   ready:Boolean(result.idle.length&&result.run.length&&result.spin.length)
  };
  console.info("Blue Rush: atlas de Sonic Escape cargado",{
   width:sheet.naturalWidth,height:sheet.naturalHeight,
   idle:sonicAnimations.idle.length,run:sonicAnimations.run.length,
   jump:sonicAnimations.jump.length,spin:sonicAnimations.spin.length,fall:sonicAnimations.fall.length
  });
  if(!running)status.textContent=sonicAnimations.ready
   ?"CARRERA DE SONIC CORREGIDA · PULSA JUGAR"
   :"NO SE PUDIERON LEER LOS SPRITES DE SONIC · REVISA EL ATLAS";
 };
 sheet.onerror=()=>{
  sonicAnimations.ready=false;
  console.error("[Blue Rush] No se pudo cargar "+SONIC_SHEET_PATH);
  if(!running)status.textContent="NO SE CARGÓ EL ATLAS DE SONIC · RECARGA LA PÁGINA";
 };
 sheet.src=SONIC_SHEET_PATH+"?v=saucekye-run-1";
}
loadSonicCostumes();

function drawFallbackPlayer(){
 const x=player.x-camera+player.w/2,y=player.y+player.h/2;
 g.save();g.translate(x,y);
 if(player.spin){
  g.rotate(player.spinAngle||0);
  g.fillStyle="#087cec";g.strokeStyle="#064b9d";g.lineWidth=3;
  g.beginPath();g.arc(0,0,17,0,Math.PI*2);g.fill();g.stroke();
  g.beginPath();g.moveTo(-12,-10);g.lineTo(-23,-18);g.lineTo(-18,-5);g.lineTo(-22,2);g.lineTo(-13,5);g.lineTo(-19,15);g.lineTo(-5,12);g.lineTo(3,21);g.lineTo(8,11);g.lineTo(19,13);g.lineTo(13,2);g.lineTo(21,-7);g.lineTo(9,-8);g.lineTo(4,-19);g.lineTo(-3,-10);g.closePath();g.fill();g.stroke();
  g.fillStyle="#e9f6ff";g.beginPath();g.ellipse(1,-2,7,9,-.25,0,Math.PI*2);g.fill();
  g.restore();return;
 }
 g.scale(player.facing,1);
 // El sustituto vectorial mantiene la postura erguida mientras se carga el sprite.
 // Sustituto vectorial solo mientras se cargan los disfraces.
 g.fillStyle="rgba(20,61,110,.18)";g.beginPath();g.ellipse(0,23,17,4,0,0,Math.PI*2);g.fill();
 g.fillStyle="#074fa8";g.beginPath();g.moveTo(-14,-9);g.lineTo(-20,-20);g.lineTo(-8,-16);g.lineTo(-4,-26);g.lineTo(3,-17);g.lineTo(14,-18);g.lineTo(12,-7);g.lineTo(15,5);g.lineTo(8,14);g.lineTo(-7,13);g.closePath();g.fill();
 g.fillStyle="#087cec";g.beginPath();g.ellipse(1,-5,14,17,-.12,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.beginPath();g.ellipse(5,-10,5,8,-.12,0,Math.PI*2);g.fill();
 g.fillStyle="#082751";g.beginPath();g.ellipse(7,-8,2.2,4,0,0,Math.PI*2);g.fill();
 g.fillStyle="#ffd0a0";g.beginPath();g.ellipse(7,2,8,5,0,0,Math.PI*2);g.fill();
 g.strokeStyle="#9e4d29";g.lineWidth=1.5;g.beginPath();g.moveTo(2,4);g.quadraticCurveTo(7,7,11,3);g.stroke();
 g.fillStyle="#f12a43";g.beginPath();g.ellipse(-5,17,10,5,-.15,0,Math.PI*2);g.ellipse(10,17,9,5,.1,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.fillRect(-12,15,11,2);g.fillRect(5,15,10,2);
 g.restore();
}function drawHomingTarget(){
 if(!player||!player.homingActive||!player.homingTargetId)return;
 const target=enemies.find(enemy=>enemy.id===player.homingTargetId&&enemy.alive);
 if(!target)return;
 const x=target.x-camera,y=target.y-8;
 const pulse=2+Math.sin(elapsed*20)*2;
 g.save();g.strokeStyle="#ffe45b";g.lineWidth=2;g.beginPath();g.arc(x,y,17+pulse,0,Math.PI*2);g.stroke();
 g.beginPath();g.moveTo(x-25,y);g.lineTo(x-11,y);g.moveTo(x+11,y);g.lineTo(x+25,y);
 g.moveTo(x,y-25);g.lineTo(x,y-11);g.moveTo(x,y+11);g.lineTo(x,y+25);g.stroke();g.restore();
}
function drawPlayer(){
 const x=player.x-camera+player.w/2,y=player.y+player.h/2;
 if(player.invincible>0&&Math.floor(elapsed*16)%2===0)return;
 if(selectedCharacterId==='tails'){
  const speedRatio=Math.min(1,Math.abs(player.vx)/Math.max(1,player.speed));
  let animation='idle',phase=elapsed;
  if(player.tailsSwimming){animation='swim';phase=player.fallPhase;}
  else if(player.tailsFlying){animation='fly';phase=player.tailsFlightTime||0;}
  else if(player.tailsTired&&!player.onGround){animation='tired';phase=player.fallPhase;}
  else if(player.tailsAttackTimer>0){animation='tailsAttack';phase=Math.max(0,.34-player.tailsAttackTimer);}
  else if(player.peelOutCharging){animation='peeloutCharge';phase=Math.max(0,Math.min(1,(player.peelOutAnimTime||0)/.5));}
  else if(player.peelOutBurst>0&&player.peelOutBurstTime<SUPER_PEELOUT_LAUNCH_ANIM_DURATION){animation='peeloutBurst';phase=Math.max(0,Math.min(1,player.peelOutBurstTime/SUPER_PEELOUT_LAUNCH_ANIM_DURATION));}
  else if(player.spinDashCharging){
   const chargeTime=player.spinDashAnimTime||0,charge=player.spinDashCharge||0;
   if(chargeTime<.1){animation='spinDashCrouch';phase=chargeTime;}
   else if(chargeTime<.22){animation='spinDashRevCharge';phase=chargeTime-.1;}
   else if(charge<.76){animation='spinDashRevUp';phase=chargeTime-.22;}
   else{animation='spinDashRevDown';phase=chargeTime-.22;}
  }
  else if(player.spinDashRolling||player.rolling){animation='spin';phase=player.spinPhase;}
  else if(!player.onGround){animation=player.vy<0?'jump':'fall';phase=player.fallPhase;}
  else if(Math.abs(player.vx)>=SONIC_MAX_SPEED_THRESHOLD){animation='speeddash';phase=player.runPhase;}
  else if(speedRatio>=.58){animation='dash';phase=player.runPhase;}
  else if(Math.abs(player.vx)>25){animation='run';phase=player.runPhase;}
  drawTailsCharacter(x,y,{facing:player.facing,animation,phase});return;
 }
 if(selectedCharacterId==='knuckles'){
  let animation='idle',phase=elapsed;
  const floorY=player.platformId!==null&&platformById(player.platformId)?aerialPlatformY(platformById(player.platformId)):groundSurfaceAt(player.x+player.w/2);
  const spriteGrounded=player.onGround||(player.platformId===null&&!inUnderground&&player.vy>=0&&player.y+player.h>=floorY-3);
  if(player.knucklesGliding){
   animation='glide';phase=elapsed;
  }else if(player.knucklesPunchTimer>0){
   animation='punch';
   phase=1-Math.max(0,player.knucklesPunchTimer)/.35;
  }else if(player.onGround&&player.spinDashRolling&&(player.spinDashRollTime||0)>0&&Math.abs(player.vx)>=115){
   animation='spin';phase=player.spinPhase;
  }else if(!spriteGrounded){
   animation=player.vy<0?'jump':'fall';phase=elapsed;
  }else if(Math.abs(player.vx)>=SONIC_MAX_SPEED_THRESHOLD){
   animation='maxSpeed';phase=elapsed;
  }else if(Math.abs(player.vx)/Math.max(1,player.speed)>=.58){
   animation='dash';phase=elapsed;
  }else if(Math.abs(player.vx)>25){
   animation='run';phase=elapsed;
  }else{
   animation='idle';phase=elapsed;
  }
  drawKnucklesCharacter(x,y,{facing:player.facing,animation,phase,spinAngle:player.spinAngle,anchorOffsetY:player.h/2});return;
 }
 if(selectedCharacterId!=='sonic'){
  const phase=player.spinDashCharging||player.spinDashRolling?player.spinPhase:(player.onGround?player.runPhase:player.fallPhase);
  drawVectorCharacter(selectedCharacterId,x,y,{facing:player.facing,moving:player.onGround&&Math.abs(player.vx)>25,rolling:Boolean(player.spin),falling:!player.onGround&&!player.spin,phase,spinAngle:player.spinAngle});return;
 }
 if(!sonicAnimations.ready){drawFallbackPlayer();return}
 const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);
 const groundGap=terrainHeight(player.x+player.w/2)-(player.y+player.h);
 const slopeRunning=!player.onGround&&!player.spin&&!player.homingActive&&player.vy>=0&&Math.abs(player.vx)>25&&groundGap>=-10&&groundGap<56;
 const moving=(player.onGround||slopeRunning)&&Math.abs(player.vx)>25;
 const rolling=player.rolling||player.homingActive||(Boolean(player.spin)&&(!player.onGround||player.spinDashRolling));
 const jumping=!player.onGround&&!rolling&&player.vy< -30;
 const falling=!player.onGround&&!rolling&&!slopeRunning&&!jumping;
 const peelOutCharging=Boolean(player.peelOutCharging);
 const peelOutLaunch=Boolean(player.peelOutBurst>0&&player.peelOutBurstTime<SUPER_PEELOUT_LAUNCH_ANIM_DURATION);
 const peelOutPose=peelOutCharging||peelOutLaunch;
 let frames,index;
 if(peelOutCharging){
  if(player.peelOutAnimTime<.5){
   frames=sonicAnimations.peelOutCharge;
   index=Math.min(frames.length-1,Math.floor((player.peelOutAnimTime/.5)*frames.length));
  }else{
   frames=sonicAnimations.peelOutLoop;
   index=Math.floor((player.peelOutAnimTime-.5)*30)%Math.max(1,frames.length);
  }
 }else if(peelOutLaunch){
  frames=sonicAnimations.peelOutBurst;
  index=Math.min(frames.length-1,Math.floor(player.peelOutBurstTime/.1));
 }else if(player.spinDashCharging){
  const t=player.spinDashAnimTime||0,charge=player.spinDashCharge||0;
  if(t<.1){
   frames=sonicAnimations.spinDashCrouch;index=0;
  }else if(t<.22){
   frames=sonicAnimations.spinDashRevCharge;
   index=Math.min(frames.length-1,Math.floor((t-.1)/.06));
  }else if(charge<.76){
   frames=sonicAnimations.spinDashRevUp;
   index=Math.floor(t*12)%Math.max(1,frames.length);
  }else{
   frames=sonicAnimations.spinDashRevDown;
   index=Math.floor(t*10)%Math.max(1,frames.length);
  }
 }else if(player.spinDashRolling){
  frames=sonicAnimations.spinDashBall;
  index=Math.floor(player.spinPhase*frames.length)%Math.max(1,frames.length);
 }else if(rolling){
  frames=sonicAnimations.spin;
  index=Math.floor(player.spinPhase*frames.length)%Math.max(1,frames.length);
 }else if(jumping){
  frames=sonicAnimations.jump;
  index=Math.floor(player.fallPhase*frames.length)%Math.max(1,frames.length);
 }else if(falling){
  frames=sonicAnimations.fall;
  index=Math.floor(player.fallPhase*frames.length)%Math.max(1,frames.length);
 }else if(moving&&Math.abs(player.vx)>=SONIC_MAX_SPEED_THRESHOLD){
  frames=sonicAnimations.speeddash;
  index=Math.floor(elapsed*10)%Math.max(1,frames.length);
 }else if(moving){
  frames=sonicAnimations.run;
  index=Math.floor(player.runPhase*frames.length)%Math.max(1,frames.length);
 }else{
  frames=sonicAnimations.idle;
  index=Math.floor(elapsed*2.5)%Math.max(1,frames.length);
 }
 const usable=frames&&frames.length?frames:(sonicAnimations.idle.length?sonicAnimations.idle:[]);
 if(!usable.length){drawFallbackPlayer();return}
 const entry=usable[Math.max(0,index)%usable.length];
 const img=entry&&entry.img;
 if(!img||!img.naturalWidth||!img.naturalHeight){drawFallbackPlayer();return}
 const b=entry.bounds||{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
 const airbornePose=rolling||falling||jumping;
 const cell=entry.cell||{width:img.naturalWidth/SONIC_ATLAS_COLUMNS,height:img.naturalHeight/SONIC_ATLAS_ROWS};
 // Sonic y Tails usan exactamente la misma escala de celda: 88 × 86.
 const scale=Math.min(88/Math.max(1,cell.width),86/Math.max(1,cell.height));
 const dw=b.width*scale,dh=b.height*scale;
 g.save();g.translate(Math.round(x),Math.round(y));
 if(rolling)g.rotate(player.spinAngle||0);
 else{
  // Peel-Out is an upright running/launch pose: do not tilt or spin it.
  if(moving&&!peelOutPose)g.rotate(player.facing*speedRatio*0.055);
  if(player.facing<0)g.scale(-1,1);
 }
 g.imageSmoothingEnabled=false;
 g.drawImage(img,b.x,b.y,b.width,b.height,-dw/2,airbornePose?-dh/2:player.h/2-dh-1,dw,dh);
 g.restore();
}
function drawSpinDashCharge(){
 if(!player||(!player.spinDashCharging&&!player.peelOutCharging))return;
 const peelOut=player.peelOutCharging;
 const charge=peelOut?(player.peelOutCharge||0):(player.spinDashCharge||0);
 const label=peelOut?"SUPER PEEL-OUT":"SPIN DASH";
 const x=player.x-camera+player.w/2,y=player.y-48;
 g.save();g.fillStyle="rgba(5,22,42,.9)";g.fillRect(x-43,y-5,86,9);
 g.strokeStyle="#ffe78a";g.lineWidth=1.5;g.strokeRect(x-43,y-5,86,9);
 g.fillStyle="#ffcf35";g.fillRect(x-41,y-3,82*charge,5);
 g.fillStyle="#fff8c9";g.font="bold 8px Arial";g.textAlign="center";g.textBaseline="bottom";g.fillText(label,x,y-7);
 g.restore();
}
function drawPlayerName(){
 if(!running||!playerName||!player)return;
 const x=Math.round(player.x-camera+player.w/2);
 const y=Math.max(18,Math.round(player.y-8));
 g.save();g.font='900 15px Arial, sans-serif';g.textAlign='center';g.textBaseline='bottom';g.lineJoin='round';
 g.lineWidth=4;g.strokeStyle='#082b53';g.strokeText(playerName,x,y);g.fillStyle='#ffffff';g.fillText(playerName,x,y);g.restore();
}
function drawHud(){
 ctx.save();
 ctx.font="900 16px Arial, sans-serif";ctx.textBaseline="middle";ctx.lineJoin="round";
 const left=18,top=25;
 function label(text,x,y){ctx.lineWidth=4;ctx.strokeStyle="#123c70";ctx.strokeText(text,x,y);ctx.fillStyle="#fff";ctx.fillText(text,x,y)}
 label("SCORE "+String(score).padStart(5,"0"),left,top);
 label("TIME "+Math.floor(elapsed/60)+":"+String(Math.floor(elapsed%60)).padStart(2,"0"),left,top+25);
 // Emblema de anillo dorado y contador, con borde oscuro para contrastar sobre el cielo.
 ctx.save();ctx.translate(285,top);ctx.strokeStyle="#92500b";ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,8,10,0,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="#ffc92e";ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,8,10,0,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle="#fff7b2";ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(-1,-2,4.5,6.5,0,Math.PI*1.1,Math.PI*1.8);ctx.stroke();ctx.restore();
 label(String(rings.filter(r=>r.got).length).padStart(2,"0"),301,top);
 // Vidas como pequeños retratos del sprite activo, no corazones genéricos.
 for(let i=0;i<Math.max(0,lives);i++){
  const frame=sonicAnimations.idle[0]||sonicAnimations.run[0];
  if(frame&&frame.img){
   const b=frame.bounds||{x:0,y:0,width:frame.img.naturalWidth,height:frame.img.naturalHeight};
   const scale=Math.min(25/Math.max(1,b.width),25/Math.max(1,b.height));
   const dw=b.width*scale,dh=b.height*scale;
   ctx.drawImage(frame.img,b.x,b.y,b.width,b.height,W-105+i*30-dw/2,top-12+25-dh,dw,dh);
  }else{
   ctx.fillStyle="#1476ef";ctx.beginPath();ctx.arc(W-95+i*30,top,9,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(W-92+i*30,top-2,2,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
let lastRenderError="";
function copyScene(){
 // Primero se reduce todo el nivel a una rejilla uniforme; después se amplía
 // con vecino más cercano para conservar los bordes duros del pixel-art.
 pixelCtx.imageSmoothingEnabled=false;
 pixelCtx.clearRect(0,0,pixelScene.width,pixelScene.height);
 pixelCtx.drawImage(scene,0,0,scene.width,scene.height,0,0,pixelScene.width,pixelScene.height);
 ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,W,H);
 ctx.drawImage(pixelScene,0,0,pixelScene.width,pixelScene.height,0,0,W,H);
}
function draw(){
 lastRenderError="";
 const stages=[
  ["FONDO",drawBackground],
  ["SUELO",drawGround],
  ["CUMBRES ROCOSAS",drawMountainDetails],
  ["DECORACIÓN",drawDecorations],
  ["ANILLOS",()=>rings.forEach(drawRing)],
  ["ENEMIGOS",()=>enemies.forEach(drawEnemy)],
  ["OBJETIVO HOMING",drawHomingTarget],
  ["EXPLOSIONES",drawEnemyExplosions],
  ["DISPAROS DE ABEJAS",()=>beeProjectiles.forEach(drawBeeProjectile)],
  ["OTROS JUGADORES",drawRemotePlayers],
  ["PERSONAJE",drawPlayer],
  ["CARGA DE ACCIÓN",drawSpinDashCharge],
  ["NOMBRE",drawPlayerName]
 ];
 let copied=false;
 for(const [name,render] of stages){
  try{
   // El fondo celeste queda estable; el terreno, los objetos y Sonic siguen la cámara vertical.
   g.save();
   try{
    if(name!=="FONDO")g.translate(0,-cameraY);
    render();
   }finally{g.restore()}
   copyScene();
   copied=true;
  }catch(error){
   lastRenderError=name+": "+String(error&&error.message||error);
   console.error("[Blue Rush] Error al dibujar "+name,error);
   // Keep the page visibly diagnosable instead of leaving only the CSS sky-blue canvas.
   if(!copied){
    try{
     ctx.clearRect(0,0,W,H);
     ctx.fillStyle="#73dfff";ctx.fillRect(0,0,W,H);
     ctx.fillStyle="#14345a";ctx.font="bold 20px sans-serif";
     ctx.fillText("Error al dibujar: "+name,24,38);
     ctx.font="14px sans-serif";ctx.fillText(String(error&&error.message||error).slice(0,90),24,64);
    }catch(_){}
   }
   // If an error left a canvas save/clip state unbalanced, reset the offscreen context.
   try{
    scene.width=VIEW_W;scene.height=VIEW_H;g.imageSmoothingEnabled=false;
    drawBackground();copyScene();copied=true;
   }catch(recoveryError){
    console.error("[Blue Rush] No se pudo recuperar el canvas",recoveryError);
   }
  }
 }
 try{drawHud()}catch(error){
  lastRenderError="HUD: "+String(error&&error.message||error);
  console.error("[Blue Rush] Error al dibujar HUD",error);
 }
 if(lastRenderError&&status)status.textContent="ERROR GRÁFICO · "+lastRenderError.slice(0,64);
}
function loop(now){
 const dt=Math.min((now-(lastTime||now))/1000,.032);lastTime=now;
 try{update(dt)}catch(error){console.error("[Blue Rush] Error de actualización",error)}
 try{sendOnlineState(now)}catch(error){console.error("[Blue Rush] Error de red",error)}
 try{draw()}catch(error){
  console.error("[Blue Rush] Error fatal de renderizado",error);
  if(status)status.textContent="ERROR DEL JUEGO · RECARGA LA PÁGINA";
 }
 requestAnimationFrame(loop);
}
resetPlayer();draw();requestAnimationFrame(loop);
})();