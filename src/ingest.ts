import * as XLSX from 'xlsx';
import { CellPointer } from './CellPointer';
import { prisma } from './db';
import { getDiensteMap } from './dienste';
import dayjs from 'dayjs';
import fs from 'fs';
import { dirname, getWeekNumber } from './util';
import { Dienst, Person as DbPerson } from '@prisma/client';

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

const createDatabaseBackup = () => {
	if (!fs.existsSync(dirname('data', 'backups'))) {
		fs.mkdirSync(dirname('data', 'backups'));
	}

	fs.copyFileSync(dirname('data', 'database.db'), dirname('data', 'backups', `${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.db`));
};

// function to calculate levenstein distance
const levenshtein = (a: string, b: string): number => {
	// Create empty edit distance matrix for all possible modifications of
	// substrings of a to substrings of b.
	const distanceMatrix = Array(b.length + 1)
		.fill(null)
		.map(() => Array(a.length + 1).fill(null));

	// Fill the first row of the matrix.
	// If this is first row then we're transforming empty string to a.
	// In this case the number of transformations equals to size of a substring.
	for (let i = 0; i <= a.length; i += 1) {
		distanceMatrix[0][i] = i;
	}

	// Fill the first column of the matrix.
	// If this is first column then we're transforming empty string to b.
	// In this case the number of transformations equals to size of b substring.
	for (let j = 0; j <= b.length; j += 1) {
		distanceMatrix[j][0] = j;
	}

	for (let j = 1; j <= b.length; j += 1) {
		for (let i = 1; i <= a.length; i += 1) {
			const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
			distanceMatrix[j][i] = Math.min(
				distanceMatrix[j][i - 1] + 1, // deletion
				distanceMatrix[j - 1][i] + 1, // insertion
				distanceMatrix[j - 1][i - 1] + indicator // substitution
			);
		}
	}

	return distanceMatrix[b.length][a.length];
};

let _persons: DbPerson[] | null = null;
const getPersonByApproximateName = async (lastName: string) => {
	if (!_persons) {
		_persons = await prisma.person.findMany();
	}

	const distances = _persons.map((person) => {
		return {
			person,
			distance: levenshtein(person.lastName.toLowerCase(), lastName.toLowerCase()),
		};
	});

	const sortedDistances = distances.sort((a, b) => a.distance - b.distance);

	if (sortedDistances[0].distance > 2) {
		return null;
	}

	return sortedDistances[0].person;
};

let _log = '';
let _error = false;
const log = (message: string) => {
	console.log(message);
	_log += message + '\n';
};

export const ingestFunktion = async (fileName: string) => {
	_log = '';
	_error = false;

	log(`📥 Ingesting ${fileName}`);

	// create database backup
	log('📦 Creating database backup');

	createDatabaseBackup();

	let date: dayjs.Dayjs;

	let match = fileName.match(/\/F(\d{4})-(\d{2})\.xlsx$/);

	if (match) {
		date = dayjs(new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1, 12, 0, 0)).tz('Europe/Berlin');
	} else {
		throw new Error('Could not parse date from filename');
	}

	log(`📅 Assumed Date: ${date.format('MMMM YYYY')}`);

	const workbook = XLSX.readFile(fileName);

	const sheet = workbook.Sheets[workbook.SheetNames[0]];

	let cellPointer = new CellPointer(sheet);

	// increse cell pointer until contents matches dd.mm.yyyy
	while (!cellPointer.getString().match(/\d{1,2}\/\d{1,2}\/\d{2}/) && cellPointer.y < 100) {
		cellPointer.y++;
	}

	if (cellPointer.y >= 100) {
		log(`Could not find date in sheet`);
		_error = true;
		return;
	}

	// get date
	const diensteMap = await getDiensteMap();

	while (cellPointer.getString() != '') {
		const dateString = cellPointer.getString();
		const dateParsed = dayjs(dateString, 'MM/DD/YYYY').tz('Europe/Berlin');
		log(`📅 ${dateParsed.format('DD MMMM YYYY')}`);

		if (!dateParsed.isValid()) {
			log(`Could not parse date from cell ${cellPointer.x}${cellPointer.y}`);
			_error = true;
			return;
		}

		cellPointer.x++;
		await ingestFunktionRow(diensteMap['LZEKG'], cellPointer, dateParsed);
		cellPointer.x++;
		await ingestFunktionRow(diensteMap['EKG'], cellPointer, dateParsed);

		cellPointer.x--;
		cellPointer.x--;
		cellPointer.y++;
	}

	return _log;
};

const ingestFunktionRow = async (dienst: Dienst, cellPointer: CellPointer, date: dayjs.Dayjs) => {
	if (cellPointer.getString().trim() != '') {
		const person = await getPersonByApproximateName(cellPointer.getString());

		if (person) {
			const startsAt = date.startOf('day').toDate();
			const endsAt = date.endOf('day').toDate();

			if (!(await prisma.dienstplan.findFirst({ where: { startsAt, endsAt, dienstId: dienst.id, personId: person.id } }))) {
				log(`\t${dienst.name}: ${person.firstName} ${person.lastName} - add`);
				await prisma.dienstplan.create({
					data: {
						startsAt,
						endsAt,
						dienstId: dienst.id,
						personId: person.id,
					},
				});
			} else {
				log(`\t${dienst.name}: ${person.firstName} ${person.lastName} - skip`);
			}
		} else {
			log(`\t⚠️${dienst.name}: ${cellPointer.getString()} - not found`);
		}
	}
};

export const ingest = async (fileName: string) => {
	_log = '';
	_error = false;

	log(`📥 Ingesting ${fileName}`);

	// create database backup
	log('📦 Creating database backup');

	createDatabaseBackup();

	let date: dayjs.Dayjs;

	let match = fileName.match(/\/(\d{4})-(\d{2})\.xlsx$/);

	if (match) {
		date = dayjs(new Date(parseInt(match[1]), parseInt(match[2]) - 1, 1, 12, 0, 0)).tz('Europe/Berlin');
	} else {
		throw new Error('Could not parse date from filename');
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
};

const insertDatabase = async (date: dayjs.Dayjs, persons: Record<string, Person>, overview: Record<number, Record<string, string>>) => {
	const diensteMap = await getDiensteMap();

	log(`📤 Inserting persons into database`);
	for (const k in persons) {
		const person = persons[k];
		let dbPerson = await getPersonByApproximateName(person.lastName);

		if (!dbPerson) {
			dbPerson = await prisma.person.create({
				data: {
					firstName: person.firstName,
					lastName: person.lastName,
				},
			});

			log(`🧑‍⚕️ Created ${dbPerson.firstName} ${dbPerson.lastName} in database`);
		}

		const personDiensteCount = await prisma.dienstplan.count({
			where: {
				personId: dbPerson.id,
				startsAt: {
					gte: date.startOf('month').toDate(),
					lte: date.endOf('month').toDate(),
				},
			},
		});

		if (personDiensteCount > 0) {
			log(`🚨 ${dbPerson.firstName} ${dbPerson.lastName} already has dienste for ${date.format('MMMM YYYY')}, deleting ...`);
			await prisma.dienstplan.deleteMany({
				where: {
					personId: dbPerson.id,
					startsAt: {
						gte: date.startOf('month').toDate(),
						lte: date.endOf('month').toDate(),
					},
					dienst: {
						fullDay: false,
					},
				},
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
					position: week != null && overview[week] && overview[week][dbPerson.lastName] ? overview[week][dbPerson.lastName] : null,
				},
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
