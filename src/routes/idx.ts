import { FastifyPluginAsync } from 'fastify';
import { ingest } from '../ingest';


const plugin: FastifyPluginAsync = async (fastify, opts) => {

	fastify.get('/', async (request, reply) => {
		return reply.redirect('https://mkuhlmann.org');
	});

};

export default plugin;
