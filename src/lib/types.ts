export type ProfileCard = {
  id: string; username: string; display_name: string; avatar_url: string | null;
  mood?: string | null; mood_color?: string | null; is_private?: boolean;
};
export type Post = {
  id: string; author_id: string; kind: string; body: string | null; mood: string | null; visibility: string;
  media: { url: string; alt?: string }[]; meta: Record<string, unknown>; repost_of: string | null; created_at: string; edited_at: string | null;
};
