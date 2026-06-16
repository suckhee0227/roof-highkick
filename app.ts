// import section

import { AppHelper } from "./appHelper";
import * as THREE from "three";
import { gsap } from "gsap";
import confetti from "canvas-confetti";

import * as Tone from "tone";

// declaration section

interface IAppData {
  gridCols: number;
  gridRows: number;
  targetRange: { min: number; max: number; negativeMin: number; negativeMax: number };
  numberCards: number[];
  piecesPerRound: number;
  tetrominoMinSize: number;
  tetrominoMaxSize: number;
  tetrominoCount: number;
  teamColors: { team1: string; team2: string };
  buildingColors: string[];
  roofColor: string;
}

interface ITextData {
  title: string;
  startBtn: string;
  tutorialTitle: string;
  tutorialContent: string;
  instruction: string;
  page: string;
  guideInitial: string;
  guideCorrect: string;
  guideIncorrect: string;
  targetLabel: string;
  team1Name: string;
  team2Name: string;
  submitBtn: string;
  resetBtn: string;
  nextRoundBtn: string;
  clearExprBtn: string;
  winMessage: string;
  placeTetrominoMsg: string;
  closeBtn: string;
}

interface IAssetList {
  images: { id: string; file_path: string }[];
  sounds: { id: string; file_path: string }[];
}

interface IPieceCell {
  col: number;
  row: number;
}

interface IPiece {
  cells: IPieceCell[];
  color: string;
}

type GamePhase = "start" | "math" | "tetris" | "win";

// Main App Class
class RoofKickApp {
  private appData!: IAppData;
  private textData!: ITextData;
  private assetList!: IAssetList;

  private appCanvas: HTMLCanvasElement;
  private uiLayer: HTMLElement;

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;

  // game state
  private phase: GamePhase = "start";
  private currentTeam: number = 1;
  private targetNumber: number = 0;
  private expression: string[] = [];
  private team1Height: number = 0;
  private team2Height: number = 0;

  // tetris grids
  private team1Grid: (string | null)[][] = [];
  private team2Grid: (string | null)[][] = [];

  // pieces
  private availablePieces: IPiece[] = [];
  private currentPieceIndex: number = 0;
  private placedPiecesCount: number = 0;
  private ghostCol: number = 0;
  private ghostRow: number = 0;

  // Three.js meshes
  private gridMeshes1: THREE.Mesh[][] = [];
  private gridMeshes2: THREE.Mesh[][] = [];
  private buildingGroup1!: THREE.Group;
  private buildingGroup2!: THREE.Group;

  // synth for sound effects
  private synth!: Tone.Synth;

  // canvas dimensions
  private readonly W = 1200;
  private readonly H = 800;
  private readonly CELL_SIZE = 36;

  constructor() {
    this.appCanvas = document.getElementById("appCanvas") as HTMLCanvasElement;
    this.uiLayer = document.getElementById("uiLayer") as HTMLDivElement;
  }

  async init() {
    this.appData = await AppHelper.loadAppData<IAppData>();
    this.textData = await AppHelper.loadTextData<ITextData>();
    this.assetList = await AppHelper.loadAssetList<IAssetList>();

    this.setupCanvas();
    this.setupThreeJS();
    this.setupAudio();
    this.initGrids();
    this.buildScene();
    this.showStartScreen();
    this.animate();
  }

  // ===================== SETUP =====================

  private setupCanvas() {
    this.appCanvas.width = this.W;
    this.appCanvas.height = this.H;
  }

