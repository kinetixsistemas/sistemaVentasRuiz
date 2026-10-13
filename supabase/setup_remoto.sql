-- Setup completo Sistema Ruiz Lite
-- 1. Función updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- 2. Productos
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  cantidad integer not null default 0,
  precio_usd numeric(12,2) not null default 0,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint productos_cantidad_nonneg check (cantidad>=0),
  constraint productos_precio_nonneg check (precio_usd>=0),
  constraint productos_codigo_formato check (length(btrim(codigo))>0 and codigo=upper(codigo) and codigo !~ '[[:space:]]'),
  constraint productos_nombre_nonempty check (length(btrim(nombre))>0)
);

-- 3. Clientes
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  rif text not null unique,
  nombre_juridico text not null,
  nombre_encargado text not null,
  telefono text not null,
  correo text not null,
  direccion text not null,
  vendedor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_rif_formato check (rif ~ '^[JVEGPC]-[0-9]{8}-[0-9]$'),
  constraint clientes_telefono_digitos check (telefono ~ '^[0-9]{10,13}$'),
  constraint clientes_correo_formato check (correo=lower(correo) and correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint clientes_nombre_juridico_nonempty check (length(btrim(nombre_juridico))>0),
  constraint clientes_encargado_nonempty check (length(btrim(nombre_encargado))>0),
  constraint clientes_vendedor_nonempty check (length(btrim(vendedor))>0),
  constraint clientes_direccion_nonempty check (length(btrim(direccion))>0)
);

-- 4. Facturas
create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  numero_factura text not null unique,
  fecha_emision date not null default (now() at time zone 'America/Caracas')::date,
  condicion text not null,
  dias_credito integer not null,
  fecha_vencimiento date not null,
  total_usd numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint facturas_condicion_valida check (condicion in ('contado','credito')),
  constraint facturas_condicion_dias_check check ((condicion='contado' and dias_credito=0) or (condicion='credito' and dias_credito in (7,15,30))),
  constraint facturas_vencimiento_check check (fecha_vencimiento = fecha_emision + dias_credito),
  constraint facturas_total_nonneg check (total_usd>=0),
  constraint facturas_numero_nonempty check (length(btrim(numero_factura))>0)
);

-- 5. Factura items
create table if not exists public.factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad integer not null,
  precio_unitario_usd numeric(12,2) not null,
  subtotal_usd numeric(12,2) not null,
  constraint factura_items_cantidad_positiva check (cantidad>0),
  constraint factura_items_precio_nonneg check (precio_unitario_usd>=0),
  constraint factura_items_subtotal_nonneg check (subtotal_usd>=0),
  constraint factura_items_subtotal_coherente check (subtotal_usd = round(cantidad::numeric*precio_unitario_usd,2)),
  constraint factura_items_producto_unico unique (factura_id,producto_id)
);

-- 6. Pagos
create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete restrict,
  fecha date not null default (now() at time zone 'America/Caracas')::date,
  metodo text not null,
  monto_original numeric(12,2) not null,
  moneda text not null,
  tasa_cambio numeric(12,4),
  monto_usd numeric(12,2) not null,
  referencia text,
  correo text,
  created_at timestamptz not null default now(),
  constraint pagos_metodo_valido check (metodo in ('efectivo','transferencia','zelle','bs')),
  constraint pagos_moneda_valida check (moneda in ('USD','VES')),
  constraint pagos_bs_requiere_tasa check ((moneda='USD' and tasa_cambio is null) or (moneda='VES' and tasa_cambio is not null)),
  constraint pagos_monto_original_nonneg check (monto_original>=0),
  constraint pagos_monto_usd_nonneg check (monto_usd>=0)
);

-- 7. Vista facturas_con_saldo
create or replace view public.facturas_con_saldo as
select
  f.id, f.numero_factura, f.cliente_id, c.nombre_juridico,
  f.fecha_emision, f.condicion, f.dias_credito, f.fecha_vencimiento,
  f.total_usd,
  coalesce(sum(p.monto_usd), 0::numeric(12,2)) as pagado_usd,
  (f.total_usd - coalesce(sum(p.monto_usd), 0::numeric(12,2))) as saldo_usd,
  case
    when (f.total_usd - coalesce(sum(p.monto_usd), 0::numeric(12,2))) <= 0 then 'pagada'
    when f.fecha_vencimiento < (now() at time zone 'America/Caracas')::date then 'vencida'
    when f.fecha_vencimiento <= (now() at time zone 'America/Caracas')::date + 7 then 'por_vencer'
    else 'pendiente'
  end as estado
