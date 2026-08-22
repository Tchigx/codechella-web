import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const think = action({
  // 1. Added intensity to the arguments
  args: { enabled: v.boolean(), intensity: v.optional(v.number()) },
  handler: async (ctx, { enabled, intensity = 0 }) => {
    if (!enabled) return;

    const players = await ctx.runQuery(api.game.players);
    if (players.length === 0) return; 

    const cells = players.map((p) => ({
      cx: Math.floor((p.x + 64) / 16),
      cz: Math.floor((p.z + 64) / 16),
    }));

    // 2. Convert intensity (0.0 to 1.0) into a scale of 0 to 10
    const aggressionLevel = Math.floor(intensity * 10);

    const res = await fetch("https://api.gmi-serving.com/v1/chat/completions", {
      method: "POST",
      headers: {
        // @ts-ignore
        Authorization: `Bearer ${process.env.GMI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3-0324",
        max_tokens: 200,
        temperature: 0.85, 
        messages: [
          {
            role: "system",
            content:
              "You are a chaotic, hostile dungeon master in an 8x8 arena (cells 0-7). " +
              "Predict where players are MOVING. " +
              "CRITICAL: You MUST use a completely random hazard every single time. Never use the same hazard twice in a row. Surprise the players! " +
              'Reply ONLY with JSON: {"kind":"boulder"|"misc"|"shards"|"zombies","x":0-7,"z":0-7,"taunt":"<8 words"}',
          },
          { 
            role: "user", 
            // 3. Injected the aggression level into the prompt
            content: `Players at: ${JSON.stringify(cells)}. Aggression level: ${aggressionLevel}/10` 
          },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("GMI Cloud API Error:", res.status, errorText);
      return; 
    }

    try {
      const data = await res.json();
      const raw = data.choices[0].message.content.replace(/```json|```/g, "").trim();
      const move = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

      if (move.x >= 0 && move.x < 8 && move.z >= 0 && move.z < 8) {
        await ctx.runMutation(api.game.drop, {
          kind: move.kind, x: move.x, z: move.z,
        });
        return move; 
      }
    } catch (e) {
      console.error("god parse failed", e);
    }
  },
});