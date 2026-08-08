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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      business_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          opens_at: string | null
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_blocked: boolean
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string
          delivery_fee: number
          dispatch_attempts: number
          distance_km: number | null
          driver_id: string | null
          id: string
          offer_expires_at: string | null
          offer_started_at: string | null
          offered_at: string | null
          offered_driver_id: string | null
          order_id: string
          picked_up_at: string | null
          push_notified_at: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address: string
          delivery_fee?: number
          dispatch_attempts?: number
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          offer_expires_at?: string | null
          offer_started_at?: string | null
          offered_at?: string | null
          offered_driver_id?: string | null
          order_id: string
          picked_up_at?: string | null
          push_notified_at?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_fee?: number
          dispatch_attempts?: number
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          offer_expires_at?: string | null
          offer_started_at?: string | null
          offered_at?: string | null
          offered_driver_id?: string | null
          order_id?: string
          picked_up_at?: string | null
          push_notified_at?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_offered_driver_id_fkey"
            columns: ["offered_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_rejections: {
        Row: {
          created_at: string
          delivery_id: string
          driver_id: string
          id: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          driver_id: string
          id?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          driver_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_rejections_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_rejections_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          restaurant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          restaurant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          restaurant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          current_latitude: number | null
          current_longitude: number | null
          id: string
          is_active: boolean
          location_updated_at: string | null
          phone: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_active?: boolean
          location_updated_at?: string | null
          phone?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          current_latitude?: number | null
          current_longitude?: number | null
          id?: string
          is_active?: boolean
          location_updated_at?: string | null
          phone?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          selected_modifiers: Json
          unit_price: number
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          selected_modifiers?: Json
          unit_price: number
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_modifiers?: Json
          unit_price?: number
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_distance_km: number | null
          delivery_fee: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          estimated_minutes: number | null
          id: string
          notes: string | null
          public_token: string
          ready_at: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_distance_km?: number | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          public_token?: string
          ready_at?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_distance_km?: number | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          estimated_minutes?: number | null
          id?: string
          notes?: string | null
          public_token?: string
          ready_at?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_available: boolean
          name: string
          preparation_minutes: number | null
          price: number
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name: string
          preparation_minutes?: number | null
          price: number
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_available?: boolean
          name?: string
          preparation_minutes?: number | null
          price?: number
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_selections: number
          min_selections: number
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          modifier_group_id: string
          max_quantity: number
          name: string
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          modifier_group_id: string
          max_quantity?: number
          name: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          modifier_group_id?: string
          max_quantity?: number
          name?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_options_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_groups: {
        Row: { modifier_group_id: string; product_id: string; sort_order: number }
        Insert: { modifier_group_id: string; product_id: string; sort_order?: number }
        Update: { modifier_group_id?: string; product_id?: string; sort_order?: number }
        Relationships: [
          { foreignKeyName: "product_modifier_groups_modifier_group_id_fkey"; columns: ["modifier_group_id"]; isOneToOne: false; referencedRelation: "modifier_groups"; referencedColumns: ["id"] },
          { foreignKeyName: "product_modifier_groups_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_available: boolean
          name: string
          price: number
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          name: string
          price: number
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_available?: boolean
          name?: string
          price?: number
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_name: string | null
          driver_id: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_used_at: string | null
          p256dh: string
          restaurant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_name?: string | null
          driver_id?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh: string
          restaurant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_name?: string | null
          driver_id?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh?: string
          restaurant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          duration_minutes: number
          id: string
          internal_notes: string | null
          party_size: number
          public_token: string
          reservation_date: string
          reservation_time: string
          restaurant_id: string
          source: Database["public"]["Enums"]["reservation_source"]
          special_requests: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          table_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          duration_minutes?: number
          id?: string
          internal_notes?: string | null
          party_size: number
          public_token?: string
          reservation_date: string
          reservation_time: string
          restaurant_id: string
          source?: Database["public"]["Enums"]["reservation_source"]
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          table_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          duration_minutes?: number
          id?: string
          internal_notes?: string | null
          party_size?: number
          public_token?: string
          reservation_date?: string
          reservation_time?: string
          restaurant_id?: string
          source?: Database["public"]["Enums"]["reservation_source"]
          special_requests?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          table_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          auto_accept_orders: boolean
          auto_confirm_reservations: boolean
          created_at: string
          default_delivery_fee: number
          default_preparation_minutes: number
          delivery_fee_per_km: number
          delivery_origin_latitude: number | null
          delivery_origin_longitude: number | null
          delivery_radius_km: number
          free_delivery_from: number | null
          minimum_order_amount: number
          order_sound_enabled: boolean
          primary_color: string
          reservation_advance_days: number
          reservation_capacity: number
          reservation_duration_minutes: number
          reservation_slot_minutes: number
          restaurant_id: string
          secondary_color: string
          updated_at: string
        }
        Insert: {
          auto_accept_orders?: boolean
          auto_confirm_reservations?: boolean
          created_at?: string
          default_delivery_fee?: number
          default_preparation_minutes?: number
          delivery_fee_per_km?: number
          delivery_origin_latitude?: number | null
          delivery_origin_longitude?: number | null
          delivery_radius_km?: number
          free_delivery_from?: number | null
          minimum_order_amount?: number
          order_sound_enabled?: boolean
          primary_color?: string
          reservation_advance_days?: number
          reservation_capacity?: number
          reservation_duration_minutes?: number
          reservation_slot_minutes?: number
          restaurant_id: string
          secondary_color?: string
          updated_at?: string
        }
        Update: {
          auto_accept_orders?: boolean
          auto_confirm_reservations?: boolean
          created_at?: string
          default_delivery_fee?: number
          default_preparation_minutes?: number
          delivery_fee_per_km?: number
          delivery_origin_latitude?: number | null
          delivery_origin_longitude?: number | null
          delivery_radius_km?: number
          free_delivery_from?: number | null
          minimum_order_amount?: number
          order_sound_enabled?: boolean
          primary_color?: string
          reservation_advance_days?: number
          reservation_capacity?: number
          reservation_duration_minutes?: number
          reservation_slot_minutes?: number
          restaurant_id?: string
          secondary_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_users_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          accepts_delivery: boolean
          accepts_dine_in: boolean
          accepts_pickup: boolean
          accepts_reservations: boolean
          address_line: string | null
          city: string | null
          country_code: string
          cover_url: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          tax_number: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          accepts_delivery?: boolean
          accepts_dine_in?: boolean
          accepts_pickup?: boolean
          accepts_reservations?: boolean
          address_line?: string | null
          city?: string | null
          country_code?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          accepts_delivery?: boolean
          accepts_dine_in?: boolean
          accepts_pickup?: boolean
          accepts_reservations?: boolean
          address_line?: string | null
          city?: string | null
          country_code?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          tax_number?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_delivery: {
        Args: { requested_delivery_id: string }
        Returns: undefined
      }
      accept_driver_invite: {
        Args: { requested_token: string }
        Returns: string
      }
      activate_current_user_as_driver: { Args: never; Returns: string }
      complete_delivery: {
        Args: { requested_delivery_id: string }
        Returns: undefined
      }
      cancel_public_reservation: {
        Args: {
          requested_reservation_id: string
          requested_reservation_token: string
        }
        Returns: boolean
      }
      create_delivery_for_order: {
        Args: { requested_order_id: string }
        Returns: string
      }
      create_restaurant_for_current_user: {
        Args: { restaurant_name: string; restaurant_slug: string }
        Returns: string
      }
      dispatch_next_driver: {
        Args: { requested_delivery_id: string }
        Returns: string
      }
      expire_my_delivery_offer: {
        Args: { requested_delivery_id: string }
        Returns: boolean
      }
      has_restaurant_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["restaurant_role"][]
          requested_restaurant_id: string
        }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { requested_restaurant_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      pick_up_delivery: {
        Args: { requested_delivery_id: string }
        Returns: undefined
      }
      process_expired_delivery_offers: { Args: never; Returns: number }
      reject_delivery: {
        Args: { requested_delivery_id: string }
        Returns: undefined
      }
      reorder_restaurant_products: {
        Args: {
          requested_product_ids: string[]
          requested_restaurant_id: string
        }
        Returns: undefined
      }
      create_public_order: {
        Args: {
          requested_customer_email: string
          requested_customer_name: string
          requested_customer_phone: string
          requested_delivery_address: string
          requested_delivery_latitude: number | null
          requested_delivery_longitude: number | null
          requested_items: Json
          requested_notes: string
          requested_restaurant_id: string
          requested_type: Database["public"]["Enums"]["order_type"]
        }
        Returns: {
          order_delivery_fee: number
          order_id: string
          order_subtotal: number
          order_token: string
          order_total: number
        }[]
      }
      replace_restaurant_business_hours: {
        Args: {
          requested_restaurant_id: string
          requested_schedule: Json
        }
        Returns: undefined
      }
      create_public_reservation: {
        Args: {
          requested_customer_email: string
          requested_customer_name: string
          requested_customer_phone: string
          requested_date: string
          requested_party_size: number
          requested_restaurant_id: string
          requested_special_requests: string
          requested_time: string
        }
        Returns: {
          reservation_id: string
          reservation_state: Database["public"]["Enums"]["reservation_status"]
          reservation_token: string
        }[]
      }
      get_public_checkout_settings: { Args: { requested_restaurant_id: string }; Returns: Json }
      get_public_reservation_settings: {
        Args: { requested_restaurant_id: string }
        Returns: {
          reservation_advance_days: number
          reservation_slot_minutes: number
        }[]
      }
      get_public_order_status: { Args: { requested_order_id: string; requested_order_token: string }; Returns: Json }
      get_public_reservation_status: {
        Args: {
          requested_reservation_id: string
          requested_reservation_token: string
        }
        Returns: Json
      }
    }
    Enums: {
      delivery_status:
        | "searching_driver"
        | "offered"
        | "accepted"
        | "picked_up"
        | "delivered"
        | "cancelled"
      driver_status: "offline" | "available" | "busy" | "suspended"
      order_status:
        | "new"
        | "confirmed"
        | "preparing"
        | "ready"
        | "awaiting_driver"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
      order_type: "delivery" | "pickup" | "dine_in"
      platform_role: "user" | "super_admin"
      reservation_source: "public" | "dashboard" | "phone" | "walk_in"
      reservation_status:
        | "pending"
        | "confirmed"
        | "seated"
        | "completed"
        | "cancelled"
        | "no_show"
      restaurant_role:
        | "owner"
        | "admin"
        | "manager"
        | "kitchen"
        | "driver"
        | "staff"
      restaurant_status: "draft" | "active" | "suspended" | "inactive"
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
    Enums: {
      delivery_status: [
        "searching_driver",
        "offered",
        "accepted",
        "picked_up",
        "delivered",
        "cancelled",
      ],
      driver_status: ["offline", "available", "busy", "suspended"],
      order_status: [
        "new",
        "confirmed",
        "preparing",
        "ready",
        "awaiting_driver",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
      platform_role: ["user", "super_admin"],
      restaurant_role: [
        "owner",
        "admin",
        "manager",
        "kitchen",
        "driver",
        "staff",
      ],
      restaurant_status: ["draft", "active", "suspended", "inactive"],
    },
  },
} as const
