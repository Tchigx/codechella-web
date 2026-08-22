import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const DURATION = 45_000;   // 45s — long enough for stakes, short enough to demo

export const current = query({
  args: {},
  handler: async (ctx) => {
    const r = await ctx.db.query("rounds").order("desc").first();
    if (!r) return null;

    const remaining = Math.max(0, r.endsAt - Date.now());
    const elapsed = Math.min(r.duration, Date.now() - r.startedAt);

    return {
      ...r,
      remainingMs: remaining,
      intensity: r.status === "live" ? 1 - remaining / r.duration : 0,
      playerScore: Math.floor(elapsed / 1000),
      webScore: r.hits * 10,
    };
  },
});

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("rounds", {
      status: "live",
      startedAt: now,
      endsAt: now + DURATION,
      duration: DURATION,
      hits: 0,
    });
    await ctx.scheduler.runAfter(DURATION, api.round.finish, { winner: "player" });
    return id;
  },
});

export const finish = mutation({
  args: { winner: v.string() },
  handler: async (ctx, { winner }) => {
    const r = await ctx.db.query("rounds").order("desc").first();
    if (!r || r.status !== "live") return;   // already ended — ignore
    await ctx.db.patch(r._id, { status: "over", winner });
  },
});

export const report = mutation({
  args: { hits: v.number(), died: v.boolean() },
  handler: async (ctx, { hits, died }) => {
    const r = await ctx.db.query("rounds").order("desc").first();
    if (!r || r.status !== "live") return;

    if (hits > 0) await ctx.db.patch(r._id, { hits: r.hits + hits });
    if (died) await ctx.db.patch(r._id, { status: "over", winner: "web" });
  },
});