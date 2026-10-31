-- ============================================================================
-- 0030 · Orden numérico de facturas
-- Agrega numero_orden (solo dígitos del número de factura) para ordenar los
-- listados de menor a mayor aunque el número no esté rellenado con ceros.
-- Se agrega al final para que create or replace view siga siendo válido.
-- ============================================================================

create or replace view public.facturas_con_saldo
with (security_invoker = true)
as
select
  f.id,
  f.numero_factura,
  f.cliente_id,
  c.rif,
  c.nombre_juridico,
  v.nombre                                                    as vendedor,
  f.fecha_emision,
  f.condicion,
  f.dias_credito,
  f.fecha_vencimiento,
  f.total_usd,
  f.total_pagado_usd,
  round(f.total_usd - f.total_pagado_usd, 2)                  as saldo_usd,
  case
    when f.total_usd - f.total_pagado_usd <= 0.005 then 'pagada'
    when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
    when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
    else 'pendiente'
  end                                                          as estado,
  case
    when f.total_usd - f.total_pagado_usd <= 0.005 then 0
    else greatest(0, (now() at time zone 'America/Caracas')::date - f.fecha_vencimiento)
  end                                                          as dias_mora,
  f.created_at,
  f.vendedor_id,
  coalesce(
    nullif(regexp_replace(f.numero_factura, '[^0-9]', '', 'g'), ''),
    '0'
  )::numeric                                                    as numero_orden
from public.facturas f
join public.clientes c on c.id = f.cliente_id
join public.vendedores v on v.id = f.vendedor_id;

comment on view public.facturas_con_saldo is
  'Facturas con total pagado, saldo, estado (pagada|vencida|por_vencer|pendiente), días de mora, vendedor snapshot y numero_orden para ordenar numéricamente.';
