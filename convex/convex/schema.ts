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
    pricePkr: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    redeemedAt: v.optional(v.number()),
    clientId: v.optional(v.string()),
    durationDays: v.optional(v.number()),
    paymentRequestId: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_client", ["clientId"]),

  activations: defineTable({
    code: v.string(),
    deviceId: v.string(),
    activatedAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_device", ["deviceId"]),

  clients: defineTable({
    id: v.string(),
    shopName: v.string(),
    ownerName: v.string(),
    email: v.string(),
    phone: v.string(),
    city: v.string(),
    deviceId: v.optional(v.string()),
    registeredAt: v.number(),
    lastSeenAt: v.number(),
    lastVersion: v.optional(v.string()),
    plan: v.union(v.literal("trial"), v.literal("monthly")),
    monthlyPricePkr: v.number(),
    durationDays: v.number(),
    trialEndsAt: v.number(),
    paidUntil: v.optional(v.number()),
    lifetime: v.boolean(),
    blocked: v.boolean(),
    notes: v.string(),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    activationCode: v.optional(v.string()),
    source: v.optional(v.union(v.literal("admin"), v.literal("pos"))),
  })
    .index("by_client_id", ["id"])
    .index("by_device", ["deviceId"])
    .index("by_email", ["email"]),

  payments: defineTable({
    id: v.string(),
    clientId: v.string(),
    amountPkr: v.number(),
    method: v.string(),
    txnId: v.string(),
    note: v.string(),
    submittedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    licenseKeyId: v.optional(v.string()),
    licenseKey: v.optional(v.string()),
  })
    .index("by_payment_id", ["id"])
    .index("by_client", ["clientId"])
    .index("by_status", ["status"]),

  adminUsers: defineTable({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("support")),
    passwordHash: v.string(),
    disabled: v.boolean(),
    notify: v.optional(
      v.object({
        payments: v.boolean(),
        clients: v.boolean(),
        crashes: v.boolean(),
        releases: v.boolean(),
        expiry: v.optional(v.boolean()),
      }),
    ),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_admin_id", ["id"]),

  notifications: defineTable({
    id: v.string(),
    type: v.union(
      v.literal("payment"),
      v.literal("client"),
      v.literal("crash"),
      v.literal("release"),
      v.literal("expiry"),
      v.literal("test"),
    ),
    title: v.string(),
    body: v.string(),
    url: v.string(),
    clientId: v.optional(v.string()),
    createdAt: v.number(),
    readBy: v.array(v.string()),
  })
    .index("by_notification_id", ["id"])
    .index("by_created", ["createdAt"]),

  pushSubscriptions: defineTable({
    id: v.string(),
    email: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_endpoint", ["endpoint"])
    .index("by_push_id", ["id"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  crashReports: defineTable({
    id: v.string(),
    clientId: v.optional(v.string()),
    deviceId: v.string(),
    licenseKey: v.optional(v.string()),
    app: v.string(),
    version: v.optional(v.string()),
    platform: v.optional(v.string()),
    title: v.string(),
    message: v.string(),
    logTail: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("resolved")),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_report_id", ["id"])
    .index("by_client", ["clientId"])
    .index("by_created", ["createdAt"]),

  activity: defineTable({
    id: v.string(),
    at: v.number(),
    actor: v.string(),
    clientId: v.optional(v.string()),
    kind: v.string(),
    message: v.string(),
  }).index("by_at", ["at"]),
});
