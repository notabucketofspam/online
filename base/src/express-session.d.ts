import session from 'express-session';
declare module 'express-session' {
	interface SessionData {
		userId : number;
		username : string;
		email : string;
		storage : object;
		id : string;
	}
}
