import { createOpenApiDocument } from './src/app/docs/openapi';

const doc: any = createOpenApiDocument();
console.log('paths:', Object.keys(doc.paths).length);
console.log('schemas:', Object.keys(doc.components.schemas).length);
console.log('socket events count:', doc['x-socket-events'].events.length);
console.log(
    'has notification socket event:',
    doc['x-socket-events'].events.some((e: any) => e.name === 'notification')
);
const n = doc.paths['/notification/get-notifications'].get;
console.log('get-notifications x-roles:', n['x-roles']);
