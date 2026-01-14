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
const body_html = astext_II("./html_p/pw_email.html");
export async function password_reset(addressee: string, token: string) {
	const this_body = body_html.replace("this is where we put the password reset token", token);

	// Create a request and dependent object(s).
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
		subject: `Password reset for waluigi-servebeer.com`,
		bodyHtml: this_body,
	};
	const sig_ok = await sendEmail(submitEmailDetails);
	return sig_ok;
}

