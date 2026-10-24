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
const platforms=[];
for(let x=760,i=0;x<worldWidth-260;x+=850,i++){
 const w=[118,136,124,148][i%4];
 const ground=terrainHeight(x+w/2);
 platforms.push({x,y:Math.max(175,ground-[112,132,105,145][i%4]),w});
}
let rings=[],enemies=[],collected=new Set();
function buildLevel(){
 rings=[];collected=new Set();
 const rows=[];
 for(let x=180,row=0;x<worldWidth-150;x+=245,row++) rows.push([x,5+(row%3),row%2]);
 rows.forEach(([x,count,high],row)=>{
  for(let i=0;i<count;i++){
   const rx=x+i*29;
   rings.push({id:row+'-'+i,x:rx,y:(high?terrainHeight(rx)-100:terrainHeight(rx)-48)-Math.sin(i/(count-1)*Math.PI)*18,got:false});
  }
 });
 enemies=[];
 for(let x=820;x<worldWidth-100;x+=620) enemies.push({x,y:terrainHeight(x)-28,alive:true,base:x});
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
function drawBackground(){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#54c9ff');sky.addColorStop(.72,'#a4eaff');sky.addColorStop(1,'#e5faff');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // Sol cálido y nubes de estilo clásico
 circle(790,88,34,'#fff3a6');
 for(let i=0;i<6;i++){const x=((i*213-camera*.18)%(W+190)+W+190)%(W+190)-80,y=62+(i%3)*48;ctx.fillStyle='#fff';circle(x,y,17,'#fff');circle(x+18,y-9,22,'#fff');circle(x+40,y,16,'#fff');rect(x,y,40,14,'#fff')}
 // Colinas verdes en capas
 for(let layer=0;layer<3;layer++){
  ctx.beginPath();ctx.moveTo(0,H);
  for(let x=-30;x<=W+40;x+=8){const wx=x+camera*(.13+layer*.12);const y=225+layer*37+Math.sin(wx*.006+layer*1.7)*38+Math.sin(wx*.012)*13;ctx.lineTo(x,y)}
  ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=['#65c83f','#39a936','#21834a'][layer];ctx.fill();
  ctx.strokeStyle=['#a6ef61','#67d94d','#2da05b'][layer];ctx.lineWidth=3;ctx.stroke();
 }
 // Palmeras estilizadas
 for(let i=0;i<24;i++){const wx=i*520+180,x=wx-camera*.55;if(x< -80||x>W+80)continue;const base=330+Math.sin(wx*.006)*25;ctx.strokeStyle='#9b5b2b';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x,base);ctx.quadraticCurveTo(x+9,base-42,x,base-82);ctx.stroke();for(let j=0;j<5;j++){const a=(-2.7+j*1.05);ctx.strokeStyle=j%2?'#238b38':'#35b846';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,base-82);ctx.quadraticCurveTo(x+Math.cos(a)*22,base-112+Math.sin(a)*6,x+Math.cos(a)*40,base-90+Math.sin(a)*15);ctx.stroke()}}
}
function drawGround(){
 // Capa de tierra marrón con patrón de cuadros y césped brillante
 const first=-(camera%16)-16;
 for(let sx=first;sx<W+16;sx+=16){
  const wx=sx+camera,gy=Math.max(0,Math.min(H-8,terrainHeight(wx)));
  rect(sx,gy,17,8,'#49c82e');rect(sx,gy+5,17,5,'#8bea42');
  rect(sx,gy+10,17,H-gy-10,'#a95d2b');
  const tile=Math.floor(wx/32)%2===0;
  rect(sx,gy+15,16,18,tile?'#c77b35':'#874522');
  rect(sx+16,gy+33,16,18,tile?'#874522':'#c77b35');
  rect(sx,gy+51,17,Math.max(0,H-gy-51),'#a95d2b');
 }
 // Pequeñas flores junto al césped
 for(let i=0;i<30;i++){const wx=i*137+65,x=wx-camera;if(x< -15||x>W+15)continue;const y=terrainHeight(wx)-7;circle(x,y,4,'#fff5b2');circle(x-4,y,3,'#ff78b7');circle(x+4,y,3,'#ff78b7');circle(x,y,2,'#ffdb42')}
}
function drawPlatform(p){
 const x=p.x-camera;
 // Plataformas flotantes con césped y tierra; separadas del perfil de las colinas
 rect(x,p.y,p.w,9,'#46c82f');rect(x,p.y+5,p.w,5,'#a4ef4b');
 rect(x,p.y+10,p.w,22,'#a95d2b');
 for(let xx=0;xx<p.w;xx+=24){rect(x+xx,p.y+10,12,11,'#c77b35');rect(x+xx+12,p.y+21,12,11,'#874522')}
 rect(x,p.y+30,p.w,3,'#71391f');
}
function drawRing(r){if(r.got)return;const x=r.x-camera,y=r.y+Math.sin(elapsed*5+r.x)*2;ctx.strokeStyle='#fff06b';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(x,y,8,12,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffae13';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,5,9,0,0,Math.PI*2);ctx.stroke()}
function drawEnemy(e){if(!e.alive)return;const x=e.x-camera,y=e.y;circle(x,y,15,'#ed3942');circle(x-9,y-8,8,'#ff6655');circle(x+9,y-8,8,'#ff6655');rect(x-12,y-1,24,10,'#c92732');circle(x-5,y-3,3,'#fff');circle(x+5,y-3,3,'#fff');circle(x-5,y-2,1.5,'#111');circle(x+5,y-2,1.5,'#111');rect(x-18,y+10,9,5,'#222d49');rect(x+9,y+10,9,5,'#222d49')}
function drawPlayer(){const x=player.x-camera+player.w/2,y=player.y+player.h/2;if(player.invincible>0&&Math.floor(elapsed*16)%2===0)return;ctx.save();ctx.translate(x,y);ctx.rotate(player.spin&&Math.abs(player.vx)>90?elapsed*12:0);ctx.scale(player.facing,1);circle(0,0,18,'#0752d5');circle(-2,-2,15,'#168bff');ctx.fillStyle='#0560dd';ctx.beginPath();ctx.moveTo(-6,-8);ctx.lineTo(-27,-20);ctx.lineTo(-19,-3);ctx.lineTo(-29,5);ctx.lineTo(-13,8);ctx.lineTo(-15,20);ctx.lineTo(4,13);ctx.closePath();ctx.fill();circle(7,-7,8,'#fff');circle(10,-6,3,'#12284c');ctx.fillStyle='#ffd0a1';ctx.beginPath();ctx.ellipse(6,7,9,6,0,0,Math.PI*2);ctx.fill();rect(-13,13,14,7,'#e83248');rect(2,14,17,7,'#e83248');rect(-12,17,14,3,'#fff');rect(4,18,14,3,'#fff');ctx.restore()}
function drawHud(){ctx.fillStyle='#001a42';ctx.font='bold 17px monospace';ctx.fillText('SCORE '+String(score).padStart(5,'0'),18,27);ctx.fillText('TIME '+Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'),18,49);ctx.fillText('RINGS '+rings.filter(r=>r.got).length,18,71);ctx.fillText('♥ '.repeat(Math.max(0,lives)),W-100,28)}
function draw(){drawBackground();drawGround();platforms.forEach(drawPlatform);rings.forEach(drawRing);enemies.forEach(drawEnemy);drawPlayer();drawHud()}
function loop(now){const dt=Math.min((now-(lastTime||now))/1000,.032);lastTime=now;update(dt);draw();requestAnimationFrame(loop)}
resetPlayer();draw();requestAnimationFrame(loop);
})();