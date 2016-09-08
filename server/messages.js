/*global Promise */

module.exports = function(app, db, baseUrl) {
    var dbActions = require("./dbActions")(db);

    var conversations = db.collection("conversations");
    var messages = db.collection("messages");
    var notifications = db.collection("notifications");

    app.get(baseUrl + "/messages/:id", function(req, res) {
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
            if (conversation.participants.indexOf(senderID) === -1) {
                res.sendStatus(403);
                return Promise.resolve();
            }
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
                    dbActions.clearNotifications(senderID, "new_messages", {conversationID: conversationID});
                    res.json(docs.map(dbActions.cleanIdField));
                });
            }
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.post(baseUrl + "/messages", function(req, res) {
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
            if (conversation.participants.indexOf(senderID) === -1) {
                res.sendStatus(403);
            }
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
                res.json(dbActions.cleanIdField(message));
            }).catch(function(err) {
                res.sendStatus(500);
            });
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

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

    // Update the conversation timestamp
    function updateConversation(conversation, message) {
        conversations.updateOne({
            _id: conversation._id
        }, {
            $set: {lastTimestamp: message.timestamp}
        });
    }

};