  private setupThreeJS() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5efe6);

    const halfW = this.W / 2;
    const halfH = this.H / 2;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.appCanvas, antialias: true });
    this.renderer.setSize(this.W, this.H);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  }

  private setupAudio() {
    try {
      this.synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
      }).toDestination();
    } catch {}
  }

  private playPopSound() {
    try {
      Tone.start();
      this.synth.triggerAttackRelease("C5", "8n");
    } catch {}
  }

  private playPlaceSound() {
    try {
      Tone.start();
      this.synth.triggerAttackRelease("E4", "16n");
    } catch {}
  }

  private playWinSound() {
    try {
      Tone.start();
      const now = Tone.now();
      this.synth.triggerAttackRelease("C5", "8n", now);
      this.synth.triggerAttackRelease("E5", "8n", now + 0.15);
      this.synth.triggerAttackRelease("G5", "8n", now + 0.3);
      this.synth.triggerAttackRelease("C6", "4n", now + 0.45);
    } catch {}
  }

  // ===================== GRID INIT =====================

  private initGrids() {
    const { gridCols, gridRows } = this.appData;
    this.team1Grid = [];
    this.team2Grid = [];
    for (let r = 0; r < gridRows; r++) {
      this.team1Grid.push(new Array(gridCols).fill(null));
      this.team2Grid.push(new Array(gridCols).fill(null));
    }
  }

  // ===================== SCENE BUILD =====================

  private buildScene() {
    const { gridCols, gridRows } = this.appData;
    const cs = this.CELL_SIZE;
    const gridW = gridCols * cs;
    const gridH = gridRows * cs;

    this.buildingGroup1 = new THREE.Group();
    this.buildingGroup2 = new THREE.Group();

    // Team1 left, Team2 right
    const yBase = -60;
    this.buildingGroup1.position.set(-310, yBase, 0);
    this.buildingGroup2.position.set(310, yBase, 0);

    this.gridMeshes1 = this.createGridMeshes(this.buildingGroup1);
    this.gridMeshes2 = this.createGridMeshes(this.buildingGroup2);

    this.createRoof(this.buildingGroup1);
    this.createRoof(this.buildingGroup2);

    this.scene.add(this.buildingGroup1);
    this.scene.add(this.buildingGroup2);
  }

  private createGridMeshes(group: THREE.Group): THREE.Mesh[][] {
    const { gridCols, gridRows } = this.appData;
    const cs = this.CELL_SIZE;
    const meshes: THREE.Mesh[][] = [];

    for (let r = 0; r < gridRows; r++) {
      meshes[r] = [];
      for (let c = 0; c < gridCols; c++) {
        const geo = new THREE.BoxGeometry(cs - 2, cs - 2, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xe8e0d4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          (c - gridCols / 2 + 0.5) * cs,
          (r - gridRows / 2 + 0.5) * cs,
          0
        );
        group.add(mesh);
        meshes[r][c] = mesh;
      }
    }

    // grid border
    const bGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(gridCols * cs, gridRows * cs, 2));
    const bMat = new THREE.LineBasicMaterial({ color: 0x999999, linewidth: 2 });
    const border = new THREE.LineSegments(bGeo, bMat);
    border.position.set(0, 0, 1);
    group.add(border);

    // inner grid lines
    for (let c = 1; c < gridCols; c++) {
      const pts = [
        new THREE.Vector3((c - gridCols / 2) * cs, -gridRows * cs / 2, 1),
        new THREE.Vector3((c - gridCols / 2) * cs, gridRows * cs / 2, 1),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xcccccc }));
      group.add(line);
    }
    for (let r = 1; r < gridRows; r++) {
      const pts = [
        new THREE.Vector3(-gridCols * cs / 2, (r - gridRows / 2) * cs, 1),
        new THREE.Vector3(gridCols * cs / 2, (r - gridRows / 2) * cs, 1),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xcccccc }));
      group.add(line);
    }

    return meshes;
  }

  private createRoof(group: THREE.Group) {
    const { gridCols, gridRows } = this.appData;
    const cs = this.CELL_SIZE;
    const roofW = gridCols * cs + 30;
    const roofH = 16;
    const roofY = gridRows * cs / 2 + roofH / 2 + 2;

    // roof bar
    const barGeo = new THREE.BoxGeometry(roofW, roofH, 6);
    const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.appData.roofColor) });
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.set(0, roofY, 2);
    group.add(bar);

    // triangle top
    const triShape = new THREE.Shape();
    triShape.moveTo(-roofW / 2, 0);
    triShape.lineTo(0, 36);
    triShape.lineTo(roofW / 2, 0);
    triShape.closePath();
    const triGeo = new THREE.ShapeGeometry(triShape);
    const triMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.appData.roofColor) });
    const tri = new THREE.Mesh(triGeo, triMat);
    tri.position.set(0, roofY + roofH / 2, 2);
    group.add(tri);
  }

  // ===================== START SCREEN =====================

  private showStartScreen() {
    this.phase = "start";
    this.clearUI();

    const overlay = AppHelper.createUIElement("div", "startOverlay", {
      position: "absolute",
      left: "0", top: "0",
      width: this.W + "px", height: this.H + "px",
      backgroundColor: "rgba(0,0,0,0.75)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "auto",
    });

    const title = AppHelper.createUIElement("div", "", {
      fontSize: "52px", fontWeight: "bold", color: "#FFD700",
      marginBottom: "24px",
      textShadow: "2px 2px 8px rgba(0,0,0,0.6)",
      fontFamily: "sans-serif",
    }, this.textData.title);
    overlay.appendChild(title);

    const desc = AppHelper.createUIElement("div", "", {
      fontSize: "17px", color: "#ffffff",
      marginBottom: "36px", maxWidth: "560px",
      textAlign: "center", lineHeight: "1.7",
      fontFamily: "sans-serif",
    }, this.textData.tutorialContent);
    overlay.appendChild(desc);

    const btn = AppHelper.createUIElement("div", "", {
      fontSize: "26px", fontWeight: "bold", color: "#fff",
      backgroundColor: "#E74C3C",
      padding: "14px 60px", borderRadius: "14px",
      cursor: "pointer", pointerEvents: "auto",
      boxShadow: "0 4px 16px rgba(231,76,60,0.4)",
      fontFamily: "sans-serif",
    }, this.textData.startBtn, [
      { event: "pointerdown", handler: () => this.startGame() },
    ]);
    overlay.appendChild(btn);

    this.uiLayer.appendChild(overlay);
  }

  private startGame() {
    this.currentTeam = 1;
    this.team1Height = 0;
    this.team2Height = 0;
    this.initGrids();
    this.updateGridVisuals();
    this.startMathPhase();
  }

  // ===================== MATH PHASE =====================

  private generateTargetNumber(): number {
    const { min, max } = this.appData.targetRange;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private startMathPhase() {
    this.phase = "math";
    this.clearUI();
    this.expression = [];

    this.targetNumber = this.generateTargetNumber();

    this.buildMathUI();
    this.highlightCurrentTeam();
  }

  private continueWithSameTarget() {
    this.phase = "math";
    this.clearUI();
    this.expression = [];

    this.buildMathUI();
    this.highlightCurrentTeam();
  }

  private buildMathUI() {
    const cx = this.W / 2;
    const teamName = this.currentTeam === 1 ? this.textData.team1Name : this.textData.team2Name;
    const teamColor = this.currentTeam === 1 ? this.appData.teamColors.team1 : this.appData.teamColors.team2;

    // team labels on buildings
    this.addTeamLabels();

    // turn indicator
    const turnLabel = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: (cx - 150) + "px", top: "16px",
      width: "300px", textAlign: "center",
      fontSize: "22px", fontWeight: "bold",
      color: teamColor, pointerEvents: "none",
      fontFamily: "sans-serif",
    }, `${teamName} 차례`);
    this.uiLayer.appendChild(turnLabel);

    // target card (flipped card style)
    const cardW = 200;
    const cardH = 110;
    const cardContainer = AppHelper.createUIElement("div", "targetCardContainer", {
      position: "absolute",
      left: (cx - cardW / 2) + "px", top: "55px",
      width: cardW + "px", height: cardH + "px",
      perspective: "600px",
      pointerEvents: "auto", cursor: "pointer",
    });

    // card back (shown initially)
    const cardBack = AppHelper.createUIElement("div", "cardBack", {
      position: "absolute",
      width: "100%", height: "100%",
      backgroundColor: "#34495E",
      borderRadius: "14px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "32px", fontWeight: "bold", color: "#95A5A6",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      transition: "transform 0.5s",
      backfaceVisibility: "hidden",
      fontFamily: "sans-serif",
    }, "?");

    // card front (target number)
    const cardFront = AppHelper.createUIElement("div", "cardFront", {
      position: "absolute",
      width: "100%", height: "100%",
      backgroundColor: "#2C3E50",
      borderRadius: "14px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      transform: "rotateY(180deg)",
      transition: "transform 0.5s",
      backfaceVisibility: "hidden",
      fontFamily: "sans-serif",
    });

    const targetTitle = AppHelper.createUIElement("div", "", {
      fontSize: "13px", color: "#95A5A6", marginBottom: "2px",
      fontFamily: "sans-serif",
    }, this.textData.targetLabel);
    cardFront.appendChild(targetTitle);

    const targetNum = AppHelper.createUIElement("div", "", {
      fontSize: "44px", fontWeight: "bold", color: "#FFD700",
      fontFamily: "sans-serif",
    }, String(this.targetNumber));
    cardFront.appendChild(targetNum);

    cardContainer.appendChild(cardBack);
    cardContainer.appendChild(cardFront);

    let isFlipped = false;
    cardContainer.addEventListener("pointerdown", () => {
      if (isFlipped) return;
      isFlipped = true;
      this.playPopSound();
      (cardBack as HTMLElement).style.transform = "rotateY(180deg)";
      (cardFront as HTMLElement).style.transform = "rotateY(0deg)";
    });

    this.uiLayer.appendChild(cardContainer);

    // expression display
    const exprDisplay = AppHelper.createUIElement("div", "exprDisplay", {
      position: "absolute",
      left: (cx - 220) + "px", top: "190px",
      width: "440px", height: "48px",
      backgroundColor: "#ffffff",
      border: "3px solid #555", borderRadius: "10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "28px", fontWeight: "bold", color: "#333",
      pointerEvents: "none",
      fontFamily: "monospace",
      overflow: "hidden",
    }, "");
    this.uiLayer.appendChild(exprDisplay);

    // number card buttons (1-9)
    const cardSize = 46;
    const gap = 4;
    const totalW = 9 * cardSize + 8 * gap;
    const startX = cx - totalW / 2;
    const cardY = 260;

    for (let i = 0; i < this.appData.numberCards.length; i++) {
      const num = this.appData.numberCards[i];
      const x = startX + i * (cardSize + gap);
      const card = AppHelper.createUIElement("div", "", {
        position: "absolute",
        left: x + "px", top: cardY + "px",
        width: cardSize + "px", height: cardSize + "px",
        backgroundColor: "#3498DB",
        borderRadius: "10px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "24px", fontWeight: "bold", color: "#fff",
        cursor: "pointer", pointerEvents: "auto",
        boxShadow: "0 3px 8px rgba(52,152,219,0.3)",
        fontFamily: "sans-serif",
      }, String(num), [
        { event: "pointerdown", handler: () => this.addToken(String(num)) },
      ]);
      this.uiLayer.appendChild(card);
    }

    // operator buttons
    const ops = ["+", "-"];
    const opY = cardY + cardSize + 12;
    ops.forEach((op, i) => {
      const btn = AppHelper.createUIElement("div", "", {
        position: "absolute",
        left: (cx - 65 + i * 70) + "px", top: opY + "px",
        width: "56px", height: "46px",
        backgroundColor: "#E67E22",
        borderRadius: "10px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "28px", fontWeight: "bold", color: "#fff",
        cursor: "pointer", pointerEvents: "auto",
        boxShadow: "0 3px 8px rgba(230,126,34,0.3)",
        fontFamily: "sans-serif",
      }, op, [
        { event: "pointerdown", handler: () => this.addToken(op) },
      ]);
      this.uiLayer.appendChild(btn);
    });

    // clear & submit
    const actionY = opY + 60;
    const clearBtn = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: (cx - 160) + "px", top: actionY + "px",
      width: "140px", height: "46px",
      backgroundColor: "#95A5A6", borderRadius: "10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "18px", fontWeight: "bold", color: "#fff",
      cursor: "pointer", pointerEvents: "auto",
      fontFamily: "sans-serif",
    }, this.textData.clearExprBtn, [
      { event: "pointerdown", handler: () => this.clearExpression() },
    ]);
    this.uiLayer.appendChild(clearBtn);

    const submitBtn = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: (cx + 20) + "px", top: actionY + "px",
      width: "140px", height: "46px",
      backgroundColor: "#27AE60", borderRadius: "10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "18px", fontWeight: "bold", color: "#fff",
      cursor: "pointer", pointerEvents: "auto",
      fontFamily: "sans-serif",
    }, this.textData.submitBtn, [
      { event: "pointerdown", handler: () => this.submitExpression() },
    ]);
    this.uiLayer.appendChild(submitBtn);

    // message
    const msgLabel = AppHelper.createUIElement("div", "msgLabel", {
      position: "absolute",
      left: (cx - 200) + "px", top: (actionY + 64) + "px",
      width: "400px", textAlign: "center",
      fontSize: "18px", fontWeight: "bold", color: "#555",
      pointerEvents: "none",
      fontFamily: "sans-serif",
    }, this.textData.instruction);
    this.uiLayer.appendChild(msgLabel);

    // score
    this.addScoreDisplay();
  }

  private addToken(token: string) {
    if (this.phase !== "math") return;

    const isOp = token === "+" || token === "-";
    const last = this.expression[this.expression.length - 1];
    const lastIsOp = last === "+" || last === "-";

    if (isOp && this.expression.length === 0) return;
    if (isOp && lastIsOp) return;

    // build multi-digit numbers
    if (!isOp && last !== undefined && !lastIsOp) {
      this.expression[this.expression.length - 1] = last + token;
    } else {
      this.expression.push(token);
    }

    this.updateExprDisplay();
  }

  private clearExpression() {
    this.expression = [];
    this.updateExprDisplay();
  }

  private updateExprDisplay() {
    const el = document.getElementById("exprDisplay");
    if (el) el.textContent = this.expression.join(" ");
  }

  private submitExpression() {
    if (this.phase !== "math" || this.expression.length === 0) return;

    const exprStr = this.expression.join("");
    if (!/^[0-9+\-]+$/.test(exprStr)) return;

    let result: number;
    try {
      result = Function('"use strict"; return (' + exprStr + ')')();
    } catch { return; }

    const msgEl = document.getElementById("msgLabel");

    if (result === this.targetNumber) {
      // correct
      this.playPopSound();
      if (msgEl) {
        msgEl.innerHTML = this.textData.guideCorrect;
        msgEl.style.color = "#27AE60";
      }
      setTimeout(() => this.startTetrisPhase(), 1200);
    } else {
      // wrong - switch team
      if (msgEl) {
        msgEl.innerHTML = `${exprStr} = ${result}<br>${this.textData.guideIncorrect}`;
        msgEl.style.color = "#E74C3C";
      }
      this.currentTeam = this.currentTeam === 1 ? 2 : 1;
      setTimeout(() => this.continueWithSameTarget(), 1500);
    }
  }

  // ===================== TETRIS PHASE =====================

  private startTetrisPhase() {
    this.phase = "tetris";
    this.clearUI();

    // generate pool of pieces on the board
    this.availablePieces = [];
    const totalPieces = Math.max(this.appData.tetrominoCount, 10);
    for (let i = 0; i < totalPieces; i++) {
      this.availablePieces.push(this.generatePiece());
    }
    this.currentPieceIndex = 0;
    this.placedPiecesCount = 0;
    this.ghostCol = 0;
    this.ghostRow = 0;

    this.filterUnfittablePieces();
    this.buildTetrisUI();
  }

  private generatePiece(): IPiece {
    const { tetrominoMinSize, tetrominoMaxSize, buildingColors } = this.appData;
    const size = Math.floor(Math.random() * (tetrominoMaxSize - tetrominoMinSize + 1)) + tetrominoMinSize;
    const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

    const cells: IPieceCell[] = [{ col: 0, row: 0 }];
    for (let i = 1; i < size; i++) {
      const neighbors: IPieceCell[] = [];
      for (const cell of cells) {
        const dirs = [
          { col: cell.col + 1, row: cell.row },
          { col: cell.col - 1, row: cell.row },
          { col: cell.col, row: cell.row + 1 },
          { col: cell.col, row: cell.row - 1 },
        ];
        for (const d of dirs) {
          if (!cells.some(c => c.col === d.col && c.row === d.row) &&
              !neighbors.some(n => n.col === d.col && n.row === d.row)) {
            neighbors.push(d);
          }
        }
      }
      if (neighbors.length > 0) {
        cells.push(neighbors[Math.floor(Math.random() * neighbors.length)]);
      }
    }

    const minC = Math.min(...cells.map(c => c.col));
    const minR = Math.min(...cells.map(c => c.row));
    return {
      cells: cells.map(c => ({ col: c.col - minC, row: c.row - minR })),
      color,
    };
  }

  private buildTetrisUI() {
    const cx = this.W / 2;
    const teamName = this.currentTeam === 1 ? this.textData.team1Name : this.textData.team2Name;
    const teamColor = this.currentTeam === 1 ? this.appData.teamColors.team1 : this.appData.teamColors.team2;

    this.addTeamLabels();

    // turn + instruction
    const turnLabel = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: (cx - 200) + "px", top: "16px",
      width: "400px", textAlign: "center",
      fontSize: "20px", fontWeight: "bold",
      color: teamColor, pointerEvents: "none",
      fontFamily: "sans-serif",
    }, `${teamName} - ${this.textData.placeTetrominoMsg}`);
    this.uiLayer.appendChild(turnLabel);

    // piece selector - show available pieces as small previews
    this.buildPieceSelector(cx);

    // placement controls
    const ctrlY = 310;

    // arrow buttons
    const arrows = [
      { label: "\u25C0", dx: -1, dy: 0, x: cx - 90, y: ctrlY },
      { label: "\u25B6", dx: 1, dy: 0, x: cx + 40, y: ctrlY },
      { label: "\u25B2", dx: 0, dy: 1, x: cx - 25, y: ctrlY - 52 },
      { label: "\u25BC", dx: 0, dy: -1, x: cx - 25, y: ctrlY + 52 },
    ];
    arrows.forEach(a => {
      const btn = AppHelper.createUIElement("div", "", {
        position: "absolute",
        left: a.x + "px", top: a.y + "px",
        width: "50px", height: "44px",
        backgroundColor: "#7F8C8D", borderRadius: "10px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", color: "#fff",
        cursor: "pointer", pointerEvents: "auto",
        fontFamily: "sans-serif",
      }, a.label, [
        { event: "pointerdown", handler: () => this.moveGhost(a.dx, a.dy) },
      ]);
      this.uiLayer.appendChild(btn);
    });

    // place button
    const placeBtn = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: (cx - 55) + "px", top: (ctrlY + 116) + "px",
      width: "110px", height: "44px",
      backgroundColor: "#27AE60", borderRadius: "10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "18px", fontWeight: "bold", color: "#fff",
      cursor: "pointer", pointerEvents: "auto",
      fontFamily: "sans-serif",
    }, "\uBC30\uCE58", [
      { event: "pointerdown", handler: () => this.placePiece() },
    ]);
    this.uiLayer.appendChild(placeBtn);

    // counter
    const counter = AppHelper.createUIElement("div", "pieceCounter", {
      position: "absolute",
      left: (cx - 100) + "px", top: (ctrlY + 170) + "px",
      width: "200px", textAlign: "center",
      fontSize: "15px", color: "#666",
      pointerEvents: "none",
      fontFamily: "sans-serif",
    }, `\uC870\uAC01 ${this.placedPiecesCount} / ${this.appData.piecesPerRound}`);
    this.uiLayer.appendChild(counter);

    this.addScoreDisplay();
    this.updateGhostPreview();
  }

  private buildPieceSelector(cx: number) {
    const previewY = 60;
    const previewCellSize = 14;
    const startIdx = this.currentPieceIndex;
    const endIdx = Math.min(startIdx + this.appData.tetrominoCount, this.availablePieces.length);

    const container = AppHelper.createUIElement("div", "pieceSelectorContainer", {
      position: "absolute",
      left: (cx - 180) + "px", top: previewY + "px",
      width: "360px", height: "180px",
      display: "flex", flexWrap: "wrap",
      justifyContent: "center", alignItems: "flex-start",
      gap: "8px", pointerEvents: "auto",
      overflowY: "auto", overflowX: "hidden",
    });

    for (let i = startIdx; i < endIdx; i++) {
      const piece = this.availablePieces[i];
      const isSelected = i === this.currentPieceIndex;
      const maxC = Math.max(...piece.cells.map(c => c.col)) + 1;
      const maxR = Math.max(...piece.cells.map(c => c.row)) + 1;

      const pieceBox = AppHelper.createUIElement("div", "", {
        position: "relative",
        width: (maxC * previewCellSize + 6) + "px",
        height: (maxR * previewCellSize + 6) + "px",
        border: isSelected ? "2px solid #E74C3C" : "2px solid #ccc",
        borderRadius: "6px",
        backgroundColor: isSelected ? "#fff3e0" : "#fafafa",
        cursor: "pointer",
        padding: "2px",
      }, "", [
        { event: "pointerdown", handler: () => this.selectPiece(i) },
      ]);

      piece.cells.forEach(cell => {
        const cellDiv = AppHelper.createUIElement("div", "", {
          position: "absolute",
          left: (3 + cell.col * previewCellSize) + "px",
          bottom: (3 + cell.row * previewCellSize) + "px",
          width: (previewCellSize - 1) + "px",
          height: (previewCellSize - 1) + "px",
          backgroundColor: piece.color,
          borderRadius: "2px",
        });
        pieceBox.appendChild(cellDiv);
      });

      container.appendChild(pieceBox);
    }

    this.uiLayer.appendChild(container);
  }

  private selectPiece(index: number) {
    if (this.phase !== "tetris") return;
    this.currentPieceIndex = index;
    this.ghostCol = 0;
    this.ghostRow = 0;

    // rebuild UI to update selection highlight
    this.clearUI();
    this.buildTetrisUI();
  }

  private moveGhost(dx: number, dy: number) {
    if (this.phase !== "tetris") return;
    if (this.currentPieceIndex >= this.availablePieces.length) return;

    const piece = this.availablePieces[this.currentPieceIndex];
    const maxC = Math.max(...piece.cells.map(c => c.col));
    const maxR = Math.max(...piece.cells.map(c => c.row));

    this.ghostCol = Math.max(0, Math.min(this.appData.gridCols - 1 - maxC, this.ghostCol + dx));
    this.ghostRow = Math.max(0, Math.min(this.appData.gridRows - 1 - maxR, this.ghostRow + dy));

    this.updateGhostPreview();
  }

  private updateGhostPreview() {
    if (this.currentPieceIndex >= this.availablePieces.length) return;

    const piece = this.availablePieces[this.currentPieceIndex];
    const grid = this.currentTeam === 1 ? this.team1Grid : this.team2Grid;
    const meshes = this.currentTeam === 1 ? this.gridMeshes1 : this.gridMeshes2;

    this.updateGridVisuals();

    const canPlace = this.canPlacePiece(piece, this.ghostCol, this.ghostRow, grid);
    for (const cell of piece.cells) {
      const r = this.ghostRow + cell.row;
      const c = this.ghostCol + cell.col;
      if (r >= 0 && r < this.appData.gridRows && c >= 0 && c < this.appData.gridCols) {
        const mat = meshes[r][c].material as THREE.MeshBasicMaterial;
        if (!grid[r][c]) {
          mat.color.set(canPlace ? piece.color : 0xff6666);
          mat.opacity = 0.5;
          mat.transparent = true;
        }
      }
    }
  }

  private canPieceFitAnywhere(piece: IPiece, grid: (string | null)[][]): boolean {
    const { gridCols, gridRows } = this.appData;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (this.canPlacePiece(piece, c, r, grid)) return true;
      }
    }
    return false;
  }

  private filterUnfittablePieces() {
    const grid = this.currentTeam === 1 ? this.team1Grid : this.team2Grid;
    for (let i = 0; i < this.availablePieces.length; i++) {
      if (!this.canPieceFitAnywhere(this.availablePieces[i], grid)) {
        let replaced = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const newPiece = this.generatePiece();
          if (this.canPieceFitAnywhere(newPiece, grid)) {
            this.availablePieces[i] = newPiece;
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          const { buildingColors } = this.appData;
          this.availablePieces[i] = {
            cells: [{ col: 0, row: 0 }],
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
          };
        }
      }
    }
    if (this.currentPieceIndex >= this.availablePieces.length) {
      this.currentPieceIndex = 0;
    }
  }

  private canPlacePiece(piece: IPiece, col: number, row: number, grid: (string | null)[][]): boolean {
    for (const cell of piece.cells) {
      const r = row + cell.row;
      const c = col + cell.col;
      if (r < 0 || r >= this.appData.gridRows || c < 0 || c >= this.appData.gridCols) return false;
      if (grid[r][c]) return false;
    }
    return true;
  }

  private placePiece() {
    if (this.phase !== "tetris") return;
    if (this.currentPieceIndex >= this.availablePieces.length) return;

    const piece = this.availablePieces[this.currentPieceIndex];
    const grid = this.currentTeam === 1 ? this.team1Grid : this.team2Grid;
    const meshes = this.currentTeam === 1 ? this.gridMeshes1 : this.gridMeshes2;

    if (!this.canPlacePiece(piece, this.ghostCol, this.ghostRow, grid)) return;

    // place
    for (const cell of piece.cells) {
      const r = this.ghostRow + cell.row;
      const c = this.ghostCol + cell.col;
      grid[r][c] = piece.color;
    }

    // animate
    this.playPlaceSound();
    for (const cell of piece.cells) {
      const r = this.ghostRow + cell.row;
      const c = this.ghostCol + cell.col;
      if (r >= 0 && r < this.appData.gridRows && c >= 0 && c < this.appData.gridCols) {
        const mesh = meshes[r][c];
        gsap.from(mesh.position, { z: 30, duration: 0.35, ease: "bounce.out" });
        gsap.from(mesh.scale, { x: 0.3, y: 0.3, duration: 0.3, ease: "back.out(1.7)" });
      }
    }

    // remove used piece and add new random one
    this.availablePieces.splice(this.currentPieceIndex, 1);
    this.availablePieces.push(this.generatePiece());
    this.placedPiecesCount++;

    this.updateGridVisuals();
    this.updateTeamHeights();

    // check win
    if (this.checkWin()) return;

    if (this.placedPiecesCount >= this.appData.piecesPerRound) {
      this.currentTeam = this.currentTeam === 1 ? 2 : 1;
      setTimeout(() => this.startMathPhase(), 600);
    } else {
      if (this.currentPieceIndex >= this.availablePieces.length) {
        this.currentPieceIndex = 0;
      }
      this.ghostCol = 0;
      this.ghostRow = 0;
      this.filterUnfittablePieces();
      this.clearUI();
      this.buildTetrisUI();
    }
  }

  // ===================== WIN =====================

  private updateTeamHeights() {
    this.team1Height = this.calcHeight(this.team1Grid);
    this.team2Height = this.calcHeight(this.team2Grid);
  }

  private calcHeight(grid: (string | null)[][]): number {
    // 아래부터 완전히 채워진 행만 높이로 인정
    let height = 0;
    for (let r = 0; r < this.appData.gridRows; r++) {
      if (grid[r].every(cell => cell !== null)) {
        height = r + 1;
      } else {
        break;
      }
    }
    return height;
  }

  private checkWin(): boolean {
    if (this.team1Height >= this.appData.gridRows) {
      this.showWinScreen(1);
      return true;
    }
    if (this.team2Height >= this.appData.gridRows) {
      this.showWinScreen(2);
      return true;
    }
    return false;
  }

  private showWinScreen(team: number) {
    this.phase = "win";
    this.clearUI();

    const teamName = team === 1 ? this.textData.team1Name : this.textData.team2Name;
    const teamColor = team === 1 ? this.appData.teamColors.team1 : this.appData.teamColors.team2;

    this.playWinSound();
    try {
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 } }), 500);
    } catch {}

    const overlay = AppHelper.createUIElement("div", "winOverlay", {
      position: "absolute",
      left: "0", top: "0",
      width: this.W + "px", height: this.H + "px",
      backgroundColor: "rgba(0,0,0,0.65)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      pointerEvents: "auto",
    });

    const winText = AppHelper.createUIElement("div", "", {
      fontSize: "60px", fontWeight: "bold",
      color: teamColor,
      textShadow: "3px 3px 10px rgba(0,0,0,0.5)",
      marginBottom: "24px",
      fontFamily: "sans-serif",
    }, `${teamName} ${this.textData.winMessage}`);
    overlay.appendChild(winText);

    const subText = AppHelper.createUIElement("div", "", {
      fontSize: "22px", color: "#ddd",
      marginBottom: "32px",
      fontFamily: "sans-serif",
    }, "\uC9C0\uBD95 \uB192\uC774\uC5D0 \uBA3C\uC800 \uB3C4\uB2EC\uD588\uC2B5\uB2C8\uB2E4!");
    overlay.appendChild(subText);

    const restartBtn = AppHelper.createUIElement("div", "", {
      fontSize: "24px", fontWeight: "bold", color: "#fff",
      backgroundColor: "#E74C3C",
      padding: "12px 48px", borderRadius: "12px",
      cursor: "pointer", pointerEvents: "auto",
      boxShadow: "0 4px 16px rgba(231,76,60,0.4)",
      fontFamily: "sans-serif",
    }, "\uB2E4\uC2DC \uC2DC\uC791", [
      { event: "pointerdown", handler: () => {
        this.initGrids();
        this.updateGridVisuals();
        this.startGame();
      }},
    ]);
    overlay.appendChild(restartBtn);

    this.uiLayer.appendChild(overlay);
  }

  // ===================== RENDERING =====================

  private updateGridVisuals() {
    this.updateSingleGrid(this.team1Grid, this.gridMeshes1);
    this.updateSingleGrid(this.team2Grid, this.gridMeshes2);
  }

  private updateSingleGrid(grid: (string | null)[][], meshes: THREE.Mesh[][]) {
    for (let r = 0; r < this.appData.gridRows; r++) {
      for (let c = 0; c < this.appData.gridCols; c++) {
        const mat = meshes[r][c].material as THREE.MeshBasicMaterial;
        if (grid[r][c]) {
          mat.color.set(grid[r][c]!);
          mat.opacity = 1;
          mat.transparent = false;
        } else {
          mat.color.set(0xe8e0d4);
          mat.opacity = 1;
          mat.transparent = false;
        }
      }
    }
  }

  private highlightCurrentTeam() {
    if (this.currentTeam === 1) {
      gsap.to(this.buildingGroup1.scale, { x: 1.03, y: 1.03, duration: 0.3 });
      gsap.to(this.buildingGroup2.scale, { x: 0.97, y: 0.97, duration: 0.3 });
    } else {
      gsap.to(this.buildingGroup1.scale, { x: 0.97, y: 0.97, duration: 0.3 });
      gsap.to(this.buildingGroup2.scale, { x: 1.03, y: 1.03, duration: 0.3 });
    }
  }

  // ===================== UI HELPERS =====================

  private addTeamLabels() {
    const cs = this.CELL_SIZE;
    const { gridCols } = this.appData;
    const gridW = gridCols * cs;

    // team 1 (left building) label
    const g1ScreenX = this.W / 2 - 310 - gridW / 2;
    const label1 = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: g1ScreenX + "px", top: (this.H - 55) + "px",
      width: gridW + "px", textAlign: "center",
      fontSize: "20px", fontWeight: "bold",
      color: this.appData.teamColors.team1,
      pointerEvents: "none",
      fontFamily: "sans-serif",
    }, this.textData.team1Name);
    this.uiLayer.appendChild(label1);

    // team 2 (right building) label
    const g2ScreenX = this.W / 2 + 310 - gridW / 2;
    const label2 = AppHelper.createUIElement("div", "", {
      position: "absolute",
      left: g2ScreenX + "px", top: (this.H - 55) + "px",
      width: gridW + "px", textAlign: "center",
      fontSize: "20px", fontWeight: "bold",
      color: this.appData.teamColors.team2,
      pointerEvents: "none",
      fontFamily: "sans-serif",
    }, this.textData.team2Name);
    this.uiLayer.appendChild(label2);
  }

  private addScoreDisplay() {
    const scoreDiv = AppHelper.createUIElement("div", "scoreDisplay", {
      position: "absolute",
      left: (this.W / 2 - 140) + "px", top: (this.H - 30) + "px",
      width: "280px", textAlign: "center",
      fontSize: "14px", color: "#888",
      pointerEvents: "none",
      fontFamily: "sans-serif",
    }, `${this.textData.team1Name} ${this.team1Height}/${this.appData.gridRows} | ${this.textData.team2Name} ${this.team2Height}/${this.appData.gridRows}`);
    this.uiLayer.appendChild(scoreDiv);
  }

  private clearUI() {
    while (this.uiLayer.firstChild) {
      this.uiLayer.removeChild(this.uiLayer.firstChild);
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }
}

// Export
export async function initApp() {
  const app = new RoofKickApp();
  await app.init();
}
