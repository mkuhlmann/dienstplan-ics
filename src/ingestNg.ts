import * as XLSX from 'xlsx';
import util, { InspectOptions } from 'node:util';

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


	const workbook = XLSX.readFile(fileName);

	const sheet = workbook.Sheets[workbook.SheetNames[0]];

	let cellPointer = new CellPointer(sheet, 0, 0);

	while (findAndParseTable(cellPointer) && !_error) {
		cellPointer.y++;
	}
};

const findAndParseTable = (cellPointer: CellPointer) => {
	log(`🔎 Looking for table starting at ${cellPointer}`);

	cellPointer.x = 1;
	let initialY = cellPointer.y;

	const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

	while (!months.includes(cellPointer.getString()) && cellPointer.y - initialY < 20) {
		cellPointer.y++;
	}

	if (cellPointer.y - initialY >= 20) {
		log(`⚠️ Could not find table`);
		_error = true;
		return false;
	}

	const startCell = cellPointer.clone();
	log(`✅ Found table starting at ${startCell}`);

	parseTable(startCell);



	return true;

};


const parseTable = (cellPointer: CellPointer) => {
	log(`📄 Parsing table starting at ${cellPointer}`);

	let row = 0;

	do {
		row++;
		cellPointer.y++;
	} while (!cellPointer.getString().includes('Dienst'));

	log(`✅ Parsed ${row} rows`);
};
