import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  commands: defineTable({
    kind: v.string(),        // "boulder" | "flame" | "gravity"
    x: v.number(),
    z: v.number(),
  }),
  
  players: defineTable({
    userId: v.string(),
    x: v.number(), 
    y: v.number(), 
    z: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  rounds: defineTable({
    status: v.string(),             // "idle" | "live" | "over"
    startedAt: v.number(),
    endsAt: v.number(),
    duration: v.number(),
    hits: v.number(),               // web team damage events
    winner: v.optional(v.string()), // "player" | "web"
  }),
});