(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status'),playerNameInput=document.getElementById('playerName');
let playerName='';
const W=canvas.width,H=canvas.height,GROUND=390,keys={left:false,right:false};
// Spritesheet Green Island (edición gratuita).
const greenIsland=new Image();greenIsland.src='./assets/green-island/free_edition.png';let greenIslandReady=false;greenIsland.onload=()=>{greenIslandReady=true};
// Acto largo, pensado para durar aproximadamente 1,5–2 minutos a velocidad normal.
const worldWidth=36000;
const terrainSections=[
 [0,390],[350,390],[700,382],[1050,360],[1400,337],[1750,346],[2100,378],[2450,405],[2800,412],[3150,390],
 [3500,360],[3850,326],[4200,318],[4550,344],[4900,382],[5250,421],[5600,428],[5950,394],[6300,358],[6650,340],
 [7000,354],[7350,388],[7700,412],[8050,402],[8400,365],[8750,332],[9100,326],[9450,350],[9800,397],[10150,418],
 [10500,390],[10850,350],[11200,328],[11550,342],[11900,378],[12250,402],[12600,410],[12950,400],[13300,382],[13650,356],
 [14000,342],[14350,362],[14700,398],[15050,424],[15400,418],[15750,386],[16100,350],[16450,330],[16800,340],[17150,374],
 [17500,407],[17850,414],[18200,387],[18550,350],[18900,326],[19250,342],[19600,385],[19950,421],[20300,429],[20650,398],
 [21000,358],[21350,326],[21700,320],[22050,350],[22400,392],[22750,414],[23100,402],[23450,372],[23800,342],[24150,330],
 [24500,354],[24850,392],[25200,424],[25550,428],[25900,394],[26250,356],[26600,329],[26950,340],[27300,378],[27650,414],
 [28000,420],[28350,386],[28700,348],[29050,326],[29400,338],[29750,378],[30100,418],[30450,421],[30800,388],[31150,350],
 [31500,326],[31850,334],[32200,368],[32550,405],[32900,413],[33250,382],[33600,344],[33950,330],[34300,350],[34650,390],
 [35000,414],[35350,396],[35700,370],[36000,390]
];
// Interpolación suave entre puntos: crea colinas y bajadas sin escalones bruscos.// Interpolación suave entre puntos: crea colinas y bajadas sin escalones bruscos.
function terrainHeight(x){
 x=Math.max(0,Math.min(worldWidth,x));
 let i=0;while(i<terrainSections.length-2&&terrainSections[i+1][0]<x)i++;
 const [x0,y0]=terrainSections[i],[x1,y1]=terrainSections[i+1];
 const t=(x-x0)/(x1-x0),smooth=t*t*(3-2*t);
 return y0+(y1-y0)*smooth;
}
const levelSections=[
 {start:0,end:3000,name:"COSTA VERDE",kind:"coast"},
 {start:3000,end:7000,name:"COLINAS DE LA ISLA",kind:"hills"},
 {start:7000,end:12000,name:"SENDEROS SECRETOS",kind:"routes"},
 {start:12000,end:17000,name:"PUENTES DE LA LAGUNA",kind:"lagoon"},
 {start:17000,end:22000,name:"RUINAS DE LA ISLA",kind:"ruins"},
 {start:22000,end:27000,name:"BAJADA DEL VIENTO",kind:"wind"},
 {start:27000,end:33000,name:"CAMINO DEL GUARDIÁN",kind:"guardian"},
 {start:33000,end:36000,name:"RECTA FINAL",kind:"finish"}
];
function sectionAt(x){return levelSections.find(section=>x>=section.start&&x<section.end)||levelSections[levelSections.length-1]}

let running=false,lastTime=0,elapsed=0,camera=0,score=0,lives=3,player;
// Plataformas en alturas alcanzables: forman caminos opcionales sobre el recorrido.
const platformSpecs=[
 [560,88,124],[1120,105,112],[1760,86,138],[2480,98,116],
 [3380,96,130],[4050,114,118],[4740,92,150],[5480,104,124],[6250,88,138],
 [7120,102,120],[7520,96,126],[7820,91,138],[8170,98,124],[8520,116,124],[8870,94,132],[9270,88,142],[9630,96,130],[10000,104,126],
 [10400,100,132],[10900,90,132],[11280,104,124],[11650,112,142],[11900,88,126],[12480,86,126],[13450,100,146],[14380,92,132],[15300,112,138],[16250,88,126],
 [17180,100,142],[17580,96,126],[18050,116,126],[18480,90,132],[18950,86,148],[19380,96,124],[19800,104,126],[20250,110,134],[20750,90,140],[21150,94,130],
 [21600,112,132],[21900,96,126],[22500,88,126],[22950,100,132],[23400,105,148],[23850,92,126],[24350,91,126],[24780,108,134],[25200,112,142],[25680,100,128],[26100,86,132],[26500,96,130],
 [27000,98,142],[27500,104,124],[27950,112,124],[28400,94,136],[28900,88,148],[29350,100,126],[29800,104,130],[30250,96,132],[30700,91,142],[31150,105,126],[31600,110,128],[32050,96,134],
 [32500,90,142],[32800,96,126],[33400,104,126],[33850,96,140],[34300,92,148],[34750,98,126],[35200,86,126],[35600,90,130]
].map(([x,clearance,w])=>({
 // Elevar la ruta sin superar una diferencia de altura excesiva para el salto normal.
 x,y:Math.max(175,terrainHeight(x)-Math.min(clearance+20,126)),w
}));
const bridgeSpecs=[{x:12650,w:390,label:"LAGUNA"},{x:22630,w:420,label:"VIENTO"}];
const platforms=[];
let rings=[],enemies=[],collected=new Set(),springs=[],boosters=[],checkpoints=[];
let checkpointX=90,levelCompleted=false;
function buildLevel(){
 rings=[];collected=new Set();platforms.length=0;
 platformSpecs.forEach(p=>platforms.push({...p,h:34}));
 // Las rutas de anillos cambian entre líneas fáciles, arcos de salto y premios elevados.
 let group=0;
 for(let x=155;x<worldWidth-220;x+=320,group++){
  const zone=sectionAt(x),pattern=(group+(Math.floor(x/5000)*2))%5,count=5+(group%3);
  for(let i=0;i<count;i++){
   const rx=x+i*29,base=terrainHeight(rx);
   let offset;
   if(pattern===0)offset=42;
   else if(pattern===1)offset=54+Math.sin(i/(count-1)*Math.PI)*56;
   else if(pattern===2)offset=zone.kind==="ruins"?126:104;
   else if(pattern===3)offset=48+Math.sin(i/(count-1)*Math.PI)*34;
   else offset=zone.kind==="finish"?76:40;
   rings.push({id:group+"-"+i,x:rx,y:Math.max(120,base-offset),got:false});
  }
 }
 // Las plataformas elevadas tienen su propia recompensa.
 platformSpecs.forEach((p,index)=>{for(let i=0;i<4;i++)rings.push({id:"upper-"+index+"-"+i,x:p.x+19+i*27,y:p.y-24-(i===1||i===2?17:0),got:false})});
 const enemyPositions=[980,2180,3700,5050,6550,8150,9550,11050,13900,15100,17450,19350,21100,23850,25500,27600,29450,31250,32950,34600];
 enemies=enemyPositions.map((x,index)=>({x,y:terrainHeight(x)-28,alive:true,base:x,kind:index%3}));
 springs=[2250,5850,9250,11620,14820,18720,21680,24900,28600,31950,34080].map((x,index)=>({x,y:terrainHeight(x),w:34,h:20,used:false,index}));
 boosters=[3350,6900,10350,13200,16850,20250,23500,26600,30200,32500,35000].map((x,index)=>({x,y:terrainHeight(x),w:76,h:12,active:false,index}));
 checkpoints=[9000,18000,27000].map((x,index)=>({x,y:terrainHeight(x),active:false,index}));
}

function resetPlayer(){player={x:90,y:terrainHeight(90)-43,w:34,h:43,vx:0,vy:0,speed:560,speedCharge:0,boost:0,jump:625,onGround:true,facing:1,invincible:0,spin:0,spinAngle:0,runPhase:0,fallPhase:0,spinPhase:0};camera=0;elapsed=0;score=0;lives=3;checkpointX=90;levelCompleted=false;buildLevel()}
function startGame(){if(!running){if(levelCompleted)resetPlayer();startScreen.querySelector('h2').textContent='¡Vamos, Sonic!';startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';startButton.innerHTML='JUGAR <span aria-hidden="true">→</span>';playerName=(playerNameInput.value||playerName||'').trim().slice(0,16)||'Sonic';playerNameInput.value=playerName;running=true;startScreen.classList.add('hidden');status.textContent='¡CORRE POR LA ISLA Y DESCUBRE SUS RUTAS!';lastTime=performance.now()}}
function resetGame(){running=false;keys.left=keys.right=false;resetPlayer();startScreen.querySelector('h2').textContent='¡Vamos, Sonic!';startScreen.querySelector('p:not(.start-kicker)').textContent='Escribe tu nombre para comenzar la aventura.';startButton.innerHTML='JUGAR <span aria-hidden="true">→</span>';startScreen.classList.remove('hidden');status.textContent='PULSA JUGAR PARA EMPEZAR';draw()}
function jump(){if(!running)startGame();if(player.onGround){player.vy=-player.jump;player.onGround=false;player.spin=1;player.spinAngle=0}}
function setKey(key,down){const k=key.toLowerCase();if(key==='ArrowLeft'||k==='a')keys.left=down;if(key==='ArrowRight'||k==='d')keys.right=down;if(down&&(key===' '||key==='ArrowUp'||k==='w'))jump();if(down&&key==='Enter'&&!running)startGame()}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();setKey(e.key,true)});
window.addEventListener('keyup',e=>setKey(e.key,false));window.addEventListener('blur',()=>{keys.left=keys.right=false});
startButton.addEventListener('click',startGame);resetButton.addEventListener('click',resetGame);
document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const press=e=>{e.preventDefault();if(c==='jump')jump();else{if(!running)startGame();keys[c]=true}};const release=e=>{e.preventDefault();if(c!=='jump')keys[c]=false};b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('pointerleave',release)});
function update(dt){
 if(!running)return;elapsed+=dt;
 if(player.boost>0)player.boost=Math.max(0,player.boost-dt);
 const dir=Number(keys.right)-Number(keys.left);
 if(dir){
  if(player.vx!==0&&Math.sign(player.vx)!==dir)player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);
  else player.speedCharge=Math.min(1,player.speedCharge+0.28*dt);
  player.facing=dir;const targetSpeed=dir*(145+415*player.speedCharge+(player.boost>0?160:0));
  player.vx+=(targetSpeed-player.vx)*Math.min(1,5.2*dt);
 }else{
  player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);player.vx*=Math.pow(0.0008,dt);
  if(Math.abs(player.vx)<8)player.vx=0;
 }
 const speedLimit=player.speed+(player.boost>0?160:0);
 player.vx=Math.max(-speedLimit,Math.min(speedLimit,player.vx));
 const oldBottom=player.y+player.h,oldX=player.x,oldGround=terrainHeight(oldX+player.w/2);
 player.x=Math.max(0,Math.min(worldWidth-player.w,player.x+player.vx*dt));
 player.vy+=1550*dt;player.y+=player.vy*dt;player.onGround=false;
 if(player.spin)player.spinAngle=(player.spinAngle||0)+player.vx*dt/45;
 const groundNow=terrainHeight(player.x+player.w/2),groundPrev=oldGround,descending=player.vy>=0;
 if(descending&&player.y+player.h>=groundNow&&oldBottom<=groundPrev+Math.max(18,Math.abs(player.vx)*dt*.8)){
  player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0;
 }
 for(const p of platforms){
  const bottom=player.y+player.h,overlap=player.x+player.w>p.x&&player.x<p.x+p.w;
  if(player.vy>=0&&overlap&&oldBottom<=p.y+8&&bottom>=p.y){player.y=p.y-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0}
 }
 // Saltos elásticos en resortes.
 for(const spring of springs){
  const touching=player.x+player.w>spring.x-4&&player.x<spring.x+spring.w+4;
  if(touching&&player.onGround){
   player.y=terrainHeight(player.x+player.w/2)-player.h-2;player.vy=-820;player.onGround=false;player.spin=1;player.spinAngle=0;player.spinPhase=0;
   player.speedCharge=Math.min(1,player.speedCharge+.22);if(!spring.used){score+=50;spring.used=true}break;
  }
 }
 // Aceleradores: impulsan hacia donde mira el jugador, una vez por contacto.
 for(const pad of boosters){
  const touching=player.onGround&&player.x+player.w>pad.x&&player.x<pad.x+pad.w;
  if(touching&&!pad.active){const boostDir=player.facing||1;player.boost=1.8;player.vx=boostDir*Math.max(650,Math.abs(player.vx));player.facing=boostDir;player.speedCharge=1;pad.active=true}
  else if(!touching)pad.active=false;
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
  const hit=player.x+player.w>e.x-19&&player.x<e.x+19&&player.y+player.h>e.y-24&&player.y<e.y+20;
  if(hit){
   if(player.vy>100&&player.y+player.h<e.y+12){e.alive=false;player.vy=-370;score+=100}
   else if(player.invincible<=0){
    if(rings.some(r=>r.got)){let drop=0;rings.forEach(r=>{if(r.got&&drop<8){r.got=false;r.x=player.x+player.w+drop*12;r.y=player.y+Math.sin(drop)*-22;drop++}})}
    else{lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Te has quedado sin vidas. Pulsa jugar para volver a empezar.';resetPlayer()}}
    player.invincible=1.5;player.speedCharge=0;player.vy=-300;player.vx=-player.facing*180;
   }
  }
 });
 if(player.y>H+100){
  player.x=Math.max(30,checkpointX);player.y=terrainHeight(player.x)-player.h;player.vy=0;player.vx=0;player.speedCharge=0;lives--;
  if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Caíste fuera del recorrido. Pulsa jugar para volver a empezar.';resetPlayer()}
 }
 if(player.x>=worldWidth-player.w-90&&!levelCompleted){
  running=false;levelCompleted=true;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Nivel completado!';
  startScreen.querySelector('p:not(.start-kicker)').textContent='¡Llegaste al final de Blue Rush! Puntos: '+score+'. Pulsa para correr otra vez.';
  startButton.innerHTML='JUGAR OTRA VEZ <span aria-hidden="true">↻</span>';
 }
 camera=Math.max(0,Math.min(worldWidth-W,player.x-W*.34));
 const zone=sectionAt(player.x);
 status.textContent=zone.name+' · ANILLOS '+rings.filter(r=>r.got).length+' · '+score+' PTS · VIDAS '+lives;
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
// Render retro: baja resolución virtual ampliada sin suavizado.
const PIXEL=1;
const scene=document.createElement('canvas');
scene.width=Math.floor(W/PIXEL);scene.height=Math.floor(H/PIXEL);
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

}
function traceTerrain(){
 g.beginPath();
 g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=scene.width;x+=4)g.lineTo(x,terrainHeight(camera+x));
}
function drawGround(){
 const w=scene.width,h=scene.height,tile=32;
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
 const x=bridge.x-camera,w=bridge.w;if(x>scene.width+20||x+w< -20)return;
 const base=terrainHeight(bridge.x+w/2),top=base-6;
 g.save();g.fillStyle="#6f4029";g.fillRect(x,top+7,w,9);
 for(let i=0;i<w;i+=24){g.fillStyle=i%48===0?"#bd8246":"#d49a55";g.fillRect(x+i,top,21,10);g.fillStyle="#70462d";g.fillRect(x+i,top+8,21,3);g.fillStyle="#ffe0a0";g.fillRect(x+i+2,top+1,14,2)}
 g.fillStyle="#80502d";g.fillRect(x,top-4,w,4);
 for(let i=0;i<=w;i+=52){g.fillStyle="#7f4b2e";g.fillRect(x+i,top-12,5,12);g.fillStyle="#e4bd7a";g.fillRect(x+i+1,top-11,2,7)}
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
function drawSpring(spring){
 const x=spring.x-camera,y=terrainHeight(spring.x);if(x< -50||x>scene.width+50)return;
 g.save();g.fillStyle="rgba(10,52,44,.28)";g.beginPath();g.ellipse(x+spring.w/2,y+2,24,6,0,0,Math.PI*2);g.fill();
 g.fillStyle="#b41f33";g.fillRect(x,y-20,spring.w,18);g.fillStyle="#f34b45";g.fillRect(x+3,y-18,spring.w-6,12);
 g.fillStyle="#ffe45c";g.fillRect(x-3,y-23,spring.w+6,6);g.fillStyle="#fff6b4";g.fillRect(x+2,y-22,8,2);
 g.fillStyle="#6c2737";g.fillRect(x+4,y-7,spring.w-8,3);g.restore();
}
function drawBooster(pad){
 const x=pad.x-camera,y=terrainHeight(pad.x);if(x>scene.width+90||x+pad.w< -90)return;
 g.save();g.fillStyle="rgba(8,58,58,.2)";g.fillRect(x,y-2,pad.w,7);g.fillStyle="#075b84";g.fillRect(x,y-10,pad.w,10);
 g.fillStyle=pad.active?"#8bd7e7":"#26c9ef";g.fillRect(x+3,y-9,pad.w-6,5);
 for(let i=0;i<3;i++){const ax=x+12+i*22;g.fillStyle="#fff";g.beginPath();g.moveTo(ax,y-8);g.lineTo(ax+11,y-6);g.lineTo(ax,y-3);g.closePath();g.fill()}
 g.restore();
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
 for(let wx=260;wx<6800;wx+=610)drawPalm(wx,Math.floor(wx/610)%3);
 for(let wx=7050;wx<11900;wx+=1120)drawPalm(wx,Math.floor(wx/1120)%3);
 bridgeSpecs.forEach(drawWoodBridge);
 for(let wx=17300;wx<21900;wx+=470)drawRuin(wx,Math.floor(wx/470)%3);
 for(let wx=22200;wx<26800;wx+=1320)drawPalm(wx,Math.floor(wx/1320)%3);
 for(let wx=27100;wx<32900;wx+=680){if(Math.floor(wx/680)%3!==1)drawPalm(wx,Math.floor(wx/680)%3);else drawRuin(wx,1)}
 for(let wx=33100;wx<35800;wx+=740)drawPalm(wx,Math.floor(wx/740)%3);
 springs.forEach(drawSpring);boosters.forEach(drawBooster);checkpoints.forEach(drawCheckpoint);drawFinish();
}
function drawPlatform(p){
 const x=p.x-camera,y=p.y,w=p.w,h=34;
 if(greenIslandReady){g.save();g.imageSmoothingEnabled=false;g.drawImage(greenIsland,144,80,80,32,x,y,w,h);g.imageSmoothingEnabled=true;g.restore();return;}
 g.save();
 // Bold shadow and rounded soil block, consistent with the character's outlined SVG art.
 g.fillStyle="rgba(7,51,43,.24)";g.beginPath();g.ellipse(x+w/2,y+h+5,w*.54,7,0,0,Math.PI*2);g.fill();
 const soil=g.createLinearGradient(0,y+8,0,y+h);
 soil.addColorStop(0,"#d98b43");soil.addColorStop(.5,"#b25d32");soil.addColorStop(1,"#773b2c");
 g.fillStyle=soil;g.strokeStyle="#6c3929";g.lineWidth=2;
 roundedRectPath(g,x,y+7,w,h-7,4);g.fill();g.stroke();
 for(let xx=x+2;xx<x+w-1;xx+=22){
  for(let yy=y+10;yy<y+h-2;yy+=12){
   g.fillStyle=(Math.floor((xx+p.x)/22)+Math.floor(yy/12))%2===0?"rgba(255,191,99,.65)":"rgba(87,43,30,.28)";
   g.fillRect(xx,yy,20,10);
  }
 }
 const grass=g.createLinearGradient(0,y,0,y+12);
 grass.addColorStop(0,"#9ed879");grass.addColorStop(.36,"#398c4d");grass.addColorStop(1,"#1b5f39");
 g.fillStyle=grass;g.strokeStyle="#086c38";g.lineWidth=2.3;
 roundedRectPath(g,x,y,w,11,4);g.fill();g.stroke();
 g.strokeStyle="#efffa4";g.lineWidth=2;g.beginPath();g.moveTo(x+6,y+2);g.lineTo(x+w-7,y+2);g.stroke();
 for(let xx=x+14;xx<x+w-4;xx+=29){g.strokeStyle="#08763b";g.lineWidth=1.4;g.beginPath();g.moveTo(xx,y+10);g.lineTo(xx-2,y+15);g.stroke()}
 g.restore();
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
 const x=e.x-camera,y=e.y+Math.sin(elapsed*4+e.base)*1.7;
 g.save();g.translate(x,y);
 // Distinct shadow and little metal feet anchor the badnik to the grass.
 g.fillStyle="rgba(13,49,76,.23)";g.beginPath();g.ellipse(0,23,25,6,0,0,Math.PI*2);g.fill();
 g.strokeStyle="#213d58";g.lineWidth=5;g.lineCap="round";
 g.beginPath();g.moveTo(-11,8);g.lineTo(-17,18);g.moveTo(11,8);g.lineTo(17,18);g.stroke();
 g.fillStyle="#ffcf42";g.strokeStyle="#8b541b";g.lineWidth=1.5;
 g.beginPath();g.ellipse(-18,19,6,3.4,0,0,Math.PI*2);g.ellipse(18,19,6,3.4,0,0,Math.PI*2);g.fill();g.stroke();
 const shell=g.createLinearGradient(0,-19,0,14);shell.addColorStop(0,"#ff8064");shell.addColorStop(.45,"#f3403e");shell.addColorStop(1,"#bb1e38");
 g.fillStyle="#203b58";g.strokeStyle="#122a47";g.lineWidth=2.5;g.beginPath();g.ellipse(0,4,22,15,0,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle=shell;g.strokeStyle="#87213a";g.lineWidth=2.2;g.beginPath();g.moveTo(-20,2);g.quadraticCurveTo(-19,-16,0,-18);g.quadraticCurveTo(19,-16,20,2);g.quadraticCurveTo(0,15,-20,2);g.closePath();g.fill();g.stroke();
 // Cream eye patches and dark pupils give the custom enemy the same outlined style.
 g.fillStyle="#ffc2a7";g.strokeStyle="#9b3540";g.lineWidth=1;g.beginPath();g.ellipse(-7,-5,6,7,0,0,Math.PI*2);g.ellipse(7,-5,6,7,0,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle="#fff";g.beginPath();g.ellipse(-7,-5,4,5.2,0,0,Math.PI*2);g.ellipse(7,-5,4,5.2,0,0,Math.PI*2);g.fill();
 g.fillStyle="#152943";g.beginPath();g.ellipse(-6,-4,1.8,3.3,0,0,Math.PI*2);g.ellipse(8,-4,1.8,3.3,0,0,Math.PI*2);g.fill();
 g.strokeStyle="#ffe070";g.lineWidth=2;g.beginPath();g.moveTo(0,-17);g.quadraticCurveTo(6,-25,12,-20);g.stroke();
 g.fillStyle="#fff3a0";g.strokeStyle="#a55c18";g.lineWidth=1;g.beginPath();g.arc(13,-20,3.6,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle="#85e5ff";g.beginPath();g.arc(-14,4,2.2,0,Math.PI*2);g.arc(14,4,2.2,0,Math.PI*2);g.fill();
 g.restore();
}

/* Carga directamente los SVG que sí están en assets/sonic.
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
 const moving=player.onGround&&Math.abs(player.vx)>25;
 const rolling=Boolean(player.spin)&&!player.onGround;
 // El salto manual usa bolita; la caída se reserva para el aire sin salto.
 const falling=!player.onGround&&!rolling;
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
  ["SUELO",drawGround],
  ["DECORACIÓN",drawDecorations],
  ["PLATAFORMAS",()=>platforms.forEach(drawPlatform)],
  ["ANILLOS",()=>rings.forEach(drawRing)],
  ["ENEMIGOS",()=>enemies.forEach(drawEnemy)],
  ["SONIC",drawPlayer],
  ["NOMBRE",drawPlayerName]
 ];
 let copied=false;
 for(const [name,render] of stages){
  try{
   render();
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
    scene.width=W;scene.height=H;g.imageSmoothingEnabled=true;
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
 try{draw()}catch(error){
  console.error("[Blue Rush] Error fatal de renderizado",error);
  if(status)status.textContent="ERROR DEL JUEGO · RECARGA LA PÁGINA";
 }
 requestAnimationFrame(loop);
}
resetPlayer();draw();requestAnimationFrame(loop);
})();