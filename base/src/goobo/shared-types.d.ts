/**a snowflake is 53b*/
export type Snowflake = number;

/**I cant remember if oracle returns a Date object or just a unix timestamp*/
export type Timestamp = Date | number;

/**a row of data from the CHANNELS table*/
export interface ChannelRow {
  /**53b snowflake*/
  id: Snowflake;
  /**also a 53b snowflake*/
  guild_id: Snowflake;
  /**as you know him*/
  name: string;
  /**what are you?*/
  channel_type: string;
  /**when? */
  created_at: Timestamp;
}

export interface GuildRow {
	id: Snowflake;
	name: string;
  /**the user ids arent snowflakes because i made a small mistake lol*/
	owner_id: number;
	created_at: Timestamp;
}

export interface MessageRow {
  id: Snowflake;
	channel_id: Snowflake;
	user_id: number;
	content: string;
	created_at: Timestamp;
}

export interface GuildMemberRow {
	guild_id: Snowflake;
	user_id: number;
	joined_at: Timestamp;
}

/**this one is kind of a mess, and is made from a lot of technological grout*/
export interface UserRow {
  /**yes, the underscore is missing*/
  userid:number;
	username: string;
	passwordhash: string;
	email: string;
	registrationdate: Timestamp;
	salt: string;
	/**it's a json object*/
	storage: object;
	/**also a json object, but somehow more heinous*/
	pkeys: object;
}
