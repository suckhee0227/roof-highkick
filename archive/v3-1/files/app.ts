// import section

import { AppHelper } from "./appHelper";
import { Howl } from "howler";
import { gsap } from "gsap";
import confetti from "canvas-confetti";

// declaration section

// 앱 데이터 인터페이스
interface IAppData {
  // 제한 시간
  gameTime: number;
  // 목표 점수
  targetScore: number;
  // 공 개수
  ballCount: number;
}

// 텍스트 데이터 인터페이스
interface ITextData {
  // 제목
  title: string;
  // 인원수 라벨
  playerCountLabel: string;
  // 차례 제목
  turnTitle: string;
  // 시작 버튼
  startBtn: string;
  // 고 텍스트
  go: string;
  // 타임업 텍스트
  timeUp: string;
  // 합계 라벨
  sumLabel: string;
  // 목표 라벨
  targetLabel: string;
  // 빈 슬롯 메시지
  emptySlotMsg: string;
  // 다시하기 버튼
  retryBtn: string;
  // 랭킹 제목
  rankTitle: string;
  // 차이 라벨
  diffLabel: string;
}

// 에셋 리스트 인터페이스
interface IAssetList {
  // 이미지 목록
  images: any[];
  // 소리 목록
  sounds: any[];
}

// 플레이어 인터페이스
interface IPlayer {
  // 이름
  name: string;
  // 총점
  score: number;
  // 차이
  diff: number;
}

// 현재 차례 인덱스
let currentTurnIndex = 0;

// 플레이어 이름 배열
let playerNames: string[] = [];

// 선택된 인원수
let selectedPlayerCount = 2;

// 공 클래스
class Ball {
  // 아이디
  id: number;

  // 표시 숫자
  num: number;

  // X 좌표
  x: number;

  // Y 좌표
  y: number;

  // X축 속도
  vx: number;

  // Y축 속도
  vy: number;

  // 상태
  state: "FLOAT" | "MOVE" | "SLOT";

  // 속한 슬롯 인덱스
  slotIndex: number;

  // 생성자
  constructor(id: number, num: number, x: number, y: number) {
    this.id = id;
    this.num = num;
    this.x = x;
    this.y = y;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 2 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.state = "FLOAT";
    this.slotIndex = -1;
  }
}

// 파티클 클래스
class Particle {
  // X 좌표
  x: number;

  // Y 좌표
  y: number;

  // X축 속도
  vx: number;

  // Y축 속도
  vy: number;

  // 생명력
  life: number;

  // 색상
  color: string;

  // 크기
  size: number;

  // 생성자
  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 8 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.size = Math.random() * 10 + 5;
  }
}

// 앱 데이터 변수
let appData: IAppData;

// 텍스트 데이터 변수
let textData: ITextData;

// 에셋 리스트 변수
let assetList: IAssetList;

// 캔버스 엘리먼트
let appCanvas: HTMLCanvasElement;

// 캔버스 컨텍스트
let ctx: CanvasRenderingContext2D;

// UI 레이어
let uiLayer: HTMLElement;

// 논리 해상도 너비
let logicalWidth = 1080;

// 논리 해상도 높이
let logicalHeight = 1920;

// 마지막 업데이트 시간
let lastTime = 0;

// 게임 상태
let gameState: "INTRO" | "PLAY" | "TIMEUP" | "RESULT" = "INTRO";

// 남은 시간
let timeLeft = 90;

// 점수 수정치
let scoreModifier = 0;

// 공 배열
let balls: Ball[] = [];

// 파티클 배열
let particles: Particle[] = [];

// 플레이어 기록 배열
let players: IPlayer[] = [];

// 사운드 맵
let sounds: { [key: string]: Howl } = {};

// 사운드 초기화 여부
let soundsInitialized = false;

// 진동 이펙트 활성화 여부
let isShaking = false;

// 슬롯 좌표 배열
let SLOTS = [
  { x: 240, y: 1400 },
  { x: 540, y: 1400 },
  { x: 840, y: 1400 },
];

// 공 반지름
let BALL_RADIUS = 70;

// 합계 표시 DOM
let sumDisplayEl: HTMLElement | null = null;

// 플러스 버튼 DOM
let btnPlusEl: HTMLElement | null = null;

// 마이너스 버튼 DOM
let btnMinusEl: HTMLElement | null = null;

// 타이머 표시 DOM
let timerDisplayEl: HTMLElement | null = null;

