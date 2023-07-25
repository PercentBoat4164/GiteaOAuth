import {config} from "./config.js";
import {GiteaOAuthApp} from "./OAuthLib/GiteaOAuthApp.js";

GiteaOAuthApp.addAuthEndpoint('get', "/userinfo", (req, res, userinfo) => {
    res.send(userinfo);
});

GiteaOAuthApp.addEndpoint('get', '/', async (req, res) => {
    res.sendFile('./templates/index.html', {
        root: GiteaOAuthApp.__dirname,
    });
});

GiteaOAuthApp.addEndpoint('get', '/gitealogo', async (req, res) => {
    res.sendFile('./templates/img/gitea.svg', {
        root: GiteaOAuthApp.__dirname,
    });
});

GiteaOAuthApp.addEndpoint('get', "*", async (req, res) => {
    res.status(404).sendFile('./templates/404.html', {
        root: GiteaOAuthApp.__dirname,
    });
});

GiteaOAuthApp.baseApp.listen(config["PORT"], () => {
    console.log(`Started GiteaOAuth App on port ${config["PORT"]}`);
});