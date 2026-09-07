import { createServer } from 'node:http';

const users = {
  'mechanic@lightning.local': {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'mechanic@lightning.local',
    name: 'Alejandro 1',
    role: 'mechanic',
    active: true,
    pmAuthorized: false,
  },
  'manager@lightning.local': {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'manager@lightning.local',
    name: 'Shop Manager',
    role: 'manager',
    active: true,
    pmAuthorized: false,
  },
  'admin@lightning.local': {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'admin@lightning.local',
    name: 'Shop Administrator',
    role: 'admin',
    active: true,
    pmAuthorized: false,
  },
};

createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const email = request.headers.authorization?.replace(/^Bearer dev:/, '').toLowerCase();
  const user = email ? users[email] : undefined;
  if (!user) {
    json(response, 401, { message: 'Invalid fixture session' });
    return;
  }

  if (request.url === '/api/auth/me') {
    json(response, 200, { user });
    return;
  }
  if (request.url === '/api/admin/access') {
    json(
      response,
      user.role === 'manager' || user.role === 'admin' ? 200 : 403,
      user.role === 'manager' || user.role === 'admin'
        ? { user }
        : { message: 'You do not have access to Shop Admin.' },
    );
    return;
  }
  if (request.url === '/api/work-orders') {
    json(response, 200, { created: [], active: [], paused: [], completed: [] });
    return;
  }

  json(response, 404, { message: 'Fixture route not found' });
}).listen(3101, '127.0.0.1');

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}
