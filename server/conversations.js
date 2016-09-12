/*global Promise */

module.exports = function(app, dbActions, baseUrl) {

    app.get(baseUrl + "/conversations/:id", function(req, res) {
        var conversationID = getConversationID(req.session.user, req.params.id);
        dbActions.findAndValidateConversation(conversationID).then(function(conversation) {
            res.json(dbActions.cleanIdField(conversation));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.post(baseUrl + "/conversations", function(req, res) {
        var conversationInfo = req.body;
        var recipientID = conversationInfo.recipient;
        var senderID = req.session.user;
        // Find both the sender and the recipient in the db
        dbActions.findAndValidateUsers([senderID, recipientID]).then(function(users) {
            var conversationID = getConversationID(senderID, recipientID);
            var participants = [senderID, recipientID].sort();
            return dbActions.createConversation({
                _id: conversationID,
                participants: participants
            });
        }).then(function(conversation) {
            res.json(dbActions.cleanIdField(conversation));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    // Produce the same ID for any pair of users, regardless of which is the sender
    function getConversationID(userAId, userBId) {
        return userAId < userBId ?
            userAId + "," + userBId :
            userBId + "," + userAId;
    }

};
