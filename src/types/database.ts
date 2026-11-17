export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'landlord' | 'renter'
          full_name: string
          email: string | null
          phone: string | null
          avatar_url: string | null
          status: 'pending' | 'approved' | 'rejected'
          landlord_code: string | null
          linked_landlord_id: string | null
          rejection_reason: string | null
          home_address: string | null
          home_street: string | null
          home_barangay: string | null
          home_city: string | null
          home_province: string | null
          occupation_type: string | null
          school: string | null
          program: string | null
          year_level: string | null
          age: string | null
          workplace: string | null
          parent_name: string | null
          parent_phone: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      buildings: {
        Row: {
          id: string
          landlord_id: string
          name: string
          address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['buildings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['buildings']['Insert']>
      }
      rooms: {
        Row: {
          id: string
          building_id: string
          room_number: string
          rent_amount: number
          max_occupants: number
          floor_number: number | null
          status: 'occupied' | 'vacant' | 'maintenance'
          description: string | null
          photos: string[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['rooms']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
      }
      tenants: {
        Row: {
          id: string
          user_id: string | null
          room_id: string | null
          name: string
          phone: string | null
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          move_in_date: string | null
          move_out_date: string | null
          deposit_amount: number
          photo_url: string | null
          qr_code: string | null
          occupants: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      payments: {
        Row: {
          id: string
          tenant_id: string
          room_id: string | null
          amount: number
          month_year: string
          payment_date: string
          payment_method: string | null
          status: 'pending' | 'verified' | 'confirmed' | 'rejected'
          receipt_url: string | null
          verified_by: string | null
          rejection_reason: string | null
          notes: string | null
          reference_number: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      electricity_bills: {
        Row: {
          id: string
          building_id: string
          total_amount: number
          month_year: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['electricity_bills']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['electricity_bills']['Insert']>
      }
      electricity_shares: {
        Row: {
          id: string
          bill_id: string
          tenant_id: string
          share_amount: number
          occupants: number | null
          is_adjusted: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['electricity_shares']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['electricity_shares']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          building_id: string
          category: 'water' | 'maintenance' | 'repair' | 'supplies' | 'other'
          amount: number
          expense_date: string
          notes: string | null
          photo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      maintenance_requests: {
        Row: {
          id: string
          tenant_id: string
          room_id: string | null
          category: 'plumbing' | 'electrical' | 'structural' | 'other'
          description: string
          urgency: 'low' | 'medium' | 'high'
          photos: string[] | null
          repair_photos: string[] | null
          reopen_count: number
          status: 'pending' | 'in_progress' | 'resolved'
          landlord_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['maintenance_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['maintenance_requests']['Insert']>
      }
      announcements: {
        Row: {
          id: string
          landlord_id: string
          title: string
          message: string
          target_buildings: string[] | null
          is_pinned: boolean
          priority: 'urgent' | 'important' | 'reminder' | 'regular' | null
          photo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>
      }
      move_records: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          move_type: 'in' | 'out'
          move_date: string
          condition_notes: string | null
          photos: string[] | null
          deposit_refund: number | null
          deductions: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['move_records']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['move_records']['Insert']>
      }
      room_reviews: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          overall_rating: number | null
          cleanliness: number | null
          location: number | null
          value_for_money: number | null
          landlord_responsiveness: number | null
          comment: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['room_reviews']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['room_reviews']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          notification_type: string | null
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      visitor_requests: {
        Row: {
          id: string
          tenant_id: string
          room_id: string | null
          visitor_count: number | null
          relationship: string | null
          visit_date: string
          visit_time: string | null
          visit_end_time: string | null
          is_overnight: boolean
          purpose: string | null
          status: 'pending' | 'approved' | 'rejected'
          rejection_reason: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['visitor_requests']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['visitor_requests']['Insert']>
      }
      announcement_reads: {
        Row: {
          id: string
          announcement_id: string
          user_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['announcement_reads']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['announcement_reads']['Insert']>
      }
      maintenance_logs: {
        Row: {
          id: string
          request_id: string
          event_type: string
          message: string
          actor: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['maintenance_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['maintenance_logs']['Insert']>
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Building = Database['public']['Tables']['buildings']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type ElectricityBill = Database['public']['Tables']['electricity_bills']['Row']
export type ElectricityShare = Database['public']['Tables']['electricity_shares']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
export type MoveRecord = Database['public']['Tables']['move_records']['Row']
export type RoomReview = Database['public']['Tables']['room_reviews']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type VisitorRequest = Database['public']['Tables']['visitor_requests']['Row']
export type AnnouncementRead = Database['public']['Tables']['announcement_reads']['Row']
export type MaintenanceLog = Database['public']['Tables']['maintenance_logs']['Row']
