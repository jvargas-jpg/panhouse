import 'dotenv/config';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Only local QA');
source.pathname = '/panhouse_seguimiento_qa';
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3004 });
