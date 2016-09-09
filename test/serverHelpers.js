/*global Promise */
var server = require("../server/server");
var request = require("request-promise-native");
var sinon = require("sinon");

var testPort = 52684;
var baseUrl = "http://localhost:" + testPort;
var oauthClientId = "1234clientId";

var db;
var dbCollections;
var dbCursors;

var cookieJar;
var githubAuthoriser;

var serverInstance;

module.exports.setupServer = function() {
    setupDB();
    setupAuthentication();
    serverInstance = server(testPort, db, githubAuthoriser);
};

module.exports.teardownServer = function() {
    serverInstance.close();
};

function setupDB() {
    dbCollections = {
        users: {
            find: sinon.stub(),
            insertOne: sinon.stub()
        },
        conversations: {
            find: sinon.stub(),
            insertOne: sinon.stub(),
            updateOne: sinon.stub()
        },
        messages: {
            find: sinon.stub(),
            insertOne: sinon.stub(),
            count: sinon.stub()
        },
        notifications: {
            find: sinon.stub(),
            updateOne: sinon.stub(),
            deleteMany: sinon.stub()
        },
        groups: {
            find: sinon.stub(),
            insertOne: sinon.stub(),
            updateOne: sinon.stub(),
            findOneAndUpdate: sinon.stub()
        }
    };
    dbCursors = {};
    for (var key in dbCollections) {
        if (dbCollections[key].find) {
            dbCursors[key] = {
                limit: sinon.stub(),
                singleResult: {
                    next: sinon.stub()
                },
                next: sinon.stub(),
                toArray: sinon.stub()
            };
            dbCursors[key].limit.withArgs(1).returns(dbCursors[key].singleResult);
            dbCollections[key].find.returns(dbCursors[key]);
        }
    }
    db = {
        collection: sinon.stub()
    };
    db.collection.withArgs("users").returns(dbCollections.users);
    db.collection.withArgs("conversations").returns(dbCollections.conversations);
    db.collection.withArgs("messages").returns(dbCollections.messages);
    db.collection.withArgs("notifications").returns(dbCollections.notifications);
    db.collection.withArgs("groups").returns(dbCollections.groups);
}
function setupAuthentication() {
    cookieJar = request.jar();
    githubAuthoriser = {
        authorise: function() {},
        oAuthUri: "https://github.com/login/oauth/authorize?client_id=" + oauthClientId
    };
}

module.exports.getOAuthUriString = function() {
    return "https://github.com/login/oauth/authorize?client_id=" + oauthClientId;
};

module.exports.setAuthenticationFunction = function(callback) {
    sinon.stub(githubAuthoriser, "authorise", callback);
};

module.exports.setSessionToken = function(token) {
    cookieJar.setCookie(request.cookie("sessionToken=" + token), baseUrl);
};

module.exports.authenticateUser = function(githubUser, user, token) {
    sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
        authCallback(githubUser, token);
    });

    module.exports.setFindOneResult("users", true, user);

    return request({
        url: baseUrl + "/oauth",
        simple: false,
        resolveWithFullResponse: true
    }).then(function(response) {
        cookieJar.setCookie(request.cookie("sessionToken=" + token), baseUrl);
        dbCollections.users.find.reset();
        dbCursors.users.singleResult.next.reset();
        return response;
    });
};

module.exports.setFindResult = function(collection, success, result, callNum) {
    var dbArrayCursor = dbCursors[collection].toArray;
    var dbArrayCursorCall = callNum === undefined ? dbArrayCursor : dbArrayCursor.onCall(callNum);
    dbArrayCursorCall.returns(success ? Promise.resolve(result) : Promise.reject(result));
};
module.exports.setFindOneResult = function(collection, success, result, callNum) {
    var dbCursor = dbCursors[collection].singleResult.next;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve(result) : Promise.reject(result));
};
module.exports.setInsertOneResult = function(collection, success, result, callNum) {
    var dbCursor = dbCollections[collection].insertOne;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve({ops: [result]}) : Promise.reject(result));
};
module.exports.setUpdateOneResult = function(collection, success, result, callNum) {
    var dbCursor = dbCollections[collection].updateOne;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve(result) : Promise.reject(result));
};
module.exports.setDeleteManyResult = function(collection, success, result, callNum) {
    var dbCursor = dbCollections[collection].deleteMany;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve(result) : Promise.reject(result));
};
module.exports.setCountResult = function(collection, success, result, callNum) {
    var dbCursor = dbCollections[collection].count;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve(result) : Promise.reject(result));
};
module.exports.setFindOneAndUpdateResult = function(collection, success, result, callNum) {
    var dbCursor = dbCollections[collection].findOneAndUpdate;
    var dbCursorCall = callNum === undefined ? dbCursor : dbCursor.onCall(callNum);
    dbCursorCall.returns(success ? Promise.resolve({value: result}) : Promise.reject(result));
};

