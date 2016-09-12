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
        if (options.isMember) {
            queryObject.users = options.isMember;
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
        options = options || {};
        var queryObject = {_id: new ObjectID(groupID)};
        return groups.find(queryObject).limit(1).next().catch(function(err) {
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
        }).limit(1).next().catch(function(err) {
            return Promise.reject(500);
        }).then(function(group) {
            if (group) {
                return Promise.reject(409);
            }
            return Promise.resolve();
        });
    }

    function createGroup(group) {
        return groups.insertOne(group).then(function(result) {
            return result.ops[0];
        }).catch(function(err) {
            return Promise.reject(500);
        });
    }

    function updateGroupInfo(groupID, update, allowedFields) {
        var queryObject = {_id: new ObjectID(groupID)};
        var updateObject = {$set: {}};
        allowedFields.forEach(function(field) {
            if (update[field]) {
                updateObject.$set[field] = update[field];
            }
        });
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
                    $in: userIDs
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
            return cleanIdField(updateResult.value);
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
