/*global Promise */

module.exports = function(app, db, baseUrl) {
    var dbActions = require("./dbActions")(db);

    var users = db.collection("users");
    var conversations = db.collection("conversations");

    app.get(baseUrl + "/conversations/:id", function(req, res) {
        var conversationID = getConversationID(req.session.user, req.params.id);
        conversations.find({
            _id: conversationID
        }).limit(1).next().then(function(conversation) {
            if (conversation) {
                res.json(dbActions.cleanIdField(conversation));
            } else {
                res.sendStatus(404);
            }
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.post(baseUrl + "/conversations", function(req, res) {
        var conversationInfo = req.body;
        var recipientID = conversationInfo.recipient;
        var senderID = req.session.user;
        // Find both the sender and the recipient in the db
        findUsers([senderID, recipientID]).then(function() {
            var conversationID = getConversationID(senderID, recipientID);
            var participants = [senderID, recipientID].sort();
            return conversations.insertOne({
                _id: conversationID,
                participants: participants
            });
        }).then(function(result) {
            res.json(dbActions.cleanIdField(result.ops[0]));
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    function findUsers(userIDs) {
        var findPromises = [];
        userIDs.forEach(function(userID, idx) {
            findPromises.push(users.find({
                _id: userID
            }).limit(1).next().then(function(foundUser) {
                if (!foundUser) {
                    return Promise.reject(false);
                }
                return foundUser;
            }));
        });
        return Promise.all(findPromises);
    }

    // Produce the same ID for any pair of users, regardless of which is the sender
    function getConversationID(userAId, userBId) {
        return userAId < userBId ?
            userAId + "," + userBId :
            userBId + "," + userAId;
    }

};
