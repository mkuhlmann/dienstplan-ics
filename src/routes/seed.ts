import { prisma } from '../db';
import { FastifyPluginAsync } from 'fastify';
import { Dienst, Prisma } from '.prisma/client';

const plugin: FastifyPluginAsync = async (fastify, opts) => {

	fastify.get('/seed', async (request, reply) => {

		const count = await prisma.dienst.count();

		if(count > 0) {
			return reply.code(400).send('Database is not empty');
		}

		const dienste: Prisma.XOR<Prisma.DienstCreateInput, Prisma.DienstUncheckedCreateInput>[] = [
			{
				shortName: 'TD',
				name: 'Tagdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T16:30:00.000Z'),
				active: true
			},
			{				
				shortName: 'TD+SD',
				name: 'Tagdienst + Spätdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true
			},
			{
				shortName: 'ZNA2',
				name: 'ZNA 2',
				startsAt: new Date('2021-01-01T10:30:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true
			},
			{
				shortName: 'ZNATW',
				name: 'ZNA Tagdienst Wochenende',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true
			},
			{
				shortName: 'ZNAN',
				name: 'ZNA Nacht',
				startsAt: new Date('2021-01-01T20:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:30:00.000Z'),
				active: true
			},
			{
				shortName: '1CT',
				name: '1C Tagdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true
			},
			{
				shortName: '1CN',
				name: '1C Nachtdienst',
				startsAt: new Date('2021-01-01T20:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:30:00.000Z'),
				active: true
			},
			{
				shortName: 'NEF1',
				name: 'NEF 1',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:00:00.000Z'),
				active: true
			},
			{
				shortName: 'NEF2',
				name: 'NEF 2',				
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true
			}
		];

		for (const dienst of dienste) {
			await prisma.dienst.create({
				data: dienst
			});
		}

		return 'Seeded database';
	});


}; 

export default plugin;