// 컨트롤 패널 컨테이너 DOM
let ctrlPanelEl: HTMLElement | null = null;

// 턴 팝업 표시
function showTurnPopup() {
  clearUI();

  let turnTxt = AppHelper.createUIElement(
    "div",
    "turnTxt",
    {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "120px",
      fontWeight: "bold",
      color: "#FFF",
      textShadow: "0 0 40px #99FF00",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      textAlign: "center",
      whiteSpace: "pre-line",
    },
    `${playerNames[currentTurnIndex]}\n${textData.turnTitle}`,
  );

  uiLayer.appendChild(turnTxt);

  gsap.fromTo(
    turnTxt,
    { scale: 0, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: "back.out(1.5)",
      onComplete: () => {
        setTimeout(() => {
          gsap.to(turnTxt, {
            scale: 0,
            opacity: 0,
            duration: 0.5,
            onComplete: () => {
              turnTxt.remove();
              showGoPopup();
            },
          });
        }, 1000);
      },
    },
  );
}

// 플레이어 입력 필드 렌더링
function renderPlayerInputs() {
  let list = document.getElementById("playerList");
  if (!list) return;

  let currentInputs = list.querySelectorAll("input");
  let savedValues: string[] = [];
  currentInputs.forEach((inp) => savedValues.push(inp.value));

  list.replaceChildren();
  for (let i = 0; i < selectedPlayerCount; i++) {
    let val = i < savedValues.length ? savedValues[i] : `${i + 1}번`;
    let inp = AppHelper.createUIElement("input", `playerInp_${i}`, {
      width: "100%",
      height: "80px",
      fontSize: "40px",
      textAlign: "center",
      borderRadius: "15px",
      border: "none",
      fontFamily: "sans-serif",
      boxSizing: "border-box",
      flexShrink: "0",
    });
    (inp as HTMLInputElement).value = val;
    list.appendChild(inp);
  }
}

// 인원수 업데이트
function updatePlayerCount(delta: number) {
  let newCount = selectedPlayerCount + delta;
  if (newCount >= 2 && newCount <= 8) {
    selectedPlayerCount = newCount;
    let countText = document.getElementById("countText");
    if (countText) {
      countText.innerText = `${textData.playerCountLabel} ${selectedPlayerCount}`;
    }
    renderPlayerInputs();
  }
}

// UI 초기화 헬퍼
function clearUI() {
  uiLayer.replaceChildren();
  sumDisplayEl = null;
  btnPlusEl = null;
  btnMinusEl = null;
  timerDisplayEl = null;
  ctrlPanelEl = null;
}

// 인트로 UI 설정
function setupIntroUI() {
  clearUI();

  let introForm = AppHelper.createUIElement("div", "introForm", {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    gap: "30px",
    alignItems: "center",
    width: "80%",
    padding: "40px",
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: "30px",
    boxSizing: "border-box",
    pointerEvents: "auto",
  });

  let title = AppHelper.createUIElement(
    "div",
    "introTitle",
    {
      fontSize: "90px",
      color: "#99FF00",
      fontWeight: "bold",
      textAlign: "center",
      fontFamily: "sans-serif",
    },
    textData.title,
  );

  let countContainer = AppHelper.createUIElement("div", "countContainer", {
    display: "flex",
    gap: "30px",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  });

  let countMinus = AppHelper.createUIElement(
    "button",
    "countMinus",
    {
      width: "80px",
      height: "80px",
      fontSize: "50px",
      backgroundColor: "#FF5555",
      color: "#FFF",
      border: "none",
      borderRadius: "15px",
      cursor: "pointer",
      fontWeight: "bold",
    },
    "-",
    [{ event: "click", handler: () => updatePlayerCount(-1) }],
  );

  let countText = AppHelper.createUIElement(
    "div",
    "countText",
    {
      fontSize: "50px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
    },
    `${textData.playerCountLabel} ${selectedPlayerCount}`,
  );

  let countPlus = AppHelper.createUIElement(
    "button",
    "countPlus",
    {
      width: "80px",
      height: "80px",
      fontSize: "50px",
      backgroundColor: "#55FF55",
      color: "#000",
      border: "none",
      borderRadius: "15px",
      cursor: "pointer",
      fontWeight: "bold",
    },
    "+",
    [{ event: "click", handler: () => updatePlayerCount(1) }],
  );

  countContainer.appendChild(countMinus);
  countContainer.appendChild(countText);
  countContainer.appendChild(countPlus);

  let playerList = AppHelper.createUIElement("div", "playerList", {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    width: "100%",
    maxHeight: "450px",
    overflowY: "auto",
    padding: "10px",
    boxSizing: "border-box",
  });

  let startBtn = AppHelper.createUIElement(
    "button",
    "startBtn",
    {
      width: "100%",
      height: "120px",
      fontSize: "60px",
      backgroundColor: "#99FF00",
      color: "#000",
      border: "none",
      borderRadius: "20px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "sans-serif",
      marginTop: "10px",
    },
    textData.startBtn,
    [{ event: "click", handler: onStartClick }],
  );

  introForm.appendChild(title);
  introForm.appendChild(countContainer);
  introForm.appendChild(playerList);
  introForm.appendChild(startBtn);

  uiLayer.appendChild(introForm);

  renderPlayerInputs();
}

