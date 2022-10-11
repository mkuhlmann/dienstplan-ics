import * as XLSX from 'xlsx';
import util, { InspectOptions } from 'node:util';
import { prisma } from './db';
import { getDiensteMap } from './dienste';
import dayjs from 'dayjs';
import fs from 'fs';
import { dirname, getWeekNumber } from './util';

class CellPointer {
	x: number;
	y: number;
	sheet: XLSX.WorkSheet;

	constructor(sheet: XLSX.WorkSheet, x: number = 0, y: number = 0) {
		this.x = x;
		this.y = y;
		this.sheet = sheet;
	}


	getCell() {
		const cell = this.sheet[XLSX.utils.encode_cell({ c: this.x, r: this.y })];
		return cell;
	}

	getString(): string {
		const cell = this.getCell();
		if (!cell) return '';
		return cell.w ? this.decodeString(cell.w) : '';
	}

	getNumber(): number {
		return this.getCell().v;
	}

	isInteger() {
		const cell = this.getCell();
		return cell && cell.v ? Number.isInteger(this.getCell().v) : false;
	}

	toString() {
		return XLSX.utils.encode_cell({ c: this.x, r: this.y });
	}

	clone() {
		return new CellPointer(this.sheet, this.x, this.y);
	}

	decodeString(s: string) {
		return s.replace('¸', 'ü').replace('ˆ', 'ö');
	}

	[util.inspect.custom]() {
		return `CellPointer(${this.toString()}) { ${this.getString()} }`;
	}

	static fromString(sheet: XLSX.WorkSheet, str: string) {
		const dec = XLSX.utils.decode_cell(str);
		return new CellPointer(sheet, dec.c, dec.r);
	}
}

class Day {
	day: number;
	schedule: string;

	constructor(day: number, schedule: string) {
		this.day = day;
		this.schedule = schedule;
	}
}

class Person {
	firstName: string;
	lastName: string;
	cell: string;

	days: Day[] = [];

	constructor(firstName: string, lastName: string, cell: string) {
		this.firstName = firstName;
		this.lastName = lastName;
		this.cell = cell;
	}

}

let _log = '';
let _error = false;
const log = (message: string) => {
	console.log(message);
	_log += message + '\n';
};

export const ingest = async (fileName: string) => {
	_log = '';
	_error = false;

	log(`📥 Ingesting ${fileName}`);

	let date: dayjs.Dayjs;

	let match = fileName.match(/\/(\d{4})-(\d{2})\.xlsx$/);

	if (match) {
		date = dayjs(new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1, 12, 0, 0)).tz('Europe/Berlin');
	} else {
		match = fileName.match(/^\/(\d{2})\.xlsx$/);
		if (match) {
			date = dayjs(new Date(dayjs().year(), parseInt(match[1]) - 1, 1, 12, 0, 0)).startOf('month').tz('Europe/Berlin');
		} else {
			throw new Error('Could not parse date from filename');
		}
	}



	log(`📅 Assumed Date: ${date.format('MMMM YYYY')}`);


	const workbook = XLSX.readFile(fileName);

	const sheet = workbook.Sheets[workbook.SheetNames[0]];

	let cellPotiner = new CellPointer(sheet);

	let persons: Record<string, Person> = {};

	// table 1
	persons = findAndParseTable(cellPotiner, persons);

	if (!_error) {
		// table 2
		persons = findAndParseTable(cellPotiner, persons);
	}

	const overview = findAndParseOverviewTable(cellPotiner);


	if (!_error) {
		await insertDatabase(date, persons, overview);
		deleteCache();
	}
	return _log;
};

const deleteCache = () => {
	fs.rmSync(dirname('data', 'cache'), { recursive: true, force: true });
}

