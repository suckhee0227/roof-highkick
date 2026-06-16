// ============================================================
// main.js - 지붕 뚫고 하이킥! (번들)
// 4-1~4-3 기획서 기반 전면 재작성
// 동시 플레이 + 누적 계산 + 블록 회전
// ============================================================

import { toPng } from "html-to-image";
import * as THREE from "three";
import { gsap } from "gsap";
import confetti from "canvas-confetti";
import * as Tone from "tone";

// ======================== AppHelper ========================
class AppHelper {
  static async fetchRawData() { const r = await fetch("data.json"); return r.json(); }
  static async loadAppData() { return (await this.fetchRawData()).appData; }
  static async loadTextData() { return (await this.fetchRawData()).textData; }
  static async loadAssetList() { return (await this.fetchRawData()).assetList; }
  static sanitizeText(text) {
    let s = text.replace(/<(script|style|iframe|svg|math|form)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
    s = s.replace(/<\/?(script|style|iframe|svg|math|form)\b[^>]*\/?>/gi,"");
    s = s.replace(/<\/?(img|a|input|button|textarea|select|option|label|fieldset|legend|link|meta|base|video|audio|source|object|embed|span|div|table|tr|td|th|thead|tbody|tfoot|col|colgroup|caption|h[1-6]|nav|section|article|header|footer|main|aside|details|summary)\b[^>]*>/gi,"");
    s = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    s = s.replace(/&lt;(br)\s*\/?&gt;/gi,"<br>");
    s = s.replace(/&lt;(\/?(?:p|b|i|u|strong|em|small))&gt;/gi,"<$1>");
    s = s.replace(/\n/g,"<br>");
    return s;
  }
  static el(tag, id="", styles={}, text="", events=[]) {
    const e = document.createElement(tag);
    if (id) e.id = id;
    Object.assign(e.style, styles);
    if (styles.pointerEvents === "auto") e.style.touchAction = "none";
    if (text) e.innerHTML = this.sanitizeText(text);
    events.forEach(({event,handler}) => e.addEventListener(event, handler));
    return e;
  }
  static createUIElement(...args) { return this.el(...args); }
  static async captureCanvasAsDataUrl(includeUILayer=true) {
    const c=document.getElementById("appCanvas"),ct=document.getElementById("appContainer");
    if(!c||!ct)return null;
    try{if(includeUILayer){const s=ct.style.cssText;ct.style.transform="none";ct.style.position="relative";ct.style.left="0";ct.style.top="0";const d=await toPng(ct,{width:c.width,height:c.height});ct.style.cssText=s;return d&&d!=="data:,"?d:null;}const d=c.toDataURL("image/webp");return d&&d!=="data:,"?d:null;}catch{return null;}
  }
  static async captureCanvasAsImage(i=true){const d=await this.captureCanvasAsDataUrl(i);if(!d)return null;return new Promise(r=>{const img=new Image();img.onload=()=>r(img);img.onerror=()=>r(null);img.src=d;});}
}

// ======================== Styles ========================
const S = {
  font: "'Apple SD Gothic Neo','Malgun Gothic',sans-serif",
  bg: 0xF2F6FC, cellEmpty: 0xE8ECF1,
  t1: "#E53935", t2: "#1E88E5",
  dark: "#212121", sub: "#78909C",
  ok: "#43A047", err: "#E53935",
  radius: "12px", shadow: "0 2px 12px rgba(0,0,0,0.08)",
};

// ======================== RoofKickApp ========================
class RoofKickApp {
  constructor() {
    this.appCanvas = document.getElementById("appCanvas");
    this.uiLayer = document.getElementById("uiLayer");
    this.W = 1200; this.H = 800; this.CELL_W = 46; this.CELL_H = 52;
    this.phase = "start";
    this.round = 1;
    this.winnerTeam = 0;

    // team state
    this.t1 = { target:0, value:0, op:"+", locked:false };
    this.t2 = { target:0, value:0, op:"+", locked:false };
    this.h1 = 0; this.h2 = 0;
    this.g1 = []; this.g2 = [];
    this.m1 = []; this.m2 = [];

    // tetris
    this.pieces = []; this.pieceIdx = 0; this.placed = 0;
    this.gCol = 0; this.gRow = 0;
    this.synth = null;
  }

  async init() {
    this.app = await AppHelper.loadAppData();
    this.txt = await AppHelper.loadTextData();
    this.setupCanvas(); this.setup3D(); this.setupAudio();
    this.resetGrids(); this.buildScene();
    this.showStart(); this.loop();
  }