// 시작 버튼 클릭 이벤트
function onStartClick() {
  if (!soundsInitialized) {
    assetList.sounds.forEach((snd) => {
      sounds[snd.id] = new Howl({
        src: [snd.file_path],
        loop: snd.isBackgroundMusic,
        volume: snd.volume,
      });
    });
    soundsInitialized = true;
  }

  sounds["click"]?.play();

  playerNames = [];
  for (let i = 0; i < selectedPlayerCount; i++) {
    let inp = document.getElementById(`playerInp_${i}`) as HTMLInputElement;
    let name = inp ? inp.value.trim() : `${i + 1}번`;
    if (!name) name = `${i + 1}번`;
    playerNames.push(name);
  }

  currentTurnIndex = 0;
  players = [];

  let btn = document.getElementById("startBtn");
  if (btn) {
    gsap.to(btn, { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1, onComplete: showTurnPopup });
  }
}

// 고 팝업 표시
function showGoPopup() {
  clearUI();
  sounds["pop"]?.play();

  let goTxt = AppHelper.createUIElement(
    "div",
    "goTxt",
    {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "200px",
      fontWeight: "bold",
      color: "#FFF",
      textShadow: "0 0 40px #99FF00",
      fontFamily: "sans-serif",
      pointerEvents: "none",
    },
    textData.go,
  );
  uiLayer.appendChild(goTxt);

  let flash = AppHelper.createUIElement("div", "flash", {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "#FFF",
    zIndex: "10",
    pointerEvents: "none",
  });
  uiLayer.appendChild(flash);

  gsap.to(flash, {
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    onComplete: () => {
      flash.remove();
      goTxt.remove();
      startGame();
    },
  });
}

// 게임 시작
function startGame() {
  gameState = "PLAY";
  timeLeft = appData.gameTime;
  scoreModifier = 0;
  balls = [];
  particles = [];
  isShaking = false;

  for (let i = 1; i <= appData.ballCount; i++) {
    let bx = logicalWidth / 2 + (Math.random() - 0.5) * 400;
    let by = logicalHeight * 0.4 + (Math.random() - 0.5) * 400;
    balls.push(new Ball(i, i, bx, by));
  }

  setupPlayUI();
  sounds["bgm"]?.play();
}

