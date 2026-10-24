(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const ui = {
    score: document.getElementById("score"),
    rings: document.getElementById("rings"),
    lives: document.getElementById("lives"),
    timer: document.getElementById("timer"),
    overlay: document.getElementById("overlay"),
    title: document.getElementById("overlay-title"),
    copy: document.getElementById("overlay-copy"),
    start: document.getElementById("start-btn"),
    pause: document.getElementById("pause-btn")
  };
  const keys = Object.create(null);
  let mode = "title", last = 0, elapsed = 0, score = 0, rings = 0, lives = 3;
  let camera = 0, particles = [], invulnerable = 0, jumpQueued = false, zoneToast = 0, currentZone = -1, bossFlash = 0;
  const worldWidth = 5700;
  const floorY = 430;
  const player = {x:70,y:floorY-48,w:34,h:48,vx:0,vy:0,onGround:false,face:1,rolling:false};
  const platforms = [
    [0,430,680,120],[760,430,550,120],[1410,430,490,120],[1980,430,570,120],
    [2660,430,560,120],[3310,430,620,120],[4030,430,540,120],[4650,430,1050,120],
    [290,345,160,18],[520,300,130,18],[870,350,155,18],[1090,300,140,18],
    [1510,350,150,18],[1740,300,160,18],[2100,350,150,18],[2320,295,150,18],
    [2760,350,150,18],[2990,290,160,18],[3430,345,160,18],[3690,285,150,18],
    [4140,350,150,18],[4370,300,140,18],[4820,345,160,18],[5100,285,170,18]
  ];
  const gaps = [[680,760],[1310,1410],[1900,1980],[2550,2660],[3220,3310],[3930,4030],[4570,4650]];
  const springs = [600,1200,1820,2480,3140,3850,4500,5260].map(x=>({x,y:floorY-20,used:false}));
  const ringItems = [];
  function ringLine(x,y,count,dx=30,dy=0){for(let i=0;i<count;i++)ringItems.push({x:x+i*dx,y:y+(typeof dy==="function"?dy(i):dy),got:false});}
  ringLine(130,380,9,30); ringLine(320,300,5,28); ringLine(535,260,5,28);
  ringLine(825,380,8,30); ringLine(885,310,5,28); ringLine(1110,260,5,28);
  ringLine(1460,380,8,30); ringLine(1530,310,5,28); ringLine(1770,260,5,28);
  ringLine(2040,380,8,30); ringLine(2120,310,5,28); ringLine(2350,255,5,28);
  ringLine(2710,380,8,30); ringLine(2790,310,5,28); ringLine(3020,250,5,28);
  ringLine(3370,380,8,30); ringLine(3460,305,5,28); ringLine(3710,245,5,28);
  ringLine(4090,380,8,30); ringLine(4170,310,5,28); ringLine(4390,260,5,28);
  ringLine(4700,380,9,30); ringLine(4860,305,5,28); ringLine(5130,245,5,28);
  const enemies = [440,980,1190,1610,2200,2410,2840,3090,3540,3780,4240,4440,4920,5330].map((x,i)=>({x,y:floorY-30,w:32,h:30,vx:i%2?0.8:-0.8,alive:true,home:x,range:70}));
  const checkpoints = [1450,2700,4050];
  let checkpoint = 70;
  const finishX = 5580;
  const zones = [
    {start:0,end:1050,name:"SUNNY COAST",sky:["#62d9f7","#d6f8ff"],hill:"#65d5a0",top:"#47c957",soil:"#9b6035",accent:"#fff4a3"},
    {start:1050,end:2100,name:"EMBER RUINS",sky:["#f7a25b","#ffe4a0"],hill:"#d77b58",top:"#ee6b3d",soil:"#75424a",accent:"#fff0a0"},
    {start:2100,end:3150,name:"NEON HEIGHTS",sky:["#413f9c","#e99de9"],hill:"#7668bd",top:"#5de5bd",soil:"#493b79",accent:"#ffe46c"},
    {start:3150,end:4200,name:"MISTY LAGOON",sky:["#38a8bd","#b9f2e8"],hill:"#4eb7a5",top:"#48d4a0",soil:"#477b72",accent:"#d4fff4"},
    {start:4200,end:5100,name:"IRON FACTORY",sky:["#384b6c","#a8b4c7"],hill:"#68798d",top:"#f0a044",soil:"#4d5364",accent:"#ffe46c"},
    {start:5100,end:5700,name:"FINAL CORE",sky:["#321b56","#e85b78"],hill:"#6c315f",top:"#ef5265",soil:"#482b48",accent:"#ffdf65"}
  ];
  const boss = {x:5410,y:floorY-78,w:58,h:72,hp:6,vx:1.1,alive:true};

  function resetGame(){
    mode="playing"; elapsed=0; score=0; rings=0; lives=3; camera=0; particles=[]; invulnerable=0; checkpoint=70; zoneToast=2.5; currentZone=0; boss.x=5410; boss.hp=6; boss.alive=true; bossFlash=0;
    player.x=70;player.y=floorY-player.h;player.vx=0;player.vy=0;player.onGround=false;player.face=1;
    ringItems.forEach(r=>r.got=false);enemies.forEach(e=>{e.alive=true;e.x=e.home;e.vx=Math.abs(e.vx)*(e.home%2?1:-1);});
    springs.forEach(s=>s.used=false); updateHud(); ui.overlay.classList.add("hidden"); ui.pause.textContent="Pausar";
  }
  function updateHud(){
    ui.score.textContent=String(score).padStart(6,"0");
    ui.rings.textContent=String(rings).padStart(2,"0");
    ui.lives.textContent=String(lives);
    const secs=Math.floor(elapsed);ui.timer.textContent=String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
  }
  function showOverlay(title,copy,button="JUGAR DE NUEVO"){
    ui.title.textContent=title;ui.copy.textContent=copy;ui.start.textContent=button;ui.overlay.classList.remove("hidden");
  }
  function start(){if(mode==="title"||mode==="won"||mode==="lost")resetGame();else if(mode==="paused"){mode="playing";ui.overlay.classList.add("hidden");ui.pause.textContent="Pausar";}}
  ui.start.addEventListener("click",start);
  ui.pause.addEventListener("click",()=>{
    if(mode==="playing"){mode="paused";showOverlay("Pausa","Respira un momento. Tu aventura está esperando.","CONTINUAR");ui.pause.textContent="Seguir";}
    else if(mode==="paused")start();
  });
  window.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    if(["arrowleft","arrowright","arrowup"," ","arrowdown"].includes(k))e.preventDefault();
    if(!keys[k]&&(k===" "||k==="arrowup"||k==="w"))jumpQueued=true;
    keys[k]=true;
    if((mode==="title"||mode==="won"||mode==="lost")&&(k==="enter"||k===" "))start();
    if(k==="escape"&&mode==="playing"){mode="paused";showOverlay("Pausa","Tu partida está en pausa.","CONTINUAR");ui.pause.textContent="Seguir";}
  });
  window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
  const down=(...names)=>names.some(n=>keys[n]);
  function rects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function burst(x,y,color,count=8){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*4,vy:(Math.random()-.8)*-3,life:0.45+Math.random()*.4,color,size:2+Math.random()*4});}
  function hurt(){
    if(invulnerable>0)return;
    if(rings>0){const lost=Math.min(rings,Math.max(1,Math.floor(rings/2)));rings-=lost;burst(player.x+player.w/2,player.y+20,"#ffd84d",lost>8?12:lost);}
    else lives--;
    invulnerable=1.5;player.vy=-7;player.vx=-player.face*4;
    if(lives<=0){mode="lost";showOverlay("¡Fin de la partida!","No te rindas: vuelve a intentarlo y llega hasta la meta.");}
  }
  function update(dt){
    if(mode!=="playing")return;
    elapsed+=dt;invulnerable=Math.max(0,invulnerable-dt);zoneToast=Math.max(0,zoneToast-dt);bossFlash=Math.max(0,bossFlash-dt);
    const zoneIndex=zones.findIndex(z=>player.x>=z.start&&player.x<z.end);if(zoneIndex>=0&&zoneIndex!==currentZone){currentZone=zoneIndex;zoneToast=2.5;burst(player.x+20,player.y,"#fff2a6",8);}
    const left=down("arrowleft","a"),right=down("arrowright","d");
    if(left){player.vx-=22*dt;player.face=-1;} if(right){player.vx+=22*dt;player.face=1;}
    if(!left&&!right)player.vx*=Math.pow(player.onGround?0.80:0.985,dt*60);
    player.vx=Math.max(-7.8,Math.min(7.8,player.vx));
    if(jumpQueued&&player.onGround){player.vy=-10.9;player.onGround=false;burst(player.x+player.w/2,player.y+player.h,"#e9faff",4);}
    jumpQueued=false;
    if(!down(" ","arrowup","w")&&player.vy< -3)player.vy+=19*dt;
    player.vy=Math.min(13,player.vy+25*dt);
    const oldY=player.y;player.x+=player.vx;player.y+=player.vy*dt;player.onGround=false;
    player.x=Math.max(0,Math.min(worldWidth-player.w,player.x));
    // Land on platforms, but allow falling through gaps.
    for(const p of platforms){
      const [px,py,pw,ph]=p;
      if(player.x+player.w>px&&player.x<px+pw&&oldY+player.h<=py+5&&player.y+player.h>=py&&player.vy>=0){
        player.y=py-player.h;player.vy=0;player.onGround=true;
      }
    }
    // A fall costs a life and returns to the last checkpoint.
    if(player.y>H+100){lives--;rings=0;if(lives<=0){mode="lost";showOverlay("¡Ups!","Te quedaste sin vidas. Prueba otra vez.");}else{player.x=checkpoint;player.y=floorY-player.h;player.vx=0;player.vy=0;invulnerable=1.2;}}
    checkpoints.forEach(x=>{if(player.x>x&&checkpoint<x){checkpoint=x;burst(x,330,"#83f7b5",10);}});
    springs.forEach(s=>{if(!s.used&&Math.abs((player.x+player.w/2)-s.x)<28&&player.y+player.h>s.y&&player.y+player.h<s.y+30&&player.vy>=0){player.vy=-15;player.vx=Math.max(player.vx,4.5);s.used=true;burst(s.x,s.y,"#ffe36b",8);}});
    for(const r of ringItems){if(!r.got&&Math.hypot(player.x+player.w/2-r.x,player.y+player.h/2-r.y)<27){r.got=true;rings++;score+=100;if(rings%10===0)score+=500;}}
    for(const e of enemies){if(!e.alive)continue;e.x+=e.vx*60*dt;if(Math.abs(e.x-e.home)>e.range)e.vx*=-1;
      if(rects(player,{x:e.x,y:e.y,w:e.w,h:e.h})){
        if(player.vy>1&&oldY+player.h<=e.y+12){e.alive=false;player.vy=-7;score+=250;burst(e.x+e.w/2,e.y+10,"#ffbd50",10);}
        else hurt();
      }
    }
    if(player.x>5100&&boss.alive){boss.x+=boss.vx*60*dt;if(boss.x<5310||boss.x>5480)boss.vx*=-1;if(rects(player,{x:boss.x,y:boss.y,w:boss.w,h:boss.h})){if(player.vy>1&&oldY+player.h<=boss.y+20){boss.hp--;bossFlash=.24;player.vy=-8;player.vx=-player.face*3;score+=500;burst(boss.x+boss.w/2,boss.y+12,"#ffe56a",12);if(boss.hp<=0){boss.alive=false;score+=3000;burst(boss.x+boss.w/2,boss.y+25,"#ff8555",25);}}else hurt();}}
    if(player.x>finishX&&!boss.alive){score+=rings*25;mode="won";showOverlay("¡Aventura completada!","¡Derrotaste al guardián y salvaste las zonas! Anillos: "+rings+" · Puntuación: "+score,"JUGAR OTRA VEZ");}
    camera=Math.max(0,Math.min(worldWidth-W,player.x-W*.32));
    updateHud();
    particles=particles.filter(p=>p.life<1);
    particles.forEach(p=>{p.life+=dt;p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;p.vy+=12*dt;});
  }

  function rounded(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawBackground(){
    const z=zones.find(item=>camera+W*.35>=item.start&&camera+W*.35<item.end)||zones[zones.length-1];const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,z.sky[0]);sky.addColorStop(1,z.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Sun
    ctx.fillStyle=z.accent;ctx.beginPath();ctx.arc(790-camera*.04,88,39,0,Math.PI*2);ctx.fill();
    // Distant hills
    for(let i=0;i<8;i++){const x=((i*210-camera*.16)%(W+260))-130;ctx.fillStyle=i%2?"#8ce1b2":z.hill;ctx.beginPath();ctx.ellipse(x,400,160,105,0,Math.PI,Math.PI*2);ctx.fill();}
    // Puffy clouds
    for(let i=0;i<7;i++){const x=((i*235-camera*.28)%(W+190))-80,y=65+(i%3)*58;ctx.fillStyle="#ffffffd9";ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.arc(x+23,y-12,27,0,Math.PI*2);ctx.arc(x+49,y,21,0,Math.PI*2);ctx.fill();}
    // Distant checkerboard cliffs
    for(let i=0;i<7;i++){const x=((i*190-camera*.38)%(W+200))-80;ctx.fillStyle="#d4a16b";ctx.fillRect(x,390,110,80);ctx.fillStyle="#a4d87b";ctx.fillRect(x,390,110,12);for(let yy=402;yy<470;yy+=20)for(let xx=x;xx<x+110;xx+=22){ctx.fillStyle=((xx/22+yy/20)%2>0)?"#bf8857":"#dba978";ctx.fillRect(xx,yy,22,20);}}
  }
  function drawGround(){
    for(const [x,y,w,h] of platforms){const sx=x-camera;if(sx+w< -10||sx>W+10)continue;
      const zone=zones.find(z=>x>=z.start&&x<z.end)||zones[zones.length-1];ctx.fillStyle=zone.soil;ctx.fillRect(sx,y,w,h);
      ctx.fillStyle=zone.top;ctx.fillRect(sx,y,w,12);
      ctx.fillStyle=zone.accent;ctx.globalAlpha=.35;ctx.fillRect(sx,y+12,w,5);ctx.globalAlpha=1;
      for(let xx=sx;xx<sx+w;xx+=28){ctx.fillStyle=((Math.floor((xx+camera)/28)+Math.floor(y/20))%2)?"#c1814b":"#ad6c3d";ctx.fillRect(xx,y+22,14,14);ctx.fillStyle="#77442f";ctx.fillRect(xx+14,y+36,14,14);}
    }
    gaps.forEach(([x])=>{const sx=x-camera;ctx.fillStyle="#123f55";ctx.fillRect(sx,floorY,80,H-floorY);});
    // Decorative flowers
    for(let x=70;x<worldWidth;x+=190){const sx=x-camera;if(sx< -20||sx>W+20)continue;ctx.fillStyle="#238d49";ctx.fillRect(sx,floorY-22,3,10);ctx.fillStyle=x%3?"#ff75b5":"#fff17b";ctx.beginPath();ctx.arc(sx+2,floorY-25,5,0,Math.PI*2);ctx.fill();}
  }
  function drawRing(x,y,scale=1){
    ctx.lineWidth=4*scale;ctx.strokeStyle="#a86609";ctx.beginPath();ctx.ellipse(x,y,8*scale,11*scale,0,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth=3*scale;ctx.strokeStyle="#ffe35b";ctx.beginPath();ctx.ellipse(x,y,7*scale,10*scale,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle="#fff4b0";ctx.lineWidth=1.5*scale;ctx.beginPath();ctx.arc(x-2*scale,y-3*scale,4*scale,3.7,5.2);ctx.stroke();
  }
  function drawPlayer(){
    const x=player.x-camera,y=player.y;ctx.save();ctx.translate(x+player.w/2,y+player.h/2);if(player.face<0)ctx.scale(-1,1);
    if(invulnerable>0&&Math.floor(invulnerable*12)%2===0){ctx.restore();return;}
    // Original speedy blue mascot, drawn with canvas shapes (no external sprites).
    if(Math.abs(player.vx)>4){ctx.strokeStyle="#b5eeff";ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-19-i*4,-4+i*7);ctx.lineTo(-30-i*4,-4+i*7);ctx.stroke();}}
    ctx.fillStyle="#0872d9";ctx.beginPath();ctx.moveTo(-10,-11);ctx.lineTo(-28,-22);ctx.lineTo(-18,-5);ctx.lineTo(-30,2);ctx.lineTo(-15,5);ctx.lineTo(-18,18);ctx.lineTo(-3,12);ctx.lineTo(9,17);ctx.lineTo(15,5);ctx.lineTo(13,-11);ctx.closePath();ctx.fill();
    ctx.fillStyle="#159bff";ctx.beginPath();ctx.ellipse(0,0,15,19,-.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#ffdfb0";ctx.beginPath();ctx.ellipse(6,7,9,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(6,-8,6,10,-.2,0,Math.PI*2);ctx.ellipse(12,-7,5,8,-.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#172d55";ctx.beginPath();ctx.ellipse(9,-5,2.5,4,0,0,Math.PI*2);ctx.ellipse(14,-4,2,3.5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#17385e";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(6,10);ctx.quadraticCurveTo(12,14,17,8);ctx.stroke();
    // Gloves
    ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(-13,7,5,7,-.3,0,Math.PI*2);ctx.fill();
    // Red shoes
    ctx.fillStyle="#ed3d4e";ctx.beginPath();ctx.ellipse(-3,20,11,6,-.12,0,Math.PI*2);ctx.ellipse(13,20,10,6,.12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff";ctx.fillRect(-8,18,9,3);ctx.fillRect(9,18,8,3);
    ctx.restore();
  }
  function drawBoss(){if(!boss.alive||boss.x-camera< -100||boss.x-camera>W+100)return;const x=boss.x-camera,y=boss.y;ctx.save();ctx.fillStyle=bossFlash>0?"#fff2a6":"#b83d57";ctx.beginPath();ctx.ellipse(x+boss.w/2,y+31,29,33,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e9e7ef";ctx.beginPath();ctx.ellipse(x+boss.w/2,y+8,24,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e84d5b";ctx.fillRect(x+7,y+2,44,8);ctx.fillStyle="#fff";ctx.fillRect(x+14,y+7,10,11);ctx.fillRect(x+34,y+7,10,11);ctx.fillStyle="#172642";ctx.fillRect(x+18,y+10,4,6);ctx.fillRect(x+38,y+10,4,6);ctx.fillStyle="#31354b";ctx.fillRect(x+3,y+53,17,17);ctx.fillRect(x+38,y+53,17,17);ctx.fillStyle="#f7b744";ctx.fillRect(x+20,y+28,18,12);rounded(x-8,y-20,74,9,4,"#3a1735");rounded(x-6,y-18,70,5,2,"#ffffff");if(boss.hp>0)rounded(x-6,y-18,70*(boss.hp/6),5,2,"#ff526b");ctx.restore();}
  function drawEnemy(e){const x=e.x-camera,y=e.y;rounded(x,y+7,e.w,e.h-7,8,"#d84b48");rounded(x+3,y,e.w-6,17,7,"#ff765e");ctx.fillStyle="#fff";ctx.fillRect(x+7,y+7,6,8);ctx.fillRect(x+19,y+7,6,8);ctx.fillStyle="#182a48";ctx.fillRect(x+9,y+10,3,4);ctx.fillRect(x+21,y+10,3,4);ctx.fillStyle="#d4e4f0";ctx.fillRect(x+3,y+e.h-4,9,5);ctx.fillRect(x+20,y+e.h-4,9,5);}
  function drawSpring(s){const x=s.x-camera;if(x< -30||x>W+30)return;ctx.fillStyle="#d84442";ctx.fillRect(x-13,s.y+9,26,9);ctx.fillStyle="#f8e45c";ctx.fillRect(x-11,s.y+3,22,7);ctx.fillStyle="#e8f4ff";ctx.fillRect(x-13,s.y+17,26,3);}
  function draw(){
    drawBackground();drawGround();
    ringItems.forEach(r=>{if(!r.got){const x=r.x-camera;if(x>-15&&x<W+15)drawRing(x,r.y);}});
    springs.forEach(drawSpring);
    enemies.forEach(e=>{if(e.alive&&e.x-camera>-40&&e.x-camera<W+40)drawEnemy(e);});drawBoss();
    // Goal marker
    const fx=finishX-camera;if(fx>-40&&fx<W+40){ctx.fillStyle="#f5f9ff";ctx.fillRect(fx,280,5,150);ctx.fillStyle="#ff5b64";ctx.beginPath();ctx.moveTo(fx+5,284);ctx.lineTo(fx+70,302);ctx.lineTo(fx+5,322);ctx.closePath();ctx.fill();ctx.fillStyle="#ffd84d";ctx.beginPath();ctx.arc(fx+2,277,7,0,Math.PI*2);ctx.fill();}
    drawPlayer();const activeZone=zones.find(z=>player.x>=z.start&&player.x<z.end)||zones[zones.length-1];ctx.textAlign="left";ctx.fillStyle="#ffffff";ctx.font="900 14px Nunito, sans-serif";ctx.shadowColor="#102747";ctx.shadowBlur=5;ctx.fillText(activeZone.name,18,28);ctx.shadowBlur=0;if(zoneToast>0){ctx.globalAlpha=Math.min(1,zoneToast*2);rounded(W/2-190,70,380,58,14,"#082849dd");ctx.textAlign="center";ctx.fillStyle="#8ee4ff";ctx.font="900 10px Nunito, sans-serif";ctx.fillText("NUEVA ZONA",W/2,89);ctx.fillStyle="#fff";ctx.font="900 21px Nunito, sans-serif";ctx.fillText(activeZone.name,W/2,114);ctx.globalAlpha=1;}if(player.x>5100&&boss.alive){rounded(W-182,20,160,34,9,"#3b1c3bde");ctx.fillStyle="#fff";ctx.font="900 10px Nunito, sans-serif";ctx.textAlign="center";ctx.fillText("GUARDIÁN FINAL",W-102,33);ctx.fillStyle="#ffb4c4";ctx.font="900 12px Nunito, sans-serif";ctx.fillText("VIDA: "+boss.hp+"/6",W-102,47);}
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,1-p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,p.size,p.size);});ctx.globalAlpha=1;
    if(mode==="title"){ctx.fillStyle="#06315b";ctx.font="900 20px Nunito, sans-serif";ctx.fillText("¡LISTO PARA LA AVENTURA!",W/2-155,H-25);}
  }
  function loop(now){const dt=Math.min((now-last)/1000||0,0.033);last=now;update(dt);draw();requestAnimationFrame(loop);}
  updateHud();requestAnimationFrame(loop);
})();