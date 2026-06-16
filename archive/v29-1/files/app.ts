// import section

import { AppHelper } from "./appHelper";
import { Howl } from "howler";
import { gsap } from "gsap";
import confetti from "canvas-confetti";

// declaration section

// 앱 데이터 인터페이스
interface IAppData {
  gameTime: number;
  targetScore: number;
  ballCount: number;
  cancel_delay_time: number;
}

// 텍스트 데이터 인터페이스
interface ITextData {
  title: string;
  roundCountLabel: string;
  turnTitle: string;
  startBtn: string;
  go: string;
  timeUp: string;
  sumLabel: string;
  targetLabel: string;
  emptySlotMsg: string;
  retryBtn: string;
  rankTitle: string;
  diffLabel: string;
  stopBtn: string;
  turnEnd: string;
  leftTeam: string;
  rightTeam: string;
  vsLabel: string;
  timeLabel: string;
  nextRoundBtn: string;
  rankMidTitle: string;
  selectPlayerTitle: string;
  selectBtn: string;
  selectPlayerMsg: string;
}

// 에셋 리스트 인터페이스
interface IAssetList {
  images: any[];
  sounds: any[];
}

// 플레이어 인터페이스
interface IPlayer {
  name: string;
  score: number;
  diff: number;
  timeLeft: number;
  team: "L" | "R";
}

// 현재 출전 플레이어 R
let activePlayerR: string = "";

// 현재 출전 플레이어 L
let activePlayerL: string = "";

// 남은 플레이어 R
let remainingPlayersR: string[] = [];

// 남은 플레이어 L
let remainingPlayersL: string[] = [];

// 논리 해상도
let logicalWidth = 1920;

let logicalHeight = 1080;

// 앱 변수
let appData: IAppData;

let textData: ITextData;

let assetList: IAssetList;

let appCanvas: HTMLCanvasElement;

let ctx: CanvasRenderingContext2D;

let uiLayer: HTMLElement;

// 전역 상태
let lastTime = 0;

let globalTime = 0;

let gameState: "INTRO" | "PLAY" | "TIMEUP" | "RESULT" = "INTRO";

let timeLeft = 90;

let soundsInitialized = false;

let sounds: { [key: string]: Howl } = {};

// 라운드 및 플레이어 정보
let selectedRoundCount = 1;

let currentRoundIndex = 0;

let playerNamesL: string[] = [];

let playerNamesR: string[] = [];

let players: IPlayer[] = [];

// 플레이어 상태
let leftStopped = false;

let rightStopped = false;

let leftTimeLeft = 0;

let rightTimeLeft = 0;

let scoreModifierL = 0;

let scoreModifierR = 0;

// 공 클래스
class Ball {
  id: number;

  num: number;

  x: number;

  y: number;

  vx: number;

  vy: number;

  state: "FLOAT" | "MOVE" | "SLOT";

  slotIndex: number;

  cancelTimer: number;

  team: "L" | "R";

  constructor(id: number, num: number, x: number, y: number, team: "L" | "R") {
    this.id = id;
    this.num = num;
    this.x = x;
    this.y = y;
    this.team = team;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 2 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.state = "FLOAT";
    this.slotIndex = -1;
    this.cancelTimer = 0;
  }
}

// 공 객체들
let balls: Ball[] = [];

// 파티클 클래스
class Particle {
  x: number;

  y: number;

  vx: number;

  vy: number;

  life: number;

  maxLife: number;

  color: string;

  size: number;

  friction: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.color = color;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 15 + 5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = Math.random() * 0.5 + 0.5;
    this.maxLife = this.life;
    this.size = Math.random() * 12 + 6;
    this.friction = 0.92;
  }
}

let particles: Particle[] = [];

// 효과 관련
let BALL_RADIUS = 55;

// 링 파티클 클래스
class RingParticle {
  x: number;

  y: number;

  radius: number;

  maxRadius: number;

  life: number;

  color: string;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.radius = BALL_RADIUS;
    this.maxRadius = BALL_RADIUS * 2.5;
    this.life = 1.0;
    this.color = color;
  }
}

let ringParticles: RingParticle[] = [];

let shakeOffsetL = { x: 0 };

let shakeOffsetR = { x: 0 };

let isShakingL = false;

let isShakingR = false;

// 슬롯 좌표
let SLOTS_L = [
  { x: 330, y: 780 },
  { x: 480, y: 780 },
  { x: 630, y: 780 },
];

// 우측 슬롯 좌표
let SLOTS_R = [
  { x: 1290, y: 780 },
  { x: 1440, y: 780 },
  { x: 1590, y: 780 },
];

// UI DOM 요소
let sumDisplayL: HTMLElement | null = null;

let btnPlusL: HTMLElement | null = null;

let btnMinusL: HTMLElement | null = null;

let btnStopL: HTMLElement | null = null;

let ctrlPanelL: HTMLElement | null = null;

let sumDisplayR: HTMLElement | null = null;

let btnPlusR: HTMLElement | null = null;

let btnMinusR: HTMLElement | null = null;

let btnStopR: HTMLElement | null = null;

let ctrlPanelR: HTMLElement | null = null;

let timerDisplayEl: HTMLElement | null = null;

