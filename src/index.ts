import fastify from 'fastify';
import fastifyAutoload from '@fastify/autoload';
import fastifyMultipart from '@fastify/multipart';
import * as dotenv from 'dotenv';

import path from 'path';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dotenv.config();


dayjs.extend(weekOfYear);
dayjs.extend(utc);
dayjs.extend(timezone);
// always use UTC, ffs
dayjs.tz.setDefault('UTC');
process.env.TZ = 'UTC';


const app = fastify({
});

app.register(fastifyMultipart);

app.register(fastifyAutoload, {
	dir: path.join(__dirname, 'routes'),
	dirNameRoutePrefix: false
});

app.listen({ host: '0.0.0.0', port: 9000 }, (err, address) => {
	if (err) {
		console.error(err)
		process.exit(1)
	}
	console.log(`🚀 Server ready at: ${address}`);
});

