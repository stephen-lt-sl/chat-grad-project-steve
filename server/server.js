/*global Promise */

var express = require("express");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var mongo = require("mongodb");

var addConversationsAPI = require("./conversations");
var addMessagesAPI = require("./messages");
var addGroupsAPI = require("./groups");
var addNotificationsAPI = require("./notifications");

module.exports = function(port, db, githubAuthoriser) {
    var app = express();

    app.use(express.static("public"));
    app.use(cookieParser());
    app.use(bodyParser.json());

    var dbActions = require("./dbActions")(db);

    var sessions = {};

    app.get("/oauth", function(req, res) {
        githubAuthoriser.authorise(req, function(githubUser, token) {
            if (!githubUser) {
                res.sendStatus(400);
                return;
            }
            dbActions.findAndValidateUser(githubUser.login).catch(function(errorCode) {
                if (errorCode === 404) {
                    return dbActions.createUser({
                        _id: githubUser.login,
                        name: githubUser.name,
                        avatarUrl: githubUser.avatar_url
                    });
                }
                return Promise.reject(errorCode);
            }).then(function(user) {
                // Creates a session for the user and redirects the client to the correct page
                sessions[token] = {
                    user: githubUser.login
                };
                res.cookie("sessionToken", token);
                res.header("Location", "/");
                res.sendStatus(302);
            }).catch(function(errorCode) {
                res.sendStatus(errorCode);
            });
        });
    });

    app.get("/api/oauth/uri", function(req, res) {
        res.json({
            uri: githubAuthoriser.oAuthUri
        });
    });

    app.use(function(req, res, next) {
        if (req.cookies.sessionToken) {
            req.session = sessions[req.cookies.sessionToken];
            if (req.session) {
                next();
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(401);
        }
    });

    app.get("/api/user", function(req, res) {
        dbActions.findAndValidateUser(req.session.user).then(function(user) {
            res.json(user);
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.get("/api/users", function(req, res) {
        dbActions.findUsers().then(function(docs) {
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    addConversationsAPI(app, dbActions, "/api");
    addMessagesAPI(app, dbActions, "/api");
    addNotificationsAPI(app, dbActions, "/api");
    addGroupsAPI(app, dbActions, "/api");

    return app.listen(port);
};
