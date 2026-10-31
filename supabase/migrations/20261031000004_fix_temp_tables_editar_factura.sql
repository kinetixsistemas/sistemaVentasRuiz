-- ============================================================================
-- 0034 · Corrige tablas temporales de editar_factura
-- Permite editar la misma factura más de una vez dentro de una transacción.
-- ============================================================================

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef(
    'public.editar_factura(uuid, uuid, text, text, integer, jsonb, numeric, boolean, numeric, numeric, numeric)'::regprocedure
  );

  v_def := replace(
    v_def,
    '  create temp table _items_edit_norm (',
    E'  drop table if exists pg_temp._items_edit_norm;\n  create temp table _items_edit_norm ('
  );
  v_def := replace(
    v_def,
    '  create temp table _ajustes_stock (',
    E'  drop table if exists pg_temp._ajustes_stock;\n  create temp table _ajustes_stock ('
  );

  execute v_def;
end;
$$;
