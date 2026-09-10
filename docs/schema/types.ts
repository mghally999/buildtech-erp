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
      activity_log: {
        Row: {
          action: string
          actor: string | null
          actor_email: string | null
          happened_at: string
          id: number
          row_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_email?: string | null
          happened_at?: string
          id?: number
          row_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_email?: string | null
          happened_at?: string
          id?: number
          row_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: []
      }
      applied_migrations: {
        Row: {
          applied_at: string
          name: string
        }
        Insert: {
          applied_at?: string
          name: string
        }
        Update: {
          applied_at?: string
          name?: string
        }
        Relationships: []
      }
      approval_documents: {
        Row: {
          approval_id: string
          created_at: string
          doc_type: string
          external_url: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          approval_id: string
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          approval_id?: string
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_documents_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_progress"
            referencedColumns: ["approval_id"]
          },
          {
            foreignKeyName: "approval_documents_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_documents_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requirements: {
        Row: {
          approval_id: string
          created_at: string
          expires_on: string | null
          id: string
          notes: string | null
          owed_by: string | null
          position: number
          provided: boolean
          provided_on: string | null
          reference: string | null
          title: string
        }
        Insert: {
          approval_id: string
          created_at?: string
          expires_on?: string | null
          id?: string
          notes?: string | null
          owed_by?: string | null
          position?: number
          provided?: boolean
          provided_on?: string | null
          reference?: string | null
          title: string
        }
        Update: {
          approval_id?: string
          created_at?: string
          expires_on?: string | null
          id?: string
          notes?: string | null
          owed_by?: string | null
          position?: number
          provided?: boolean
          provided_on?: string | null
          reference?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_progress"
            referencedColumns: ["approval_id"]
          },
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          authority: string | null
          client_id: string | null
          cost: number | null
          created_at: string
          decided_on: string | null
          expires_on: string | null
          handled_by: string | null
          id: string
          issued_on: string | null
          kind: Database["public"]["Enums"]["approval_kind"]
          next_action: string | null
          notes: string | null
          office_id: string
          product_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_on: string | null
          title: string
          warehouse_id: string | null
        }
        Insert: {
          authority?: string | null
          client_id?: string | null
          cost?: number | null
          created_at?: string
          decided_on?: string | null
          expires_on?: string | null
          handled_by?: string | null
          id?: string
          issued_on?: string | null
          kind?: Database["public"]["Enums"]["approval_kind"]
          next_action?: string | null
          notes?: string | null
          office_id?: string
          product_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_on?: string | null
          title: string
          warehouse_id?: string | null
        }
        Update: {
          authority?: string | null
          client_id?: string | null
          cost?: number | null
          created_at?: string
          decided_on?: string | null
          expires_on?: string | null
          handled_by?: string | null
          id?: string
          issued_on?: string | null
          kind?: Database["public"]["Enums"]["approval_kind"]
          next_action?: string | null
          notes?: string | null
          office_id?: string
          product_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_on?: string | null
          title?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "approvals_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          bank: string | null
          created_at: string
          currency: string
          iban: string | null
          id: string
          is_active: boolean
          name: string
          office_id: string
          opening_balance: number
          opening_date: string
        }
        Insert: {
          account_number?: string | null
          bank?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          name: string
          office_id?: string
          opening_balance?: number
          opening_date?: string
        }
        Update: {
          account_number?: string | null
          bank?: string | null
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          name?: string
          office_id?: string
          opening_balance?: number
          opening_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_visited_on: string | null
          id: string
          kind: string
          location: string | null
          name: string
          notes: string | null
          office_id: string
          phone: string | null
          sector: string | null
          trn: string | null
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_visited_on?: string | null
          id?: string
          kind?: string
          location?: string | null
          name: string
          notes?: string | null
          office_id?: string
          phone?: string | null
          sector?: string | null
          trn?: string | null
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_visited_on?: string | null
          id?: string
          kind?: string
          location?: string | null
          name?: string
          notes?: string | null
          office_id?: string
          phone?: string | null
          sector?: string | null
          trn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_documents: {
        Row: {
          commitment_id: string
          created_at: string
          doc_type: string
          external_url: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          commitment_id: string
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          commitment_id?: string
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_documents_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitment_totals"
            referencedColumns: ["commitment_id"]
          },
          {
            foreignKeyName: "commitment_documents_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_lines: {
        Row: {
          amount: number | null
          commitment_id: string
          detail: string | null
          id: string
          is_estimate: boolean
          position: number
          quantity: number
          rate: number
          service: string
        }
        Insert: {
          amount?: number | null
          commitment_id: string
          detail?: string | null
          id?: string
          is_estimate?: boolean
          position?: number
          quantity?: number
          rate?: number
          service: string
        }
        Update: {
          amount?: number | null
          commitment_id?: string
          detail?: string | null
          id?: string
          is_estimate?: boolean
          position?: number
          quantity?: number
          rate?: number
          service?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_lines_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitment_totals"
            referencedColumns: ["commitment_id"]
          },
          {
            foreignKeyName: "commitment_lines_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          amount: number
          amount_aed: number | null
          category: string
          created_at: string
          currency: string
          eur_aed_rate: number | null
          expense_id: string | null
          id: string
          notes: string | null
          office_id: string
          project_id: string | null
          quoted_on: string | null
          reference: string | null
          status: Database["public"]["Enums"]["commitment_status"]
          supplier: string
          title: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          amount_aed?: number | null
          category?: string
          created_at?: string
          currency?: string
          eur_aed_rate?: number | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          project_id?: string | null
          quoted_on?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          supplier: string
          title: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          amount_aed?: number | null
          category?: string
          created_at?: string
          currency?: string
          eur_aed_rate?: number | null
          expense_id?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          project_id?: string | null
          quoted_on?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          supplier?: string
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence: {
        Row: {
          channel: string | null
          client_id: string | null
          direction: string | null
          follow_up_on: string | null
          id: string
          inquiry_id: string | null
          logged_by: string | null
          occurred_at: string
          office_id: string
          po_id: string | null
          quotation_id: string | null
          summary: string
          who: string | null
        }
        Insert: {
          channel?: string | null
          client_id?: string | null
          direction?: string | null
          follow_up_on?: string | null
          id?: string
          inquiry_id?: string | null
          logged_by?: string | null
          occurred_at?: string
          office_id?: string
          po_id?: string | null
          quotation_id?: string | null
          summary: string
          who?: string | null
        }
        Update: {
          channel?: string | null
          client_id?: string | null
          direction?: string | null
          follow_up_on?: string | null
          id?: string
          inquiry_id?: string | null
          logged_by?: string | null
          occurred_at?: string
          office_id?: string
          po_id?: string | null
          quotation_id?: string | null
          summary?: string
          who?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "correspondence_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "stale_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "correspondence_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          amount_aed: number | null
          bank_account_id: string | null
          category: string
          created_at: string
          currency: string
          description: string
          eur_aed_rate: number | null
          expense_date: string
          id: string
          kind: Database["public"]["Enums"]["expense_kind"]
          notes: string | null
          office_id: string
          paid_by: string | null
          paid_by_partner_id: string | null
          paid_on: string | null
          project_id: string | null
          reference: string | null
          shipment_id: string | null
          supplier: string | null
        }
        Insert: {
          amount: number
          amount_aed?: number | null
          bank_account_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description: string
          eur_aed_rate?: number | null
          expense_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          notes?: string | null
          office_id?: string
          paid_by?: string | null
          paid_by_partner_id?: string | null
          paid_on?: string | null
          project_id?: string | null
          reference?: string | null
          shipment_id?: string | null
          supplier?: string | null
        }
        Update: {
          amount?: number
          amount_aed?: number | null
          bank_account_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          eur_aed_rate?: number | null
          expense_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          notes?: string | null
          office_id?: string
          paid_by?: string | null
          paid_by_partner_id?: string | null
          paid_on?: string | null
          project_id?: string | null
          reference?: string | null
          shipment_id?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "cash_position"
            referencedColumns: ["bank_account_id"]
          },
          {
            foreignKeyName: "expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_partner_id_fkey"
            columns: ["paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partner_ledger"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "expenses_paid_by_partner_id_fkey"
            columns: ["paid_by_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_totals"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "expenses_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      field_visits: {
        Row: {
          assessment: string | null
          client_id: string
          contact_person: string | null
          created_at: string
          id: string
          next_action: string | null
          next_action_by: string | null
          office_id: string
          priority: string
          product_interest: string | null
          summary: string | null
          visit_date: string
          visited_by: string
        }
        Insert: {
          assessment?: string | null
          client_id: string
          contact_person?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          next_action_by?: string | null
          office_id?: string
          priority?: string
          product_interest?: string | null
          summary?: string | null
          visit_date: string
          visited_by?: string
        }
        Update: {
          assessment?: string | null
          client_id?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          next_action_by?: string | null
          office_id?: string
          priority?: string
          product_interest?: string | null
          summary?: string | null
          visit_date?: string
          visited_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "field_visits_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          client_id: string
          created_at: string
          estimated_value: number | null
          id: string
          last_contact_date: string | null
          location: string | null
          lost_reason: string | null
          next_action: string | null
          office_id: string
          owner_id: string | null
          product_scope: string | null
          project_name: string
          stage: Database["public"]["Enums"]["inquiry_stage"]
        }
        Insert: {
          client_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          location?: string | null
          lost_reason?: string | null
          next_action?: string | null
          office_id?: string
          owner_id?: string | null
          product_scope?: string | null
          project_name: string
          stage?: Database["public"]["Enums"]["inquiry_stage"]
        }
        Update: {
          client_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          location?: string | null
          lost_reason?: string | null
          next_action?: string | null
          office_id?: string
          owner_id?: string | null
          product_scope?: string | null
          project_name?: string
          stage?: Database["public"]["Enums"]["inquiry_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "inquiries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number | null
          rate: number | null
          unit: string | null
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number | null
          rate?: number | null
          unit?: string | null
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number | null
          rate?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          id: string
          invoice_id: string
          method: string | null
          note: string | null
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          id?: string
          invoice_id: string
          method?: string | null
          note?: string | null
          paid_on?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          note?: string | null
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "cash_position"
            referencedColumns: ["bank_account_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_date: string
          lpo_number: string | null
          milestone_id: string | null
          notes: string | null
          office_id: string
          payment_terms: string | null
          project_id: string | null
          quotation_id: string | null
          reference: string
          status: Database["public"]["Enums"]["invoice_status"]
          vat_applies: boolean
          vat_rate: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          lpo_number?: string | null
          milestone_id?: string | null
          notes?: string | null
          office_id?: string
          payment_terms?: string | null
          project_id?: string | null
          quotation_id?: string | null
          reference: string
          status?: Database["public"]["Enums"]["invoice_status"]
          vat_applies?: boolean
          vat_rate?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          lpo_number?: string | null
          milestone_id?: string | null
          notes?: string | null
          office_id?: string
          payment_terms?: string | null
          project_id?: string | null
          quotation_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          vat_applies?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "payment_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          bank_details: string | null
          code: string
          country: string
          currency: string
          default_lang: string
          email: string | null
          id: string
          is_active: boolean
          languages: string[]
          legal_name: string
          name: string
          phone: string | null
          position: number
          quote_digits: number
          quote_next: number
          quote_prefix: string
          quote_suffix: string
          tax_id: string | null
          tax_id_label: string
          terms: string | null
          vat_rate: number
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          code: string
          country: string
          currency: string
          default_lang?: string
          email?: string | null
          id?: string
          is_active?: boolean
          languages?: string[]
          legal_name: string
          name: string
          phone?: string | null
          position?: number
          quote_digits?: number
          quote_next?: number
          quote_prefix?: string
          quote_suffix?: string
          tax_id?: string | null
          tax_id_label?: string
          terms?: string | null
          vat_rate: number
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          code?: string
          country?: string
          currency?: string
          default_lang?: string
          email?: string | null
          id?: string
          is_active?: boolean
          languages?: string[]
          legal_name?: string
          name?: string
          phone?: string | null
          position?: number
          quote_digits?: number
          quote_next?: number
          quote_prefix?: string
          quote_suffix?: string
          tax_id?: string | null
          tax_id_label?: string
          terms?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          office_id: string
          ownership_pct: number
          share_capital: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          office_id?: string
          ownership_pct?: number
          share_capital?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          office_id?: string
          ownership_pct?: number
          share_capital?: number
        }
        Relationships: [
          {
            foreignKeyName: "partners_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_milestones: {
        Row: {
          amount: number
          due_date: string | null
          id: string
          invoice_ref: string | null
          invoiced_on: string | null
          name: string
          notes: string | null
          paid_on: string | null
          percentage: number | null
          position: number
          project_id: string
        }
        Insert: {
          amount?: number
          due_date?: string | null
          id?: string
          invoice_ref?: string | null
          invoiced_on?: string | null
          name: string
          notes?: string | null
          paid_on?: string | null
          percentage?: number | null
          position?: number
          project_id: string
        }
        Update: {
          amount?: number
          due_date?: string | null
          id?: string
          invoice_ref?: string | null
          invoiced_on?: string | null
          name?: string
          notes?: string | null
          paid_on?: string | null
          percentage?: number | null
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["pay_kind"]
          notes: string | null
          office_id: string
          paid_on: string | null
          partner_id: string | null
          period: string | null
          person: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["pay_kind"]
          notes?: string | null
          office_id?: string
          paid_on?: string | null
          partner_id?: string | null
          period?: string | null
          person: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["pay_kind"]
          notes?: string | null
          office_id?: string
          paid_on?: string | null
          partner_id?: string | null
          period?: string | null
          person?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "cash_position"
            referencedColumns: ["bank_account_id"]
          },
          {
            foreignKeyName: "payroll_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_ledger"
            referencedColumns: ["partner_id"]
          },
          {
            foreignKeyName: "payroll_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      po_documents: {
        Row: {
          created_at: string
          doc_type: string
          external_url: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          po_id: string
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          po_id: string
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          po_id?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_documents_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_totals"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "po_documents_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias: string
          id: string
          product_id: string
        }
        Insert: {
          alias: string
          id?: string
          product_id: string
        }
        Update: {
          alias?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_documents: {
        Row: {
          created_at: string
          doc_type: string
          expires_on: string | null
          external_url: string | null
          file_size: number | null
          id: string
          issued_on: string | null
          mime_type: string | null
          notes: string | null
          product_id: string
          storage_path: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          notes?: string | null
          product_id: string
          storage_path?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_on?: string | null
          external_url?: string | null
          file_size?: number | null
          id?: string
          issued_on?: string | null
          mime_type?: string | null
          notes?: string | null
          product_id?: string
          storage_path?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packs: {
        Row: {
          eur_per_unit: number | null
          eur_total: number | null
          id: string
          is_poa: boolean
          label: string
          note: string | null
          pack_qty: number | null
          product_id: string
          unit: string
        }
        Insert: {
          eur_per_unit?: number | null
          eur_total?: number | null
          id?: string
          is_poa?: boolean
          label: string
          note?: string | null
          pack_qty?: number | null
          product_id: string
          unit?: string
        }
        Update: {
          eur_per_unit?: number | null
          eur_total?: number | null
          id?: string
          is_poa?: boolean
          label?: string
          note?: string | null
          pack_qty?: number | null
          product_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_transport: {
        Row: {
          component: string | null
          created_at: string
          id: string
          marine_pollutant: boolean
          notes: string | null
          packing_group: string | null
          product_id: string
          proper_shipping_name: string | null
          source_document: string | null
          un_class: string | null
          un_number: string | null
          verified_on: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          id?: string
          marine_pollutant?: boolean
          notes?: string | null
          packing_group?: string | null
          product_id: string
          proper_shipping_name?: string | null
          source_document?: string | null
          un_class?: string | null
          un_number?: string | null
          verified_on?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          id?: string
          marine_pollutant?: boolean
          notes?: string | null
          packing_group?: string | null
          product_id?: string
          proper_shipping_name?: string | null
          source_document?: string | null
          un_class?: string | null
          un_number?: string | null
          verified_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_transport_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_transport_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_transport_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_transport_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_wordings: {
        Row: {
          cost_unit: string | null
          created_at: string
          currency: string
          id: string
          last_cost: number | null
          last_used_at: string
          product_id: string
          times_used: number
          wording: string
        }
        Insert: {
          cost_unit?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_cost?: number | null
          last_used_at?: string
          product_id: string
          times_used?: number
          wording: string
        }
        Update: {
          cost_unit?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_cost?: number | null
          last_used_at?: string
          product_id?: string
          times_used?: number
          wording?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_wordings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_wordings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_wordings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_wordings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          application: string | null
          category: string
          colours: string | null
          consumption_text: string | null
          coverage_max: number | null
          coverage_min: number | null
          coverage_unit: string | null
          created_at: string
          dcd_approved: boolean
          dcd_expiry: string | null
          dcd_ref: string | null
          description: string | null
          hs_code: string | null
          id: string
          is_active: boolean
          is_dangerous: boolean
          name: string
          net_kg_per_pack: number | null
          packing_group: string | null
          subcategory: string | null
          un_number: string | null
        }
        Insert: {
          application?: string | null
          category: string
          colours?: string | null
          consumption_text?: string | null
          coverage_max?: number | null
          coverage_min?: number | null
          coverage_unit?: string | null
          created_at?: string
          dcd_approved?: boolean
          dcd_expiry?: string | null
          dcd_ref?: string | null
          description?: string | null
          hs_code?: string | null
          id?: string
          is_active?: boolean
          is_dangerous?: boolean
          name: string
          net_kg_per_pack?: number | null
          packing_group?: string | null
          subcategory?: string | null
          un_number?: string | null
        }
        Update: {
          application?: string | null
          category?: string
          colours?: string | null
          consumption_text?: string | null
          coverage_max?: number | null
          coverage_min?: number | null
          coverage_unit?: string | null
          created_at?: string
          dcd_approved?: boolean
          dcd_expiry?: string | null
          dcd_ref?: string | null
          description?: string | null
          hs_code?: string | null
          id?: string
          is_active?: boolean
          is_dangerous?: boolean
          name?: string
          net_kg_per_pack?: number | null
          packing_group?: string | null
          subcategory?: string | null
          un_number?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          language: string
          office_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          language?: string
          office_id?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          language?: string
          office_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      project_materials: {
        Row: {
          description: string
          id: string
          notes: string | null
          office_id: string
          position: number
          product_id: string | null
          project_id: string
          qty_delivered: number
          qty_required: number
          unit: string | null
        }
        Insert: {
          description: string
          id?: string
          notes?: string | null
          office_id?: string
          position?: number
          product_id?: string | null
          project_id: string
          qty_delivered?: number
          qty_required?: number
          unit?: string | null
        }
        Update: {
          description?: string
          id?: string
          notes?: string | null
          office_id?: string
          position?: number
          product_id?: string | null
          project_id?: string
          qty_delivered?: number
          qty_required?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_materials_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "project_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "project_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          created_at: string
          duty_cost: number | null
          expected_completion: string | null
          freight_cost: number | null
          id: string
          inquiry_id: string | null
          lpo_number: string | null
          material_cost: number | null
          name: string
          notes: string | null
          office_id: string
          other_cost: number | null
          progress_pct: number
          quotation_id: string | null
          site: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          value: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duty_cost?: number | null
          expected_completion?: string | null
          freight_cost?: number | null
          id?: string
          inquiry_id?: string | null
          lpo_number?: string | null
          material_cost?: number | null
          name: string
          notes?: string | null
          office_id?: string
          other_cost?: number | null
          progress_pct?: number
          quotation_id?: string | null
          site?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          value?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duty_cost?: number | null
          expected_completion?: string | null
          freight_cost?: number | null
          id?: string
          inquiry_id?: string | null
          lpo_number?: string | null
          material_cost?: number | null
          name?: string
          notes?: string | null
          office_id?: string
          other_cost?: number | null
          progress_pct?: number
          quotation_id?: string | null
          site?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "stale_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "projects_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          description: string
          discount_pct: number
          hs_code: string | null
          id: string
          line_total: number | null
          list_price: number | null
          pack_label: string | null
          packs: number | null
          po_id: string
          position: number
          product_id: string | null
          qty_ordered: number
          qty_received: number
          unit: string
          unit_price: number
          weight_kg: number | null
        }
        Insert: {
          description: string
          discount_pct?: number
          hs_code?: string | null
          id?: string
          line_total?: number | null
          list_price?: number | null
          pack_label?: string | null
          packs?: number | null
          po_id: string
          position?: number
          product_id?: string | null
          qty_ordered?: number
          qty_received?: number
          unit?: string
          unit_price?: number
          weight_kg?: number | null
        }
        Update: {
          description?: string
          discount_pct?: number
          hs_code?: string | null
          id?: string
          line_total?: number | null
          list_price?: number | null
          pack_label?: string | null
          packs?: number | null
          po_id?: string
          position?: number
          product_id?: string | null
          qty_ordered?: number
          qty_received?: number
          unit?: string
          unit_price?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_totals"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          currency: string
          eur_aed_rate: number | null
          expected_on: string | null
          id: string
          notes: string | null
          office_id: string
          ordered_on: string | null
          project_id: string | null
          quotation_id: string | null
          reference: string
          shipment_id: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier: string
          supplier_ref: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          eur_aed_rate?: number | null
          expected_on?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          ordered_on?: string | null
          project_id?: string | null
          quotation_id?: string | null
          reference: string
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier?: string
          supplier_ref?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          eur_aed_rate?: number | null
          expected_on?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          ordered_on?: string | null
          project_id?: string | null
          quotation_id?: string | null
          reference?: string
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier?: string
          supplier_ref?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_totals"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "purchase_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_lines: {
        Row: {
          cost_rate: number | null
          description: string
          id: string
          is_bold: boolean
          is_costing: boolean
          is_provisional: boolean
          is_spec_note: boolean
          position: number
          product_id: string | null
          quantity: number | null
          section_id: string
          sell_rate: number | null
          unit: string | null
        }
        Insert: {
          cost_rate?: number | null
          description: string
          id?: string
          is_bold?: boolean
          is_costing?: boolean
          is_provisional?: boolean
          is_spec_note?: boolean
          position: number
          product_id?: string | null
          quantity?: number | null
          section_id: string
          sell_rate?: number | null
          unit?: string | null
        }
        Update: {
          cost_rate?: number | null
          description?: string
          id?: string
          is_bold?: boolean
          is_costing?: boolean
          is_provisional?: boolean
          is_spec_note?: boolean
          position?: number
          product_id?: string | null
          quantity?: number | null
          section_id?: string
          sell_rate?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quotation_lines_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quotation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_sections: {
        Row: {
          id: string
          position: number
          quotation_id: string
          title: string
        }
        Insert: {
          id?: string
          position: number
          quotation_id: string
          title: string
        }
        Update: {
          id?: string
          position?: number
          quotation_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_sections_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "quotation_sections_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number | null
          discount_label: string | null
          eur_aed_rate: number
          id: string
          inquiry_id: string | null
          language: string
          location: string | null
          meeting_notes: string | null
          office_id: string
          price_mode: string | null
          price_target: number | null
          project_name: string | null
          quote_date: string
          reference: string
          remarks: string | null
          revision: string
          status: Database["public"]["Enums"]["quotation_status"]
          valid_until: string | null
          vat_applies: boolean
          vat_rate: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number | null
          discount_label?: string | null
          eur_aed_rate: number
          id?: string
          inquiry_id?: string | null
          language?: string
          location?: string | null
          meeting_notes?: string | null
          office_id?: string
          price_mode?: string | null
          price_target?: number | null
          project_name?: string | null
          quote_date?: string
          reference: string
          remarks?: string | null
          revision?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          valid_until?: string | null
          vat_applies?: boolean
          vat_rate?: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number | null
          discount_label?: string | null
          eur_aed_rate?: number
          id?: string
          inquiry_id?: string | null
          language?: string
          location?: string | null
          meeting_notes?: string | null
          office_id?: string
          price_mode?: string | null
          price_target?: number | null
          project_name?: string | null
          quote_date?: string
          reference?: string
          remarks?: string | null
          revision?: string
          status?: Database["public"]["Enums"]["quotation_status"]
          valid_until?: string | null
          vat_applies?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "stale_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_documents: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          extracted: string | null
          file_name: string
          file_path: string | null
          id: string
          item_count: number | null
          mime: string | null
          note: string | null
          office_id: string | null
          quotation_id: string | null
          size_bytes: number | null
          title: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          extracted?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          item_count?: number | null
          mime?: string | null
          note?: string | null
          office_id?: string | null
          quotation_id?: string | null
          size_bytes?: number | null
          title?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          extracted?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          item_count?: number | null
          mime?: string | null
          note?: string | null
          office_id?: string | null
          quotation_id?: string | null
          size_bytes?: number | null
          title?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scope_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "scope_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_documents_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "scope_documents_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          label: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_documents: {
        Row: {
          created_at: string
          doc_type: string
          external_url: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          shipment_id: string
          storage_path: string | null
          title: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          shipment_id: string
          storage_path?: string | null
          title: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          external_url?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          shipment_id?: string
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_totals"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_lines: {
        Row: {
          description: string
          gross_weight_kg: number | null
          hs_code: string | null
          id: string
          net_weight_kg: number | null
          packages: number | null
          packing_group: string | null
          position: number
          product_id: string | null
          quantity: number | null
          shipment_id: string
          un_number: string | null
          unit: string | null
          value_eur: number | null
        }
        Insert: {
          description: string
          gross_weight_kg?: number | null
          hs_code?: string | null
          id?: string
          net_weight_kg?: number | null
          packages?: number | null
          packing_group?: string | null
          position?: number
          product_id?: string | null
          quantity?: number | null
          shipment_id: string
          un_number?: string | null
          unit?: string | null
          value_eur?: number | null
        }
        Update: {
          description?: string
          gross_weight_kg?: number | null
          hs_code?: string | null
          id?: string
          net_weight_kg?: number | null
          packages?: number | null
          packing_group?: string | null
          position?: number
          product_id?: string | null
          quantity?: number | null
          shipment_id?: string
          un_number?: string | null
          unit?: string | null
          value_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "shipment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "shipment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_totals"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          clearance_cost: number | null
          client_id: string | null
          container_no: string | null
          created_at: string
          destination: string | null
          duty_cost: number | null
          eta: string | null
          etd: string | null
          eur_aed_rate: number | null
          forwarder: string | null
          freight_cost: number | null
          goods_value_eur: number | null
          gross_weight_kg: number | null
          id: string
          incoterm: string | null
          insurance_cost: number | null
          mode: Database["public"]["Enums"]["shipment_mode"] | null
          net_weight_kg: number | null
          notes: string | null
          office_id: string
          origin: string | null
          other_cost: number | null
          packages: number | null
          project_id: string | null
          quotation_id: string | null
          reference: string
          status: Database["public"]["Enums"]["shipment_status"]
          supplier: string | null
          transport_doc: string | null
          un_numbers: string | null
          volume_cbm: number | null
        }
        Insert: {
          clearance_cost?: number | null
          client_id?: string | null
          container_no?: string | null
          created_at?: string
          destination?: string | null
          duty_cost?: number | null
          eta?: string | null
          etd?: string | null
          eur_aed_rate?: number | null
          forwarder?: string | null
          freight_cost?: number | null
          goods_value_eur?: number | null
          gross_weight_kg?: number | null
          id?: string
          incoterm?: string | null
          insurance_cost?: number | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          net_weight_kg?: number | null
          notes?: string | null
          office_id?: string
          origin?: string | null
          other_cost?: number | null
          packages?: number | null
          project_id?: string | null
          quotation_id?: string | null
          reference: string
          status?: Database["public"]["Enums"]["shipment_status"]
          supplier?: string | null
          transport_doc?: string | null
          un_numbers?: string | null
          volume_cbm?: number | null
        }
        Update: {
          clearance_cost?: number | null
          client_id?: string | null
          container_no?: string | null
          created_at?: string
          destination?: string | null
          duty_cost?: number | null
          eta?: string | null
          etd?: string | null
          eur_aed_rate?: number | null
          forwarder?: string | null
          freight_cost?: number | null
          goods_value_eur?: number | null
          gross_weight_kg?: number | null
          id?: string
          incoterm?: string | null
          insurance_cost?: number | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          net_weight_kg?: number | null
          notes?: string | null
          office_id?: string
          origin?: string | null
          other_cost?: number | null
          packages?: number | null
          project_id?: string | null
          quotation_id?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          supplier?: string | null
          transport_doc?: string | null
          un_numbers?: string | null
          volume_cbm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "shipments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "shipments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "shipments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "shipments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_equivalents: {
        Row: {
          confidence: string
          created_at: string
          id: string
          note: string | null
          product_id: string | null
          role: string | null
          term: string
        }
        Insert: {
          confidence?: string
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          role?: string | null
          term: string
        }
        Update: {
          confidence?: string
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          role?: string | null
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_equivalents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "spec_equivalents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "spec_equivalents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_equivalents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock: {
        Row: {
          id: string
          office_id: string
          product_id: string
          qty_on_hand: number
          reorder_level: number
          unit: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          office_id?: string
          product_id: string
          qty_on_hand?: number
          reorder_level?: number
          unit?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          office_id?: string
          product_id?: string
          qty_on_hand?: number
          reorder_level?: number
          unit?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string
          id: string
          moved_on: string
          note: string | null
          office_id: string
          product_id: string
          project_id: string | null
          quantity: number
          reference: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          moved_on?: string
          note?: string | null
          office_id?: string
          product_id: string
          project_id?: string | null
          quantity: number
          reference?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          moved_on?: string
          note?: string | null
          office_id?: string
          product_id?: string
          project_id?: string | null
          quantity?: number
          reference?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          dcd_certificate_ref: string | null
          dcd_certified: boolean
          dcd_expiry: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          notes: string | null
          office_id: string
          storage_notes: string | null
        }
        Insert: {
          dcd_certificate_ref?: string | null
          dcd_certified?: boolean
          dcd_expiry?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          notes?: string | null
          office_id?: string
          storage_notes?: string | null
        }
        Update: {
          dcd_certificate_ref?: string | null
          dcd_certified?: boolean
          dcd_expiry?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          notes?: string | null
          office_id?: string
          storage_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      approval_progress: {
        Row: {
          approval_id: string | null
          last_sent_on: string | null
          next_needed: string | null
          next_owed_by: string | null
          office_id: string | null
          outstanding: number | null
          provided: number | null
          required: number | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_watch: {
        Row: {
          authority: string | null
          client_id: string | null
          client_name: string | null
          cost: number | null
          created_at: string | null
          days_since_submitted: number | null
          days_to_expiry: number | null
          decided_on: string | null
          expires_on: string | null
          expiring_soon: boolean | null
          handled_by: string | null
          has_expired: boolean | null
          id: string | null
          issued_on: string | null
          kind: Database["public"]["Enums"]["approval_kind"] | null
          last_sent_on: string | null
          needs_attention: boolean | null
          next_action: string | null
          next_needed: string | null
          next_owed_by: string | null
          notes: string | null
          office_id: string | null
          outstanding: number | null
          product_id: string | null
          product_name: string | null
          provided: number | null
          reference: string | null
          required: number | null
          status: Database["public"]["Enums"]["approval_status"] | null
          submitted_on: string | null
          title: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "approvals_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "approvals_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_position: {
        Row: {
          balance: number | null
          bank: string | null
          bank_account_id: string | null
          currency: string | null
          name: string | null
          office_id: string | null
          opening_balance: number | null
          opening_date: string | null
          received: number | null
          spent: number | null
          wages_and_drawings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_pricing: {
        Row: {
          category: string | null
          consumption_text: string | null
          cost_aed: number | null
          cost_eur: number | null
          cost_eur_per_unit: number | null
          fx: number | null
          install_rate: number | null
          kg_per_m2: number | null
          margin: number | null
          material_cost_aed_m2: number | null
          name: string | null
          pack: string | null
          pack_id: string | null
          pack_qty: number | null
          product_id: string | null
          rrp_eur: number | null
          rrp_eur_per_unit: number | null
          sell_aed_m2: number | null
          subcategory: string | null
          supply_discount: number | null
          total_cost_aed_m2: number | null
          unit: string | null
        }
        Relationships: []
      }
      commitment_totals: {
        Row: {
          amount_aed: number | null
          category: string | null
          commitment_id: string | null
          currency: string | null
          difference: number | null
          documents: number | null
          estimated_lines: number | null
          header_amount: number | null
          line_count: number | null
          lines_agree: boolean | null
          lines_total: number | null
          office_id: string | null
          quoted_on: string | null
          reference: string | null
          status: Database["public"]["Enums"]["commitment_status"] | null
          supplier: string | null
          title: string | null
          valid_until: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments_outstanding: {
        Row: {
          accepted: number | null
          amount_aed: number | null
          category: string | null
          commitments: number | null
          office_id: string | null
          oldest_quote: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      document_watch: {
        Row: {
          days_left: number | null
          doc_type: string | null
          expires_on: string | null
          id: string | null
          product_id: string | null
          product_name: string | null
          state: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      invoice_totals: {
        Row: {
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          office_id: string | null
          outstanding: number | null
          received: number | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          total: number | null
          vat: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      open_order_lines: {
        Row: {
          description: string | null
          expected_on: string | null
          line_id: string | null
          office_id: string | null
          po_id: string | null
          product_id: string | null
          product_name: string | null
          project_id: string | null
          qty_ordered: number | null
          qty_outstanding: number | null
          qty_received: number | null
          quotation_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          supplier: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_totals"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_ledger: {
        Row: {
          balance: number | null
          contributed: number | null
          drawings: number | null
          fair_share: number | null
          funded: number | null
          name: string | null
          office_id: string | null
          ownership_pct: number | null
          partner_id: string | null
          share_capital: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_transport_summary: {
        Row: {
          classified_components: number | null
          hs_code: string | null
          is_dangerous: boolean | null
          marine_pollutant: boolean | null
          name: string | null
          product_id: string | null
          sds_on_file: number | null
          un_classes: string | null
          un_numbers: string | null
          worst_packing_group: string | null
        }
        Relationships: []
      }
      project_actuals: {
        Row: {
          actual_cost: number | null
          actual_gross: number | null
          actual_margin_pct: number | null
          contract_value: number | null
          costs_booked: number | null
          has_actuals: boolean | null
          labour_cost: number | null
          material_issued: number | null
          name: string | null
          office_id: string | null
          project_id: string | null
          quoted_cost: number | null
          quoted_margin_pct: number | null
          shipment_cost: number | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      project_totals: {
        Row: {
          gross_profit: number | null
          invoiced: number | null
          milestone_total: number | null
          office_id: string | null
          outstanding: number | null
          paid: number | null
          project_id: string | null
          total_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_totals: {
        Row: {
          currency: string | null
          document_count: number | null
          expected_on: string | null
          fully_received: boolean | null
          line_count: number | null
          office_id: string | null
          ordered_on: string | null
          po_id: string | null
          project_id: string | null
          qty_ordered: number | null
          qty_received: number | null
          quotation_id: string | null
          received_pct: number | null
          reference: string | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["po_status"] | null
          supplier: string | null
          value: number | null
          value_aed: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_actuals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_totals"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "purchase_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_totals"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "purchase_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_totals: {
        Row: {
          cost_total: number | null
          gross_profit: number | null
          office_id: string | null
          quotation_id: string | null
          subtotal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_watch: {
        Row: {
          approval_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          approval_title: string | null
          at_risk: boolean | null
          days_left: number | null
          expires_on: string | null
          expiring_soon: boolean | null
          has_expired: boolean | null
          id: string | null
          office_id: string | null
          owed_by: string | null
          position: number | null
          provided: boolean | null
          provided_on: string | null
          reference: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_progress"
            referencedColumns: ["approval_id"]
          },
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approval_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requirements_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_totals: {
        Row: {
          document_count: number | null
          goods_value_aed: number | null
          has_dangerous_goods: boolean | null
          landed_cost: number | null
          line_count: number | null
          office_id: string | null
          shipment_id: string | null
          shipping_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      stale_inquiries: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string | null
          days_quiet: number | null
          estimated_value: number | null
          id: string | null
          last_contact_date: string | null
          location: string | null
          lost_reason: string | null
          next_action: string | null
          office_id: string | null
          owner_id: string | null
          product_scope: string | null
          project_name: string | null
          stage: Database["public"]["Enums"]["inquiry_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "inquiries_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_detail: {
        Row: {
          block_reason: string | null
          blocked: boolean | null
          category: string | null
          dcd_approved: boolean | null
          dcd_certificate_ref: string | null
          dcd_certified: boolean | null
          dcd_ref: string | null
          needs_product_approval: boolean | null
          needs_warehouse_certificate: boolean | null
          office_id: string | null
          product_approval_expired: boolean | null
          product_dcd_expiry: string | null
          product_id: string | null
          product_name: string | null
          qty_on_hand: number | null
          reorder_level: number | null
          stock_id: string | null
          unit: string | null
          warehouse_cert_expiry: string | null
          warehouse_certificate_expired: boolean | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_pricing"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_transport_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_position: {
        Row: {
          available: number | null
          block_reason: string | null
          blocked: number | null
          category: string | null
          committed: number | null
          free_to_move: number | null
          movable: number | null
          office_id: string | null
          on_hand: number | null
          product_id: string | null
          product_name: string | null
          reorder_level: number | null
          unit: string | null
        }
        Relationships: []
      }
      visit_funnel: {
        Row: {
          accepted_quotations: number | null
          client_id: string | null
          contact_person: string | null
          days_since_visit: number | null
          email: string | null
          first_visit: string | null
          flagged_high: boolean | null
          follow_up_overdue: boolean | null
          going_cold: boolean | null
          job_value: number | null
          jobs: number | null
          kind: string | null
          last_visit: string | null
          location: string | null
          name: string | null
          next_due: string | null
          office_id: string | null
          open_inquiries: number | null
          phone: string | null
          quotations: number | null
          stage: string | null
          visits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_log: {
        Row: {
          assessment: string | null
          client_id: string | null
          client_name: string | null
          contact_person: string | null
          id: string | null
          kind: string | null
          next_action: string | null
          next_action_by: string | null
          office_id: string | null
          priority: string | null
          product_interest: string | null
          summary: string | null
          visit_date: string | null
          visited_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "visit_funnel"
            referencedColumns: ["client_id"]
          },
        ]
      }
      visit_scoreboard: {
        Row: {
          companies_seen: number | null
          going_cold: number | null
          high_and_untouched: number | null
          latest: string | null
          office_id: string | null
          overdue: number | null
          progressed: number | null
          quote_rate_pct: number | null
          quoted: number | null
          since: string | null
          visits_made: number | null
          won: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_owner: { Args: never; Returns: boolean }
      next_invoice_reference: { Args: never; Returns: string }
      next_po_reference: { Args: never; Returns: string }
      next_quotation_reference:
        | { Args: never; Returns: string }
        | { Args: { p_office?: string }; Returns: string }
      receive_po_line: {
        Args: {
          p_line_id: string
          p_moved_on?: string
          p_note?: string
          p_qty: number
          p_warehouse_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      approval_kind:
        | "product_dcd"
        | "warehouse_storage"
        | "trade_licence"
        | "vat"
        | "customs"
        | "tenancy"
        | "vendor_registration"
        | "product_certification"
        | "insurance"
        | "other"
      approval_status:
        | "not_started"
        | "preparing"
        | "submitted"
        | "in_review"
        | "approved"
        | "rejected"
        | "expired"
      commitment_status:
        | "quoted"
        | "accepted"
        | "settled"
        | "declined"
        | "superseded"
      expense_kind: "expense" | "contribution"
      inquiry_stage: "inquiry" | "quoted" | "negotiation" | "won" | "lost"
      invoice_status: "draft" | "sent" | "part_paid" | "paid" | "cancelled"
      pay_kind: "salary" | "drawing"
      po_status:
        | "draft"
        | "sent"
        | "confirmed"
        | "part"
        | "received"
        | "cancelled"
      project_status:
        | "upcoming"
        | "in_progress"
        | "on_hold"
        | "complete"
        | "cancelled"
      quotation_status: "draft" | "sent" | "approved" | "rejected" | "expired"
      shipment_mode: "air" | "sea" | "road" | "courier"
      shipment_status:
        | "planning"
        | "quoted"
        | "booked"
        | "in_transit"
        | "customs"
        | "delivered"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
    Enums: {
      approval_kind: [
        "product_dcd",
        "warehouse_storage",
        "trade_licence",
        "vat",
        "customs",
        "tenancy",
        "vendor_registration",
        "product_certification",
        "insurance",
        "other",
      ],
      approval_status: [
        "not_started",
        "preparing",
        "submitted",
        "in_review",
        "approved",
        "rejected",
        "expired",
      ],
      commitment_status: [
        "quoted",
        "accepted",
        "settled",
        "declined",
        "superseded",
      ],
      expense_kind: ["expense", "contribution"],
      inquiry_stage: ["inquiry", "quoted", "negotiation", "won", "lost"],
      invoice_status: ["draft", "sent", "part_paid", "paid", "cancelled"],
      pay_kind: ["salary", "drawing"],
      po_status: [
        "draft",
        "sent",
        "confirmed",
        "part",
        "received",
        "cancelled",
      ],
      project_status: [
        "upcoming",
        "in_progress",
        "on_hold",
        "complete",
        "cancelled",
      ],
      quotation_status: ["draft", "sent", "approved", "rejected", "expired"],
      shipment_mode: ["air", "sea", "road", "courier"],
      shipment_status: [
        "planning",
        "quoted",
        "booked",
        "in_transit",
        "customs",
        "delivered",
        "cancelled",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
