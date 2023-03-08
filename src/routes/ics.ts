import { prisma } from '../db';
import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { getDiensteMap } from '../dienste';
import dayjs from 'dayjs';
import { Dienstplan, Person } from '.prisma/client';
import path from 'path';
import fs from 'fs';
import { dirname, hmac } from '../util';
import { log } from '../log';

const plugin: FastifyPluginAsync = async (fastify, opts) => {
	fastify.get<{ Querystring: { name?: string; id?: string; hmac: string; scope?: string; fReminder?: string } }>('/ics', async (request, reply) => {
		let person: Person | null = null;

		if (request.query.id) {
			person = await prisma.person.findFirst({
				where: {
					id: request.query.id,
				},
			});
		} else if (request.query.name && request.query.name.length > 2) {
			person = await prisma.person.findFirst({
				where: {
					lastName: {
						contains: request.query.name,
					},
				},
			});
		}

		if (!request.query.scope || !['funktion', 'gesamt'].includes(request.query.scope)) {
			request.query.scope = 'gesamt';
		}

		let fReminder = null;
		if (request.query.fReminder) {
			// match fReminder to xx:xx
			let _fReminder = request.query.fReminder.match(/([0-9]{1,2}):([0-9]{1,2})/);
			if (_fReminder) {
				fReminder = `${_fReminder[1]}:${_fReminder[2]}`;
			}
		}

		if (!person) {
			reply.status(404);
			return 'Person not found';
		}

		if (request.query.hmac !== hmac(person.id)) {
			reply.status(403);
			return 'Invalid HMAC';
		}

		reply.header('Content-Type', 'text/calendar; charset=utf-8');
		reply.header('Content-Disposition', `attachment; filename="${person.lastName}_${request.query.scope}.ics"`);

		return await getIcs(person, request.query.scope === 'funktion', fReminder);
	});

	fastify.get<{ Querystring: { name: string; p?: string; scope?: string } }>('/json', async (request, reply) => {
		if (process.env.PREVIEW_PASSWORD && request.query.p !== process.env.PREVIEW_PASSWORD) {
			return reply.status(403).send({ error: 'Invalid password' });
		}

		if (!request.query.name || request.query.name.length < 2) {
			reply.code(400);
			return { error: 'Invalid name' };
		}

		if (!request.query.scope || !['funktion', 'gesamt'].includes(request.query.scope)) {
			request.query.scope = 'gesamt';
		}

		const person = await prisma.person.findFirst({
			where: {
				lastName: {
					contains: request.query.name,
				},
			},
		});

		if (!person) {
			reply.status(404);
			return { error: 'Person not found' };
		}

		let dienstplan: Dienstplan[] = [];

		if (request.query.scope === 'funktion')
			dienstplan = await prisma.dienstplan.findMany({
				where: {
					personId: person.id,
					dienst: {
						fullDay: true,
					},
				},
				orderBy: {
					startsAt: 'asc',
				},
			});
		else
			dienstplan = await prisma.dienstplan.findMany({
				where: {
					personId: person.id,
				},
				orderBy: {
					startsAt: 'asc',
				},
			});

		const dienste = await getDiensteMap(true);

		return {
			hmac: hmac(person.id),
			person: person,
			dienstplan: dienstplan.map((dienst) => ({
				...dienst,
				dienst: dienste[dienst.dienstId],
			})),
		};
	});
};

const getIcs = async (person: Person, onlyFunktion = false, fReminder: string | null = null) => {
	if (!fs.existsSync(dirname('data/cache'))) {
		fs.mkdirSync(dirname('data/cache'));
	}

	// fReminderHour and fReminderMinute
	let fReminderHour = 0;
	let fReminderMinute = 0;
	if (fReminder) {
		const _fReminder = fReminder.split(':');
		fReminderHour = parseInt(_fReminder[0]);
		fReminderMinute = parseInt(_fReminder[1]);
	}

	const cacheFile = `${person.id}_${onlyFunktion ? 'f' : 'a'}_${fReminder ?? 'noReminder'}.ics`;

	if (fs.existsSync(path.join(dirname('data/cache'), cacheFile))) {
		log.info('Using cached ics file for ' + person.lastName);
		return fs.readFileSync(path.join(dirname('data/cache'), cacheFile));
	}

	log.info('Generating ics file for ' + person.lastName);

	let dienstplan: Dienstplan[] = [];

	if (!onlyFunktion)
		dienstplan = await prisma.dienstplan.findMany({
			where: {
				personId: person.id,
			},
			orderBy: {
				startsAt: 'asc',
			},
		});
	else
		dienstplan = await prisma.dienstplan.findMany({
			where: {
				personId: person.id,
				dienst: {
					fullDay: true,
				},
			},
			orderBy: {
				startsAt: 'asc',
			},
		});

	const dienste = await getDiensteMap(true);

	let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//mkuhlmann/NONSGML Event Calendar//EN
NAME:MHE Dienstplan
DESCRIPTION:MHE Dienstplan für ${person.lastName}
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
END:VTIMEZONE`;

	for (const dienst of dienstplan) {
		ics += `
BEGIN:VEVENT
UID:${md5(person.id + dienst.startsAt.toString())}
`;

		if (dienste[dienst.dienstId].fullDay) {
			ics += `DTSTAMP:${dayjs().format('YYYYMMDDTHHmmss[Z]')}
DTSTART:${dayjs(dienst.startsAt).tz('UTC').format('YYYYMMDD')}
DTEND:${dayjs(dienst.startsAt).tz('UTC').format('YYYYMMDD')}
`;

			if (fReminder) {
				ics += `BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${dienste[dienst.dienstId].name}
TRIGGER;VALUE=DATE-TIME:${dayjs(dienst.startsAt).tz('Europe/Berlin', true).hour(fReminderHour).minute(fReminderMinute).second(0).tz('UTC').format('YYYYMMDDTHHmmss[Z]')}
END:VALARM
`;
			}
		} else {
			ics += `DTSTAMP:${dayjs().format('YYYYMMDDTHHmmss[Z]')}
DTSTART:${dayjs(dienst.startsAt).tz('UTC').format('YYYYMMDDTHHmmss[Z]')}
DTEND:${dayjs(dienst.endsAt).format('YYYYMMDDTHHmmss[Z]')}
`;
		}

		ics += `SUMMARY:${dienste[dienst.dienstId].name}${dienst.position ? ` (${dienst.position})` : ''}
END:VEVENT`;
	}

	ics += `
END:VCALENDAR`;

	ics = ics.replace(/\n/g, '\r\n');

	fs.writeFileSync(path.join(dirname('data/cache'), cacheFile), ics);

	return ics;
};

const md5 = (str: string) => {
	return crypto.createHash('md5').update(str).digest('hex');
};

export default plugin;
