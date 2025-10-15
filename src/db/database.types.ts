export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          cloth_expires_at: string | null;
          cloth_path: string | null;
          consent_accepted_at: string;
          consent_version: string;
          created_at: string;
          free_generation_quota: number;
          free_generation_used: number;
          persona_path: string | null;
          quota_renewal_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cloth_expires_at?: string | null;
          cloth_path?: string | null;
          consent_accepted_at?: string;
          consent_version?: string;
          created_at?: string;
          free_generation_quota?: number;
          free_generation_used?: number;
          persona_path?: string | null;
          quota_renewal_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cloth_expires_at?: string | null;
          cloth_path?: string | null;
          consent_accepted_at?: string;
          consent_version?: string;
          created_at?: string;
          free_generation_quota?: number;
          free_generation_used?: number;
          persona_path?: string | null;
          quota_renewal_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vton_generations: {
        Row: {
          cloth_path_snapshot: string | null;
          completed_at: string | null;
          created_at: string;
          error_reason: string | null;
          expires_at: string | null;
          id: string;
          persona_path_snapshot: string;
          rated_at: string | null;
          result_path: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["generation_status"];
          user_id: string;
          user_rating: number | null;
          vertex_job_id: string | null;
        };
        Insert: {
          cloth_path_snapshot?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_reason?: string | null;
          expires_at?: string | null;
          id?: string;
          persona_path_snapshot: string;
          rated_at?: string | null;
          result_path?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          user_id: string;
          user_rating?: number | null;
          vertex_job_id?: string | null;
        };
        Update: {
          cloth_path_snapshot?: string | null;
          completed_at?: string | null;
          created_at?: string;
          error_reason?: string | null;
          expires_at?: string | null;
          id?: string;
          persona_path_snapshot?: string;
          rated_at?: string | null;
          result_path?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          user_id?: string;
          user_rating?: number | null;
          vertex_job_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vton_generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      generation_status: "queued" | "processing" | "succeeded" | "failed" | "expired";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      generation_status: ["queued", "processing", "succeeded", "failed", "expired"],
    },
  },
} as const;
