import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { ingest } from '../ingest';
import util from 'util';
import { dirname } from '../util';
import { MultipartValue } from '@fastify/multipart';
import { prisma } from '../db';

const pump = util.promisify(pipeline);


const plugin: FastifyPluginAsync = async (fastify, opts) => {

	fastify.get('/ingest', async (request, reply) => {
		// read file
		let html = fs.readFileSync(path.join(__dirname, '../../views/ingest.html'), 'utf8');

		// replace placeholders

		// send response
		return reply.type('text/html').send(html);

	});

	fastify.post('/ingest', async (request, reply) => {
		const file = await request.file();

		if (!file) {
			return reply.code(400).send('No file uploaded');
		}

		if (!file.fields.password || (file.fields.password as any as MultipartValue<string>).value !== process.env.INGEST_PASSWORD) {
			return reply.code(401).send('Invalid password');
		}


		if (!file.filename.match(/\d{4}?-\d{2}\.xlsx/)) {
			return reply.code(400).send('Invalid filename');
		}

		const upath = dirname('data', file.filename);
		await pump(file.file, fs.createWriteStream(upath));

		let _log = await ingest(upath);

		return reply.type('text/html; charset=utf-8').send(`<pre>${_log}</pre>`);
	});

	fastify.post<{
		Body: {
			password: string;
		}
	}>('/reingest', async (request, reply) => {

		if (request.body.password !== process.env.INGEST_PASSWORD) {
			return reply.code(401).send('Invalid password');
		}

		await prisma.dienstplan.deleteMany();

		// get all files ending with .xlsx
		let files = fs.readdirSync(dirname('data')).filter(f => f.match(/\d{4}?-\d{2}\.xlsx/));

		let _log = '';

		for (let file of files) {
			_log += '---------------------------- Reingesting ' + file + '\n';
			_log += await ingest(dirname('data', file));
		}

		return reply.type('text/html; charset=utf-8').send(`<pre>${_log}</pre>`);

	});

};

export default plugin;
