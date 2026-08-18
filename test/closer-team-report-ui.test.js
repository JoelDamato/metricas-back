const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const containerHtml = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mag-reporte-closers-2026.html'), 'utf8');
const teamHtml = fs.readFileSync(path.join(root, 'public/metricas-v2/views/mag-reporte-equipo.html'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/mag-reporte-closers.page.js'), 'utf8');
const apiScript = fs.readFileSync(path.join(root, 'public/metricas-v2/js/api/metricas.api.js'), 'utf8');
const access = require('../modules/auth/access');

test('Reporte Closers incorpora una pestaña independiente para el informe IA del equipo', () => {
  assert.match(containerHtml, /data-tab="team-ai">Reporte IA del Equipo/);
  assert.match(containerHtml, /id="teamReportFrame"/);
  assert.match(containerHtml, /src="\/views\/mag-reporte-equipo\.html\?embed=1"/);
  assert.match(pageScript, /syncEmbeddedReportMonths/);
  assert.match(pageScript, /teamReportFrame/);
});

test('el reporte de equipo permite generar, recuperar e imprimir el informe mensual', () => {
  assert.match(teamHtml, /id="teamReportMonth"/);
  assert.match(teamHtml, /id="generateTeamReport"/);
  assert.match(teamHtml, /Lectura por integrante dentro del equipo/);
  assert.match(teamHtml, /window\.metricasApi\.generateCloserTeamReport/);
  assert.match(teamHtml, /window\.metricasApi\.fetchCloserTeamReport/);
  assert.match(teamHtml, /window\.print\(\)/);
  assert.match(apiScript, /\/api\/metricas\/closers\/team-report/);
  assert.equal(access.canAccessPageForUser({ email: 'closer@example.com', role: 'comercial' }, 'mag-reporte-equipo.html'), true);
});