  setupCanvas() { this.appCanvas.width = this.W; this.appCanvas.height = this.H; }
  setup3D() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(S.bg);
    const hw=this.W/2, hh=this.H/2;
    this.cam = new THREE.OrthographicCamera(-hw,hw,hh,-hh,0.1,1000);
    this.cam.position.set(0,0,100); this.cam.lookAt(0,0,0);
    this.ren = new THREE.WebGLRenderer({canvas:this.appCanvas,antialias:true});
    this.ren.setSize(this.W,this.H);
    this.scene.add(new THREE.AmbientLight(0xffffff,1));
  }
  setupAudio() {
    try{this.synth=new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.01,decay:0.15,sustain:0,release:0.1}}).toDestination();}catch{}
  }
  snd(n,d){try{Tone.start();this.synth.triggerAttackRelease(n,d);}catch{}}
  sndPop(){this.snd("C5","8n");}
  sndPlace(){this.snd("E4","16n");}
  sndWin(){try{Tone.start();const n=Tone.now();this.synth.triggerAttackRelease("C5","8n",n);this.synth.triggerAttackRelease("E5","8n",n+.15);this.synth.triggerAttackRelease("G5","8n",n+.3);this.synth.triggerAttackRelease("C6","4n",n+.45);}catch{}}
  sndClick(){this.snd("A4","32n");}
  sndCorrect(){try{Tone.start();const n=Tone.now();this.synth.triggerAttackRelease("C5","16n",n);this.synth.triggerAttackRelease("E5","16n",n+.1);this.synth.triggerAttackRelease("G5","8n",n+.2);}catch{}}

  // ===================== GRID =====================
  resetGrids() {
    const{gridCols:C,gridRows:R}=this.app;
    this.g1=[];this.g2=[];
    for(let r=0;r<R;r++){this.g1.push(Array(C).fill(null));this.g2.push(Array(C).fill(null));}
  }

  // ===================== 3D SCENE =====================
  buildScene() {
    const{gridCols:C,gridRows:R}=this.app,cw=this.CELL_W,ch=this.CELL_H;
    this.bg1=new THREE.Group();this.bg2=new THREE.Group();
    this.bg1.position.set(-290,-60,0);this.bg2.position.set(290,-60,0);
    this.m1=this.makeGrid(this.bg1);this.m2=this.makeGrid(this.bg2);
    this.makeRoof(this.bg1,"assets/redroof.png",S.t1);
    this.makeRoof(this.bg2,"assets/blueroof.png",S.t2);
    const fw=C*cw+12,fg=new THREE.BoxGeometry(fw,8,4),fy=-R*ch/2-6;
    const f1=new THREE.Mesh(fg.clone(),new THREE.MeshBasicMaterial({color:0x8D6E63}));f1.position.set(0,fy,1);this.bg1.add(f1);
    const f2=new THREE.Mesh(fg.clone(),new THREE.MeshBasicMaterial({color:0x8D6E63}));f2.position.set(0,fy,1);this.bg2.add(f2);
    this.scene.add(this.bg1);this.scene.add(this.bg2);
  }
  makeGrid(grp) {
    const{gridCols:C,gridRows:R}=this.app,cw=this.CELL_W,ch=this.CELL_H,meshes=[];
    const gw=C*cw,gh=R*ch;
    const pg=new THREE.BoxGeometry(gw+6,gh+6,2);
    const pm=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({color:0xD5DAE2}));
    pm.position.set(0,0,-1);grp.add(pm);
    for(let r=0;r<R;r++){meshes[r]=[];for(let c=0;c<C;c++){
      const g=new THREE.BoxGeometry(cw-2,ch-2,4);const m=new THREE.MeshBasicMaterial({color:S.cellEmpty});
      const mesh=new THREE.Mesh(g,m);mesh.position.set((c-C/2+.5)*cw,(r-R/2+.5)*ch,0);
      grp.add(mesh);meshes[r][c]=mesh;
    }}
    return meshes;
  }
  makeRoof(grp, imgPath, fallbackColor) {
    const{gridCols:C,gridRows:R}=this.app,cw=this.CELL_W,ch=this.CELL_H;
    const gw=C*cw, ry=R*ch/2;
    const rw=gw+20;

    // try loading image
    const loader=new THREE.TextureLoader();
    loader.load(imgPath, (texture)=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      const aspect=texture.image.width/texture.image.height;
      const roofW=gw+120;
      const roofH=roofW/aspect;
      const geo=new THREE.PlaneGeometry(roofW,roofH);
      const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:0.1});
      const mesh=new THREE.Mesh(geo,mat);
      mesh.position.set(0,ry+roofH/2-33,5);
      grp.add(mesh);
    }, undefined, ()=>{
      // fallback: simple triangle
      const tc=new THREE.Color(fallbackColor);
      const barGeo=new THREE.BoxGeometry(rw,8,6);
      const bar=new THREE.Mesh(barGeo,new THREE.MeshBasicMaterial({color:tc.clone().multiplyScalar(0.7)}));
      bar.position.set(0,ry+4,2);grp.add(bar);
      const ts=new THREE.Shape();ts.moveTo(-rw/2,0);ts.lineTo(0,32);ts.lineTo(rw/2,0);ts.closePath();
      const tri=new THREE.Mesh(new THREE.ShapeGeometry(ts),new THREE.MeshBasicMaterial({color:tc}));
      tri.position.set(0,ry+8,2);grp.add(tri);
    });
  }

  // ===================== UI HELPERS =====================
  clearUI(){while(this.uiLayer.firstChild)this.uiLayer.removeChild(this.uiLayer.firstChild);}

  teamLabels() {
    const gw=this.app.gridCols*this.CELL_W;
    const mk=(x,name,color)=>AppHelper.el("div","",{
      position:"absolute",left:x+"px",top:(this.H-42)+"px",
      width:gw+"px",textAlign:"center",fontSize:"14px",fontWeight:"800",color:"#fff",
      backgroundColor:color,borderRadius:"8px",padding:"4px 0",
      pointerEvents:"none",fontFamily:S.font
    },name);
    this.uiLayer.appendChild(mk(this.W/2-290-gw/2,this.txt.team1Name,S.t1));
    this.uiLayer.appendChild(mk(this.W/2+290-gw/2,this.txt.team2Name,S.t2));
  }

  scoreBar() {
    const bar=AppHelper.el("div","",{
      position:"absolute",left:(this.W/2-140)+"px",top:(this.H-72)+"px",
      width:"280px",textAlign:"center",padding:"6px 0",
      backgroundColor:"rgba(255,255,255,0.9)",borderRadius:"8px",
      fontSize:"13px",fontWeight:"700",color:S.sub,
      pointerEvents:"none",fontFamily:S.font,boxShadow:S.shadow,
    },`${this.txt.team1Name} ${this.h1}/${this.app.gridRows}  |  ${this.txt.team2Name} ${this.h2}/${this.app.gridRows}`);
    this.uiLayer.appendChild(bar);
  }

  // ===================== START =====================
  showStart() {
    this.phase="start";this.clearUI();
    const ov=AppHelper.el("div","",{
      position:"absolute",left:"0",top:"0",width:this.W+"px",height:this.H+"px",
      backgroundColor:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",
      pointerEvents:"auto"
    });
    const card=AppHelper.el("div","",{
      backgroundColor:"#fff",borderRadius:"24px",boxShadow:"0 12px 48px rgba(0,0,0,0.2)",
      padding:"44px 52px",maxWidth:"480px",textAlign:"center"
    });
    card.appendChild(AppHelper.el("div","",{fontSize:"42px",fontWeight:"900",color:S.dark,marginBottom:"6px",fontFamily:S.font},this.txt.title));
    card.appendChild(AppHelper.el("div","",{fontSize:"14px",color:S.sub,lineHeight:"1.8",textAlign:"left",
      marginBottom:"32px",fontFamily:S.font,padding:"14px 18px",backgroundColor:"#F5F7FA",borderRadius:"10px"
    },this.txt.tutorialContent));
    card.appendChild(AppHelper.el("div","",{
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      fontSize:"20px",fontWeight:"700",color:"#fff",backgroundColor:S.err,
      padding:"14px 56px",borderRadius:"12px",cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
    },this.txt.startBtn,[{event:"pointerdown",handler:()=>this.startGame()}]));
    ov.appendChild(card);this.uiLayer.appendChild(ov);
  }

  startGame() {
    this.round=1;this.h1=0;this.h2=0;
    this.resetGrids();this.syncGrid();
    this.startCardFlip();
  }

  // ===================== 4-1: CARD FLIP =====================
  genTarget() {
    const{min,max}=this.app.targetRange;
    return Math.floor(Math.random()*(max-min+1))+min;
  }

  startCardFlip() {
    this.phase="cardflip";this.clearUI();
    this.t1={target:this.genTarget(),value:0,op:"+",locked:false};
    this.t2={target:this.genTarget(),value:0,op:"+",locked:false};

    this.teamLabels();this.scoreBar();

    // round banner
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(this.W/2-80)+"px",top:"14px",
      width:"160px",textAlign:"center",fontSize:"16px",fontWeight:"800",
      color:"#fff",backgroundColor:"#546E7A",borderRadius:"10px",padding:"8px 0",
      pointerEvents:"none",fontFamily:S.font
    },`R${this.round}`));

    // team cards
    this.makeFlipCard(1, this.W/2-290, this.t1.target);
    this.makeFlipCard(2, this.W/2+290, this.t2.target);

    // instruction
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(this.W/2-200)+"px",top:"560px",
      width:"400px",textAlign:"center",fontSize:"16px",fontWeight:"600",
      color:S.sub,pointerEvents:"none",fontFamily:S.font
    },"카드를 터치하여 목표 숫자를 확인하세요!"));
  }

  makeFlipCard(team, cx, target) {
    const tc = team===1?S.t1:S.t2;
    const tn = team===1?this.txt.team1Name:this.txt.team2Name;
    const y = 380;

    // team name
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(cx-80)+"px",top:(y-60)+"px",
      width:"160px",textAlign:"center",fontSize:"28px",fontWeight:"900",
      color:S.dark,pointerEvents:"none",fontFamily:S.font
    },tn));

    // flip card container
    const cw=200,ch=110;
    const container=AppHelper.el("div",`flipCard${team}`,{
      position:"absolute",left:(cx-cw/2)+"px",top:y+"px",
      width:cw+"px",height:ch+"px",perspective:"600px",
      cursor:"pointer",pointerEvents:"auto"
    });

    const back=AppHelper.el("div","",{
      position:"absolute",width:"100%",height:"100%",
      backgroundColor:"#37474F",borderRadius:"14px",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"36px",fontWeight:"bold",color:"#78909C",
      transition:"transform 0.4s",backfaceVisibility:"hidden",fontFamily:S.font
    },"?");

    const front=AppHelper.el("div","",{
      position:"absolute",width:"100%",height:"100%",
      backgroundColor:"#263238",borderRadius:"14px",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      transform:"rotateY(180deg)",transition:"transform 0.4s",
      backfaceVisibility:"hidden",fontFamily:S.font
    });
    front.appendChild(AppHelper.el("div","",{fontSize:"11px",color:"#90A4AE",marginBottom:"2px",fontFamily:S.font},"목표 숫자"));
    front.appendChild(AppHelper.el("div","",{fontSize:"36px",fontWeight:"900",color:"#FFC107",fontFamily:S.font},String(target)));

    // round badge
    const badge=AppHelper.el("div","",{
      position:"absolute",left:"-10px",top:"-10px",
      width:"28px",height:"28px",borderRadius:"50%",
      backgroundColor:tc,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"14px",fontWeight:"800",color:"#fff",fontFamily:S.font,
      boxShadow:"0 2px 6px rgba(0,0,0,0.3)"
    },String(this.round));

    container.appendChild(back);container.appendChild(front);container.appendChild(badge);

    let flipped=false;
    container.addEventListener("pointerdown",()=>{
      if(flipped)return;flipped=true;
      this.sndPop();
      back.style.transform="rotateY(180deg)";front.style.transform="rotateY(0deg)";
      // check if both flipped
      if(team===1)this.t1.flipped=true; else this.t2.flipped=true;
      if(this.t1.flipped&&this.t2.flipped){
        setTimeout(()=>this.startMath(),800);
      }
    });

    this.uiLayer.appendChild(container);
  }

  // ===================== 4-2: SIMULTANEOUS MATH =====================
  startMath() {
    this.phase="math";this.clearUI();
    this.t1.value=0;this.t1.op="+";this.t1.locked=false;
    this.t2.value=0;this.t2.op="+";this.t2.locked=false;

    this.teamLabels();this.scoreBar();

    // round banner
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(this.W/2-80)+"px",top:"14px",
      width:"160px",textAlign:"center",fontSize:"16px",fontWeight:"800",
      color:"#fff",backgroundColor:"#546E7A",borderRadius:"10px",padding:"8px 0",
      pointerEvents:"none",fontFamily:S.font
    },`R${this.round}`));

    // build both team calculators (centered lower)
    this.buildCalc(1, this.W/2-290, this.t1);
    this.buildCalc(2, this.W/2+290, this.t2);

    // center instruction
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(this.W/2-160)+"px",top:(this.H-36)+"px",
      width:"320px",textAlign:"center",fontSize:"13px",fontWeight:"600",
      color:S.sub,pointerEvents:"none",fontFamily:S.font
    },"부호(+/-)를 선택하고 숫자를 눌러 목표 숫자를 만드세요!"));
  }

  buildCalc(team, cx, state) {
    const tc=team===1?S.t1:S.t2;
    const tn=team===1?this.txt.team1Name:this.txt.team2Name;
    const prefix=`t${team}`;
    const calcW=200;

    // container card for clean grouping
    const card=AppHelper.el("div","",{
      position:"absolute",left:(cx-calcW/2-12)+"px",top:"280px",
      width:(calcW+24)+"px",
      backgroundColor:"rgba(255,255,255,0.85)",borderRadius:"16px",
      boxShadow:"0 2px 16px rgba(0,0,0,0.06)",
      padding:"14px 12px 16px",boxSizing:"border-box",
      display:"flex",flexDirection:"column",alignItems:"center",gap:"10px"
    });

    // team name
    card.appendChild(AppHelper.el("div","",{
      fontSize:"24px",fontWeight:"900",color:S.dark,fontFamily:S.font
    },tn));

    // target card
    const targetBox=AppHelper.el("div","",{
      width:calcW+"px",height:"66px",backgroundColor:"#263238",borderRadius:"12px",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      position:"relative"
    });
    targetBox.appendChild(AppHelper.el("div","",{
      position:"absolute",left:"-6px",top:"-6px",width:"22px",height:"22px",
      borderRadius:"50%",backgroundColor:tc,display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"11px",fontWeight:"800",color:"#fff",fontFamily:S.font
    },String(this.round)));
    targetBox.appendChild(AppHelper.el("div","",{fontSize:"10px",color:"#90A4AE",fontFamily:S.font},"목표 숫자"));
    targetBox.appendChild(AppHelper.el("div","",{fontSize:"32px",fontWeight:"900",color:"#FFC107",fontFamily:S.font},String(state.target)));
    card.appendChild(targetBox);

    // current value
    const valueEl=AppHelper.el("div",`${prefix}-value`,{
      width:calcW+"px",height:"44px",backgroundColor:"#455A64",borderRadius:"10px",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"30px",fontWeight:"800",color:"#fff",fontFamily:S.font
    },"0");
    card.appendChild(valueEl);

    // operator row
    const opRow=AppHelper.el("div","",{
      display:"flex",gap:"6px",width:calcW+"px"
    });
    const mkOp=(label,isPlus)=>{
      const active=isPlus?(state.op==="+"):(state.op==="-");
      return AppHelper.el("div",`${prefix}-op-${label}`,{
        flex:"1",height:"38px",
        backgroundColor:active?"#546E7A":"#B0BEC5",
        borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:"22px",fontWeight:"800",color:"#fff",
        cursor:"pointer",pointerEvents:"auto",fontFamily:S.font,
        transition:"background 0.15s"
      },label,[{event:"pointerdown",handler:()=>this.selectOp(team,label)}]);
    };
    opRow.appendChild(mkOp("+",true));
    opRow.appendChild(mkOp("-",false));
    card.appendChild(opRow);

    // number grid (5 cols x 2 rows)
    const numGrid=AppHelper.el("div","",{
      display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"4px",width:calcW+"px"
    });
    [1,2,3,4,5,6,7,8,9].forEach(n=>{
      numGrid.appendChild(AppHelper.el("div","",{
        height:"38px",backgroundColor:"#5C8DB8",borderRadius:"8px",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:"17px",fontWeight:"800",color:"#fff",
        cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
      },String(n),[{event:"pointerdown",handler:()=>this.pressNumber(team,n)}]));
    });
    card.appendChild(numGrid);

    this.uiLayer.appendChild(card);
  }

  selectOp(team,op) {
    if(this.phase!=="math")return;
    const state=team===1?this.t1:this.t2;
    if(state.locked)return;
    state.op=op;
    this.sndClick();
    // update button visuals
    const prefix=`t${team}`;
    const plusBtn=document.getElementById(`${prefix}-op-+`);
    const minusBtn=document.getElementById(`${prefix}-op--`);
    if(plusBtn)plusBtn.style.backgroundColor=op==="+"?"#455A64":"#B0BEC5";
    if(minusBtn)minusBtn.style.backgroundColor=op==="-"?"#455A64":"#B0BEC5";
  }

  pressNumber(team,num) {
    if(this.phase!=="math")return;
    const state=team===1?this.t1:this.t2;
    if(state.locked)return;

    // apply operation
    if(state.op==="+") state.value+=num;
    else state.value-=num;

    this.sndClick();

    // update display
    const el=document.getElementById(`t${team}-value`);
    if(el){
      el.textContent=String(state.value);
      el.style.transition="transform 0.1s";
      el.style.transform="scale(1.1)";
      setTimeout(()=>{el.style.transform="scale(1)";},100);
    }

    // check if matched
    if(state.value===state.target){
      state.locked=true;
      this.sndCorrect();
      if(el)el.style.backgroundColor="#43A047";
      this.winnerTeam=team;
      // lock other team too
      if(team===1)this.t2.locked=true;else this.t1.locked=true;
      setTimeout(()=>this.startTetris(),800);
    }
  }

  // ===================== 4-3: TETRIS (winner only) =====================
  startTetris() {
    this.phase="tetris";this.clearUI();
    this.pieces=[];
    const n=Math.max(this.app.tetrominoCount,10);
    for(let i=0;i<n;i++) this.pieces.push(this.genFittingPiece());
    this.pieceIdx=0;this.placed=0;
    this.findValidStart();
    this.buildTetrisUI();
  }

  genPiece() {
    const{tetrominoMinSize:mn,tetrominoMaxSize:mx,buildingColors:colors}=this.app;
    const size=Math.floor(Math.random()*(mx-mn+1))+mn;
    const color=colors[Math.floor(Math.random()*colors.length)];
    const cells=[{col:0,row:0}];
    for(let i=1;i<size;i++){
      const nb=[];
      for(const c of cells)for(const d of [{col:c.col+1,row:c.row},{col:c.col-1,row:c.row},{col:c.col,row:c.row+1},{col:c.col,row:c.row-1}])
        if(!cells.some(x=>x.col===d.col&&x.row===d.row)&&!nb.some(x=>x.col===d.col&&x.row===d.row))nb.push(d);
      if(nb.length)cells.push(nb[Math.floor(Math.random()*nb.length)]);
    }
    const mc=Math.min(...cells.map(c=>c.col)),mr=Math.min(...cells.map(c=>c.row));
    return{cells:cells.map(c=>({col:c.col-mc,row:c.row-mr})),color};
  }

  rotatePiece(piece) {
    const rotated=piece.cells.map(c=>({col:c.row,row:-c.col}));
    const mc=Math.min(...rotated.map(c=>c.col)),mr=Math.min(...rotated.map(c=>c.row));
    return{cells:rotated.map(c=>({col:c.col-mc,row:c.row-mr})),color:piece.color};
  }

  canFit(piece,grid) {
    const{gridCols:C,gridRows:R}=this.app;
    for(let r=0;r<R;r++)for(let c=0;c<C;c++)
      if(this.canPlace(piece,c,r,grid)&&this.isGrounded(piece,c,r,grid))return true;
    return false;
  }

  genFittingPiece() {
    const grid=this.winnerTeam===1?this.g1:this.g2;
    for(let i=0;i<20;i++){const p=this.genPiece();if(this.canFit(p,grid))return p;}
    const{buildingColors:colors}=this.app;
    return{cells:[{col:0,row:0}],color:colors[Math.floor(Math.random()*colors.length)]};
  }

  refreshPieces() {
    const grid=this.winnerTeam===1?this.g1:this.g2;
    for(let i=0;i<this.pieces.length;i++){
      if(!this.canFit(this.pieces[i],grid))this.pieces[i]=this.genFittingPiece();
    }
    if(this.pieceIdx>=this.pieces.length)this.pieceIdx=0;
  }

  buildTetrisUI() {
    const cx=this.W/2;
    const tc=this.winnerTeam===1?S.t1:S.t2;
    const tn=this.winnerTeam===1?this.txt.team1Name:this.txt.team2Name;
    this.teamLabels();

    // banner
    this.uiLayer.appendChild(AppHelper.el("div","",{
      position:"absolute",left:(cx-140)+"px",top:"14px",
      width:"280px",textAlign:"center",fontSize:"15px",fontWeight:"800",
      color:"#fff",backgroundColor:tc,borderRadius:"10px",padding:"8px 0",
      pointerEvents:"none",fontFamily:S.font
    },`R${this.round} \u2014 ${tn} \uC870\uAC01 \uBC30\uCE58`));

    // piece selector
    const cw=340,cl=cx-cw/2;
    const card=AppHelper.el("div","",{
      position:"absolute",left:cl+"px",top:"48px",width:cw+"px",
      backgroundColor:"#fff",borderRadius:"14px",boxShadow:S.shadow,
      padding:"10px 14px",boxSizing:"border-box"
    });
    card.appendChild(AppHelper.el("div","",{fontSize:"12px",fontWeight:"700",color:S.sub,marginBottom:"6px",fontFamily:S.font},"\uC870\uAC01 \uC120\uD0DD"));
    const pw=AppHelper.el("div","",{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"5px",maxHeight:"110px",overflowY:"auto"});
    const pcs=13,end=Math.min(this.pieces.length,this.app.tetrominoCount);
    for(let i=0;i<end;i++){
      const p=this.pieces[i],sel=i===this.pieceIdx;
      const mc=Math.max(...p.cells.map(c=>c.col))+1,mr=Math.max(...p.cells.map(c=>c.row))+1;
      const box=AppHelper.el("div","",{
        position:"relative",width:(mc*pcs+6)+"px",height:(mr*pcs+6)+"px",
        border:sel?`2px solid ${tc}`:"2px solid #E0E0E0",borderRadius:"6px",
        backgroundColor:sel?"#FFF8E1":"#FAFAFA",cursor:"pointer",pointerEvents:"auto",padding:"2px",flexShrink:"0"
      },"",[{event:"pointerdown",handler:()=>this.selPiece(i)}]);
      p.cells.forEach(cell=>{
        box.appendChild(AppHelper.el("div","",{position:"absolute",left:(3+cell.col*pcs)+"px",bottom:(3+cell.row*pcs)+"px",
          width:(pcs-2)+"px",height:(pcs-2)+"px",backgroundColor:p.color,borderRadius:"2px"}));
      });
      pw.appendChild(box);
    }
    card.appendChild(pw);this.uiLayer.appendChild(card);

    // controls
    const ctrlCard=AppHelper.el("div","",{
      position:"absolute",left:(cx-110)+"px",top:"235px",width:"220px",
      backgroundColor:"#fff",borderRadius:"14px",boxShadow:S.shadow,
      padding:"12px",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px"
    });

    // d-pad + rotate
    const dpad=AppHelper.el("div","",{display:"grid",gridTemplateColumns:"44px 44px 44px",gridTemplateRows:"38px 38px",gap:"3px",marginBottom:"6px"});
    const ab=(label,handler)=>AppHelper.el("div","",{
      width:"44px",height:"38px",backgroundColor:"#78909C",borderRadius:"8px",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"16px",color:"#fff",cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
    },label,[{event:"pointerdown",handler}]);

    dpad.appendChild(AppHelper.el("div",""));
    dpad.appendChild(ab("\u25B2",()=>this.moveGhost(0,1)));
    dpad.appendChild(AppHelper.el("div",""));
    dpad.appendChild(ab("\u25C0",()=>this.moveGhost(-1,0)));
    dpad.appendChild(ab("\u25BC",()=>this.moveGhost(0,-1)));
    dpad.appendChild(ab("\u25B6",()=>this.moveGhost(1,0)));
    ctrlCard.appendChild(dpad);

    // rotate button
    ctrlCard.appendChild(AppHelper.el("div","",{
      width:"100%",height:"34px",backgroundColor:"#7E57C2",borderRadius:"8px",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"14px",fontWeight:"700",color:"#fff",cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
    },"\uD68C\uC804",[{event:"pointerdown",handler:()=>this.doRotate()}]));

    // place button
    ctrlCard.appendChild(AppHelper.el("div","",{
      width:"100%",height:"38px",backgroundColor:S.ok,borderRadius:"8px",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:"16px",fontWeight:"700",color:"#fff",cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
    },"\uBC30\uCE58",[{event:"pointerdown",handler:()=>this.doPiece()}]));

    // counter
    ctrlCard.appendChild(AppHelper.el("div","pieceCounter",{
      fontSize:"13px",fontWeight:"600",color:S.sub,fontFamily:S.font,textAlign:"center"
    },`\uBC30\uCE58 ${this.placed} / ${this.app.piecesPerRound}`));

    this.uiLayer.appendChild(ctrlCard);
    this.scoreBar();
    this.showGhost();
  }

  selPiece(i){if(this.phase!=="tetris")return;this.pieceIdx=i;this.findValidStart();this.clearUI();this.buildTetrisUI();}

  doRotate() {
    if(this.phase!=="tetris"||this.pieceIdx>=this.pieces.length)return;
    this.pieces[this.pieceIdx]=this.rotatePiece(this.pieces[this.pieceIdx]);
    this.sndClick();
    this.findValidStart();
    this.clearUI();this.buildTetrisUI();
  }

  moveGhost(dx,dy) {
    if(this.phase!=="tetris"||this.pieceIdx>=this.pieces.length)return;
    const p=this.pieces[this.pieceIdx];
    const mc=Math.max(...p.cells.map(c=>c.col)),mr=Math.max(...p.cells.map(c=>c.row));
    const maxCol=this.app.gridCols-1-mc,maxRow=this.app.gridRows-1-mr;
    const grid=this.winnerTeam===1?this.g1:this.g2;

    let nc=this.gCol+dx,nr=this.gRow+dy;
    nc=Math.max(0,Math.min(maxCol,nc));nr=Math.max(0,Math.min(maxRow,nr));
    if(dx!==0){while(nc>=0&&nc<=maxCol&&!this.canPlace(p,nc,nr,grid))nc+=dx;nc=Math.max(0,Math.min(maxCol,nc));}
    if(dy!==0){while(nr>=0&&nr<=maxRow&&!this.canPlace(p,nc,nr,grid))nr+=dy;nr=Math.max(0,Math.min(maxRow,nr));}
    if(this.canPlace(p,nc,nr,grid)){this.gCol=nc;this.gRow=nr;}
    this.showGhost();
  }

  showGhost() {
    if(this.pieceIdx>=this.pieces.length)return;
    const p=this.pieces[this.pieceIdx];
    const grid=this.winnerTeam===1?this.g1:this.g2;
    const meshes=this.winnerTeam===1?this.m1:this.m2;
    this.syncGrid();
    const ok=this.canPlace(p,this.gCol,this.gRow,grid)&&this.isGrounded(p,this.gCol,this.gRow,grid);
    for(const cell of p.cells){
      const r=this.gRow+cell.row,c=this.gCol+cell.col;
      if(r>=0&&r<this.app.gridRows&&c>=0&&c<this.app.gridCols){
        const mat=meshes[r][c].material;
        if(!grid[r][c]){mat.color.set(ok?p.color:0xEF9A9A);mat.opacity=0.5;mat.transparent=true;}
      }
    }
  }

  findValidStart() {
    const p=this.pieces[this.pieceIdx];
    const grid=this.winnerTeam===1?this.g1:this.g2;
    const{gridCols:C,gridRows:R}=this.app;
    const mc=Math.max(...p.cells.map(c=>c.col)),mr=Math.max(...p.cells.map(c=>c.row));
    for(let r=0;r<=R-1-mr;r++)for(let c=0;c<=C-1-mc;c++)
      if(this.canPlace(p,c,r,grid)&&this.isGrounded(p,c,r,grid)){this.gCol=c;this.gRow=r;return;}
    for(let r=0;r<=R-1-mr;r++)for(let c=0;c<=C-1-mc;c++)
      if(this.canPlace(p,c,r,grid)){this.gCol=c;this.gRow=r;return;}
    this.gCol=0;this.gRow=0;
  }

  canPlace(piece,col,row,grid){
    for(const cell of piece.cells){const r=row+cell.row,c=col+cell.col;
      if(r<0||r>=this.app.gridRows||c<0||c>=this.app.gridCols)return false;if(grid[r][c])return false;}return true;
  }

  isGrounded(piece,col,row,grid){
    for(const cell of piece.cells){const r=row+cell.row,c=col+cell.col;
      if(r===0)return true;
      if(r>0&&grid[r-1][c]&&!piece.cells.some(pc=>row+pc.row===r-1&&col+pc.col===c))return true;
    }return false;
  }

  doPiece() {
    if(this.phase!=="tetris"||this.pieceIdx>=this.pieces.length)return;
    const p=this.pieces[this.pieceIdx];
    const grid=this.winnerTeam===1?this.g1:this.g2;
    const meshes=this.winnerTeam===1?this.m1:this.m2;
    const{gridCols:C,gridRows:R}=this.app;
    if(!this.canPlace(p,this.gCol,this.gRow,grid))return;
    if(!this.isGrounded(p,this.gCol,this.gRow,grid))return;

    for(const cell of p.cells)grid[this.gRow+cell.row][this.gCol+cell.col]=p.color;
    this.sndPlace();this.syncGrid();
    for(const cell of p.cells){const r=this.gRow+cell.row,c=this.gCol+cell.col;
      if(r>=0&&r<R&&c>=0&&c<C)gsap.from(meshes[r][c].scale,{x:0.3,y:0.3,duration:0.25,ease:"back.out(1.7)"});}

    this.pieces.splice(this.pieceIdx,1);this.pieces.push(this.genFittingPiece());this.placed++;
    this.syncGrid();this.updateHeights();
    if(this.checkWin())return;

    if(this.placed>=this.app.piecesPerRound){
      // back to card flip (4-2 -> 4-1)
      this.round++;
      setTimeout(()=>this.startCardFlip(),600);
    } else {
      if(this.pieceIdx>=this.pieces.length)this.pieceIdx=0;
      this.refreshPieces();this.findValidStart();
      this.clearUI();this.buildTetrisUI();
    }
  }

  // ===================== WIN =====================
  updateHeights(){this.h1=this.calcH(this.g1);this.h2=this.calcH(this.g2);}
  calcH(grid){let h=0;for(let r=0;r<this.app.gridRows;r++){if(grid[r].every(c=>c!==null))h=r+1;else break;}return h;}

  checkWin(){
    if(this.h1>=this.app.gridRows){this.showWin(1);return true;}
    if(this.h2>=this.app.gridRows){this.showWin(2);return true;}
    return false;
  }

  showWin(team) {
    this.phase="win";this.clearUI();
    const tn=team===1?this.txt.team1Name:this.txt.team2Name;
    const tc=team===1?S.t1:S.t2;
    this.sndWin();
    try{confetti({particleCount:200,spread:120,origin:{y:0.5}});setTimeout(()=>confetti({particleCount:100,spread:80,origin:{y:0.4}}),500);}catch{}
    const ov=AppHelper.el("div","",{
      position:"absolute",left:"0",top:"0",width:this.W+"px",height:this.H+"px",
      backgroundColor:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"auto"
    });
    const card=AppHelper.el("div","",{backgroundColor:"#fff",borderRadius:"24px",boxShadow:"0 12px 48px rgba(0,0,0,0.25)",
      padding:"44px 56px",textAlign:"center"});
    card.appendChild(AppHelper.el("div","",{fontSize:"48px",fontWeight:"900",color:tc,marginBottom:"8px",fontFamily:S.font},`${tn} ${this.txt.winMessage}`));
    card.appendChild(AppHelper.el("div","",{fontSize:"16px",color:S.sub,marginBottom:"32px",fontFamily:S.font},"\uC9C0\uBD95 \uB192\uC774\uC5D0 \uBA3C\uC800 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4!"));
    card.appendChild(AppHelper.el("div","",{display:"inline-flex",alignItems:"center",justifyContent:"center",
      fontSize:"20px",fontWeight:"700",color:"#fff",backgroundColor:S.err,
      padding:"14px 48px",borderRadius:"12px",cursor:"pointer",pointerEvents:"auto",fontFamily:S.font
    },"\uB2E4\uC2DC \uC2DC\uC791",[{event:"pointerdown",handler:()=>{this.resetGrids();this.syncGrid();this.startGame();}}]));
    ov.appendChild(card);this.uiLayer.appendChild(ov);
  }

  // ===================== RENDER =====================
  syncGrid(){this.syncOne(this.g1,this.m1);this.syncOne(this.g2,this.m2);}
  syncOne(grid,meshes){for(let r=0;r<this.app.gridRows;r++)for(let c=0;c<this.app.gridCols;c++){
    const mat=meshes[r][c].material;
    if(grid[r][c]){mat.color.set(grid[r][c]);mat.opacity=1;mat.transparent=false;}
    else{mat.color.set(S.cellEmpty);mat.opacity=1;mat.transparent=false;}
  }}

  loop(){requestAnimationFrame(()=>this.loop());this.ren.render(this.scene,this.cam);}
}

