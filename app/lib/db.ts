import { Pool } from "pg";

export const db = new Pool({
  user: process.env.USER_POSTGRES,
  password: process.env.PASSWORD_POSTGRES,
  host: process.env.HOST,
  port: 5432,
  database: process.env.DB_NAME,
})