import { dirname } from '../util';
import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';

const plugin: FastifyPluginAsync = async (fastify, opts) => {
	fastify.get('/', async (request, reply) => {
		let file = fs.readFileSync(dirname(`views/index.html`), 'utf-8');
		return reply.type('text/html; charset=utf-8').send(file);
	});

	fastify.get<{ Querystring: { p: string } }>('/preview', async (request, reply) => {
		if (process.env.PREVIEW_PASSWORD && request.query.p !== process.env.PREVIEW_PASSWORD) {
			return reply.status(403).send('Invalid password');
		}

		let file = fs.readFileSync(dirname(`views/preview.html`), 'utf-8');

		// file = file
		// 	.replace('%BASEURL%', `${request.protocol}://${request.hostname}`);

		return reply.type('text/html; charset=utf-8').send(file);
	});
};

export default plugin;
