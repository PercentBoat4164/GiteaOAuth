import fetch from "node-fetch";
import {config} from "../config.js";
import {BaseOAuthApp, tokenEndpoint, authEndpoint, __dirname} from "./OAuthRoutes.js";

export class GiteaOAuthApp {
    static baseApp = BaseOAuthApp;
    static authEndpoint = authEndpoint;
    static __dirname = __dirname;

    static getGiteaAPIData = async (giteaAPIEndpoint, session, performTokenRefresh = true) => {
        if (!session.accessToken || !session.refreshToken) {
            return null;
        }

        const completeAPIPath = `${config["GITEA_URL"]}/api/v1${giteaAPIEndpoint}`;

        // Authorization headers
        let giteaAPIHeaders = {
            headers: {
                Authorization: `token ${session.accessToken}`
            },
            json: true,
        }

        try {
            let response = await fetch(completeAPIPath, giteaAPIHeaders);

            if (response.status === 200) {
                return await response.json();
            }

            if (!performTokenRefresh) {
                return null;
            }

            // Attempts to Refresh Access Token and try again if status is not OK
            let tokenRefreshed = await this.refreshSessionAccessToken(session);

            // If token could not be refreshed, return null
            if (!tokenRefreshed) {
                return null;
            }

            // If token was successfully refreshed, recursively attempt function call again
            return await this.getGiteaAPIData(giteaAPIEndpoint, session, false);
        } catch (err) {
            console.log(`Error Encountered during Gitea API Request: ${err}`);
            return null;
        }
    }

    // Refreshes OAuth Access Tokens (will return 1 if refreshed and 0 if they were not or cannot be refreshed
    static refreshSessionAccessToken = async (session) => {
        if (!session.refreshToken || !session.accessToken) {
            return false;
        }

        //Form Parameters Needed to Refresh Access Tokens
        const refreshTokenRequestBody = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken,
            client_id: config["GITEA_CLIENT_ID"],
            client_secret: config["GITEA_CLIENT_SECRET"],
        });

        // Request Body for refreshing Access Tokens based on Form Parameters
        const refreshTokenRequestHeaders = {
            method: 'POST',
            body: refreshTokenRequestBody,
        }

        try {
            const response = await (await fetch(tokenEndpoint, refreshTokenRequestHeaders)).json();

            let accessToken = response["access_token"];
            let refreshToken = response["refresh_token"];

            // If access token is not set, return 0 (should always return new access token)
            if (!accessToken) {
                return false;
            }

            session.accessToken = accessToken;

            if (refreshToken) {
                session.refreshToken = refreshToken;
            }

            return true;
        } catch (err) {
            console.log(`Error while refreshing access token: ${err}`);
            return false;
        }
    }

    // Sets Return URI that will be redirected after Gitea Authentication is complete
    static setReturnURI = (req, URI) => {
        req.session.nextURI = URI;
    }

    // Adds an Authenticated Get Endpoint to the App
    // User must be logged into Gitea to access it (and will be redirected accordingly)
    static addAuthEndpoint(method, endpoint, callback) {
        const wrapped_callback = async (req, res) => {
            if (!req.session || !req.session.accessToken || !req.session.refreshToken) {
                this.setReturnURI(req, endpoint);
                res.redirect('/auth');
                return;
            }

            const apidata = await GiteaOAuthApp.getGiteaAPIData('/user', req.session);

            if (!apidata) {
                this.setReturnURI(req, endpoint);
                res.redirect('/auth');
                return;
            }

            callback(req, res, apidata);
        }

        this.addEndpoint(method, endpoint, (req, res) => (wrapped_callback(req, res)));
    }

    static addEndpoint(method, endpoint, callback) {
        switch (method.toLowerCase()) {
            case "get":
                this.baseApp.get(endpoint, (req, res) => (callback(req, res)));
                break;
            case "post":
                this.baseApp.post(endpoint, (req, res) => (callback(req, res)));
                break;
            case "put":
                this.baseApp.post(endpoint, (req, res) => (callback(req, res)));
                break;
            case "delete":
                this.baseApp.delete(endpoint, (req, res) => (callback(req, res)));
                break;
            case "patch":
                this.baseApp.patch(endpoint, (req, res) => (callback(req, res)));
                break;
            default:
                throw `The HTTP Method Specified ${method} did not Match a Common Type.
                Either use baseApp to manually use less common methods or search for typos in HTTP method names.`;
        }
    }
}