// 선수 선택 팝업
function showPlayerSelectionPopup() {
  clearUI();

  let tempSelL = -1;
  let tempSelR = -1;

  let container = AppHelper.createUIElement("div", "selContainer", {
    position: "absolute",
    top: "10%",
    left: "10%",
    width: "80%",
    height: "80%",
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: "40px",
    padding: "40px",
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
      fontSize: "60px",
      color: "#99FF00",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      marginBottom: "20px",
    },
    `ROUND ${currentRoundIndex + 1} - ${textData.selectPlayerTitle}`,
  );
  container.appendChild(title);

  let msg = AppHelper.createUIElement(
    "div",
    "",
    {
      fontSize: "30px",
      color: "#FFF",
      marginBottom: "40px",
      fontFamily: "sans-serif",
    },
    textData.selectPlayerMsg,
  );
  container.appendChild(msg);

  let listsDiv = AppHelper.createUIElement("div", "", {
    display: "flex",
    width: "100%",
    flex: "1",
    gap: "40px",
    overflowY: "auto",
  });

  let leftCol = AppHelper.createUIElement("div", "", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    overflowY: "auto",
    paddingRight: "10px",
  });
  let rightCol = AppHelper.createUIElement("div", "", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    overflowY: "auto",
    paddingRight: "10px",
  });

  let leftTitle = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "40px", color: "#FFF", textAlign: "center", fontWeight: "bold", flexShrink: "0" },
    textData.leftTeam,
  );
  leftCol.appendChild(leftTitle);

  let rightTitle = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "40px", color: "#FFF", textAlign: "center", fontWeight: "bold", flexShrink: "0" },
    textData.rightTeam,
  );
  rightCol.appendChild(rightTitle);

  let leftBtns: HTMLElement[] = [];
  let rightBtns: HTMLElement[] = [];

  const checkReady = () => {
    if (tempSelL !== -1 && tempSelR !== -1) {
      startBtn.style.opacity = "1";
      startBtn.style.pointerEvents = "auto";
    } else {
      startBtn.style.opacity = "0.5";
      startBtn.style.pointerEvents = "none";
    }
  };

  remainingPlayersL.forEach((pName, idx) => {
    let btn = AppHelper.createUIElement(
      "button",
      "",
      {
        width: "100%",
        minHeight: "80px",
        fontSize: "35px",
        backgroundColor: "rgba(0,128,255,0.3)",
        color: "#FFF",
        border: "3px solid transparent",
        borderRadius: "15px",
        cursor: "pointer",
        fontWeight: "bold",
        fontFamily: "sans-serif",
        flexShrink: "0",
      },
      pName,
      [
        {
          event: "click",
          handler: () => {
            sounds["click"]?.play();
            tempSelL = idx;
            leftBtns.forEach((b, i) => {
              b.style.backgroundColor = i === idx ? "rgba(0,128,255,0.8)" : "rgba(0,128,255,0.3)";
              b.style.borderColor = i === idx ? "#FFF" : "transparent";
            });
            checkReady();
          },
        },
      ],
    );
    leftBtns.push(btn);
    leftCol.appendChild(btn);
  });

  remainingPlayersR.forEach((pName, idx) => {
    let btn = AppHelper.createUIElement(
      "button",
      "",
      {
        width: "100%",
        minHeight: "80px",
        fontSize: "35px",
        backgroundColor: "rgba(255,64,64,0.3)",
        color: "#FFF",
        border: "3px solid transparent",
        borderRadius: "15px",
        cursor: "pointer",
        fontWeight: "bold",
        fontFamily: "sans-serif",
        flexShrink: "0",
      },
      pName,
      [
        {
          event: "click",
          handler: () => {
            sounds["click"]?.play();
            tempSelR = idx;
            rightBtns.forEach((b, i) => {
              b.style.backgroundColor = i === idx ? "rgba(255,64,64,0.8)" : "rgba(255,64,64,0.3)";
              b.style.borderColor = i === idx ? "#FFF" : "transparent";
            });
            checkReady();
          },
        },
      ],
    );
    rightBtns.push(btn);
    rightCol.appendChild(btn);
  });

  listsDiv.appendChild(leftCol);
  listsDiv.appendChild(rightCol);
  container.appendChild(listsDiv);

  let startBtn = AppHelper.createUIElement(
    "button",
    "",
    {
      width: "400px",
      height: "90px",
      fontSize: "45px",
      backgroundColor: "#99FF00",
      color: "#000",
      border: "none",
      borderRadius: "20px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "sans-serif",
      opacity: "0.5",
      pointerEvents: "none",
      marginTop: "20px",
      flexShrink: "0",
    },
    textData.selectBtn,
    [
      {
        event: "click",
        handler: () => {
          sounds["click"]?.play();
          activePlayerL = remainingPlayersL[tempSelL];
          activePlayerR = remainingPlayersR[tempSelR];
          remainingPlayersL.splice(tempSelL, 1);
          remainingPlayersR.splice(tempSelR, 1);
          gsap.to(container, {
            opacity: 0,
            scale: 0.8,
            duration: 0.3,
            onComplete: () => {
              container.remove();
              showTurnPopup();
            },
          });
        },
      },
    ],
  );

  container.appendChild(startBtn);
  uiLayer.appendChild(container);

  gsap.from(container, { opacity: 0, scale: 1.1, duration: 0.4, ease: "back.out(1.2)" });
}

