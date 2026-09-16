import { Router } from "express";
import { rt_banquet } from "./banquet";

const router = Router();

router.use("/banquet", rt_banquet);

export {
	router as rt_cdi
};