// ======================== Boot ========================
async function initApp(){const a=new RoofKickApp();await a.init();}

let logicalWidth=0,logicalHeight=0;
const appCanvas=document.getElementById("appCanvas"),uiLayer=document.getElementById("uiLayer"),appContainer=document.getElementById("appContainer");
let isCanvasLayoutUpdating=false;
function UpdateCanvasLayout(){if(isCanvasLayoutUpdating)return;window.requestAnimationFrame(()=>{isCanvasLayoutUpdating=true;
  if(appCanvas.width!==1&&appCanvas.height!==1){if(!logicalWidth&&!logicalHeight){logicalWidth=appCanvas.width;logicalHeight=appCanvas.height;}
    const vw=window.innerWidth,vh=window.innerHeight;appContainer.style.cssText="";appCanvas.style.cssText="";uiLayer.style.cssText="";
    const ar=appCanvas.width/appCanvas.height;let dw,dh;if(vw/vh>ar){dh=vh;dw=vh*ar;}else{dw=vw;dh=vw/ar;}
    const sc=dw/appCanvas.width;
    appContainer.style.position="absolute";appContainer.style.width=appCanvas.width+"px";appContainer.style.height=appCanvas.height+"px";
    appContainer.style.transformOrigin="top left";appContainer.style.transform=`scale(${sc})`;
    appContainer.style.left=(vw-dw)/2+"px";appContainer.style.top=(vh-dh)/2+"px";
    appCanvas.style.position="absolute";appCanvas.style.width=appCanvas.width+"px";appCanvas.style.height="auto";
    appCanvas.style.top="0";appCanvas.style.left="0";appCanvas.style.touchAction="none";
    const us=appCanvas.width/logicalWidth;uiLayer.style.position="absolute";uiLayer.style.width=logicalWidth+"px";
    uiLayer.style.height=logicalHeight+"px";uiLayer.style.transformOrigin="top left";uiLayer.style.transform=`scale(${us})`;
    uiLayer.style.top="0";uiLayer.style.left="0";}isCanvasLayoutUpdating=false;});}

