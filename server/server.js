/*global Promise */

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
    var messages = db.collection("messages");
    var notifications = db.collection("notifications");
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
            res.json(docs.map(cleanIdField));
        }).catch(function(err) {
            res.sendStatus(500);
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
        conversations.find({
            _id: conversationID
        }).limit(1).next().then(function(conversation) {
            if (conversation) {
                res.json(cleanIdField(conversation));
            } else {
                res.sendStatus(404);
            }
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.post("/api/conversations", function(req, res) {
        var conversationInfo = req.body;
        var recipientID = conversationInfo.recipient;
        var senderID = req.session.user;
        // Find both the sender and the recipient in the db
        users.find({
            _id: senderID
        }).limit(1).next().then(function(sender) {
            if (!sender) {
                return Promise.reject(false);
            }
            return users.find({
                _id: recipientID
            }).limit(1).next();
        }).then(function(recipient) {
            if (!recipient) {
                return Promise.reject(false);
            }
            var conversationID = getConversationID(senderID, recipientID);
            var participants = [senderID, recipientID].sort();
            return conversations.insertOne({
                _id: conversationID,
                participants: participants
            });
        }).then(function(result) {
            res.json(cleanIdField(result.ops[0]));
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    // Update the conversation timestamp
    function updateConversation(conversation, message) {
        conversations.updateOne({
            _id: conversation._id
        }, {
            $set: {lastTimestamp: message.timestamp}
        });
    }

    // Insert a "new_messages" notification for each participant, or if such a notification already exists then
    // increment the messageCount
    function addNewMessageNotification(conversation, message) {
        conversation.participants.forEach(function(participant) {
            notifications.updateOne({
                userID: participant,
                type: "new_messages",
                "data.conversationID": conversation._id
            }, {
                $set: {
                    userID: participant,
                    type: "new_messages",
                    "data.conversationID": conversation._id,
                    "data.since": message.timestamp,
                    "data.otherID": conversation.participants.filter(function(otherParticipant) {
                        return otherParticipant !== participant;
                    })[0]
                },
                $inc: {
                    "data.messageCount": 1
                }
            }, {
                upsert: true
            });
        });
    }

    app.post("/api/messages", function(req, res) {
        var senderID = req.session.user;
        var conversationID = req.body.conversationID;
        var contents = req.body.contents;
        if (contents === "") {
            res.sendStatus(201);
            return;
        }
        conversations.find({
            _id: conversationID
        }).limit(1).next().then(function(conversation) {
            if (!conversation) {
                return Promise.reject(false);
            }
            if (conversation.participants.indexOf(senderID) !== -1) {
                var timestamp = new Date();
                messages.insertOne({
                    senderID: senderID,
                    conversationID: conversationID,
                    contents: contents,
                    timestamp: timestamp
                }).then(function(result) {
                    var message = result.ops[0];
                    updateConversation(conversation, message);
                    addNewMessageNotification(conversation, message);
                    res.json(cleanIdField(message));
                }).catch(function(err) {
                    res.sendStatus(500);
                });
            } else {
                res.sendStatus(403);
            }
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.get("/api/messages/:id", function(req, res) {
        var senderID = req.session.user;
        var conversationID = req.params.id;
        var lastTimestamp = req.query.timestamp;
        var countOnly = req.query.countOnly;
        conversations.find({
            _id: conversationID
        }).limit(1).next().then(function(conversation) {
            if (!conversation) {
                return Promise.reject(false);
            }
            if (conversation.participants.indexOf(senderID) !== -1) {
                var queryObject = {conversationID: conversationID};
                if (lastTimestamp) {
                    queryObject.timestamp = {$gt: new Date(lastTimestamp)};
                }
                if (countOnly) {
                    return messages.count(queryObject).then(function(count) {
                        res.json({count: count});
                    });
                } else {
                    return messages.find(queryObject).toArray().then(function(docs) {
                        clearNotification(senderID, "new_messages", {conversationID: conversationID});
                        res.json(docs.map(cleanIdField));
                    });
                }
            } else {
                res.sendStatus(403);
            }
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.get("/api/notifications", function(req, res) {
        var userID = req.session.user;
        notifications.find({
            userID: userID
        }).toArray().then(function(docs) {
            res.json(docs.map(cleanIdField));
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    // Returns a copy of the input with the "_id" field renamed to "id"
    function cleanIdField(obj) {
        var cleanObj = {};
        for (var key in obj) {
            if (key === "_id") {
                cleanObj.id = obj._id;
            } else {
                cleanObj[key] = obj[key];
            }
        }
        return cleanObj;
    }

    function clearNotification(userID, type, data) {
        var notificationQuery = {
            userID: userID,
            type: type
        };
        for (var key in data) {
            notificationQuery["data." + key] = data[key];
        }
        notifications.deleteOne(notificationQuery);
    }

    return app.listen(port);
};
