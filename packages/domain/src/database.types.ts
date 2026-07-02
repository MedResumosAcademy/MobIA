// Tipos gerados do banco Supabase (projeto ImobIA - Dev).
// NÃO editar à mão — regenerar com a ferramenta generate_typescript_types
// do MCP Supabase após cada migração e colar aqui.

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
      cliente_profiles: {
        Row: {
          atualizado_em: string | null
          capacidade_calculada: number | null
          cidade: string | null
          consentimento_leads: boolean
          consentimento_leads_em: string | null
          data_nascimento: string | null
          dependentes: number | null
          estado_civil: string | null
          fgts: number | null
          renda_conjuge: number | null
          renda_mensal: number | null
          renda_outros_membros: number | null
          uf: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string | null
          capacidade_calculada?: number | null
          cidade?: string | null
          consentimento_leads?: boolean
          consentimento_leads_em?: string | null
          data_nascimento?: string | null
          dependentes?: number | null
          estado_civil?: string | null
          fgts?: number | null
          renda_conjuge?: number | null
          renda_mensal?: number | null
          renda_outros_membros?: number | null
          uf?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string | null
          capacidade_calculada?: number | null
          cidade?: string | null
          consentimento_leads?: boolean
          consentimento_leads_em?: string | null
          data_nascimento?: string | null
          dependentes?: number | null
          estado_civil?: string | null
          fgts?: number | null
          renda_conjuge?: number | null
          renda_mensal?: number | null
          renda_outros_membros?: number | null
          uf?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_profiles_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_profiles: {
        Row: {
          creci: string
          org_id: string
          usuario_id: string
        }
        Insert: {
          creci: string
          org_id: string
          usuario_id: string
        }
        Update: {
          creci?: string
          org_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corretor_profiles_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          imovel_id: string | null
          metadata: Json
          org_id: string | null
          tipo: string
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          imovel_id?: string | null
          metadata?: Json
          org_id?: string | null
          tipo: string
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          imovel_id?: string | null
          metadata?: Json
          org_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      favoritos: {
        Row: {
          cliente_id: string
          criado_em: string
          id: string
          imovel_id: string
          org_id: string
          unidade_id: string | null
        }
        Insert: {
          cliente_id: string
          criado_em?: string
          id?: string
          imovel_id: string
          org_id: string
          unidade_id?: string | null
        }
        Update: {
          cliente_id?: string
          criado_em?: string
          id?: string
          imovel_id?: string
          org_id?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favoritos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favoritos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis: {
        Row: {
          area_util: number | null
          atualizado_em: string | null
          banheiros: number | null
          categorias: string[]
          cidade: string
          condicao: string | null
          corretor_responsavel_id: string
          criado_em: string
          descricao: string | null
          endereco: string | null
          esquema_pagamento: Json | null
          fotos: string[]
          id: string
          lat: number | null
          lng: number | null
          modalidades_elegiveis: string[]
          org_id: string
          plantas: string[]
          quartos: number | null
          status: string
          tipo: string | null
          uf: string
          vagas: number | null
          valor: number
        }
        Insert: {
          area_util?: number | null
          atualizado_em?: string | null
          banheiros?: number | null
          categorias?: string[]
          cidade: string
          condicao?: string | null
          corretor_responsavel_id: string
          criado_em?: string
          descricao?: string | null
          endereco?: string | null
          esquema_pagamento?: Json | null
          fotos?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          modalidades_elegiveis?: string[]
          org_id: string
          plantas?: string[]
          quartos?: number | null
          status?: string
          tipo?: string | null
          uf: string
          vagas?: number | null
          valor: number
        }
        Update: {
          area_util?: number | null
          atualizado_em?: string | null
          banheiros?: number | null
          categorias?: string[]
          cidade?: string
          condicao?: string | null
          corretor_responsavel_id?: string
          criado_em?: string
          descricao?: string | null
          endereco?: string | null
          esquema_pagamento?: Json | null
          fotos?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          modalidades_elegiveis?: string[]
          org_id?: string
          plantas?: string[]
          quartos?: number | null
          status?: string
          tipo?: string | null
          uf?: string
          vagas?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_corretor_responsavel_id_fkey"
            columns: ["corretor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imoveis_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          atualizado_em: string | null
          cliente_id: string
          cliques_financiamento: number
          corretor_id: string
          criado_em: string
          eventos_count: number
          favoritos: number
          id: string
          imovel_id: string
          org_id: string
          origem: string | null
          retornos: number
          simulacoes: number
          temperatura: string | null
          ultimo_evento_em: string | null
          visitas: number
        }
        Insert: {
          atualizado_em?: string | null
          cliente_id: string
          cliques_financiamento?: number
          corretor_id: string
          criado_em?: string
          eventos_count?: number
          favoritos?: number
          id?: string
          imovel_id: string
          org_id: string
          origem?: string | null
          retornos?: number
          simulacoes?: number
          temperatura?: string | null
          ultimo_evento_em?: string | null
          visitas?: number
        }
        Update: {
          atualizado_em?: string | null
          cliente_id?: string
          cliques_financiamento?: number
          corretor_id?: string
          criado_em?: string
          eventos_count?: number
          favoritos?: number
          id?: string
          imovel_id?: string
          org_id?: string
          origem?: string | null
          retornos?: number
          simulacoes?: number
          temperatura?: string | null
          ultimo_evento_em?: string | null
          visitas?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          assentos: number
          atualizado_em: string | null
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          assentos: number
          atualizado_em?: string | null
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          assentos?: number
          atualizado_em?: string | null
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      parametros_financeiros: {
        Row: {
          criado_em: string
          dados: Json
          fonte: string
          versao: number
          vigencia_inicio: string
        }
        Insert: {
          criado_em?: string
          dados: Json
          fonte: string
          versao: number
          vigencia_inicio: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          fonte?: string
          versao?: number
          vigencia_inicio?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          atualizado_em: string | null
          criado_em: string
          id: string
          nome: string | null
          org_id: string | null
          papel: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string
          id: string
          nome?: string | null
          org_id?: string | null
          papel?: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string
          id?: string
          nome?: string | null
          org_id?: string | null
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes: {
        Row: {
          cliente_id: string | null
          criado_em: string
          eh_estimativa: boolean
          entrada_escolhida: number
          id: string
          imovel_id: string
          modalidade: string
          org_id: string
          parametros_versao: number
          resultado: Json
          unidade_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          criado_em?: string
          eh_estimativa?: boolean
          entrada_escolhida: number
          id?: string
          imovel_id: string
          modalidade: string
          org_id: string
          parametros_versao: number
          resultado: Json
          unidade_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          criado_em?: string
          eh_estimativa?: boolean
          entrada_escolhida?: number
          id?: string
          imovel_id?: string
          modalidade?: string
          org_id?: string
          parametros_versao?: number
          resultado?: Json
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          andar: number | null
          id: string
          identificador: string
          imovel_id: string
          org_id: string
          posicao: string | null
          status: string
          valor: number
        }
        Insert: {
          andar?: number | null
          id?: string
          identificador: string
          imovel_id: string
          org_id: string
          posicao?: string | null
          status?: string
          valor: number
        }
        Update: {
          andar?: number | null
          id?: string
          identificador?: string
          imovel_id?: string
          org_id?: string
          posicao?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "unidades_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
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
