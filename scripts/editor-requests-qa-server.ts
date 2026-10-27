/** Runs the real app against the existing isolated QA database. */
import 'dotenv/config';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Local QA only');
target.pathname = '/panhouse_editor_preview_20261026';
process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'development';
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3010 });
