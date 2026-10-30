// One-time, syntax-aware visual migration. No API, queries or business mutations.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
if (!process.argv.includes('--apply')) {
  console.log('One-time migration already applied. Inspect this script before explicitly using --apply.');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const ts = require('typescript');
const postcss = require('../frontend/node_modules/postcss');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const all = files('frontend/src');
const changes = [];
for (const file of all.filter(f => f.endsWith('.tsx') && !f.includes('design-system') && !f.endsWith('.test.tsx'))) {
  let source = fs.readFileSync(file, 'utf8');
  const root = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function walk(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const name = opening.tagName.getText(root);
      const attributes = opening.attributes.properties;
      const className = attributes.find(a => a.name?.getText(root) === 'className')?.initializer?.text;
      const mobile = attributes.some(a => a.name?.getText(root) === 'mobile' && !a.initializer);
      const compact = name === 'TopBar' && attributes.some(a => a.name?.getText(root) === 'compacto');
      if (['ec-topbar', 'coh-topbar', 'se-topbar', 'sd-topbar', 'cl-account-bar', 'cc-global-bar'].includes(className)
        || compact || /MobileNavigation$/.test(name) || mobile && /Nav|Sidebar/.test(name)) {
        const inExpression = !ts.isJsxElement(node.parent) && !ts.isJsxFragment(node.parent);
        edits.push({ start: node.getStart(root), end: node.end, text: inExpression ? 'null' : '' });
        return;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(root);
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  // Remove now-unused imports without touching other imports or application logic.
  if (edits.length) {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const importEdits = [];
    for (const node of parsed.statements.filter(ts.isImportDeclaration)) {
      const named = node.importClause?.namedBindings;
      if (!named || !ts.isNamedImports(named)) continue;
      const remainder = source.slice(0, node.getStart(parsed)) + source.slice(node.end);
      const kept = named.elements.filter(e => new RegExp('\\b' + e.name.text + '\\b').test(remainder));
      if (kept.length === named.elements.length) continue;
      const text = kept.length ? node.getText(parsed).replace(named.getText(parsed), '{ ' + kept.map(e => e.getText(parsed)).join(', ') + ' }') : '';
      importEdits.push({ start: node.getStart(parsed), end: node.end, text });
    }
    for (const edit of importEdits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    fs.writeFileSync(file, source); changes.push(file);
  }
}

// Map existing palette declarations to semantic tokens, retaining layout rules.
const neutral = {
  '#fff':'--ph-surface','#ffffff':'--ph-surface', '#fafafa':'--ph-bg','#fafbfc':'--ph-bg','#f8f9fa':'--ph-bg','#f7f8fa':'--ph-bg','#f5f7fa':'--ph-bg','#f7f8f8':'--ph-bg','#faf8f3':'--ph-bg','#fcfbf9':'--ph-surface',
  '#edf0f2':'--ph-line-soft','#edf0f3':'--ph-line-soft','#edf0f4':'--ph-line-soft','#edf0f5':'--ph-line-soft','#eef0f3':'--ph-line-soft','#eef0f2':'--ph-line-soft','#eef1f5':'--ph-line-soft',
  '#e4e7eb':'--ph-line','#e5e9ed':'--ph-line','#e5e7eb':'--ph-line','#e9edf1':'--ph-line','#dce0e5':'--ph-line','#dce3eb':'--ph-line','#dce3ec':'--ph-line','#e3e7ed':'--ph-line','#e4e8eb':'--ph-line',
  '#182335':'--ph-ink','#0c1833':'--ph-ink','#172b43':'--ph-ink','#0d2340':'--ph-ink','#142b46':'--ph-ink','#172e41':'--ph-ink','#101c3b':'--ph-ink',
  '#536587':'--ph-muted','#687587':'--ph-muted','#748096':'--ph-muted','#6c7d93':'--ph-muted','#60708b':'--ph-muted','#728292':'--ph-muted','#64748b':'--ph-muted',
  '#8490a5':'--ph-subtle','#9aa5b1':'--ph-subtle','#8395b1':'--ph-subtle','#8592a3':'--ph-subtle','#8090a4':'--ph-subtle',
  '#0c2030':'--ph-navy','#092432':'--ph-navy', '#fffaf0':'--ph-gold-soft',
};
const oldChrome = /(?:^|[\s,.])\.(?:ad-sidebar|ad-brand|ad-topbar|ad-frame|ad-menu-button|ad-mobile-navigation|ad-sidebar-label|ec-topbar|coh-topbar|se-topbar|sd-topbar|cl-account-bar|eo-sidebar-footer|ec-sidebar-footer|cl-sidebar-footer|coh-footer|se-footer|sd-footer|ec-mobile-nav|eo-mobile-nav|coh-mobile-nav|se-mobile-nav|sd-mobile-nav|cl-mobile-nav|jf-mobile-nav|rp-mobile-nav|ec-nav|coh-nav|se-nav|sd-nav|cl-nav|jf-nav|eo-account-menu|jp-account|jp-avatar)(?=[\s>.:#\[]|$)/;
let removedRules = 0, tokenDeclarations = 0, fonts = 0;
for (const file of all.filter(f => f.endsWith('.css') && !f.includes('design-system') && !f.endsWith('index.css'))) {
  const source = fs.readFileSync(file, 'utf8');
  const root = postcss.parse(source, { from: file });
  root.walkRules(rule => {
    if (oldChrome.test(rule.selector) || /(?:editor-layout|corrector-layout|soporte-editorial-layout|soporte-digital-layout)\s*>\s*aside/.test(rule.selector)) { rule.remove(); removedRules++; return; }
    rule.walkDecls(decl => {
      if (decl.prop === 'font-family') { decl.value = 'var(--ph-font)'; fonts++; }
      if (decl.prop === 'font' && /serif|Segoe|Arial/i.test(decl.value)) {
        decl.value = decl.value.replace(/(?:Georgia|['"]?Segoe UI['"]?|Arial|['"]Times New Roman['"]|sans-serif|serif).*$/i, 'var(--ph-font)'); fonts++;
      }
      if (/^--.*-(navy|ink|muted|gold|line|bg)$/.test(decl.prop)) {
        const suffix = decl.prop.split('-').at(-1), map = { navy:'navy', ink:'ink', muted:'muted', gold:'gold-text', line:'line', bg:'bg' };
        decl.value = `var(--ph-${map[suffix]})`; tokenDeclarations++;
      } else {
        decl.value = decl.value.replace(/#[a-f\d]{3,8}\b/gi, c => { const token = neutral[c.toLowerCase()]; if (!token) return c; tokenDeclarations++;return `var(${token})`; });
      }
    });
    if (/(?:^|[\s>])h1(?=[\s,.:[\]]|$)/.test(rule.selector)) {
      rule.nodes.filter(n => n.type === 'decl' && ['font','font-family','font-size','font-weight','letter-spacing','line-height'].includes(n.prop)).forEach(n => n.remove());
      rule.append({ prop:'font', value:'700 var(--ph-page-title)/1.3 var(--ph-font)' }, { prop:'letter-spacing', value:'-.025em' }, { prop:'color',value:'var(--ph-ink)' });
    }
    if (rule.selector === '.admin-shell') rule.nodes.filter(n => n.type === 'decl' && ['height','display','overflow','width'].includes(n.prop)).forEach(n => n.remove());
    if (rule.selector === '.ad-main') rule.nodes.filter(n => n.type === 'decl' && ['flex','min-height','overflow-y','overflow-x'].includes(n.prop)).forEach(n => n.remove());
  });
  root.walkAtRules('media', rule => { if (!rule.nodes?.length) rule.remove(); });
  const output = root.toString();
  if (source !== output) { fs.writeFileSync(file, output); changes.push(file); }
}
console.log(JSON.stringify({ changed: changes, removedRules, tokenDeclarations, fonts }, null, 2));
