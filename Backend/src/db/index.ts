import { pool, db } from "@workspace/db";
import * as schema from "./schema";

export { pool, db };
export * from "./schema";
export default db;
