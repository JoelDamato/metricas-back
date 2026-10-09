// Transactions against the existing schema. No schema changes or historical backfill.
const crypto = require('node:crypto');
const literal = value => "'" + String(value).replace(/'/g, "''") + "'";
const signed = (row, field) => (/^Devoluci[oó]n$/i.test(row.tipo) ? -1 : 1) * Number(row[field] || 0);
function buildMutation({ before, patch = {}, remove = false }) {
  if (!before?.id || !before.cliente) throw new Error('El comprobante no tiene un cliente vinculado');
  const after = remove ? null : { ...before, ...patch };
  const saleId = before.tipo === 'Venta' ? before.id : before.venta_relacionada;
  if (!saleId) throw new Error('El comprobante no tiene una venta vinculada');
  const cash = Number(((after ? signed(after, 'cash_collected') : 0) - signed(before, 'cash_collected')).toFixed(2));
  const fact = Number(((after ? signed(after, 'facturacion') : 0) - signed(before, 'facturacion')).toFixed(2));
  if (![cash,fact].every(Number.isFinite)) throw new Error('Importes inválidos');
  const net=Number(((after?signed(after,'cash_collected_neto'):0)-signed(before,'cash_collected_neto')).toFixed(6));
  const netUpdate=Object.hasOwn(before,'cash_collected_neto_total')?`,cash_collected_neto_total=coalesce(cash_collected_neto_total,0)+(${net})`:'';
  const id = literal(before.id), lead = literal(before.cliente), sale = literal(saleId);
  const names = Object.keys(patch);
  if (!names.every(k => /^[a-z_][a-z0-9_]*$/.test(k))) throw new Error('Columnas inválidas');
  const block = '$mutation_' + crypto.randomBytes(12).toString('hex') + '$';
  return `begin; set local statement_timeout='20s';
  do ${block} declare current_row public.comprobantes; begin
    perform 1 from public.leads_raw where id=${lead} for update;
    if not found then raise exception 'Cliente inexistente'; end if;
    perform 1 from public.comprobantes where id in (${id},${sale}) order by id for update;
    select * into current_row from public.comprobantes where id=${id};
    if not found then raise exception 'Comprobante inexistente'; end if;
    if exists (
      select 1 from jsonb_each(to_jsonb(current_row)) actual
      join jsonb_each(to_jsonb(json_populate_record(null::public.comprobantes,${literal(JSON.stringify(before))}::json))) expected using(key)
      where case when jsonb_typeof(actual.value)='number' and jsonb_typeof(expected.value)='number'
        then abs((actual.value #>> '{}')::numeric-(expected.value #>> '{}')::numeric)>0.0000001
        else actual.value is distinct from expected.value end
    ) then
      raise exception 'El comprobante cambió; recargá antes de continuar';
    end if;
    if not exists(select 1 from public.comprobantes where id=${sale} and tipo='Venta' and cliente=${lead}) then
      raise exception 'La venta relacionada no coincide con el cliente';
    end if;
    ${remove && before.tipo === 'Venta' ? `if exists(select 1 from public.comprobantes where id<>${id} and position(${id} in coalesce(venta_relacionada,''))>0) then raise exception 'No se puede eliminar una venta con cobranzas o devoluciones vinculadas'; end if;` : ''}
    ${remove ? `delete from public.comprobantes where id=${id};` : `update public.comprobantes target set ${names.map(k => `"${k}"=p."${k}"`).join(',')} from json_populate_record(null::public.comprobantes,${literal(JSON.stringify(patch))}::json) p where target.id=${id};`}
    ${!remove || before.tipo !== 'Venta' ? `update public.comprobantes set cash_collected_total=coalesce(cash_collected_total,0)+ (${cash}),monto_incobrable=greatest(coalesce(facturacion,0)-coalesce((select sum(r.facturacion) from public.comprobantes r where r.venta_relacionada=${sale} and r.tipo in ('Devolucion','Devolución')),0)-coalesce(cash_collected_total,0)- (${cash}),0)${netUpdate} where id=${sale};` : ''}
    update public.leads_raw set facturacion_total=coalesce(facturacion_total,0)+ (${fact}),cash_collected_total=coalesce(cash_collected_total,0)+ (${cash}),saldo=coalesce(facturacion_total,0)+ (${fact})-coalesce(cash_collected_total,0)- (${cash}) where id=${lead};
  end ${block}; commit;`;
}
module.exports = { buildMutation, signed };
