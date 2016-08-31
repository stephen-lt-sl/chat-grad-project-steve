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
            insertOne: sinon.stub()
        },
        messages: {
            find: sinon.stub(),
            insertOne: sinon.stub()
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
}
function setupAuthentication() {
    cookieJar = request.jar();
    githubAuthoriser = {
        authorise: function() {},
        oAuthUri: "https://github.com/login/oauth/authorize?client_id=" + oauthClientId
    };
}

module.exports.setAuthenticationFunction = function(callback) {
    sinon.stub(githubAuthoriser, "authorise", callback);
};

module.exports.authenticateUser = function(githubUser, user, token) {
    sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
        authCallback(githubUser, token);
    });

    dbCursors.users.singleResult.next.returns(Promise.resolve(user));

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

module.exports.getFindCallCount = function(collection) {
    return dbCursors[collection].toArray.callCount;
};
module.exports.getFindOneCallCount = function(collection) {
    return dbCursors[collection].singleResult.next.callCount;
};
module.exports.getInsertOneCallCount = function(collection) {
    return dbCollections[collection].insertOne.callCount;
};

module.exports.getFindAnyArgs = function(collection, callNum) {
    return dbCollections[collection].find.getCall(callNum).args;
};
module.exports.getInsertOneArgs = function(collection, callNum) {
    return dbCollections[collection].insertOne.getCall(callNum).args;
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
module.exports.getMessages = function(conversationID) {
    var requestUrl = baseUrl + "/api/messages/" + conversationID;
    return request({
        url: requestUrl,
        jar: cookieJar,
        simple: false,
        resolveWithFullResponse: true
    });
};
