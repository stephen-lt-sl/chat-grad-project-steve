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

    app.put(baseUrl + "/groups/:id/update", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var groupInfo = req.body;
        var queryObject = {_id: new ObjectID(groupID)};
        findAndValidateGroup(userID, queryObject).then(function(group) {
            var updateObject = {$set: {}};
            for (var item in groupInfo) {
                // Don't update any fields that don't exist, the _id field (locked), or the users field
                // (limited access)
                if (group[item] && item !== "_id" && item !== "users") {
                    updateObject.$set[item] = groupInfo[item];
                }
            }
            return updateGroup(queryObject, updateObject);
        }).then(function(updatedGroup) {
            res.json(updatedGroup);
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/invite", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var newUsers = req.body;
        var queryObject = {_id: new ObjectID(groupID)};
        findAndValidateGroup(userID, queryObject).then(function(group) {
            return updateGroup(queryObject, {$addToSet: {users: {$each: newUsers}}});
        }).then(function(updatedGroup) {
            res.json(updatedGroup);
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/remove", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var removedUsers = req.body;
        var queryObject = {_id: new ObjectID(groupID)};
        findAndValidateGroup(userID, queryObject).then(function(group) {
            // For now, only allow users to remove themselves from a group
            if (removedUsers && (removedUsers.length !== 1 || removedUsers[0] !== userID)) {
                return Promise.reject(409);
            }
            return updateGroup(queryObject, {$pull: {users: {$in: removedUsers}}});
        }).then(function(updatedGroup) {
            res.json(updatedGroup);
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    app.put(baseUrl + "/groups/:id/join", function(req, res) {
        var userID = req.session.user;
        var groupID = req.params.id;
        var queryObject = {_id: new ObjectID(groupID)};
        findAndValidateGroup(userID, queryObject, {}, false).then(function(group) {
            return updateGroup(queryObject, {$addToSet: {users: userID}});
        }).then(function(updatedGroup) {
            res.json(updatedGroup);
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

    function updateGroup(query, update) {
        return groups.findOneAndUpdate(query, update, {
            returnOriginal: false
        }).catch(function(err) {
            return Promise.reject(500);
        }).then(function(updateResult) {
            return dbActions.cleanIdField(updateResult.value);
        });
    }

    function findAndValidateGroup(senderID, query, projection, membershipRequired) {
        membershipRequired = membershipRequired !== false;
        return groups.find(query, projection).limit(1).next().catch(function(err) {
            return Promise.reject(500);
        }).then(function(group) {
            if (!group) {
                return Promise.reject(404);
            }
            if (membershipRequired && group.users.indexOf(senderID) === -1) {
                return Promise.reject(403);
            }
            return group;
        });
    }

};