from public.facturas f
join public.clientes c on c.id = f.cliente_id
left join public.pagos p on p.factura_id = f.id
group by f.id, f.numero_factura, f.cliente_id, c.nombre_juridico, f.fecha_emision, f.condicion, f.dias_credito, f.fecha_vencimiento, f.total_usd;

-- 8. RLS (habilitar)
alter table public.productos enable row level security;
alter table public.clientes enable row level security;
alter table public.facturas enable row level security;
alter table public.factura_items enable row level security;
alter table public.pagos enable row level security;

-- 9. Políticas para anon (lectura)
drop policy if exists productos_select_anon on public.productos;
create policy productos_select_anon on public.productos for select to anon using (true);
drop policy if exists clientes_select_anon on public.clientes;
create policy clientes_select_anon on public.clientes for select to anon using (true);
drop policy if exists facturas_select_anon on public.facturas;
create policy facturas_select_anon on public.facturas for select to anon using (true);
drop policy if exists factura_items_select_anon on public.factura_items;
create policy factura_items_select_anon on public.factura_items for select to anon using (true);
drop policy if exists pagos_select_anon on public.pagos;
create policy pagos_select_anon on public.pagos for select to anon using (true);

-- 10. Permisos anon
grant select on public.productos to anon;
grant select on public.clientes to anon;
grant select on public.facturas to anon;
grant select on public.factura_items to anon;
grant select on public.pagos to anon;
grant select on public.facturas_con_saldo to anon;

-- 11. Seed productos + clientes
insert into public.productos (codigo, nombre, cantidad, precio_usd)
values 
  ('P001','Cemento gris 42.5 kg', 200, 9.50),
  ('P002','Cabilla 3/8 x 12 m', 150, 6.75),
  ('P003','Pintura blanca 1 galón', 80, 12.00),
  ('P004','Tubo PVC 1/2 x 3 m', 120, 3.25),
  ('P005','Alambre dulce 1 kg', 100, 2.40),
  ('P006','Disco de corte 7"', 60, 4.80)
on conflict (codigo) do nothing;

insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
values 
  ('J-12345678-9','Construcciones Andes, C.A.','José Pérez','04141234567','compras@andes.com','Av. principal, Galpón 4, Barquisimeto','Luis Márquez'),
  ('G-20000000-1','Ferretería El Tornillo, S.A.','María Gómez','02121234567','ventas@eltornillo.com','Calle 5 con carrera 8, Valencia','Luis Márquez'),
  ('C-30000000-2','Inversiones Delta, C.A.','Carlos Ruiz','04160001122','admin@delta.com.ve','Zona industrial, galpón 12, Maracay','Pedro Salas')
on conflict (rif) do nothing;

-- 12. Historial de ventas 1 mes
do $$
declare
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_inicio date := v_hoy - interval '29 days';
  v_d date; v_cli uuid; v_f uuid; v_num text; v_cond text; v_dias int; v_fv date; v_total numeric(12,2); v_seq int;
  cli1 uuid; cli2 uuid; cli3 uuid; cli4 uuid; cli5 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  pr1 numeric(12,2); pr2 numeric(12,2); pr3 numeric(12,2); pr4 numeric(12,2); pr5 numeric(12,2); pr6 numeric(12,2);
  nf int:=0; v_count int;