// 플레이 화면 UI 설정
function setupPlayUI() {
  clearUI();

  let topPanel = AppHelper.createUIElement("div", "topPanel", {
    position: "absolute",
    top: "5%",
    left: "5%",
    width: "90%",
    display: "flex",
    justifyContent: "space-between",
    pointerEvents: "none",
    boxSizing: "border-box",
  });

  timerDisplayEl = AppHelper.createUIElement(
    "div",
    "timerDisplay",
    {
      fontSize: "80px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      transition: "color 0.2s",
    },
    Math.ceil(timeLeft).toString(),
  );

  let targetDisplay = AppHelper.createUIElement(
    "div",
    "targetDisplay",
    {
      fontSize: "80px",
      color: "#99FF00",
      fontWeight: "bold",
      fontFamily: "sans-serif",
    },
    textData.targetLabel,
  );

  topPanel.appendChild(timerDisplayEl);
  topPanel.appendChild(targetDisplay);
  uiLayer.appendChild(topPanel);

  ctrlPanelEl = AppHelper.createUIElement("div", "ctrlPanel", {
    position: "absolute",
    bottom: "5%",
    left: "5%",
    width: "90%",
    height: "15%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "40px",
    padding: "0 40px",
    boxSizing: "border-box",
    pointerEvents: "none",
    transition: "box-shadow 0.3s",
  });

  btnMinusEl = AppHelper.createUIElement(
    "button",
    "btnMinus",
    {
      width: "200px",
      height: "150px",
      backgroundColor: "#0000FF",
      color: "#FFF",
      fontSize: "100px",
      border: "none",
      borderRadius: "30px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      opacity: "0.3",
      cursor: "pointer",
    },
    "-",
    [{ event: "click", handler: onMinusClick }],
  );

  sumDisplayEl = AppHelper.createUIElement(
    "div",
    "sumDisplay",
    {
      fontSize: "70px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      textAlign: "center",
    },
    textData.emptySlotMsg,
  );

  btnPlusEl = AppHelper.createUIElement(
    "button",
    "btnPlus",
    {
      width: "200px",
      height: "150px",
      backgroundColor: "#FFA500",
      color: "#FFF",
      fontSize: "100px",
      border: "none",
      borderRadius: "30px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      opacity: "0.3",
      cursor: "pointer",
    },
    "+",
    [{ event: "click", handler: onPlusClick }],
  );

  ctrlPanelEl.appendChild(btnMinusEl);
  ctrlPanelEl.appendChild(sumDisplayEl);
  ctrlPanelEl.appendChild(btnPlusEl);

  uiLayer.appendChild(ctrlPanelEl);
}

// 메인 루프 업데이트
function update(timestamp: number) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (gameState === "PLAY") {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      timeUp();
    }

    if (timerDisplayEl) {
      let sec = Math.ceil(timeLeft);
      timerDisplayEl.innerText = sec.toString();
      if (sec <= 10) {
        timerDisplayEl.style.color = "#FF0000";
        if (Math.floor(timeLeft * 10) % 2 === 0) {
          timerDisplayEl.style.opacity = "0.3";
        } else {
          timerDisplayEl.style.opacity = "1";
        }
      } else {
        timerDisplayEl.style.color = "#FFF";
        timerDisplayEl.style.opacity = "1";
      }
    }

    balls.forEach((b) => {
      if (b.state === "FLOAT") {
        b.x += b.vx;
        b.y += b.vy;
        let minX = BALL_RADIUS;
        let maxX = logicalWidth - BALL_RADIUS;
        let minY = logicalHeight * 0.15 + BALL_RADIUS;
        let maxY = logicalHeight * 0.6 - BALL_RADIUS;

        if (b.x < minX) {
          b.x = minX;
          b.vx *= -1;
        }
        if (b.x > maxX) {
          b.x = maxX;
          b.vx *= -1;
        }
        if (b.y < minY) {
          b.y = minY;
          b.vy *= -1;
        }
        if (b.y > maxY) {
          b.y = maxY;
          b.vy *= -1;
        }
      }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  render();
  requestAnimationFrame(update);
}

// 화면 렌더링
function render() {
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  if (gameState === "PLAY" || gameState === "TIMEUP") {
    SLOTS.forEach((slot) => {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });

    balls.forEach((b) => {
      ctx.fillStyle = "#99FF00";
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      if (b.state === "SLOT") {
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 8;
        ctx.stroke();
      }

      ctx.fillStyle = "#000";
      ctx.font = "bold 60px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.num.toString(), b.x, b.y);
    });

    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }
}

// 터치 입력 핸들러
function onPointerDown(e: PointerEvent) {
  if (gameState !== "PLAY") return;
  let pos = AppHelper.getRelativeCoordinates(e.clientX, e.clientY, appCanvas);

  for (let i = balls.length - 1; i >= 0; i--) {
    let b = balls[i];
    let dx = b.x - pos.x;
    let dy = b.y - pos.y;

    if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
      if (b.state === "FLOAT") {
        let emptySlot = -1;
        for (let s = 0; s < 3; s++) {
          if (!balls.some((bx) => bx.slotIndex === s)) {
            emptySlot = s;
            break;
          }
        }
        if (emptySlot !== -1) {
          b.state = "MOVE";
          b.slotIndex = emptySlot;
          createParticles(b.x, b.y, "#99FF00");
          sounds["pop"]?.play();

          gsap.to(b, {
            x: SLOTS[emptySlot].x,
            y: SLOTS[emptySlot].y,
            duration: 0.5,
            ease: "back.out(1.5)",
            onComplete: () => {
              b.state = "SLOT";
              calculateSum();
            },
          });
        }
      } else if (b.state === "SLOT") {
        b.state = "FLOAT";
        b.slotIndex = -1;
        scoreModifier = 0;
        gsap.killTweensOf(b);
        sounds["click"]?.play();

        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 2 + 1;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        calculateSum();
      }
      break;
    }
  }
}

