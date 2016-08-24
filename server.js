var server = require("./server/server");
var oAuthGithub = require("./server/oauth-github");
var MongoClient = require("mongodb").MongoClient;

var port = process.env.PORT || 8080;
var dbUri = process.env.DB_URI || "mongodb://sample-user:Vq(Z9g^B-6hlt3Q<@ds029655.mlab.com:29655/chat-grad-project-steve";
var oauthClientId = process.env.OAUTH_CLIENT_ID || "9bc77c8e1b4aa6c7221e";
var oauthSecret = process.env.OAUTH_SECRET || "0f83b19254fc73b7c2e9f74adc7a1046bf481260";
var devMode = process.env.DEV_MODE || false;

var devUsers = [
    {
        login: "stephen-lt-sl",
        name: "Stephen Tozer",
        avatar_url: "http://avatar.url.com/u=test"
    },
    {
        login: "Melamoto",
        name: "Stevey T",
        avatar_url: "http://avatar.url.com/u=test"
    }
];
var devTokens = ["123123", "456456"];
var devCurrentUser = 0;
var devGithubAuthoriser = {
    authorise: function(req, authCallback) {
        authCallback(devUsers[devCurrentUser], devTokens[devCurrentUser]);
        devCurrentUser++;
    },
    oAuthUri: "/oauth"
};

MongoClient.connect(dbUri, function(err, db) {
    if (err) {
        console.log("Failed to connect to db", err);
        return;
    }
    var githubAuthoriser = devMode ? devGithubAuthoriser : oAuthGithub(oauthClientId, oauthSecret);
    server(port, db, githubAuthoriser);
    console.log("Server running on port " + port);
});
