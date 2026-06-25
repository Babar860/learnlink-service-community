export type PostStatus = "pending" | "approved" | "rejected" | "removed";
export type PostType = "platform_post" | "community_post" | "channel_post";
export type TargetType = "community" | "channel" | "user";

export interface Community {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  is_public: true;
  subscriber_count: number;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  is_paid: boolean;
  price_monthly: number;
  stripe_product_id?: string;
  organization_id?: string;
  grade?: string;
  created_at: string;
}

export interface Post {
  id: string;
  content: string;
  media_url: string[];
  author_id: string;
  post_type: PostType;
  parent_id?: string;
  ai_moderation_status: PostStatus;
  ai_moderation_reason?: string;
  ai_moderation_checked_at?: string;
  published_at?: string;
  created_at: string;
}

export interface Follow {
  id: string;
  user_id: string;
  target_id: string;
  target_type: TargetType;
  created_at: string;
}