const insertDatabase = async (date: dayjs.Dayjs, persons: Record<string, Person>, overview: Record<number, Record<string, string>>) => {

	const diensteMap = await getDiensteMap();


	log(`📤 Inserting persons into database`);
	for (const k in persons) {
		const person = persons[k];
		let dbPerson = await prisma.person.findFirst({
			where: {
				lastName: person.lastName
			}
		});

		if (!dbPerson) {
			dbPerson = await prisma.person.create({
				data: {
					firstName: person.firstName,
					lastName: person.lastName,
				}
			});


			log(`🧑‍⚕️ Created ${dbPerson.firstName} ${dbPerson.lastName} in database`);
		}

		const personDiensteCount = await prisma.dienstplan.count({
			where: {
				personId: dbPerson.id,
				startsAt: {
					gte: date.startOf('month').toDate(),
					lte: date.endOf('month').toDate()
				}
			}
		});

		if (personDiensteCount > 0) {
			log(`🚨 ${dbPerson.firstName} ${dbPerson.lastName} already has dienste for ${date.format('MMMM YYYY')}, deleting ...`);
			await prisma.dienstplan.deleteMany({
				where: {
					personId: dbPerson.id,
					startsAt: {
						gte: date.startOf('month').toDate(),
						lte: date.endOf('month').toDate()
					}
				}
			});
		}

		let i = 0;
		for (const day of person.days) {
			let dienstName = day.schedule;

			// freie Tage
			if (['ez', 'bv', 'frei', 'fw', 'url', 'fb', 'feiertag'].includes(day.schedule.toLowerCase())) {
				continue;
			}

			if (dienstName.startsWith('1CT') || dienstName.startsWith('TD1C')) {
				dienstName = '1CT';
			}

			if (dienstName.startsWith('ZNAT')) {
				dienstName = 'ZNATW';
			}

			const dienst = diensteMap[dienstName];
			if (!dienst) {
				log(`🚨 Dienst ${day.schedule} not found`);
				continue;
			}


			let startsAt = date.set('date', day.day).startOf('day').add(dienst.startsDayjs.get('hour'), 'hour').add(dienst.startsDayjs.get('minute'), 'minute');
			let endsAt = date.set('date', day.day).startOf('day').add(dienst.endsDayjs.get('hour'), 'hour').add(dienst.endsDayjs.get('minute'), 'minute');

			if (startsAt.isAfter(endsAt) || startsAt.isSame(endsAt)) {
				endsAt = endsAt.add(1, 'day');
			}

			let week = 0;

			// only include overview for TD
			if (dienstName == 'TD' || dienstName == 'TD+SD') {
				week = getWeekNumber(startsAt.toDate());
			}

			// and 1CN/ZNAN
			// if(dienstName == '1CN' || dienstName == 'ZNAN') {
			// 	week = getWeekNumber(startsAt.set('hour', 8).toDate());

			// 	//handle edge case when starting on a sunday
			// 	if(getWeekNumber(startsAt.set('hour', 8).add(1, 'day').toDate()) > week) {
			// 		week++;
			// 	}
			// }

			i++;
			await prisma.dienstplan.create({
				data: {
					personId: dbPerson.id,
					dienstId: dienst.id,
					startsAt: startsAt.toDate(),
					endsAt: endsAt.toDate(),
					position: (overview[week] && overview[week][dbPerson.lastName]) ? overview[week][dbPerson.lastName] : null
				}
			});
		}

		log(`📅 Inserted ${i} dienste for ${dbPerson.firstName} ${dbPerson.lastName}`);
	}

};

