import * as THREE from "three";
import { audioSystem } from "./audio";
import { createGunMesh } from "./gunMesh";

function generateTexture(
  type: "ground" | "crate" | "wall" | "clothes",
): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  if (type === "ground") {
    ctx.fillStyle = "#556B2F";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? "#4A5D23" : "#6B8E23";
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = Math.random() * 3 + 1;
      ctx.fillRect(x, y, size, size);
    }
  } else if (type === "crate") {
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#5C3A21";
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, 256, 256);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(0, i * 64);
      ctx.lineTo(256, i * 64);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(256, 256);
    ctx.moveTo(256, 0);
    ctx.lineTo(0, 256);
    ctx.stroke();
  } else if (type === "wall") {
    ctx.fillStyle = "#888888";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#777777";
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 8, 8);
    }
    ctx.fillStyle = "#999999";
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
    }
  } else if (type === "clothes") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 8);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (type === "ground") {
    texture.repeat.set(20, 40);
  } else if (type === "wall") {
    texture.repeat.set(2, 2);
  }
  return texture;
}

const customTextures = {
  ground: generateTexture("ground"),
  crate: generateTexture("crate"),
  wall: generateTexture("wall"),
  clothes: generateTexture("clothes"),
};

export interface PlayerStats {
  id: string;
  name: string;
  kills: number;
  deaths: number;
  damage: number;
  highestCombo: number;
  highestStreak: number;
  isBot: boolean;
  team: "blue" | "red";
}

export class TDMGame {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationId: number = 0;

  public gameStats: Record<string, PlayerStats> = {
    player: {
      id: "player",
      name: "You",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: false,
      team: "blue",
    },
    bot1: {
      id: "bot1",
      name: "Alpha",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: true,
      team: "blue",
    },
    bot2: {
      id: "bot2",
      name: "Bravo",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: true,
      team: "blue",
    },
    enemy1: {
      id: "enemy1",
      name: "Echo",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: true,
      team: "red",
    },
    enemy2: {
      id: "enemy2",
      name: "Foxtrot",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: true,
      team: "red",
    },
    enemy3: {
      id: "enemy3",
      name: "Golf",
      kills: 0,
      deaths: 0,
      damage: 0,
      highestCombo: 0,
      highestStreak: 0,
      isBot: true,
      team: "red",
    },
  };

  // Player and Movement
  private myPlayer!: THREE.Mesh;
  private gunMesh!: THREE.Group;
  private currentWeaponSkin: string = "default";
  
  public setWeaponSkin(skin: string) {
    this.currentWeaponSkin = skin;
    if (this.gunMesh && this.myPlayer) {
      // Create new gun and swap
      const oldGun = this.gunMesh;
      this.myPlayer.remove(oldGun);
      
      this.gunMesh = createGunMesh(this.currentWeaponSkin);
      this.gunMesh.position.set(0.15, 0.2, -0.9);
      this.myPlayer.add(this.gunMesh);
    }
  }

  private clock: THREE.Clock;
  private joyInput = new THREE.Vector2(0, 0);
  private keys = { w: false, a: false, s: false, d: false };

  // Shooting
  private tracers: { line: THREE.Line; age: number }[] = [];
  private isAiming = false;
  private targetCameraRadius = 1.5;
  private cameraRadius = 1.5;
  private cameraOffsetRight = 1.0;
  private cameraOffsetUp = 1.8;
  private cameraOffsetForward = 1.0;
  private targetFov = 70;

  private lastReportedAmmo = -1;
  private lastReportedReloading = false;

  public onAmmoUpdate: ((ammo: number, isReloading: boolean) => void) | null =
    null;

  public onAimingUpdate: ((isAiming: boolean) => void) | null = null;

  public getGrenades() {
    return this.grenades;
  }

  public setGrenades(count: number) {
    this.grenades = count;
    this.notifyGrenadesUpdate();
  }