// 합계 계산 및 UI 업데이트
function calculateSum(): number {
  let sum = 0;
  let slotCount = 0;
  for (let i = 0; i < 3; i++) {
    let b = balls.find((bx) => bx.slotIndex === i);
    if (b) {
      sum += b.num;
      slotCount++;
    }
  }
  let total = sum + scoreModifier;

  if (slotCount === 3) {
    if (btnPlusEl && btnMinusEl && sumDisplayEl && ctrlPanelEl) {
      btnPlusEl.style.opacity = "1";
      btnMinusEl.style.opacity = "1";
      btnPlusEl.style.pointerEvents = "auto";
      btnMinusEl.style.pointerEvents = "auto";
      ctrlPanelEl.style.boxShadow = "0 0 30px #99FF00";
      sumDisplayEl.innerText = textData.sumLabel + " " + total;

      let diff = Math.abs(total - appData.targetScore);
      if (diff <= 1) {
        if (!isShaking) {
          isShaking = true;
          gsap.to(sumDisplayEl, { x: "+=10", yoyo: true, repeat: -1, duration: 0.05 });
        }
      } else {
        if (isShaking) {
          isShaking = false;
          gsap.killTweensOf(sumDisplayEl);
          gsap.set(sumDisplayEl, { x: 0 });
        }
      }
    }
  } else {
    if (btnPlusEl && btnMinusEl && sumDisplayEl && ctrlPanelEl) {
      btnPlusEl.style.opacity = "0.3";
      btnMinusEl.style.opacity = "0.3";
      btnPlusEl.style.pointerEvents = "none";
      btnMinusEl.style.pointerEvents = "none";
      ctrlPanelEl.style.boxShadow = "none";
      sumDisplayEl.innerText = textData.emptySlotMsg;

      if (isShaking) {
        isShaking = false;
        gsap.killTweensOf(sumDisplayEl);
        gsap.set(sumDisplayEl, { x: 0 });
      }
    }
  }
  return total;
}

// 마이너스 버튼 핸들러
function onMinusClick(e: Event) {
  scoreModifier--;
  sounds["click"]?.play();
  if (btnMinusEl) {
    gsap.to(btnMinusEl, { scale: 0.9, yoyo: true, repeat: 1, duration: 0.1 });
    let rect = btnMinusEl.getBoundingClientRect();
    let btnPos = AppHelper.getRelativeCoordinates(rect.left + rect.width / 2, rect.top, appCanvas);
    showFloatingText(-1, btnPos.x, btnPos.y);
  }
  calculateSum();
}

// 플러스 버튼 핸들러
function onPlusClick(e: Event) {
  scoreModifier++;
  sounds["click"]?.play();
  if (btnPlusEl) {
    gsap.to(btnPlusEl, { scale: 0.9, yoyo: true, repeat: 1, duration: 0.1 });
    let rect = btnPlusEl.getBoundingClientRect();
    let btnPos = AppHelper.getRelativeCoordinates(rect.left + rect.width / 2, rect.top, appCanvas);
    showFloatingText(1, btnPos.x, btnPos.y);
  }
  calculateSum();
}

// 증감 플로팅 텍스트
function showFloatingText(val: number, x: number, y: number) {
  let txt = AppHelper.createUIElement(
    "div",
    "",
    {
      position: "absolute",
      left: (x / logicalWidth) * 100 + "%",
      top: (y / logicalHeight) * 100 + "%",
      fontSize: "100px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      color: val > 0 ? "#FFA500" : "#0000FF",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "20",
    },
    val > 0 ? `+${val}` : `${val}`,
  );
  uiLayer.appendChild(txt);

  gsap.to(txt, { y: "-=150", opacity: 0, duration: 1, ease: "power1.out", onComplete: () => txt.remove() });
}

