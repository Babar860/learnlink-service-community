import cors from "cors";
import "dotenv/config";
import express from "express";
import { z } from "zod";
import { moderatePost, rankFeed } from "./agents.js";
import type { Channel, Community, Follow, Post } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const communities: Community[] = [];
const channels: Channel[] = [];
const posts: Post[] = [];
const follows: Follow[] = [];
const subscriptions: unknown[] = [];

const postSchema = z.object({
  content: z.string().min(1),
  media_url: z.array(z.string().url()).default([]),
  author_id: z.string().min(1),
  post_type: z.enum(["platform_post", "community_post", "channel_post"]).default("platform_post"),
  parent_id: z.string().optional()
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "learnlink-service-community" }));

app.post("/posts", async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_post", details: parsed.error.flatten() });

  const now = new Date().toISOString();
  const post: Post = {
    ...parsed.data,
    id: crypto.randomUUID(),
    ai_moderation_status: "pending",
    created_at: now
  };
  posts.push(post);

  const result = await moderatePost(post);
  post.ai_moderation_status = result.decision === "approved" ? "approved" : "rejected";
  post.ai_moderation_reason = result.reason;
  post.ai_moderation_checked_at = new Date().toISOString();
  post.published_at = result.decision === "approved" ? post.ai_moderation_checked_at : undefined;

  res.status(202).json({
    post,
    notification: post.ai_moderation_status === "rejected" ? "FCM + email rejection notice queued" : "FCM approval notice queued"
  });
});

app.get("/feed/:userId", async (req, res) => {
  const followed = new Set(follows.filter((follow) => follow.user_id === req.params.userId).map((follow) => follow.target_id));
  const sourcePosts = posts.filter((post) => {
    if (post.ai_moderation_status !== "approved") return false;
    if (post.post_type === "platform_post") return true;
    return post.parent_id ? followed.has(post.parent_id) : false;
  });
  const ranked = await rankFeed({ user_id: req.params.userId, posts: sourcePosts });
  res.json({ posts: ranked });
});

app.post("/communities", (req, res) => {
  const body = z.object({ name: z.string(), description: z.string(), owner_id: z.string() }).parse(req.body);
  const community: Community = { ...body, id: crypto.randomUUID(), is_public: true, subscriber_count: 0, created_at: new Date().toISOString() };
  communities.push(community);
  res.status(201).json({ community });
});

app.post("/channels", (req, res) => {
  const body = z.object({
    name: z.string(),
    description: z.string(),
    owner_id: z.string(),
    is_paid: z.boolean().default(false),
    price_monthly: z.number().int().nonnegative().default(0),
    stripe_product_id: z.string().optional(),
    organization_id: z.string().optional(),
    grade: z.string().optional()
  }).parse(req.body);

  if (channels.some((channel) => channel.owner_id === body.owner_id)) {
    return res.status(409).json({ error: "one_channel_per_email_enforced" });
  }

  const channel: Channel = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  channels.push(channel);
  res.status(201).json({ channel, stripe_connect_required: channel.is_paid });
});

app.post("/follows", (req, res) => {
  const body = z.object({
    user_id: z.string(),
    target_id: z.string(),
    target_type: z.enum(["community", "channel", "user"])
  }).parse(req.body);
  const follow: Follow = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  follows.push(follow);
  res.status(201).json({ follow });
});

app.post("/channels/:channelId/subscribe", (req, res) => {
  const payload = {
    id: crypto.randomUUID(),
    channel_id: req.params.channelId,
    user_id: String(req.body.user_id ?? ""),
    status: "checkout_required",
    stripe_checkout_mode: "subscription"
  };
  subscriptions.push(payload);
  res.status(201).json(payload);
});

app.post("/cron/reanalyze-posts", async (_req, res) => {
  const approved = posts.filter((post) => post.ai_moderation_status === "approved");
  let removed = 0;

  for (const post of approved) {
    const result = await moderatePost(post);
    if (result.decision === "rejected") {
      post.ai_moderation_status = "removed";
      post.ai_moderation_reason = result.reason;
      post.ai_moderation_checked_at = new Date().toISOString();
      removed += 1;
    }
  }

  res.json({ checked: approved.length, removed, notification: "FCM + email removal notices queued when needed" });
});

app.post("/cron/channel-eligibility", (req, res) => {
  const threshold = Number(process.env.ACTIVITY_SCORE_THRESHOLD ?? 0.65);
  res.json({
    evaluated: true,
    threshold,
    mode: "automatic_agent_authority",
    notification: "Eligible users receive FCM + email"
  });
});

app.get("/admin/moderation-log", (_req, res) => {
  res.json({ posts });
});

app.get("/admin/channel-eligibility-log", (_req, res) => {
  res.json({ threshold: Number(process.env.ACTIVITY_SCORE_THRESHOLD ?? 0.65), channels_created: channels.length });
});

const port = Number(process.env.COMMUNITY_PORT ?? 4100);
app.listen(port, () => console.log(`community service listening on :${port}`));

