import { prisma } from '../db';
import { FastifyPluginAsync } from 'fastify';
import { Dienst, Prisma } from '.prisma/client';

const plugin: FastifyPluginAsync = async (fastify, opts) => {
	fastify.get('/seed', async (request, reply) => {
		const dienste: Prisma.XOR<Prisma.DienstCreateInput, Prisma.DienstUncheckedCreateInput>[] = [
			{
				id: 'cl7tmarm3000253p0xlzmgvrg',
				shortName: 'TD',
				name: 'Tagdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T16:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmarmg000953p0s1xhjjj9',
				shortName: 'TD+SD',
				name: 'Tagdienst + Spätdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmarmx001653p0ome19eza',
				shortName: 'ZNA2',
				name: 'ZNA 2',
				startsAt: new Date('2021-01-01T10:30:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmarn4002353p0o0j9pbmb',
				shortName: 'ZNATW',
				name: 'ZNA Tagdienst Wochenende',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmaro9003053p0ak1wxttz',
				shortName: 'ZNAN',
				name: 'ZNA Nacht',
				startsAt: new Date('2021-01-01T20:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmaroj003753p01ja3x7vv',
				shortName: '1CT',
				name: '1C Tagdienst',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmaros004453p0fh6q08sj',
				shortName: '1CN',
				name: '1C Nachtdienst',
				startsAt: new Date('2021-01-01T20:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:30:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmarp8005153p0etorv13z',
				shortName: 'NEF1',
				name: 'NEF 1',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-02T08:00:00.000Z'),
				active: true,
			},
			{
				id: 'cl7tmarph005853p05c2j9msg',
				shortName: 'NEF2',
				name: 'NEF 2',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T20:30:00.000Z'),
				active: true,
			},
			{
				id: 'clespmlbb00000tpfctmwdc4k',
				shortName: 'EKG',
				name: 'Ruhe-EKG',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T16:30:00.000Z'),
				fullDay: true,
				active: true,
			},
			{
				id: 'clespmo6500010tpf7kkv215y',
				shortName: 'LZEKG',
				name: 'LZ-EKG',
				startsAt: new Date('2021-01-01T08:00:00.000Z'),
				endsAt: new Date('2021-01-01T16:30:00.000Z'),
				fullDay: true,
				active: true,
			},
		];

		let i = 0;
		for (const dienst of dienste) {
			if (await prisma.dienst.findUnique({ where: { id: dienst.id } })) continue;

			i++;
			await prisma.dienst.create({
				data: dienst,
			});
		}

		return `Seeded ${i} Dienste`;
	});
};

export default plugin;
