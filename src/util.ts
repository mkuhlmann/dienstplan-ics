import path from 'path';
import crypto from 'crypto';



export const dirname = (..._path: string[]) => {
	return path.resolve(__dirname, '..', ..._path);
};

export const urlBase64Encode = (str: string) => {
	return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

export const urlBase64Decode = (str: string) => {
	return str.replace(/-/g, '+').replace(/_/g, '/');
};

export const hmac = (data: string) => {
	return urlBase64Encode(crypto.createHmac('sha1', process.env.SECRET_KEY ?? 'secret').update(data).digest('base64'));
}