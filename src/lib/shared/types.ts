/**
 * The part of the dealt_with schema the app reaches through the client (supabase/0002_account.sql).
 * Records and settings go through src/lib/shared/remote.ts and are not listed here.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  dealt_with: {
    Tables: {
      shares: {
        Row: { code: string; owner: string; data: Json; expires_at: string; created_at: string };
        Insert: { code: string; data: Json; expires_at: string; owner?: string; created_at?: string };
        Update: { code?: string; data?: Json; expires_at?: string };
        Relationships: [];
      };
      plans: {
        Row: { user_id: string; active: boolean; tester: boolean; customer: string | null; subscription: string | null; updated_at: string };
        Insert: { user_id: string };
        Update: { user_id?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      share_get: { Args: { share_code: string }; Returns: Json };
      share_reply: { Args: { share_code: string; reply: string; helper_name: string; photo?: string; done?: boolean }; Returns: boolean };
      share_opened: { Args: { share_code: string }; Returns: undefined };
      delete_my_account: { Args: never; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
