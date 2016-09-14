/*global Promise */

var ObjectID = require("mongodb").ObjectID;

module.exports = function(app, dbActions, baseUrl) {

    app.get(baseUrl + "/groups", function(req, res) {
        var senderID = req.session.user;
        var joinedOnly = req.query.joinedOnly;
        var searchString = req.query.searchString;
        dbActions.findGroups({
            isMember: joinedOnly === "true" ? senderID : undefined,
            searchString: searchString
        }).then(function(docs) {
            var groupIDs = docs.map(function(group) {
                return group._id;
            });
            dbActions.clearNotifications(senderID, "group_changed", {groupID: {$in: groupIDs}});
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.get(baseUrl + "/groups/:id", function(req, res) {
        var senderID = req.session.user;
        var groupID = req.params.id;
        dbActions.findAndValidateGroup(groupID).then(function(group) {
            dbActions.clearNotifications(senderID, "group_changed", {groupID: groupID});
            res.json(dbActions.cleanIdField(group));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.post(baseUrl + "/groups", function(req, res) {
        var groupInfo = req.body;
        var creatorID = req.session.user;
        dbActions.validateGroupName(groupInfo.name).then(function() {
            return dbActions.createGroup({
                name: groupInfo.name,
                description: groupInfo.description,
                users: [creatorID]
            });
        }).then(function(group) {
            res.json(dbActions.cleanIdField(group));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/update", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var groupInfo = req.body;
        dbActions.findAndValidateGroup(groupID, {requiredMember: userID}).then(function(group) {
            if (groupInfo.name) {
                return dbActions.validateGroupName(groupInfo.name, groupID);
            }
        }).then(function() {
            return dbActions.updateGroupInfo(groupID, groupInfo, ["name", "description"]);
        }).then(function(updatedGroup) {
            dbActions.addGroupChangedNotification(updatedGroup, userID, new Date());
            res.json(dbActions.cleanIdField(updatedGroup));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/invite", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var newUsers = req.body;
        dbActions.findAndValidateGroup(groupID, {requiredMember: userID}).then(function(group) {
            return dbActions.addGroupUsers(groupID, newUsers);
        }).then(function(updatedGroup) {
            dbActions.addGroupChangedNotification(updatedGroup, userID, new Date());
            res.json(dbActions.cleanIdField(updatedGroup));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/remove", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var removedUsers = req.body;
        dbActions.findAndValidateGroup(groupID, {requiredMember: userID}).then(function(group) {
            // For now, only allow users to remove themselves from a group
            if (removedUsers && (removedUsers.length !== 1 || removedUsers[0] !== userID)) {
                return Promise.reject(409);
            }
            return dbActions.removeGroupUsers(groupID, removedUsers);
        }).then(function(updatedGroup) {
            dbActions.addGroupChangedNotification(updatedGroup, userID, new Date());
            res.json(dbActions.cleanIdField(updatedGroup));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/join", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        dbActions.findAndValidateGroup(groupID).then(function(group) {
            return dbActions.addGroupUsers(groupID, [userID]);
        }).then(function(updatedGroup) {
            dbActions.addGroupChangedNotification(updatedGroup, userID, new Date());
            res.json(dbActions.cleanIdField(updatedGroup));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

};
