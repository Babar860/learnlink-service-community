const agentsUrl = process.env.AGENTS_SERVICE_URL ?? "http://localhost:5005";

export async function moderatePost(post: { id: string; content: string; media_url: string[]; post_type: string }) {
  const response = await fetch(`${agentsUrl}/agents/moderate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(post)
  });

  if (!response.ok) {
    return { decision: "approved", reason: "Agent unavailable in local mode; approved for development." };
  }

  return response.json() as Promise<{ decision: "approved" | "rejected"; reason: string }>;
}

export async function rankFeed(payload: { user_id: string; posts: unknown[]; onboarding_keywords?: string[] }) {
  const response = await fetch(`${agentsUrl}/agents/feed-rank`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) return payload.posts;
  const result = (await response.json()) as { ranked_posts: unknown[] };
  return result.ranked_posts;
}

