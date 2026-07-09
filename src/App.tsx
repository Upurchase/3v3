/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { TDMGame } from "./game";
import { Joystick } from "./components/Joystick";
import { GunPreview } from "./components/GunPreview";
import { GunThumbnail } from "./components/GunThumbnail";
import { PlayerPreview } from "./components/PlayerPreview";
import { audioSystem } from "./audio";

interface KillEvent {
  id: number;
  killer: string;
  victim: string;
  killerTeam: "blue" | "red";
  victimTeam: "blue" | "red";
  weapon: "gun" | "grenade";
}

interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: "kills" | "wins" | "combo" | "streak" | "damage" | "matches";
}

const ALL_MISSIONS: Mission[] = [
  {
    id: "m1",
    title: "First Blood",
    description: "Get 10 Kills",
    target: 10,
    reward: 50,
    type: "kills",
  },
  {
    id: "m2",
    title: "Sharpshooter",
    description: "Get 30 Kills",
    target: 30,
    reward: 150,
    type: "kills",
  },
  {
    id: "m3",
    title: "Winner",
    description: "Win 1 Match",
    target: 1,
    reward: 50,
    type: "wins",
  },
  {
    id: "m4",
    title: "Champion",
    description: "Win 3 Matches",
    target: 3,
    reward: 150,
    type: "wins",
  },
  {
    id: "m5",
    title: "Double Trouble",
    description: "Achieve a Double Kill",
    target: 2,
    reward: 100,
    type: "combo",
  },
  {
    id: "m6",
    title: "Unstoppable",
    description: "Achieve a 5 Kill Streak",
    target: 5,
    reward: 100,
    type: "streak",
  },
  {
    id: "m7",
    title: "Godlike",
    description: "Achieve a 10 Kill Streak",
    target: 10,
    reward: 200,
    type: "streak",
  },
  {
    id: "m8",
    title: "Damage Dealer",
    description: "Deal 2000 Damage",
    target: 2000,
    reward: 100,
    type: "damage",
  },
  {
    id: "m9",
    title: "Heavy Hitter",
    description: "Deal 5000 Damage",
    target: 5000,
    reward: 200,
    type: "damage",
  },
  {
    id: "m10",
    title: "Veteran",
    description: "Play 5 Matches",
    target: 5,
    reward: 100,
    type: "matches",
  },
];

interface DailyMissionsState {
  date: string;
  activeMissionIds: string[];
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
}

const getDailyMissions = (): DailyMissionsState => {
  const today = new Date().toISOString().split("T")[0];
  const saved = localStorage.getItem("tdm_daily_missions");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.date === today) {
        return parsed;
      }
    } catch (e) {}
  }

  const shuffled = [...ALL_MISSIONS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 5).map((m) => m.id);

  return {
    date: today,
    activeMissionIds: selected,
    progress: {},
    claimed: {},
  };
};

