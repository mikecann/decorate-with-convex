import schema from "./schema";
import { typedV } from "convex-helpers/validators";

// You could export this from your schema file, or define it where you need it.
export const vv = typedV(schema);