// 파티클 생성기
function createParticles(x: number, y: number, color: string) {
  for (let i = 0; i < 30; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// 시간 종료 처리
function timeUp() {
  gameState = "TIMEUP";
  sounds["bgm"]?.stop();
  sounds["timeup"]?.play();

  let finalTotal = calculateSum();
  let diff = Math.abs(finalTotal - appData.targetScore);

  players.push({
    name: playerNames[currentTurnIndex],
    score: finalTotal,
    diff: diff,
  });

  let tUp = AppHelper.createUIElement(
    "div",
    "timeUpTxt",
    {
      position: "absolute",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "150px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      color: "#FF0000",
      textShadow: "0 0 30px #FFF",
      pointerEvents: "none",
      textAlign: "center",
      width: "100%",
    },
    textData.timeUp,
  );
  uiLayer.appendChild(tUp);

  gsap.from(tUp, { scale: 0, rotation: 15, duration: 1, ease: "elastic.out(1, 0.4)" });

  setTimeout(() => {
    tUp.remove();
    currentTurnIndex++;
    if (currentTurnIndex < selectedPlayerCount) {
      showTurnPopup();
    } else {
      showResult();
    }
  }, 3000);
}

// 결과 화면 표시
function showResult() {
  gameState = "RESULT";
  clearUI();

  let container = AppHelper.createUIElement("div", "resultContainer", {
    position: "absolute",
    top: "10%",
    left: "10%",
    width: "80%",
    height: "80%",
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: "40px",
    padding: "50px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxSizing: "border-box",
    pointerEvents: "auto",
  });

  let title = AppHelper.createUIElement(
    "div",
    "",
    {
      fontSize: "80px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      marginBottom: "50px",
    },
    textData.rankTitle,
  );
  container.appendChild(title);

  let listDiv = AppHelper.createUIElement("div", "", {
    width: "100%",
    flex: "1",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "30px",
    marginBottom: "50px",
  });

  let sorted = [...players].sort((a, b) => a.diff - b.diff);

  sorted.forEach((p, idx) => {
    let item = AppHelper.createUIElement("div", "", {
      width: "100%",
      padding: "30px",
      backgroundColor: idx === 0 ? "rgba(153,255,0,0.3)" : "rgba(255,255,255,0.1)",
      borderRadius: "20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: idx === 0 ? "5px solid #99FF00" : "none",
      boxSizing: "border-box",
    });

    let info = AppHelper.createUIElement(
      "span",
      "",
      { fontSize: "45px", color: "#FFF", fontFamily: "sans-serif" },
      `${idx + 1}. ${p.name}`,
    );
    let score = AppHelper.createUIElement(
      "span",
      "",
      { fontSize: "45px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif" },
      `${p.score} (${textData.diffLabel}: ${p.diff})`,
    );

    item.appendChild(info);
    item.appendChild(score);
    listDiv.appendChild(item);
  });

  container.appendChild(listDiv);

  let retryBtn = AppHelper.createUIElement(
    "button",
    "retryBtn",
    {
      width: "80%",
      height: "120px",
      fontSize: "60px",
      backgroundColor: "#99FF00",
      color: "#000",
      border: "none",
      borderRadius: "20px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      cursor: "pointer",
    },
    textData.retryBtn,
    [{ event: "click", handler: resetToIntro }],
  );

  container.appendChild(retryBtn);
  uiLayer.appendChild(container);

  gsap.from(listDiv.children, { y: 100, opacity: 0, stagger: 0.1, duration: 0.5 });

  sounds["cheer"]?.play();
  confetti({
    particleCount: 200,
    spread: 160,
    origin: { y: 0.2 },
    zIndex: 9999,
    colors: ["#99FF00", "#FFA500", "#0000FF", "#FFF"],
  });
}

// 인트로 상태로 리셋
function resetToIntro() {
  sounds["cheer"]?.stop();
  setupIntroUI();
  gameState = "INTRO";
}

// 초기화 함수
async function initApp() {
  appData = await AppHelper.loadAppData<IAppData>();
  textData = await AppHelper.loadTextData<ITextData>();
  assetList = await AppHelper.loadAssetList<IAssetList>();

  appCanvas = document.getElementById("appCanvas") as HTMLCanvasElement;
  uiLayer = document.getElementById("uiLayer") as HTMLElement;

  appCanvas.width = logicalWidth;
  appCanvas.height = logicalHeight;
  ctx = appCanvas.getContext("2d") as CanvasRenderingContext2D;

  appCanvas.addEventListener("pointerdown", onPointerDown);

  setupIntroUI();
  requestAnimationFrame(update);
}

// export section

export { initApp };
