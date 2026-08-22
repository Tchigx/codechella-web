import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";

/* ------------------------------------------------------------------
   Arena constants — must match the Luau script exactly.
------------------------------------------------------------------ */
const GRID = 8;
const CELL = 16;
const ORIGIN_X = -64;
const ORIGIN_Z = -64;
const SPAN = GRID * CELL; // 128 studs

/* These four ids are the contract. They must match:
     - the `handlers` table in the Roblox server script
     - the kinds listed in the god.ts system prompt
   Anything missing from `handlers` is silently ignored in-game. */
const HAZARDS = [
  { id: "boulder", name: "Boulder", mark: "\u25CF", hue: "#E4562A", line: "Falls from the sky. Crushes." },
  { id: "misc",    name: "Misc",    mark: "\u2731", hue: "#C8A24A", line: "Random debris from above." },
  { id: "shards",  name: "Shards",  mark: "\u2726", hue: "#5B8DD6", line: "Lethal glass fragments." },
  { id: "zombies", name: "Zombies", mark: "\u2620", hue: "#6CC24A", line: "The undead rise to feast." },
];

export default function GodPanel() {
  const players = useQuery(api.game.players) ?? [];
  const drop = useMutation(api.game.drop);
  const think = useAction(api.god.think);

  const [kind, setKind] = useState("boulder");
  const [rings, setRings] = useState<{ id: number; cx: number; cz: number; hue: string }[]>([]);
  const [count, setCount] = useState(0);
  const [ai, setAi] = useState(false);
  const ringId = useRef(0);

  const active = HAZARDS.find((h) => h.id === kind)!;

  function animateRing(cx: number, cz: number, hazardKind: string) {
    const hazard = HAZARDS.find((h) => h.id === hazardKind) || HAZARDS[0];
    setCount((c) => c + 1);
    const id = ringId.current++;
    setRings((r) => [...r, { id, cx, cz, hue: hazard.hue }]);
    setTimeout(() => setRings((r) => r.filter((x) => x.id !== id)), 800);
  }

  /* Chained loop, not setInterval: the 1.5s gap starts AFTER each
     response, so slow inference can never stack requests. */
  useEffect(() => {
    if (!ai) return;
    let alive = true;

    (async function loop() {
      while (alive) {
        try {
          const move = await think({ enabled: true });
          if (alive && move) animateRing(move.x, move.z, move.kind);
        } catch (e) {
          console.error("AI Error:", e);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();

    return () => { alive = false; };
  }, [ai, think]);

  function strike(cx: number, cz: number) {
    drop({ kind, x: cx, z: cz });
    animateRing(cx, cz, kind);
  }

  return (
    <>
      <style>{css}</style>
      <div className="gp-root">
        <header className="gp-head">
          <span className="gp-eyebrow">Codechella</span>
          <h1 className="gp-title">Wrath</h1>
          <p className="gp-sub">
            Eight by eight. {players.length === 0
              ? "The arena is empty."
              : `${players.length} mortal${players.length > 1 ? "s" : ""} below.`}
          </p>
        </header>

        <div className="gp-rack" role="radiogroup" aria-label="Choose a hazard">
          {HAZARDS.map((h) => (
            <button
              key={h.id}
              role="radio"
              aria-checked={kind === h.id}
              className={`gp-sigil ${kind === h.id ? "is-armed" : ""}`}
              style={{ ["--hue" as string]: h.hue }}
              onClick={() => setKind(h.id)}
            >
              <span className="gp-mark">{h.mark}</span>
              <span className="gp-name">{h.name}</span>
            </button>
          ))}
        </div>

        <p className="gp-line">{active.line}</p>

        <button
          className={`gp-ai-btn ${ai ? "is-active" : ""}`}
          onClick={() => setAi(!ai)}
          aria-pressed={ai}
        >
          {ai ? "Overlord awakened" : "Awaken the overlord"}
        </button>

        <div className="gp-board" style={{ ["--hue" as string]: active.hue }}>
          <div className="gp-cells">
            {Array.from({ length: GRID * GRID }, (_, i) => {
              const cx = i % GRID;
              const cz = Math.floor(i / GRID);
              const activeDrop = rings.find((r) => r.cx === cx && r.cz === cz);

              return (
                <button
                  key={i}
                  className={`gp-cell ${(cx + cz) % 2 === 0 ? "is-dark" : ""}`}
                  style={
                    activeDrop
                      ? {
                          background: `color-mix(in srgb, ${activeDrop.hue} 50%, #201D2E)`,
                          boxShadow: `inset 0 0 0 1px ${activeDrop.hue}`,
                        }
                      : undefined
                  }
                  onClick={() => strike(cx, cz)}
                  aria-label={`Cell ${cx}, ${cz}`}
                />
              );
            })}
          </div>

          {rings.map((r) => (
            <span
              key={r.id}
              className="gp-ring"
              style={{
                left: `${((r.cx + 0.5) / GRID) * 100}%`,
                top: `${((r.cz + 0.5) / GRID) * 100}%`,
                borderColor: r.hue,
              }}
            />
          ))}

          {players.map((p) => (
            <span
              key={p.userId}
              className="gp-mortal"
              style={{
                left: `${((p.x - ORIGIN_X) / SPAN) * 100}%`,
                top: `${((p.z - ORIGIN_Z) / SPAN) * 100}%`,
              }}
            />
          ))}
        </div>

        <footer className="gp-foot">
          <div className="gp-stat">
            <span className="gp-num">{String(count).padStart(3, "0")}</span>
            <span className="gp-cap">Cast</span>
          </div>
          <div className="gp-stat">
            <span className="gp-num">{String(players.length).padStart(3, "0")}</span>
            <span className="gp-cap">Below</span>
          </div>
        </footer>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');

.gp-root {
  --void:  #0B0A12;
  --stone: #16141F;
  --slab:  #1E1B2B;
  --brass: #C8A24A;
  --bone:  #EDE7D9;

  min-height: 100vh;
  margin: 0;
  padding: 28px 20px 40px;
  box-sizing: border-box;
  background:
    radial-gradient(120% 70% at 50% -10%, #221C33 0%, transparent 60%),
    var(--void);
  color: var(--bone);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.gp-head { text-align: center; }

.gp-eyebrow {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: var(--brass);
  opacity: 0.75;
}

.gp-title {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: clamp(38px, 11vw, 60px);
  letter-spacing: 0.16em;
  margin: 6px 0 2px;
  color: var(--bone);
  text-shadow: 0 0 34px rgba(200, 162, 74, 0.28);
}

.gp-sub {
  margin: 0;
  font-size: 13px;
  color: rgba(237, 231, 217, 0.5);
}

/* --- hazard rack ------------------------------------------------ */
.gp-rack {
  display: flex;
  gap: 8px;
  width: min(92vw, 480px);
}

.gp-sigil {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 4px 10px;
  cursor: pointer;
  background: var(--stone);
  color: rgba(237, 231, 217, 0.42);
  border: 1px solid rgba(200, 162, 74, 0.16);
  border-radius: 2px;
  transition: color .18s, border-color .18s, background .18s, transform .12s;
}
.gp-sigil:hover { color: rgba(237, 231, 217, 0.75); }
.gp-sigil:active { transform: translateY(1px); }
.gp-sigil:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }

.gp-sigil.is-armed {
  color: var(--hue);
  border-color: var(--hue);
  background: color-mix(in srgb, var(--hue) 10%, var(--stone));
  box-shadow: 0 0 22px -6px var(--hue), inset 0 0 18px -12px var(--hue);
}

.gp-mark { font-size: 17px; line-height: 1; }

.gp-name {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.gp-line {
  margin: -8px 0 0;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(237, 231, 217, 0.4);
}

/* --- overlord toggle -------------------------------------------- */
.gp-ai-btn {
  width: min(92vw, 480px);
  padding: 14px;
  cursor: pointer;
  background: var(--stone);
  color: rgba(237, 231, 217, 0.45);
  border: 1px solid rgba(200, 162, 74, 0.2);
  border-radius: 2px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  transition: color .2s, border-color .2s, background .2s, box-shadow .2s;
}
.gp-ai-btn:hover { color: rgba(237, 231, 217, 0.8); border-color: rgba(200, 162, 74, 0.45); }
.gp-ai-btn:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }

.gp-ai-btn.is-active {
  background: color-mix(in srgb, var(--brass) 12%, var(--stone));
  color: var(--brass);
  border-color: var(--brass);
  box-shadow: 0 0 24px -8px var(--brass), inset 0 0 18px -10px var(--brass);
  animation: vigil 2.4s ease-in-out infinite;
}

@keyframes vigil {
  0%, 100% { box-shadow: 0 0 24px -8px var(--brass), inset 0 0 18px -10px var(--brass); }
  50%      { box-shadow: 0 0 34px -4px var(--brass), inset 0 0 22px -8px var(--brass); }
}

/* --- board ------------------------------------------------------ */
.gp-board {
  position: relative;
  width: min(92vw, 480px);
  height: min(92vw, 480px);
  padding: 7px;
  box-sizing: border-box;
  background: var(--slab);
  border: 1px solid rgba(200, 162, 74, 0.28);
  border-radius: 2px;
  box-shadow: 0 0 60px -22px var(--hue), 0 22px 60px -30px #000;
  transition: box-shadow .3s;
}

.gp-cells {
  display: grid;
  grid-template-columns: repeat(${GRID}, 1fr);
  grid-template-rows: repeat(${GRID}, 1fr);
  gap: 2px;
  width: 100%;
  height: 100%;
}

.gp-cell {
  border: 0;
  padding: 0;
  cursor: crosshair;
  background: #201D2E;
  transition: background .14s, box-shadow .14s;
}
.gp-cell.is-dark { background: #191626; }

@media (hover: hover) {
  .gp-cell:hover {
    background: color-mix(in srgb, var(--hue) 26%, #201D2E);
    box-shadow: inset 0 0 0 1px var(--hue);
  }
}
.gp-cell:active { background: color-mix(in srgb, var(--hue) 40%, #201D2E); }
.gp-cell:focus-visible { outline: 2px solid var(--brass); outline-offset: -2px; }

/* --- signature: the wrath ring --------------------------------- */
.gp-ring {
  position: absolute;
  width: 12px; height: 12px;
  margin: -6px 0 0 -6px;
  border: 1.5px solid;
  border-radius: 50%;
  pointer-events: none;
  animation: bloom .8s cubic-bezier(.15,.7,.3,1) forwards;
}

@keyframes bloom {
  0%   { transform: scale(1);  opacity: 1; }
  100% { transform: scale(11); opacity: 0; }
}

/* --- mortals ---------------------------------------------------- */
.gp-mortal {
  position: absolute;
  width: 11px; height: 11px;
  margin: -5.5px 0 0 -5.5px;
  border-radius: 50%;
  background: var(--bone);
  box-shadow: 0 0 12px 2px rgba(237, 231, 217, 0.55);
  pointer-events: none;
  transition: left .32s linear, top .32s linear;
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 1;    }
  50%      { opacity: 0.45; }
}

/* --- footer ----------------------------------------------------- */
.gp-foot {
  display: flex;
  gap: 40px;
  width: min(92vw, 480px);
  padding-top: 4px;
  justify-content: center;
  border-top: 1px solid rgba(200, 162, 74, 0.14);
}

.gp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 12px;
}

.gp-num {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 21px;
  font-weight: 500;
  color: var(--brass);
}

.gp-cap {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(237, 231, 217, 0.32);
}

@media (prefers-reduced-motion: reduce) {
  .gp-ring, .gp-mortal, .gp-ai-btn.is-active { animation: none; }
  .gp-mortal { transition: none; }
}
`;