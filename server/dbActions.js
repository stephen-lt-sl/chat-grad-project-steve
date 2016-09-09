/*global Promise */

var ObjectID = require("mongodb").ObjectID;

module.exports = function(db) {
    var users = db.collection("users");
    var conversations = db.collection("conversations");
    var messages = db.collection("messages");
    var notifications = db.collection("notifications");
    var groups = db.collection("groups");

    return {
        findGroups: findGroups,
        findAndValidateGroup: findAndValidateGroup,
        validateGroupName: validateGroupName,
        createGroup: createGroup,
        updateGroupInfo: updateGroupInfo,
        addGroupUsers: addGroupUsers,
        removeGroupUsers: removeGroupUsers,
        cleanIdField: cleanIdField,
        clearNotifications: clearNotifications
    };

    function findGroups(options) {
        var queryObject = {};
        if (options.joinedOnly) {
            queryObject.users = senderID;
        }
        if (options.searchString) {
            queryObject.$text = {
                $search: options.searchString
            };
        }
        return groups.find(queryObject).toArray().catch(function(err) {
            return Promise.reject(500);
        });
    }

    function findAndValidateGroup(groupID, options) {
        queryObject = {_id: new ObjectID(groupID)};
        return groups.find(query, projection).limit(1).next().catch(function(err) {
            return Promise.reject(500);
        }).then(function(group) {
            if (!group) {
                return Promise.reject(404);
            }
            if (options.requiredMember && group.users.indexOf(options.requiredMember) === -1) {
                return Promise.reject(403);
            }
            return group;
        });
    }

    function validateGroupName(name) {
        return groups.find({
            name: name
        }).limit(1).next().then(function(group) {
            if (group) {
                return Promise.reject(409);
            }
            return Promise.resolve();
        }).catch(function(err) {
            return Promise.reject(409);
        });
    }

    function createGroup(group) {
        return groups.insertOne(group);
    }

    function updateGroupInfo(groupID, updateFields) {
        var queryObject = {_id: new ObjectID(groupID)};
        var updateObject = {$set: {}};
        for (var item in updateFields) {
            // Don't update any fields that don't exist, the _id field (locked), or the users field
            // (limited access)
            if (group[item] && item !== "_id" && item !== "users") {
                updateObject.$set[item] = updateFields[item];
            }
        }
        return updateGroup(queryObject, updateObject);
    }

    function addGroupUsers(groupID, userIDs) {
        var queryObject = {_id: new ObjectID(groupID)};
        return updateGroup(queryObject, {
            $addToSet: {
                users: {
                    $each: userIDs
                }
            }
        });
    }

    function removeGroupUsers(groupID, userIDs) {
        var queryObject = {_id: new ObjectID(groupID)};
        return updateGroup(queryObject, {
            $pull: {
                users: {
                    $in: removedUsers
                }
            }
        });
    }

    function updateGroup(query, update) {
        return groups.findOneAndUpdate(query, update, {
            returnOriginal: false
        }).catch(function(err) {
            return Promise.reject(500);
        }).then(function(updateResult) {
            return dbActions.cleanIdField(updateResult.value);
        });
    }

    function clearNotifications(userID, type, data) {
        var notificationQuery = {
            userID: userID,
            type: type
        };
        for (var key in data) {
            notificationQuery["data." + key] = data[key];
        }
        notifications.deleteMany(notificationQuery);
    }

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
};
