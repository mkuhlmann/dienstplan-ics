import fastify from 'fastify';
import fastifyAutoload from '@fastify/autoload';
import fastifyMultipart from '@fastify/multipart';
import fastifyFormbody from '@fastify/formbody';
import * as dotenv from 'dotenv';

import path from 'path';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { log } from './log';

dotenv.config();


dayjs.extend(weekOfYear);
dayjs.extend(utc);
dayjs.extend(timezone);
// always use UTC, ffs
dayjs.tz.setDefault('UTC');
process.env.TZ = 'UTC';


const app = fastify({
	trustProxy: true
});

app.addHook('onRequest', async (request, reply) => {
	log.info(`${request.ip} - ${request.method.padEnd(5)} ${request.url}`);
});

app.register(fastifyMultipart);
app.register(fastifyFormbody);

app.register(fastifyAutoload, {
	dir: path.join(__dirname, 'routes'),
	dirNameRoutePrefix: false
});

app.listen({ host: '0.0.0.0', port: 9000 }, (err, address) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}
	log.info(`🚀 Server ready at: ${address}`);
});