function SetCanvasFocus(){if(document.activeElement!==appCanvas){window.focus();appCanvas.focus();}}
const resizeObserver=new ResizeObserver(entries=>{for(const e of entries)if(e.target===appCanvas)UpdateCanvasLayout();});
let isCapturing=false,lastPingTime=0,lastCaptureTime=0,lastResolutionTime=0;const MIN_INTERVAL=1000;
window.parent.postMessage({source:"typingx-x-iframe",type:"ping-pong-ready"},"*");
window.addEventListener("message",async(event)=>{if(!event.data||event.data.source!=="alparka-parent")return;const now=Date.now();
  if(event.data.type==="ping"&&now-lastPingTime>MIN_INTERVAL){lastPingTime=now;window.parent.postMessage({source:"typingx-x-iframe",type:"pong"},"*");}
  else if(event.data.type==="request-canvas-capture"&&now-lastCaptureTime>MIN_INTERVAL&&!isCapturing){lastCaptureTime=now;isCapturing=true;
    try{const d=await AppHelper.captureCanvasAsDataUrl(true);if(d)window.parent.postMessage({source:"typingx-x-iframe",type:"canvas-capture",payload:{dataUrl:d}},"*");}finally{isCapturing=false;}}
  else if(event.data.type==="request-app-resolution"&&now-lastResolutionTime>MIN_INTERVAL){lastResolutionTime=now;
    window.parent.postMessage({source:"typingx-x-iframe",type:"app-resolution",payload:{width:appCanvas.width,height:appCanvas.height}},"*");}});
window.addEventListener("resize",UpdateCanvasLayout);appCanvas.addEventListener("pointerdown",SetCanvasFocus);
document.addEventListener("contextmenu",e=>e.preventDefault());
document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{resizeObserver.observe(appCanvas);initApp();SetCanvasFocus();UpdateCanvasLayout();},0));
