export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          id: string
          email?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string
          approved?: boolean
          is_admin?: boolean
          created_at?: string
          updated_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string
          approved?: boolean
          is_admin?: boolean
          created_at?: string
          updated_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: []
      }
      friendships: {
        Row: {
          id: number
          requester_id: string
          addressee_id: string
          status: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          requester_id?: string
          addressee_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          requester_id?: string
          addressee_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_items: {
        Row: {
          id: number
          user_id: string
          title: string
          media_type: 'series' | 'book' | 'movie' | 'game' | 'podcast' | 'other'
          status: 'in_progress' | 'completed' | 'planned' | 'on_hold' | 'dropped'
          progress_type: 'episode_season' | 'pages' | 'percentage' | 'chapter' | 'time' | 'custom'
          season: number | null
          episode: number | null
          total_seasons: number | null
          total_episodes: number | null
          season_episodes: Record<string, number> | null
          time_stopped: string | null
          total_duration: string | null
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
        }
        Insert: {
          id?: number
          user_id?: string
          title: string
          media_type?: 'series' | 'book' | 'movie' | 'game' | 'podcast' | 'other'
          status?: 'in_progress' | 'completed' | 'planned' | 'on_hold' | 'dropped'
          progress_type?: 'episode_season' | 'pages' | 'percentage' | 'chapter' | 'time' | 'custom'
          season?: number | null
          episode?: number | null
          total_seasons?: number | null
          total_episodes?: number | null
          season_episodes?: Record<string, number> | null
          time_stopped?: string | null
          total_duration?: string | null
          current_page?: number | null
          total_pages?: number | null
          percentage?: number | null
          current_unit?: string | null
          rating?: number | null
          review?: string
          notes?: string
          cover_url?: string | null
          tags?: string[]
          genre?: string
          is_favorite?: boolean
          is_private?: boolean
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          title?: string
          media_type?: 'series' | 'book' | 'movie' | 'game' | 'podcast' | 'other'
          status?: 'in_progress' | 'completed' | 'planned' | 'on_hold' | 'dropped'
          progress_type?: 'episode_season' | 'pages' | 'percentage' | 'chapter' | 'time' | 'custom'
          season?: number | null
          episode?: number | null
          total_seasons?: number | null
          total_episodes?: number | null
          season_episodes?: Record<string, number> | null
          time_stopped?: string | null
          total_duration?: string | null
          current_page?: number | null
          total_pages?: number | null
          percentage?: number | null
          current_unit?: string | null
          rating?: number | null
          review?: string
          notes?: string
          cover_url?: string | null
          tags?: string[]
          genre?: string
          is_favorite?: boolean
          is_private?: boolean
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_activities: {
        Row: {
          id: number
          user_id: string
          media_item_id: number | null
          media_title: string
          media_type: string
          action_type: string
          progress_text: string | null
          message: string | null
          is_private: boolean
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string
          media_item_id?: number | null
          media_title: string
          media_type: string
          action_type: string
          progress_text?: string | null
          message?: string | null
          is_private?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          media_item_id?: number | null
          media_title?: string
          media_type?: string
          action_type?: string
          progress_text?: string | null
          message?: string | null
          is_private?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      send_friend_request_by_identifier: {
        Args: {
          identifier: string
        }
        Returns: Json
      }
      are_friends: {
        Args: {
          u1: string
          u2: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: {
          uid: string
        }
        Returns: boolean
      }
      is_approved: {
        Args: {
          uid: string
        }
        Returns: boolean
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
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
        }[]
      }
      admin_set_approved: {
        Args: {
          p_user_id: string
          p_approved: boolean
        }
        Returns: void
      }
      admin_set_admin: {
        Args: {
          p_user_id: string
          p_is_admin: boolean
        }
        Returns: void
      }
      admin_set_password: {
        Args: {
          p_user_id: string
          p_password: string
        }
        Returns: void
      }
      admin_delete_user: {
        Args: {
          p_user_id: string
        }
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
