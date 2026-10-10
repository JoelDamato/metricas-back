const {test}=require('node:test');
const assert=require('node:assert/strict');
const {commissionRecipients}=require('../modules/settlements/recipients');
const people=[
 {nombre:'Belen Herrera',email:'belenherrera.gestion@gmail.com',role:'csm'},
 {nombre:'Walter Alegre',email:'walteralegre56@gmail.com'},
 {nombre:'Leo',email:'leonardoalaniz19@gmail.com'},
 {nombre:'Vale',email:'valecalmet@gmail.com',role:'csm'},
 {nombre:'Nadia',email:'nadia.cavallini@gmail.com',role:'total'},
 {nombre:'Mati',email:'matirandazzo@gmail.com',role:'total'},
 {nombre:'Pablo Butera Vie',email:'pmbutera1234@gmail.com',role:'comercial'},
 {nombre:'Nahuel Iasci',email:'iascinahuel@gmail.com',role:'comercial'},
 {nombre:'Otra cuenta comercial',email:'other@example.com',role:'comercial'}
];
test('incluye responsables de área y roles configurados aun sin comisión del mes; excluye otras cuentas',()=>{
 const rows=commissionRecipients(people,{config:{personRoles:[{person:'Pablo Butera',role:'Closer'},{person:'Nahuel Iasci',role:'Setter'}]},details:[]});
 assert.deepEqual(rows.map(r=>r.nombre),['Belen Herrera','Leo','Nahuel Iasci','Pablo Butera Vie','Walter Alegre']);
});
test('incluye comisiones efectivas; no incorpora una cuenta por un adelanto o bono ni cuentas inactivas',()=>{
 const rows=commissionRecipients([...people,{nombre:'Inactivo',email:'inactive@example.com',activo:false}],{config:{},details:[{person:'Otra cuenta comercial',commissionAmount:100},{person:'Nadia',isBonus:true,commissionAmount:100},{person:'Inactivo',commissionAmount:200}],movementRows:[{person_email:'matirandazzo@gmail.com',amount_ars:100}]});
 assert(rows.some(r=>r.email==='other@example.com'));assert(!rows.some(r=>['nadia.cavallini@gmail.com','matirandazzo@gmail.com','inactive@example.com'].includes(r.email)));
});
