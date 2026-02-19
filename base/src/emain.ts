// also, some of this stuff was taken directly from
// Oracle's docs (which was apparently also machine-generated btw)

import * as path from "node:path";
import * as fs from "node:fs";
const astext_II = (x: string) => fs.readFileSync(path.normalize(x), { encoding: "utf8" });

import * as emaildataplane from "oci-emaildataplane";
import common = require("oci-common");
import * as models from "oci-emaildataplane/lib/model/index.js";

const provider : common.ConfigFileAuthenticationDetailsProvider = new common.ConfigFileAuthenticationDetailsProvider("./keys/config");
// Create a service client
const client = new emaildataplane.EmailDPClient({authenticationDetailsProvider: provider});

async function sendEmail(submitEmailDetails : models.SubmitEmailDetails) {
	try {

		const submitEmailRequest : emaildataplane.requests.SubmitEmailRequest = {
			submitEmailDetails: submitEmailDetails,
		};

		// Send request to the Client.
		const submitEmailResponse = await client.submitEmail(submitEmailRequest);
		return 0;
	}
	catch (error) {
		console.log("submitEmail Failed with error  " + error);
		return 1;
	}
}

export async function craft(addressee:string, token: string, what_kind: string){
	let bodyHtml = "";
	let subject = "";

	if (what_kind === 'pwrt') {
		bodyHtml = astext_II("html/emall_pwrt.html").replace("this is where we put the password reset token", token);
		subject = `Password reset for waluigi-servebeer.com`;
	} else if (what_kind === 'noob'){
		bodyHtml = astext_II("html/emall_adduser.html").replace("Reggie Fils-Aime", token);
		subject = `Register account for waluigi-servebeer.com`;
	} else {
		// you gotta give me something to work with here, man
		return 1;
	}

	const submitEmailDetails : models.SubmitEmailDetails = {
		sender: {
			senderAddress: {
				email: "noreply@waluigi-servebeer.com"
			},
			compartmentId: astext_II("./keys/compartment_id")
		},
		recipients: {
			to: [{
				email: addressee
			}]
		},
		subject,
		bodyHtml
	};
	const sig_ok = await sendEmail(submitEmailDetails);
	return sig_ok;
}

