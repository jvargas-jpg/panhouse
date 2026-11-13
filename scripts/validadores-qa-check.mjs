/** Run against scripts/validadores-qa-server.ts only. All identities are fixtures. */
const origin = 'http://127.0.0.1:3015';
const check = (value, message) => { if (!value) throw Error(message); };
async function request(path, cookie, method = 'GET', body) {
 const r = await fetch(origin + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 const data = await r.json(); return { status: r.status, data, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
const { data: context } = await request('/__qa/context');
const sessions = {};
for (const role of ['ana', 'especialista', 'jefatura']) {
 const result = await request('/api/auth/login', null, 'POST', { email: `${role}@validadores.qa.test`, password: 'password123' });
 check(result.status === 200, `Login ${role}`); sessions[role] = result;
}
const call = async (role, path, method = 'GET', body) => {
 const r = await request('/api' + path, sessions[role].cookie, method, body); check(r.status === 200, `${role} ${method} ${path}: ${r.status} ${r.data.error ?? ''}`); return r.data;
};
const manage = () => call('especialista', `/validaciones/?project=${context.projectId}`);
let id = (await manage()).items[0].id;
async function assign() {
 await call('especialista', `/validaciones/${id}/solicitar`, 'POST');
 await call('jefatura', `/validaciones/${id}/asignar`, 'POST', { validatorId: sessions.ana.data.user.id });
}
const detail = () => call('ana', `/validaciones/${id}`);
async function changes(version) {
 const d = await detail();
 const uploaded = await call('ana', `/validaciones/${id}/archivo`, 'POST', { name: 'comentarios libro FINAL 3.pdf', contentBase64: Buffer.from('%PDF-1.7\nQA reviewed file\n%%EOF').toString('base64'), key: crypto.randomUUID() });
 check(uploaded.name.startsWith(`V${version}_`) && uploaded.name.endsWith('.pdf') && uploaded.folderKey === 'QUALITY_COMMENTS', 'Canonical upload and correct folder');
 await call('ana', `/validaciones/${id}/decision`, 'POST', { result: 'comentarios', assignmentId: d.assignmentId, key: crypto.randomUUID(), comments: 4 });
 check((await manage()).items[0].status === 'Esperando nueva versión de Diseño', 'Waiting for external Design');
 const sent = await request('/__qa/mail', null, 'POST'); check(sent.data.recipients.length === 1, 'External notice queued and delivered to simulated sink');
}
async function receive(version) {
 const received = await request(`/__qa/design/${version}`, null, 'POST'); check(received.data.received === 1, 'Drive delivery detected exactly once');
 id = (await call('ana', '/validaciones/')).items[0].id;
 const d = await detail(); check(d.canApprove && d.materials.some(m => m.role === 'previous_comments'), 'New version and previous comments available');
 await call('ana', `/validaciones/${id}/iniciar`, 'POST');
}
async function approve() {
 const d = await detail(); check(!d.upload, 'Positive close does not require a new upload');
 await call('ana', `/validaciones/${id}/decision`, 'POST', { result: 'todos_aplicados', assignmentId: d.assignmentId, key: crypto.randomUUID() });
}
await assign();
check(!(await detail()).canApprove, 'V0 positive decision must be blocked');
const blocked = await request(`/api/validaciones/${id}/decision`, sessions.ana.cookie, 'POST', { result: 'comentarios', assignmentId: (await detail()).assignmentId, key: crypto.randomUUID() }); check(blocked.status === 409, 'No comments without uploaded file');
await call('ana', `/validaciones/${id}/iniciar`, 'POST');
await changes(0); await receive(1); await changes(1); await receive(2); await approve();
const initial = id;
for (const action of ['enviar_autor', 'aprobar_autor', 'revision_final']) await call('especialista', `/calidad/${initial}/coordinacion`, 'PATCH', { accion: action });
id = (await manage()).items[0].id; await assign(); check(!(await detail()).canApprove, 'Final review cannot reuse previous process comments');
await changes(2); await receive(3); await changes(3); await receive(4); await approve();
const timeline = await call('especialista', `/validaciones/timeline/${context.projectId}`);
check(timeline.items.filter(e => e.action === 'VALIDACION_TODOS_APLICADOS').length === 2, 'Both processes closed with complete timeline');
check((await call('ana', '/validaciones/')).items.length === 0, 'Completed assignments leave pending work');
console.log(JSON.stringify({ result: 'PASS', cycles: ['Calidad V0→V1→V2', 'Revisión Final V2→V3→V4'], events: timeline.items.length, drive: 'simulated', externalMail: 'simulated', transport: 'real HTTP and PostgreSQL' }, null, 2));
