const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const access = require('../modules/auth/access');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/metricas-v2/dashboard.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/metricas-v2/js/views/dashboard.page.js'), 'utf8');
const loginScript = fs.readFileSync(path.join(root, 'public/metricas-v2/js/auth/login.page.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public/metricas-v2/css/styles.css'), 'utf8');
const authShell = fs.readFileSync(path.join(root, 'public/metricas-v2/js/auth-shell.js'), 'utf8');

test('el dashboard usa tabla de ventas y no muestra Clientes activos', () => {
  assert.match(html, /Ventas del ranking/);
  assert.match(html, /dashboardRankingTable/);
  assert.doesNotMatch(`${html}\n${script}`, /Clientes activos/i);
  assert.doesNotMatch(html, /<canvas/i);
});

test('el dashboard usa el mismo universo que el ranking real y excluye a Nahuel', () => {
  assert.match(script, /EXCLUDED_RANKING_CLOSERS = \['nahuel', 'shirlet', 'shirley'\]/);
  assert.match(script, /const hasRankingData =/);
  assert.match(script, /hasRankingData\(row\) && !isExcludedRankingCloser\(row\.closer\)/);
  assert.match(script, /const rankingRows = getRealRankingRows/);
  assert.match(script, /const previousRankingRows = getRealRankingRows/);
});

test('el dashboard personaliza saludo, métricas y fila del usuario', () => {
  assert.match(script, /Bienvenido, \$\{firstName\}/);
  assert.match(script, /is-current-user/);
  assert.match(script, /fetchMyCommercialArea/);
  assert.match(script, /Tu comisión calculada/);
  assert.match(styles, /\.dashboard-ranking-table tbody tr\.is-current-user/);
  assert.match(script, /dashboard-kpi-link/);
  assert.match(script, /\/views\/area-comercial\.html\?mes=/);
  assert.match(script, /Detalle privado por comprobante/);
});

test('el dashboard suma contexto mensual, comparaciones e insight sin objetivos', () => {
  assert.match(html, /id="dashboardGreeting"/);
  assert.match(html, /id="dashboardHeadlineSummary"/);
  assert.match(html, /id="dashboardMonthlyInsight"/);
  assert.match(html, /id="dashboardInsightText"/);
  assert.match(script, /function getGreeting/);
  assert.match(script, /function buildComparison/);
  assert.match(script, /fetchMyCommercialArea\(previousPeriod\.key\)/);
  assert.match(script, /vs \$\{previousMonthName\}/);
  assert.match(script, /ventas y tu cash collected es de/);
  assert.match(script, /function renderMonthlyInsight/);
  const hero = html.match(/<section class="dashboard-personal-hero">[\s\S]*?<\/section>/)?.[0] || '';
  assert.doesNotMatch(hero, /objetivo/i);
});

