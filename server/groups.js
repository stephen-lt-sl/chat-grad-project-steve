/*global Promise */

var ObjectID = require("mongodb").ObjectID;

module.exports = function(app, db, baseUrl) {
    var dbActions = require("./dbActions")(db);

    var groups = db.collection("groups");

    app.get(baseUrl + "/groups", function(req, res) {
        var senderID = req.session.user;
        var joinedOnly = req.query.joinedOnly;
        var searchString = req.query.searchString;
        var queryObject = {};
        if (joinedOnly) {
            queryObject.users = senderID;
        }
        if (searchString) {
            queryObject.$text = {
                $search: searchString
            };
        }
        groups.find(queryObject).toArray().then(function(docs) {
            var groupIDs = docs.map(function(group) {
                return group._id;
            });
            dbActions.clearNotifications(senderID, "group_changed", {groupID: {$in: groupIDs}});
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.post(baseUrl + "/groups", function(req, res) {
        var groupInfo = req.body;
        var creatorID = req.session.user;
        groups.find({
            name: groupInfo.name
        }).limit(1).next().then(function(group) {
            if (group) {
                res.sendStatus(409);
                return Promise.resolve();
            }
            return groups.insertOne({
                name: groupInfo.name,
                description: groupInfo.description,
                users: [creatorID]
            }).then(function(result) {
                res.json(dbActions.cleanIdField(result.ops[0]));
            });
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    app.put(baseUrl + "/groups/:id", function(req, res) {
        var groupID = req.params.id;
        var groupInfo = req.body.groupInfo;
        var newUsers = req.body.newUsers;
        var removedUsers = req.body.removedUsers;
        var queryObject = {_id: new ObjectID(groupID)};
        groups.find(queryObject).limit(1).next().then(function(group) {
            if (!group) {
                res.sendStatus(404);
                return Promise.resolve();
            }
            if (group.users.indexOf(req.session.user) === -1) {
                res.sendStatus(403);
                return Promise.resolve();
            }
            // For now, only allow users to remove themselves from a group
            if (removedUsers && (removedUsers.length !== 1 || removedUsers[0] !== req.session.user)) {
                res.sendStatus(409);
                return Promise.resolve();
            }
            var updateObject = groupUpdateQuery(group, req.session.user, newUsers, removedUsers, groupInfo);
            return groups.findOneAndUpdate(queryObject, updateObject, {
                returnOriginal: false
            }).then(function(updateResult) {
                res.json(dbActions.cleanIdField(updateResult.value));
            });
        }).catch(function(err) {
            res.sendStatus(500);
        });
    });

    function groupUpdateQuery(group, senderID, newUsers, removedUsers, groupInfo) {
        var updateObject = {};
        if (newUsers) {
            updateObject.$addToSet = {users: {$each: newUsers}};
        }
        if (removedUsers) {
            updateObject.$pull = {users: {$in: removedUsers}};
        }
        if (groupInfo) {
            updateObject.$set = {};
            for (var item in groupInfo) {
                // Don't update any fields that don't exist, the _id field (locked), or the users field
                // (limited access)
                if (group[item] && item !== "_id" && item !== "users") {
                    updateObject.$set[item] = groupInfo[item];
                }
            }
        }
        return updateObject;
    }

};
