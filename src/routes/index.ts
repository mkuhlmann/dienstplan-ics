import { dirname } from '../util';
import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';


const plugin: FastifyPluginAsync = async (fastify, opts) => {

	fastify.get('/', async (request, reply) => {
		return reply.redirect('https://mkuhlmann.org');
	});

};

export default plugin;
