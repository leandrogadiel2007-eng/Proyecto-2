(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status');
const W=canvas.width,H=canvas.height,GROUND=390,keys={left:false,right:false};
const worldWidth=12000;
const terrainSections=[];
for(let x=420,i=0;x<worldWidth-180;x+=470,i++){
 const top=([320,285,340,305,360,295,330,275][i%8]);
 terrainSections.push({a:x,b:x+360,top});
}
function terrainHeight(x){
 let y=390;
 for(const s of terrainSections){
  if(x>=s.a&&x<=s.b){
   const t=(x-s.a)/(s.b-s.a);
   y=390+(s.top-390)*(t<.5?2*t:2*(1-t));
   break;
  }
 }
 return y+Math.sin(x*.008)*3;
}
let running=false,lastTime=0,elapsed=0,camera=0,score=0,lives=3,player;
// Piezas colocadas a mano: cada sección tiene una función en el recorrido.
const platformSpecs=[
 [610,126],[1040,132],[1510,118],[1940,142],[2440,126],
 [2940,138],[3420,120],[3890,145],[4400,126],[4870,138],
 [5350,120],[5820,146],[6310,126],[6800,138],[7280,120],
 [7760,145],[8240,126],[8720,138],[9210,120],[9690,145],
 [10180,126],[10660,138],[11140,120]
];
const platforms=platformSpecs.map(([x,w],i)=>{
 let highest=Infinity;
 for(let sx=x;sx<=x+w;sx+=6) highest=Math.min(highest,terrainHeight(sx));
 const clearance=[92,108,96,116][i%4];
 return {x,w,y:Math.max(125,highest-clearance),section:i};
});
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
function resetPlayer(){player={x:90,y:terrainHeight(90)-43,w:34,h:43,vx:0,vy:0,speed:335,jump:625,onGround:true,facing:1,invincible:0,spin:0};camera=0;elapsed=0;score=0;lives=3;buildLevel()}
function startGame(){if(!running){running=true;startScreen.classList.add('hidden');status.textContent='¡CORRE Y RECOGE ANILLOS!';lastTime=performance.now()}}
function resetGame(){running=false;keys.left=keys.right=false;resetPlayer();startScreen.classList.remove('hidden');status.textContent='PULSA JUGAR PARA EMPEZAR';draw()}
function jump(){if(!running)startGame();if(player.onGround){player.vy=-player.jump;player.onGround=false;player.spin=1}}
function setKey(key,down){const k=key.toLowerCase();if(key==='ArrowLeft'||k==='a')keys.left=down;if(key==='ArrowRight'||k==='d')keys.right=down;if(down&&(key===' '||key==='ArrowUp'||k==='w'))jump();if(down&&key==='Enter'&&!running)startGame()}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();setKey(e.key,true)});
window.addEventListener('keyup',e=>setKey(e.key,false));window.addEventListener('blur',()=>{keys.left=keys.right=false});
startButton.addEventListener('click',startGame);resetButton.addEventListener('click',resetGame);
document.querySelectorAll('[data-control]').forEach(b=>{const c=b.dataset.control;const press=e=>{e.preventDefault();if(c==='jump')jump();else{if(!running)startGame();keys[c]=true}};const release=e=>{e.preventDefault();if(c!=='jump')keys[c]=false};b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('pointerleave',release)});
function update(dt){
 if(!running)return;elapsed+=dt;
 const dir=Number(keys.right)-Number(keys.left);
 if(dir){player.vx+=dir*1600*dt;player.facing=dir}else player.vx*=Math.pow(.0008,dt);
 player.vx=Math.max(-player.speed*.72,Math.min(player.speed,player.vx));
 const oldBottom=player.y+player.h,oldX=player.x,oldGround=terrainHeight(oldX+player.w/2);
 player.x=Math.max(0,Math.min(worldWidth-player.w,player.x+player.vx*dt));
 player.vy+=1550*dt;player.y+=player.vy*dt;player.onGround=false;
 const groundNow=terrainHeight(player.x+player.w/2),groundPrev=oldGround;const descending=player.vy>=0;if(descending&&player.y+player.h>=groundNow&&oldBottom<=groundPrev+Math.max(12,Math.abs(player.vx)*dt*.65)){player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0}else if(player.onGround&&Math.abs(groundNow-groundPrev)<Math.max(18,Math.abs(player.vx)*dt+8)){player.y=groundNow-player.h;player.vy=0;player.onGround=true;player.spin=0}
 for(const p of platforms){const bottom=player.y+player.h,overlap=player.x+player.w>p.x&&player.x<p.x+p.w;if(player.vy>=0&&overlap&&oldBottom<=p.y&&bottom>=p.y){player.y=p.y-player.h;player.vy=0;player.onGround=true;player.spin=0}}
 if(player.invincible>0)player.invincible-=dt;
 rings.forEach(r=>{if(!r.got&&Math.abs((player.x+player.w/2)-r.x)<24&&Math.abs((player.y+player.h/2)-r.y)<29){r.got=true;score+=10}});
 enemies.forEach(e=>{if(!e.alive)return;e.x=e.base+Math.sin(elapsed*1.6+e.base)*32;e.y=terrainHeight(e.x)-28;const hit=player.x+player.w>e.x-19&&player.x<e.x+19&&player.y+player.h>e.y-24&&player.y<e.y+20;if(hit){if(player.vy>100&&player.y+player.h<e.y+12){e.alive=false;player.vy=-370;score+=100}else if(player.invincible<=0){if(rings.some(r=>r.got)){let drop=0;rings.forEach(r=>{if(r.got&&drop<8){r.got=false;r.x=player.x+player.w+drop*12;r.y=player.y+Math.sin(drop)*-22;drop++}})}else{lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Te has quedado sin vidas. Pulsa jugar para volver a empezar.';resetPlayer()} }player.invincible=1.5;player.vy=-300;player.vx=-player.facing*180}}});
 if(player.y>H+100){player.x=Math.max(30,player.x-100);player.y=terrainHeight(player.x)-player.h;player.vy=0;lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');resetPlayer()}}
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
function drawCloud(x,y,s=1){
 g.save();g.translate(x,y);g.scale(s,s);
 g.fillStyle="rgba(33,102,171,.12)";
 g.beginPath();g.ellipse(4,14,44,9,0,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.beginPath();
 g.ellipse(-20,1,20,13,0,0,Math.PI*2);
 g.ellipse(0,-8,23,20,0,0,Math.PI*2);
 g.ellipse(23,1,21,13,0,0,Math.PI*2);
 g.ellipse(2,5,39,11,0,0,Math.PI*2);g.fill();
 g.fillStyle="#e4f8ff";g.beginPath();g.ellipse(-3,5,29,6,0,0,Math.PI*2);g.fill();
 g.restore();
}
function drawHillLayer(base,amp,speed,color,phase){
 g.beginPath();g.moveTo(0,scene.height);
 for(let x=-8;x<=scene.width+8;x+=4){
  const wx=x+camera*speed;
  const y=base+Math.sin(wx*.009+phase)*amp+Math.sin(wx*.021+phase*.7)*amp*.24;
  g.lineTo(x,y);
 }
 g.lineTo(scene.width,scene.height);g.closePath();g.fillStyle=color;g.fill();
}
function drawBackground(){
 const w=scene.width,h=scene.height;
 const sky=g.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,"#39a9ff");sky.addColorStop(.46,"#67d7ff");sky.addColorStop(1,"#d5f8ff");
 g.fillStyle=sky;g.fillRect(0,0,w,h);
 // Sol cálido con halo y rayos, como un nivel clásico de Sonic.
 const sx=790-camera*.035,sy=83;
 const glow=g.createRadialGradient(sx,sy,14,sx,sy,92);
 glow.addColorStop(0,"rgba(255,246,158,.72)");glow.addColorStop(1,"rgba(255,246,158,0)");
 g.fillStyle=glow;g.fillRect(sx-100,sy-100,200,200);
 g.save();g.translate(sx,sy);g.strokeStyle="rgba(255,239,126,.9)";g.lineWidth=4;
 for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(Math.cos(a)*42,Math.sin(a)*42);g.lineTo(Math.cos(a)*54,Math.sin(a)*54);g.stroke()}
 const sun=g.createLinearGradient(-35,-35,35,35);sun.addColorStop(0,"#fffbd0");sun.addColorStop(.55,"#ffe45b");sun.addColorStop(1,"#ffb52e");
 g.fillStyle=sun;g.beginPath();g.arc(0,0,34,0,Math.PI*2);g.fill();
 g.strokeStyle="#fff9c1";g.lineWidth=3;g.beginPath();g.arc(-4,-5,26,Math.PI*1.02,Math.PI*1.78);g.stroke();g.restore();
 // Nubes en capas con desplazamiento parallax.
 const period=w+180;
 for(let i=0;i<7;i++){
  let x=((i*191-camera*.12)%period+period)%period-90;
  drawCloud(x,42+(i%4)*30,.55+(i%3)*.15);
 }
 // Colinas lejanas: suaves, de tonos verde menta y turquesa.
 drawHillLayer(274,31,.09,"#a1edc0",.2);
 drawHillLayer(310,34,.16,"#57d991",1.1);
 drawHillLayer(342,26,.23,"#2abf71",2.2);
 // Cintas claras en las laderas para dar profundidad.
 g.globalAlpha=.27;g.strokeStyle="#e7ffd1";g.lineWidth=4;
 for(let row=0;row<3;row++){
  g.beginPath();
  for(let x=-10;x<=w+10;x+=8){
   const wx=x+camera*(.10+row*.05);
   const y=282+row*25+Math.sin(wx*.012+row)*16;
   if(x===-10)g.moveTo(x,y);else g.lineTo(x,y);
  }g.stroke();
 }
 g.globalAlpha=1;
}function traceTerrain(){
 g.beginPath();g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=scene.width;x+=4)g.lineTo(x,terrainHeight(camera+x));
}
function drawGround(){
 const w=scene.width,h=scene.height;
 // Traza la superficie real y úsala como máscara para el suelo cuadriculado.
 g.save();
 g.beginPath();g.moveTo(0,h);g.lineTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,h);g.closePath();g.clip();
 const dirt=g.createLinearGradient(0,275,0,h);
 dirt.addColorStop(0,"#df9141");dirt.addColorStop(.45,"#b96531");dirt.addColorStop(1,"#7d3c2c");
 g.fillStyle=dirt;g.fillRect(0,250,w,h-250);
 // Cuadros de tierra, con bordes cálidos y pequeñas luces.
 const tileW=38,tileH=28;
 const startX=-((camera%tileW)+tileW)%tileW;
 for(let x=startX;x<w+tileW;x+=tileW){
  const worldCol=Math.floor((x+camera)/tileW);
  for(let y=260,row=0;y<h+tileH;y+=tileH,row++){
   const alternate=(worldCol+row)%2===0;
   g.fillStyle=alternate?"rgba(249,171,73,.56)":"rgba(107,48,33,.24)";
   g.fillRect(x+1,y+1,tileW-2,tileH-2);
   g.strokeStyle="rgba(88,47,37,.32)";g.lineWidth=1;g.strokeRect(x+.5,y+.5,tileW-1,tileH-1);
   if(alternate){g.fillStyle="rgba(255,215,130,.36)";g.fillRect(x+3,y+3,9,2)}
  }
 }
 // Destellos minerales sobre la tierra.
 for(let i=0;i<36;i++){
  const wx=i*103+52,x=wx-camera;
  if(x<0||x>w)continue;
  const y=terrainHeight(wx)+27+(i%4)*31;
  if(y<h){g.fillStyle=i%3===0?"rgba(255,218,141,.72)":"rgba(91,46,39,.45)";g.beginPath();g.ellipse(x,y,2.3,1.3,0,0,Math.PI*2);g.fill()}
 }
 g.restore();
 // Tres bandas de césped: sombra, verde vivo y brillo superior.
 traceTerrain();g.strokeStyle="#08753b";g.lineWidth=21;g.lineJoin="round";g.lineCap="round";g.stroke();
 traceTerrain();g.strokeStyle="#22bd49";g.lineWidth=15;g.stroke();
 g.beginPath();g.moveTo(0,terrainHeight(camera)-6);
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x)-6);
 g.strokeStyle="#a5f35a";g.lineWidth=3;g.stroke();
}
function drawPalm(wx,variant=0){
 const x=wx-camera;
 if(x< -100||x>scene.width+100)return;
 const base=terrainHeight(wx)-5,lean=variant%2?10:-7,height=103+(variant%3)*12;
 const tx=x+lean,ty=base-height;
 // Sombra de la palmera.
 g.fillStyle="rgba(15,95,49,.20)";g.beginPath();g.ellipse(x,base-2,35,5,0,0,Math.PI*2);g.fill();
 // Tronco con curvas y luz lateral.
 g.beginPath();g.moveTo(x,base);g.bezierCurveTo(x+lean*.4,base-28,x-lean,ty+38,tx,ty);
 g.strokeStyle="#8b4b27";g.lineWidth=13;g.lineCap="round";g.stroke();
 g.beginPath();g.moveTo(x-2,base-9);g.bezierCurveTo(x+lean*.2,base-38,x-lean*.25,ty+29,tx-1,ty+2);
 g.strokeStyle="#d98a43";g.lineWidth=3;g.stroke();
 for(let band=20;band<height-8;band+=23){
  const yy=base-band,xx=x+lean*(band/height);
  g.strokeStyle="rgba(84,46,31,.45)";g.lineWidth=1.5;
  g.beginPath();g.moveTo(xx-5,yy);g.lineTo(xx+5,yy-3);g.stroke();
 }
 // Hojas ovaladas, cada una orientada hacia fuera desde la corona.
 g.save();g.translate(tx,ty);
 const leafAngles=[-2.8,-2.35,-1.95,-1.55,-1.15,-.75,-.35];
 const greens=["#168b42","#24b84d","#39d65a","#76e85b"];
 leafAngles.forEach((a,i)=>{
  g.save();g.rotate(a);g.beginPath();g.moveTo(0,0);
  g.quadraticCurveTo(17,-25,47,-9);
  g.quadraticCurveTo(28,7,0,0);
  g.fillStyle=greens[(i+variant)%greens.length];g.fill();
  g.strokeStyle="#087438";g.lineWidth=1.4;g.stroke();
  g.beginPath();g.moveTo(2,0);g.quadraticCurveTo(23,-7,43,-9);
  g.strokeStyle="rgba(204,255,136,.72)";g.lineWidth=1.5;g.stroke();
  g.restore();
 });
 g.fillStyle="#65df54";g.beginPath();g.arc(0,0,7,0,Math.PI*2);g.fill();
 g.restore();
}
function drawDecorations(){
 // Palmas, arbustos y flores anclados a la superficie del recorrido.
 for(let i=0;i<15;i++)drawPalm(250+i*865,i);
 for(let i=0;i<44;i++){
  const wx=115+i*265,x=wx-camera;
  if(x< -55||x>scene.width+55)continue;
  const y=terrainHeight(wx)-7,r=8+(i%3)*2;
  g.fillStyle="rgba(13,103,48,.22)";g.beginPath();g.ellipse(x,y+5,r*1.8,4,0,0,Math.PI*2);g.fill();
  const greens=["#138c41","#1da947","#39c94f"];
  [[-r*.65,0,r*.72],[0,-r*.48,r],[r*.68,0,r*.72]].forEach(([dx,dy,rr],j)=>{
   g.fillStyle=greens[(i+j)%greens.length];g.beginPath();g.arc(x+dx,y+dy,rr,0,Math.PI*2);g.fill();
  });
 }
 for(let i=0;i<74;i++){
  const wx=65+i*157,x=wx-camera;
  if(x< -10||x>scene.width+10)continue;
  const y=terrainHeight(wx)-10-(i%3)*2;
  g.strokeStyle="#208743";g.lineWidth=2;g.beginPath();g.moveTo(x,y+11);g.lineTo(x,y);g.stroke();
  const petal=i%2===0?"#fff7dc":"#ffd6ee";
  for(let p=0;p<5;p++){const a=p*Math.PI*2/5;g.fillStyle=petal;g.beginPath();g.ellipse(x+Math.cos(a)*4,y+Math.sin(a)*4,3,2, a,0,Math.PI*2);g.fill()}
  g.fillStyle="#ffcf36";g.beginPath();g.arc(x,y,2.4,0,Math.PI*2);g.fill();
 }
}function drawPlatform(p){
 const x=p.x-camera,y=p.y,w=p.w,h=31;
 // Plataformas de césped sobre bloques clásicos de tierra.
 g.save();
 g.fillStyle="rgba(8,61,42,.2)";g.beginPath();g.ellipse(x+w/2,y+h+4,w*.53,6,0,0,Math.PI*2);g.fill();
 const soil=g.createLinearGradient(0,y+7,0,y+h);
 soil.addColorStop(0,"#c77835");soil.addColorStop(1,"#873e2a");
 g.fillStyle=soil;g.fillRect(x,y+7,w,h-7);
 for(let xx=x;xx<x+w;xx+=23){
  const col=Math.floor((xx+p.x)/23);
  for(let yy=y+8;yy<y+h;yy+=12){
   g.fillStyle=(col+Math.floor(yy/12))%2===0?"rgba(255,185,89,.52)":"rgba(85,40,29,.25)";
   g.fillRect(xx+1,yy+1,21,10);
  }
 }
 g.strokeStyle="#703722";g.lineWidth=2;g.strokeRect(x+1,y+8,w-2,h-9);
 const grass=g.createLinearGradient(0,y,0,y+10);grass.addColorStop(0,"#baf45d");grass.addColorStop(.42,"#46d64b");grass.addColorStop(1,"#149440");
 g.fillStyle=grass;g.beginPath();g.moveTo(x+3,y);g.lineTo(x+w-3,y);g.quadraticCurveTo(x+w,y,x+w,y+5);g.lineTo(x+w,y+10);g.lineTo(x,y+10);g.lineTo(x,y+4);g.quadraticCurveTo(x,y,x+3,y);g.closePath();g.fill();
 g.strokeStyle="#e6ff8b";g.lineWidth=2;g.beginPath();g.moveTo(x+4,y+2);g.lineTo(x+w-8,y+2);g.stroke();
 for(let xx=x+12;xx<x+w;xx+=28){g.strokeStyle="rgba(10,112,49,.7)";g.lineWidth=1.4;g.beginPath();g.moveTo(xx,y+10);g.lineTo(xx-2,y+15);g.stroke()}
 g.restore();
}function drawRing(r){
 if(r.got)return;
 const x=r.x-camera,y=r.y+Math.sin(elapsed*5+r.x)*2.2;
 const wobble=.28+.72*Math.abs(Math.sin(elapsed*3.4+r.x*.017));
 g.save();g.translate(x,y);g.scale(wobble,1);
 const gold=g.createLinearGradient(-10,-13,10,13);
 gold.addColorStop(0,"#fff7a0");gold.addColorStop(.28,"#ffe95a");gold.addColorStop(.6,"#ffb81d");gold.addColorStop(1,"#dc7910");
 g.strokeStyle="#a85b0c";g.lineWidth=7;g.beginPath();g.ellipse(0,0,9,12,0,0,Math.PI*2);g.stroke();
 g.strokeStyle=gold;g.lineWidth=5;g.beginPath();g.ellipse(0,0,9,12,0,0,Math.PI*2);g.stroke();
 g.strokeStyle="rgba(255,255,221,.96)";g.lineWidth=2.3;g.beginPath();g.ellipse(-1.2,-1.5,5.6,8,0,Math.PI*1.1,Math.PI*1.83);g.stroke();
 g.restore();
}function drawEnemy(e){
 if(!e.alive)return;
 const x=e.x-camera,y=e.y+Math.sin(elapsed*4+e.base)*1.3;
 g.save();g.translate(x,y);
 // Sombra y patas metálicas.
 g.fillStyle="rgba(16,49,72,.22)";g.beginPath();g.ellipse(0,22,24,5,0,0,Math.PI*2);g.fill();
 g.strokeStyle="#263d59";g.lineWidth=5;g.lineCap="round";
 g.beginPath();g.moveTo(-11,9);g.lineTo(-17,18);g.moveTo(11,9);g.lineTo(17,18);g.stroke();
 g.fillStyle="#f3bd35";g.beginPath();g.ellipse(-17,18,6,3,0,0,Math.PI*2);g.ellipse(17,18,6,3,0,0,Math.PI*2);g.fill();
 // Cuerpo tipo badnik con caparazón rojo, visor azul y remaches.
 const shell=g.createLinearGradient(0,-17,0,12);shell.addColorStop(0,"#ff7962");shell.addColorStop(.52,"#ed3a37");shell.addColorStop(1,"#a91e35");
 g.fillStyle="#28415d";g.beginPath();g.ellipse(0,5,21,13,0,0,Math.PI*2);g.fill();
 g.fillStyle=shell;g.beginPath();g.moveTo(-19,3);g.quadraticCurveTo(-18,-16,0,-17);g.quadraticCurveTo(18,-16,19,3);g.quadraticCurveTo(0,13,-19,3);g.closePath();g.fill();
 g.strokeStyle="#8d2334";g.lineWidth=2;g.stroke();
 g.fillStyle="#ffc2a8";g.beginPath();g.ellipse(-7,-5,5.8,7,0,0,Math.PI*2);g.ellipse(7,-5,5.8,7,0,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.beginPath();g.ellipse(-7,-5,3.7,5.2,0,0,Math.PI*2);g.ellipse(7,-5,3.7,5.2,0,0,Math.PI*2);g.fill();
 g.fillStyle="#162b47";g.beginPath();g.ellipse(-6,-4,1.8,3.3,0,0,Math.PI*2);g.ellipse(8,-4,1.8,3.3,0,0,Math.PI*2);g.fill();
 g.strokeStyle="#ffd65c";g.lineWidth=2;g.beginPath();g.moveTo(0,-16);g.quadraticCurveTo(7,-23,12,-19);g.stroke();
 g.fillStyle="#ffe66d";g.beginPath();g.arc(13,-19,3,0,Math.PI*2);g.fill();
 g.fillStyle="#7adfff";g.beginPath();g.arc(-14,4,2.1,0,Math.PI*2);g.arc(14,4,2.1,0,Math.PI*2);g.fill();
 g.restore();
}/* Carga directamente los SVG que sí están en assets/sonic.
   No dependemos de project.json, porque ese archivo no está en la raíz del repositorio. */
let sonicAnimations={idle:[],run:[],jump:[],ready:false};
const sonicSpriteFiles={
 idle:[
  "01740b16763e9570f66ce0faf001c035.svg",
  "0f0fe78857ea041f15fde4fec23023ae.svg",
  "172146abbfa4348e9f0a63ada310f3fc.svg"
 ],
 run:[
  "2e35050243bb1a9740af66232b4157ab.svg",
  "51c9d39f0188245f4f41970dda3315ea.svg",
  "709f200d37b7a243470df5094b771a3c.svg",
  "72eb3473aee982a542f91c77b660622a.svg",
  "75baeb8e4efd54402e93d790f23c3ca7.svg"
 ],
 jump:["66a1cf3c5c762ce8c8330ea6faa81549.svg"]
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
  jump:result.jump||[],
  ready:Boolean((result.idle||[]).length&&(result.run||[]).length&&(result.jump||[]).length)
 };
 console.info("Blue Rush: sprites reales de Sonic",{
  idle:sonicAnimations.idle.length,run:sonicAnimations.run.length,jump:sonicAnimations.jump.length
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
 g.save();g.translate(x,y);g.scale(player.facing,1);
 if(player.spin&&Math.abs(player.vx)>90)g.rotate(elapsed*10);
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
 const moving=player.onGround&&Math.abs(player.vx)>70;
 const frames=!player.onGround?sonicAnimations.jump:(moving?sonicAnimations.run:sonicAnimations.idle);
 const usable=frames&&frames.length?frames:(sonicAnimations.idle.length?sonicAnimations.idle:[]);
 if(!usable.length){drawFallbackPlayer();return}
 const fps=!player.onGround?8:(moving?13:2.5);
 const entry=usable[Math.floor(elapsed*fps)%usable.length];
 const img=entry&&entry.img;
 if(!img||!img.naturalWidth||!img.naturalHeight){drawFallbackPlayer();return}
 const b=entry.bounds||{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight};
 // Recorta transparencias de los SVG para mantener a Sonic centrado y con una escala legible.
 const scale=Math.min(56/Math.max(1,b.width),54/Math.max(1,b.height));
 const dw=b.width*scale,dh=b.height*scale;
 g.save();g.translate(Math.round(x),Math.round(y));
 if(player.facing<0)g.scale(-1,1);
 if(player.spin&&Math.abs(player.vx)>90)g.rotate(elapsed*10);
 g.imageSmoothingEnabled=true;
 g.drawImage(img,b.x,b.y,b.width,b.height,-dw/2,player.h/2-dh-1,dw,dh);
 g.restore();
}function drawHud(){
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
function draw(){
 drawBackground();drawGround();drawDecorations();
 platforms.forEach(drawPlatform);rings.forEach(drawRing);enemies.forEach(drawEnemy);drawPlayer();
 ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,W,H);ctx.drawImage(scene,0,0,W,H);drawHud();
}
function loop(now){const dt=Math.min((now-(lastTime||now))/1000,.032);lastTime=now;update(dt);draw();requestAnimationFrame(loop)}
resetPlayer();draw();requestAnimationFrame(loop);
})();