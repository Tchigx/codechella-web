"use node";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const think = action({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    if (!enabled) return;

    const players = await ctx.runQuery(api.game.players);
    if (players.length === 0) return; // No timer here!

    const cells = players.map((p) => ({
      cx: Math.floor((p.x + 64) / 16),
      cz: Math.floor((p.z + 64) / 16),
    }));

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
        temperature: 0.6, // Bumped up so it doesn't just spam boulders
        messages: [
          {
            role: "system",
            content:
              "You are a hostile dungeon master in an 8x8 arena (cells 0-7). " +
              "Predict where players are MOVING, not where they are — hazards " +
              "take 0.8s to land. " +
              "CRITICAL INSTRUCTION: You MUST randomly alternate your attacks. Do not just use 'boulder'. " +
              'Reply ONLY with JSON: {"kind":"boulder"|"misc"|"shards"|"zombies","x":0-7,"z":0-7,"taunt":"<8 words"}',
          },
          { role: "user", content: `Players at: ${JSON.stringify(cells)}` },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("GMI Cloud API Error:", res.status, errorText);
      return; // No timer here!
    }

    try {
      const data = await res.json();
      const raw = data.choices[0].message.content.replace(/```json|```/g, "").trim();
      const move = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));

      if (move.x >= 0 && move.x < 8 && move.z >= 0 && move.z < 8) {
        await ctx.runMutation(api.game.drop, {
          kind: move.kind, x: move.x, z: move.z,
        });
      }
    } catch (e) {
      console.error("god parse failed", e);
    }
    
    // No timer at the bottom either! The web panel controls the clock now.
  },
});