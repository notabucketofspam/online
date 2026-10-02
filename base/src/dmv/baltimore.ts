import {Router} from "express";
import {SessionData} from "express-session";
import {isAuthenticated} from "./annapolis.ts";

import rt_guild from "./guild.ts";
import rt_channel from "./channel.ts";
import rt_message from "./message.ts";
import rt_authn from "./authn.ts";

const router = Router({mergeParams: true});

router.use(isAuthenticated);

router.use("/guild", rt_guild);
router.use("/channel", rt_channel);
router.use("/message", rt_message);
router.use("/authn", rt_authn);

export {router as rt_baltimore};