begin
  select count(*) into v_count from public.facturas;
  if v_count>=25 then raise notice 'skip'; return; end if;
  select id into cli1 from public.clientes where rif='J-12345678-9';
  select id into cli2 from public.clientes where rif='G-20000000-1';
  select id into cli3 from public.clientes where rif='C-30000000-2';
  insert into public.clientes (rif,nombre_juridico,nombre_encargado,telefono,correo,direccion,vendedor) values ('J-40000000-3','Materiales Miranda, C.A.','Ana Miranda','04140001111','compras@miranda.com','Av. Bolívar, San Felipe','Luis Márquez') on conflict (rif) do nothing;
  select id into cli4 from public.clientes where rif='J-40000000-3';
  insert into public.clientes (rif,nombre_juridico,nombre_encargado,telefono,correo,direccion,vendedor) values ('J-50000000-4','Construcciones Lara, C.A.','Roberto Lara','04140002222','gerencia@laraca.com','Zona Norte, Barquisimeto','Pedro Salas') on conflict (rif) do nothing;
  select id into cli5 from public.clientes where rif='J-50000000-4';
  select id,precio_usd into p1,pr1 from public.productos where codigo='P001';
  select id,precio_usd into p2,pr2 from public.productos where codigo='P002';
  select id,precio_usd into p3,pr3 from public.productos where codigo='P003';
  select id,precio_usd into p4,pr4 from public.productos where codigo='P004';
  select id,precio_usd into p5,pr5 from public.productos where codigo='P005';
  select id,precio_usd into p6,pr6 from public.productos where codigo='P006';
  select coalesce(max((regexp_replace(numero_factura,'[^0-9]','','g'))::int),0) into v_seq from public.facturas;
  for v_d in select generate_series(v_inicio,v_hoy,interval '1 day')::date loop
    for i in 1..(floor(random()*4)+2) loop
      v_seq:=v_seq+1; v_num:='F-'||lpad(v_seq::text,4,'0');
      case floor(random()*5)+1 when 1 then v_cli:=cli1; when 2 then v_cli:=cli2; when 3 then v_cli:=cli3; when 4 then v_cli:=cli4; when 5 then v_cli:=cli5; end case;
      if random()<0.65 then v_cond:='credito'; v_dias:=case when random()<0.5 then 15 else 30 end; else v_cond:='contado'; v_dias:=0; end if;
      v_fv:=v_d+v_dias;
      insert into public.facturas(cliente_id,numero_factura,fecha_emision,condicion,dias_credito,fecha_vencimiento,total_usd) values(v_cli,v_num,v_d,v_cond,v_dias,v_fv,0) returning id into v_f;
      v_total:=0;
      if random()<0.45 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p1,(floor(random()*9)+2),pr1,round(((floor(random()*9)+2))::numeric * pr1, 2)); v_total:=v_total+round(((floor(random()*9)+2))::numeric * pr1, 2); end if;
      if random()<0.6 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p2,(floor(random()*12)+1),pr2,round(((floor(random()*12)+1))::numeric * pr2, 2)); v_total:=v_total+round(((floor(random()*12)+1))::numeric * pr2, 2); end if;
      if random()<0.5 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p3,(floor(random()*6)+1),pr3,round(((floor(random()*6)+1))::numeric * pr3, 2)); v_total:=v_total+round(((floor(random()*6)+1))::numeric * pr3, 2); end if;
      if random()<0.5 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p4,(floor(random()*14)+2),pr4,round(((floor(random()*14)+2))::numeric * pr4, 2)); v_total:=v_total+round(((floor(random()*14)+2))::numeric * pr4, 2); end if;
      if random()<0.35 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p5,(floor(random()*18)+3),pr5,round(((floor(random()*18)+3))::numeric * pr5, 2)); v_total:=v_total+round(((floor(random()*18)+3))::numeric * pr5, 2); end if;
      if random()<0.25 then insert into public.factura_items(factura_id,producto_id,cantidad,precio_unitario_usd,subtotal_usd) values(v_f,p6,(floor(random()*10)+1),pr6,round(((floor(random()*10)+1))::numeric * pr6, 2)); v_total:=v_total+round(((floor(random()*10)+1))::numeric * pr6, 2); end if;
      update public.facturas set total_usd=v_total where id=v_f;
      with it as (select producto_id,sum(cantidad) as cant from public.factura_items where factura_id=v_f group by producto_id) update public.productos p set cantidad=greatest(0,p.cantidad-it.cant) from it where p.id=it.producto_id;
      if v_cond='contado' then
        if random()<0.82 then insert into public.pagos(factura_id,fecha,metodo,monto_original,moneda,monto_usd,referencia) values(v_f,v_d,case when random()<0.7 then 'efectivo' when random()<0.9 then 'transferencia' else 'zelle' end,v_total,'USD',v_total,null); elsif random()<0.6 then insert into public.pagos(factura_id,fecha,metodo,monto_original,moneda,monto_usd,referencia) values(v_f,v_d,'efectivo',round((v_total*0.5)::numeric,2),'USD',round((v_total*0.5)::numeric,2),null); end if;
      else
        if v_fv<=v_hoy and random()<0.38 then insert into public.pagos(factura_id,fecha,metodo,monto_original,moneda,tasa_cambio,monto_usd,referencia) values(v_f,v_hoy-1,'bs',round(v_total*0.35*50,2),'VES',round(v_total*0.35,2),'BS-TEST'); end if;
      end if;
      nf:=nf+1;
    end loop;
  end loop;
  raise notice 'ok=%',nf;
end $$;
