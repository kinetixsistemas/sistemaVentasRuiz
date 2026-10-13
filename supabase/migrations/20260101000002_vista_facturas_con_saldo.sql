-- ============================================================================
-- 0002 · Vista facturas_con_saldo
-- Calcula pagos, saldo, estado y días de mora. Nada de esto se guarda.
-- security_invoker = true → la vista respeta las políticas RLS de quien consulta.
-- "Hoy" siempre en zona horaria America/Caracas.
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
  c.vendedor,
  f.fecha_emision,
  f.condicion,
  f.dias_credito,
  f.fecha_vencimiento,
  f.total_usd,
  coalesce(p.total_pagado_usd, 0)::numeric(12,2)              as total_pagado_usd,
  round(f.total_usd - coalesce(p.total_pagado_usd, 0), 2)     as saldo_usd,
  case
    when f.total_usd - coalesce(p.total_pagado_usd, 0) <= 0.005 then 'pagada'
    when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
    when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 5 then 'por_vencer'
    else 'pendiente'
  end                                                          as estado,
  case
    when f.total_usd - coalesce(p.total_pagado_usd, 0) <= 0.005 then 0
    else greatest(0, (now() at time zone 'America/Caracas')::date - f.fecha_vencimiento)
  end                                                          as dias_mora,
  f.created_at
from public.facturas f
join public.clientes c on c.id = f.cliente_id
left join (
  select factura_id, sum(monto_usd) as total_pagado_usd
  from public.pagos
  group by factura_id
) p on p.factura_id = f.id;

comment on view public.facturas_con_saldo is
  'Facturas con total pagado, saldo, estado (pagada|vencida|por_vencer|pendiente) y días de mora calculados.';
