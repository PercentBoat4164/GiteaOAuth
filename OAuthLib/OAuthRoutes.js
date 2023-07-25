import express from 'express';
import session from 'express-session';
import fetch from 'node-fetch';
import {config} from "../config.js";
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export const authEndpoint = `${config["GITEA_URL"]}/login/oauth/authorize`;
export const tokenEndpoint = `${config["GITEA_URL"]}/login/oauth/access_token`;
export const BaseOAuthApp = express();

// Use Sessions to Manage Users' Tokens
// Store Tokens for 30 Days; they must log in after that time has elapsed
BaseOAuthApp.use(session({
    secret: 'lknobinnpw87cyn87rthm98gvhw76ecgnr78hmv89tbmyh7nv',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30,
    }
}))

// The /auth endpoint forces users to Log in with Gitea before moving onto the desired location
BaseOAuthApp.get('/auth', (req, res) => {
    res.sendFile("./templates/auth.html", {
        root: __dirname,
    });
});

// gitea_oauth sends users to the login page using query above
// users will be sent to token_callback when permission is given
BaseOAuthApp.get('/gitea_oauth', (req, res) => {

    // Parameters necessary to send client to Gitea Login Page
    const GITEA_AUTH_PAGE_QUERY = new URLSearchParams({
        response_type: 'code',
        client_id: config["GITEA_CLIENT_ID"],
        redirect_uri: `${config["BASE_URL"]}/token_callback`,
    });

    // If login failed in some way and tokens are not present, send to Gitea login page
    if (!req.session.accessToken || !req.session.refreshToken) {
        res.redirect(`${authEndpoint}?${GITEA_AUTH_PAGE_QUERY}`);
        return;
    }

    // If a nextURI has been set, redirect to that and set it back to null
    if (req.session.nextURI) {
        res.redirect(req.session.nextURI);
        req.session.nextURI = null;
        return;
    }

    // Default Send back to Base Directory
    res.redirect("/");
})

// token_callback obtains access tokens from Gitea using the code that the login page sent using the callback
BaseOAuthApp.get('/token_callback', async (req, res) => {
    const { code } = req.query;

    // Request form parameters necessary to get Gitea access tokens
    const giteaTokenRequestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config["GITEA_CLIENT_ID"],
        client_secret: config["GITEA_CLIENT_SECRET"],
        redirect_uri: `${config["BASE_URL"]}/token_callback`,
    });

    // Request body crafted from form parameters
    const giteaTokenFetchOptions = {
        method: 'POST',
        body: giteaTokenRequestBody,
    }

    try {
        const response = await (await fetch(tokenEndpoint, giteaTokenFetchOptions)).json();

        let accessToken = response["access_token"];
        let refreshToken = response["refresh_token"];

        // If both tokens are not set in the response, something went wrong; refer back to oauth
        if (!accessToken || !refreshToken) {
            console.log(`Login failed due to error: ${response}`);
            return;
        }

        req.session.accessToken = accessToken;
        req.session.refreshToken = refreshToken;

        // If a nextURI has been set, redirect to that and set it back to null
        if (req.session.nextURI) {
            res.redirect(req.session.nextURI);
            req.session.nextURI = null;
            return;
        }

        // Default Send to base URL if no URI is set
        res.redirect("/");
    } catch (err) {
        res.send('There was a problem with retrieving Gitea Access token.');
    }
})