module.exports.getFindCallCount = function(collection) {
    return dbCursors[collection].toArray.callCount;
};
module.exports.getFindOneCallCount = function(collection) {
    return dbCursors[collection].singleResult.next.callCount;
};
module.exports.getInsertOneCallCount = function(collection) {
    return dbCollections[collection].insertOne.callCount;
};
module.exports.getUpdateOneCallCount = function(collection) {
    return dbCollections[collection].updateOne.callCount;
};
module.exports.getDeleteManyCallCount = function(collection) {
    return dbCollections[collection].deleteMany.callCount;
};
module.exports.getCountCallCount = function(collection) {
    return dbCollections[collection].count.callCount;
};
module.exports.getFindOneAndUpdateCallCount = function(collection) {
    return dbCollections[collection].findOneAndUpdate.callCount;
};

module.exports.getFindAnyArgs = function(collection, callNum) {
    return dbCollections[collection].find.getCall(callNum).args;
};
module.exports.getInsertOneArgs = function(collection, callNum) {
    return dbCollections[collection].insertOne.getCall(callNum).args;
};
module.exports.getUpdateOneArgs = function(collection, callNum) {
    return dbCollections[collection].updateOne.getCall(callNum).args;
};
module.exports.getDeleteManyArgs = function(collection, callNum) {
    return dbCollections[collection].deleteMany.getCall(callNum).args;
};
module.exports.getCountArgs = function(collection, callNum) {
    return dbCollections[collection].count.getCall(callNum).args;
};
module.exports.getFindOneAndUpdateArgs = function(collection, callNum) {
    return dbCollections[collection].findOneAndUpdate.getCall(callNum).args;
};

module.exports.getOAuth = function(followRedirect) {
    var requestUrl = baseUrl + "/oauth";
    var requestOptions = {
        url: requestUrl,
        simple: false,
        resolveWithFullResponse: true
    };
    if (followRedirect !== undefined) {
        requestOptions.followRedirect = followRedirect;
    }
    return request(requestOptions);
};
module.exports.getOAuthUri = function() {
    var requestUrl = baseUrl + "/api/oauth/uri";
    return request({
        url: requestUrl,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.getUser = function() {
    var requestUrl = baseUrl + "/api/user";
    return request({
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.getUsers = function() {
    var requestUrl = baseUrl + "/api/users";
    return request({
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.getConversation = function(recipientID) {
    var requestUrl = baseUrl + "/api/conversations/" + recipientID;
    return request({
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.postConversation = function(recipientID) {
    var requestUrl = baseUrl + "/api/conversations";
    return request.post({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({recipient: recipientID}),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.postMessage = function(conversationID, contents) {
    var requestUrl = baseUrl + "/api/messages";
    return request.post({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            conversationID: conversationID,
            contents: contents
        }),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.getMessages = function(conversationID, queryParams) {
    var requestUrl = baseUrl + "/api/messages/" + conversationID;
    var requestObject = {
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    };
    if (queryParams) {
        requestObject.qs = queryParams;
    }
    return request(requestObject);
};
module.exports.getMessageCount = function(conversationID, queryParams) {
    var requestUrl = baseUrl + "/api/messages/" + conversationID + "/count";
    var requestObject = {
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    };
    if (queryParams) {
        requestObject.qs = queryParams;
    }
    return request(requestObject);
};
module.exports.getNotifications = function(conversationID, queryParams) {
    var requestUrl = baseUrl + "/api/notifications";
    var requestObject = {
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    };
    if (queryParams) {
        requestObject.qs = queryParams;
    }
    return request(requestObject);
};
module.exports.getGroups = function(queryParams) {
    var requestUrl = baseUrl + "/api/groups";
    var requestObject = {
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    };
    if (queryParams) {
        requestObject.qs = queryParams;
    }
    return request(requestObject);
};
module.exports.postGroup = function(name, description) {
    var requestUrl = baseUrl + "/api/groups";
    return request.post({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            description: description
        }),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.updateGroup = function(id, groupInfo) {
    var requestUrl = baseUrl + "/api/groups/" + id + "/update";
    return request.put({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify(groupInfo),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.inviteToGroup = function(id, newUsers) {
    var requestUrl = baseUrl + "/api/groups/" + id + "/invite";
    return request.put({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify(newUsers),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.removeFromGroup = function(id, removedUsers) {
    var requestUrl = baseUrl + "/api/groups/" + id + "/remove";
    return request.put({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify(removedUsers),
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
module.exports.joinGroup = function(id) {
    var requestUrl = baseUrl + "/api/groups/" + id + "/join";
    return request.put({
        url: requestUrl,
        headers: {
            "Content-type": "application/json"
        },
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