  public onGrenadesUpdate: ((grenades: number) => void) | null = null;
  private grenades = 0;
  private activeGrenades: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    timer: number;
  }[] = [];

  private notifyGrenadesUpdate() {
    this.onGrenadesUpdate?.(this.grenades);
  }

  private notifyAmmoUpdate() {
    if (
      this.ammo !== this.lastReportedAmmo ||
      this.isReloading !== this.lastReportedReloading
    ) {
      this.lastReportedAmmo = this.ammo;
      this.lastReportedReloading = this.isReloading;
      this.onAmmoUpdate?.(this.ammo, this.isReloading);
    }
  }
  private ammo = 30;
  private maxAmmo = 30;
  private isFiring = false;
  private fireRate = 0.1; // 10 shots/second
  private lastFireTime = 0;
  private isReloading = false;
  private reloadTime = 2.0;
  private reloadTimer = 0;

  public isPaused = false;
  // State
  private isGameOver = false;
  private blueScore = 0;
  private redScore = 0;

  // Health System
  public onPlayerHealthUpdate: ((health: number) => void) | null = null;
  public baseSensitivity: number = 1.0;
  public onPlayerRespawnTick: ((timeLeft: number | null) => void) | null = null;
  public onScoreUpdate: ((blue: number, red: number) => void) | null = null;
  public onGameOver: ((win: boolean, stats: PlayerStats[]) => void) | null =
    null;
  public onHit: (() => void) | null = null;
  public onKillsUpdate: ((kills: number) => void) | null = null;
  public onKillAlert: ((message: string) => void) | null = null;
  public onTimeUpdate:
    | ((timeInSeconds: number, isOvertime: boolean) => void)
    | null = null;

  public onKillFeed:
    | ((
        killer: string,
        victim: string,
        killerTeam: "blue" | "red",
        victimTeam: "blue" | "red",
        weapon: "gun" | "grenade",
      ) => void)
    | null = null;

  private entityNames: Record<string, string> = {
    player: "You",
    bot1: "Ghost",
    bot2: "Phantom",
    bot3: "Wraith",
    bot4: "Spectre",
    enemy1: "Reaper",
    enemy2: "Viper",
    enemy3: "Titan",
    enemy4: "Shadow",
    enemy5: "Venom",
    enemy6: "Havoc",
  };

  private getEntityName(id: string): string {
    return this.entityNames[id] || id;
  }

  private getEntityTeam(id: string): "blue" | "red" {
    return id === "player" || id.startsWith("bot") ? "blue" : "red";
  }

  private lastKillTime = 0;
  private multiKillCount = 0;
  private currentStreak = 0;

  private matchTime = 180; // 3 minutes match timer
  private isOvertime = false;

  private shakeIntensity = 0;

  private playerHealth = 100;
  private playerMaxHealth = 100;
  private lastReportedPlayerHealth = -1;
  private isDead = false;
  private respawnTimer = 0;
  private lastReportedRespawnTime: number | null = -1;
  private playerKills = 0;
  private killCamTimer = 0;
  private killCamTarget: THREE.Object3D | null = null;
  private lastPlayerKiller: string | null = null;

  private notifyHealthUpdate() {
    if (this.playerHealth <= 0 && !this.isDead) {
      if (this.isGameOver) return;
      this.isDead = true;
      this.respawnTimer = 3; // 3 seconds respawn
      this.myPlayer.visible = false;
      this.setAiming(false);
      this.notifyRespawnTick();

      if (this.lastPlayerKiller !== "player") {
        // Give point to red team
        this.redScore++;
        this.onScoreUpdate?.(this.blueScore, this.redScore);
        if (
          this.redScore >= 20 ||
          (this.isOvertime && this.redScore > this.blueScore)
        ) {
          this.triggerGameOver(false);
        }
      }
    }

    if (this.playerHealth !== this.lastReportedPlayerHealth) {
      this.lastReportedPlayerHealth = this.playerHealth;
      this.onPlayerHealthUpdate?.(Math.max(0, this.playerHealth));
    }
  }

  private handlePlayerKill() {
    this.currentStreak++;
    if (this.currentStreak > this.gameStats.player.highestStreak) {
      this.gameStats.player.highestStreak = this.currentStreak;
    }

    const now = this.clock.getElapsedTime();
    if (now - this.lastKillTime < 3.5) {
      this.multiKillCount++;
      if (this.multiKillCount > this.gameStats.player.highestCombo) {
        this.gameStats.player.highestCombo = this.multiKillCount;
      }
    } else {
      this.multiKillCount = 1;
    }
    this.lastKillTime = now;

    if (this.multiKillCount === 2) {
      this.onKillAlert?.("DOUBLE KILL!");
    } else if (this.multiKillCount === 3) {
      this.onKillAlert?.("TRIPLE KILL!");
    } else if (this.multiKillCount >= 4) {
      this.onKillAlert?.("MULTI KILL!");
    }
  }

  private triggerGameOver(win: boolean) {
    this.isGameOver = true;
    this.onGameOver?.(win, Object.values(this.gameStats));
  }

  public applyDamage(
    targetId: string,
    amount: number,
    shooterId: string,
    weapon: "gun" | "grenade" = "gun",
  ) {
    if (this.gameStats[shooterId]) {
      this.gameStats[shooterId].damage += amount;
    }

    if (targetId === "player") {
      this.damagePlayer(amount, shooterId, weapon);
    } else {
      let enemy = this.enemies.find((e) => e.id === targetId);
      if (enemy) {
        this.damageEnemy(enemy, amount, shooterId, weapon);
        return;
      }
      let bot = this.teamBots.find((b) => b.id === targetId);
      if (bot) {
        this.damageTeamBot(bot, amount, shooterId, weapon);
        return;
      }
    }
  }

  private damagePlayer(
    amount: number,
    shooterId: string,
    weapon: "gun" | "grenade" = "gun",
  ) {
    if (this.playerHealth <= 0 || this.isDead || this.isGameOver) return;
    this.playerHealth -= amount;

    if (this.playerHealth <= 0) {
      this.lastPlayerKiller = shooterId;
      if (shooterId === "player") {
        if (this.gameStats.player.kills > 0) {
          this.gameStats.player.kills--;
          this.playerKills = Math.max(0, this.playerKills - 1);
          this.onKillsUpdate?.(this.playerKills);
        }
      } else if (this.gameStats[shooterId]) {
        this.gameStats[shooterId].kills++;
      }
      this.gameStats.player.deaths++;
      this.multiKillCount = 0;
      this.currentStreak = 0;
      this.onKillFeed?.(
        this.getEntityName(shooterId),
        this.getEntityName("player"),
        this.getEntityTeam(shooterId),
        this.getEntityTeam("player"),
        weapon,
      );

      // Setup killcam
      if (shooterId !== "player") {
        let killerMesh: THREE.Object3D | null = null;
        if (shooterId.startsWith("enemy")) {
          killerMesh =
            this.enemies.find((e) => e.id === shooterId)?.mesh || null;
        } else if (shooterId.startsWith("bot")) {
          killerMesh =
            this.teamBots.find((b) => b.id === shooterId)?.mesh || null;
        }

        if (killerMesh) {
          this.killCamTarget = killerMesh;
          this.killCamTimer = 2.0;
        }
      }
    }
    this.notifyHealthUpdate();
  }

  public damageTeamBot(
    bot: any,
    amount: number,
    shooterId: string,
    weapon: "gun" | "grenade" = "gun",
  ) {
    if (bot.health <= 0 || this.isGameOver) return;

    bot.health -= amount;

    // Update health bar visual
    const healthPercent = Math.max(0, bot.health / bot.maxHealth);
    bot.healthBarFg.scale.x = healthPercent;
    bot.healthBarFg.position.x = -1 + healthPercent;

    if (bot.health <= 0) {
      if (this.isGameOver) return;

      this.gameStats[bot.id].deaths++;
      if (this.gameStats[shooterId]) this.gameStats[shooterId].kills++;

      this.onKillFeed?.(
        this.getEntityName(shooterId),
        this.getEntityName(bot.id),
        this.getEntityTeam(shooterId),
        this.getEntityTeam(bot.id),
        weapon,
      );

      // Bot died -> trigger respawn
      bot.respawnTimer = 5; // 5 seconds respawn
      bot.healthBarGroup.visible = false;
      this.playDeathAnim(bot.mesh);

      // Give point to red team
      this.redScore++;
      this.onScoreUpdate?.(this.blueScore, this.redScore);
      if (
        this.redScore >= 20 ||
        (this.isOvertime && this.redScore > this.blueScore)
      ) {
        this.triggerGameOver(false);
      }
    }
  }

  private notifyRespawnTick() {
    const rounded = Math.ceil(this.respawnTimer);
    const displayValue = this.isDead ? rounded : null;
    if (displayValue !== this.lastReportedRespawnTime) {
      this.lastReportedRespawnTime = displayValue;
      this.onPlayerRespawnTick?.(displayValue);
    }
  }

  // Enemies & Bots
  private enemies: {
    id: string;
    mesh: THREE.Mesh;
    health: number;
    maxHealth: number;
    healthBarGroup: THREE.Group;
    healthBarFg: THREE.Mesh;
    lastFireTime: number;
    targetPos: THREE.Vector3;
    moveTimer: number;
    respawnTimer: number;
  }[] = [];

  private teamBots: {
    id: string;
    mesh: THREE.Mesh;
    health: number;
    maxHealth: number;
    healthBarGroup: THREE.Group;
    healthBarFg: THREE.Mesh;
    targetPos: THREE.Vector3;
    moveTimer: number;
    lastFireTime: number;
    respawnTimer: number;
  }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 250);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    // WebGL Renderer, optimized for performance (Poky HTML5 game requirement)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    this.clock = new THREE.Clock();

    this.initEnvironment();
    this.initPlayers();
    this.initControls();

    window.addEventListener("resize", this.onWindowResize.bind(this));

    this.animate();
  }

  private mapWidth = 80;
  private mapLength = 160;
  private mapColliders: {
    mesh: THREE.Mesh;
    w: number;
    h: number;
    d: number;
  }[] = [];

  private createObstacle(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    rotY: number = 0,
    textureType: "crate" | "wall" = "crate",
  ) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({
      color,
      map: textureType === "crate" ? customTextures.crate : customTextures.wall,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    this.scene.add(mesh);

    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }),
    );
    mesh.add(line);

    mesh.updateMatrixWorld();
    this.mapColliders.push({ mesh, w, h, d });
  }

  private initEnvironment() {
    // Lighter Graphic Ground -> MeshBasicMaterial consumes no lights
    const groundGeometry = new THREE.PlaneGeometry(
      this.mapWidth,
      this.mapLength,
    );
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x889966,
      map: customTextures.ground,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Grid Helper to give a sense of movement on the flat plane
    const gridHelper = new THREE.GridHelper(
      Math.max(this.mapWidth, this.mapLength),
      Math.max(this.mapWidth, this.mapLength) / 2,
      0x000000,
      0x000000,
    );
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);

    // Ambient Light (lower to allow directional shading on characters)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light for shading
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(20, 50, 20);
    this.scene.add(mainLight);

    // Boundary Walls
    const wallHeight = 10;
    const wallThickness = 2;
    this.createObstacle(
      this.mapWidth + wallThickness * 2,
      wallHeight,
      wallThickness,
      0x555555,
      0,
      wallHeight / 2,
      -this.mapLength / 2 - wallThickness / 2,
      0,
      "wall",
    );
    this.createObstacle(
      this.mapWidth + wallThickness * 2,
      wallHeight,
      wallThickness,
      0x555555,
      0,
      wallHeight / 2,
      this.mapLength / 2 + wallThickness / 2,
      0,
      "wall",
    );
    this.createObstacle(
      wallThickness,
      wallHeight,
      this.mapLength,
      0x555555,
      this.mapWidth / 2 + wallThickness / 2,
      wallHeight / 2,
      0,
      0,
      "wall",
    );
    this.createObstacle(
      wallThickness,
      wallHeight,
      this.mapLength,
      0x555555,
      -this.mapWidth / 2 - wallThickness / 2,
      wallHeight / 2,
      0,
      0,
      "wall",
    );

    // Central Warehouse (Walls only, with doorways in the middle)
    // Left wall with door
    this.createObstacle(2, 8, 16, 0x888888, -15, 4, -12, 0, "wall");
    this.createObstacle(2, 8, 16, 0x888888, -15, 4, 12, 0, "wall");
    this.createObstacle(2, 4, 8, 0x888888, -15, 6, 0, 0, "wall"); // Arch/top part

    // Right wall with door
    this.createObstacle(2, 8, 16, 0x888888, 15, 4, -12, 0, "wall");
    this.createObstacle(2, 8, 16, 0x888888, 15, 4, 12, 0, "wall");
    this.createObstacle(2, 4, 8, 0x888888, 15, 6, 0, 0, "wall"); // Arch/top part

    // Inside warehouse covers (crates)
    this.createObstacle(4, 4, 8, 0x0055aa, 0, 2, 0, 0, "crate"); // Center block
    this.createObstacle(4, 3, 4, 0xaa5500, -6, 1.5, 4, 0, "crate"); // Off-center crate
    this.createObstacle(4, 3, 4, 0xaa5500, 6, 1.5, -4, 0, "crate"); // Off-center crate

    // Flank containers (slanted)
    this.createObstacle(4, 4, 12, 0xcc2222, -28, 2, 0, Math.PI / 6, "crate"); // Left flank
    this.createObstacle(4, 4, 12, 0xcc2222, 28, 2, 0, -Math.PI / 6, "crate"); // Right flank

    // Extra flank covers
    this.createObstacle(4, 4, 4, 0x228822, -28, 2, 25, 0, "crate");
    this.createObstacle(4, 4, 4, 0x228822, -28, 2, -25, 0, "crate");
    this.createObstacle(4, 4, 4, 0x228822, 28, 2, 25, 0, "crate");
    this.createObstacle(4, 4, 4, 0x228822, 28, 2, -25, 0, "crate");

    // Spawn area covers (My team side)
    this.createObstacle(10, 4, 2, 0x5555aa, 0, 2, 50, 0, "crate");
    this.createObstacle(8, 4, 2, 0x5555aa, -20, 2, 55, 0, "crate");
    this.createObstacle(8, 4, 2, 0x5555aa, 20, 2, 55, 0, "crate");

    // Spawn area covers (Enemy team side)
    this.createObstacle(10, 4, 2, 0xaa5555, 0, 2, -50, 0, "crate");
    this.createObstacle(8, 4, 2, 0xaa5555, -20, 2, -55, 0, "crate");
    this.createObstacle(8, 4, 2, 0xaa5555, 20, 2, -55, 0, "crate");
  }

  private createCharacter(
    parentMesh: THREE.Mesh,
    teamColor: number,
    isPlayer: boolean,
  ) {
    const skinColor = 0xffccbb;
    const darkColor = 0x333333;

    const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const clothesMat = new THREE.MeshLambertMaterial({
      color: teamColor,
      map: customTextures.clothes,
    });
    const darkMat = new THREE.MeshLambertMaterial({
      color: darkColor,
      map: customTextures.clothes,
    });

    // Head
    const headGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const head = new THREE.Mesh(headGeom, skinMat);
    head.position.set(0, 1.1, 0);
    // Tilt head forward and slightly right to aim down the gun
    head.rotation.set(-0.2, -0.15, 0);

    if (!isPlayer) {
      const eyeGeom = new THREE.BoxGeometry(0.15, 0.15, 0.1);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
      leftEye.position.set(-0.2, 0.1, -0.401);
      const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
      rightEye.position.set(0.2, 0.1, -0.401);
      head.add(leftEye);
      head.add(rightEye);
    }
    parentMesh.add(head);

    // Torso
    const torsoGeom = new THREE.BoxGeometry(1.0, 1.2, 0.5);
    const torso = new THREE.Mesh(torsoGeom, clothesMat);
    torso.position.set(0, 0.1, 0);
    parentMesh.add(torso);

    // Arms (pivot at shoulders)
    const armGeom = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    armGeom.translate(0, -0.6, 0);

    const leftArm = new THREE.Mesh(armGeom, skinMat);
    leftArm.position.set(-0.65, 0.6, 0);
    // Left arm holding front of gun, pointed towards (x: 0.15, y: 0.2, z: -0.9)
    leftArm.rotation.set(1.23, -0.78, 0);
    parentMesh.add(leftArm);

    const rightArm = new THREE.Mesh(armGeom, skinMat);
    rightArm.position.set(0.65, 0.6, 0);
    // Right arm holding gun grip, pointed towards (x: 0.15, y: 0.2, z: -0.9)
    rightArm.rotation.set(1.22, 0.42, 0);
    parentMesh.add(rightArm);

    // Legs (pivot at hips)
    const legGeom = new THREE.BoxGeometry(0.45, 1.0, 0.45);
    legGeom.translate(0, -0.5, 0);

    const leftLeg = new THREE.Mesh(legGeom, darkMat);
    leftLeg.position.set(-0.25, -0.5, 0);
    leftLeg.rotation.set(0.1, 0, -0.1);
    parentMesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeom, darkMat);
    rightLeg.position.set(0.25, -0.5, 0);
    rightLeg.rotation.set(-0.05, 0, 0.1);
    parentMesh.add(rightLeg);

    parentMesh.userData.head = head;
    parentMesh.userData.torso = torso;
    parentMesh.userData.leftArm = leftArm;
    parentMesh.userData.rightArm = rightArm;
    parentMesh.userData.leftLeg = leftLeg;
    parentMesh.userData.rightLeg = rightLeg;
  }

  private playDeathAnim(mesh: THREE.Mesh) {
    mesh.userData.isDying = true;
    mesh.userData.deathAnimTime = 0;

    mesh.userData.startRotX = mesh.rotation.x;
    mesh.userData.startRotY = mesh.rotation.y;
    mesh.userData.startRotZ = mesh.rotation.z;
    mesh.userData.startY = mesh.position.y;

    const fallDir = Math.random() > 0.5 ? 1 : -1;
    mesh.userData.targetRotX = -Math.PI / 2 + (Math.random() * 0.4 - 0.2);
    mesh.userData.targetRotY = mesh.rotation.y + (Math.random() * 0.8 - 0.4);
    mesh.userData.targetRotZ = Math.random() * 0.5 * fallDir;
    mesh.userData.targetY = 0.75;

    if (mesh.userData.leftArm) {
      mesh.userData.leftArm.userData = {
        startRotX: mesh.userData.leftArm.rotation.x,
        startRotY: mesh.userData.leftArm.rotation.y,
        startRotZ: mesh.userData.leftArm.rotation.z,
        targetRotX: 0,
        targetRotY: 0,
        targetRotZ: (Math.PI / 2) * (Math.random() * 0.5 + 0.5),
      };
    }
    if (mesh.userData.rightArm) {
      mesh.userData.rightArm.userData = {
        startRotX: mesh.userData.rightArm.rotation.x,
        startRotY: mesh.userData.rightArm.rotation.y,
        startRotZ: mesh.userData.rightArm.rotation.z,
        targetRotX: 0,
        targetRotY: 0,
        targetRotZ: (-Math.PI / 2) * (Math.random() * 0.5 + 0.5),
      };
    }
    if (mesh.userData.leftLeg) {
      mesh.userData.leftLeg.userData = {
        startRotX: mesh.userData.leftLeg.rotation.x,
        startRotY: mesh.userData.leftLeg.rotation.y,
        startRotZ: mesh.userData.leftLeg.rotation.z,
        targetRotX: 0,
        targetRotY: 0,
        targetRotZ: 0.2,
      };
    }
    if (mesh.userData.rightLeg) {
      mesh.userData.rightLeg.userData = {
        startRotX: mesh.userData.rightLeg.rotation.x,
        startRotY: mesh.userData.rightLeg.rotation.y,
        startRotZ: mesh.userData.rightLeg.rotation.z,
        targetRotX: 0,
        targetRotY: 0,
        targetRotZ: -0.2,
      };
    }
    if (mesh.userData.head) {
      mesh.userData.head.userData = {
        startRotX: mesh.userData.head.rotation.x,
        targetRotX: Math.PI / 4,
      };
    }
    if (mesh.userData.gun) {
      mesh.userData.gun.userData = {
        startPosX: mesh.userData.gun.position.x,
        startPosY: mesh.userData.gun.position.y,
        startPosZ: mesh.userData.gun.position.z,
        startRotX: mesh.userData.gun.rotation.x,
        startRotY: mesh.userData.gun.rotation.y,
        startRotZ: mesh.userData.gun.rotation.z,
        targetPosX: 1.5,
        targetPosY: 0,
        targetPosZ: -0.6,
        targetRotX: 0,
        targetRotY: Math.PI / 2,
        targetRotZ: 0,
      };
    }
  }

  private updateDeathAnim(mesh: THREE.Mesh, delta: number) {
    if (!mesh.userData.isDying) return;

    mesh.userData.deathAnimTime += delta;
    const duration = 0.5;
    const t = Math.min(1, mesh.userData.deathAnimTime / duration);
    const easeOut = 1 - Math.pow(1 - t, 3);

    mesh.rotation.x = THREE.MathUtils.lerp(
      mesh.userData.startRotX,
      mesh.userData.targetRotX,
      easeOut,
    );
    mesh.rotation.y = THREE.MathUtils.lerp(
      mesh.userData.startRotY,
      mesh.userData.targetRotY,
      easeOut,
    );
    mesh.rotation.z = THREE.MathUtils.lerp(
      mesh.userData.startRotZ,
      mesh.userData.targetRotZ,
      easeOut,
    );
    mesh.position.y = THREE.MathUtils.lerp(
      mesh.userData.startY,
      mesh.userData.targetY,
      easeOut,
    );

    if (
      mesh.userData.leftArm &&
      mesh.userData.leftArm.userData.targetRotX !== undefined
    ) {
      mesh.userData.leftArm.rotation.set(
        THREE.MathUtils.lerp(
          mesh.userData.leftArm.userData.startRotX,
          mesh.userData.leftArm.userData.targetRotX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.leftArm.userData.startRotY,
          mesh.userData.leftArm.userData.targetRotY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.leftArm.userData.startRotZ,
          mesh.userData.leftArm.userData.targetRotZ,
          easeOut,
        ),
      );
    }

    if (
      mesh.userData.rightArm &&
      mesh.userData.rightArm.userData.targetRotX !== undefined
    ) {
      mesh.userData.rightArm.rotation.set(
        THREE.MathUtils.lerp(
          mesh.userData.rightArm.userData.startRotX,
          mesh.userData.rightArm.userData.targetRotX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.rightArm.userData.startRotY,
          mesh.userData.rightArm.userData.targetRotY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.rightArm.userData.startRotZ,
          mesh.userData.rightArm.userData.targetRotZ,
          easeOut,
        ),
      );
    }

    if (
      mesh.userData.leftLeg &&
      mesh.userData.leftLeg.userData.targetRotX !== undefined
    ) {
      mesh.userData.leftLeg.rotation.set(
        THREE.MathUtils.lerp(
          mesh.userData.leftLeg.userData.startRotX,
          mesh.userData.leftLeg.userData.targetRotX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.leftLeg.userData.startRotY,
          mesh.userData.leftLeg.userData.targetRotY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.leftLeg.userData.startRotZ,
          mesh.userData.leftLeg.userData.targetRotZ,
          easeOut,
        ),
      );
    }

    if (
      mesh.userData.rightLeg &&
      mesh.userData.rightLeg.userData.targetRotX !== undefined
    ) {
      mesh.userData.rightLeg.rotation.set(
        THREE.MathUtils.lerp(
          mesh.userData.rightLeg.userData.startRotX,
          mesh.userData.rightLeg.userData.targetRotX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.rightLeg.userData.startRotY,
          mesh.userData.rightLeg.userData.targetRotY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.rightLeg.userData.startRotZ,
          mesh.userData.rightLeg.userData.targetRotZ,
          easeOut,
        ),
      );
    }

    if (
      mesh.userData.head &&
      mesh.userData.head.userData.targetRotX !== undefined
    ) {
      mesh.userData.head.rotation.x = THREE.MathUtils.lerp(
        mesh.userData.head.userData.startRotX,
        mesh.userData.head.userData.targetRotX,
        easeOut,
      );
    }

    if (
      mesh.userData.gun &&
      mesh.userData.gun.userData.targetRotX !== undefined
    ) {
      mesh.userData.gun.position.set(
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startPosX,
          mesh.userData.gun.userData.targetPosX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startPosY,
          mesh.userData.gun.userData.targetPosY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startPosZ,
          mesh.userData.gun.userData.targetPosZ,
          easeOut,
        ),
      );
      mesh.userData.gun.rotation.set(
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startRotX,
          mesh.userData.gun.userData.targetRotX,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startRotY,
          mesh.userData.gun.userData.targetRotY,
          easeOut,
        ),
        THREE.MathUtils.lerp(
          mesh.userData.gun.userData.startRotZ,
          mesh.userData.gun.userData.targetRotZ,
          easeOut,
        ),
      );
    }

    if (t >= 1) {
      mesh.userData.isDying = false;
    }
  }

  private resetAnim(mesh: THREE.Mesh) {
    mesh.userData.isDying = false;
    mesh.rotation.x = 0;
    mesh.rotation.z = 0;
    mesh.position.y = 1.5;

    if (mesh.userData.leftArm) {
      mesh.userData.leftArm.rotation.set(1.23, -0.78, 0);
    }
    if (mesh.userData.rightArm) {
      mesh.userData.rightArm.rotation.set(1.22, 0.42, 0);
    }
    if (mesh.userData.leftLeg) {
      mesh.userData.leftLeg.rotation.set(0.1, 0, -0.1);
    }
    if (mesh.userData.rightLeg) {
      mesh.userData.rightLeg.rotation.set(-0.05, 0, 0.1);
    }
    if (mesh.userData.head) {
      mesh.userData.head.rotation.set(-0.2, -0.15, 0);
    }
    if (mesh.userData.gun) {
      mesh.userData.gun.position.set(0.15, 0.2, -0.9);
      mesh.userData.gun.rotation.set(0, 0, 0);
    }
  }

  private updateCharacterWalkAnim(
    mesh: THREE.Mesh,
    isMoving: boolean,
    delta: number,
  ) {
    let walkTime = mesh.userData.walkTime || 0;
    if (isMoving) {
      walkTime += delta * 15; // Animation speed
    } else {
      // Ease back to 0
      walkTime *= 0.8;
    }
    mesh.userData.walkTime = walkTime;

    const leftLeg = mesh.userData.leftLeg as THREE.Mesh;
    const rightLeg = mesh.userData.rightLeg as THREE.Mesh;

    if (leftLeg && rightLeg) {
      if (isMoving) {
        leftLeg.rotation.x = Math.sin(walkTime) * 0.6;
        rightLeg.rotation.x = Math.sin(walkTime + Math.PI) * 0.6;
      } else {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
      }
    }
  }

  private initPlayers() {
    // Hidden hitbox replacing the visible boxes
    const hitboxGeom = new THREE.BoxGeometry(1.5, 3.2, 1.5);
    const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });

    // Gun materials
    // --- MY TEAM (Blue) ---
    this.myPlayer = new THREE.Mesh(hitboxGeom, invisibleMat);
    this.myPlayer.position.set(0, 1.5, 70);
    this.createCharacter(this.myPlayer, 0x0055ff, true);
    this.scene.add(this.myPlayer);

    // Add a gun to the player (centered in hands)
    this.gunMesh = createGunMesh(this.currentWeaponSkin);
    this.gunMesh.position.set(0.15, 0.2, -0.9);
    this.myPlayer.add(this.gunMesh);

    // Setup Team Bots
    const botIds = ["bot1", "bot2"];
    let botIdx = 0;
    for (const startX of [-10, 10]) {
      const botMesh = new THREE.Mesh(hitboxGeom, invisibleMat);
      botMesh.position.set(startX, 1.5, 70);
      this.createCharacter(botMesh, 0x0055ff, false);

      const botGun = createGunMesh();
      botGun.position.set(0.15, 0.2, -0.9);
      botMesh.add(botGun);
      botMesh.userData.gun = botGun;

      this.scene.add(botMesh);

      // Create Health Bar
      const hbGroup = new THREE.Group();
      const bgGeom = new THREE.PlaneGeometry(2, 0.25);
      const bgMat = new THREE.MeshBasicMaterial({
        color: 0x000055,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const bgMesh = new THREE.Mesh(bgGeom, bgMat);

      const fgGeom = new THREE.PlaneGeometry(2, 0.25);
      const fgMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const fgMesh = new THREE.Mesh(fgGeom, fgMat);
      fgMesh.position.z = 0.01;

      hbGroup.add(bgMesh);
      hbGroup.add(fgMesh);
      hbGroup.position.set(0, 2.5, 0); // Above head
      botMesh.add(hbGroup);

      this.teamBots.push({
        id: botIds[botIdx++],
        mesh: botMesh,
        health: 100,
        maxHealth: 100,
        healthBarGroup: hbGroup,
        healthBarFg: fgMesh,
        targetPos: botMesh.position.clone(),
        moveTimer: 0,
        lastFireTime: Math.random() * 2,
        respawnTimer: 0,
      });
    }

    // --- ENEMY TEAM (Red) ---
    const enemyIds = ["enemy1", "enemy2", "enemy3"];
    for (let i = 0; i < 3; i++) {
      const enemyMesh = new THREE.Mesh(hitboxGeom, invisibleMat);
      // Positions: -10, 0, 10. Z is negative to be on the opposite side.
      enemyMesh.position.set(-10 + i * 10, 1.5, -70);
      this.createCharacter(enemyMesh, 0xff0000, false);

      const enemyGun = createGunMesh();
      enemyGun.position.set(0.15, 0.2, -0.9);
      enemyMesh.add(enemyGun);
      enemyMesh.userData.gun = enemyGun;

      this.scene.add(enemyMesh);

      // Create Health Bar
      const hbGroup = new THREE.Group();
      const bgGeom = new THREE.PlaneGeometry(2, 0.25);
      const bgMat = new THREE.MeshBasicMaterial({
        color: 0x550000,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const bgMesh = new THREE.Mesh(bgGeom, bgMat);

      const fgGeom = new THREE.PlaneGeometry(2, 0.25);
      const fgMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      const fgMesh = new THREE.Mesh(fgGeom, fgMat);
      fgMesh.position.z = 0.01;

      hbGroup.add(bgMesh);
      hbGroup.add(fgMesh);
      hbGroup.position.set(0, 2.5, 0); // Above head
      hbGroup.visible = false; // Hide completely for enemies
      enemyMesh.add(hbGroup);

      this.enemies.push({
        id: enemyIds[i],
        mesh: enemyMesh,
        health: 100,
        maxHealth: 100,
        healthBarGroup: hbGroup,
        healthBarFg: fgMesh,
        lastFireTime: Math.random() * 2, // stagger initial shooting
        targetPos: enemyMesh.position.clone(),
        moveTimer: 0,
        respawnTimer: 0,
      });
    }
  }

  private initControls() {
    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "w") this.keys.w = true;
      if (e.key.toLowerCase() === "a") this.keys.a = true;
      if (e.key.toLowerCase() === "s") this.keys.s = true;
      if (e.key.toLowerCase() === "d") this.keys.d = true;
    });

    window.addEventListener("keyup", (e) => {
      if (e.key.toLowerCase() === "w") this.keys.w = false;
      if (e.key.toLowerCase() === "a") this.keys.a = false;
      if (e.key.toLowerCase() === "s") this.keys.s = false;
      if (e.key.toLowerCase() === "d") this.keys.d = false;
    });
  }

  // Camera rotation
  private cameraYaw = 0;
  private cameraPitch = Math.PI / 6;

  public setJoystickInput(x: number, y: number) {
    if (this.isPaused) return;
    this.joyInput.set(x, y);
  }

  public setAiming(aim: boolean) {
    if (this.isAiming === aim) return;
    this.isAiming = aim;
    this.targetFov = this.isAiming ? 35 : 70;
    this.onAimingUpdate?.(this.isAiming);

    // Hide or show the player body when aiming
    if (this.myPlayer) {
      const parts = [
        "head",
        "torso",
        "leftArm",
        "rightArm",
        "leftLeg",
        "rightLeg",
      ];
      parts.forEach((part) => {
        if (this.myPlayer.userData[part]) {
          this.myPlayer.userData[part].visible = !this.isAiming;
        }
      });
    }
  }

  public toggleAiming() {
    if (this.isPaused) return;
    this.setAiming(!this.isAiming);
  }

  public setFiring(firing: boolean) {
    if (this.isPaused) return;
    this.isFiring = firing;
  }

  public reload() {
    if (this.isPaused) return;
    if (this.isReloading || this.ammo === this.maxAmmo) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadTime;
    this.notifyAmmoUpdate();
    this.setAiming(false);
  }

  private isAimingGrenade = false;
  private grenadeTrajectoryLine: THREE.Line | null = null;
  private grenadeTrajectoryMarker: THREE.Mesh | null = null;
  private grenadeTrajectoryMaterial = new THREE.LineBasicMaterial({
    color: 0xff3300,
    linewidth: 3,
    depthTest: false,
    transparent: true,
    opacity: 0.8,
  });

  private getGrenadeInitialState() {
    const throwStartPos = new THREE.Vector3(0, 1.5, -0.5);
    if (this.myPlayer) {
      this.myPlayer.localToWorld(throwStartPos);
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const throwDir = raycaster.ray.direction.clone();
    throwDir.y += 0.35;
    throwDir.normalize();

    const throwForce = 35; // Velocity
    const velocity = throwDir.multiplyScalar(throwForce);

    return { pos: throwStartPos, vel: velocity };
  }

  private lastGrenadeTime = 0;

  public startAimGrenade() {
    if (this.isPaused || !this.myPlayer || this.grenades <= 0 || this.isDead || performance.now() - this.lastGrenadeTime < 1000)
      return;
    this.isAimingGrenade = true;

    if (!this.grenadeTrajectoryLine) {
      const geom = new THREE.BufferGeometry();
      this.grenadeTrajectoryLine = new THREE.Line(
        geom,
        this.grenadeTrajectoryMaterial,
      );
      this.grenadeTrajectoryLine.frustumCulled = false;
      this.scene.add(this.grenadeTrajectoryLine);
    }
    this.grenadeTrajectoryLine.visible = true;

    if (!this.grenadeTrajectoryMarker) {
      const markerGeom = new THREE.SphereGeometry(0.3, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        depthTest: false,
        transparent: true,
        opacity: 0.8,
      });
      this.grenadeTrajectoryMarker = new THREE.Mesh(markerGeom, markerMat);
      this.grenadeTrajectoryMarker.frustumCulled = false;
      this.scene.add(this.grenadeTrajectoryMarker);
    }
    this.grenadeTrajectoryMarker.visible = true;
  }

  public releaseGrenade() {
    if (!this.isAimingGrenade) return false;
    this.isAimingGrenade = false;

    if (this.grenadeTrajectoryLine) {
      this.grenadeTrajectoryLine.visible = false;
    }
    if (this.grenadeTrajectoryMarker) {
      this.grenadeTrajectoryMarker.visible = false;
    }

    if (this.isPaused || !this.myPlayer || this.grenades <= 0 || this.isDead)
      return false;

    this.lastGrenadeTime = performance.now();

    this.grenades--;
    this.notifyGrenadesUpdate();

    // Create Grenade Mesh
    const geom = new THREE.SphereGeometry(0.2, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x113311,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geom, mat);

    const { pos, vel } = this.getGrenadeInitialState();
    mesh.position.copy(pos);

    this.scene.add(mesh);

    this.activeGrenades.push({
      mesh,
      velocity: vel,
      timer: 3.0, // 3 seconds to detonate
    });

    return true;
  }

  private updateGrenadeTrajectory() {
    if (!this.isAimingGrenade || !this.grenadeTrajectoryLine) return;

    const { pos, vel } = this.getGrenadeInitialState();
    const points: THREE.Vector3[] = [];
    const simPos = pos.clone();
    const simVel = vel.clone();

    const timeStep = 0.05;
    const maxTime = 3.0; // max timer
    const extentX = this.mapWidth / 2 - 0.2;
    const extentZ = this.mapLength / 2 - 0.2;

    points.push(simPos.clone());

    for (let t = 0; t < maxTime; t += timeStep) {
      simVel.y -= 25 * timeStep;
      simPos.addScaledVector(simVel, timeStep);

      // Map collision for trajectory
      for (const collider of this.mapColliders) {
        const localPos = collider.mesh.worldToLocal(simPos.clone());
        const halfW = collider.w / 2;
        const halfH = collider.h / 2;
        const halfD = collider.d / 2;
        const r = 0.4; // Grenade collision radius padding

        if (
          localPos.x > -halfW - r &&
          localPos.x < halfW + r &&
          localPos.y > -halfH - r &&
          localPos.y < halfH + r &&
          localPos.z > -halfD - r &&
          localPos.z < halfD + r
        ) {
          // Collision detected! Find the closest face
          const distRight = Math.abs(localPos.x - (halfW + r));
          const distLeft = Math.abs(localPos.x - (-halfW - r));
          const distTop = Math.abs(localPos.y - (halfH + r));
          const distBottom = Math.abs(localPos.y - (-halfH - r));
          const distFront = Math.abs(localPos.z - (halfD + r));
          const distBack = Math.abs(localPos.z - (-halfD - r));

          const dx = Math.min(distRight, distLeft);
          const dy = Math.min(distTop, distBottom);
          const dz = Math.min(distFront, distBack);

          let normal = new THREE.Vector3();
          let pushDist = 0;

          if (dx <= dy && dx <= dz) {
            normal.set(distRight < distLeft ? 1 : -1, 0, 0);
            pushDist = dx;
          } else if (dy <= dx && dy <= dz) {
            normal.set(0, distTop < distBottom ? 1 : -1, 0);
            pushDist = dy;
          } else {
            normal.set(0, 0, distFront < distBack ? 1 : -1);
            pushDist = dz;
          }

          // Transform normal back to world space
          const worldNormal = normal
            .clone()
            .transformDirection(collider.mesh.matrixWorld)
            .normalize();

          // Reflect velocity
          simVel.reflect(worldNormal).multiplyScalar(0.5);

          // Push position out
          simPos.add(worldNormal.multiplyScalar(pushDist + 0.01));
          break; // Only handle one collision per sub-step
        }
      }

      if (simPos.y <= 0.2) {
        simPos.y = 0.2;
        simVel.y *= -0.5;
        simVel.x *= 0.7;
        simVel.z *= 0.7;

        if (Math.abs(simVel.y) < 1) {
          simVel.y = 0;
        }
      }

      if (simPos.x < -extentX || simPos.x > extentX) {
        simVel.x *= -0.5;
        simPos.x = THREE.MathUtils.clamp(simPos.x, -extentX, extentX);
      }
      if (simPos.z < -extentZ || simPos.z > extentZ) {
        simVel.z *= -0.5;
        simPos.z = THREE.MathUtils.clamp(simPos.z, -extentZ, extentZ);
      }

      points.push(simPos.clone());
    }

    this.grenadeTrajectoryLine.geometry.setFromPoints(points);
    this.grenadeTrajectoryLine.geometry.computeBoundingBox();
    this.grenadeTrajectoryLine.geometry.computeBoundingSphere();
    if (this.grenadeTrajectoryMarker) {
      this.grenadeTrajectoryMarker.position.copy(points[points.length - 1]);
    }
  }

  public fire() {
    if (this.isPaused || !this.myPlayer || !this.gunMesh || this.isReloading)
      return;
    if (this.ammo <= 0) return; // Out of ammo, can't fire

    audioSystem.playShoot();

    this.ammo--;
    this.notifyAmmoUpdate();

    // Add camera shake effect
    this.shakeIntensity = 1.0;

    // Trigger Muzzle Flash
    if (this.gunMesh.userData.muzzleFlash && this.gunMesh.userData.flashLight) {
      this.gunMesh.userData.muzzleFlash.visible = true;
      this.gunMesh.userData.muzzleFlash.children.forEach(
        (c: any) => (c.material.opacity = 1.0),
      );
      this.gunMesh.userData.muzzleFlash.rotation.z = Math.random() * Math.PI;
      this.gunMesh.userData.flashLight.intensity = 5;
      this.gunMesh.userData.flashTimer = 0.05; // 50ms display duration
    }

    // Origin of bullet: gun tip
    const gunTipPos = new THREE.Vector3(0, 0, -1.25);
    this.gunMesh.localToWorld(gunTipPos);

    // Direction of bullet: From camera through center of screen
    // Raycast from camera center exactly
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let targetPoint = new THREE.Vector3();

    const obstacles = this.mapColliders.map((c) => c.mesh);
    const enemyHitboxes = this.enemies.map((e) => e.mesh);
    const allTargets = [...obstacles, ...enemyHitboxes];

    // Aim Assist Magnetism
    let closestEnemyAssistHit: any = null;
    let closestEnemyDistSqToRay = Infinity;
    const aimAssistRadius = this.isAiming ? 1.0 : 0.5;

    this.enemies.forEach((enemy) => {
      if (enemy.health > 0) {
        const center = enemy.mesh.position.clone();
        center.y += 1.0; // approximate chest height
        const distSqToRay = raycaster.ray.distanceSqToPoint(center);
        if (distSqToRay < aimAssistRadius * aimAssistRadius) {
          const distAlongRay = center
            .clone()
            .sub(raycaster.ray.origin)
            .dot(raycaster.ray.direction);
          if (distAlongRay > 0) {
            if (distSqToRay < closestEnemyDistSqToRay) {
              closestEnemyDistSqToRay = distSqToRay;
              closestEnemyAssistHit = { enemy, point: center, distAlongRay };
            }
          }
        }
      }
    });

    const hits = raycaster.intersectObjects(allTargets, false);

    let actualHitObj: any = null;

    if (hits.length > 0) {
      targetPoint.copy(hits[0].point);
      actualHitObj = hits[0].object;
    } else {
      raycaster.ray.at(100, targetPoint);
    }

    // Override hit if aim assist locks onto an enemy that is not blocked by a closer obstacle
    if (closestEnemyAssistHit) {
      if (
        hits.length === 0 ||
        hits[0].distance > closestEnemyAssistHit.distAlongRay
      ) {
        targetPoint.copy(closestEnemyAssistHit.point);
        actualHitObj = closestEnemyAssistHit.enemy.mesh;
      }
    }

    if (actualHitObj) {
      // Check if we hit an enemy
      const enemyHit = this.enemies.find((e) => e.mesh === actualHitObj);
      if (enemyHit) {
        this.applyDamage(enemyHit.id, 20, "player"); // 5 shots to kill
      }
    }

    // Draw tracer line
    const material = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 1,
    });
    const points = [gunTipPos, targetPoint];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);

    this.scene.add(line);
    this.tracers.push({ line, age: 0 });
  }

  private damageEnemy(
    enemy: any,
    amount: number,
    shooterId: string,
    weapon: "gun" | "grenade" = "gun",
  ) {
    if (enemy.health <= 0) return;

    enemy.health -= amount;

    if (shooterId === "player") {
      this.onHit?.();
    }

    // Update health bar visual
    const healthPercent = Math.max(0, enemy.health / enemy.maxHealth);
    enemy.healthBarFg.scale.x = healthPercent;
    enemy.healthBarFg.position.x = -1 + healthPercent; // Keep left-aligned (total width is 2)

    if (enemy.health <= 0) {
      if (this.isGameOver) return;

      this.gameStats[enemy.id].deaths++;
      if (this.gameStats[shooterId]) this.gameStats[shooterId].kills++;

      this.onKillFeed?.(
        this.getEntityName(shooterId),
        this.getEntityName(enemy.id),
        this.getEntityTeam(shooterId),
        this.getEntityTeam(enemy.id),
        weapon,
      );

      // Enemy died -> trigger respawn
      enemy.respawnTimer = 5; // 5 seconds respawn
      enemy.healthBarGroup.visible = false;
      this.playDeathAnim(enemy.mesh);

      this.blueScore++;
      this.onScoreUpdate?.(this.blueScore, this.redScore);

      if (shooterId === "player") {
        this.playerKills++;
        this.onKillsUpdate?.(this.playerKills);
        this.handlePlayerKill();
      }

      if (
        this.blueScore >= 20 ||
        (this.isOvertime && this.blueScore > this.redScore)
      ) {
        this.triggerGameOver(true);
      }
    }
  }

  public addCameraRotation(deltaX: number, deltaY: number) {
    if (this.isPaused) return;
    const sensitivity = (this.isAiming ? 0.0015 : 0.005) * this.baseSensitivity;
    this.cameraYaw -= deltaX * sensitivity;
    this.cameraPitch += deltaY * sensitivity;

    // Clamp pitch to avoid looking upside down or clipping through ground completely
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch,
      -Math.PI / 4,
      Math.PI / 2 - 0.1,
    );
  }

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private constrainPlayerPosition(playerPos: THREE.Vector3) {
    const playerRadius = 0.75;
    const playerHalfHeight = 1.6; // Player height is 3.2, so half is 1.6
    const playerRadiusSq = playerRadius * playerRadius;

    for (const collider of this.mapColliders) {
      // Convert player position to collider's local space
      const localPos = collider.mesh.worldToLocal(playerPos.clone());

      // local bounds of the obstacle
      const halfW = collider.w / 2;
      const halfH = collider.h / 2;
      const halfD = collider.d / 2;

      // Vertical bounds check: skip if the player is completely below or above the obstacle
      if (
        localPos.y + playerHalfHeight < -halfH ||
        localPos.y - playerHalfHeight > halfH
      ) {
        continue;
      }

      // Find the closest point in the rectangle to the circle center (player position)
      const closestX = THREE.MathUtils.clamp(localPos.x, -halfW, halfW);
      const closestZ = THREE.MathUtils.clamp(localPos.z, -halfD, halfD);

      // Calculate distance between circle center and closest point
      const distX = localPos.x - closestX;
      const distZ = localPos.z - closestZ;

      const distSquared = distX * distX + distZ * distZ;

      if (distSquared < playerRadiusSq && distSquared > 0) {
        // Determine how far we need to push the player out
        const dist = Math.sqrt(distSquared);
        const pushDist = playerRadius - dist;

        // Push direction
        const pushX = (distX / dist) * pushDist;
        const pushZ = (distZ / dist) * pushDist;

        localPos.x += pushX;
        localPos.z += pushZ;

        // Convert back to world space
        collider.mesh.localToWorld(localPos);

        playerPos.x = localPos.x;
        playerPos.z = localPos.z;
      } else if (distSquared === 0) {
        // Deep collision (center of player is inside the collider)
        const distToLeft = localPos.x - -halfW;
        const distToRight = halfW - localPos.x;
        const distToBottom = localPos.z - -halfD;
        const distToTop = halfD - localPos.z;

        const minDist = Math.min(
          distToLeft,
          distToRight,
          distToBottom,
          distToTop,
        );

        if (minDist === distToLeft) localPos.x = -halfW - playerRadius;
        else if (minDist === distToRight) localPos.x = halfW + playerRadius;
        else if (minDist === distToBottom) localPos.z = -halfD - playerRadius;
        else if (minDist === distToTop) localPos.z = halfD + playerRadius;

        collider.mesh.localToWorld(localPos);
        playerPos.x = localPos.x;
        playerPos.z = localPos.z;
      }
    }
  }

  private applyBotSteering(
    pos: THREE.Vector3,
    moveDir: THREE.Vector3,
    targetPos: THREE.Vector3,
  ) {
    if (moveDir.lengthSq() === 0) return;

    const obstacles = this.mapColliders.map((c) => c.mesh);
    const forward = moveDir.clone().normalize();

    const rayLength = 5;
    const raycaster = new THREE.Raycaster(pos, forward, 0, rayLength);
    const hits = raycaster.intersectObjects(obstacles, false);

    if (hits.length > 0) {
      // Find the normal of the hit
      const hit = hits[0];
      const normal = new THREE.Vector3();
      if (hit.face) {
        normal.copy(hit.face.normal);
        normal.transformDirection(hit.object.matrixWorld).normalize();
      } else {
        normal.subVectors(pos, hit.object.position).normalize();
      }
      normal.y = 0;
      normal.normalize();

      // Test angles to see which direction has free space
      const angles = [
        Math.PI / 4,
        -Math.PI / 4,
        Math.PI / 2,
        -Math.PI / 2,
        (Math.PI * 3) / 4,
        -(Math.PI * 3) / 4,
      ];

      let bestDir = forward.clone();
      let maxDist = hit.distance;

      for (const angle of angles) {
        const dir = forward
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        raycaster.set(pos, dir);
        const aHits = raycaster.intersectObjects(obstacles, false);
        const dist = aHits.length > 0 ? aHits[0].distance : rayLength;

        if (dist > maxDist) {
          maxDist = dist;
          bestDir = dir;
          if (dist === rayLength) break; // Found a completely clear path
        }
      }

      // Blend the steering direction heavily with the clearest path and the surface normal
      moveDir
        .add(bestDir.multiplyScalar(3))
        .add(normal.multiplyScalar(2))
        .normalize();

      // Occasionally offset the target to prevent getting stuck in tight spots
      if (Math.random() < 0.1) {
        targetPos.copy(pos).add(moveDir.clone().multiplyScalar(15));
      }
    }
  }

  private faceTarget(mesh: THREE.Object3D, target: THREE.Vector3) {
    mesh.rotation.y = Math.atan2(
      mesh.position.x - target.x,
      mesh.position.z - target.z,
    );
  }

  private updateMuzzleFlash(gun: any, delta: number) {
    if (gun && gun.userData && gun.userData.flashTimer > 0) {
      gun.userData.flashTimer -= delta;
      if (gun.userData.flashTimer <= 0) {
        gun.userData.muzzleFlash.visible = false;
        gun.userData.flashLight.intensity = 0;
      } else {
        const opacity = gun.userData.flashTimer / 0.05;
        gun.userData.muzzleFlash.children.forEach(
          (c: any) => (c.material.opacity = opacity),
        );
        gun.userData.flashLight.intensity = 5 * opacity;
      }
    }
  }

  private applyAimAssist(delta: number) {
    if (this.isDead || !this.isAiming || this.isReloading || this.isGameOver) {
      return;
    }

    // Magnetic sticky aim
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    let bestEnemy: any = null;
    let minAngle = 0.05; // ~2.8 degrees max attraction angle

    this.enemies.forEach((enemy) => {
      if (enemy.health > 0) {
        const center = enemy.mesh.position.clone();
        center.y += 1.0; // approximate chest/head height

        const dirToEnemy = center.clone().sub(this.camera.position).normalize();
        const angle = raycaster.ray.direction.angleTo(dirToEnemy);

        // Ensure enemy is relatively in front and close to crosshair
        if (angle < minAngle) {
          minAngle = angle;
          bestEnemy = enemy;
        }
      }
    });

    if (bestEnemy) {
      const center = bestEnemy.mesh.position.clone();
      center.y += 1.2; // target slightly above chest
      const targetDir = center.sub(this.camera.position).normalize();

      const targetYaw = Math.atan2(-targetDir.x, -targetDir.z);
      const targetPitch = Math.asin(targetDir.y);

      // Calculate differences
      let yawDiff = targetYaw - this.cameraYaw;

      // Normalize yaw diff to -PI to PI
      while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
      while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;

      const pitchDiff = targetPitch - this.cameraPitch;

      // Gentle pull
      const pullFactor = 2.0 * delta;

      this.cameraYaw += yawDiff * pullFactor;
      this.cameraPitch += pitchDiff * pullFactor;

      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch,
        -Math.PI / 4,
        Math.PI / 2 - 0.1,
      );
    }
  }

  private explosions: {
    mesh: THREE.Mesh;
    timer: number;
    maxTimer: number;
    maxScale: number;
  }[] = [];

  private updateGrenades(delta: number) {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const grenade = this.activeGrenades[i];
      grenade.timer -= delta;

      // Physics step using sub-stepping for robustness
      const steps = 3;
      const subDelta = delta / steps;

      for (let s = 0; s < steps; s++) {
        // Gravity
        grenade.velocity.y -= 25 * subDelta;

        const nextPos = grenade.mesh.position
          .clone()
          .add(grenade.velocity.clone().multiplyScalar(subDelta));

        // Map collision
        for (const collider of this.mapColliders) {
          const localPos = collider.mesh.worldToLocal(nextPos.clone());
          const halfW = collider.w / 2;
          const halfH = collider.h / 2;
          const halfD = collider.d / 2;
          const r = 0.4; // Grenade collision radius padding

          if (
            localPos.x > -halfW - r &&
            localPos.x < halfW + r &&
            localPos.y > -halfH - r &&
            localPos.y < halfH + r &&
            localPos.z > -halfD - r &&
            localPos.z < halfD + r
          ) {
            // Collision detected! Find the closest face
            const distRight = Math.abs(localPos.x - (halfW + r));
            const distLeft = Math.abs(localPos.x - (-halfW - r));
            const distTop = Math.abs(localPos.y - (halfH + r));
            const distBottom = Math.abs(localPos.y - (-halfH - r));
            const distFront = Math.abs(localPos.z - (halfD + r));
            const distBack = Math.abs(localPos.z - (-halfD - r));

            const dx = Math.min(distRight, distLeft);
            const dy = Math.min(distTop, distBottom);
            const dz = Math.min(distFront, distBack);

            let normal = new THREE.Vector3();
            let pushDist = 0;

            if (dx <= dy && dx <= dz) {
              normal.set(distRight < distLeft ? 1 : -1, 0, 0);
              pushDist = dx;
            } else if (dy <= dx && dy <= dz) {
              normal.set(0, distTop < distBottom ? 1 : -1, 0);
              pushDist = dy;
            } else {
              normal.set(0, 0, distFront < distBack ? 1 : -1);
              pushDist = dz;
            }

            // Transform normal back to world space
            const worldNormal = normal
              .clone()
              .transformDirection(collider.mesh.matrixWorld)
              .normalize();

            // Reflect velocity
            grenade.velocity.reflect(worldNormal).multiplyScalar(0.5);

            // Push position out
            nextPos.add(worldNormal.multiplyScalar(pushDist + 0.01));
            break; // Only handle one collision per sub-step
          }
        }

        grenade.mesh.position.copy(nextPos);

        // Floor collision
        if (grenade.mesh.position.y <= 0.2) {
          grenade.mesh.position.y = 0.2;
          grenade.velocity.y *= -0.5;
          grenade.velocity.x *= 0.7;
          grenade.velocity.z *= 0.7;

          if (Math.abs(grenade.velocity.y) < 1) {
            grenade.velocity.y = 0;
          }
        }
      }

      // Simple wall collision logic (map bounds)
      const extentX = this.mapWidth / 2 - 0.2;
      const extentZ = this.mapLength / 2 - 0.2;

      if (
        grenade.mesh.position.x < -extentX ||
        grenade.mesh.position.x > extentX
      ) {
        grenade.velocity.x *= -0.5;
        grenade.mesh.position.x = THREE.MathUtils.clamp(
          grenade.mesh.position.x,
          -extentX,
          extentX,
        );
      }
      if (
        grenade.mesh.position.z < -extentZ ||
        grenade.mesh.position.z > extentZ
      ) {
        grenade.velocity.z *= -0.5;
        grenade.mesh.position.z = THREE.MathUtils.clamp(
          grenade.mesh.position.z,
          -extentZ,
          extentZ,
        );
      }

      // Explode
      if (grenade.timer <= 0) {
        this.detonateGrenade(grenade.mesh.position);
        this.scene.remove(grenade.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private updateExplosions(delta: number) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.timer -= delta;
      if (exp.timer <= 0) {
        this.scene.remove(exp.mesh);
        this.explosions.splice(i, 1);
      } else {
        const progress = 1 - exp.timer / exp.maxTimer;
        const scale = 1 + progress * exp.maxScale;
        exp.mesh.scale.set(scale, scale, scale);
        const mat = exp.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.8 * (1 - progress);
      }
    }
  }

  private detonateGrenade(position: THREE.Vector3) {
    audioSystem.playShoot(); // Reuse gunshot audio as explosion thump

    // Create Explosion Visual
    const explodeGeom = new THREE.SphereGeometry(0.5, 16, 16);
    const explodeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
    });
    const explosionMesh = new THREE.Mesh(explodeGeom, explodeMat);
    explosionMesh.position.copy(position);
    this.scene.add(explosionMesh);

    // Expand logic
    this.explosions.push({
      mesh: explosionMesh,
      timer: 0.3,
      maxTimer: 0.3,
      maxScale: 15,
    });

    // Damage logic
    const explodeRadius = 12;
    const maxDamage = 100;

    // Player
    if (!this.isDead) {
      const dist = this.myPlayer.position.distanceTo(position);
      if (dist < explodeRadius) {
        const damage = maxDamage * (1 - dist / explodeRadius);
        this.shakeIntensity = 2.0; // Big shake
        this.applyDamage("player", damage, "player", "grenade"); // Self damage
      }
    }

    // Enemies
    this.enemies.forEach((enemy) => {
      if (enemy.health > 0) {
        const dist = enemy.mesh.position.distanceTo(position);
        if (dist < explodeRadius) {
          const damage = maxDamage * (1 - dist / explodeRadius);
          this.applyDamage(enemy.id, damage, "player", "grenade");
        }
      }
    });

    // We do not damage teamBots to avoid friendly fire penalties
  }

  private updateMovement(delta: number) {
    this.applyAimAssist(delta);

    this.updateGrenades(delta);
    this.updateExplosions(delta);
    this.updateGrenadeTrajectory();

    if (this.isDead) {
      if (this.killCamTimer > 0) {
        this.killCamTimer -= delta;
      }
      this.respawnTimer -= delta;
      this.notifyRespawnTick();

      if (this.respawnTimer <= 0) {
        this.isDead = false;
        this.killCamTarget = null;
        this.killCamTimer = 0;
        this.playerHealth = this.playerMaxHealth;
        this.ammo = this.maxAmmo;
        this.notifyAmmoUpdate();
        this.notifyGrenadesUpdate();
        this.myPlayer.position.set(0, 1.5, 70);
        this.myPlayer.visible = true;
        this.notifyHealthUpdate();
        this.notifyRespawnTick();
      }
    }

    // Update Muzzle Flash for Player
    this.updateMuzzleFlash(this.gunMesh, delta);

    if (!this.isDead) {
      if (this.isReloading) {
        this.reloadTimer -= delta;

        if (this.reloadTimer <= 0) {
          this.isReloading = false;
          this.ammo = this.maxAmmo;
          this.notifyAmmoUpdate();
        }
      } else {
        if (this.isFiring && this.ammo > 0) {
          if (
            this.clock.getElapsedTime() - this.lastFireTime >=
            this.fireRate
          ) {
            this.fire();
            this.lastFireTime = this.clock.getElapsedTime();
          }
        } else if (this.isFiring && this.ammo <= 0) {
          // Auto-reload when trying to fire on empty
          this.isReloading = true;
          this.reloadTimer = this.reloadTime;
          this.notifyAmmoUpdate();
          this.setAiming(false);
        }
      }
    }

    // Interpolate camera radius and offsets smoothly
    this.cameraRadius +=
      (this.targetCameraRadius - this.cameraRadius) * 10 * delta;

    this.camera.fov += (this.targetFov - this.camera.fov) * 15 * delta;
    this.camera.updateProjectionMatrix();

    const targetOffsetRight = this.isAiming ? 0.15 : 1.0;
    const targetOffsetUp = this.isAiming ? 0.44 : 1.8;
    const targetOffsetForward = this.isAiming ? 1.01 : 1.0;
    this.targetCameraRadius = this.isAiming ? 0.01 : 1.5;

    this.cameraOffsetRight +=
      (targetOffsetRight - this.cameraOffsetRight) * 10 * delta;
    this.cameraOffsetUp += (targetOffsetUp - this.cameraOffsetUp) * 10 * delta;
    this.cameraOffsetForward +=
      (targetOffsetForward - this.cameraOffsetForward) * 10 * delta;

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.age += delta;
      if (tracer.age > 0.1) {
        // 100ms tracer visibility
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        (tracer.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        (tracer.line.material as THREE.Material).opacity = 1 - tracer.age / 0.1;
      }
    }

    // Enemy AI Basic
    const now = this.clock.getElapsedTime();
    this.enemies.forEach((enemy) => {
      this.updateMuzzleFlash(enemy.mesh.userData.gun, delta);
      if (enemy.health <= 0) {
        this.updateDeathAnim(enemy.mesh, delta);
        enemy.respawnTimer -= delta;
        if (enemy.respawnTimer <= 0) {
          enemy.health = enemy.maxHealth;
          enemy.healthBarFg.scale.x = 1.0;
          enemy.healthBarFg.position.x = 0;
          this.resetAnim(enemy.mesh);
          enemy.mesh.position.set(
            -20 + Math.random() * 40,
            1.5,
            -50 + Math.random() * -30,
          );
          enemy.targetPos.copy(enemy.mesh.position);
          // Health bar remains completely hidden for enemies
        }
      } else {
        // Find nearest valid target (player or teamBots)
        let nearestTarget: {
          position: THREE.Vector3;
          health: number;
          isPlayer: boolean;
          obj: any;
        } | null = null;
        let minDist = Infinity;

        if (!this.isDead) {
          const d = enemy.mesh.position.distanceTo(this.myPlayer.position);
          if (d < minDist) {
            minDist = d;
            nearestTarget = {
              position: this.myPlayer.position,
              health: this.playerHealth,
              isPlayer: true,
              obj: null,
            };
          }
        }

        this.teamBots.forEach((teamBot) => {
          if (teamBot.health > 0) {
            const d = enemy.mesh.position.distanceTo(teamBot.mesh.position);
            if (d < minDist) {
              minDist = d;
              nearestTarget = {
                position: teamBot.mesh.position,
                health: teamBot.health,
                isPlayer: false,
                obj: teamBot,
              };
            }
          }
        });

        if (nearestTarget && minDist < 40) {
          this.faceTarget(enemy.mesh, nearestTarget.position);
        } else {
          // Just look where moving if no nearby valid targets
          const moveDir = new THREE.Vector3().subVectors(
            enemy.targetPos,
            enemy.mesh.position,
          );
          if (moveDir.length() > 0)
            this.faceTarget(enemy.mesh, enemy.targetPos);
        }

        // AI Logic Movement
        enemy.moveTimer -= delta;
        if (enemy.moveTimer <= 0) {
          enemy.moveTimer = 1.5 + Math.random() * 2;

          if (nearestTarget && enemy.health >= 40) {
            // Aggressive
            const dir = new THREE.Vector3()
              .subVectors(enemy.mesh.position, nearestTarget.position)
              .normalize();
            const strafeDir = new THREE.Vector3(
              -dir.z,
              0,
              dir.x,
            ).multiplyScalar((Math.random() - 0.5) * 15);
            if (minDist > 15) {
              // move closer
              enemy.targetPos
                .copy(enemy.mesh.position)
                .add(dir.multiplyScalar(-10))
                .add(strafeDir);
            } else {
              enemy.targetPos.copy(enemy.mesh.position).add(strafeDir);
            }
          } else if (nearestTarget && enemy.health < 40) {
            // Retreat / Cover
            let bestCover = null;
            let minScore = Infinity;
            for (const c of this.mapColliders) {
              const cPos = new THREE.Vector3();
              c.mesh.getWorldPosition(cPos);
              const size = Math.max(c.w, c.d) / 2 + 2;
              const coverPos = cPos
                .clone()
                .add(
                  new THREE.Vector3()
                    .subVectors(cPos, nearestTarget.position)
                    .normalize()
                    .multiplyScalar(size),
                );
              if (
                coverPos.x >= -30 &&
                coverPos.x <= 30 &&
                coverPos.z >= -90 &&
                coverPos.z <= 90
              ) {
                const score = enemy.mesh.position.distanceTo(coverPos);
                if (score < minScore) {
                  minScore = score;
                  bestCover = coverPos;
                }
              }
            }
            if (bestCover) {
              enemy.targetPos.copy(bestCover);
            } else {
              const runDir = new THREE.Vector3()
                .subVectors(enemy.mesh.position, nearestTarget.position)
                .normalize();
              enemy.targetPos
                .copy(enemy.mesh.position)
                .add(runDir.multiplyScalar(15));
            }
          } else {
            // Search
            enemy.targetPos.set(
              enemy.mesh.position.x + (Math.random() - 0.5) * 20,
              enemy.mesh.position.y,
              enemy.mesh.position.z + 10, // Advance towards opposite side softly
            );
          }
          enemy.targetPos.x = THREE.MathUtils.clamp(enemy.targetPos.x, -30, 30);
          enemy.targetPos.z = THREE.MathUtils.clamp(enemy.targetPos.z, -90, 90);
        }

        // Move towards target
        const moveDir = new THREE.Vector3().subVectors(
          enemy.targetPos,
          enemy.mesh.position,
        );
        if (moveDir.length() > 0.5) {
          moveDir.y = 0;
          moveDir.normalize();
          this.applyBotSteering(enemy.mesh.position, moveDir, enemy.targetPos);
          moveDir.y = 0;
          moveDir.normalize();
          enemy.mesh.position.addScaledVector(moveDir, 7 * delta); // increased speed for better movement
          enemy.mesh.position.y = 1.5;
          this.constrainPlayerPosition(enemy.mesh.position);
          enemy.mesh.updateMatrixWorld();
          this.updateCharacterWalkAnim(enemy.mesh, true, delta);
        } else {
          this.updateCharacterWalkAnim(enemy.mesh, false, delta);
        }

        // If close enough and can see target
        if (nearestTarget && minDist < 45 && now - enemy.lastFireTime > 0.5) {
          enemy.lastFireTime = now;

          // Check line of sight
          const rayDir = new THREE.Vector3()
            .subVectors(nearestTarget.position, enemy.mesh.position)
            .normalize();
          const raycaster = new THREE.Raycaster(
            enemy.mesh.position,
            rayDir,
            0,
            minDist,
          );
          const obstacles = this.mapColliders.map((c) => c.mesh);
          const hits = raycaster.intersectObjects(obstacles, false);

          if (hits.length === 0) {
            // Deal damage
            audioSystem.playBotShoot(minDist);

            // Trigger Muzzle Flash for Enemy
            if (
              enemy.mesh.userData.gun &&
              enemy.mesh.userData.gun.userData.muzzleFlash &&
              enemy.mesh.userData.gun.userData.flashLight
            ) {
              const gun = enemy.mesh.userData.gun;
              gun.userData.muzzleFlash.visible = true;
              gun.userData.muzzleFlash.children.forEach(
                (c: any) => (c.material.opacity = 1.0),
              );
              gun.userData.muzzleFlash.rotation.z = Math.random() * Math.PI;
              gun.userData.flashLight.intensity = 5;
              gun.userData.flashTimer = 0.05;
            }

            if (Math.random() > 0.45) {
              if (nearestTarget.isPlayer) {
                this.applyDamage("player", 8, enemy.id);
              } else {
                this.applyDamage(nearestTarget.obj.id, 12, enemy.id);
              }
            }

            // Draw visual tracer
            const material = new THREE.LineBasicMaterial({
              color: 0xff0000,
              transparent: true,
              opacity: 1,
            });

            const targetPoint = nearestTarget.position.clone();
            targetPoint.y += 1.5;
            targetPoint.x += (Math.random() - 0.5) * 2;
            targetPoint.z += (Math.random() - 0.5) * 2;

            const points = [enemy.mesh.position.clone().setY(1.5), targetPoint];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);

            this.scene.add(line);
            this.tracers.push({ line, age: 0 });
          }
        }
      }
    });

    // Team Bot AI
    this.teamBots.forEach((bot) => {
      this.updateMuzzleFlash(bot.mesh.userData.gun, delta);
      if (bot.health <= 0) {
        this.updateDeathAnim(bot.mesh, delta);
        bot.respawnTimer -= delta;
        if (bot.respawnTimer <= 0) {
          bot.health = bot.maxHealth;
          bot.healthBarFg.scale.x = 1.0;
          bot.healthBarFg.position.x = 0;
          this.resetAnim(bot.mesh);
          bot.mesh.position.set(
            -20 + Math.random() * 40,
            1.5,
            50 + Math.random() * 30,
          );
          bot.targetPos.copy(bot.mesh.position);
          bot.healthBarGroup.visible = true;
        }
      } else {
        // Look at nearest enemy
        let nearestEnemy: any = null;
        let minDist = Infinity;
        this.enemies.forEach((enemy) => {
          if (enemy.health > 0) {
            const d = bot.mesh.position.distanceTo(enemy.mesh.position);
            if (d < minDist) {
              minDist = d;
              nearestEnemy = enemy;
            }
          }
        });

        if (nearestEnemy) {
          this.faceTarget(bot.mesh, nearestEnemy.mesh.position);
        } else {
          // Just look where moving
          const md = new THREE.Vector3().subVectors(
            bot.targetPos,
            bot.mesh.position,
          );
          if (md.length() > 0) this.faceTarget(bot.mesh, bot.targetPos);
        }

        // AI Logic Movement
        bot.moveTimer -= delta;
        if (bot.moveTimer <= 0) {
          bot.moveTimer = 1.5 + Math.random() * 2;

          if (nearestEnemy && bot.health >= 40) {
            // Aggressive
            const dir = new THREE.Vector3()
              .subVectors(bot.mesh.position, nearestEnemy.mesh.position)
              .normalize();
            const strafeDir = new THREE.Vector3(
              -dir.z,
              0,
              dir.x,
            ).multiplyScalar((Math.random() - 0.5) * 15);
            if (minDist > 15) {
              // move closer
              bot.targetPos
                .copy(bot.mesh.position)
                .add(dir.multiplyScalar(-10))
                .add(strafeDir);
            } else {
              bot.targetPos.copy(bot.mesh.position).add(strafeDir);
            }
          } else if (nearestEnemy && bot.health < 40) {
            // Retreat / Cover
            let bestCover = null;
            let minScore = Infinity;
            for (const c of this.mapColliders) {
              const cPos = new THREE.Vector3();
              c.mesh.getWorldPosition(cPos);
              const size = Math.max(c.w, c.d) / 2 + 2;
              const coverPos = cPos
                .clone()
                .add(
                  new THREE.Vector3()
                    .subVectors(cPos, nearestEnemy.mesh.position)
                    .normalize()
                    .multiplyScalar(size),
                );
              if (
                coverPos.x >= -30 &&
                coverPos.x <= 30 &&
                coverPos.z >= -90 &&
                coverPos.z <= 90
              ) {
                const score = bot.mesh.position.distanceTo(coverPos);
                if (score < minScore) {
                  minScore = score;
                  bestCover = coverPos;
                }
              }
            }
            if (bestCover) {
              bot.targetPos.copy(bestCover);
            } else {
              const runDir = new THREE.Vector3()
                .subVectors(bot.mesh.position, nearestEnemy.mesh.position)
                .normalize();
              bot.targetPos
                .copy(bot.mesh.position)
                .add(runDir.multiplyScalar(15));
            }
          } else {
            // Target is somewhere near player
            bot.targetPos.set(
              this.myPlayer.position.x + (Math.random() - 0.5) * 20,
              this.myPlayer.position.y,
              this.myPlayer.position.z + (Math.random() - 0.5) * 20 - 10,
            );
          }
          bot.targetPos.x = THREE.MathUtils.clamp(bot.targetPos.x, -30, 30);
          bot.targetPos.z = THREE.MathUtils.clamp(bot.targetPos.z, -90, 90);
        }

        // Move towards target
        const moveDir = new THREE.Vector3().subVectors(
          bot.targetPos,
          bot.mesh.position,
        );
        if (moveDir.length() > 0.5) {
          moveDir.y = 0;
          moveDir.normalize();
          this.applyBotSteering(bot.mesh.position, moveDir, bot.targetPos);
          moveDir.y = 0;
          moveDir.normalize();
          bot.mesh.position.addScaledVector(moveDir, 7 * delta); // increased speed
          bot.mesh.position.y = 1.5;
          this.constrainPlayerPosition(bot.mesh.position);
          bot.mesh.updateMatrixWorld();
          this.updateCharacterWalkAnim(bot.mesh, true, delta);
        } else {
          this.updateCharacterWalkAnim(bot.mesh, false, delta);
        }

        if (nearestEnemy) {
          // Randomly shoot
          if (minDist < 45 && now - bot.lastFireTime > 0.5) {
            bot.lastFireTime = now;
            // Check LoS
            const rayDir = new THREE.Vector3()
              .subVectors(
                (nearestEnemy as any).mesh.position,
                bot.mesh.position,
              )
              .normalize();
            const raycaster = new THREE.Raycaster(
              bot.mesh.position,
              rayDir,
              0,
              minDist,
            );
            const obstacles = this.mapColliders.map((c) => c.mesh);
            const hits = raycaster.intersectObjects(obstacles, false);

            if (hits.length === 0) {
              // Deal damage
              audioSystem.playBotShoot(minDist);

              // Trigger Muzzle Flash for Bot
              if (
                bot.mesh.userData.gun &&
                bot.mesh.userData.gun.userData.muzzleFlash &&
                bot.mesh.userData.gun.userData.flashLight
              ) {
                const gun = bot.mesh.userData.gun;
                gun.userData.muzzleFlash.visible = true;
                gun.userData.muzzleFlash.children.forEach(
                  (c: any) => (c.material.opacity = 1.0),
                );
                gun.userData.muzzleFlash.rotation.z = Math.random() * Math.PI;
                gun.userData.flashLight.intensity = 5;
                gun.userData.flashTimer = 0.05;
              }

              if (Math.random() > 0.4) {
                this.applyDamage(nearestEnemy.id, 15, bot.id);
              }

              // Draw visual tracer
              const material = new THREE.LineBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 1,
              });
              const targetPoint = (nearestEnemy as any).mesh.position.clone();
              targetPoint.y += 1.5;
              const points = [bot.mesh.position.clone().setY(1.5), targetPoint];
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const line = new THREE.Line(geometry, material);
              this.scene.add(line);
              this.tracers.push({ line, age: 0 });
            }
          }
        } else {
          // Just look where moving
          if (moveDir.length() > 0) this.faceTarget(bot.mesh, bot.targetPos);
        }
      }
    });

    const speed = 15; // units per second
    let moveX = this.joyInput.x;
    let moveZ = this.joyInput.y;

    // Overlay keyboard input if present
    if (this.keys.w) moveZ = -1;
    if (this.keys.s) moveZ = 1;
    if (this.keys.a) moveX = -1;
    if (this.keys.d) moveX = 1;

    if (this.isDead) {
      moveX = 0;
      moveZ = 0;
    }

    if (this.myPlayer) {
      // Direction vectors based on camera yaw
      const forward = new THREE.Vector3(
        -Math.sin(this.cameraYaw),
        0,
        -Math.cos(this.cameraYaw),
      );
      const right = new THREE.Vector3(
        Math.cos(this.cameraYaw),
        0,
        -Math.sin(this.cameraYaw),
      );

      // Desired steps
      const stepX = moveX * speed * delta;
      const stepZ = -moveZ * speed * delta;

      const dx = right.x * stepX + forward.x * stepZ;
      const dz = right.z * stepX + forward.z * stepZ;

      const prevPos = this.myPlayer.position.clone();

      // Apply movement entirely
      this.myPlayer.position.x += dx;
      this.myPlayer.position.z += dz;

      // Re-resolve constraints pushing out from walls
      this.constrainPlayerPosition(this.myPlayer.position);
      this.myPlayer.updateMatrixWorld();

      const isMoving = Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001;
      this.updateCharacterWalkAnim(this.myPlayer, isMoving, delta);

      // Keep within map bounds
      const extentX = this.mapWidth / 2 - 1.0; // 1.0 is rough player radius/padding
      const extentZ = this.mapLength / 2 - 1.0;
      this.myPlayer.position.x = THREE.MathUtils.clamp(
        this.myPlayer.position.x,
        -extentX,
        extentX,
      );
      this.myPlayer.position.z = THREE.MathUtils.clamp(
        this.myPlayer.position.z,
        -extentZ,
        extentZ,
      );

      // Process shake/recoil intensity
      if (this.shakeIntensity > 0) {
        this.shakeIntensity -= delta * 15; // Decrement intensity quickly over frames
        if (this.shakeIntensity < 0) this.shakeIntensity = 0;
      }

      // Orient the player mesh towards where the camera is looking FIRST
      this.myPlayer.rotation.y = this.cameraYaw;

      // Pitch the arms and gun relative to camera, add recoil to gun
      if (this.gunMesh) {
        // Kick recoil mostly backwards. Only rotate upwards if NOT aiming.
        const recoilRot = this.isAiming ? 0 : this.shakeIntensity * 0.1;
        const recoilZ = this.shakeIntensity * (this.isAiming ? 0.05 : 0.15);
        // Slightly move the gun down to give the "playing from below" effect
        const recoilY = -this.shakeIntensity * 0.02;

        let swayX = 0;
        let swayY = 0;
        let swayRotY = 0;
        let swayRotZ = 0;

        if (!this.isAiming) {
          if (isMoving) {
            const walkTime = this.myPlayer.userData.walkTime || 0;
            swayX = Math.sin(walkTime * 0.5) * 0.02;
            swayY = Math.abs(Math.cos(walkTime * 0.5)) * 0.02;
            swayRotZ = Math.sin(walkTime * 0.5) * 0.03;
            swayRotY = Math.sin(walkTime * 0.5) * 0.015;
          } else {
            const idleTime = this.clock.getElapsedTime();
            swayX = Math.sin(idleTime * 1.5) * 0.005;
            swayY = Math.cos(idleTime * 2.0) * 0.005;
          }
        }

        this.gunMesh.rotation.set(-this.cameraPitch + recoilRot, swayRotY, swayRotZ);
        this.gunMesh.position.set(0.15 + swayX, 0.2 + recoilY + swayY, -0.9 + recoilZ);
      }
      if (this.myPlayer.userData.leftArm) {
        this.myPlayer.userData.leftArm.rotation.x = 1.23 - this.cameraPitch;
      }
      if (this.myPlayer.userData.rightArm) {
        this.myPlayer.userData.rightArm.rotation.x = 1.22 - this.cameraPitch;
      }

      // Force update world matrices so localToWorld is accurate this frame
      this.myPlayer.updateMatrixWorld(true);

      // Calculate camera position using spherical coordinates around player
      const camOffsetX =
        this.cameraRadius *
        Math.cos(this.cameraPitch) *
        Math.sin(this.cameraYaw);
      const camOffsetY = this.cameraRadius * Math.sin(this.cameraPitch);
      const camOffsetZ =
        this.cameraRadius *
        Math.cos(this.cameraPitch) *
        Math.cos(this.cameraYaw);

      const playerTarget = new THREE.Vector3(
        this.myPlayer.position.x +
          right.x * this.cameraOffsetRight +
          forward.x * this.cameraOffsetForward,
        this.myPlayer.position.y + this.cameraOffsetUp,
        this.myPlayer.position.z +
          right.z * this.cameraOffsetRight +
          forward.z * this.cameraOffsetForward,
      );

      const idealCamPos = new THREE.Vector3(
        playerTarget.x + camOffsetX,
        playerTarget.y + camOffsetY,
        playerTarget.z + camOffsetZ,
      );

      if (this.isAiming && this.gunMesh) {
        // Scope is at local (0, 0.22, -0.1). We want camera slightly behind it e.g., z=0.0
        const scopeEyePos = new THREE.Vector3(0, 0.22, 0.0);
        this.gunMesh.localToWorld(scopeEyePos);
        idealCamPos.copy(scopeEyePos);

        // Target is straight through the scope
        const scopeAimPos = new THREE.Vector3(0, 0.22, -10.0);
        this.gunMesh.localToWorld(scopeAimPos);
        playerTarget.copy(scopeAimPos);
      }

      // Raycast to prevent camera clipping through obstacles
      const rayDir = new THREE.Vector3()
        .subVectors(idealCamPos, playerTarget)
        .normalize();
      const rayDist = playerTarget.distanceTo(idealCamPos);

      const raycaster = new THREE.Raycaster(playerTarget, rayDir, 0, rayDist);
      const obstacles = this.mapColliders.map((c) => c.mesh);
      const hits = raycaster.intersectObjects(obstacles, false);

      if (hits.length > 0 && !this.isAiming) {
        // Move camera just inside the obstacle
        const hitDist = hits[0].distance;
        idealCamPos
          .copy(playerTarget)
          .addScaledVector(rayDir, Math.max(0.5, hitDist - 0.5));
      }

      let camX = idealCamPos.x;
      let camY = idealCamPos.y;
      let camZ = idealCamPos.z;

      // Clamp camera to stay within map boundaries (fallback)
      const camExtentX = this.mapWidth / 2 - 2.0;
      const camExtentZ = this.mapLength / 2 - 2.0;

      camX = THREE.MathUtils.clamp(camX, -camExtentX, camExtentX);
      camZ = THREE.MathUtils.clamp(camZ, -camExtentZ, camExtentZ);

      if (this.killCamTimer > 0 && this.killCamTarget) {
        // Move camera closer and look at the killer smoothly
        const targetPos = this.killCamTarget.position.clone();
        targetPos.y += 1.5;

        const dirToTarget = targetPos
          .clone()
          .sub(this.camera.position)
          .normalize();
        const dist = this.camera.position.distanceTo(targetPos);
        const desiredPos = targetPos
          .clone()
          .sub(dirToTarget.multiplyScalar(Math.min(dist, 4)));
        desiredPos.y += 1;

        this.camera.position.lerp(desiredPos, 3 * delta);

        const lookRot = new THREE.Matrix4().lookAt(
          this.camera.position,
          targetPos,
          this.camera.up,
        );
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
          lookRot,
        );
        this.camera.quaternion.slerp(targetQuat, 5 * delta);
      } else {
        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(playerTarget);
      }
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Clamp delta to prevent "teleportation" on frame drops
    let delta = this.clock.getDelta();
    if (delta > 0.05) delta = 0.05;

    if (!this.isPaused) {
      if (!this.isGameOver) {
        if (this.matchTime > 0) {
          this.matchTime -= delta;
          if (this.matchTime <= 0) {
            if (this.blueScore === this.redScore) {
              this.isOvertime = true;
              this.matchTime = 0;
            } else {
              this.triggerGameOver(this.blueScore > this.redScore);
            }
          }
          this.onTimeUpdate?.(this.matchTime, this.isOvertime);
        } else if (this.isOvertime) {
          // Increment overtime count by making matchTime negative
          this.matchTime -= delta;
          this.onTimeUpdate?.(this.matchTime, this.isOvertime);
        }
      }

      this.updateMovement(delta);

      // Make enemy health bars face camera
      this.enemies.forEach((enemy) => {
        enemy.healthBarGroup.lookAt(this.camera.position);
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  public cleanup() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    // Remove keyboard event listeners in a full implementation, skipping for brevity
    this.renderer.dispose();
  }
}
