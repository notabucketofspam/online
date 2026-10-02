import { Router } from "express";
import { rt_banquet } from "./banquet.ts";
import { rt_banquet_NEO } from "./banquet-neo.ts";

const router = Router();

router.use("/banquet", rt_banquet);
router.use("/banquet_neo", rt_banquet_NEO);

export {
	router as rt_cdi
};
