-- Índices para acelerar resumen e historial de vendedores
create index if not exists facturas_vendedor_fecha_idx
  on public.facturas (vendedor_id, fecha_emision);

create index if not exists comisiones_vendedor_vendedor_pagada_idx
  on public.comisiones_vendedor (vendedor_id, pagada_at);
