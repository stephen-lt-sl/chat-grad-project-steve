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

    var users = db.collection("users");
    var conversations = db.collection("conversations");
    var messages = db.collection("messages");
    var notifications = db.collection("notifications");
    var groups = db.collection("groups");
    var sessions = {};

    app.get("/oauth", function(req, res) {
        githubAuthoriser.authorise(req, function(githubUser, token) {
            if (githubUser) {
                users.find({
                    _id: githubUser.login
                }).limit(1).next().then(function(user) {
                    // Adds the user to the DB if they do not exist
                    // On resolution, returns the user as they appear in the DB
                    if (!user) {
                        return users.insertOne({
                            _id: githubUser.login,
                            name: githubUser.name,
                            avatarUrl: githubUser.avatar_url
                        }).then(function(result) {
                            return result.ops[0];
                        });
                    }
                    return user;
                }).then(function(user) {
                    // Creates a session for the user and redirects the client to the correct page
                    sessions[token] = {
                        user: githubUser.login
                    };
                    res.cookie("sessionToken", token);
                    res.header("Location", "/");
                    res.sendStatus(302);
                });
            } else {
                res.sendStatus(400);
            }
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
        users.find({
            _id: req.session.user
        }).limit(1).next().then(function(user) {
            res.json(user);
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.get("/api/users", function(req, res) {
        users.find().toArray().then(function(docs) {
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    addConversationsAPI(app, db, "/api");
    addMessagesAPI(app, db, "/api");
    addNotificationsAPI(app, db, "/api");
    addGroupsAPI(app, db, "/api");

    return app.listen(port);
};
