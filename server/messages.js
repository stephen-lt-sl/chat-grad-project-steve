/*global Promise */

module.exports = function(app, dbActions, baseUrl) {

    app.get(baseUrl + "/messages/:id", function(req, res) {
        var senderID = req.session.user;
        var conversationID = req.params.id;
        var lastTimestamp = req.query.timestamp;
        var countOnly = req.query.countOnly;
        dbActions.findAndValidateConversation(conversationID, {
            requiredParticipant: senderID
        }).then(function(conversation) {
            return dbActions.findMessages(conversationID, {
                lastTimestamp: lastTimestamp
            });
        }).then(function(docs) {
            dbActions.clearNotifications(senderID, "new_messages", {conversationID: conversationID});
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.get(baseUrl + "/messages/:id/count", function(req, res) {
        var senderID = req.session.user;
        var conversationID = req.params.id;
        var lastTimestamp = req.query.timestamp;
        dbActions.findAndValidateConversation(conversationID, {
            requiredParticipant: senderID
        }).then(function(conversation) {
            return dbActions.findMessages(conversationID, {
                countOnly: true,
                lastTimestamp: lastTimestamp
            });
        }).then(function(count) {
            res.json({count: count});
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.post(baseUrl + "/messages", function(req, res) {
        var senderID = req.session.user;
        var conversationID = req.body.conversationID;
        var contents = req.body.contents;
        dbActions.findAndValidateConversation(conversationID, {
            requiredParticipant: senderID
        }).then(function(conversation) {
            if (contents === "") {
                res.sendStatus(201);
                return;
            }
            var timestamp = new Date();
            return dbActions.createMessage({
                senderID: senderID,
                conversationID: conversationID,
                contents: contents,
                timestamp: timestamp
            }).then(function(message) {
                dbActions.updateConversationTimestamp(conversation, message.timestamp);
                dbActions.addNewMessageNotification(conversation, message);
                res.json(dbActions.cleanIdField(message));
            });
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

};
