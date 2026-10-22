const test=require('node:test'),assert=require('node:assert/strict');
const {appointmentTimestamp}=require('../modules/ghl/appointment-time');
const {buildDiscordMessages}=require('../modules/ghl/appointment-discord.service');
test('15:00 sin zona en GHL representa 15:00 Argentina y no 12:00',()=>{
 for(const value of ['2026-10-22T15:00:00','2026-10-22 15:00','2026-10-22T15:00:00-03:00','2026-10-22T18:00:00Z'])
 assert.equal(appointmentTimestamp(value),Date.parse('2026-10-22T18:00:00Z'));
 assert.equal(appointmentTimestamp('2026-10-22T15:00:00Z'),Date.parse('2026-10-22T15:00:00Z'));
});
test('respeta zona configurada, cambio de día y milisegundos',()=>{
 assert.equal(appointmentTimestamp('2026-10-22T23:30:00.125'),Date.parse('2026-10-23T02:30:00.125Z'));
 assert.equal(appointmentTimestamp('2026-07-22T15:00:00','America/New_York'),Date.parse('2026-07-22T19:00:00Z'));
 assert.equal(appointmentTimestamp('2026-01-22T15:00:00','America/New_York'),Date.parse('2026-01-22T20:00:00Z'));
});
test('notificación muestra hora de la cuenta explícita sin depender de la zona del lector',()=>{
 const [message]=buildDiscordMessages({appointment:{startTime:'2026-10-22 15:00',contactId:'test',calendarId:'test'},config:{ghlLocationId:'test'},answers:[]});
 const field=message.embeds[0].fields.find(f=>f.name==='Fecha de la cita');
 assert.match(field.value,/15:00/);assert.match(field.value,/hora Argentina/);
 assert.ok(field.value.includes(`<t:${Date.parse('2026-10-22T18:00:00Z')/1000}:R>`));
});
