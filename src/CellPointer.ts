import * as XLSX from 'xlsx';
import util, { InspectOptions } from 'node:util';

export class CellPointer {
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
