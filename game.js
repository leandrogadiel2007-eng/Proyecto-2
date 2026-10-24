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
const PIXEL=3;
const scene=document.createElement('canvas');
scene.width=Math.floor(W/PIXEL);scene.height=Math.floor(H/PIXEL);
const g=scene.getContext('2d');
g.imageSmoothingEnabled=false;
function pxRect(x,y,w,h,c){g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))}
function pxCircle(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(Math.round(x),Math.round(y),r,0,Math.PI*2);g.fill()}
function drawBackground(){
 const grad=g.createLinearGradient(0,0,0,scene.height);grad.addColorStop(0,'#5c94fc');grad.addColorStop(1,'#9bd8ff');g.fillStyle=grad;g.fillRect(0,0,scene.width,scene.height);
 // Nubes en bloques cuadrados
 for(let i=0;i<7;i++){const x=((i*77-camera*.12/PIXEL)%(scene.width+45)+scene.width+45)%(scene.width+45)-22,y=13+(i%3)*17;pxRect(x,y+4,24,5,'#fff');pxRect(x+5,y,13,5,'#fff');pxRect(x+10,y-2,8,4,'#fff')}
 // Montañas del fondo, con siluetas geométricas tipo 16-bit
 for(let layer=0;layer<3;layer++){
  const shift=camera*(.12+layer*.1)/PIXEL;
  const colors=['#70c94a','#38a84c','#167d54'];
  g.fillStyle=colors[layer];g.beginPath();g.moveTo(0,scene.height);
  for(let x=-12;x<=scene.width+12;x+=3){const wx=x+shift;const y=(82+layer*12+Math.sin(wx*.045+layer)*9+Math.sin(wx*.019)*6);g.lineTo(x,y)}
  g.lineTo(scene.width,scene.height);g.closePath();g.fill();
  // píxeles brillantes en las lomas
  for(let i=0;i<20;i++){const x=((i*53-shift*1.3)%(scene.width+20)+scene.width+20)%(scene.width+20)-10;const y=90+layer*12+Math.sin((x+shift)*.045+layer)*9;pxRect(x,y,3,2,layer===0?'#a2e65b':layer===1?'#5cc85a':'#2c9b5d')}
 }
 // Palmeras cuadradas como decoración de Green Hill
 for(let i=0;i<22;i++){const wx=i*520+180,x=wx/PIXEL-camera*.55/PIXEL;if(x< -18||x>scene.width+18)continue;const base=111+Math.sin(wx*.006)*8;pxRect(x-1,base-25,3,25,'#a85b2a');pxRect(x-2,base-28,5,4,'#78401f');pxRect(x-11,base-33,12,3,'#138346');pxRect(x-13,base-36,7,3,'#269e45');pxRect(x+1,base-35,12,3,'#138346');pxRect(x+6,base-39,8,3,'#269e45');pxRect(x-7,base-40,6,3,'#269e45');pxRect(x-3,base-43,7,4,'#3fc64f')}
}
function drawGround(){
 for(let sx=0;sx<scene.width;sx+=2){
  const wx=(sx*PIXEL)+camera,gy=Math.max(0,Math.min(scene.height-1,terrainHeight(wx)/PIXEL));
  const h=scene.height-gy;
  pxRect(sx,gy,3,2,'#36c840');pxRect(sx,gy+2,3,1,'#8de04b');
  pxRect(sx,gy+3,3,h,'#a95728');
  for(let ty=gy+4;ty<scene.height;ty+=6){const tile=(Math.floor(wx/24)+Math.floor(ty/6))%2===0;pxRect(sx,ty,3,3,tile?'#c97832':'#8f4926')}
 }
 // Flores pixeladas
 for(let i=0;i<30;i++){const wx=i*137+65,x=(wx-camera)/PIXEL;if(x< -4||x>scene.width+4)continue;const y=terrainHeight(wx)/PIXEL-3;pxRect(x,y,2,2,'#fff4a8');pxRect(x-1,y,1,1,'#ff79b9');pxRect(x+2,y,1,1,'#ff79b9')}
}
function drawPlatform(p){
 const x=(p.x-camera)/PIXEL,y=p.y/PIXEL,w=p.w/PIXEL;
 pxRect(x,y,w,3,'#36c840');pxRect(x,y+2,w,1,'#9bea50');pxRect(x,y+3,w,7,'#a95728');
 for(let xx=0;xx<w;xx+=8){pxRect(x+xx,y+3,4,3,'#c97832');pxRect(x+xx+4,y+6,4,4,'#8f4926')}
 pxRect(x,y+9,w,1,'#69391f');
}
function drawRing(r){if(r.got)return;const x=(r.x-camera)/PIXEL,y=r.y/PIXEL+Math.sin(elapsed*5+r.x)*.7;g.strokeStyle='#fff16b';g.lineWidth=2;g.beginPath();g.ellipse(Math.round(x),Math.round(y),3,4,0,0,Math.PI*2);g.stroke();g.strokeStyle='#ff9f16';g.lineWidth=1;g.strokeRect(Math.round(x)-1,Math.round(y)-3,2,6)}
function drawEnemy(e){if(!e.alive)return;const x=(e.x-camera)/PIXEL,y=e.y/PIXEL;pxRect(x-5,y-3,10,7,'#d52c38');pxRect(x-4,y-5,8,3,'#f34c45');pxRect(x-6,y-2,3,3,'#ff7862');pxRect(x+3,y-2,3,3,'#ff7862');pxRect(x-3,y-2,2,2,'#fff');pxRect(x+2,y-2,2,2,'#fff');pxRect(x-2,y-1,1,1,'#16254b');pxRect(x+3,y-1,1,1,'#16254b');pxRect(x-6,y+4,3,2,'#25314d');pxRect(x+3,y+4,3,2,'#25314d')}
function drawPlayer(){const x=(player.x-camera+player.w/2)/PIXEL,y=(player.y+player.h/2)/PIXEL;if(player.invincible>0&&Math.floor(elapsed*16)%2===0)return;g.save();g.translate(Math.round(x),Math.round(y));if(player.spin&&Math.abs(player.vx)>90)g.rotate(elapsed*10);g.scale(player.facing,1);
 // Mascota azul original dibujada en bloques, con silueta de erizo retro.
 pxRect(-5,-5,10,10,'#0750bd');pxRect(-4,-6,8,11,'#0879e8');pxRect(-7,-5,4,4,'#0879e8');pxRect(-9,-7,4,3,'#0750bd');pxRect(-7,-1,4,4,'#0750bd');pxRect(-8,3,5,3,'#0750bd');pxRect(-5,6,5,2,'#0750bd');
 pxRect(1,-4,4,5,'#fff');pxRect(3,-3,2,3,'#102348');pxRect(1,1,5,3,'#ffd0a1');pxRect(-5,5,5,2,'#e83248');pxRect(1,5,6,2,'#e83248');pxRect(-5,7,5,1,'#fff');pxRect(2,7,5,1,'#fff');g.restore()}
function drawHud(){ctx.fillStyle='#001a42';ctx.font='bold 17px monospace';ctx.fillText('SCORE '+String(score).padStart(5,'0'),18,27);ctx.fillText('TIME '+Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'),18,49);ctx.fillText('RINGS '+rings.filter(r=>r.got).length,18,71);ctx.fillText('♥ '.repeat(Math.max(0,lives)),W-100,28)}
function draw(){drawBackground();drawGround();platforms.forEach(drawPlatform);rings.forEach(drawRing);enemies.forEach(drawEnemy);drawPlayer();ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);ctx.drawImage(scene,0,0,W,H);drawHud()}
function loop(now){const dt=Math.min((now-(lastTime||now))/1000,.032);lastTime=now;update(dt);draw();requestAnimationFrame(loop)}
resetPlayer();draw();requestAnimationFrame(loop);
})();