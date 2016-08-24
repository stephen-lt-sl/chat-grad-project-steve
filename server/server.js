var express = require("express");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");

module.exports = function(port, db, githubAuthoriser) {
    var app = express();

    app.use(express.static("public"));
    app.use(cookieParser());
    app.use(bodyParser.json());

    var users = db.collection("users");
    var conversations = db.collection("conversations");
    var sessions = {};

    app.get("/oauth", function(req, res) {
        githubAuthoriser.authorise(req, function(githubUser, token) {
            if (githubUser) {
                users.findOne({
                    _id: githubUser.login
                }, function(err, user) {
                    if (!user) {
                        // TODO: Wait for this operation to complete
                        users.insertOne({
                            _id: githubUser.login,
                            name: githubUser.name,
                            avatarUrl: githubUser.avatar_url
                        });
                    }
                    sessions[token] = {
                        user: githubUser.login
                    };
                    res.cookie("sessionToken", token);
                    res.header("Location", "/");
                    res.sendStatus(302);
                });
            }
            else {
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
        users.findOne({
            _id: req.session.user
        }, function(err, user) {
            if (!err) {
                res.json(user);
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/users", function(req, res) {
        users.find().toArray(function(err, docs) {
            if (!err) {
                res.json(docs.map(function(user) {
                    return {
                        id: user._id,
                        name: user.name,
                        avatarUrl: user.avatarUrl
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    // Produce the same ID for any pair of users, regardless of which is the sender
    function getConversationID(userAId, userBId) {
        return userAId < userBId ?
            userAId + "," + userBId :
            userBId + "," + userAId;
    }

    app.get("/api/conversations/:id", function(req, res) {
        var conversationID = getConversationID(req.session.user, req.params.id);
        conversations.findOne({
            _id: conversationID
        }, function(err, conversation) {
            if (!err) {
                if (conversation) {
                    var conversationData = {};
                    for (var key in conversation) {
                        if (key === "_id") {
                            conversationData.id = conversation._id;
                        } else {
                            conversationData[key] = conversation[key];
                        }
                    }
                    res.json(conversationData);
                }
                else {
                    res.sendStatus(404);
                }
            } else {
                res.sendStatus(500);
            }
        });
    });
    app.post("/api/conversations", function(req, res) {
        var conversationInfo = req.body;
        var recipientID = conversationInfo.recipient;
        var senderID = req.session.user;
        // Find both the sender and the recipient in the db
        users.findOne({
            _id: senderID
        }, function(err, sender) {
            if (!err && sender) {
                users.findOne({
                    _id: recipientID
                }, function(err, recipient) {
                    if (!err && recipient) {
                        var conversationID = getConversationID(senderID, recipientID);
                        var participants = [senderID, recipientID].sort();
                        conversations.insertOne({
                            _id: conversationID,
                            participants: participants
                        }, function(err, result) {
                            if (!err) {
                                res.json({
                                    id: conversationID,
                                    participants: participants
                                });
                            } else {
                                res.sendStatus(500);
                            }
                        });
                    } else {
                        res.sendStatus(500);
                    }
                });
            } else {
                res.sendStatus(500);
            }
        });
    });

    return app.listen(port);
};
