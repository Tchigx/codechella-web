import { useState, useEffect } from "react";
// 1. Added useAction here
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { GRID, toCell, inBounds } from "./lib/grid";

const HAZARDS = [
  { id: "boulder", label: "Boulder", color: "#a5473c" },
  { id: "misc",   label: "Misc",   color: "#2ce253" },
  { id: "shards", label: "Shards", color: "#5b8dd6" },
  { id: "zombies", label: "Zombies", color: "#123107" },
];

export default function GodPanel() {
  const players = useQuery(api.game.players) ?? [];
  const drop = useMutation(api.game.drop);
  
  // 2. Hooked up the AI logic
  const think = useAction(api.god.think);
  
  // This tracks which button is currently selected
  const [kind, setKind] = useState("boulder");
  
  // 3. Tracks whether the AI is currently attacking
  const [ai, setAi] = useState(false);

  // --- THIS IS THE NEW MAGIC TIMER ---
  useEffect(() => {
    if (!ai) return; // If button is off, do nothing

    // Drop one immediately when turned on
    think({ enabled: true });

    // Start the 3-second loop
    const timer = setInterval(() => {
      think({ enabled: true });
    }, 3000);

    // Kills the timer instantly when you toggle the button off
    return () => clearInterval(timer);
  }, [ai, think]);
  // ------------------------------------

  const occupied = new Set(
    players
      .map((p) => toCell(p.x, p.z))
      .filter(({ cx, cz }) => inBounds(cx, cz))
      .map(({ cx, cz }) => `${cx},${cz}`)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "min(90vw, 480px)" }}>
      
      {/* The New Toolbar */}
      <div style={{ display: "flex", gap: 8 }}>
        {HAZARDS.map((h) => (
          <button
            key={h.id}
            onClick={() => setKind(h.id)}
            style={{
              flex: 1, padding: "12px 8px", cursor: "pointer",
              background: kind === h.id ? h.color : "#222",
              color: kind === h.id ? "#000" : "#888",
              border: `2px solid ${kind === h.id ? h.color : "#333"}`,
              fontWeight: kind === h.id ? 700 : 400,
            }}
          >
            {h.label}
          </button>
        ))}
      </div>

      {/* 4. The AI Toggle Button */}
      <button 
        // --- SIMPLIFIED THIS ONCLICK ---
        onClick={() => setAi(!ai)}
        style={{
          padding: "16px", width: "100%", cursor: "pointer",
          background: ai ? "#9932CC" : "#222",
          color: ai ? "#fff" : "#888",
          fontWeight: "bold", border: `2px solid ${ai ? "#9932CC" : "#333"}`,
          textTransform: "uppercase", letterSpacing: "1px"
        }}
      >
        {ai ? "🧠 AI Overlord: Active" : "Awaken AI"}
      </button>

      {/* The Existing Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${GRID}, 1fr)`,
        gap: 2, aspectRatio: "1",
      }}>
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const cx = i % GRID, cz = Math.floor(i / GRID);
          return (
            <button
              key={i}
              // Notice how this now passes the dynamic `kind` state!
              onClick={() => drop({ kind, x: cx, z: cz })} 
              style={{
                background: occupied.has(`${cx},${cz}`) ? "#e33" : "#222",
                border: "1px solid #444",
              }}
            />
          );
        })}
      </div>
      
    </div>
  );
}