// 랭킹 화면 표시 (중간 및 최종)
function showRanking(isFinal: boolean) {
  gameState = "RESULT";
  clearUI();

  let container = AppHelper.createUIElement("div", "resultContainer", {
    position: "absolute",
    top: "5%",
    left: "10%",
    width: "80%",
    height: "90%",
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: "40px",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxSizing: "border-box",
    pointerEvents: "auto",
  });

  let titleText = isFinal ? textData.rankTitle : `${currentRoundIndex + 1} ${textData.rankMidTitle}`;
  let title = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "70px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif", marginBottom: "30px" },
    titleText,
  );
  container.appendChild(title);

  let listDiv = AppHelper.createUIElement("div", "", {
    width: "100%",
    flex: "1",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginBottom: "30px",
    paddingTop: "50px",
    paddingBottom: "50px",
    paddingLeft: "20px",
    paddingRight: "20px",
    position: "relative",
  });

  let newPlayers = players.slice(-2);
  let oldPlayers = players.slice(0, -2);

  let sortedAll = [...players].sort((a, b) => {
    if (a.diff !== b.diff) return a.diff - b.diff;
    return b.timeLeft - a.timeLeft;
  });

  let oldSorted = [...oldPlayers].sort((a, b) => {
    if (a.diff !== b.diff) return a.diff - b.diff;
    return b.timeLeft - a.timeLeft;
  });

  let oldYPositions = new Map<any, number>();

  const createItem = (p: any, idx: number, isTop: boolean) => {
    let tName = p.team === "L" ? textData.leftTeam : textData.rightTeam;
    let item = AppHelper.createUIElement("div", "", {
      width: "87.5%",
      margin: "0 auto",
      padding: "20px 30px",
      backgroundColor: isTop ? "rgba(255,215,0,0.3)" : p.team === "L" ? "rgba(0,128,255,0.15)" : "rgba(255,64,64,0.15)",
      borderRadius: "15px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: isTop ? "4px solid #FFD700" : "none",
      boxSizing: "border-box",
      flexShrink: "0",
      boxShadow: isTop ? "0 0 15px rgba(255,215,0,0.5)" : "none",
      transformOrigin: "center center",
    });

    let leftInfo = AppHelper.createUIElement("div", "", {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontFamily: "sans-serif",
      fontWeight: "bold",
    });
    let rankLabel = isTop ? "👑 1위." : `${idx + 1}위.`;
    let leftText = AppHelper.createUIElement(
      "span",
      "",
      {
        fontSize: "35px",
        color: isTop ? "#FFD700" : "#FFF",
        textShadow: isTop ? "0 0 10px rgba(255,215,0,0.8)" : "none",
      },
      `${rankLabel} ${p.name}`,
    );
    let leftTeam = AppHelper.createUIElement("span", "", { fontSize: "25px", color: "#CCC" }, `(${tName})`);
    leftInfo.appendChild(leftText);
    leftInfo.appendChild(leftTeam);

    let rightInfo = AppHelper.createUIElement("div", "", {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      fontFamily: "sans-serif",
      fontWeight: "bold",
      gap: "5px",
    });
    let rightTop = AppHelper.createUIElement("div", "", { display: "flex", alignItems: "center", gap: "10px" });
    let scoreText = AppHelper.createUIElement(
      "span",
      "",
      { fontSize: "30px", color: isTop ? "#FFD700" : "#FFF" },
      `${textData.sumLabel} ${p.score}`,
    );
    let diffText = AppHelper.createUIElement(
      "span",
      "",
      { fontSize: "30px", color: "#FF5555" },
      `(${textData.diffLabel}: ${p.diff})`,
    );
    rightTop.appendChild(scoreText);
    rightTop.appendChild(diffText);
    let rightBottom = AppHelper.createUIElement(
      "div",
      "",
      { fontSize: "24px", color: "#AAA" },
      `${textData.timeLabel} ${p.timeLeft.toFixed(1)}초`,
    );

    rightInfo.appendChild(rightTop);
    rightInfo.appendChild(rightBottom);

    item.appendChild(leftInfo);
    item.appendChild(rightInfo);
    return item;
  };

  let tempDivs = new Map<any, HTMLElement>();
  oldSorted.forEach((p, idx) => {
    let item = createItem(p, idx, idx === 0);
    listDiv.appendChild(item);
    tempDivs.set(p, item);
  });

  container.appendChild(listDiv);
  uiLayer.appendChild(container);

  listDiv.scrollTop = 0;

  oldSorted.forEach((p) => {
    let el = tempDivs.get(p);
    if (el) {
      oldYPositions.set(p, el.offsetTop);
    }
  });

  listDiv.replaceChildren();

  let finalDivs = new Map<any, HTMLElement>();
  sortedAll.forEach((p, idx) => {
    let item = createItem(p, idx, idx === 0);
    listDiv.appendChild(item);
    finalDivs.set(p, item);
  });

  let btnContainer = AppHelper.createUIElement("div", "", {
    display: "flex",
    width: "100%",
    justifyContent: "center",
    gap: "20px",
  });
  if (isFinal) {
    let retryBtn = AppHelper.createUIElement(
      "button",
      "retryBtn",
      {
        width: "60%",
        height: "90px",
        fontSize: "45px",
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
    btnContainer.appendChild(retryBtn);
  } else {
    let nextBtn = AppHelper.createUIElement(
      "button",
      "nextBtn",
      {
        width: "60%",
        height: "90px",
        fontSize: "45px",
        backgroundColor: "#99FF00",
        color: "#000",
        border: "none",
        borderRadius: "20px",
        fontWeight: "bold",
        fontFamily: "sans-serif",
        cursor: "pointer",
      },
      textData.nextRoundBtn,
      [
        {
          event: "click",
          handler: () => {
            currentRoundIndex++;
            showPlayerSelectionPopup();
          },
        },
      ],
    );
    btnContainer.appendChild(nextBtn);
  }
  container.appendChild(btnContainer);

  let containerHeight = listDiv.clientHeight;

  requestAnimationFrame(() => {
    sortedAll.forEach((p, idx) => {
      let el = finalDivs.get(p);
      if (!el) return;

      let isNew = newPlayers.includes(p);
      if (isNew) {
        gsap.from(el, {
          y: containerHeight,
          opacity: 0,
          duration: 1.5,
          ease: "power3.out",
        });
      } else {
        let oldY = oldYPositions.get(p) || 0;
        let newY = el.offsetTop;
        let deltaY = oldY - newY;

        if (deltaY !== 0) {
          gsap.from(el, {
            y: deltaY,
            duration: 1.5,
            ease: "power3.out",
          });
        }
      }

      // 1위 하이라이트 애니메이션
      if (idx === 0) {
        gsap.to(el, {
          boxShadow: "0 0 30px rgba(255,255,255,0.8), inset 0 0 20px rgba(255,215,0,0.5)",
          borderColor: "#FFFFFF",
          scale: 1.02,
          duration: 0.8,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: 1.5,
        });
      }
    });
  });

  // 파티클 및 사운드 효과
  sounds["cheer"]?.play();

  let topTeam = sortedAll[0]?.team;
  let topColor = topTeam === "L" ? "#0080FF" : "#FF4040";

  if (isFinal) {
    let end = Date.now() + 3 * 1000;
    let colors = ["#FFD700", "#99FF00", topColor, "#FFFFFF"];
    (function frame() {
      confetti({
        particleCount: 15,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 15,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
        zIndex: 9999,
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  } else {
    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.3 },
      zIndex: 9999,
      colors: ["#FFD700", topColor, "#FFFFFF"],
    });
  }
}

// UI 요소 지우기
function clearUI() {
  uiLayer.replaceChildren();
  sumDisplayL = null;
  btnPlusL = null;
  btnMinusL = null;
  btnStopL = null;
  ctrlPanelL = null;

  sumDisplayR = null;
  btnPlusR = null;
  btnMinusR = null;
  btnStopR = null;
  ctrlPanelR = null;

  timerDisplayEl = null;
}

// 플레이어 입력 필드 그리기
function renderPlayerInputs() {
  let listL = document.getElementById("playerListL");
  let listR = document.getElementById("playerListR");
  if (!listL || !listR) return;

  let savedL: string[] = [];
  let savedR: string[] = [];
  listL.querySelectorAll("input").forEach((inp) => savedL.push(inp.value));
  listR.querySelectorAll("input").forEach((inp) => savedR.push(inp.value));

  listL.replaceChildren();
  listR.replaceChildren();

  for (let i = 0; i < selectedRoundCount; i++) {
    let inpL = AppHelper.createUIElement("input", `playerInpL_${i}`, {
      width: "100%",
      height: "60px",
      fontSize: "30px",
      textAlign: "center",
      borderRadius: "10px",
      border: "none",
      fontFamily: "sans-serif",
      boxSizing: "border-box",
      flexShrink: "0",
    });
    (inpL as HTMLInputElement).value = i < savedL.length ? savedL[i] : `L-${i + 1}번`;
    listL.appendChild(inpL);

    let inpR = AppHelper.createUIElement("input", `playerInpR_${i}`, {
      width: "100%",
      height: "60px",
      fontSize: "30px",
      textAlign: "center",
      borderRadius: "10px",
      border: "none",
      fontFamily: "sans-serif",
      boxSizing: "border-box",
      flexShrink: "0",
    });
    (inpR as HTMLInputElement).value = i < savedR.length ? savedR[i] : `R-${i + 1}번`;
    listR.appendChild(inpR);
  }
}

// 라운드 수 업데이트
function updateRoundCount(delta: number) {
  let newCount = selectedRoundCount + delta;
  if (newCount >= 1 && newCount <= 10) {
    selectedRoundCount = newCount;
    let countText = document.getElementById("countText");
    if (countText) countText.innerText = `${textData.roundCountLabel} ${selectedRoundCount}`;
    renderPlayerInputs();
  }
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
    width: "70%",
    padding: "40px",
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: "30px",
    boxSizing: "border-box",
    pointerEvents: "auto",
  });

  let title = AppHelper.createUIElement(
    "div",
    "introTitle",
    {
      fontSize: "70px",
      color: "#99FF00",
      fontWeight: "bold",
      textAlign: "center",
      fontFamily: "sans-serif",
    },
    textData.title,
  );
  introForm.appendChild(title);

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
      width: "70px",
      height: "70px",
      fontSize: "40px",
      backgroundColor: "#FF5555",
      color: "#FFF",
      border: "none",
      borderRadius: "15px",
      cursor: "pointer",
      fontWeight: "bold",
    },
    "-",
    [{ event: "click", handler: () => updateRoundCount(-1) }],
  );

  let countText = AppHelper.createUIElement(
    "div",
    "countText",
    {
      fontSize: "40px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
    },
    `${textData.roundCountLabel} ${selectedRoundCount}`,
  );

  let countPlus = AppHelper.createUIElement(
    "button",
    "countPlus",
    {
      width: "70px",
      height: "70px",
      fontSize: "40px",
      backgroundColor: "#55FF55",
      color: "#000",
      border: "none",
      borderRadius: "15px",
      cursor: "pointer",
      fontWeight: "bold",
    },
    "+",
    [{ event: "click", handler: () => updateRoundCount(1) }],
  );

  countContainer.appendChild(countMinus);
  countContainer.appendChild(countText);
  countContainer.appendChild(countPlus);
  introForm.appendChild(countContainer);

  let listContainer = AppHelper.createUIElement("div", "", {
    display: "flex",
    width: "100%",
    gap: "40px",
    height: "350px",
    boxSizing: "border-box",
  });

  let leftCol = AppHelper.createUIElement("div", "", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });
  let leftLabel = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "30px", color: "#FFF", fontWeight: "bold", textAlign: "center", fontFamily: "sans-serif" },
    textData.leftTeam,
  );
  let playerListL = AppHelper.createUIElement("div", "playerListL", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    padding: "10px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
  });
  leftCol.appendChild(leftLabel);
  leftCol.appendChild(playerListL);

  let rightCol = AppHelper.createUIElement("div", "", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });
  let rightLabel = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "30px", color: "#FFF", fontWeight: "bold", textAlign: "center", fontFamily: "sans-serif" },
    textData.rightTeam,
  );
  let playerListR = AppHelper.createUIElement("div", "playerListR", {
    flex: "1",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    padding: "10px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
  });
  rightCol.appendChild(rightLabel);
  rightCol.appendChild(playerListR);

  listContainer.appendChild(leftCol);
  listContainer.appendChild(rightCol);
  introForm.appendChild(listContainer);

  let startBtn = AppHelper.createUIElement(
    "button",
    "startBtn",
    {
      width: "100%",
      height: "90px",
      fontSize: "50px",
      backgroundColor: "#99FF00",
      color: "#000",
      border: "none",
      borderRadius: "20px",
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "sans-serif",
    },
    textData.startBtn,
    [{ event: "click", handler: onStartClick }],
  );
  introForm.appendChild(startBtn);

  uiLayer.appendChild(introForm);
  renderPlayerInputs();
}

