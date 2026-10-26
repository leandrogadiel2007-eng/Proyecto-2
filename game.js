(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status'),playerNameInput=document.getElementById('playerName');
let playerName='';
const W=canvas.width,H=canvas.height,GROUND=390,keys={left:false,right:false};
// Spritesheet Green Island (edición gratuita).
const greenIsland=new Image();greenIsland.src='./assets/green-island/free_edition.png';let greenIslandReady=false;greenIsland.onload=()=>{greenIslandReady=true};
const worldWidth=12000;
const terrainSections=[];
// Nivel completamente recto: la superficie siempre está a la misma altura.
function terrainHeight(x){return 390;}
let running=false,lastTime=0,elapsed=0,camera=0,score=0,lives=3,player;
// Piezas colocadas a mano: cada sección tiene una función en el recorrido.
const platformSpecs=[];
const platforms=[];
let rings=[],enemies=[],collected=new Set();
function buildLevel(){
 rings=[];collected=new Set();
 // Anillos en grupos con intención: líneas bajas, saltos y recompensas elevadas.
 const ringGroups=[
  [170,6,'low'],[520,5,'arc'],[900,6,'high'],[1260,5,'low'],
  [1640,7,'arc'],[2040,5,'high'],[2390,6,'low'],[2770,6,'arc'],
  [3190,5,'high'],[3550,6,'low'],[3950,7,'arc'],[4390,5,'high'],
  [4740,6,'low'],[5160,6,'arc'],[5580,5,'high'],[5930,6,'low'],
  [6350,7,'arc'],[6800,5,'high'],[7160,6,'low'],[7580,6,'arc'],
  [8000,5,'high'],[8360,6,'low'],[8790,7,'arc'],[9220,5,'high'],
  [9580,6,'low'],[10000,6,'arc'],[10420,5,'high'],[10800,6,'low'],
  [11200,7,'arc'],[11600,5,'low']
 ];
 ringGroups.forEach(([x,count,type],row)=>{
  for(let i=0;i<count;i++){
   const rx=x+i*27;
   const base=terrainHeight(rx);
   let y=base-(type==='high'?112:type==='arc'?66+Math.sin(i/(count-1)*Math.PI)*48:43);
   // Evita que los anillos de las rutas altas queden dentro del suelo.
   y=Math.min(y,base-38);
   rings.push({id:row+'-'+i,x:rx,y,got:false});
  }
 });
 enemies=[];
 // Enemigos espaciados, no puestos en cada salto ni junto a cada plataforma.
 [840,1780,2630,3500,4630,5480,6620,7490,8610,9470,10570,11420].forEach(x=>enemies.push({x,y:terrainHeight(x)-28,alive:true,base:x}));
}
function resetPlayer(){player={x:90,y:terrainHeight(90)-43,w:34,h:43,vx:0,vy:0,speed:560,speedCharge:0,jump:625,onGround:true,facing:1,invincible:0,spin:0,spinAngle:0,runPhase:0,fallPhase:0,spinPhase:0};camera=0;elapsed=0;score=0;lives=3;buildLevel()}
function startGame(){if(!running){playerName=(playerNameInput.value||'').trim().slice(0,16)||'Sonic';playerNameInput.value=playerName;running=true;startScreen.classList.add('hidden');status.textContent='¡CORRE Y RECOGE ANILLOS!';lastTime=performance.now()}}
function resetGame(){running=false;keys.left=keys.right=false;resetPlayer();startScreen.classList.remove('hidden');status.textContent='PULSA JUGAR PARA EMPEZAR';draw()}
function jump(){if(!running)startGame();if(player.onGround){player.vy=-player.jump;player.onGround=false;player.spin=1;player.spinAngle=0}}
function setKey(key,down){const k=key.toLowerCase();if(key==='ArrowLeft'||k==='a')keys.left=down;if(key==='ArrowRight'||k==='d')keys.right=down;if(down&&(key===' '||key==='ArrowUp'||k==='w'))jump();if(down&&key==='Enter'&&!running)startGame()}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();setKey(e.key,true)});
window.addEventListener('keyup',e=>setKey(e.key,false));window.addEventListener('blur',()=>{keys.left=keys.right=false});
startButton.addEventListener('click',startGame);resetButton.addEventListener('click',resetGame);
document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const press=e=>{e.preventDefault();if(c==='jump')jump();else{if(!running)startGame();keys[c]=true}};const release=e=>{e.preventDefault();if(c!=='jump')keys[c]=false};b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('pointerleave',release)});
function update(dt){
 if(!running)return;elapsed+=dt;
 const dir=Number(keys.right)-Number(keys.left);
 if(dir){
  if(player.vx!==0&&Math.sign(player.vx)!==dir){
   player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);
  }else{
   player.speedCharge=Math.min(1,player.speedCharge+0.28*dt);
  }
  player.facing=dir;
  const targetSpeed=dir*(145+415*player.speedCharge);
  player.vx+=(targetSpeed-player.vx)*Math.min(1,5.2*dt);
 }else{
  // Al soltar el movimiento, se pierde la inercia y también la carga de velocidad.
  player.speedCharge=Math.max(0,player.speedCharge-2.4*dt);
  player.vx*=Math.pow(0.0008,dt);
  if(Math.abs(player.vx)<8)player.vx=0;
 }
 player.vx=Math.max(-player.speed,Math.min(player.speed,player.vx));
 const oldBottom=player.y+player.h,oldX=player.x,oldGround=terrainHeight(oldX+player.w/2);
 player.x=Math.max(0,Math.min(worldWidth-player.w,player.x+player.vx*dt));
 player.vy+=1550*dt;player.y+=player.vy*dt;player.onGround=false;
  if(player.spin)player.spinAngle=(player.spinAngle||0)+player.vx*dt/45;
 const groundNow=terrainHeight(player.x+player.w/2),groundPrev=oldGround;const descending=player.vy>=0;if(descending&&player.y+player.h>=groundNow&&oldBottom<=groundPrev+Math.max(12,Math.abs(player.vx)*dt*.65)){player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0}else if(player.onGround&&Math.abs(groundNow-groundPrev)<Math.max(18,Math.abs(player.vx)*dt+8)){player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0}
 for(const p of platforms){const bottom=player.y+player.h,overlap=player.x+player.w>p.x&&player.x<p.x+p.w;if(player.vy>=0&&overlap&&oldBottom<=p.y&&bottom>=p.y){player.y=p.y-player.h;player.vy=0;player.onGround=true;player.spin=0;player.spinAngle=0}}
 // La fase continua acompaña la aceleración y evita saltos de fotograma.
 const speedRatio=Math.min(1,Math.abs(player.vx)/player.speed);
 if(player.onGround){
  player.fallPhase=0;
  if(Math.abs(player.vx)>25)player.runPhase+=dt*(0.8+speedRatio*2.25);
 }else if(player.spin){
  player.spinPhase+=dt*(0.8+speedRatio*1.7);
 }else{
  player.fallPhase+=dt*(0.9+speedRatio*1.1);
 }
 if(player.invincible>0)player.invincible-=dt;
 rings.forEach(r=>{if(!r.got&&Math.abs((player.x+player.w/2)-r.x)<24&&Math.abs((player.y+player.h/2)-r.y)<29){r.got=true;score+=10}});
 enemies.forEach(e=>{if(!e.alive)return;e.x=e.base+Math.sin(elapsed*1.6+e.base)*32;e.y=terrainHeight(e.x)-28;const hit=player.x+player.w>e.x-19&&player.x<e.x+19&&player.y+player.h>e.y-24&&player.y<e.y+20;if(hit){if(player.vy>100&&player.y+player.h<e.y+12){e.alive=false;player.vy=-370;score+=100}else if(player.invincible<=0){if(rings.some(r=>r.got)){let drop=0;rings.forEach(r=>{if(r.got&&drop<8){r.got=false;r.x=player.x+player.w+drop*12;r.y=player.y+Math.sin(drop)*-22;drop++}})}else{lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Te has quedado sin vidas. Pulsa jugar para volver a empezar.';resetPlayer()} }player.invincible=1.5;player.speedCharge=0;player.vy=-300;player.vx=-player.facing*180}}});
 if(player.y>H+100){player.x=Math.max(30,player.x-100);player.y=terrainHeight(player.x)-player.h;player.vy=0;player.vx=0;player.speedCharge=0;lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');resetPlayer()}}
 camera=Math.max(0,Math.min(worldWidth-W,player.x-W*.34));
 status.textContent='ANILLOS '+rings.filter(r=>r.got).length+' · PUNTOS '+score+' · VIDAS '+lives;
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
 const w=scene.width,h=scene.height,top=terrainHeight(camera);
 g.save();
 // Suelo inspirado en los juegos clásicos de plataformas: cuadrados grandes alternados,
 // en tonos naranja y café, con bordes de luz/sombra para dar profundidad.
 g.beginPath();g.moveTo(0,h);g.lineTo(0,top);for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));g.lineTo(w,h);g.closePath();g.clip();
 const tile=32;
 const offsetX=-((camera%tile)+tile)%tile;
 const offsetY=top;
 for(let row=0,y=offsetY;y<h;y+=tile,row++){
  const shift=row%2===0?0:tile/2;
  for(let x=offsetX-tile;x<w+tile;x+=tile){
   const xx=x+shift;
   const col=Math.floor((xx+camera)/tile);
   const dark=(col+row)%2===0;
   const base=dark?"#9b4b2d":"#c8753e";
   g.fillStyle=base;g.fillRect(xx,y,tile,tile);
   // Luz arriba/izquierda y sombra abajo/derecha: efecto de relieve pixelado.
   g.fillStyle=dark?"#b45d35":"#e18b4b";
   g.fillRect(xx,y,tile,3);g.fillRect(xx,y,3,tile);
   g.fillStyle=dark?"#713b2a":"#a75832";
   g.fillRect(xx,y+tile-3,tile,3);g.fillRect(xx+tile-3,y,3,tile);
   // Algunas marcas de roca, variadas y discretas dentro de cada cuadrado.
   if((Math.abs(col*7+row*11)%4)===0){
    g.fillStyle="rgba(245,169,95,.34)";g.fillRect(xx+7,y+9,8,2);g.fillRect(xx+10,y+11,5,2);
   }else if((Math.abs(col*5-row*3)%5)===0){
    g.fillStyle="rgba(72,35,27,.22)";g.fillRect(xx+8,y+18,11,2);g.fillRect(xx+17,y+20,5,2);
   }
  }
 }
 // Textura de roca suave por encima del patrón, sin tapar el diseño ajedrezado.
 const soilShade=g.createLinearGradient(0,top,0,h);
 soilShade.addColorStop(0,"rgba(255,190,103,.04)");
 soilShade.addColorStop(1,"rgba(45,27,25,.18)");
 g.fillStyle=soilShade;g.fillRect(0,top,w,h-top);
 g.restore();
 // Borde de césped brillante y pixelado, como una capa separada sobre la tierra.
 g.save();g.imageSmoothingEnabled=false;
 g.fillStyle="#165b32";g.fillRect(0,top,w,13);
 g.fillStyle="#249b43";g.fillRect(0,top,w,8);
 g.fillStyle="#59d34e";g.fillRect(0,top,w,4);
 g.fillStyle="#a5ef63";g.fillRect(0,top,w,2);
 for(let x=-((camera%24)+24)%24;x<w+24;x+=24){
  const n=Math.abs(Math.floor((x+camera)/24))%4;
  g.fillStyle=n===0?"#8be957":n===1?"#43c83f":n===2?"#d0f779":"#36ae3b";
  g.fillRect(x,top+3,15,4);g.fillRect(x+3,top+7,5,4);
  g.fillStyle="#176c36";g.fillRect(x+13,top+7,7,5);
  g.fillStyle="#b8f878";g.fillRect(x+4,top+2,4,2);
 }
 for(let x=-((camera%13)+13)%13;x<w+13;x+=13){
  const n=Math.abs(Math.floor((x+camera)/13))%3;
  g.fillStyle=n===0?"#238b3b":n===1?"#48c844":"#a4ed57";
  g.fillRect(x,top+10,3,5);if(n===1)g.fillRect(x+3,top+8,3,4);
 }
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
function drawDecorations(){
 for(let i=0;i<12;i++)drawPalm(260+i*990,i);
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