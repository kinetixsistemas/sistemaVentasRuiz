-- ============================================================================
-- Seed de datos de prueba (idempotente).
--   Bloque 1: catálogo base (productos, clientes) y facturas en todos los
--             estados: pagada, vencida (con abono), por vencer, pendiente y
--             contado con abono parcial.
--   Bloque 2: historial de ventas de los últimos 30 días con pagos coherentes
--             con las reglas de `public.pagos`.
-- Las cantidades iniciales de los productos son holgadas porque el historial
-- de un mes descuenta stock.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bloque 1 · Catálogo y facturas de muestra
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid;  -- cliente A
  v_b uuid;  -- cliente B
  v_c uuid;  -- cliente C
  v_f1 uuid;
  v_f2 uuid;
  v_f3 uuid;
  v_f4 uuid;
  v_f5 uuid;
  v_hoy date := (now() at time zone 'America/Caracas')::date;
begin
  if exists (select 1 from public.productos) then
    raise notice 'El seed base ya fue aplicado; se omite.';
    return;
  end if;

  -- ---- Productos --------------------------------------------------------
  insert into public.productos (codigo, nombre, cantidad, precio_usd) values
    ('P001', 'Cemento gris 42.5 kg', 500, 9.50),
    ('P002', 'Cabilla 3/8 x 12 m', 450, 6.75),
    ('P003', 'Pintura blanca 1 galón', 300, 12.00),
    ('P004', 'Tubo PVC 1/2 x 3 m', 450, 3.25),
    ('P005', 'Alambre dulce 1 kg', 350, 2.40),
    ('P006', 'Disco de corte 7"', 250, 4.80);

  -- ---- Clientes ---------------------------------------------------------
  insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
  values ('J-12345678-9', 'Construcciones Andes, C.A.', 'José Pérez', '04141234567',
          'compras@andes.com', 'Av. principal, Galpón 4, Barquisimeto', 'Luis Márquez')
  returning id into v_a;

  insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
  values ('G-20000000-1', 'Ferretería El Tornillo, S.A.', 'María Gómez', '02121234567',
          'ventas@eltornillo.com', 'Calle 5 con carrera 8, Valencia', 'Luis Márquez')
  returning id into v_b;

  insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
  values ('C-30000000-2', 'Inversiones Delta, C.A.', 'Carlos Ruiz', '04160001122',
          'admin@delta.com.ve', 'Zona industrial, galpón 12, Maracay', 'Pedro Salas')
  returning id into v_c;

  insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
  values ('J-40000000-3', 'Materiales Miranda, C.A.', 'Ana Miranda', '04140001111',
          'compras@miranda.com', 'Av. Bolívar, San Felipe', 'Luis Márquez')
  on conflict (rif) do nothing;

  insert into public.clientes (rif, nombre_juridico, nombre_encargado, telefono, correo, direccion, vendedor)
  values ('J-50000000-4', 'Construcciones Lara, C.A.', 'Roberto Lara', '04140002222',
          'gerencia@laraca.com', 'Zona Norte, Barquisimeto', 'Pedro Salas')
  on conflict (rif) do nothing;

  -- ---- Factura 1: contado, totalmente pagada (efectivo) -----------------
  insert into public.facturas (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
  values (v_a, 'F-0001', v_hoy, 'contado', 0, v_hoy, 108.00)
  returning id into v_f1;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_f1, p.id, i.cantidad, i.precio, round(i.cantidad::numeric * i.precio, 2)
  from (values
    ('P001', 10, 9.50::numeric),
    ('P004', 4,  3.25::numeric)
  ) as i(codigo, cantidad, precio)
  join public.productos p on p.codigo = i.codigo;

  insert into public.pagos (factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo)
  values (v_f1, v_hoy, 'efectivo', 108.00, 'USD', null, 108.00, null, null);

  -- ---- Factura 2: crédito 30, vencida hace 10 días, abono parcial en Bs -
  insert into public.facturas (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
  values (v_a, 'F-0002', v_hoy - 40, 'credito', 30, v_hoy - 10, 147.00)
  returning id into v_f2;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_f2, p.id, i.cantidad, i.precio, round(i.cantidad::numeric * i.precio, 2)
  from (values
    ('P002', 20, 6.75::numeric),
    ('P005', 5,  2.40::numeric)
  ) as i(codigo, cantidad, precio)
  join public.productos p on p.codigo = i.codigo;

  insert into public.pagos (factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo)
  values (v_f2, v_hoy - 15, 'bs', 5000.00, 'VES', 50.0000, 100.00, 'BS-0001', null);

  -- ---- Factura 3: crédito 7, por vencer (en 3 días), sin pagos ----------
  insert into public.facturas (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
  values (v_b, 'F-0003', v_hoy - 4, 'credito', 7, v_hoy + 3, 92.50)
  returning id into v_f3;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_f3, p.id, i.cantidad, i.precio, round(i.cantidad::numeric * i.precio, 2)
  from (values
    ('P003', 5,  12.00::numeric),
    ('P004', 10, 3.25::numeric)
  ) as i(codigo, cantidad, precio)
  join public.productos p on p.codigo = i.codigo;

  -- ---- Factura 4: crédito 15, pendiente (vence en 14 días), sin pagos ---
  insert into public.facturas (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
  values (v_c, 'F-0004', v_hoy - 1, 'credito', 15, v_hoy + 14, 247.50)
  returning id into v_f4;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_f4, p.id, i.cantidad, i.precio, round(i.cantidad::numeric * i.precio, 2)
  from (values
    ('P001', 20, 9.00::numeric),
    ('P002', 10, 6.75::numeric)
  ) as i(codigo, cantidad, precio)
  join public.productos p on p.codigo = i.codigo;

  -- ---- Factura 5: contado, abono parcial por Zelle ----------------------
  insert into public.facturas (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
  values (v_b, 'F-0005', v_hoy, 'contado', 0, v_hoy, 59.50)
  returning id into v_f5;

  insert into public.factura_items (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
  select v_f5, p.id, i.cantidad, i.precio, round(i.cantidad::numeric * i.precio, 2)
  from (values
    ('P001', 5, 9.50::numeric),
    ('P005', 5, 2.40::numeric)
  ) as i(codigo, cantidad, precio)
  join public.productos p on p.codigo = i.codigo;

  insert into public.pagos (factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia, correo)
  values (v_f5, v_hoy, 'zelle', 30.00, 'USD', null, 30.00, 'ZL-999', 'pagos@eltornillo.com');

  raise notice 'Seed base aplicado correctamente.';
end;
$$;

-- ----------------------------------------------------------------------------
-- Bloque 2 · Historial de ventas de los últimos 30 días
-- Genera entre 2 y 4 facturas por día con 1 a 3 productos distintos y pagos
-- que respetan las restricciones de `public.pagos` (método, moneda y
-- conversión Bs → USD con tasa de demo 50,0000).
-- ----------------------------------------------------------------------------
do $$
declare
  v_hoy    date := (now() at time zone 'America/Caracas')::date;
  v_inicio date := v_hoy - 29;
  v_d      date;
  v_k      int;
  v_cli    uuid;
  v_f      uuid;
  v_num    text;
  v_cond   text;
  v_dias   int;
  v_fv     date;
  v_total  numeric(12,2);
  v_count  int;
  v_seq    int;
  v_items  int;
  v_pick   int;
  v_cant   int;
  v_pid    uuid;
  v_pu     numeric(12,2);
  v_max    int;
  v_usd    numeric(12,2);
  v_used   int[] := '{}';
  cli1 uuid; cli2 uuid; cli3 uuid; cli4 uuid; cli5 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid;
  pr1 numeric(12,2); pr2 numeric(12,2); pr3 numeric(12,2);
  pr4 numeric(12,2); pr5 numeric(12,2); pr6 numeric(12,2);
  nf int := 0;
begin
  select count(*) into v_count from public.facturas;
  if v_count >= 20 then
    raise notice 'El historial de un mes ya existe (% facturas).', v_count;
    return;
  end if;

  select id into cli1 from public.clientes where rif = 'J-12345678-9';
  select id into cli2 from public.clientes where rif = 'G-20000000-1';
  select id into cli3 from public.clientes where rif = 'C-30000000-2';
  select id into cli4 from public.clientes where rif = 'J-40000000-3';
  select id into cli5 from public.clientes where rif = 'J-50000000-4';

  select id, precio_usd into p1, pr1 from public.productos where codigo = 'P001';
  select id, precio_usd into p2, pr2 from public.productos where codigo = 'P002';
  select id, precio_usd into p3, pr3 from public.productos where codigo = 'P003';
  select id, precio_usd into p4, pr4 from public.productos where codigo = 'P004';
  select id, precio_usd into p5, pr5 from public.productos where codigo = 'P005';
  select id, precio_usd into p6, pr6 from public.productos where codigo = 'P006';

  select coalesce(max((regexp_replace(numero_factura, '[^0-9]', '', 'g'))::int), 0)
    into v_seq
    from public.facturas;

  for v_d in select generate_series(v_inicio, v_hoy, interval '1 day')::date loop
    for v_k in 1..(2 + floor(random() * 3)::int) loop
      v_seq := v_seq + 1;
      v_num := 'F-' || lpad(v_seq::text, 4, '0');

      case 1 + floor(random() * 5)::int
        when 1 then v_cli := cli1;
        when 2 then v_cli := cli2;
        when 3 then v_cli := cli3;
        when 4 then v_cli := cli4;
        else        v_cli := cli5;
      end case;

      if random() < 0.65 then
        v_cond := 'credito';
        v_dias := case when random() < 0.5 then 15 else 30 end;
      else
        v_cond := 'contado';
        v_dias := 0;
      end if;
      v_fv := v_d + v_dias;

      insert into public.facturas
        (cliente_id, numero_factura, fecha_emision, condicion, dias_credito, fecha_vencimiento, total_usd)
      values (v_cli, v_num, v_d, v_cond, v_dias, v_fv, 0)
      returning id into v_f;

      -- ---- Ítems (1 a 3 productos distintos) ----------------------------
      v_total := 0;
      v_items := 1 + floor(random() * 3)::int;
      v_used := '{}';

      while coalesce(array_length(v_used, 1), 0) < v_items loop
        v_pick := 1 + floor(random() * 6)::int;
        if v_pick = any (v_used) then
          continue;
        end if;
        v_used := array_append(v_used, v_pick);

        if v_pick = 1 then v_pid := p1; v_pu := pr1; v_max := 8;
        elsif v_pick = 2 then v_pid := p2; v_pu := pr2; v_max := 8;
        elsif v_pick = 3 then v_pid := p3; v_pu := pr3; v_max := 4;
        elsif v_pick = 4 then v_pid := p4; v_pu := pr4; v_max := 10;
        elsif v_pick = 5 then v_pid := p5; v_pu := pr5; v_max := 6;
        else v_pid := p6; v_pu := pr6; v_max := 4;
        end if;

        v_cant := 1 + floor(random() * v_max)::int;

        insert into public.factura_items
          (factura_id, producto_id, cantidad, precio_unitario_usd, subtotal_usd)
        values (v_f, v_pid, v_cant, v_pu, round(v_cant::numeric * v_pu, 2));

        v_total := v_total + round(v_cant::numeric * v_pu, 2);
      end loop;

      update public.facturas set total_usd = v_total where id = v_f;

      -- ---- Descuento de stock (suelo en 0 como red de seguridad) --------
      update public.productos p
         set cantidad = greatest(0, p.cantidad - s.cant)
        from (
          select producto_id, sum(cantidad)::int as cant
            from public.factura_items
           where factura_id = v_f
           group by producto_id
        ) s
       where p.id = s.producto_id;

      -- ---- Pagos coherentes con las reglas de la tabla ------------------
      if v_cond = 'contado' then
        if random() < 0.8 then
          if random() < 0.75 then
            insert into public.pagos
              (factura_id, fecha, metodo, monto_original, moneda, monto_usd)
            values (v_f, v_d, 'efectivo', v_total, 'USD', v_total);
          else
            insert into public.pagos
              (factura_id, fecha, metodo, monto_original, moneda, monto_usd, referencia, correo)
            values (v_f, v_d, 'zelle', v_total, 'USD', v_total, 'ZL-' || v_num, 'pagos@demo.com');
          end if;
        elsif random() < 0.6 then
          insert into public.pagos
            (factura_id, fecha, metodo, monto_original, moneda, monto_usd)
          values (v_f, v_d, 'efectivo', round(v_total * 0.5, 2), 'USD', round(v_total * 0.5, 2));
        end if;
      else
        if v_fv <= v_hoy and random() < 0.4 and v_total > 0 then
          if random() < 0.6 then
            -- Abono parcial en bolívares (tasa de demo 50,0000).
            v_usd := round(v_total * 0.4, 2);
            insert into public.pagos
              (factura_id, fecha, metodo, monto_original, moneda, tasa_cambio, monto_usd, referencia)
            values (v_f, v_hoy - 1, 'bs', round(v_usd * 50, 2), 'VES', 50.0000, v_usd, 'BS-' || v_num);
          else
            insert into public.pagos
              (factura_id, fecha, metodo, monto_original, moneda, monto_usd, referencia, correo)
            values (v_f, v_hoy - 1, 'zelle', round(v_total * 0.3, 2), 'USD', round(v_total * 0.3, 2), 'ZL-' || v_num, 'pagos@demo.com');
          end if;
        end if;
      end if;

      nf := nf + 1;
    end loop;
  end loop;

  raise notice 'Historial generado: % facturas en los últimos 30 días.', nf;
end;
$$;
