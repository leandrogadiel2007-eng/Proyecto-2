(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status');
const W=canvas.width,H=canvas.height,GROUND=390,keys={left:false,right:false};
const worldWidth=4300;
let running=false,lastTime=0,elapsed=0,camera=0,score=0,lives=3,player;
const platforms=[{x:560,y:315,w:145},{x:970,y:275,w:145},{x:1480,y:320,w:155},{x:2100,y:285,w:160},{x:2710,y:315,w:150},{x:3350,y:270,w:170},{x:3780,y:320,w:170}];
let rings=[],enemies=[],collected=new Set();
function buildLevel(){
 rings=[];collected=new Set();
 const rows=[[230,6,0],[400,5,0],[590,5,1],[810,6,0],[1000,5,1],[1220,7,0],[1490,6,1],[1740,6,0],[2000,6,1],[2240,7,0],[2500,6,1],[2740,6,0],[2990,7,0],[3270,6,1],[3530,7,0],[3810,6,1],[4070,5,0]];
 rows.forEach(([x,count,high],row)=>{for(let i=0;i<count;i++)rings.push({id:row+'-'+i,x:x+i*29,y:(high?GROUND-100:GROUND-48)-Math.sin(i/(count-1)*Math.PI)*18,got:false})});
 enemies=[{x:900,y:GROUND-28,alive:true,base:900},{x:1640,y:GROUND-28,alive:true,base:1640},{x:2460,y:GROUND-28,alive:true,base:2460},{x:3160,y:GROUND-28,alive:true,base:3160},{x:3950,y:GROUND-28,alive:true,base:3950}];
}
function resetPlayer(){player={x:90,y:GROUND-43,w:34,h:43,vx:0,vy:0,speed:335,jump:625,onGround:true,facing:1,invincible:0,spin:0};camera=0;elapsed=0;score=0;lives=3;buildLevel()}
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
 const oldBottom=player.y+player.h,oldX=player.x;
 player.x=Math.max(0,Math.min(worldWidth-player.w,player.x+player.vx*dt));
 player.vy+=1550*dt;player.y+=player.vy*dt;player.onGround=false;
 if(player.vy>=0&&oldBottom<=GROUND&&player.y+player.h>=GROUND){player.y=GROUND-player.h;player.vy=0;player.onGround=true;player.spin=0}
 for(const p of platforms){const bottom=player.y+player.h,overlap=player.x+player.w>p.x&&player.x<p.x+p.w;if(player.vy>=0&&overlap&&oldBottom<=p.y&&bottom>=p.y){player.y=p.y-player.h;player.vy=0;player.onGround=true;player.spin=0}}
 if(player.invincible>0)player.invincible-=dt;
 rings.forEach(r=>{if(!r.got&&Math.abs((player.x+player.w/2)-r.x)<24&&Math.abs((player.y+player.h/2)-r.y)<29){r.got=true;score+=10}});
 enemies.forEach(e=>{if(!e.alive)return;e.x=e.base+Math.sin(elapsed*1.6+e.base)*32;const hit=player.x+player.w>e.x-19&&player.x<e.x+19&&player.y+player.h>e.y-24&&player.y<e.y+20;if(hit){if(player.vy>100&&player.y+player.h<e.y+12){e.alive=false;player.vy=-370;score+=100}else if(player.invincible<=0){if(rings.some(r=>r.got)){let drop=0;rings.forEach(r=>{if(r.got&&drop<8){r.got=false;r.x=player.x+player.w+drop*12;r.y=player.y+Math.sin(drop)*-22;drop++}})}else{lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');startScreen.querySelector('h2').textContent='¡Inténtalo otra vez!';startScreen.querySelector('p:not(.start-kicker)').textContent='Te has quedado sin vidas. Pulsa jugar para volver a empezar.';resetPlayer()} }player.invincible=1.5;player.vy=-300;player.vx=-player.facing*180}}});
 if(player.y>H+100){player.x=Math.max(30,player.x-100);player.y=GROUND-player.h;player.vy=0;lives--;if(lives<=0){running=false;startScreen.classList.remove('hidden');resetPlayer()}}
 camera=Math.max(0,Math.min(worldWidth-W,player.x-W*.34));
 status.textContent='ANILLOS '+rings.filter(r=>r.got).length+' · PUNTOS '+score+' · VIDAS '+lives;
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function drawBackground(){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#168bfa');sky.addColorStop(.66,'#74e4ff');sky.addColorStop(1,'#c9f9ff');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 // Distant emerald hills and soft clouds
 for(let i=0;i<7;i++){const x=((i*190-camera*.18)%(W+250)+W+250)%(W+250)-100;ctx.fillStyle=i%2?'#48cfa0':'#26b987';ctx.beginPath();ctx.ellipse(x,275+(i%3)*20,150,115,0,Math.PI,Math.PI*2);ctx.fill()}
 for(let i=0;i<7;i++){const x=((i*177-camera*.09)%(W+150)+W+150)%(W+150)-70,y=58+(i%3)*43;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y,29,12,0,0,Math.PI*2);ctx.ellipse(x+22,y-7,22,17,0,0,Math.PI*2);ctx.ellipse(x+44,y,28,12,0,0,Math.PI*2);ctx.fill()}
 // Palm trees
 for(let i=0;i<10;i++){const wx=i*490+145,x=wx-camera*.62;if(x < -100||x>W+100)continue;rect(x-5,GROUND-105,10,105,'#a65a20');rect(x-2,GROUND-105,3,105,'#edaa36');for(let j=0;j<5;j++){ctx.save();ctx.translate(x,GROUND-105);ctx.rotate((j-2)*.55);ctx.fillStyle=j%2?'#078e46':'#17bf52';ctx.beginPath();ctx.ellipse(0,-32,11,39,0,0,Math.PI*2);ctx.fill();ctx.restore()}}
}
function drawGround(){
 const start=Math.floor(camera/32)*32-camera;
 for(let x=start-32;x<W+32;x+=32){const wx=x+camera;rect(x,GROUND,32,H-GROUND,'#a94a13');rect(x,GROUND+5,32,14,'#d46b20');rect(x+16,GROUND+19,16,14,'#e88b2e');rect(x,GROUND+33,16,14,'#d36a1e');rect(x+16,GROUND+47,16,14,'#e88b2e');rect(x,GROUND+61,32,14,'#b95717');rect(x,GROUND-1,32,11,'#13a83b');rect(x,GROUND-7,32,8,'#4de12e');for(let k=0;k<4;k++)rect(x+k*9,GROUND-10-(k%2)*3,4,8,'#8bfa38')}
 // Water pool at one stretch, kept decorative and behind the grass lip
 const wx=1750-camera;if(wx> -330&&wx<W){rect(wx,GROUND-2,285,8,'#47dfff');rect(wx,GROUND+9,285,52,'#168ce8');for(let i=0;i<8;i++)rect(wx+((i*43+elapsed*40)%270),GROUND+16+(i%3)*13,22,2,'#9df6ff')}
}
function drawPlatform(p){const x=p.x-camera;rect(x,p.y,p.w,12,'#20c73f');rect(x,p.y+12,p.w,28,'#b95319');for(let xx=0;xx<p.w;xx+=24){rect(x+xx,p.y+12,12,12,'#e77a25');rect(x+xx+12,p.y+24,12,12,'#e77a25')}rect(x,p.y,p.w,5,'#83ff4b')}
function drawRing(r){if(r.got)return;const x=r.x-camera,y=r.y+Math.sin(elapsed*5+r.x)*2;ctx.strokeStyle='#fff06b';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(x,y,8,12,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffae13';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,5,9,0,0,Math.PI*2);ctx.stroke()}
function drawEnemy(e){if(!e.alive)return;const x=e.x-camera,y=e.y;circle(x,y,15,'#ed3942');circle(x-9,y-8,8,'#ff6655');circle(x+9,y-8,8,'#ff6655');rect(x-12,y-1,24,10,'#c92732');circle(x-5,y-3,3,'#fff');circle(x+5,y-3,3,'#fff');circle(x-5,y-2,1.5,'#111');circle(x+5,y-2,1.5,'#111');rect(x-18,y+10,9,5,'#222d49');rect(x+9,y+10,9,5,'#222d49')}
function drawPlayer(){const x=player.x-camera+player.w/2,y=player.y+player.h/2;if(player.invincible>0&&Math.floor(elapsed*16)%2===0)return;ctx.save();ctx.translate(x,y);ctx.rotate(player.spin&&Math.abs(player.vx)>90?elapsed*12:0);ctx.scale(player.facing,1);circle(0,0,18,'#0752d5');circle(-2,-2,15,'#168bff');ctx.fillStyle='#0560dd';ctx.beginPath();ctx.moveTo(-6,-8);ctx.lineTo(-27,-20);ctx.lineTo(-19,-3);ctx.lineTo(-29,5);ctx.lineTo(-13,8);ctx.lineTo(-15,20);ctx.lineTo(4,13);ctx.closePath();ctx.fill();circle(7,-7,8,'#fff');circle(10,-6,3,'#12284c');ctx.fillStyle='#ffd0a1';ctx.beginPath();ctx.ellipse(6,7,9,6,0,0,Math.PI*2);ctx.fill();rect(-13,13,14,7,'#e83248');rect(2,14,17,7,'#e83248');rect(-12,17,14,3,'#fff');rect(4,18,14,3,'#fff');ctx.restore()}
function drawHud(){ctx.fillStyle='#001a42';ctx.font='bold 17px monospace';ctx.fillText('SCORE '+String(score).padStart(5,'0'),18,27);ctx.fillText('TIME '+Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'),18,49);ctx.fillText('RINGS '+rings.filter(r=>r.got).length,18,71);ctx.fillText('♥ '.repeat(Math.max(0,lives)),W-100,28)}
function draw(){drawBackground();drawGround();platforms.forEach(drawPlatform);rings.forEach(drawRing);enemies.forEach(drawEnemy);drawPlayer();drawHud()}
function loop(now){const dt=Math.min((now-(lastTime||now))/1000,.032);lastTime=now;update(dt);draw();requestAnimationFrame(loop)}
resetPlayer();draw();requestAnimationFrame(loop);
})();