// 시작 버튼 핸들러
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

  playerNamesL = [];
  playerNamesR = [];
  for (let i = 0; i < selectedRoundCount; i++) {
    let inpL = document.getElementById(`playerInpL_${i}`) as HTMLInputElement;
    let inpR = document.getElementById(`playerInpR_${i}`) as HTMLInputElement;
    playerNamesL.push(inpL ? inpL.value.trim() || `L-${i + 1}` : `L-${i + 1}`);
    playerNamesR.push(inpR ? inpR.value.trim() || `R-${i + 1}` : `R-${i + 1}`);
  }

  remainingPlayersL = [...playerNamesL];
  remainingPlayersR = [...playerNamesR];
  activePlayerL = "";
  activePlayerR = "";

  currentRoundIndex = 0;
  players = [];

  let btn = document.getElementById("startBtn");
  if (btn) {
    gsap.killTweensOf(btn);
    gsap.fromTo(
      btn,
      { scale: 1 },
      { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1, onComplete: showPlayerSelectionPopup },
    );
  }
}

// 턴 팝업 표시
function showTurnPopup() {
  clearUI();

  let text = `${activePlayerL} ${textData.vsLabel} ${activePlayerR}\n[ ${currentRoundIndex + 1} ROUND ]`;
  let turnTxt = AppHelper.createUIElement(
    "div",
    "turnTxt",
    {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "90px",
      fontWeight: "bold",
      color: "#FFF",
      textShadow: "0 0 40px #99FF00",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      textAlign: "center",
      whiteSpace: "pre-line",
      lineHeight: "1.5",
    },
    text,
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
        }, 1500);
      },
    },
  );
}

