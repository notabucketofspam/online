import {Router} from "express";
import {SessionData} from "express-session";
import {isAuthenticated} from "./annapolis";

import rt_guild from "./guild";
import rt_channel from "./channel";
import rt_message from "./message";

const router = Router({mergeParams: true});

router.use(isAuthenticated);

router.use("/guild", rt_guild);
router.use("/channel", rt_channel);
router.use("/message", rt_message);

export default router;