const findAndParseTable = (cellPointer: CellPointer, persons: Record<string, Person>) => {
	log(`🔎 Looking for table starting at ${cellPointer}`);
	let initialY = cellPointer.y;
	// search for Name, Vorname
	while (cellPointer.getString().toLowerCase().indexOf('name') === -1 && cellPointer.y - initialY < 50) {
		cellPointer.y++;
	}

	if (cellPointer.y - initialY >= 50) {
		log(`⚠️ Could not find table`);
		_error = true;
		return persons;
	}

	const startCell = cellPointer.clone();

	log(`✅ Found table starting at ${startCell}`);
	cellPointer.y++;

	initialY = cellPointer.y;
	// continue till first name
	while (cellPointer.getString().toLowerCase().indexOf(',') === -1 && cellPointer.y - initialY < 10) {
		cellPointer.y++;
	}

	if (cellPointer.y - initialY >= 10) {
		log(`⚠️ Could not find names`);
		_error = true;
		return persons;
	}

	while (cellPointer.getString().toLowerCase().indexOf(',') !== -1 && cellPointer.getString().toLowerCase().indexOf('name') === -1) {
		const name = cellPointer.getString().split(',');
		let person = new Person(name[1].trim(), name[0].trim(), cellPointer.toString());
		if (persons[person.lastName]) {
			person = persons[person.lastName];
			persons[person.lastName].cell = cellPointer.toString();
		} else {
			persons[person.lastName] = person;
		}
		cellPointer.y++;
	}

	log(`🧑‍⚕️ Found ${Object.keys(persons).length} persons until ${cellPointer}`);

	// find first day
	cellPointer = startCell;

	log(`🔎 Looking for first day starting at ${cellPointer}`);
	while (!cellPointer.isInteger()) {
		cellPointer.x++;
	}

	log(`✅ Found first day starting at ${cellPointer}`);

	let j = 0;
	let i = 0;
	while (cellPointer.isInteger() && cellPointer.x < 100) {

		i++;
		for (const k in persons) {

			const personCell = CellPointer.fromString(cellPointer.sheet, persons[k].cell);
			personCell.x = cellPointer.x;
			j++;
			const day = new Day(cellPointer.getNumber(), personCell.getString());
			persons[k].days.push(day);
		}

		cellPointer.x++;
		while (!cellPointer.isInteger() && cellPointer.x < 100) {
			cellPointer.x++;
		}

	}

	log(`📅 Processed ${i} days / ${j} schedules`);

	return persons;

};

const findAndParseOverviewTable = (cellPointer: CellPointer) => {
	const overview: Record<number, Record<string, string>> = {};

	log(`🔎 Looking for overview table starting at ${cellPointer}`);

	let initialY = cellPointer.y;


	// search for Name, Vorname
	while (cellPointer.getString() != 'KW' && cellPointer.y - initialY < 100) {

		// sometimes table is intended by one cell
		cellPointer.x++;
		if (cellPointer.getString() == 'KW') {
			break;
		}
		cellPointer.x--;

		cellPointer.y++;

	}

	if (cellPointer.y - initialY >= 100) {
		log(`⚠️ Could not find overview table, last cell was ${cellPointer}`);
		return overview;
	}


	log(`✅ Found overview table starting at ${cellPointer}`);

	const dienstNameStartCell = cellPointer.clone();
	initialY = dienstNameStartCell.y;

	while (dienstNameStartCell.getString() != '1CN-1' && dienstNameStartCell.y - initialY < 4) {
		dienstNameStartCell.y++;
	}

	if (dienstNameStartCell.y - initialY >= 4) {
		log(`⚠️ Could not find dienst names in overview table`);
		return overview;
	}

	log(`🔎 Looking for first KW starting at ${cellPointer}`);
	while (!cellPointer.isInteger()) {
		cellPointer.x++;
	}

	while (cellPointer.isInteger()) {
		const week = cellPointer.getNumber();

		const personCell = cellPointer.clone();
		personCell.y = dienstNameStartCell.y;

		const dienstNameCell = dienstNameStartCell.clone();

		while (dienstNameCell.getString() != '1C TSA') {
			const dienstName = dienstNameCell.getString();
			const person = personCell.getString();

			if (person.trim()) {
				if (!overview[week]) {
					overview[week] = {};
				}

				overview[week][person] = dienstName;
			}

			dienstNameCell.y++;
			personCell.y++;
		}


		cellPointer.x++;
		while (!cellPointer.isInteger() && cellPointer.x < 100) {
			cellPointer.x++;
		}
	}

	log(`📅 Processed ${Object.keys(overview).length} weeks`);


	return overview;



};