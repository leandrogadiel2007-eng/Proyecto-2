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
 const sky=g.createLinearGradient(0,0,0,h);
 sky.addColorStop(0,"#39aaff");sky.addColorStop(.48,"#74dcff");sky.addColorStop(1,"#dffaff");
 g.fillStyle=sky;g.fillRect(0,0,w,h);
 // Sun with a clean outline and warm glow; it matches the saturated blue of the Sonic SVGs.
 const sx=785-camera*.035,sy=82;
 const glow=g.createRadialGradient(sx,sy,10,sx,sy,110);
 glow.addColorStop(0,"rgba(255,239,117,.8)");glow.addColorStop(1,"rgba(255,239,117,0)");
 g.fillStyle=glow;g.fillRect(sx-112,sy-112,224,224);
 g.save();g.translate(sx,sy);
 g.strokeStyle="#fff3a3";g.lineWidth=4;
 for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(Math.cos(a)*43,Math.sin(a)*43);g.lineTo(Math.cos(a)*57,Math.sin(a)*57);g.stroke()}
 const sun=g.createLinearGradient(-28,-34,30,36);sun.addColorStop(0,"#fffbd2");sun.addColorStop(.48,"#ffe75b");sun.addColorStop(1,"#ffa928");
 g.fillStyle=sun;g.strokeStyle="#dd9226";g.lineWidth=2.5;g.beginPath();g.arc(0,0,34,0,Math.PI*2);g.fill();g.stroke();
 g.strokeStyle="#fffbd5";g.lineWidth=3;g.beginPath();g.arc(-4,-5,25,Math.PI*1.02,Math.PI*1.78);g.stroke();g.restore();
 const period=w+180;
 for(let i=0;i<7;i++){const x=((i*191-camera*.12)%period+period)%period-90;drawCloud(x,40+(i%4)*31,.56+(i%3)*.14)}
 // Rounded hills with outlines, layered like a colorful adventure-game illustration.
 drawHillLayer(271,30,.08,"#b2f2bd",.2,"#83d9a1");
 drawHillLayer(307,35,.15,"#5cda83",1.1,"#31bf6c");
 drawHillLayer(341,27,.22,"#25bd61",2.2,"#169749");
 // Pale curved streaks break up the green slopes and keep the scene lively.
 g.globalAlpha=.38;g.strokeStyle="#dcffd0";g.lineWidth=4;
 for(let row=0;row<3;row++){
  g.beginPath();
  for(let x=-10;x<=w+10;x+=8){const wx=x+camera*(.10+row*.05);const y=280+row*24+Math.sin(wx*.012+row)*15;if(x===-10)g.moveTo(x,y);else g.lineTo(x,y)}
  g.stroke();
 }
 g.globalAlpha=1;
}
function traceTerrain(){
 g.beginPath();
 g.moveTo(0,terrainHeight(camera));
 for(let x=4;x<=scene.width;x+=4)g.lineTo(x,terrainHeight(camera+x));
}
function drawGround(){
 const w=scene.width,h=scene.height;
 // Use the actual terrain silhouette as a mask so the grass follows every hill.
 g.save();g.beginPath();g.moveTo(0,h);g.lineTo(0,terrainHeight(camera));
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x));
 g.lineTo(w,h);g.closePath();g.clip();
 const dirt=g.createLinearGradient(0,280,0,h);
 dirt.addColorStop(0,"#df9142");dirt.addColorStop(.45,"#b96231");dirt.addColorStop(1,"#76392d");
 g.fillStyle=dirt;g.fillRect(0,250,w,h-250);
 // Large, readable checker blocks with warm highlights and dark seams.
 const tileW=44,tileH=28,startX=-((camera%tileW)+tileW)%tileW;
 for(let x=startX;x<w+tileW;x+=tileW){
  const worldCol=Math.floor((x+camera)/tileW);
  for(let y=258,row=0;y<h+tileH;y+=tileH,row++){
   const alternate=(worldCol+row)%2===0;
   g.fillStyle=alternate?"#e99a48":"#a95330";g.fillRect(x+1,y+1,tileW-2,tileH-2);
   g.strokeStyle="rgba(91,43,29,.38)";g.lineWidth=1.3;g.strokeRect(x+.5,y+.5,tileW-1,tileH-1);
   if(alternate){g.fillStyle="rgba(255,220,139,.45)";g.fillRect(x+4,y+4,13,2)}
   else {g.fillStyle="rgba(86,40,30,.23)";g.fillRect(x+5,y+6,16,2)}
  }
 }
 for(let i=0;i<34;i++){
  const wx=i*103+52,x=wx-camera;if(x<0||x>w)continue;
  const y=terrainHeight(wx)+27+(i%4)*31;
  if(y<h){g.fillStyle=i%3===0?"#ffd18c":"#87472f";g.beginPath();g.ellipse(x,y,2.8,1.8,0,0,Math.PI*2);g.fill()}
 }
 g.restore();
 // Bright grass cap, dark green under-outline and lime top highlight.
 traceTerrain();g.strokeStyle="#0b743b";g.lineWidth=22;g.lineJoin="round";g.lineCap="round";g.stroke();
 traceTerrain();g.strokeStyle="#19b946";g.lineWidth=16;g.stroke();
 g.beginPath();g.moveTo(0,terrainHeight(camera)-6);
 for(let x=4;x<=w;x+=4)g.lineTo(x,terrainHeight(camera+x)-6);
 g.strokeStyle="#b8f66a";g.lineWidth=3.5;g.stroke();
 // Tiny blades of grass along the top edge.
 for(let i=0;i<Math.ceil(w/28)+2;i++){
  const wx=camera+i*28+((i%2)*10),x=wx-camera,y=terrainHeight(wx)-8;
  g.strokeStyle=i%2?"#d7ff86":"#0c9745";g.lineWidth=1.5;g.beginPath();g.moveTo(x,y+5);g.lineTo(x-2,y);g.moveTo(x+2,y+5);g.lineTo(x+4,y+1);g.stroke();
 }
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
 const x=p.x-camera,y=p.y,w=p.w,h=34;
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
 grass.addColorStop(0,"#c1fa6e");grass.addColorStop(.36,"#42d85b");grass.addColorStop(1,"#09873d");
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
  ["SONIC",drawPlayer]
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