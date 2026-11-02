-- Preserve the installed writer, including schema fixes, audit and atomic balance updates.
begin;
do $migration$
declare
 definition text;
 previous_guard text := 'if metricas_receipt_effective_v2(to_jsonb(v_old)) then raise exception ''Un comprobante conciliado no se puede editar ni eliminar'';end if;';
 next_guard text := 'if metricas_receipt_effective_v2(to_jsonb(v_old)) and not (p_action=''edit'' and v_actor=''nadia.cavallini@gmail.com'') then raise exception ''Un comprobante conciliado sólo puede ser editado por Nadia y no se puede eliminar'';end if;';
 previous_fields text := '''tipo'',''estado'',''rebotar_pago'',''cash_collected_total''';
 next_fields text := '''tipo'',''estado'',''rebotar_pago'',''conciliar'',''conciliacion_financiera'',''conciliacion_financiera_2'',''motivo_rebote'',''cash_collected_total''';
begin
 select pg_get_functiondef('public.metricas_comprobantes_write_v2(text,jsonb)'::regprocedure) into definition;
 if position(previous_guard in definition)=0 or position(previous_fields in definition)=0 then
  raise exception 'La función de comprobantes cambió; revisar antes de modificar sus permisos';
 end if;
 definition:=replace(replace(definition,previous_guard,next_guard),previous_fields,next_fields);
 execute definition;
end $migration$;
commit;
