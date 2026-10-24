(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const startScreen=document.getElementById('startScreen'),startButton=document.getElementById('startButton'),resetButton=document.getElementById('resetButton'),status=document.getElementById('status');
const W=canvas.width,H=canvas.height,GROUND=390,keys={left:false,right:false};
const worldWidth=4300;
function terrainHeight(x){const waves=[{a:620,b:900,top:315},{a:900,b:1120,top:390},{a:1350,b:1600,top:330},{a:1600,b:1810,top:390},{a:2250,b:2530,top:310},{a:2530,b:2780,top:390},{a:3000,b:3290,top:325},{a:3290,b:3510,top:390},{a:3650,b:3920,top:305},{a:3920,b:4150,top:390}];let y=390;for(const s of waves){if(x>=s.a&&x<=s.b){const t=(x-s.a)/(s.b-s.a);y=390+(s.top-390)*(t<.5?2*t:2*(1-t));break}}return y+Math.sin(x*.008)*3;}
let running=false,lastTime=0,elapsed=0,camera=0,score=0,lives=3,player;
const platforms=[{x:560,y:315,w:145},{x:970,y:275,w:145},{x:1480,y:320,w:155},{x:2100,y:285,w:160},{x:2710,y:315,w:150},{x:3350,y:270,w:170},{x:3780,y:320,w:170}];
let rings=[],enemies=[],collected=new Set();
function buildLevel(){
 rings=[];collected=new Set();
 const rows=[[230,6,0],[400,5,0],[590,5,1],[810,6,0],[1000,5,1],[1220,7,0],[1490,6,1],[1740,6,0],[2000,6,1],[2240,7,0],[2500,6,1],[2740,6,0],[2990,7,0],[3270,6,1],[3530,7,0],[3810,6,1],[4070,5,0]];
 rows.forEach(([x,count,high],row)=>{for(let i=0;i<count;i++)rings.push({id:row+'-'+i,x:x+i*29,y:(high?terrainHeight(x)-100:terrainHeight(x)-48)-Math.sin(i/(count-1)*Math.PI)*18,got:false})});
 enemies=[900,1640,2460,3160,3950].map(x=>({x,y:terrainHeight(x)-28,alive:true,base:x}));
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
function drawBackground(){const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#07142f');sky.addColorStop(.52,'#123f70');sky.addColorStop(1,'#48c9e8');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);const sx=770-camera*.035,sy=115;const glow=ctx.createRadialGradient(sx,sy,8,sx,sy,100);glow.addColorStop(0,'#d7ffffcc');glow.addColorStop(.25,'#57e8ff88');glow.addColorStop(1,'#57e8ff00');ctx.fillStyle=glow;ctx.fillRect(sx-105,sy-105,210,210);circle(sx,sy,28,'#bafaff');for(let i=0;i<7;i++){const x=((i*177-camera*.09)%(W+150)+W+150)%(W+150)-70,y=58+(i%3)*43;ctx.fillStyle='#9feeff';ctx.globalAlpha=.55;ctx.fillRect(x,y,44,5);ctx.fillRect(x+9,y-7,26,7);ctx.globalAlpha=1}for(let layer=0;layer<3;layer++){ctx.beginPath();ctx.moveTo(0,GROUND);for(let x=-30;x<=W+40;x+=12){const wx=x+camera*(.12+layer*.09),y=265+layer*28+Math.sin(wx*.009+layer)*34+Math.sin(wx*.022)*12;ctx.lineTo(x,y)}ctx.lineTo(W,GROUND);ctx.closePath();ctx.fillStyle=['#0b5c72','#104b70','#12365c'][layer];ctx.fill();ctx.strokeStyle=['#26f0d0','#1cbedb','#1679bb'][layer];ctx.lineWidth=2;ctx.stroke()}for(let i=0;i<10;i++){const wx=i*490+145,x=wx-camera*.62;if(x< -100||x>W+100)continue;ctx.strokeStyle='#4deaff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,GROUND);ctx.lineTo(x,GROUND-105);ctx.stroke();for(let j=0;j<5;j++){ctx.save();ctx.translate(x,GROUND-105);ctx.rotate((j-2)*.55);ctx.fillStyle=j%2?'#12cfae':'#45ffce';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-10,-28);ctx.lineTo(0,-52);ctx.lineTo(10,-27);ctx.closePath();ctx.fill();ctx.strokeStyle='#b0fff4';ctx.lineWidth=1;ctx.stroke();ctx.restore()}}}
function drawGround(){
 // El terreno se dibuja por segmentos con desniveles y cuadros luminosos.
 const first=Math.floor(camera/8)*8;
 for(let sx=first-8;sx<W+8;sx+=8){const wx=sx+camera,gy=Math.max(0,Math.min(H-8,terrainHeight(wx)));rect(sx,gy,9,H-gy,'#07162f');rect(sx,gy,9,8,'#20eacb');rect(sx,gy+8,9,15,'#123c65');rect(sx+((Math.floor(wx/24)%2)*4),gy+23,5,14,'#16537a');rect(sx,gy+37,9,14,'#0a2544');rect(sx,gy+51,9,Math.max(0,H-gy-51),'#07162f');ctx.strokeStyle='#247cff';ctx.globalAlpha=.23;ctx.strokeRect(sx,gy+8,8,44);ctx.globalAlpha=1}
 const wx=1750-camera;if(wx> -330&&wx<W){rect(wx,GROUND-2,285,8,'#8afaff');rect(wx,GROUND+9,285,52,'#087ac0');for(let i=0;i<8;i++)rect(wx+((i*43+elapsed*40)%270),GROUND+16+(i%3)*13,22,2,'#b2ffff')}
 // Anillo de energía decorativo en el fondo
 const loopX=1880-camera;if(loopX>-100&&loopX<W+100){ctx.strokeStyle='#22dfff';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(loopX,terrainHeight(1880)-62,38,58,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#b7ffff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(loopX,terrainHeight(1880)-62,38,58,0,0,Math.PI*2);ctx.stroke()}
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