test('el dashboard incorpora animaciones sutiles y respeta movimiento reducido', () => {
  assert.match(script, /function animateKpiCounters/);
  assert.match(script, /const duration = 1800/);
  assert.match(script, /Math\.max\(0, Math\.min\(1,/);
  assert.match(script, /refs\.welcomeLoader\.hidden = true;\s+startDashboardEffects\(\)/);
  assert.match(script, /function startDashboardEffects/);
  assert.match(script, /classList\.add\('dashboard-effects-ready'\)/);
  assert.match(script, /data-count-value/);
  assert.match(styles, /@keyframes dashboardCardIn/);
  assert.match(styles, /@keyframes dashboardBarGrow/);
  assert.match(styles, /@keyframes dashboardChartGrow/);
  assert.match(styles, /from \{ transform: scaleY\(0\)/);
  assert.match(script, /--club-bar-order:\$\{item\.month - 1\}/);
  assert.match(styles, /animation-delay: calc\(120ms \+ var\(--club-bar-order, 0\) \* 65ms\)/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*dashboard-kpi/);
  assert.match(styles, /dashboard-personal-panel:hover/);
  assert.match(styles, /not\(\.dashboard-effects-ready\)[\s\S]*animation: none/);
});

test('Nahuel ve métricas propias y la evolución mensual de ventas Club', () => {
  assert.match(script, /personal\?\.summary\?\.facturacionUsd/);
  assert.match(script, /personal\?\.summary\?\.cashUsd/);
  assert.match(script, /personal\?\.summary\?\.salesCount/);
  assert.match(script, /isNahuelUser/);
  assert.match(script, /renderClubSalesChart/);
  assert.match(script, /Ventas Club mes a mes/);
  assert.match(script, /personal\?\.clubMonthly/);
  assert.doesNotMatch(script, /fetchRows\('setters'/);
  assert.match(script, /Ver comprobantes Club/);
  assert.match(script, /mis-comprobantes\.html\?mes=/);
  assert.doesNotMatch(script, /Ver detalle de setting/);
  assert.match(styles, /\.dashboard-club-chart/);
});

test('muestra una bienvenida personalizada mientras termina de cargar el panel', () => {
  assert.match(html, /id="dashboardWelcomeLoader"/);
  assert.doesNotMatch(html, /id="dashboardWelcomeLoader"[^>]*hidden/);
  assert.match(html, /Bienvenido a tu panel\./);
  assert.match(script, /`Bienvenido, \$\{firstName\}, a tu panel\.`/);
  assert.match(script, /const requests = await Promise\.allSettled/);
  assert.match(script, /closeWelcomeLoader\(\);/);
  assert.match(script, /closeWelcomeLoader\(\{ hasError: true \}\);/);
  assert.match(script, /welcomeLoaderReadyToClose = true/);
  assert.match(script, /\['finished', 'unavailable', 'silent', 'blocked', 'idle'\]\.includes\(welcomeSpeechState\)/);
  assert.match(script, /welcomeSpeechState === 'silent' \? 350 : 1200/);
  assert.doesNotMatch(script, /minimumVisibleTime = 3200/);
  assert.match(styles, /\.dashboard-welcome-loader-backdrop/);
  assert.match(styles, /@keyframes dashboardWelcomeProgress/);
});

test('reproduce una bienvenida personalizada con voz masculina seria mientras el popup está visible', () => {
  assert.match(html, /id="dashboardWelcomeSound"/);
  assert.match(html, /Escuchar bienvenida/);
  assert.match(script, /`Bienvenido, \$\{personalizedName\}, a la Central Matías Randazzo\.`/);
  assert.match(script, /utterance\.lang = 'es-AR'/);
  assert.match(script, /utterance\.rate = 0\.87/);
  assert.match(script, /utterance\.pitch = 0\.72/);
  assert.match(script, /const MALE_VOICE_TOKENS/);
  assert.match(script, /maleMatch \? 100 : 0/);
  assert.match(script, /utterance\.voice = chooseWelcomeVoice\(voices\)/);
  assert.match(script, /utterance\.onstart/);
  assert.match(script, /utterance\.onend = \(\) => \{[\s\S]*finishWelcomeLoaderWhenReady\(\)/);
  assert.match(script, /utterance\.onerror/);
  assert.match(script, /synth\.speak\(utterance\)/);
  assert.match(script, /addEventListener\?\.\('voiceschanged'/);
  assert.match(script, /speakWelcome\(\{ force: true \}\)/);
  assert.match(script, /setWelcomeSoundState\('blocked', 'Escuchar bienvenida'\)/);
  assert.match(loginScript, /sessionStorage\.setItem\(LOGIN_WELCOME_STORAGE_KEY, '1'\)/);
  assert.match(script, /const shouldPlayLoginWelcome = sessionStorage\.getItem\(LOGIN_WELCOME_STORAGE_KEY\) === '1'/);
  assert.match(script, /sessionStorage\.removeItem\(LOGIN_WELCOME_STORAGE_KEY\)/);
  assert.match(script, /if \(shouldPlayLoginWelcome\) speakWelcome\(\{ firstName \}\)/);
  assert.match(script, /let welcomeSpeechState = shouldPlayLoginWelcome \? 'idle' : 'silent'/);
  assert.match(script, /else if \(refs\.welcomeSound\) \{\s+refs\.welcomeSound\.hidden = true/);
  assert.match(script, /if \(refs\.welcomeLoader\) refs\.welcomeLoader\.hidden = false/);
  assert.match(styles, /\.dashboard-welcome-sound\[data-state='blocked'\]/);
});

test('los accesos rápidos conservan permisos por rol y configuración individual', () => {
  assert.match(script, /item\.roles\.includes\(user\.role\)/);
  assert.match(script, /permissions\.allowedPages\.includes\(item\.page\)/);
  assert.match(script, /canAccessAdministration/);
  assert.match(script, /canManageUsers/);
  [
    'Central de Métricas', 'Mi Área Comercial', 'Ranking de Ventas', 'Mis Comprobantes',
    'Cargar Comprobante', 'Alertas Operativas', 'Reportes Comerciales', 'Sistema de Agendas',
    'CSM por Tiempo', 'CSM por Estado', 'Rendimiento CSM', 'Diagnóstico', 'Herramientas', 'Estado de Contacto',
    'Instructivos', 'Grabaciones', 'PDI'
  ].forEach((label) => assert.match(script, new RegExp(label)));
  assert.match(script, /page: 'estado-contacto-comisiones\.html'/);
  assert.match(script, /href: '\/contacto-estado\/'/);
  assert.doesNotMatch(script, /href: '\/views\/estado-contacto-comisiones\.html'/);
  assert.doesNotMatch(script, /featuredPages = new Set\([^\n]*estado-contacto-comisiones/);
  assert.match(script, /page: 'pdi\.html'[^\n]*permission: 'canAccessPdi'/);
});

test('Central y comprobantes tienen jerarquía visual dentro del dashboard', () => {
  assert.match(script, /featuredPages = new Set\(\['metricas\.html', 'carga-comprobantes\.html', 'instructivos-externos', 'tickets\.html'\]\)/);
  assert.match(script, /dashboard-quick-featured-card-\$\{cardVariant\}/);
  assert.match(script, /dashboard-quick-card-emphasis/);
  assert.match(styles, /\.dashboard-quick-featured-grid/);
  assert.match(styles, /\.dashboard-quick-compact-grid/);
  assert.match(styles, /\.dashboard-quick-featured-card-primary/);
  assert.match(styles, /\.dashboard-quick-featured-card-action/);
});

test('los instructivos aparecen en una card grande y abren el recurso externo en otra pestaña', () => {
  assert.match(script, /href: 'https:\/\/central\.scalo\.tech\/clientes\/matias-randazzo\/instructivos'/);
  assert.match(script, /page: 'instructivos-externos'/);
  assert.match(script, /external: true/);
  assert.match(script, /target="_blank" rel="noopener noreferrer"/);
  assert.match(script, /isInstructions \? 'resource' : 'action'/);
  assert.match(script, /Abrir instructivos/);
  assert.match(styles, /\.dashboard-quick-featured-card-resource \{/);
  assert.match(styles, /\.dashboard-quick-featured-grid \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles.match(/\.dashboard-quick-featured-card-resource \{[\s\S]*?\}/)?.[0] || '', /grid-column/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*dashboard-quick-featured-grid[\s\S]*grid-template-columns: 1fr/);
});

test('Navegación no repite las páginas que ya están dentro de la Central', () => {
  assert.match(html, /<h2>Navegación<\/h2>/);
  assert.doesNotMatch(html, /Accesos rápidos/);
  assert.match(script, /const CENTRAL_LINKED_PAGES = new Set/);
  assert.match(script, /item\.page === 'metricas\.html' \|\| !CENTRAL_LINKED_PAGES\.has\(item\.page\)/);
  [
    'ranking.html', 'mag-sistema-agendas.html', 'reportes.html', 'alertas-operativas.html',
    'setting.html', 'marketing.html', 'herramientas.html', 'csm-tiempo.html', 'csm-situacion.html'
  ].forEach((page) => assert.match(script, new RegExp(`'${page.replace('.', '\\.')}'`)));
});

test('Diagnóstico y Rendimiento CSM quedan en el Dashboard y respetan el acceso CSM individual', () => {
  const centralPages = script.match(/const CENTRAL_LINKED_PAGES = new Set\(\[[\s\S]*?\]\);/)?.[0] || '';
  assert.doesNotMatch(centralPages, /csm-rendimiento\.html/);
  assert.doesNotMatch(centralPages, /diagnostico\.html/);
  assert.match(script, /page: 'csm-rendimiento\.html'[^\n]*roles: \['total', 'csm'\]/);
  assert.match(script, /page: 'diagnostico\.html'[^\n]*roles: \['total', 'csm'\]/);
  assert.match(script, /permissions\.allowedPages\.includes\(item\.page\)/);
});

test('el dashboard común no amplía los permisos particulares del CSM', () => {
  const sofia = { email: 'sofiangallardod@gmail.com', role: 'csm' };
  const permissions = access.getUserPermissions(sofia);

  assert.equal(access.canAccessPageForUser(sofia, 'dashboard.html'), true);
  assert.equal(permissions.allowedPages.includes('dashboard.html'), true);
  assert.equal(access.canAccessPageForUser(sofia, 'ranking.html'), false);
  assert.equal(access.canAccessResourceForUser(sofia, 'ranking_closers_mensual'), false);
  assert.equal(access.canAccessPageForUser(sofia, 'administracion.html'), false);
  assert.equal(access.canAccessPageForUser(sofia, 'csm-rendimiento.html'), true);
  assert.equal(access.canAccessPageForUser(sofia, 'diagnostico.html'), true);
  assert.equal(permissions.allowedPages.includes('csm-rendimiento.html'), true);
  assert.equal(permissions.allowedPages.includes('diagnostico.html'), true);

  const comercial = { email: 'comercial@example.com', role: 'comercial' };
  assert.equal(access.canAccessPageForUser(comercial, 'csm-rendimiento.html'), false);
  assert.equal(access.canAccessPageForUser(comercial, 'diagnostico.html'), false);
});

test('Nahuel puede abrir Estado de Contacto desde la navegación compacta', () => {
  const nahuel = {
    email: 'iascinahuel@gmail.com',
    role: 'comercial',
    access_config: {
      useCustomAccess: true,
      allowedPages: ['dashboard.html', 'metricas.html', 'mis-comprobantes.html'],
      allowedResources: ['comprobantes'],
      allowedFeatures: { views: ['GET'] }
    }
  };
  assert.equal(access.canAccessPageForUser(nahuel, 'estado-contacto-comisiones.html'), true);
  assert.equal(access.canAccessPageForUser(nahuel, 'area-comercial.html'), true);
  assert.equal(access.canAccessFeatureForUser(nahuel, 'commercial_area', { method: 'GET' }), true);
  assert.equal(access.getUserPermissions(nahuel).allowedPages.includes('estado-contacto-comisiones.html'), true);
});

test('el shell consulta comentarios solo si el usuario puede leerlos', () => {
  assert.match(authShell, /const canReadReportComments =/);
  assert.match(authShell, /!onlyMarketingAccess && canReadReportComments/);
});
