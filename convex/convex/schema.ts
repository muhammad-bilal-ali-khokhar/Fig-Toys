import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  activationCodes: defineTable({
    code: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("active"),
      v.literal("disabled"),
      v.literal("expired"),
    ),
    customerName: v.string(),
    edition: v.string(),
    maxDevices: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    redeemedAt: v.optional(v.number()),
  }).index("by_code", ["code"]),

  activations: defineTable({
    code: v.string(),
    deviceId: v.string(),
    activatedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_device", ["deviceId"]),
});