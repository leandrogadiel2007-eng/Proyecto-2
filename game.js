(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),onlineButton=document.getElementById('onlineButton'),roomCodeInput=document.getElementById('roomCode'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status'),playerNameInput=document.getElementById('playerName');
let playerName='';
const multiplayerId=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():('br-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
let multiplayerClient=null,multiplayerChannel=null,multiplayerRoom='',onlineMode=false,lastNetworkSend=0;
const remotePlayers=new Map();
const NETWORK_SEND_INTERVAL=120;
const W=canvas.width,H=canvas.height,GROUND=530,keys={left:false,right:false,jump:false};
// Cámara de primer plano: muestra menos escenario y mantiene a Sonic como foco.
const GAME_ZOOM=1.7,VIEW_W=Math.ceil(W/GAME_ZOOM),VIEW_H=Math.ceil(H/GAME_ZOOM),CAMERA_FILL_MARGIN=65;
// Spritesheet Green Island (edición gratuita).
const greenIsland=new Image();greenIsland.src='./assets/green-island/free_edition.png';let greenIslandReady=false;greenIsland.onload=()=>{greenIslandReady=true};
// Acto largo, pensado para durar aproximadamente 1,5–2 minutos a velocidad normal.
const worldWidth=60000;
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

let running=false,lastTime=0,elapsed=0,camera=0,cameraY=0,score=0,lives=3,player;
const bridgeSpecs=[{x:12650,w:390,label:"LAGUNA"},{x:22630,w:420,label:"VIENTO"}];
// Los tramos de puente sustituyen la superficie del terreno por una pasarela sólida.
function bridgeAt(x){return bridgeSpecs.find(bridge=>x>=bridge.x&&x<=bridge.x+bridge.w)||null}
function bridgeSurfaceY(bridge){return terrainHeight(bridge.x+bridge.w/2)-6}
function groundSurfaceAt(x){const bridge=bridgeAt(x);return bridge?bridgeSurfaceY(bridge):terrainHeight(x)}
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
// Aro de velocidad: la entrada requiere impulso y la ruta recorre la parte superior del aro.
const LOOP_START_ANGLE=154*Math.PI/180,LOOP_SWEEP=232*Math.PI/180;
const loopTrack={x:5500,r:94,minSpeed:400,active:false,progress:0,entrySpeed:0,warningUntil:0};
function loopEntryCenterX(){return loopTrack.x+loopTrack.r*Math.cos(LOOP_START_ANGLE)}
function loopExitCenterX(){return loopTrack.x+loopTrack.r*Math.cos(LOOP_START_ANGLE+LOOP_SWEEP)}
function loopCenterY(){
 const entry=loopEntryCenterX(),exit=loopExitCenterX();
 return (groundSurfaceAt(entry)+groundSurfaceAt(exit))/2-player.h/2-loopTrack.r*Math.sin(LOOP_START_ANGLE);
}
let rings=[],enemies=[],collected=new Set(),checkpoints=[];
let checkpointX=90,levelCompleted=false;
let raceFinished=false,raceWinner=null;
function buildLevel(){
 rings=[];collected=new Set();
 let group=0;
 // Anillos repartidos por el recorrido principal.
 for(let x=220;x<worldWidth-280;x+=820,group++){
  const zone=sectionAt(x),pattern=(group+(Math.floor(x/5000)*2))%5,count=2+(group%2);
  for(let i=0;i<count;i++){
   const rx=x+i*38,base=terrainHeight(rx);
   let offset;
   if(pattern===0)offset=44;
   else if(pattern===1)offset=52+Math.sin(i/(count-1)*Math.PI)*54;
   else if(pattern===2)offset=zone.kind==="ruins"?110:86;
   else if(pattern===3)offset=46+Math.sin(i/(count-1)*Math.PI)*34;
   else offset=zone.kind==="finish"?70:42;
   rings.push({id:group+"-"+i,x:rx,y:Math.max(118,base-offset),got:false});
  }
 }
 const enemyPositions=[980,2180,3700,5050,6550,8150,9550,11050,13900,15100,17450,19350,21100,23850,25500,27600,29450,31250,32950,34600,36080,38800,39480,41850,44580,47520,48900,51050,53200,55100,58000,59200];
 enemies=enemyPositions.map((x,index)=>({x,y:terrainHeight(x)-28,alive:true,base:x,kind:index%3}));

 checkpoints=[9000,18000,27000,36000,42000,51000,57000].map((x,index)=>({x,y:terrainHeight(x),active:false,index}));
}

function resetPlayer(){player={x:90,y:terrainHeight(90)-43,w:34,h:43,vx:0,vy:0,speed:560,speedCharge:0,jump:625,onGround:true,facing:1,invincible:0,spin:0,spinAngle:0,runPhase:0,fallPhase:0,spinPhase:0,platformId:null};camera=0;cameraY=0;elapsed=0;score=0;lives=3;checkpointX=90;levelCompleted=false;raceFinished=false;raceWinner=null;loopTrack.active=false;loopTrack.progress=0;loopTrack.entrySpeed=0;loopTrack.warningUntil=0;aerialSpring.cooldownUntil=0;aerialSpring.flashUntil=0;buildLevel()}
function showLobbyMessage(title,message){
 startScreen.querySelector('h2').textContent=title;
 startScreen.querySelector('p:not(.start-kicker)').textContent=message;
 startScreen.classList.remove('hidden');
}
function startGame(){
 if(!running){
  if(levelCompleted)resetPlayer();
  startScreen.querySelector('h2').textContent='¡Vamos, Sonic!';
  startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';
  startButton.textContent='JUGAR SOLO';
  playerName=(playerNameInput.value||playerName||'').trim().slice(0,16)||'Sonic';playerNameInput.value=playerName;
  running=true;startScreen.classList.add('hidden');
  status.textContent=onlineMode?'ONLINE · SALA '+multiplayerRoom:'¡CORRE POR LA ISLA Y DESCUBRE SUS RUTAS!';
  lastTime=performance.now();
 }
}
async function startOnlineGame(){
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
    raceFinished=true;raceWinner=name;levelCompleted=true;running=false;
    startScreen.querySelector('h2').textContent='🏁 ¡'+name+' ganó la carrera!';
    startScreen.querySelector('p:not(.start-kicker)').textContent='Tu rival llegó primero a la meta. ¡Vuelve a correr para intentar ganar!';
    startButton.textContent='CORRER OTRA VEZ';startScreen.classList.remove('hidden');
    status.textContent='CARRERA TERMINADA · GANADOR: '+name;
   });
   roomChannel.on('broadcast',{event:'player-state'},({payload})=>{
   if(!payload||payload.id===multiplayerId)return;const x=Number(payload.x),y=Number(payload.y);
   if(!Number.isFinite(x)||!Number.isFinite(y)||x< -200||x>worldWidth+200||y< -1000||y>5000)return;
   const id=String(payload.id||'');if(!id||id.length>100)return;let other=remotePlayers.get(id);
   if(!other){other={id,x,targetX:x,y,targetY:y,facing:1,name:'Jugador',animation:'idle',phase:0,lastSeen:performance.now(),spinAngle:0,progress:0};remotePlayers.set(id,other)}else{other.targetX=x;other.targetY=y}
   other.name=String(payload.name||'Jugador').replace(/[<>]/g,'').slice(0,16)||'Jugador';other.progress=Math.max(0,Math.min(100,Number(payload.progress)||0));other.facing=Number(payload.facing)<0?-1:1;
   const animations=['idle','run','dash','speeddash','jump','spin','fall'];other.animation=animations.includes(payload.animation)?payload.animation:'idle';
   other.phase=Number.isFinite(Number(payload.phase))?Number(payload.phase):0;other.spinAngle=Number.isFinite(Number(payload.spinAngle))?Number(payload.spinAngle):0;other.lastSeen=performance.now();
  });
  roomChannel.on('presence',{event:'sync'},()=>{
   const presence=roomChannel.presenceState(),seen=new Set();
   for(const entries of Object.values(presence))for(const person of entries||[]){
    if(!person||!person.id||person.id===multiplayerId)continue;const id=String(person.id);seen.add(id);let other=remotePlayers.get(id);
    if(!other){const x=Number.isFinite(Number(person.x))?Number(person.x):90,y=Number.isFinite(Number(person.y))?Number(person.y):terrainHeight(x)-43;other={id,x,targetX:x,y,targetY:y,facing:1,name:'Jugador',animation:'idle',phase:0,lastSeen:performance.now(),spinAngle:0};remotePlayers.set(id,other)}
    if(person.name)other.name=String(person.name).replace(/[<>]/g,'').slice(0,16)||'Jugador';
   }
   for(const id of remotePlayers.keys())if(!seen.has(id))remotePlayers.delete(id);
   if(onlineMode)status.textContent='ONLINE · SALA '+multiplayerRoom+' · '+(remotePlayers.size+1)+' JUGADOR(ES)';
  });
  multiplayerChannel=roomChannel;
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Se agotó el tiempo de conexión.')),12000);roomChannel.subscribe(state=>{if(state==='SUBSCRIBED'){clearTimeout(timeout);resolve()}else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){clearTimeout(timeout);reject(new Error('Supabase respondió: '+state))}})});
  await roomChannel.track({id:multiplayerId,name:playerName,x:player.x,y:player.y,at:Date.now()});
  onlineMode=true;lastNetworkSend=0;startGame();status.textContent='ONLINE · SALA '+multiplayerRoom+' · 1+ JUGADOR(ES)';
 }catch(error){
  console.error('[Blue Rush] Error de multijugador online:',error);onlineMode=false;const oldChannel=multiplayerChannel,oldClient=multiplayerClient;multiplayerChannel=null;multiplayerClient=null;remotePlayers.clear();
  if(oldChannel&&oldClient){try{await oldClient.removeChannel(oldChannel)}catch(_){}}
  showLobbyMessage('No se pudo conectar','Revisa la URL, la publishable key y que Realtime esté habilitado en Supabase. Detalle: '+String(error&&error.message||error).slice(0,100));status.textContent='ERROR DE CONEXIÓN ONLINE';
 }finally{onlineButton.disabled=false;startButton.disabled=false;onlineButton.innerHTML='JUGAR ONLINE <span aria-hidden="true">↗</span>'}
}
function leaveOnlineRoom(){
 onlineMode=false;remotePlayers.clear();const channel=multiplayerChannel,client=multiplayerClient;multiplayerChannel=null;multiplayerClient=null;multiplayerRoom='';
 if(channel&&client)client.removeChannel(channel).catch(error=>console.warn('[Blue Rush] No se pudo cerrar la sala:',error));
}
function sendOnlineState(now){
 if(!onlineMode||!multiplayerChannel||now-lastNetworkSend<NETWORK_SEND_INTERVAL)return;lastNetworkSend=now;const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);let animation='idle';
 if(running){if(player.spin)animation='spin';else if(!player.onGround)animation=player.vy<0?'jump':'fall';else if(speedRatio>=0.78)animation='speeddash';else if(speedRatio>=0.47)animation='dash';else if(Math.abs(player.vx)>25)animation='run'}
 const phase=animation==='spin'?player.spinPhase:(animation==='fall'||animation==='jump'?player.fallPhase:player.runPhase);
 const payload={id:multiplayerId,name:playerName,x:Math.round(player.x*10)/10,y:Math.round(player.y*10)/10,vx:Math.round(player.vx*10)/10,vy:Math.round(player.vy*10)/10,facing:player.facing,animation,phase,spinAngle:player.spinAngle||0,progress:Math.round(player.x/(worldWidth-player.w-90)*1000)/10,playing:running,sentAt:Date.now()};
 const channel=multiplayerChannel;channel.send({type:'broadcast',event:'player-state',payload}).then(result=>{if(result==='error')console.warn('[Blue Rush] Supabase no pudo enviar la posición del jugador.')}).catch(error=>console.warn('[Blue Rush] Error al enviar posición:',error));
}
function drawRemotePlayers(){
 if(!onlineMode)return;const now=performance.now();
 for(const [id,other] of remotePlayers){
  if(now-other.lastSeen>9000){remotePlayers.delete(id);continue}other.x+=(other.targetX-other.x)*0.32;other.y+=(other.targetY-other.y)*0.32;
  const animation=other.animation||'idle',frames=sonicAnimations[animation]&&sonicAnimations[animation].length?sonicAnimations[animation]:sonicAnimations.idle;if(!frames||!frames.length)continue;
  const frame=frames[Math.floor(Math.max(0,other.phase)*Math.max(1,frames.length))%frames.length];if(!frame||!frame.img||!frame.img.naturalWidth)continue;
  const img=frame.img,b=frame.bounds||{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight},rolling=animation==='spin',falling=animation==='fall'||animation==='jump',fast=animation==='speeddash';
  const targetW=falling?66:(rolling?46:(fast?76:56)),targetH=falling?66:(rolling?46:(fast?72:54)),scale=Math.min(targetW/Math.max(1,b.width),targetH/Math.max(1,b.height)),dw=b.width*scale,dh=b.height*scale;
  const sx=other.x-camera+player.w/2,sy=other.y+player.h/2;g.save();g.translate(Math.round(sx),Math.round(sy));if(rolling)g.rotate(other.spinAngle||0);else if(other.facing<0)g.scale(-1,1);
  g.imageSmoothingEnabled=true;g.drawImage(img,b.x,b.y,b.width,b.height,-dw/2,(rolling||falling)?-dh/2:player.h/2-dh-1,dw,dh);g.restore();
  g.save();g.font='900 12px Arial, sans-serif';g.textAlign='center';g.textBaseline='bottom';g.lineJoin='round';g.lineWidth=3;g.strokeStyle='#082b53';g.strokeText(other.name,Math.round(sx),Math.round(other.y-7));g.fillStyle='#fff3a2';g.fillText(other.name,Math.round(sx),Math.round(other.y-7));g.restore();
 }
}
function resetGame(){
 leaveOnlineRoom();running=false;keys.left=keys.right=keys.jump=false;resetPlayer();startScreen.querySelector('h2').textContent='¡Vamos, Sonic!';startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';
 startButton.textContent='JUGAR SOLO';onlineButton.disabled=false;startButton.disabled=false;startScreen.classList.remove('hidden');status.textContent='PULSA JUGAR PARA EMPEZAR';draw();
}
function jump(){if(!running)startGame();if(player.onGround){player.vy=-player.jump;player.onGround=false;player.platformId=null;player.spin=1;player.spinAngle=0}}
function setKey(key,down){const k=key.toLowerCase(),isJump=key===' '||key==='ArrowUp'||k==='w';if(key==='ArrowLeft'||k==='a')keys.left=down;if(key==='ArrowRight'||k==='d')keys.right=down;if(isJump){const wasHeld=keys.jump;keys.jump=down;if(down&&!wasHeld)jump()}if(down&&key==='Enter'&&!running)startGame()}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();setKey(e.key,true)});
window.addEventListener('keyup',e=>setKey(e.key,false));window.addEventListener('blur',()=>{keys.left=keys.right=keys.jump=false});
startButton.addEventListener('click',()=>{leaveOnlineRoom();startGame()});onlineButton.addEventListener('click',startOnlineGame);resetButton.addEventListener('click',resetGame);window.addEventListener('beforeunload',leaveOnlineRoom);
document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const press=e=>{e.preventDefault();if(c==='jump'){keys.jump=true;jump()}else{if(!running)startGame();keys[c]=true}};const release=e=>{e.preventDefault();if(c==='jump')keys.jump=false;else keys[c]=false};b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('pointerleave',release)});
// Al mantener salto en el aire, Sonic obtiene empuje vertical; al soltarlo actúa la gravedad normal.
function applyAirMotion(dt){player.vy+=1550*dt;player.y+=player.vy*dt}
function update(dt){
 if(!running)return;elapsed+=dt;
 if(loopTrack.active){
  loopTrack.progress=Math.min(1,loopTrack.progress+(Math.max(loopTrack.minSpeed,loopTrack.entrySpeed)*dt)/(loopTrack.r*LOOP_SWEEP));
  const p=loopTrack.progress,angle=LOOP_START_ANGLE+LOOP_SWEEP*p,exit=loopExitCenterX();
  player.x=loopTrack.x+loopTrack.r*Math.cos(angle)-player.w/2;
  player.y=loopCenterY()+loopTrack.r*Math.sin(angle)-player.h/2;
  player.vx=loopTrack.entrySpeed;player.vy=0;player.onGround=false;player.spin=1;player.facing=1;player.spinAngle=p*Math.PI*2;
  if(p>=1){
   player.x=exit-player.w/2;player.y=groundSurfaceAt(exit)-player.h;
   player.vx=Math.min(player.speed,Math.max(loopTrack.minSpeed,loopTrack.entrySpeed*1.08));
   player.speedCharge=Math.max(player.speedCharge,.82);player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0;
   loopTrack.active=false;score+=150;
  }
 }else{
  const dir=Number(keys.right)-Number(keys.left);
  if(dir){
   if(player.vx!==0&&Math.sign(player.vx)!==dir)player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);
   else player.speedCharge=Math.min(1,player.speedCharge+0.28*dt);
   player.facing=dir;const targetSpeed=dir*(145+415*player.speedCharge);
   player.vx+=(targetSpeed-player.vx)*Math.min(1,5.2*dt);
  }else{
   player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);player.vx*=Math.pow(0.12,dt);
   if(Math.abs(player.vx)<8)player.vx=0;
  }
  const wasGrounded=player.onGround,oldBottom=player.y+player.h,oldX=player.x,oldY=player.y,oldPlatformId=player.platformId,oldGround=groundSurfaceAt(oldX+player.w/2);
  if(wasGrounded&&oldPlatformId===null){
   const slope=(terrainHeight(player.x+42)-terrainHeight(player.x-42))/84;
   player.vx+=Math.max(-230,Math.min(230,slope*720))*dt;
  }
  player.vx=Math.max(-player.speed,Math.min(player.speed,player.vx));
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
   player.platformId=null;player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0;
  }else{
   applyAirMotion(dt);player.onGround=false;
   const descending=player.vy>=0;
   const landingPlatform=descending&&oldBottom<=player.y+player.h&&platformUnderPlayer(player.x,player.w);
   const landingY=landingPlatform?aerialPlatformY(landingPlatform):Infinity;
   if(landingPlatform&&oldBottom<=landingY+Math.max(28,Math.abs(player.vx)*dt*1.4)&&player.y+player.h>=landingY){
    player.y=landingY-player.h;player.vy=0;player.onGround=true;player.platformId=landingPlatform.id;player.spin=0;player.spinAngle=0;
   }else if(descending&&player.y+player.h>=groundNow&&oldBottom<=oldGround+Math.max(28,Math.abs(player.vx)*dt*1.4)){
    player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.platformId=null;player.spin=0;player.spinAngle=0;
   }
  }
  // El trampolín impulsa a Sonic a la primera plataforma de la ruta aérea.
  if(player.onGround&&player.platformId===null&&player.vx>80&&elapsed>=aerialSpring.cooldownUntil&&player.x+player.w>aerialSpring.x&&player.x<aerialSpring.x+aerialSpring.w){
   player.vy=-1050;player.onGround=false;player.platformId=null;player.spin=1;player.spinAngle=0;
   player.speedCharge=Math.max(player.speedCharge,.78);player.vx=Math.max(player.vx,430);
   aerialSpring.cooldownUntil=elapsed+1.0;aerialSpring.flashUntil=elapsed+.45;score+=25;
  }
  const entry=loopEntryCenterX(),oldCenter=oldX+player.w/2,newCenter=player.x+player.w/2;
  if(wasGrounded&&player.vx>0&&oldCenter<entry&&newCenter>=entry){
   if(player.vx>=loopTrack.minSpeed){
    loopTrack.active=true;loopTrack.progress=0;loopTrack.entrySpeed=player.vx;
    player.x=entry-player.w/2;player.y=groundSurfaceAt(entry)-player.h;
    player.vy=0;player.onGround=false;player.spin=1;player.spinAngle=0;
   }else{
    player.x=entry-player.w/2-1;player.vx=Math.max(0,player.vx*.65);loopTrack.warningUntil=elapsed+1.35;
   }
  }
 }
 for(const cp of checkpoints){if(!cp.active&&player.x+player.w/2>=cp.x){cp.active=true;checkpointX=cp.x;score+=250}}
 const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);
 if(player.onGround){player.fallPhase=0;if(Math.abs(player.vx)>25)player.runPhase+=dt*(0.8+speedRatio*2.25)}
 else if(player.spin)player.spinPhase+=dt*(0.8+speedRatio*1.7);
 else player.fallPhase+=dt*(0.9+speedRatio*1.1);
 if(player.invincible>0)player.invincible-=dt;
 rings.forEach(r=>{if(!r.got&&Math.abs((player.x+player.w/2)-r.x)<24&&Math.abs((player.y+player.h/2)-r.y)<29){r.got=true;score+=10}});
 enemies.forEach(e=>{
  if(!e.alive)return;e.x=e.base+Math.sin(elapsed*1.6+e.base)*32;e.y=terrainHeight(e.x)-28;
  const enemyY=e.y+(e.kind===2?-7:0);const hit=player.x+player.w>e.x-25&&player.x<e.x+25&&player.y+player.h>enemyY-25&&player.y<enemyY+22;
  if(hit){
   if(player.vy>100&&player.y+player.h<enemyY+12){e.alive=false;player.vy=-370;player.onGround=false;score+=100}
   else if(player.invincible<=0){
    if(rings.some(r=>r.got)){let drop=0;rings.forEach(r=>{if(r.got&&drop<8){r.got=false;r.x=player.x+player.w+drop*12;r.y=player.y+Math.sin(drop)*-22;drop++}})}
    else{lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Te has quedado sin vidas. Pulsa jugar para volver a empezar.';resetPlayer()}}
    player.invincible=1.5;player.speedCharge=0;player.vy=-300;player.onGround=false;player.vx=-player.facing*180;
   }
  }
 });
 if(player.y>VIEW_H+100){
  player.x=Math.max(30,checkpointX);player.y=terrainHeight(player.x)-player.h;player.vy=0;player.vx=0;player.speedCharge=0;lives--;
  if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Caíste fuera del recorrido. Pulsa jugar para volver a empezar.';resetPlayer()}
 }
 if(player.x>=worldWidth-player.w-90&&!levelCompleted){
  levelCompleted=true;
  if(onlineMode&&!raceFinished){
   raceFinished=true;raceWinner=playerName;running=false;
   if(multiplayerChannel)multiplayerChannel.send({type:'broadcast',event:'player-finished',payload:{id:multiplayerId,name:playerName,time:Math.round(elapsed*100)/100,progress:100,finishedAt:Date.now()}}).catch(error=>console.warn('[Blue Rush] No se pudo anunciar la meta:',error));
   startScreen.querySelector('h2').textContent='🏁 ¡Ganaste la carrera!';
   startScreen.querySelector('p:not(.start-kicker)').textContent='Llegaste primero a la meta. Tiempo: '+elapsed.toFixed(1)+' s. ¡Desafía a tu rival otra vez!';
   status.textContent='CARRERA TERMINADA · GANADOR: '+playerName;
  }else{
   running=false;startScreen.querySelector('h2').textContent='¡Nivel completado!';
   startScreen.querySelector('p:not(.start-kicker)').textContent='¡Llegaste al final de Blue Rush! Puntos: '+score+'. Pulsa para correr otra vez.';
  }
  startScreen.classList.remove('hidden');startButton.innerHTML='CORRER OTRA VEZ <span aria-hidden="true">↻</span>';
 }
 // Cámara fija sobre el centro de Sonic: no intenta encuadrar el terreno ni las cimas.
 // Se calcula desde la posición actual del personaje en cada frame, sin límites
 // de borde ni suavizado, para que Sonic permanezca exactamente centrado en pantalla.
 const playerCenter=player.x+player.w/2;
 camera=playerCenter-VIEW_W/2;
 cameraY=player.y+player.h/2-VIEW_H/2-35; // Muestra más cielo para mantener visible la ruta aérea
 const zone=sectionAt(player.x);
 if(onlineMode){
  const rival=[...remotePlayers.values()].sort((a,b)=>(b.progress||0)-(a.progress||0))[0];
  status.textContent=raceFinished?'CARRERA TERMINADA · GANADOR: '+(raceWinner||playerName):'SALA '+multiplayerRoom+' · TÚ '+Math.min(100,Math.floor(player.x/(worldWidth-player.w-90)*100))+'%'+(rival?' · '+rival.name+' '+Math.floor(rival.progress||0)+'%':' · ESPERANDO RIVAL');
 }else status.textContent=zone.name+' · ANILLOS '+rings.filter(r=>r.got).length+' · '+score+' PTS · VIDAS '+lives;
 if(!loopTrack.active&&loopTrack.warningUntil>elapsed&&!levelCompleted)status.textContent='¡NECESITAS MÁS VELOCIDAD PARA EL ARO!';
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
// Render retro: baja resolución virtual ampliada sin suavizado.
const PIXEL=1;
const scene=document.createElement('canvas');
scene.width=Math.floor(VIEW_W/PIXEL);scene.height=Math.floor(VIEW_H/PIXEL);
const g=scene.getContext('2d');
g.imageSmoothingEnabled=true;
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
 g.save();g.translate(0,120); // Baja el horizonte para acompañar el escenario vertical ampliado.
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
 // Extiende el suelo según la posición vertical de cámara para no revelar huecos vacíos.
 const w=scene.width,h=scene.height+CAMERA_FILL_MARGIN+Math.max(0,cameraY),tile=32;
 g.save();
 // Recorta el suelo siguiendo exactamente la curva del terreno.
 g.beginPath();g.moveTo(0,h);g.lineTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,h);g.closePath();g.clip();

 // La cuadrícula queda anclada al mundo, no a la altura del terreno ni a la pantalla.
 // Así los bloques conservan su tamaño y alineación al subir y bajar las colinas.
 const offsetX=-(((camera%tile)+tile)%tile);
 let minTop=Infinity;
 for(let x=0;x<=w;x+=16)minTop=Math.min(minTop,terrainHeight(camera+x));
 const startY=Math.floor(minTop/tile)*tile;
 for(let y=startY;y<h;y+=tile){
  const row=Math.floor(y/tile);
  const shift=(row%2===0)?0:tile/2;
  for(let x=offsetX-tile;x<w+tile;x+=tile){
   const xx=x+shift;
   const col=Math.floor((xx+camera)/tile);
   const dark=((col+row)%2===0);
   g.fillStyle=dark?"#9b4b2d":"#c8753e";
   g.fillRect(xx,y,tile,tile);
   g.fillStyle=dark?"#b45d35":"#e18b4b";
   g.fillRect(xx,y,tile,3);g.fillRect(xx,y,3,tile);
   g.fillStyle=dark?"#713b2a":"#a75832";
   g.fillRect(xx,y+tile-3,tile,3);g.fillRect(xx+tile-3,y,3,tile);
   if(Math.abs(col*7+row*11)%4===0){
    g.fillStyle="rgba(245,169,95,.34)";
    g.fillRect(xx+7,y+9,8,2);g.fillRect(xx+10,y+11,5,2);
   }else if(Math.abs(col*5-row*3)%5===0){
    g.fillStyle="rgba(72,35,27,.22)";
    g.fillRect(xx+8,y+18,11,2);g.fillRect(xx+17,y+20,5,2);
   }
  }
 }
 // Sombra ligera también queda dentro de la silueta recortada del suelo.
 const soilShade=g.createLinearGradient(0,startY,0,h);
 soilShade.addColorStop(0,"rgba(255,190,103,.04)");
 soilShade.addColorStop(1,"rgba(45,27,25,.18)");
 g.fillStyle=soilShade;g.fillRect(0,startY,w,h-startY);
 g.restore();

 // Césped dibujado como una franja que sigue la misma curva que la tierra.
 g.save();g.imageSmoothingEnabled=false;
 g.beginPath();g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,terrainHeight(camera+w)+15);
 for(let x=w;x>=0;x-=4)g.lineTo(x,terrainHeight(camera+x)+15);
 g.closePath();g.fillStyle="#165b32";g.fill();

 // Bordes de césped y pequeños píxeles colocados siguiendo la altura local del terreno.
 for(let x=0;x<w+24;x+=4){
  const wx=camera+x,gy=terrainHeight(wx);
  const n=Math.abs(Math.floor(wx/24))%4;
  g.fillStyle="#249b43";g.fillRect(x,gy+2,4,6);
  g.fillStyle=n===0?"#8be957":n===1?"#43c83f":n===2?"#d0f779":"#36ae3b";
  g.fillRect(x,gy+2,4,3);
 }
 for(let x=-(((camera%13)+13)%13);x<w+13;x+=13){
  const gy=terrainHeight(camera+x),n=Math.abs(Math.floor((x+camera)/13))%3;
  g.fillStyle=n===0?"#238b3b":n===1?"#48c844":"#a4ed57";
  g.fillRect(x,gy+8,3,5);
  if(n===1)g.fillRect(x+3,gy+6,3,4);
 }
 // Contorno superior limpio, siguiendo colinas y bajadas sin una línea horizontal falsa.
 g.beginPath();g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.strokeStyle="#a5ef63";g.lineWidth=2;g.stroke();
 g.restore();

 // Corta visualmente la tierra bajo cada puente y crea un cauce profundo con agua.
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
  // Hueco oscuro bajo la pasarela; cubre la tierra y el césped del tramo.
  g.fillStyle="#123d59";
  g.fillRect(sx,cutTop,wBridge,channelBottom-cutTop);
  // Caras rocosas verticales en ambos extremos del cauce.
  g.fillStyle="#71442f";g.fillRect(sx,cutTop,9,Math.max(0,waterY-cutTop));
  g.fillRect(sx+wBridge-9,cutTop,9,Math.max(0,waterY-cutTop));
  g.fillStyle="#b56d3d";g.fillRect(sx,cutTop,wBridge,4);
  g.fillStyle="#8b5238";g.fillRect(sx+9,cutTop+8,3,Math.max(0,waterY-cutTop-8));
  g.fillRect(sx+wBridge-12,cutTop+8,3,Math.max(0,waterY-cutTop-8));
  // El agua queda claramente por debajo de las tablas.
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
function drawDecorations(){
 drawLoopTrack();drawAerialRoute();
 for(let wx=260;wx<6800;wx+=610)drawPalm(wx,Math.floor(wx/610)%3);
 for(let wx=7050;wx<11900;wx+=1120)drawPalm(wx,Math.floor(wx/1120)%3);
 bridgeSpecs.forEach(drawWoodBridge);
 for(let wx=17300;wx<20500;wx+=470)drawRuin(wx,Math.floor(wx/470)%3);
 for(let wx=22000;wx<26800;wx+=1320){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/1320)%3);else drawRuin(wx,1)}
 for(let wx=27100;wx<32900;wx+=1050){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/1050)%3);else drawRuin(wx,1)}
 for(let wx=33100;wx<35800;wx+=740)drawPalm(wx,Math.floor(wx/740)%3);
 for(let wx=36100;wx<48100;wx+=980){if(terrainHeight(wx)>340)drawPalm(wx,Math.floor(wx/980)%3);else drawRuin(wx,1)}
 for(let wx=48100;wx<59800;wx+=940){if(Math.floor(wx/940)%3===1)drawRuin(wx,Math.floor(wx/940)%3);else drawPalm(wx,Math.floor(wx/940)%3)}
 checkpoints.forEach(drawCheckpoint);drawFinish();
}
function drawLoopBack(){
 const x=loopTrack.x-camera;if(x< -loopTrack.r-30||x>scene.width+loopTrack.r+30)return;
 const cy=loopCenterY();g.save();g.lineCap="round";
 g.beginPath();g.arc(x,cy,loopTrack.r,0,Math.PI*2);
 g.strokeStyle="#563729";g.lineWidth=26;g.stroke();g.strokeStyle="#c27a39";g.lineWidth=18;g.stroke();g.strokeStyle="#6e472e";g.lineWidth=3;g.stroke();g.restore();
}
function drawLoopTrack(){
 const x=loopTrack.x-camera,cy=loopCenterY();if(x< -loopTrack.r-30||x>scene.width+loopTrack.r+30)return;
 g.save();g.lineCap="round";g.beginPath();g.arc(x,cy,loopTrack.r,LOOP_START_ANGLE,LOOP_START_ANGLE+LOOP_SWEEP);
 g.strokeStyle="#523522";g.lineWidth=24;g.stroke();g.strokeStyle="#d58a45";g.lineWidth=17;g.stroke();
 g.strokeStyle="#4ebc42";g.lineWidth=10;g.stroke();g.strokeStyle="#b8f56b";g.lineWidth=3;g.stroke();
 const signY=cy-loopTrack.r-35;g.fillStyle="#563729";g.fillRect(x-40,signY,80,20);g.fillStyle="#9df05a";g.fillRect(x-36,signY+3,72,14);
 g.fillStyle="#1b5637";g.font="bold 11px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("SPEED LOOP",x,signY+10);g.restore();
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
function drawRing(r){
 if(r.got)return;
 const x=r.x-camera,y=r.y+Math.sin(elapsed*5+r.x)*2.3;
 const squash=.34+.66*Math.abs(Math.sin(elapsed*3.1+r.x*.018));
 g.save();g.translate(x,y);g.scale(squash,1);
 // Gold ring: thick shadow, warm gradient, bright edge and a white glint.
 g.strokeStyle="#7c430f";g.lineWidth=9;g.beginPath();g.ellipse(1.5,2,10,13,0,0,Math.PI*2);g.stroke();
 const gold=g.createLinearGradient(-10,-13,10,14);gold.addColorStop(0,"#fff9aa");gold.addColorStop(.26,"#ffed57");gold.addColorStop(.63,"#ffb617");gold.addColorStop(1,"#d97810");
 g.strokeStyle=gold;g.lineWidth=6;g.beginPath();g.ellipse(0,0,9.5,12,0,0,Math.PI*2);g.stroke();
 g.strokeStyle="#fffbd4";g.lineWidth=2.2;g.beginPath();g.ellipse(-1.8,-2,5.4,7.5,0,Math.PI*1.12,Math.PI*1.82);g.stroke();
 g.restore();
}
function drawEnemy(e){
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
}/* Carga directamente los SVG que sí están en assets/sonic.
   No dependemos de project.json, porque ese archivo no está en la raíz del repositorio. */
let sonicAnimations={idle:[],run:[],dash:[],speeddash:[],jump:[],spin:[],fall:[],ready:false};
const sonicSpriteFiles={
 idle:[
  "01740b16763e9570f66ce0faf001c035.svg",
  "0f0fe78857ea041f15fde4fec23023ae.svg",
  "172146abbfa4348e9f0a63ada310f3fc.svg"
 ],
 run:[
  "07c7cc8d51f6e0a3feef7e40bc98d62e.svg",
  "593317731819fb43d31d97d7fcff9c14.svg",
  "c71e608d77556b1e6a484888bb70ec4a.svg",
  "f5d47bb333339f157b9fd8567188ad19.svg",
  "f2542218ee731bfcc4911b9e90120b24.svg",
  "e977afdd8469ddd252b2654da0f30ad2.svg",
  "7b538cdee48eb69c53c9169f3cc07941.svg",
  "4e53232099ed2bda8c569d1d7ebfae64.svg"
 ],
 jump:["66a1cf3c5c762ce8c8330ea6faa81549.svg"],
 dash:[
  "27a64ba40464d134f7650ecc79759a2b.svg",
  "aeefb13ebb8deaa7be9231a353f9b7cb.svg",
  "19738b23f8e867b11a7b2a9a3a911f4e.svg",
  "8044cc670da7557d30c4c3330efa75f6.svg"
 ],
 speeddash:[
  "a19f441b6c45d019a4b2fc9600dc5b6e.svg",
  "874f590f9bb1c565f85f9163d4fa0100.svg",
  "c48f11f9eb3267704d212a0b496ccf1b.svg",
  "e7249d0f8afa580f8c4bb2a1f5e6de60.svg"
 ],
 fall:[
  "463471181dc7d56b61067295cc25ceec.svg",
  "3bf7c06e2758651c68a0825b2fecd156.svg"
 ],
 spin:[
  "e4267914ba5b6441124e0e990a123fec.svg",
  "c1208453f3701096d5877803e6657c9e.svg",
  "3b6181d7c0f1ca61f51c81a31b90ff35.svg",
  "f36bc5dd5dd01907d45daacf611eccd8.svg",
  "272d17a2be621eb6c5a6448ef3f38ee3.svg"
 ]
};
function visibleImageBounds(img){
 const width=Math.max(1,Math.ceil(img.naturalWidth)),height=Math.max(1,Math.ceil(img.naturalHeight));
 if(width*height>1500000)return {x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
 try{
  const probe=document.createElement("canvas");probe.width=width;probe.height=height;
  const pctx=probe.getContext("2d",{willReadFrequently:true});pctx.drawImage(img,0,0,width,height);
  const pixels=pctx.getImageData(0,0,width,height).data;
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   if(pixels[(y*width+x)*4+3]>18){if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y}
  }
  if(right<left||bottom<top)return {x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
  return {x:left,y:top,width:right-left+1,height:bottom-top+1};
 }catch(_){return {x:0,y:0,width:img.naturalWidth,height:img.naturalHeight}}
}
function loadSonicFrame(file){
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>resolve({file,img,bounds:visibleImageBounds(img)});
  img.onerror=()=>{console.warn("No se pudo cargar el sprite:",file);resolve(null)};
  img.src="./assets/sonic/"+file;
 });
}
async function loadSonicCostumes(){
 const loaded=await Promise.all(Object.entries(sonicSpriteFiles).map(async([state,files])=>{
  const frames=(await Promise.all(files.map(loadSonicFrame))).filter(Boolean);
  return [state,frames];
 }));
 const result=Object.fromEntries(loaded);
 sonicAnimations={
  idle:result.idle||[],
  run:result.run||[],
  dash:result.dash||[],
  speeddash:result.speeddash||[],
  jump:result.jump||[],
  spin:result.spin||[],
  fall:result.fall||[],
  ready:Boolean((result.idle||[]).length&&(result.run||[]).length&&(result.dash||[]).length&&(result.speeddash||[]).length&&(result.spin||[]).length&&(result.fall||[]).length)
 };
 console.info("Blue Rush: animaciones de Sonic",{
  idle:sonicAnimations.idle.length,run:sonicAnimations.run.length,dash:sonicAnimations.dash.length,
  speeddash:sonicAnimations.speeddash.length,spin:sonicAnimations.spin.length,fall:sonicAnimations.fall.length
 });
 if(!running){
  status.textContent=sonicAnimations.ready
   ?"SPRITES REALES LISTOS · PULSA JUGAR"
   :"NO SE CARGARON LOS SVG · RECARGA LA PÁGINA";
 }
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
}function drawPlayer(){
 const x=player.x-camera+player.w/2,y=player.y+player.h/2;
 if(player.invincible>0&&Math.floor(elapsed*16)%2===0)return;
 if(!sonicAnimations.ready){drawFallbackPlayer();return}
 const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);
 const groundGap=terrainHeight(player.x+player.w/2)-(player.y+player.h);
 // En una bajada, la inclinación y la velocidad pueden crear una separación mínima.
 // Cerca del suelo, conserva el sprite de carrera; el salto mantiene su animación aérea.
 const slopeRunning=!player.onGround&&!player.spin&&player.vy>=0&&Math.abs(player.vx)>25&&groundGap>=-10&&groundGap<56;
 const moving=(player.onGround||slopeRunning)&&Math.abs(player.vx)>25;
 const rolling=Boolean(player.spin)&&!player.onGround;
 const falling=!player.onGround&&!rolling&&!slopeRunning;
 let frames,index;
 if(rolling){
  frames=sonicAnimations.spin;
  index=Math.floor(player.spinPhase*frames.length)%Math.max(1,frames.length);
 }else if(falling){
  frames=sonicAnimations.fall;
  index=Math.floor(player.fallPhase*frames.length)%Math.max(1,frames.length);
 }else if(moving){
  frames=speedRatio>=0.78?sonicAnimations.speeddash:(speedRatio>=0.47?sonicAnimations.dash:sonicAnimations.run);
  index=Math.floor(player.runPhase*frames.length)%Math.max(1,frames.length);
 }else{
  frames=sonicAnimations.idle;
  index=Math.floor(elapsed*2.5)%Math.max(1,frames.length);
 }
 const usable=frames&&frames.length?frames:(sonicAnimations.idle.length?sonicAnimations.idle:[]);
 if(!usable.length){drawFallbackPlayer();return}
 const entry=usable[index%usable.length];
 const img=entry&&entry.img;
 if(!img||!img.naturalWidth||!img.naturalHeight){drawFallbackPlayer();return}
 const b=entry.bounds||{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
 // Recorta transparencias de los SVG para mantener a Sonic centrado y con una escala legible.
 const airbornePose=rolling||falling;
 // Sonic crece visualmente al alcanzar la velocidad máxima y también al caer.
 const maxSpeedPose=moving&&speedRatio>=0.78;
 const targetW=falling?66:(rolling?46:(maxSpeedPose?76:56));
 const targetH=falling?66:(rolling?46:(maxSpeedPose?72:54));
 const scale=Math.min(targetW/Math.max(1,b.width),targetH/Math.max(1,b.height));
 const dw=b.width*scale,dh=b.height*scale;
 g.save();g.translate(Math.round(x),Math.round(y));
 if(rolling)g.rotate(player.spinAngle||0);
 else{
  if(moving)g.rotate(player.facing*speedRatio*0.055);
  if(player.facing<0)g.scale(-1,1);
 }
 g.imageSmoothingEnabled=true;
 g.drawImage(img,b.x,b.y,b.width,b.height,-dw/2,airbornePose?-dh/2:player.h/2-dh-1,dw,dh);
 g.restore();
}function drawPlayerName(){
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
 ctx.imageSmoothingEnabled=true;
 ctx.clearRect(0,0,W,H);
 ctx.drawImage(scene,0,0,W,H);
}
function draw(){
 lastRenderError="";
 const stages=[
  ["FONDO",drawBackground],
  ["ARO ESTRUCTURAL",drawLoopBack],
  ["SUELO",drawGround],
  ["CUMBRES ROCOSAS",drawMountainDetails],
  ["DECORACIÓN",drawDecorations],
  ["ANILLOS",()=>rings.forEach(drawRing)],
  ["ENEMIGOS",()=>enemies.forEach(drawEnemy)],
  ["OTROS JUGADORES",drawRemotePlayers],
  ["SONIC",drawPlayer],
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
    scene.width=Math.floor(VIEW_W/PIXEL);scene.height=Math.floor(VIEW_H/PIXEL);g.imageSmoothingEnabled=true;
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