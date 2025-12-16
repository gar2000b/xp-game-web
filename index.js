const fastify = require('fastify')({ logger: true });
const path = require('path');

var userName = "Gary Black";

// Register static file serving
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

fastify.get('/welcome', async (request, reply) => {
  const message = `Hello World ${userName}`;
  console.log(message);
  return { message: message };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Server listening on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();