// GO 팝업 표시
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

  gsap.fromTo(
    goTxt,
    { scale: 0, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      ease: "back.out(1.5)",
      onComplete: () => {
        setTimeout(() => {
          let overlay = AppHelper.createUIElement("div", "fadeOverlay", {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "#FFF",
            zIndex: "100",
            pointerEvents: "none",
            opacity: "0",
          });
          uiLayer.appendChild(overlay);

          gsap.to(overlay, {
            opacity: 1,
            duration: 0.3,
            onComplete: () => {
              goTxt.remove();
              startGame();
              gsap.to(overlay, {
                opacity: 0,
                duration: 1.0,
                ease: "power2.out",
                onComplete: () => overlay.remove(),
              });
            },
          });
        }, 800);
      },
    },
  );
}

// 게임 시작 초기화
function startGame() {
  gameState = "PLAY";
  timeLeft = appData.gameTime;

  leftStopped = false;
  rightStopped = false;
  leftTimeLeft = 0;
  rightTimeLeft = 0;
  scoreModifierL = 0;
  scoreModifierR = 0;

  balls = [];
  particles = [];
  ringParticles = [];
  isShakingL = false;
  isShakingR = false;
  shakeOffsetL.x = 0;
  shakeOffsetR.x = 0;

  for (let i = 1; i <= appData.ballCount; i++) {
    let bxL = 480 + (Math.random() - 0.5) * 400;
    let byL = 400 + (Math.random() - 0.5) * 300;
    balls.push(new Ball(i, i, bxL, byL, "L"));

    let bxR = 1440 + (Math.random() - 0.5) * 400;
    let byR = 400 + (Math.random() - 0.5) * 300;
    balls.push(new Ball(i + 100, i, bxR, byR, "R"));
  }

  setupPlayUI();
  sounds["bgm"]?.play();
}

// 플레이 화면 UI 설정
function setupPlayUI() {
  clearUI();

  // 상단 공통 타이머
  timerDisplayEl = AppHelper.createUIElement(
    "div",
    "timerDisplay",
    {
      position: "absolute",
      top: "4%",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "80px",
      color: "#FFF",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      transition: "color 0.2s",
      pointerEvents: "none",
      zIndex: "10",
      textShadow: "0 0 20px rgba(0,0,0,0.8)",
    },
    Math.ceil(timeLeft).toString(),
  );
  uiLayer.appendChild(timerDisplayEl);

  // 상단 좌측 패널
  let topL = AppHelper.createUIElement("div", "", {
    position: "absolute",
    top: "3%",
    left: "3%",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  });
  let nameL = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "50px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif" },
    activePlayerL,
  );
  let targetL = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "40px", color: "#99FF00", fontWeight: "bold", fontFamily: "sans-serif" },
    textData.targetLabel,
  );
  topL.appendChild(nameL);
  topL.appendChild(targetL);
  uiLayer.appendChild(topL);

  // 상단 우측 패널
  let topR = AppHelper.createUIElement("div", "", {
    position: "absolute",
    top: "3%",
    right: "3%",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px",
  });
  let nameR = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "50px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif" },
    activePlayerR,
  );
  let targetR = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "40px", color: "#99FF00", fontWeight: "bold", fontFamily: "sans-serif" },
    textData.targetLabel,
  );
  topR.appendChild(nameR);
  topR.appendChild(targetR);
  uiLayer.appendChild(topR);

  // 합계 표시 (Left)
  let sumContL = AppHelper.createUIElement("div", "", {
    position: "absolute",
    top: "55%",
    left: "0%",
    width: "50%",
    pointerEvents: "none",
    display: "flex",
    justifyContent: "center",
  });
  sumDisplayL = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "70px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif", textShadow: "0 0 20px #000" },
    textData.emptySlotMsg,
  );
  sumContL.appendChild(sumDisplayL);
  uiLayer.appendChild(sumContL);

  // 합계 표시 (Right)
  let sumContR = AppHelper.createUIElement("div", "", {
    position: "absolute",
    top: "55%",
    left: "50%",
    width: "50%",
    pointerEvents: "none",
    display: "flex",
    justifyContent: "center",
  });
  sumDisplayR = AppHelper.createUIElement(
    "div",
    "",
    { fontSize: "70px", color: "#FFF", fontWeight: "bold", fontFamily: "sans-serif", textShadow: "0 0 20px #000" },
    textData.emptySlotMsg,
  );
  sumContR.appendChild(sumDisplayR);
  uiLayer.appendChild(sumContR);

  // Left Control Panel
  ctrlPanelL = AppHelper.createUIElement("div", "", {
    position: "absolute",
    bottom: "4%",
    left: "5%",
    width: "40%",
    height: "14%",
    display: "flex",
    justifyContent: "space-evenly",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "30px",
    pointerEvents: "none",
    transition: "box-shadow 0.3s",
  });
  btnMinusL = createControlButton("-", "L", () => onModifierClick("L", -1, btnMinusL));
  btnStopL = createStopButton("L", () => onStopClick("L", btnStopL));
  btnPlusL = createControlButton("+", "L", () => onModifierClick("L", 1, btnPlusL));
  ctrlPanelL.appendChild(btnMinusL);
  ctrlPanelL.appendChild(btnStopL);
  ctrlPanelL.appendChild(btnPlusL);
  uiLayer.appendChild(ctrlPanelL);

  // Right Control Panel
  ctrlPanelR = AppHelper.createUIElement("div", "", {
    position: "absolute",
    bottom: "4%",
    left: "55%",
    width: "40%",
    height: "14%",
    display: "flex",
    justifyContent: "space-evenly",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "30px",
    pointerEvents: "none",
    transition: "box-shadow 0.3s",
  });
  btnMinusR = createControlButton("-", "R", () => onModifierClick("R", -1, btnMinusR));
  btnStopR = createStopButton("R", () => onStopClick("R", btnStopR));
  btnPlusR = createControlButton("+", "R", () => onModifierClick("R", 1, btnPlusR));
  ctrlPanelR.appendChild(btnMinusR);
  ctrlPanelR.appendChild(btnStopR);
  ctrlPanelR.appendChild(btnPlusR);
  uiLayer.appendChild(ctrlPanelR);
}

