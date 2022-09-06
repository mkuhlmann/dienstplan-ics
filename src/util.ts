import path from "path"



export const dirname = (..._path: string[]) => {
	return path.resolve(__dirname, '..', ..._path);
};