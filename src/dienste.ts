import { Dienst } from '.prisma/client';
import dayjs from 'dayjs';
import { prisma } from './db';

export const getDiensteMap = async (byId = false) => {
	const dienste = await prisma.dienst.findMany();

	const diensteObj: Record<string, Dienst & { startsDayjs: dayjs.Dayjs, endsDayjs: dayjs.Dayjs }> = {};

	for (const dienst of dienste) {
		const id = byId ? dienst.id : dienst.shortName;
		diensteObj[id] = {
			...dienst,
			startsDayjs: dayjs(dienst.startsAt.toISOString().substring(0, 23)),
			endsDayjs: dayjs(dienst.endsAt.toISOString().substring(0, 23))
		};

	}

	return diensteObj;
}