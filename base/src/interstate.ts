import path from "node:path";
import {Router, static as serve_static, Request, Response} from "express";
import {SessionData} from "express-session";
import {isAuthenticated, GIVE_UP} from "./dmv/annapolis";

const router = Router({mergeParams: true});

function give_index_html(req: Request, res: Response) {
  try {
    const the_index = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <link rel="stylesheet" type="text/css" href="/css/great-scott.css" />
          <meta name="viewport" content="width=device-width, user-scalable=yes" />
          <title>Goobo Jr. - waluigi-servebeer.com</title>
        </head>
        <body>
          <h1>Goobo Jr.</h1>
          <div id="goobo-root"></div>
          <script src="/js/everything.js"></script>
          <script src="/api/goobo/detroit.js" type="module"></script>
        </body>
      </html>
    `;
    res.status(200).send(the_index);
  } catch (err) {
		GIVE_UP(res, "couldnt give html");
  }
}

router.use("/", serve_static(path.join(__dirname, "goobo")));
router.get("/", give_index_html);

export default router;