export default function App() {
  const [gameState, setGameState] = useState<"lobby" | "playing">("lobby");
  const [isPortrait, setIsPortrait] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TDMGame | null>(null);

  const [ammo, setAmmo] = useState(30);
  const [maxAmmo] = useState(30);
  const [grenades, setGrenades] = useState(0);
  const [inventoryGrenades, setInventoryGrenades] = useState(() => {
    const saved = localStorage.getItem("tdm_inventory_grenades");
    return saved ? parseInt(saved, 10) : 3;
  });
  const [ownsGodzillaSkin, setOwnsGodzillaSkin] = useState(() => {
    return localStorage.getItem("tdm_owns_godzilla") === "true";
  });
  const [equippedSkin, setEquippedSkin] = useState(() => {
    return localStorage.getItem("tdm_equipped_skin") || "default";
  });
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);
  const [grenadeCooldown, setGrenadeCooldown] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [respawnTime, setRespawnTime] = useState<number | null>(null);
  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);
  const [playerKills, setPlayerKills] = useState(0);
  const [killAlert, setKillAlert] = useState<string | null>(null);
  const killAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [killFeed, setKillFeed] = useState<KillEvent[]>([]);
  const killFeedIdCounter = useRef(0);
  const [matchTime, setMatchTime] = useState<number>(180);
  const [isOvertime, setIsOvertime] = useState<boolean>(false);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [gameOverState, setGameOverState] = useState<"win" | "lose" | null>(
    null,
  );
  const [endStats, setEndStats] = useState<any[]>([]);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [coins, setCoins] = useState(() => {
    // const saved = localStorage.getItem("tdm_coins");
    // return saved ? parseInt(saved, 10) : 1500;
    return 400000;
  });

  const [dailyMissions, setDailyMissions] =
    useState<DailyMissionsState>(getDailyMissions());
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<
    "weapons" | "characters" | "items"
  >("weapons");
  const [dailyRewardAmount, setDailyRewardAmount] = useState(200);
  const [canClaimDaily, setCanClaimDaily] = useState(false);

  useEffect(() => {
    localStorage.setItem("tdm_coins", coins.toString());
  }, [coins]);

  useEffect(() => {
    localStorage.setItem("tdm_inventory_grenades", inventoryGrenades.toString());
  }, [inventoryGrenades]);

  useEffect(() => {
    localStorage.setItem("tdm_owns_godzilla", ownsGodzillaSkin.toString());
  }, [ownsGodzillaSkin]);

  useEffect(() => {
    localStorage.setItem("tdm_equipped_skin", equippedSkin);
    if (gameRef.current) {
      gameRef.current.setWeaponSkin(equippedSkin);
    }
  }, [equippedSkin]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const lastLogin = localStorage.getItem("tdm_last_login");

    if (lastLogin !== today) {
      setCanClaimDaily(true);
      setShowDailyReward(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tdm_daily_missions", JSON.stringify(dailyMissions));
  }, [dailyMissions]);

  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(50);
  const [sensitivity, setSensitivity] = useState(50);
  const [controlUIStyle, setControlUIStyle] = useState<
    "standard" | "compact" | "custom"
  >(() => {
    try {
      const saved = localStorage.getItem("tdm_controlUIStyle");
      if (saved === "standard" || saved === "compact" || saved === "custom") {
        return saved;
      }
    } catch (e) {}
    return "standard";
  });

  useEffect(() => {
    localStorage.setItem("tdm_controlUIStyle", controlUIStyle);
  }, [controlUIStyle]);

  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [buttonLayout, setButtonLayout] = useState(() => {
    const defaultLayout = {
      fire: { right: 20, bottom: 40 },
      aim: { right: 90, bottom: 40 },
      reload: { right: 150, bottom: 45 },
      grenade: { right: 50, bottom: 110 },
      joystick: { left: 24, bottom: 24 },
    };
    try {
      const saved = localStorage.getItem("tdm_layout_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultLayout, ...parsed };
      }
    } catch (e) {}
    return defaultLayout;
  });

  useEffect(() => {
    localStorage.setItem("tdm_layout_v2", JSON.stringify(buttonLayout));
  }, [buttonLayout]);

  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initialLayout: any;
  } | null>(null);

  const handleDragStart = (e: React.PointerEvent, id: string) => {
    if (!isEditingLayout) return;
    e.stopPropagation();
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialLayout: buttonLayout[id as keyof typeof buttonLayout] || {
        right: 100,
        bottom: 220,
      },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isEditingLayout || !dragRef.current) return;
    const { id, startX, startY, initialLayout } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setButtonLayout((prev: any) => {
      const newLayout = { ...prev };
      if (id === "joystick") {
        newLayout[id] = {
          left: (initialLayout.left || 0) + dx,
          bottom: initialLayout.bottom - dy,
        };
      } else {
        newLayout[id] = {
          right: (initialLayout.right || 0) - dx,
          bottom: initialLayout.bottom - dy,
        };
      }
      return newLayout;
    });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  useEffect(() => {
    audioSystem.setVolume(volume / 100);
  }, [volume]);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.baseSensitivity = Math.max(0.1, sensitivity / 50);
    }
  }, [sensitivity, gameState]);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.isPaused = showSettings;
    }
  }, [showSettings]);

  useEffect(() => {
    const handleBlur = () => {
      if (gameState === "playing") {
        setShowSettings(true);
      }
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [gameState]);

  const hitMarkerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeLookPointers = useRef<{ [id: number]: { x: number; y: number } }>(
    {},
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (gameState === "playing" && canvasRef.current) {
      gameRef.current = new TDMGame(canvasRef.current);
      gameRef.current.setWeaponSkin(equippedSkin);
      // Reset state for new game
      setBlueScore(0);
      setRedScore(0);
      setPlayerKills(0);
      setGameOverState(null);

      gameRef.current.onAmmoUpdate = (curr: number, reloading: boolean) => {
        setAmmo(curr);
        setIsReloading(reloading);
      };
      gameRef.current.onGrenadesUpdate = (count: number) => {
        setGrenades(count);
        setInventoryGrenades(count);
      };
      gameRef.current.onAimingUpdate = (aiming: boolean) => {
        setIsAiming(aiming);
      };
      gameRef.current.onPlayerHealthUpdate = (health: number) => {
        setPlayerHealth(health);
      };
      gameRef.current.onPlayerRespawnTick = (timeLeft: number | null) => {
        setRespawnTime(timeLeft);
      };
      
      // Initialize grenades count to match inventory
      gameRef.current.setGrenades(inventoryGrenades);
      gameRef.current.onScoreUpdate = (blue: number, red: number) => {
        setBlueScore(blue);
        setRedScore(red);
      };
      gameRef.current.onKillsUpdate = (kills: number) => {
        setPlayerKills(kills);
      };
      gameRef.current.onKillAlert = (msg: string) => {
        setKillAlert(msg);
        if (killAlertTimeoutRef.current)
          clearTimeout(killAlertTimeoutRef.current);
        killAlertTimeoutRef.current = setTimeout(
          () => setKillAlert(null),
          2500,
        );
      };
      gameRef.current.onKillFeed = (
        killer: string,
        victim: string,
        killerTeam: "blue" | "red",
        victimTeam: "blue" | "red",
        weapon: "gun" | "grenade",
      ) => {
        const eventId = killFeedIdCounter.current++;
        setKillFeed((prev) => [
          ...prev,
          { id: eventId, killer, victim, killerTeam, victimTeam, weapon },
        ]);
        setTimeout(() => {
          setKillFeed((prev) => prev.filter((e) => e.id !== eventId));
        }, 4000);
      };
      gameRef.current.onTimeUpdate = (time: number, overtime: boolean) => {
        setMatchTime(time);
        setIsOvertime(overtime);
      };
      gameRef.current.onGameOver = (win: boolean, stats: any[]) => {
        setGameOverState(win ? "win" : "lose");
        setEndStats(stats || []);

        const playerStats = stats?.find((s) => s.id === "player");
        if (playerStats) {
          let coinsWon = win ? 100 : 25;
          coinsWon += (playerStats.kills || 0) * 10;
          coinsWon += (playerStats.highestStreak || 0) * 5;
          coinsWon += (playerStats.highestCombo || 0) * 10;
          setEarnedCoins(coinsWon);
          setCoins((prev) => prev + coinsWon);

          setDailyMissions((prev) => {
            const newProgress = { ...prev.progress };
            prev.activeMissionIds.forEach((id) => {
              const mission = ALL_MISSIONS.find((m) => m.id === id);
              if (mission) {
                if (mission.type === "kills")
                  newProgress[id] =
                    (newProgress[id] || 0) + (playerStats.kills || 0);
                if (mission.type === "damage")
                  newProgress[id] =
                    (newProgress[id] || 0) + (playerStats.damage || 0);
                if (mission.type === "combo")
                  newProgress[id] = Math.max(
                    newProgress[id] || 0,
                    playerStats.highestCombo || 0,
                  );
                if (mission.type === "streak")
                  newProgress[id] = Math.max(
                    newProgress[id] || 0,
                    playerStats.highestStreak || 0,
                  );
                if (mission.type === "matches")
                  newProgress[id] = (newProgress[id] || 0) + 1;
                if (mission.type === "wins" && win)
                  newProgress[id] = (newProgress[id] || 0) + 1;
              }
            });
            return { ...prev, progress: newProgress };
          });
        } else {
          setEarnedCoins(0);
        }
      };
      gameRef.current.onHit = () => {
        setShowHitMarker(true);
        if (hitMarkerTimeoutRef.current)
          clearTimeout(hitMarkerTimeoutRef.current);
        hitMarkerTimeoutRef.current = setTimeout(
          () => setShowHitMarker(false),
          100,
        );
      };
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.cleanup();
        gameRef.current = null;
      }
    };
  }, [gameState]);

  const requestFullscreenAndStart = async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        /* Safari */
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        /* IE11 */
        await elem.msRequestFullscreen();
      }
    } catch (err) {
      console.warn(`Error attempting to enable fullscreen:`, err);
    }

    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock("landscape");
      }
    } catch (err) {
      console.warn(`Error attempting to lock orientation:`, err);
    }

    audioSystem.init();
    setGameState("playing");
  };

  const handleJoystickMove = (x: number, y: number) => {
    if (gameRef.current) {
      gameRef.current.setJoystickInput(x, y);
    }
  };

  const handleLookDown = (e: React.PointerEvent) => {
    activeLookPointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLookMove = (e: React.PointerEvent) => {
    const lastTouch = activeLookPointers.current[e.pointerId];
    if (lastTouch && gameRef.current) {
      const dx = e.clientX - lastTouch.x;
      const dy = e.clientY - lastTouch.y;

      gameRef.current.addCameraRotation(dx, dy);
      activeLookPointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
  };

  const handleLookUp = (e: React.PointerEvent) => {
    delete activeLookPointers.current[e.pointerId];
    if (e.target && (e.target as HTMLElement).releasePointerCapture) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (e) {}
    }
  };

  const handleFireDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    gameRef.current?.setFiring(true);
    handleLookDown(e);
  };

  const handleFireUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    gameRef.current?.setFiring(false);
    handleLookUp(e);
  };

  const handleReload = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    gameRef.current?.reload();
  };

  const handleGrenadeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (grenadeCooldown) return;
    gameRef.current?.startAimGrenade();
    handleLookDown(e);
  };

  const handleGrenadeUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (gameRef.current?.releaseGrenade()) {
      setGrenadeCooldown(true);
      setTimeout(() => setGrenadeCooldown(false), 1000);
    }
    handleLookUp(e);
  };

  const handleAimToggle = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    gameRef.current?.toggleAiming();
  };

  return (
    <div
      className="w-full h-screen bg-stone-900 text-white font-sans overflow-hidden select-none relative"
      style={{
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Portrait warning overlay for mobile users */}
      {isPortrait && (
        <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-md">
          <svg
            className="w-20 h-20 text-amber-500 mb-6 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 14V10a8 8 0 0116 0v4a8 8 0 01-16 0zM12 20v.01M16 10a4 4 0 00-8 0"
            />
          </svg>
          <h2 className="text-3xl font-black text-amber-500 uppercase tracking-widest mb-4">
            Rotate Device
          </h2>
          <p className="text-gray-300 text-lg">
            Please rotate your device to landscape mode for the best gaming
            experience.
          </p>
        </div>
      )}

      {gameState === "lobby" ? (
        <div className="w-full h-full relative bg-slate-950 overflow-hidden flex flex-col justify-between">
          <style>{`
            @keyframes gridMove {
              0% { background-position: 0 0; }
              100% { background-position: 40px 40px; }
            }
            @keyframes fogMove {
              0% { transform: scale(1) translate(0, 0); }
              33% { transform: scale(1.1) translate(2%, 2%); }
              66% { transform: scale(1.05) translate(-2%, 1%); }
              100% { transform: scale(1) translate(0, 0); }
            }
            @keyframes scanline {
              0% { top: -10%; }
              100% { top: 110%; }
            }
            @keyframes pulseGlow {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.6; }
            }
          `}</style>

          {/* Animated 3D Grid */}
          <div
            className="absolute inset-0 z-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "linear-gradient(#f59e0b 2px, transparent 2px), linear-gradient(90deg, #f59e0b 2px, transparent 2px)",
              backgroundSize: "40px 40px",
              animation: "gridMove 3s linear infinite",
              transform: "perspective(600px) rotateX(60deg) scale(2.5)",
              transformOrigin: "bottom center",
            }}
          ></div>

          {/* Fade out top of grid */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent"></div>

          {/* Dynamic Fog/Particles */}
          <div
            className="absolute inset-0 z-0 mix-blend-screen pointer-events-none"
            style={{ animation: "fogMove 15s ease-in-out infinite" }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 40%, rgba(245, 158, 11, 0.08) 0%, transparent 40%)",
                animation: "pulseGlow 4s ease-in-out infinite alternate",
              }}
            ></div>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 70% 60%, rgba(245, 158, 11, 0.06) 0%, transparent 50%)",
                animation:
                  "pulseGlow 5s ease-in-out infinite alternate-reverse",
              }}
            ></div>
          </div>

          {/* Scanning line */}
          <div
            className="absolute left-0 w-full h-[2px] bg-amber-500/30 shadow-[0_0_15px_#f59e0b] z-0"
            style={{ animation: "scanline 6s linear infinite" }}
          ></div>

          {/* Character Placeholder to look like In-Game Block Character */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative mt-[80px] flex flex-col items-center scale-[1.5] sm:scale-[2]">
              {/* Shadow */}
              <div className="w-[150px] h-[20px] bg-black/60 rounded-[100%] blur-md absolute -bottom-[15px]"></div>

              <PlayerPreview skin={equippedSkin} />
            </div>
          </div>

          {/* Top Left Game Info */}
          <div className="absolute top-6 left-6 z-10">
            <h1 className="text-5xl font-black text-amber-500 italic tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
              BLOCK
              <span className="text-white text-3xl tracking-normal border-l-2 ml-3 pl-3 border-gray-600 not-italic">
                STRIKE
              </span>
            </h1>
            <p className="text-gray-400 mt-2 font-mono text-sm uppercase bg-black/40 inline-block px-3 py-1 rounded">
              Target: 20 Kills | Weapon: M416
            </p>
          </div>

          {/* Top Right Buttons */}
          <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
            <div className="flex items-center gap-2 bg-amber-500/20 px-4 py-2 rounded-full border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="currentColor"
                  fillOpacity="0.2"
                />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
              <span className="font-mono font-bold text-amber-400 text-lg drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">
                {coins}
              </span>
            </div>

            <button
              onClick={() => setShowDailyReward(true)}
              className="p-3 bg-emerald-600/60 hover:bg-emerald-500/80 rounded-full border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center relative"
              title="Daily Reward"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
                <path d="M8 18h.01" />
                <path d="M12 18h.01" />
                <path d="M16 18h.01" />
              </svg>
              {canClaimDaily && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setShowMissionsModal(true)}
              className="p-3 bg-indigo-600/60 hover:bg-indigo-500/80 rounded-full border border-indigo-400/50 shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center"
              title="Daily Missions"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-3 bg-black/60 hover:bg-black/80 rounded-full border border-gray-600 shadow-xl transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          {/* Right Side Menu (Shop & Inventory) */}
          <div className="absolute top-28 right-6 z-10 flex flex-col items-end gap-6">
            <button
              onClick={() => setShowShop(true)}
              className="p-6 bg-yellow-500/80 hover:bg-yellow-400 rounded-2xl border-4 border-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.5)] transition-all flex flex-col items-center justify-center group"
              title="Shop"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-yellow-900 group-hover:scale-110 transition-transform drop-shadow-md"
              >
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <span className="font-black uppercase tracking-widest text-yellow-900 mt-2">
                Shop
              </span>
            </button>

            <button
              onClick={() => setShowInventory(true)}
              className="p-4 bg-slate-800/80 hover:bg-slate-700/90 rounded-xl border-2 border-slate-600 shadow-lg transition-all flex flex-col items-center justify-center group"
              title="Inventory"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300 group-hover:scale-110 transition-transform"
              >
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
              <span className="font-bold uppercase tracking-wider text-gray-300 mt-1 text-sm">
                Inventory
              </span>
            </button>
          </div>

          {/* Bottom Right Start Button */}
          <div className="absolute bottom-10 right-10 flex flex-col items-end gap-2 z-10">
            <div className="text-green-400 font-mono text-sm tracking-widest uppercase bg-black/60 px-3 py-1 rounded border border-green-900/50">
              ● Matchmaking Ready
            </div>
            <button
              onClick={requestFullscreenAndStart}
              className="px-20 py-5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-black text-4xl uppercase tracking-widest rounded-sm shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-all hover:scale-105 active:scale-95 cursor-pointer border-b-8 border-amber-700"
            >
              Start
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-full text-white">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block touch-none z-0"
          />

          {/* Look Area - covers screen, handles camera rotation, is behind UI and joystick */}
          <div
            className="absolute inset-0 z-10 touch-none cursor-crosshair"
            onPointerDown={handleLookDown}
            onPointerMove={handleLookMove}
            onPointerUp={handleLookUp}
            onPointerCancel={handleLookUp}
            onContextMenu={(e) => e.preventDefault()}
          ></div>

          <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none">
            <div className="bg-black/60 px-4 py-2 rounded font-mono border border-gray-600 text-lg flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="12" r="1"></circle>
                <circle cx="15" cy="12" r="1"></circle>
                <path d="M8 20v2h8v-2"></path>
                <path d="m12.5 17-.5-1-.5 1h1z"></path>
                <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"></path>
              </svg>
              <span className="text-gray-300 font-bold uppercase tracking-wider text-sm">
                Kills
              </span>
              <span className="text-white font-bold ms-1">{playerKills}</span>
            </div>

            <div className="bg-black/60 px-4 py-2 rounded font-mono border border-gray-600">
              <div className="text-xs text-gray-400 mb-1">HP</div>
              <div className="w-48 h-4 bg-gray-800 rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${playerHealth > 50 ? "bg-green-500" : playerHealth > 20 ? "bg-orange-500" : "bg-red-500"}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, playerHealth))}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Kill Feed (Left Side, Below Health) */}
            <div className="mt-2 flex flex-col items-start gap-1">
              {killFeed.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded text-sm font-bold font-mono border border-gray-700 shadow-md animate-in fade-in slide-in-from-left-4 duration-300"
                >
                  <span
                    className={
                      event.killerTeam === "blue"
                        ? "text-blue-400"
                        : "text-red-500"
                    }
                  >
                    {event.killer}
                  </span>
                  <span className="px-1 flex items-center justify-center">
                    {event.weapon === "grenade" ? (
                      <span
                        className="text-orange-400 font-bold scale-110 drop-shadow-[0_0_4px_rgba(255,165,0,0.8)]"
                        title="Grenade Kill"
                      >
                        💣
                      </span>
                    ) : (
                      <span
                        className="text-gray-400 opacity-80 scale-110"
                        title="Gun Kill"
                      >
                        🔫
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      event.victimTeam === "blue"
                        ? "text-blue-400"
                        : "text-red-500"
                    }
                  >
                    {event.victim}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Center Score and Timer */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-6 bg-black/80 px-8 py-2 rounded-lg border border-gray-700 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col items-center">
                <span className="text-xs text-blue-400 font-bold tracking-wider uppercase">
                  Blue Team
                </span>
                <span className="text-3xl font-black text-white">
                  {blueScore}
                </span>
              </div>
              <div className="text-orange-500 font-black text-3xl mb-1">20</div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-red-500 font-bold tracking-wider uppercase">
                  Red Team
                </span>
                <span className="text-3xl font-black text-white">
                  {redScore}
                </span>
              </div>
            </div>

            <div
              className={`px-4 py-1 rounded border shadow-sm font-mono font-bold text-lg 
              ${
                isOvertime
                  ? "bg-red-900/80 border-red-500 text-red-100 animate-pulse"
                  : matchTime < 30
                    ? "bg-orange-900/80 border-orange-500 text-orange-100"
                    : "bg-black/60 border-gray-600 text-gray-200"
              }`}
            >
              {isOvertime
                ? "OVERTIME"
                : `${Math.floor(Math.max(0, matchTime) / 60)}:${Math.floor(
                    Math.max(0, matchTime) % 60,
                  )
                    .toString()
                    .padStart(2, "0")}`}
            </div>
          </div>

          {/* Game Over Overlay */}
          {gameOverState && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 pointer-events-auto backdrop-blur-md overflow-y-auto pt-20 pb-20">
              <div
                className={`font-black text-6xl md:text-7xl tracking-widest uppercase mb-4 drop-shadow-[0_0_20px_rgba(0,0,0,1)] flex-shrink-0 ${gameOverState === "win" ? "text-amber-400" : "text-red-600"}`}
              >
                {gameOverState === "win" ? "VICTORY" : "DEFEAT"}
              </div>
              <div className="text-gray-300 font-mono text-xl mb-6 flex-shrink-0">
                Blue Team: {blueScore} - Red Team: {redScore}
              </div>

              {/* Match MVP Section */}
              {(() => {
                const mvp = endStats.length > 0 ? [...endStats].sort((a, b) => b.kills - a.kills || b.damage - a.damage)[0] : null;
                if (!mvp) return null;
                return (
                  <div className="flex flex-col items-center mb-6 bg-slate-800/60 border border-amber-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden w-full max-w-xs shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none"></div>
                    <div className="text-amber-400 font-black text-2xl uppercase tracking-widest mb-1 drop-shadow-md relative z-10">Match MVP</div>
                    <div className={`font-bold text-xl mb-2 relative z-10 ${mvp.team === "blue" ? "text-blue-400" : "text-red-400"}`}>{mvp.name}</div>
                    
                    {/* Character Preview */}
                    <div className="relative w-[150px] h-[200px] flex items-center justify-center -mt-4 mb-2 z-10">
                      <PlayerPreview skin={mvp.id === "player" ? equippedSkin : "default"} teamColor={mvp.team === "blue" ? 0x0055ff : 0xff0000} />
                    </div>

                    <div className="flex gap-6 text-sm font-mono bg-black/50 px-6 py-2 rounded-lg border border-slate-700 relative z-10">
                      <div className="flex flex-col items-center">
                        <span className="text-gray-400 text-xs">Kills</span>
                        <span className="text-amber-400 font-bold text-lg">{mvp.kills}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-400 text-xs">Damage</span>
                        <span className="text-amber-400 font-bold text-lg">{Math.round(mvp.damage)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="w-full max-w-4xl px-4 flex flex-col md:flex-row gap-6 mb-8 mt-2 flex-shrink-0">
                <div className="flex-1 bg-blue-900/40 border border-blue-500/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col min-h-[300px]">
                  <div className="bg-blue-600/50 py-3 text-center text-white font-bold tracking-widest sticky top-0 uppercase">
                    Blue Team
                  </div>
                  <div className="p-4 flex-1">
                    <div className="grid grid-cols-4 text-xs md:text-sm text-blue-200 uppercase tracking-widest font-bold mb-3 border-b border-blue-500/30 pb-2">
                      <div className="col-span-1">Name</div>
                      <div className="text-center">Kills</div>
                      <div className="text-center">Deaths</div>
                      <div className="text-right pr-2">Damage</div>
                    </div>
                    {endStats
                      .filter((s) => s.team === "blue")
                      .sort((a, b) => b.kills - a.kills || b.damage - a.damage)
                      .map((stat, i) => (
                        <div
                          key={i}
                          className={`grid grid-cols-4 text-sm md:text-base py-2 border-b border-blue-500/10 ${stat.id === "player" ? "text-amber-400 font-bold bg-white/5" : "text-gray-300"}`}
                        >
                          <div className="col-span-1 truncate">{stat.name}</div>
                          <div className="text-center">{stat.kills}</div>
                          <div className="text-center text-gray-500">
                            {stat.deaths}
                          </div>
                          <div className="text-right pr-2 font-mono">
                            {Math.round(stat.damage)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex-1 bg-red-900/40 border border-red-500/50 rounded-xl overflow-hidden backdrop-blur-sm flex flex-col min-h-[300px]">
                  <div className="bg-red-600/50 py-3 text-center text-white font-bold tracking-widest sticky top-0 uppercase">
                    Red Team
                  </div>
                  <div className="p-4 flex-1">
                    <div className="grid grid-cols-4 text-xs md:text-sm text-red-200 uppercase tracking-widest font-bold mb-3 border-b border-red-500/30 pb-2">
                      <div className="col-span-1">Name</div>
                      <div className="text-center">Kills</div>
                      <div className="text-center">Deaths</div>
                      <div className="text-right pr-2">Damage</div>
                    </div>
                    {endStats
                      .filter((s) => s.team === "red")
                      .sort((a, b) => b.kills - a.kills || b.damage - a.damage)
                      .map((stat, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-4 text-sm md:text-base py-2 border-b border-red-500/10 text-gray-300"
                        >
                          <div className="col-span-1 truncate">{stat.name}</div>
                          <div className="text-center">{stat.kills}</div>
                          <div className="text-center text-gray-500">
                            {stat.deaths}
                          </div>
                          <div className="text-right pr-2 font-mono">
                            {Math.round(stat.damage)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 mb-6">
                <div className="text-gray-400 font-mono text-sm uppercase tracking-widest">
                  Rewards Earned
                </div>
                <div className="flex items-center gap-3 bg-amber-500/20 px-6 py-3 rounded-full border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="currentColor"
                      fillOpacity="0.2"
                    />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                  <span className="font-mono font-bold text-amber-400 text-3xl drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">
                    +{earnedCoins}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setGameState("lobby");
                }}
                className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold py-4 px-12 rounded-lg text-lg md:text-xl uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)] mt-auto md:mt-4 pointer-events-auto flex-shrink-0"
              >
                Return to Lobby
              </button>
            </div>
          )}

          {/* Respawn Timer Overlay */}
          {respawnTime !== null && respawnTime > 0 && !gameOverState && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-30 pointer-events-none">
              <div className="text-red-500 font-black text-6xl tracking-widest uppercase mb-4 drop-shadow-lg">
                YOU DIED
              </div>
              <div className="text-white font-mono text-xl">
                Respawning in{" "}
                <span className="text-amber-500 font-bold text-3xl mx-2">
                  {respawnTime}
                </span>{" "}
                seconds...
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 z-20 flex gap-4 flex-col items-end">
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="bg-black/60 p-2 rounded border border-gray-600 text-gray-300 hover:text-white hover:bg-black/80 transition-colors pointer-events-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <div className="bg-black/60 px-4 py-2 rounded text-white font-mono border border-gray-600 pointer-events-none flex items-center gap-3">
                <div>
                  Weapon: <span className="text-amber-500 font-bold">M416</span>
                </div>
                <div className="bg-gray-800 px-3 py-1 rounded inline-flex items-center gap-2 min-w-[120px] justify-center">
                  {isReloading ? (
                    <span className="text-amber-400 font-bold animate-pulse text-sm">
                      RELOADING...
                    </span>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C10.5 2 9 4.5 9 8V18C9 19.5 10 21 12 22C14 21 15 19.5 15 18V8C15 4.5 13.5 2 12 2Z" />
                      </svg>
                      <span
                        className={`font-bold ${ammo <= 10 ? "text-red-500" : "text-white"}`}
                      >
                        {ammo}{" "}
                        <span className="text-gray-400 font-normal">
                          / {maxAmmo}
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 w-full text-center pointer-events-none z-20">
            <p className="inline-block bg-black/50 px-4 py-2 rounded text-gray-300 text-sm border border-gray-800">
              Desktop: WASD + Mouse Drag | Mobile: Touch Joystick + Swipe Right
              Side
            </p>
          </div>

          {/* Joystick Overlay */}
          <div
            style={
              controlUIStyle === "custom" || isEditingLayout
                ? {
                    position: "absolute",
                    left: `${buttonLayout.joystick.left}px`,
                    bottom: `${buttonLayout.joystick.bottom}px`,
                    margin: 0,
                    zIndex: 50,
                  }
                : undefined
            }
            className={
              controlUIStyle === "custom" || isEditingLayout
                ? `absolute z-50 ${isEditingLayout ? "ring-4 ring-amber-500 rounded-full cursor-move bg-black/20" : ""}`
                : `absolute bottom-12 left-12 z-50 transition-transform origin-bottom-left ${controlUIStyle === "compact" ? "scale-75 -translate-x-4 translate-y-4" : "scale-100"}`
            }
            onPointerDown={(e) => {
              if (isEditingLayout) handleDragStart(e, "joystick");
            }}
            onPointerMove={(e) => {
              if (isEditingLayout) handleDragMove(e);
            }}
            onPointerUp={(e) => {
              if (isEditingLayout) handleDragEnd(e);
            }}
            onPointerCancel={(e) => {
              if (isEditingLayout) handleDragEnd(e);
            }}
          >
            <div className={isEditingLayout ? "pointer-events-none" : ""}>
              <Joystick onMove={handleJoystickMove} />
            </div>
          </div>

          {/* Crosshair / Scope Overlay */}
          {isAiming ? (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden">
              {/* Reticle Base (Round thick frame) */}
              <div className={`relative w-full max-w-[28vh] aspect-square rounded-full border-[24px] flex items-center justify-center bg-transparent pointer-events-none ${
                equippedSkin === "godzilla" 
                  ? "godzilla-scope" 
                  : "border-[#0a0a0a] shadow-[inset_0_0_25px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.6)]"
              }`}>
                {/* Horizontal Line */}
                <div className={`absolute top-1/2 left-[-20%] w-[140%] h-[2px] -translate-y-1/2 mt-[1px] ${
                  equippedSkin === "godzilla" ? "bg-cyan-500/80 shadow-[0_0_10px_#0ff]" : "bg-black opacity-80"
                }`}></div>
                <div className={`absolute top-1/2 left-[-20%] w-[140%] h-[1px] -translate-y-1/2 ${
                  equippedSkin === "godzilla" ? "bg-cyan-300" : "bg-red-500/90"
                }`}></div>

                {/* Vertical Line */}
                <div className={`absolute top-[-20%] left-1/2 w-[2px] h-[140%] -translate-x-1/2 ml-[1px] ${
                  equippedSkin === "godzilla" ? "bg-cyan-500/80 shadow-[0_0_10px_#0ff]" : "bg-black opacity-80"
                }`}></div>
                <div className={`absolute top-[-20%] left-1/2 w-[1px] h-[140%] -translate-x-1/2 ${
                  equippedSkin === "godzilla" ? "bg-cyan-300" : "bg-red-500/90"
                }`}></div>

                {/* Center Dot */}
                <div className={`absolute w-2 h-2 rounded-full z-10 ${
                  equippedSkin === "godzilla" 
                    ? "bg-cyan-300 shadow-[0_0_10px_#0ff] border border-cyan-700" 
                    : "bg-red-500 shadow-[0_0_5px_red] border border-black/50"
                }`}></div>

                {/* Tick Marks - Horizontal */}
                <div className={`absolute top-1/2 left-[20%] w-[1px] h-4 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-1/2 left-[30%] w-[1px] h-6 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-1/2 left-[40%] w-[1px] h-4 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-1/2 right-[20%] w-[1px] h-4 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-1/2 right-[30%] w-[1px] h-6 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-1/2 right-[40%] w-[1px] h-4 -translate-y-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>

                {/* Tick Marks - Vertical (Bottom half only for bullet drop) */}
                <div className={`absolute top-[60%] left-1/2 h-[1px] w-4 -translate-x-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-[70%] left-1/2 h-[1px] w-6 -translate-x-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
                <div className={`absolute top-[80%] left-1/2 h-[1px] w-4 -translate-x-1/2 ${equippedSkin === "godzilla" ? "bg-cyan-400" : "bg-black"}`}></div>
              </div>
            </div>
          ) : (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
              <div className="w-1 h-1 bg-white rounded-full"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-[1.5px] border-white/50 rounded-full"></div>
              <div className="absolute top-1/2 -left-4 w-2 h-[1.5px] bg-white -translate-y-1/2"></div>
              <div className="absolute top-1/2 -right-4 w-2 h-[1.5px] bg-white -translate-y-1/2"></div>
              <div className="absolute -top-4 left-1/2 h-2 w-[1.5px] bg-white -translate-x-1/2"></div>
              <div className="absolute -bottom-4 left-1/2 h-2 w-[1.5px] bg-white -translate-x-1/2"></div>
            </div>
          )}

          {/* Hit Marker Component */}
          {showHitMarker && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[35]">
              <div className="relative w-6 h-6">
                {/* Diagonal lines forming an 'X' exactly in the center */}
                <div className="absolute top-1/2 left-1/2 w-[2px] h-6 bg-white -translate-x-1/2 -translate-y-1/2 rotate-45 shadow-[0_0_5px_rgba(255,0,0,1)] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 w-[2px] h-6 bg-white -translate-x-1/2 -translate-y-1/2 -rotate-45 shadow-[0_0_5px_rgba(255,0,0,1)] rounded-full"></div>
              </div>
            </div>
          )}

          {/* Kill Alert UI */}
          {killAlert && (
            <div className="absolute top-[25%] left-1/2 -translate-x-1/2 pointer-events-none z-[40] animate-bounce">
              <span
                className="text-4xl md:text-6xl font-black italic tracking-widest text-transparent uppercase font-[Impact,Arial_Black,sans-serif]"
                style={{
                  WebkitTextStroke: "2px #ffbb00",
                  background: "linear-gradient(to bottom, #ffea00, #ff5500)",
                  WebkitBackgroundClip: "text",
                  filter:
                    "drop-shadow(0px 4px 6px rgba(0,0,0,0.8)) drop-shadow(0 0 10px rgba(255,100,0,0.6))",
                }}
              >
                {killAlert}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div
            className={
              controlUIStyle === "custom" || isEditingLayout
                ? "absolute inset-0 pointer-events-none z-50"
                : `absolute bottom-24 right-20 z-50 flex gap-6 items-end transition-transform origin-bottom-right ${controlUIStyle === "compact" ? "scale-75 translate-x-12 translate-y-6" : "scale-100"}`
            }
          >
            {/* Reload Button */}
            <button
              style={
                controlUIStyle === "custom" || isEditingLayout
                  ? {
                      position: "absolute",
                      right: `${buttonLayout.reload.right}px`,
                      bottom: `${buttonLayout.reload.bottom}px`,
                      margin: 0,
                      transform: "none",
                    }
                  : undefined
              }
              onPointerDown={(e) => {
                if (isEditingLayout) handleDragStart(e, "reload");
                else handleReload(e);
              }}
              onPointerMove={(e) => {
                if (isEditingLayout) handleDragMove(e);
              }}
              onPointerUp={(e) => {
                if (isEditingLayout) handleDragEnd(e);
              }}
              onPointerCancel={(e) => {
                if (isEditingLayout) handleDragEnd(e);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-16 h-16 mb-4 mr-2 bg-gray-500/50 hover:bg-gray-400/60 backdrop-blur active:bg-gray-600/70 border border-gray-400/50 rounded-full flex items-center justify-center transition-colors pointer-events-auto ${isEditingLayout ? "ring-4 ring-amber-500 cursor-move" : ""}`}
              disabled={isReloading && !isEditingLayout}
            >
              <svg
                className={`w-8 h-8 text-white drop-shadow-md ${isReloading && !isEditingLayout ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
            </button>

            {/* Grenade Button */}
            <button
              style={
                controlUIStyle === "custom" || isEditingLayout
                  ? {
                      position: "absolute",
                      right: `${buttonLayout.grenade.right}px`,
                      bottom: `${buttonLayout.grenade.bottom}px`,
                      margin: 0,
                      transform: "none",
                    }
                  : undefined
              }
              onPointerDown={(e) => {
                if (isEditingLayout) handleDragStart(e, "grenade");
                else handleGrenadeDown(e);
              }}
              onPointerMove={(e) => {
                if (isEditingLayout) handleDragMove(e);
                else handleLookMove(e);
              }}
              onPointerUp={(e) => {
                if (isEditingLayout) handleDragEnd(e);
                else handleGrenadeUp(e);
              }}
              onPointerCancel={(e) => {
                if (isEditingLayout) handleDragEnd(e);
                else handleGrenadeUp(e);
              }}
              onPointerLeave={handleGrenadeUp}
              onContextMenu={(e) => e.preventDefault()}
              className={`relative w-16 h-16 mb-20 bg-green-900/60 hover:bg-green-800/60 backdrop-blur active:bg-green-700/70 border border-green-500/50 rounded-full flex items-center justify-center transition-colors pointer-events-auto touch-none select-none ${isEditingLayout ? "ring-4 ring-amber-500 cursor-move" : ""}`}
            >
              {grenadeCooldown && (
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="30"
                    fill="rgba(0,0,0,0.5)"
                    stroke="#4ade80"
                    strokeWidth="4"
                    strokeDasharray="188.5"
                    strokeDashoffset="0"
                    style={{ animation: 'grenade-cooldown 1s linear forwards' }}
                  />
                </svg>
              )}
              <div className="absolute top-0 right-0 bg-black text-white text-xs font-bold px-1.5 py-0.5 rounded-full translate-x-1/4 -translate-y-1/4 border border-green-500 z-20">
                {grenades}
              </div>
              <svg
                className="w-8 h-8 text-white drop-shadow-md relative z-20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="14" r="6" strokeWidth="2"></circle>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 8V6a2 2 0 114 0v2m-6 4h8"
                ></path>
              </svg>
            </button>

            {/* Aim Button */}
            <button
              style={
                controlUIStyle === "custom" || isEditingLayout
                  ? {
                      position: "absolute",
                      right: `${buttonLayout.aim.right}px`,
                      bottom: `${buttonLayout.aim.bottom}px`,
                      margin: 0,
                      transform: "none",
                    }
                  : undefined
              }
              onPointerDown={(e) => {
                if (isEditingLayout) handleDragStart(e, "aim");
                else handleAimToggle(e);
              }}
              onPointerMove={(e) => {
                if (isEditingLayout) handleDragMove(e);
              }}
              onPointerUp={(e) => {
                if (isEditingLayout) handleDragEnd(e);
              }}
              onPointerCancel={(e) => {
                if (isEditingLayout) handleDragEnd(e);
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-24 h-24 bg-white/20 hover:bg-white/30 backdrop-blur active:bg-white/50 border border-white/30 rounded-full flex items-center justify-center transition-colors pointer-events-auto ${isEditingLayout ? "ring-4 ring-amber-500 cursor-move" : ""}`}
            >
              <svg
                className="w-12 h-12 text-white drop-shadow-md"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="8" strokeWidth="2"></circle>
                <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2"></line>
                <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2"></line>
                <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2"></line>
                <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2"></line>
              </svg>
            </button>

            {/* Fire Button */}
            <button
              style={
                controlUIStyle === "custom" || isEditingLayout
                  ? {
                      position: "absolute",
                      right: `${buttonLayout.fire.right}px`,
                      bottom: `${buttonLayout.fire.bottom}px`,
                      margin: 0,
                      transform: "none",
                    }
                  : undefined
              }
              onPointerDown={(e) => {
                if (isEditingLayout) handleDragStart(e, "fire");
                else handleFireDown(e);
              }}
              onPointerMove={(e) => {
                if (isEditingLayout) handleDragMove(e);
                else handleLookMove(e);
              }}
              onPointerUp={(e) => {
                if (isEditingLayout) handleDragEnd(e);
                else handleFireUp(e);
              }}
              onPointerCancel={(e) => {
                if (isEditingLayout) handleDragEnd(e);
                else handleFireUp(e);
              }}
              onPointerLeave={handleFireUp}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-28 h-28 bg-amber-500/80 hover:bg-amber-400 backdrop-blur active:bg-amber-600 border border-amber-300/50 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all active:scale-95 pointer-events-auto ${isEditingLayout ? "ring-4 ring-amber-500 cursor-move" : ""}`}
            >
              <svg
                className="w-14 h-14 text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C10.5 2 9 4.5 9 8V18C9 19.5 10 21 12 22C14 21 15 19.5 15 18V8C15 4.5 13.5 2 12 2Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Daily Reward Modal */}
      {showDailyReward && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-lg p-8 w-full max-w-sm shadow-2xl relative text-center flex flex-col items-center">
            <button
              onClick={() => setShowDailyReward(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="w-24 h-24 bg-amber-500/20 rounded-full flex items-center justify-center border-2 border-amber-500/50 mb-6 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
              >
                <path d="M12 2v20"></path>
                <path d="m17 5-5-3-5 3v14l5 3 5-3Z"></path>
              </svg>
            </div>

            <h2 className="text-3xl font-black text-amber-400 uppercase tracking-widest mb-2 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
              Daily Reward
            </h2>
            <p className="text-gray-300 font-medium mb-8 uppercase tracking-wider text-sm">
              {canClaimDaily
                ? "Thanks for logging in today!"
                : "You have already claimed today's reward!"}
            </p>

            <div
              className={`flex items-center gap-3 bg-slate-800 px-6 py-3 rounded-full border border-slate-700 mb-8 ${!canClaimDaily ? "opacity-50" : ""}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-amber-400"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="currentColor"
                  fillOpacity="0.2"
                />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
              <span className="font-mono font-bold text-amber-400 text-2xl">
                +{dailyRewardAmount}
              </span>
            </div>

            <button
              onClick={() => {
                if (canClaimDaily) {
                  const today = new Date().toISOString().split("T")[0];
                  localStorage.setItem("tdm_last_login", today);
                  setCoins((prev) => prev + dailyRewardAmount);
                  setCanClaimDaily(false);
                } else {
                  setShowDailyReward(false);
                }
              }}
              className={`w-full py-4 font-black uppercase tracking-widest text-lg rounded-lg transition-colors ${
                canClaimDaily
                  ? "text-stone-900 bg-amber-500 hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                  : "text-white bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {canClaimDaily ? "Claim Reward" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* Daily Missions Modal */}
      {showMissionsModal && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-lg p-6 w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setShowMissionsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 className="text-2xl font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-4">
              Daily Missions
            </h2>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {dailyMissions.activeMissionIds.map((id) => {
                const mission = ALL_MISSIONS.find((m) => m.id === id);
                if (!mission) return null;
                const progress = dailyMissions.progress[id] || 0;
                const isComplete = progress >= mission.target;
                const isClaimed = dailyMissions.claimed[id];

                return (
                  <div
                    key={id}
                    className={`p-4 rounded border ${isClaimed ? "bg-green-900/20 border-green-500/30" : isComplete ? "bg-amber-900/20 border-amber-500/50" : "bg-slate-800 border-slate-700"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3
                          className={`font-bold uppercase tracking-wider ${isClaimed ? "text-green-500" : isComplete ? "text-amber-400" : "text-white"}`}
                        >
                          {mission.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {mission.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded text-amber-400 text-sm font-bold">
                        <span>+{mission.reward}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            fill="currentColor"
                            fillOpacity="0.2"
                          />
                          <path d="M12 8v8" />
                          <path d="M8 12h8" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex-1 bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-700">
                        <div
                          className={`h-full ${isComplete ? "bg-amber-500" : "bg-indigo-500"}`}
                          style={{
                            width: `${Math.min(100, (progress / mission.target) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-400 min-w-[50px] text-right">
                        {Math.min(progress, mission.target)} / {mission.target}
                      </span>

                      {isComplete && !isClaimed ? (
                        <button
                          onClick={() => {
                            setCoins((prev) => prev + mission.reward);
                            setDailyMissions((prev) => ({
                              ...prev,
                              claimed: { ...prev.claimed, [id]: true },
                            }));
                          }}
                          className="ml-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold text-xs uppercase tracking-wider rounded transition-colors"
                        >
                          Claim
                        </button>
                      ) : isClaimed ? (
                        <div className="ml-2 px-3 py-1 bg-green-900/50 text-green-500 font-bold text-xs uppercase tracking-wider rounded flex items-center gap-1 border border-green-500/30">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Claimed
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-center text-gray-500 text-xs font-mono">
              Missions refresh daily at midnight.
            </div>
          </div>
        </div>
      )}

      {/* Shop Modal */}
      {showShop && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-yellow-500/50 rounded-lg p-6 w-full max-w-2xl shadow-2xl relative h-[80vh] flex flex-col">
            <button
              onClick={() => setShowShop(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 className="text-3xl font-black text-yellow-400 uppercase tracking-widest mb-6 flex items-center gap-4 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Shop
            </h2>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between">
                <div className="text-4xl mb-4 mt-2">💣</div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-white uppercase tracking-wider">Grenade x 1</h3>
                  <p className="text-sm text-gray-400 font-mono">Boom!</p>
                </div>
                <button
                  onClick={() => {
                    if (coins >= 50) {
                      setCoins((prev) => prev - 50);
                      setInventoryGrenades((prev) => prev + 1);
                    }
                  }}
                  className={`w-full py-2 font-bold uppercase tracking-widest rounded ${coins >= 50 ? "bg-amber-500 hover:bg-amber-400 text-stone-900" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                  disabled={coins < 50}
                >
                  {coins >= 50 ? "Buy (50)" : "Not enough"}
                </button>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between">
                <div className="text-4xl mb-4 mt-2">💣</div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-white uppercase tracking-wider">Grenade x 5</h3>
                  <p className="text-sm text-gray-400 font-mono">Big boom!</p>
                </div>
                <button
                  onClick={() => {
                    if (coins >= 200) {
                      setCoins((prev) => prev - 200);
                      setInventoryGrenades((prev) => prev + 5);
                    }
                  }}
                  className={`w-full py-2 font-bold uppercase tracking-widest rounded ${coins >= 200 ? "bg-amber-500 hover:bg-amber-400 text-stone-900" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                  disabled={coins < 200}
                >
                  {coins >= 200 ? "Buy (200)" : "Not enough"}
                </button>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between col-span-full md:col-span-1">
                <button 
                  onClick={() => setPreviewSkin("godzilla")}
                  className="relative group p-0 bg-slate-900/50 rounded-lg hover:bg-slate-700 transition-colors w-full flex justify-center mb-4 cursor-pointer overflow-hidden"
                >
                  <div className="w-full h-32 flex justify-center items-center">
                    <GunThumbnail skin="godzilla" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity backdrop-blur-[1px]">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Preview</span>
                  </div>
                </button>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-cyan-400 uppercase tracking-wider">M416 Godzilla</h3>
                  <p className="text-sm text-gray-400 font-mono">Legendary Skin</p>
                </div>
                <button
                  onClick={() => {
                    if (!ownsGodzillaSkin && coins >= 10000) {
                      setCoins((prev) => prev - 10000);
                      setOwnsGodzillaSkin(true);
                    }
                  }}
                  className={`w-full py-2 font-bold uppercase tracking-widest rounded ${ownsGodzillaSkin ? "bg-cyan-900 text-cyan-400 border border-cyan-700" : coins >= 10000 ? "bg-cyan-500 hover:bg-cyan-400 text-stone-900 shadow-[0_0_15px_rgba(6,182,212,0.5)]" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                  disabled={ownsGodzillaSkin || coins < 10000}
                >
                  {ownsGodzillaSkin ? "Owned" : coins >= 10000 ? "Buy (10,000)" : "Not enough (10k)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventory && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-slate-500/50 rounded-lg p-6 w-full max-w-2xl shadow-2xl relative h-[80vh] flex flex-col">
            <button
              onClick={() => setShowInventory(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 className="text-3xl font-black text-gray-200 uppercase tracking-widest mb-6 flex items-center gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
              Inventory
            </h2>

            <div className="flex gap-4 mb-6 border-b border-slate-700 pb-2">
              <button
                onClick={() => setInventoryTab("weapons")}
                className={`px-4 py-2 font-bold uppercase tracking-wider ${inventoryTab === "weapons" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                Weapons
              </button>
              <button
                onClick={() => setInventoryTab("characters")}
                className={`px-4 py-2 font-bold uppercase tracking-wider ${inventoryTab === "characters" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                Characters
              </button>
              <button
                onClick={() => setInventoryTab("items")}
                className={`px-4 py-2 font-bold uppercase tracking-wider ${inventoryTab === "items" ? "text-amber-400 border-b-2 border-amber-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                Items
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              {inventoryTab === "items" ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between col-span-1">
                  <div className="text-4xl mb-4 mt-2">💣</div>
                  <div className="text-center mb-2">
                    <h3 className="font-bold text-white uppercase tracking-wider">Grenade</h3>
                  </div>
                  <div className="w-full text-center bg-slate-900 py-1 rounded">
                    <span className="font-mono text-amber-500 font-bold">x {inventoryGrenades}</span>
                  </div>
                </div>
              ) : inventoryTab === "weapons" ? (
                <>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-between col-span-1">
                    <button 
                      onClick={() => setPreviewSkin("default")}
                      className="relative group p-0 bg-slate-900/50 rounded-lg hover:bg-slate-700 transition-colors w-full flex justify-center mb-4 cursor-pointer overflow-hidden"
                    >
                      <div className="w-full h-24 flex justify-center items-center">
                        <GunThumbnail skin="default" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity backdrop-blur-[1px]">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Preview</span>
                      </div>
                    </button>
                    <div className="text-center mb-2">
                      <h3 className="font-bold text-white uppercase tracking-wider">M416 Standard</h3>
                    </div>
                    <button
                      onClick={() => setEquippedSkin("default")}
                      className={`w-full py-2 font-bold uppercase tracking-widest rounded ${equippedSkin === "default" ? "bg-amber-500 text-stone-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
                      disabled={equippedSkin === "default"}
                    >
                      {equippedSkin === "default" ? "Equipped" : "Equip"}
                    </button>
                  </div>
                  {ownsGodzillaSkin && (
                    <div className="bg-slate-800 border border-cyan-700 rounded-xl p-4 flex flex-col items-center justify-between col-span-1 shadow-[0_0_15px_rgba(6,182,212,0.1)] relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/40 to-transparent pointer-events-none"></div>
                      <button 
                        onClick={() => setPreviewSkin("godzilla")}
                        className="relative z-10 group p-0 bg-slate-900/50 rounded-lg hover:bg-slate-700 transition-colors w-full flex justify-center mb-4 cursor-pointer overflow-hidden"
                      >
                        <div className="w-full h-24 flex justify-center items-center">
                          <GunThumbnail skin="godzilla" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity backdrop-blur-[1px]">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Preview</span>
                        </div>
                      </button>
                      <div className="text-center mb-2 relative z-10">
                        <h3 className="font-bold text-cyan-400 uppercase tracking-wider">M416 Godzilla</h3>
                      </div>
                      <button
                        onClick={() => equippedSkin === "godzilla" ? setEquippedSkin("default") : setEquippedSkin("godzilla")}
                        className={`w-full py-2 font-bold uppercase tracking-widest rounded relative z-10 ${equippedSkin === "godzilla" ? "bg-cyan-400 text-stone-900 shadow-[0_0_10px_#0ff]" : "bg-cyan-900 hover:bg-cyan-800 text-cyan-100 border border-cyan-600"}`}
                      >
                        {equippedSkin === "godzilla" ? "Unequip" : "Equip"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center text-gray-500 h-64 border-2 border-dashed border-gray-700 rounded-xl">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-4 text-gray-600"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 12h8"></path>
                  </svg>
                  <p className="font-mono uppercase tracking-widest">
                    {inventoryTab} coming soon
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-20 p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 className="text-2xl font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-4">
              Settings
              {gameState === "playing" && (
                <span className="text-sm bg-red-600/20 text-red-500 px-3 py-1 rounded border border-red-500/30 tracking-widest">
                  PAUSED
                </span>
              )}
            </h2>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm font-mono text-gray-300 mb-2">
                  <span>Volume</span>
                  <span>{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-mono text-gray-300 mb-2">
                  <span>Sensitivity</span>
                  <span>{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm font-mono text-gray-300 mb-2">
                  <span>Control UI</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setControlUIStyle("standard")}
                    className={`flex-1 py-2 font-bold rounded ${controlUIStyle === "standard" ? "bg-amber-500 text-stone-900" : "bg-slate-800 text-white border border-slate-600"} transition-colors`}
                  >
                    Standard
                  </button>
                  <button
                    onClick={() => setControlUIStyle("compact")}
                    className={`flex-1 py-2 font-bold rounded ${controlUIStyle === "compact" ? "bg-amber-500 text-stone-900" : "bg-slate-800 text-white border border-slate-600"} transition-colors`}
                  >
                    Compact
                  </button>
                </div>
                <button
                  onClick={() => {
                    setControlUIStyle("custom");
                    setIsEditingLayout(true);
                    setShowSettings(false);
                  }}
                  className="w-full mt-4 py-2 font-bold rounded bg-slate-800 hover:bg-slate-700 text-amber-500 border border-slate-600 transition-colors uppercase tracking-wider"
                >
                  Edit Custom Layout
                </button>
              </div>

              {gameState === "playing" && (
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setGameState("lobby");
                    }}
                    className="w-full py-3 font-bold rounded bg-red-600 hover:bg-red-500 text-white transition-colors uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                  >
                    Go To Lobby
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewSkin && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setPreviewSkin(null)}
            className="absolute top-4 right-4 text-white hover:text-amber-500 z-[110] bg-slate-800/80 p-2 rounded-full backdrop-blur-sm border border-slate-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          <div className="w-full max-w-4xl h-[70vh] bg-slate-800/50 rounded-2xl border border-slate-600 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden relative">
            <GunPreview skin={previewSkin} />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-slate-700 pointer-events-none">
              <span className="text-gray-300 font-mono uppercase tracking-widest text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                Drag to rotate
              </span>
            </div>
          </div>
          
          <div className="mt-8 text-center max-w-lg">
            <h2 className="text-4xl font-bold text-white uppercase tracking-widest mb-2" style={{ textShadow: previewSkin === "godzilla" ? "0 0 20px #0ff" : "none" }}>
              M416 {previewSkin === "godzilla" ? "Godzilla" : "Standard"}
            </h2>
            <p className="text-gray-400 font-mono mb-6 text-lg">
              {previewSkin === "godzilla" ? "Legendary Weapon Skin" : "Standard Issue"}
            </p>
            
            <button
              onClick={() => {
                if (previewSkin === "godzilla" && !ownsGodzillaSkin) {
                  // If previewing godzilla and don't own it, do nothing or buy
                  if (coins >= 10000) {
                    setCoins(prev => prev - 10000);
                    setOwnsGodzillaSkin(true);
                  }
                } else {
                  setEquippedSkin(previewSkin);
                }
              }}
              className={`px-12 py-4 font-bold uppercase tracking-widest rounded text-xl ${
                equippedSkin === previewSkin 
                  ? "bg-amber-500 text-stone-900 shadow-[0_0_20px_rgba(245,158,11,0.5)]" 
                  : (previewSkin === "godzilla" && !ownsGodzillaSkin)
                    ? coins >= 10000 ? "bg-cyan-500 hover:bg-cyan-400 text-stone-900 shadow-[0_0_15px_rgba(6,182,212,0.5)]" : "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-slate-700 hover:bg-slate-600 text-white border border-slate-500"
              }`}
            >
              {equippedSkin === previewSkin 
                ? "Equipped" 
                : (previewSkin === "godzilla" && !ownsGodzillaSkin)
                  ? coins >= 10000 ? "Buy (10,000 Coins)" : "Not enough coins"
                  : "Equip Skin"}
            </button>
          </div>
        </div>
      )}

      {/* Editing Layout Banner */}
      {isEditingLayout && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100] bg-black/80 px-6 py-4 rounded-lg flex flex-col items-center gap-4 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <span className="text-amber-500 font-bold uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded">
            Edit Layout Mode
          </span>
          <span className="text-sm text-gray-300">
            Drag to freely position your controls
          </span>
          <button
            onClick={() => setIsEditingLayout(false)}
            className="bg-amber-500 text-stone-900 px-8 py-2 rounded font-bold tracking-wider hover:bg-amber-400 transition-colors border border-amber-300"
          >
            SAVE & CLOSE
          </button>
        </div>
      )}
    </div>
  );
}
