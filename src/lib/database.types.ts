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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          application_id: string | null
          candidate_id: string
          created_at: string
          field: string | null
          from_value: string | null
          id: string
          to_value: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          application_id?: string | null
          candidate_id: string
          created_at?: string
          field?: string | null
          from_value?: string | null
          id?: string
          to_value?: string | null
          type: string
          workspace_id: string
        }
        Update: {
          application_id?: string | null
          candidate_id?: string
          created_at?: string
          field?: string | null
          from_value?: string | null
          id?: string
          to_value?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_labels: {
        Row: {
          application_id: string
          created_at: string
          label_id: string
          workspace_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          label_id: string
          workspace_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          label_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_labels_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          body: string
          created_at: string
          id: string
          stage_id: string | null
          workspace_id: string
        }
        Insert: {
          application_id: string
          body: string
          created_at?: string
          id?: string
          stage_id?: string | null
          workspace_id: string
        }
        Update: {
          application_id?: string
          body?: string
          created_at?: string
          id?: string
          stage_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          archived_at: string | null
          candidate_id: string
          company_id: string
          created_at: string
          id: string
          rank: string
          role: string
          stage_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          candidate_id: string
          company_id: string
          created_at?: string
          id?: string
          rank: string
          role: string
          stage_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          candidate_id?: string
          company_id?: string
          created_at?: string
          id?: string
          rank?: string
          role?: string
          stage_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          archived_at: string | null
          color: string
          context: string | null
          created_at: string
          email: string | null
          headline: string | null
          id: string
          links: string[]
          name: string
          phone: string | null
          skills: string[]
          source: string | null
          updated_at: string
          workspace_id: string
          years_experience: number | null
        }
        Insert: {
          archived_at?: string | null
          color: string
          context?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          links?: string[]
          name: string
          phone?: string | null
          skills?: string[]
          source?: string | null
          updated_at?: string
          workspace_id: string
          years_experience?: number | null
        }
        Update: {
          archived_at?: string | null
          color?: string
          context?: string | null
          created_at?: string
          email?: string | null
          headline?: string | null
          id?: string
          links?: string[]
          name?: string
          phone?: string | null
          skills?: string[]
          source?: string | null
          updated_at?: string
          workspace_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          context: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          is_preset: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_preset?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_preset?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_final: boolean
          is_preset: boolean
          name: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_final?: boolean
          is_preset?: boolean
          name: string
          sort_order: number
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_final?: boolean
          is_preset?: boolean
          name?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_application_note: {
        Args: {
          p_application_id: string
          p_body: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_application: {
        Args: {
          p_candidate_id: string
          p_company_name: string
          p_rank: string
          p_role: string
          p_stage_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_candidate: {
        Args: {
          p_email?: string
          p_headline?: string
          p_name: string
          p_skills?: string[]
          p_workspace_id: string
        }
        Returns: string
      }
      create_label: {
        Args: { p_color: string; p_name: string; p_workspace_id: string }
        Returns: string
      }
      delete_application: {
        Args: { p_application_id: string; p_workspace_id: string }
        Returns: undefined
      }
      engineer_palette: { Args: never; Returns: string[] }
      find_or_create_company: {
        Args: { p_name: string; p_workspace_id: string }
        Returns: string
      }
      move_application: {
        Args: {
          p_application_id: string
          p_rank: string
          p_stage_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      next_engineer_color: { Args: { p_workspace_id: string }; Returns: string }
      set_application_label: {
        Args: {
          p_application_id: string
          p_label_id: string
          p_on: boolean
          p_workspace_id: string
        }
        Returns: undefined
      }
      set_candidate_archived: {
        Args: {
          p_archived: boolean
          p_candidate_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      update_candidate: {
        Args: {
          p_candidate_id: string
          p_context: string
          p_email: string
          p_headline: string
          p_links: string[]
          p_name: string
          p_phone: string
          p_skills: string[]
          p_source: string
          p_workspace_id: string
          p_years_experience: number
        }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
