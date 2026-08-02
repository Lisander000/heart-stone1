export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          role: string | null
          status: string
          updated_at: string
          user_id: string
          workload: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workload?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workload?: number | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      case_events: {
        Row: {
          actor_email: string | null
          case_id: string
          created_at: string
          event_type: string
          id: string
          note: string | null
          payload: Json | null
          user_id: string
        }
        Insert: {
          actor_email?: string | null
          case_id: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          payload?: Json | null
          user_id: string
        }
        Update: {
          actor_email?: string | null
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          note?: string | null
          payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assignee_email: string | null
          case_number: string
          created_at: string
          customer_email: string | null
          description: string | null
          id: string
          order_id: string | null
          order_number: string | null
          priority: number
          resolved_at: string | null
          status: string
          subject: string | null
          tags: string[] | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_email?: string | null
          case_number?: string
          created_at?: string
          customer_email?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          priority?: number
          resolved_at?: string | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_email?: string | null
          case_number?: string
          created_at?: string
          customer_email?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          priority?: number
          resolved_at?: string | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_axes: {
        Row: {
          axis_key: string
          competitor_id: string
          content: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          axis_key: string
          competitor_id: string
          content?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          axis_key?: string
          competitor_id?: string
          content?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_axes_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          gooodboys_edge: string | null
          id: string
          logo_url: string | null
          missed_points: string | null
          name: string
          strong_points: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gooodboys_edge?: string | null
          id?: string
          logo_url?: string | null
          missed_points?: string | null
          name: string
          strong_points?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gooodboys_edge?: string | null
          id?: string
          logo_url?: string | null
          missed_points?: string | null
          name?: string
          strong_points?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          angle: string | null
          brand_id: string | null
          collection_id: string | null
          created_at: string
          customer_language: string | null
          customer_language_en: string | null
          desire: string | null
          emotional_trigger: string | null
          id: string
          image_path: string | null
          image_url: string | null
          objection: string | null
          original_language: string | null
          pain_point: string | null
          product_category: string | null
          rating: string | null
          raw_text: string
          sentiment: string | null
          source: string
          source_url: string | null
          subject_type: string | null
          tags: string[] | null
          translated_text: string | null
          use_case: string | null
          user_id: string
          visual_elements: string[] | null
          visual_style: string | null
        }
        Insert: {
          angle?: string | null
          brand_id?: string | null
          collection_id?: string | null
          created_at?: string
          customer_language?: string | null
          customer_language_en?: string | null
          desire?: string | null
          emotional_trigger?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          objection?: string | null
          original_language?: string | null
          pain_point?: string | null
          product_category?: string | null
          rating?: string | null
          raw_text: string
          sentiment?: string | null
          source?: string
          source_url?: string | null
          subject_type?: string | null
          tags?: string[] | null
          translated_text?: string | null
          use_case?: string | null
          user_id: string
          visual_elements?: string[] | null
          visual_style?: string | null
        }
        Update: {
          angle?: string | null
          brand_id?: string | null
          collection_id?: string | null
          created_at?: string
          customer_language?: string | null
          customer_language_en?: string | null
          desire?: string | null
          emotional_trigger?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          objection?: string | null
          original_language?: string | null
          pain_point?: string | null
          product_category?: string | null
          rating?: string | null
          raw_text?: string
          sentiment?: string | null
          source?: string
          source_url?: string | null
          subject_type?: string | null
          tags?: string[] | null
          translated_text?: string | null
          use_case?: string | null
          user_id?: string
          visual_elements?: string[] | null
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          occurred_at: string | null
          order_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          occurred_at?: string | null
          order_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          occurred_at?: string | null
          order_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_inbox: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string | null
          link: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          link?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string | null
          link?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_comparisons: {
        Row: {
          created_at: string
          id: string
          offer_ids: string[]
          summary: string | null
          user_id: string
          winners: Json
        }
        Insert: {
          created_at?: string
          id?: string
          offer_ids?: string[]
          summary?: string | null
          user_id: string
          winners?: Json
        }
        Update: {
          created_at?: string
          id?: string
          offer_ids?: string[]
          summary?: string | null
          user_id?: string
          winners?: Json
        }
        Relationships: []
      }
      offers: {
        Row: {
          ai_analyzed_at: string | null
          ai_positioning: string | null
          ai_reasoning: string | null
          ai_value_score: number | null
          brand_name: string | null
          bundle: string | null
          claims: string | null
          competitor_id: string | null
          created_at: string
          currency: string
          discount: string | null
          format: string | null
          guarantee: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_own: boolean
          name: string
          price: number | null
          shipping: string | null
          target_audience: string | null
          updated_at: string
          upsell: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_positioning?: string | null
          ai_reasoning?: string | null
          ai_value_score?: number | null
          brand_name?: string | null
          bundle?: string | null
          claims?: string | null
          competitor_id?: string | null
          created_at?: string
          currency?: string
          discount?: string | null
          format?: string | null
          guarantee?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_own?: boolean
          name: string
          price?: number | null
          shipping?: string | null
          target_audience?: string | null
          updated_at?: string
          upsell?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_positioning?: string | null
          ai_reasoning?: string | null
          ai_value_score?: number | null
          brand_name?: string | null
          bundle?: string | null
          claims?: string | null
          competitor_id?: string | null
          created_at?: string
          currency?: string
          discount?: string | null
          format?: string | null
          guarantee?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_own?: boolean
          name?: string
          price?: number | null
          shipping?: string | null
          target_audience?: string | null
          updated_at?: string
          upsell?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          fulfillment_status: string
          id: string
          notes: string | null
          order_number: string
          placed_at: string | null
          status: string
          total: number | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number: string
          placed_at?: string | null
          status?: string
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number?: string
          placed_at?: string | null
          status?: string
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_health: {
        Row: {
          created_at: string
          id: string
          issues: string | null
          product_name: string
          return_rate: number | null
          review_score: number | null
          sku: string | null
          status: string | null
          stock: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issues?: string | null
          product_name: string
          return_rate?: number | null
          review_score?: number | null
          sku?: string | null
          status?: string | null
          stock?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issues?: string | null
          product_name?: string
          return_rate?: number | null
          review_score?: number | null
          sku?: string | null
          status?: string | null
          stock?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      returns: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          order_id: string | null
          reason: string | null
          refund_amount: number | null
          requested_at: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          requested_at?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount?: number | null
          requested_at?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string | null
          shipped_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      syntheses: {
        Row: {
          created_at: string
          entry_count: number
          id: string
          result: Json
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_count?: number
          id?: string
          result: Json
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_count?: number
          id?: string
          result?: Json
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          invited_at: string | null
          name: string
          role: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string | null
          name: string
          role?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          invited_at?: string | null
          name?: string
          role?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          assignee_email: string | null
          body: string | null
          channel: string | null
          created_at: string
          customer_email: string | null
          id: string
          order_id: string | null
          priority: string
          status: string
          subject: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          assignee_email?: string | null
          body?: string | null
          channel?: string | null
          created_at?: string
          customer_email?: string | null
          id?: string
          order_id?: string | null
          priority?: string
          status?: string
          subject: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          assignee_email?: string | null
          body?: string | null
          channel?: string | null
          created_at?: string
          customer_email?: string | null
          id?: string
          order_id?: string | null
          priority?: string
          status?: string
          subject?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
