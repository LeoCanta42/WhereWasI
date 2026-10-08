export type MediaType = 'series' | 'book' | 'movie' | 'anime' | 'manga' | 'game' | 'podcast' | 'other'

export type MediaStatus = 'in_progress' | 'completed' | 'planned' | 'on_hold' | 'dropped'

export type ProgressType = 'episode_season' | 'pages' | 'percentage' | 'chapter' | 'custom'

export type ApprovalStatus = 'unknown' | 'approved' | 'pending'

export interface MediaItem {
  id: number
  user_id: string
  title: string
  media_type: MediaType
  status: MediaStatus
  progress_type: ProgressType
  season: number | null
  episode: number | null
  total_seasons: number | null
  total_episodes: number | null
  current_page: number | null
  total_pages: number | null
  percentage: number | null
  current_unit: string | null
  rating: number | null
  review: string
  notes: string
  cover_url: string | null
  tags: string[]
  genre: string
  is_favorite: boolean
  is_private: boolean
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Profile {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string
  approved: boolean
  is_admin: boolean
  created_at: string
  updated_at: string
  approved_at?: string | null
  approved_by?: string | null
}

export interface AdminUser {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  approved: boolean
  is_admin: boolean
  created_at: string
  last_sign_in_at: string | null
  approved_at: string | null
  media_count: number
  friend_count: number
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

export interface Friendship {
  id: number
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export interface FriendProfile extends Profile {
  friendship_id: number
  friendship_status: FriendshipStatus
  is_requester: boolean
  active_count?: number
  recent_media?: MediaItem[]
}

export interface MediaActivity {
  id: number
  user_id: string
  media_item_id: number | null
  media_title: string
  media_type: MediaType
  action_type: 'started' | 'progress_updated' | 'completed' | 'rated' | 'status_changed'
  progress_text: string | null
  message: string | null
  is_private: boolean
  created_at: string
  profile?: Profile
}

export interface MediaFilter {
  type: MediaType | 'all'
  status: MediaStatus | 'all'
  search: string
  tag: string | null
  sortBy: 'updated_at' | 'title' | 'rating' | 'progress'
  sortOrder: 'asc' | 'desc'
}
