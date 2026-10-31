// ============================================================================
// Tipos de la base de datos de Supabase.
//
// VERSIÓN PROVISIONAL escrita a mano como espejo de `supabase/migrations/*.sql`.
// Cuando el proyecto de Supabase esté enlazado y las migraciones aplicadas,
// regenerar este archivo con:
//
//   supabase gen types typescript --project-id <id> > src/types/database.ts
//
// La versión generada puede diferir en detalles menores; si algo choca con el
// código, se debe priorizar la versión generada (es la que habla con la BD real).
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CondicionFactura = "contado" | "credito";
export type MetodoPago = "bs" | "efectivo" | "zelle" | "binance";
export type MonedaPago = "VES" | "USD";
export type EstadoFactura = "pagada" | "vencida" | "por_vencer" | "pendiente" | "anulada";
export type RolUsuario = "admin" | "vendedor";

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: {
          id: string;
          nombre: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      productos: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          cantidad: number;
          precio_usd: number;
          foto_url: string | null;
          categoria_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          cantidad?: number;
          precio_usd?: number;
          foto_url?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          cantidad?: number;
          precio_usd?: number;
          foto_url?: string | null;
          categoria_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          id: string;
          rif: string;
          nombre_juridico: string;
          nombre_encargado: string;
          telefono: string;
          correo: string | null;
          direccion: string;
          vendedor_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rif: string;
          nombre_juridico: string;
          nombre_encargado: string;
          telefono: string;
          correo?: string | null;
          direccion: string;
          vendedor_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rif?: string;
          nombre_juridico?: string;
          nombre_encargado?: string;
          telefono?: string;
          correo?: string | null;
          direccion?: string;
          vendedor_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vendedores: {
        Row: {
          id: string;
          nombre: string;
          comision_pct: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          comision_pct?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          comision_pct?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comisiones_vendedor: {
        Row: {
          id: string;
          factura_id: string;
          vendedor_id: string;
          base_usd: number;
          comision_pct: number;
          monto_usd: number;
          pagada_at: string;
          created_at: string;
          updated_at: string;
          fecha: string;
          metodo: string;
          moneda: string;
          monto_original: number;
          tasa_cambio: number | null;
          referencia: string | null;
          correo: string | null;
        };
        Insert: {
          id?: string;
          factura_id: string;
          vendedor_id: string;
          base_usd: number;
          comision_pct: number;
          monto_usd: number;
          pagada_at?: string;
          created_at?: string;
          updated_at?: string;
          fecha?: string;
          metodo: string;
          moneda: string;
          monto_original: number;
          tasa_cambio?: number | null;
          referencia?: string | null;
          correo?: string | null;
        };
        Update: {
          id?: string;
          factura_id?: string;
          vendedor_id?: string;
          base_usd?: number;
          comision_pct?: number;
          monto_usd?: number;
          pagada_at?: string;
          created_at?: string;
          updated_at?: string;
          fecha?: string;
          metodo?: string;
          moneda?: string;
          monto_original?: number;
          tasa_cambio?: number | null;
          referencia?: string | null;
          correo?: string | null;
        };
        Relationships: [];
      };
      facturas: {
        Row: {
          id: string;
          cliente_id: string;
          vendedor_id: string;
          numero_factura: string;
          fecha_emision: string;
          condicion: CondicionFactura;
          dias_credito: number;
          fecha_vencimiento: string;
          total_usd: number;
          descuento_usd: number;
          total_pagado_usd: number;
          comision_pct: number;
          comision_usd: number;
          anulada_at: string | null;
          anulada_motivo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          vendedor_id?: string;
          numero_factura: string;
          fecha_emision?: string;
          condicion: CondicionFactura;
          dias_credito: number;
          fecha_vencimiento: string;
          total_usd: number;
          descuento_usd?: number;
          total_pagado_usd?: number;
          comision_pct?: number;
          comision_usd?: number;
          anulada_at?: string | null;
          anulada_motivo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          vendedor_id?: string;
          numero_factura?: string;
          fecha_emision?: string;
          condicion?: CondicionFactura;
          dias_credito?: number;
          fecha_vencimiento?: string;
          total_usd?: number;
          descuento_usd?: number;
          total_pagado_usd?: number;
          comision_pct?: number;
          comision_usd?: number;
          anulada_at?: string | null;
          anulada_motivo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      factura_items: {
        Row: {
          id: string;
          factura_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario_usd: number;
          subtotal_usd: number;
        };
        Insert: {
          id?: string;
          factura_id: string;
          producto_id: string;
          cantidad: number;
          precio_unitario_usd: number;
          subtotal_usd: number;
        };
        Update: {
          id?: string;
          factura_id?: string;
          producto_id?: string;
          cantidad?: number;
          precio_unitario_usd?: number;
          subtotal_usd?: number;
        };
        Relationships: [];
      };
      pagos: {
        Row: {
          id: string;
          factura_id: string;
          fecha: string;
          metodo: MetodoPago;
          monto_original: number;
          moneda: MonedaPago;
          tasa_cambio: number | null;
          monto_usd: number;
          referencia: string | null;
          correo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_id: string;
          fecha?: string;
          metodo: MetodoPago;
          monto_original: number;
          moneda: MonedaPago;
          tasa_cambio?: number | null;
          monto_usd: number;
          referencia?: string | null;
          correo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          factura_id?: string;
          fecha?: string;
          metodo?: MetodoPago;
          monto_original?: number;
          moneda?: MonedaPago;
          tasa_cambio?: number | null;
          monto_usd?: number;
          referencia?: string | null;
          correo?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      empresa: {
        Row: {
          id: number;
          nombre_comercial: string;
          razon_social: string | null;
          rif: string | null;
          telefono: string | null;
          correo: string | null;
          direccion: string | null;
          logo_url: string | null;
          stock_bajo_umbral: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          nombre_comercial: string;
          razon_social?: string | null;
          rif?: string | null;
          telefono?: string | null;
          correo?: string | null;
          direccion?: string | null;
          logo_url?: string | null;
          stock_bajo_umbral?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          nombre_comercial?: string;
          razon_social?: string | null;
          rif?: string | null;
          telefono?: string | null;
          correo?: string | null;
          direccion?: string | null;
          logo_url?: string | null;
          stock_bajo_umbral?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          id: string;
          nombre: string | null;
          correo: string | null;
          rol: RolUsuario;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          nombre?: string | null;
          correo?: string | null;
          rol?: RolUsuario;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string | null;
          correo?: string | null;
          rol?: RolUsuario;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      facturas_con_saldo: {
        Row: {
          id: string;
          numero_factura: string;
          cliente_id: string;
          rif: string;
          nombre_juridico: string;
          vendedor: string;
          fecha_emision: string;
          condicion: CondicionFactura;
          dias_credito: number;
          fecha_vencimiento: string;
          total_usd: number;
          total_pagado_usd: number;
          saldo_usd: number;
          estado: EstadoFactura;
          dias_mora: number;
          created_at: string;
          vendedor_id: string;
          numero_orden: number;
          comision_pct: number;
          comision_usd: number;
          anulada_at: string | null;
          anulada_motivo: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      crear_factura: {
        Args: {
          p_cliente_id: string;
          p_numero_factura: string;
          p_condicion: string;
          p_dias_credito: number;
          p_items: Json;
          p_descuento_usd?: number;
          p_modo_manual?: boolean;
          p_monto_manual_usd?: number | null;
          p_comision_pct?: number | null;
          p_comision_usd?: number | null;
        };
        Returns: string;
      };
      actualizar_comision_factura: {
        Args: {
          p_factura_id: string;
          p_comision_pct: number;
          p_comision_usd: number;
        };
        Returns: Array<{
          comision_pct: number;
          comision_usd: number;
        }>;
      };
      editar_factura: {
        Args: {
          p_factura_id: string;
          p_cliente_id: string;
          p_numero_factura: string;
          p_condicion: string;
          p_dias_credito: number;
          p_items: Json;
          p_descuento_usd?: number;
          p_modo_manual?: boolean;
          p_monto_manual_usd?: number | null;
          p_comision_pct?: number | null;
          p_comision_usd?: number | null;
        };
        Returns: string;
      };
      anular_factura: {
        Args: {
          p_factura_id: string;
          p_motivo?: string | null;
        };
        Returns: undefined;
      };
      registrar_pago: {
        Args: {
          p_factura_id: string;
          p_metodo: string;
          p_monto: number;
          p_tasa: number | null;
          p_referencia: string | null;
          p_correo: string | null;
          p_fecha: string | null;
        };
        Returns: {
          pago_id: string;
          factura_id: string;
          monto_usd: number;
          saldo_usd: number;
          estado: string;
        };
      };
      registrar_pago_asignado: {
        Args: {
          p_metodo: string;
          p_tasa: number | null;
          p_referencia: string | null;
          p_correo: string | null;
          p_fecha: string | null;
          p_asignaciones: Json;
        };
        Returns: {
          total_usd: number;
          pagos: Array<{
            pago_id: string;
            factura_id: string;
            monto_usd: number;
            saldo_usd: number;
            estado: string;
          }>;
        };
      };
      normalizar_referencia: {
        Args: {
          p_ref: string | null;
        };
        Returns: string | null;
      };
      resumen_cartera: {
        Args: Record<PropertyKey, never>;
        Returns: {
          por_cobrar_usd: number;
          facturas_abiertas: number;
          vencidas_usd: number;
          facturas_vencidas: number;
          por_vencer_usd: number;
          facturas_por_vencer: number;
        };
      };
      resumen_ventas_periodo: {
        Args: {
          p_desde: string;
          p_hasta: string;
        };
        Returns: {
          total_vendido_usd: number;
          total_recaudado_usd: number;
        };
      };
      resumen_vendedores: {
        Args: {
          p_desde?: string | null;
          p_hasta?: string | null;
        };
        Returns: Array<{
          id: string;
          nombre: string;
          comision_pct: number;
          activo: boolean;
          facturas_periodo: number;
          pagadas_periodo: number;
          pendientes_periodo: number;
          vendido_periodo_usd: number;
          cobrado_periodo_usd: number;
          saldo_periodo_usd: number;
          facturas_total: number;
          pagadas_total: number;
          vendido_total_usd: number;
          comision_total_usd: number;
          comision_pagada_usd: number;
          comision_pendiente_usd: number;
          comisiones_pagadas: number;
        }>;
      };
      pagar_comision_vendedor: {
        Args: {
          p_factura_id: string;
          p_metodo: string;
          p_monto: number;
          p_tasa?: number | null;
          p_referencia?: string | null;
          p_correo?: string | null;
          p_fecha?: string | null;
        };
        Returns: Array<{
          comision_id: string;
          factura_id: string;
          vendedor_id: string;
          base_usd: number;
          comision_pct: number;
          monto_usd: number;
          pagada_at: string;
          fecha: string;
          metodo: string;
          moneda: string;
          monto_original: number;
          tasa_cambio: number | null;
          referencia: string | null;
          correo: string | null;
        }>;
      };
      productos_stock_bajo: {
        Args: {
          p_umbral: number;
          p_limite?: number;
        };
        Returns: Array<{
          id: string;
          codigo: string;
          nombre: string;
          cantidad: number;
          precio_usd: number;
          foto_url: string | null;
        }>;
      };
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: Record<PropertyKey, never>;
    CompositeTypes: Record<PropertyKey, never>;
  };
}