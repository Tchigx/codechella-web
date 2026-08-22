"use node";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const think = action({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    if (!enabled) return;

    const players = await ctx.runQuery(api.game.players);
    if (players.length === 0) {
      await ctx.scheduler.runAfter(3000, api.god.think, { enabled });
      return;
    }

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
        model: "deepseek-ai/DeepSeek-R1",
        max_tokens: 200,
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content:
              "You are a hostile dungeon master in an 8x8 arena (cells 0-7). " +
              "Predict where players are MOVING, not where they are — hazards " +
              "take 0.8s to land. Reply ONLY with JSON: " +
              '{"kind":"boulder"|"misc"|"shards","x":0-7,"z":0-7,"taunt":"<8 words"}',
          },
          { role: "user", content: `Players at: ${JSON.stringify(cells)}` },
        ],
      }),
    });

   // Add this safety check right before the try block!
    if (!res.ok) {
      const errorText = await res.text();
      console.error("GMI Cloud API Error:", res.status, errorText);
      await ctx.scheduler.runAfter(3000, api.god.think, { enabled });
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
      }
    } catch (e) {
      console.error("god parse failed", e);
    }

    await ctx.scheduler.runAfter(3000, api.god.think, { enabled });
  },
});