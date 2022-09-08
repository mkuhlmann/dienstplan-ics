import { dirname } from '../util';
import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';


const plugin: FastifyPluginAsync = async (fastify, opts) => {

	fastify.get('/', async (request, reply) => {
		return reply.redirect('https://mkuhlmann.org');
	});

	fastify.get('/preview', async (request, reply) => {
		const file = fs.readFileSync(dirname(`views/preview.html`), 'utf-8');
		return reply.type('text/html; charset=utf-8').send(file);
	});

};

export default plugin;