// 컨트롤 패널 버튼 생성 헬퍼
function createControlButton(label: string, team: string, handler: () => void): HTMLElement {
  let isPlus = label === "+";
  let bg = isPlus
    ? "radial-gradient(circle at 30% 30%, #FFCC66, #FFA500 60%, #994C00)"
    : "radial-gradient(circle at 30% 30%, #4D4DFF, #0000FF 60%, #000033)";
  return AppHelper.createUIElement(
    "button",
    `btn${isPlus ? "Plus" : "Minus"}${team}`,
    {
      width: "100px",
      height: "100px",
      background: bg,
      boxShadow: "0 10px 20px rgba(0,0,0,0.5), inset -5px -5px 15px rgba(0,0,0,0.5)",
      color: "#FFF",
      fontSize: "60px",
      border: "none",
      borderRadius: "50%",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      opacity: "0.3",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    label,
    [{ event: "click", handler }],
  );
}

// 스톱 버튼 생성 헬퍼
function createStopButton(team: string, handler: () => void): HTMLElement {
  return AppHelper.createUIElement(
    "button",
    `btnStop${team}`,
    {
      width: "130px",
      height: "130px",
      background: "radial-gradient(circle at 30% 30%, #FF6666, #FF0000 60%, #990000)",
      boxShadow: "0 10px 20px rgba(0,0,0,0.5), inset -5px -5px 15px rgba(0,0,0,0.5)",
      color: "#FFF",
      fontSize: "30px",
      border: "none",
      borderRadius: "50%",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      pointerEvents: "none",
      opacity: "0.3",
      cursor: "pointer",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      textShadow: "0 5px 10px rgba(0,0,0,0.5)",
    },
    textData.stopBtn,
    [{ event: "click", handler }],
  );
}

// 점수 보정치 변경 핸들러
function onModifierClick(team: "L" | "R", val: number, btn: HTMLElement | null) {
  if (gameState !== "PLAY") return;
  sounds["click"]?.play();
  if (team === "L") scoreModifierL += val;
  else scoreModifierR += val;

  if (btn) {
    gsap.killTweensOf(btn);
    gsap.fromTo(btn, { scale: 1 }, { scale: 0.8, yoyo: true, repeat: 1, duration: 0.1 });
    let rect = btn.getBoundingClientRect();
    let btnPos = AppHelper.getRelativeCoordinates(rect.left + rect.width / 2, rect.top, appCanvas);
    showFloatingText(val, btnPos.x, btnPos.y);
  }
  calculateSum();
}

// STOP 버튼 핸들러
function onStopClick(team: "L" | "R", btn: HTMLElement | null) {
  if (gameState !== "PLAY") return;
  sounds["click"]?.play();

  if (btn) {
    gsap.killTweensOf(btn);
    gsap.fromTo(btn, { scale: 1 }, { scale: 0.8, yoyo: true, repeat: 1, duration: 0.1 });
  }

  if (team === "L" && !leftStopped) {
    leftStopped = true;
    leftTimeLeft = timeLeft;
    if (btn) {
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
    if (btnPlusL && btnMinusL) {
      btnPlusL.style.pointerEvents = "none";
      btnMinusL.style.pointerEvents = "none";
    }
    calculateSum();
  } else if (team === "R" && !rightStopped) {
    rightStopped = true;
    rightTimeLeft = timeLeft;
    if (btn) {
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
    }
    if (btnPlusR && btnMinusR) {
      btnPlusR.style.pointerEvents = "none";
      btnMinusR.style.pointerEvents = "none";
    }
    calculateSum();
  }

  if (leftStopped && rightStopped) {
    timeUp(true);
  }
}

// 플로팅 텍스트 표시
function showFloatingText(val: number, x: number, y: number) {
  let txt = AppHelper.createUIElement(
    "div",
    "",
    {
      position: "absolute",
      left: (x / logicalWidth) * 100 + "%",
      top: (y / logicalHeight) * 100 + "%",
      fontSize: "80px",
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

// 점수 계산 및 UI 반영
function calculateSum() {
  let sumL = 0;
  let countL = 0;
  let sumR = 0;
  let countR = 0;

  balls.forEach((b) => {
    if (b.state === "SLOT") {
      if (b.team === "L") {
        sumL += b.num;
        countL++;
      } else {
        sumR += b.num;
        countR++;
      }
    }
  });

  let totalL = sumL + scoreModifierL;
  let totalR = sumR + scoreModifierR;

  // L 갱신
  if (!leftStopped) {
    if (countL === 3) {
      if (btnPlusL && btnMinusL && ctrlPanelL) {
        btnPlusL.style.opacity = "1";
        btnMinusL.style.opacity = "1";
        btnPlusL.style.pointerEvents = "auto";
        btnMinusL.style.pointerEvents = "auto";
        if (btnStopL) {
          btnStopL.style.opacity = "1";
          btnStopL.style.pointerEvents = "auto";
        }
        ctrlPanelL.style.boxShadow = "0 0 30px #99FF00";
      }
      if (sumDisplayL) sumDisplayL.innerText = textData.sumLabel + " " + totalL;

      if (Math.abs(totalL - appData.targetScore) <= 1 && gameState === "PLAY") {
        if (!isShakingL) {
          isShakingL = true;
          gsap.fromTo(shakeOffsetL, { x: -8 }, { x: 8, yoyo: true, repeat: -1, duration: 0.05 });
        }
      } else {
        isShakingL = false;
        gsap.killTweensOf(shakeOffsetL);
        shakeOffsetL.x = 0;
      }
    } else {
      if (btnPlusL && btnMinusL && ctrlPanelL) {
        btnPlusL.style.opacity = "0.3";
        btnMinusL.style.opacity = "0.3";
        btnPlusL.style.pointerEvents = "none";
        btnMinusL.style.pointerEvents = "none";
        if (btnStopL) {
          btnStopL.style.opacity = "0.3";
          btnStopL.style.pointerEvents = "none";
        }
        ctrlPanelL.style.boxShadow = "none";
      }
      if (sumDisplayL) sumDisplayL.innerText = textData.emptySlotMsg;
      isShakingL = false;
      gsap.killTweensOf(shakeOffsetL);
      shakeOffsetL.x = 0;
    }
  }

  // R 갱신
  if (!rightStopped) {
    if (countR === 3) {
      if (btnPlusR && btnMinusR && ctrlPanelR) {
        btnPlusR.style.opacity = "1";
        btnMinusR.style.opacity = "1";
        btnPlusR.style.pointerEvents = "auto";
        btnMinusR.style.pointerEvents = "auto";
        if (btnStopR) {
          btnStopR.style.opacity = "1";
          btnStopR.style.pointerEvents = "auto";
        }
        ctrlPanelR.style.boxShadow = "0 0 30px #99FF00";
      }
      if (sumDisplayR) sumDisplayR.innerText = textData.sumLabel + " " + totalR;

      if (Math.abs(totalR - appData.targetScore) <= 1 && gameState === "PLAY") {
        if (!isShakingR) {
          isShakingR = true;
          gsap.fromTo(shakeOffsetR, { x: -8 }, { x: 8, yoyo: true, repeat: -1, duration: 0.05 });
        }
      } else {
        isShakingR = false;
        gsap.killTweensOf(shakeOffsetR);
        shakeOffsetR.x = 0;
      }
    } else {
      if (btnPlusR && btnMinusR && ctrlPanelR) {
        btnPlusR.style.opacity = "0.3";
        btnMinusR.style.opacity = "0.3";
        btnPlusR.style.pointerEvents = "none";
        btnMinusR.style.pointerEvents = "none";
        if (btnStopR) {
          btnStopR.style.opacity = "0.3";
          btnStopR.style.pointerEvents = "none";
        }
        ctrlPanelR.style.boxShadow = "none";
      }
      if (sumDisplayR) sumDisplayR.innerText = textData.emptySlotMsg;
      isShakingR = false;
      gsap.killTweensOf(shakeOffsetR);
      shakeOffsetR.x = 0;
    }
  }
}

// 타임업 및 라운드 종료
function timeUp(isStopAll: boolean = false) {
  if (gameState !== "PLAY") return;
  gameState = "TIMEUP";
  sounds["bgm"]?.stop();
  sounds["timeup"]?.play();

  if (!leftStopped) leftTimeLeft = 0;
  if (!rightStopped) rightTimeLeft = 0;

  isShakingL = false;
  gsap.killTweensOf(shakeOffsetL);
  shakeOffsetL.x = 0;

  isShakingR = false;
  gsap.killTweensOf(shakeOffsetR);
  shakeOffsetR.x = 0;

  let sumL =
    balls.filter((b) => b.team === "L" && b.state === "SLOT").reduce((acc, b) => acc + b.num, 0) + scoreModifierL;
  let sumR =
    balls.filter((b) => b.team === "R" && b.state === "SLOT").reduce((acc, b) => acc + b.num, 0) + scoreModifierR;

  players.push({
    name: activePlayerL,
    score: sumL,
    diff: Math.abs(sumL - appData.targetScore),
    timeLeft: leftTimeLeft,
    team: "L",
  });
  players.push({
    name: activePlayerR,
    score: sumR,
    diff: Math.abs(sumR - appData.targetScore),
    timeLeft: rightTimeLeft,
    team: "R",
  });

  let tUp = AppHelper.createUIElement(
    "div",
    "timeUpTxt",
    {
      position: "absolute",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "120px",
      fontWeight: "bold",
      fontFamily: "sans-serif",
      color: "#FF0000",
      textShadow: "0 0 40px #FFF",
      pointerEvents: "none",
      textAlign: "center",
      width: "100%",
      zIndex: "50",
    },
    isStopAll ? textData.turnEnd : textData.timeUp,
  );
  uiLayer.appendChild(tUp);

  gsap.from(tUp, { scale: 0, rotation: 10, duration: 1, ease: "elastic.out(1, 0.4)" });

  setTimeout(() => {
    tUp.remove();
    showRanking(currentRoundIndex + 1 === selectedRoundCount);
  }, 3000);
}

// 인트로 리셋
function resetToIntro() {
  sounds["cheer"]?.stop();
  setupIntroUI();
  gameState = "INTRO";
}

// 파티클 생성
function createParticles(x: number, y: number, color: string) {
  let colors = [color, "#FFFFFF", "#CCFF66", "#FFFF99"];
  for (let i = 0; i < 40; i++) {
    particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)]));
  }
}

// 메인 루프 업데이트
function update(timestamp: number) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  globalTime += dt;

  if (gameState === "PLAY") {
    if (!leftStopped || !rightStopped) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        timeUp();
      }
    }

    if (timerDisplayEl) {
      let sec = Math.ceil(timeLeft);
      timerDisplayEl.innerText = sec.toString();
      if (sec <= 10 && timeLeft > 0) {
        timerDisplayEl.style.color = "#FF0000";
        timerDisplayEl.style.opacity = Math.floor(timeLeft * 10) % 2 === 0 ? "0.3" : "1";
      } else {
        timerDisplayEl.style.color = "#FFF";
        timerDisplayEl.style.opacity = "1";
      }
    }

    balls.forEach((b) => {
      if (b.state === "FLOAT") {
        b.x += b.vx;
        b.y += b.vy;

        let minX = b.team === "L" ? BALL_RADIUS : 960 + BALL_RADIUS;
        let maxX = b.team === "L" ? 960 - BALL_RADIUS : logicalWidth - BALL_RADIUS;
        let minY = 180 + BALL_RADIUS;
        let maxY = 600 - BALL_RADIUS;

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

      if (b.state === "SLOT" && b.cancelTimer > 0) {
        b.cancelTimer -= dt;
        if (b.cancelTimer <= 0) {
          b.cancelTimer = 0;
          let offX = b.team === "L" ? shakeOffsetL.x : shakeOffsetR.x;
          createParticles(b.x + offX, b.y, "#FFFFFF");
          ringParticles.push(new RingParticle(b.x + offX, b.y, "#FFFFFF"));
        }
      }
    });

    for (let i = 0; i < balls.length; i++) {
      let b1 = balls[i];
      if (b1.state !== "FLOAT") continue;
      for (let j = i + 1; j < balls.length; j++) {
        let b2 = balls[j];
        if (b2.state !== "FLOAT") continue;
        if (b1.team !== b2.team) continue;

        let dx = b2.x - b1.x;
        let dy = b2.y - b1.y;
        let dist = Math.hypot(dx, dy);
        let minDist = BALL_RADIUS * 2;

        if (dist < minDist && dist > 0) {
          let overlap = minDist - dist;
          let nx = dx / dist;
          let ny = dy / dist;

          b1.x -= (nx * overlap) / 2;
          b1.y -= (ny * overlap) / 2;
          b2.x += (nx * overlap) / 2;
          b2.y += (ny * overlap) / 2;

          let vCollisionX = b2.vx - b1.vx;
          let vCollisionY = b2.vy - b1.vy;
          let relVel = vCollisionX * nx + vCollisionY * ny;

          if (relVel < 0) {
            let impulse = -relVel / 2;
            b1.vx -= impulse * nx;
            b1.vy -= impulse * ny;
            b2.vx += impulse * nx;
            b2.vy += impulse * ny;
          }
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i];
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.015;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = ringParticles.length - 1; i >= 0; i--) {
      let r = ringParticles[i];
      r.radius += (r.maxRadius - r.radius) * 0.1;
      r.life -= 0.04;
      if (r.life <= 0) ringParticles.splice(i, 1);
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

  // 중앙 구분선
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(960, 0);
  ctx.lineTo(960, logicalHeight);
  ctx.stroke();

  if (gameState === "PLAY" || gameState === "TIMEUP") {
    let slotCountL = balls.filter((b) => b.team === "L" && b.state === "SLOT").length;
    let slotCountR = balls.filter((b) => b.team === "R" && b.state === "SLOT").length;

    drawSlotBox(480, 780, slotCountL === 3, shakeOffsetL.x);
    drawSlotBox(1440, 780, slotCountR === 3, shakeOffsetR.x);

    SLOTS_L.forEach((s) => {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(s.x + shakeOffsetL.x, s.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });

    SLOTS_R.forEach((s) => {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(s.x + shakeOffsetR.x, s.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });

    balls.forEach((b) => {
      let rX = b.x;
      if (b.state === "SLOT") {
        rX += b.team === "L" ? shakeOffsetL.x : shakeOffsetR.x;
      }

      let grad = ctx.createRadialGradient(
        rX - BALL_RADIUS * 0.3,
        b.y - BALL_RADIUS * 0.3,
        BALL_RADIUS * 0.1,
        rX,
        b.y,
        BALL_RADIUS,
      );
      if (b.team === "L") {
        grad.addColorStop(0, "#66CCFF");
        grad.addColorStop(0.5, "#0080FF");
        grad.addColorStop(1, "#003366");
      } else {
        grad.addColorStop(0, "#FF9999");
        grad.addColorStop(0.5, "#FF4040");
        grad.addColorStop(1, "#660000");
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rX, b.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      if (b.state === "SLOT" && b.cancelTimer > 0) {
        let ratio = b.cancelTimer / appData.cancel_delay_time;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(rX, b.y, BALL_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.stroke();
      }

      ctx.fillStyle = "#FFF";
      ctx.font = "bold 50px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.num.toString(), rX, b.y);
    });

    ctx.globalCompositeOperation = "lighter";
    ringParticles.forEach((rp) => {
      let ratio = Math.max(0, rp.life);
      ctx.globalAlpha = ratio;
      ctx.strokeStyle = rp.color;
      ctx.lineWidth = 10 * ratio;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    particles.forEach((p) => {
      let ratio = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = ratio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * ratio, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = "source-over";
  }
}

// 슬롯 상자 그리기 헬퍼
function drawSlotBox(cx: number, cy: number, isFull: boolean, offsetX: number) {
  let boxW = 460;
  let boxH = 160;
  let boxX = cx - boxW / 2 + offsetX;
  let boxY = cy - boxH / 2;
  let r = 30;

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  if (isFull) {
    let glow = (Math.sin(globalTime * 15) + 1) / 2;
    ctx.strokeStyle = `rgba(153, 255, 0, ${0.5 + glow * 0.5})`;
    ctx.lineWidth = 6 + glow * 4;
    ctx.shadowColor = "#99FF00";
    ctx.shadowBlur = 15 + glow * 20;
  } else {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxW - r, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
  ctx.lineTo(boxX + boxW, boxY + boxH - r);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
  ctx.lineTo(boxX + r, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// 터치 입력 핸들러
function onPointerDown(e: PointerEvent) {
  if (gameState !== "PLAY") return;
  let pos = AppHelper.getRelativeCoordinates(e.clientX, e.clientY, appCanvas);

  for (let i = balls.length - 1; i >= 0; i--) {
    let b = balls[i];
    if (b.team === "L" && leftStopped) continue;
    if (b.team === "R" && rightStopped) continue;

    let bX = b.x;
    if (b.state === "SLOT") {
      bX += b.team === "L" ? shakeOffsetL.x : shakeOffsetR.x;
    }

    let dx = bX - pos.x;
    let dy = b.y - pos.y;

    if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
      if (b.state === "FLOAT") {
        let sArr = b.team === "L" ? SLOTS_L : SLOTS_R;
        let emptySlot = -1;
        for (let s = 0; s < 3; s++) {
          if (!balls.some((bx) => bx.team === b.team && bx.slotIndex === s)) {
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
            x: sArr[emptySlot].x,
            y: sArr[emptySlot].y,
            duration: 0.5,
            ease: "back.out(1.5)",
            onComplete: () => {
              b.state = "SLOT";
              b.cancelTimer = appData.cancel_delay_time;
              createParticles(b.x, b.y, "#FFFFFF");
              createParticles(b.x, b.y, "#99FF00");
              ringParticles.push(new RingParticle(b.x, b.y, "#FFFFFF"));
              ringParticles.push(new RingParticle(b.x, b.y, "#99FF00"));
              sounds["click"]?.play();
              calculateSum();
            },
          });
        }
      } else if (b.state === "SLOT") {
        if (b.cancelTimer > 0) break;

        b.state = "FLOAT";
        b.slotIndex = -1;
        if (b.team === "L") scoreModifierL = 0;
        else scoreModifierR = 0;

        gsap.killTweensOf(b);
        sounds["click"]?.play();
        sounds["pop"]?.play();

        let renderX = b.x + (b.team === "L" ? shakeOffsetL.x : shakeOffsetR.x);
        createParticles(renderX, b.y, "#FF5555");
        createParticles(renderX, b.y, "#FFFFFF");
        ringParticles.push(new RingParticle(renderX, b.y, "#FF5555"));
        ringParticles.push(new RingParticle(renderX, b.y, "#FFFFFF"));

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

// 초기화
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
