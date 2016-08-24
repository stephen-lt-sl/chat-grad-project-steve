var server = require("../server/server");
var request = require("request");
var assert = require("chai").assert;
var sinon = require("sinon");

var testPort = 52684;
var baseUrl = "http://localhost:" + testPort;
var oauthClientId = "1234clientId";

var testUser = {
    _id: "bob",
    name: "Bob Bilson",
    avatarUrl: "http://avatar.url.com/u=test"
};
var testUser2 = {
    _id: "charlie",
    name: "Charlie Colinson",
    avatarUrl: "http://avatar.url.com/u=charlie_colinson"
};
var testGithubUser = {
    login: "bob",
    name: "Bob Bilson",
    avatar_url: "http://avatar.url.com/u=test"
};
var testGithubUser2 = {
    login: "charlie",
    name: "Charlie Colinson",
    avatar_url: "http://avatar.url.com/u=charlie_colinson"
};
var testConversation = {
    _id: "bob,charlie",
    participants: ["bob", "charlie"]
};
var testToken = "123123";
var testExpiredToken = "987978";
var testMessage = {
    _id: "507f1f77bcf86cd799439011",
    senderID: "bob",
    conversationID: "bob,charlie",
    contents: "here come dat boi!",
    timestamp: new Date(2016, 8, 24, 14, 5, 2)
};
var testMessage2 = {
    _id: "507f191e810c19729de860ea",
    senderID: "charlie",
    conversationID: "bob,charlie",
    contents: "waddup!",
    timestamp: new Date(2016, 8, 24, 14, 5, 2)
};
var testMessageContents = "here come dat boi!";
var testMessageContents2 = "waddup!";
var testObjectID = "507f1f77bcf86cd799439011";
var testObjectID2 = "507f191e810c19729de860ea";

describe("server", function() {
    var cookieJar;
    var db;
    var githubAuthoriser;
    var serverInstance;
    var dbCollections;
    beforeEach(function() {
        cookieJar = request.jar();
        dbCollections = {
            users: {
                find: sinon.stub(),
                findOne: sinon.stub(),
                insertOne: sinon.stub()
            },
            conversations: {
                find: sinon.stub(),
                findOne: sinon.stub(),
                insertOne: sinon.stub()
            }
        };
        db = {
            collection: sinon.stub()
        };
        db.collection.withArgs("users").returns(dbCollections.users);
        db.collection.withArgs("conversations").returns(dbCollections.conversations);

        githubAuthoriser = {
            authorise: function() {},
            oAuthUri: "https://github.com/login/oauth/authorize?client_id=" + oauthClientId
        };
        serverInstance = server(testPort, db, githubAuthoriser);
    });
    afterEach(function() {
        serverInstance.close();
    });
    function authenticateUser(githubUser, user, token, callback) {
        sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
            authCallback(githubUser, token);
        });

        dbCollections.users.findOne.callsArgWith(1, null, user);

        request(baseUrl + "/oauth", function(error, response) {
            cookieJar.setCookie(request.cookie("sessionToken=" + token), baseUrl);
            callback();
        });
    }
    describe("GET /oauth", function() {
        var requestUrl = baseUrl + "/oauth";

        it("responds with status code 400 if oAuth authorise fails", function(done) {
            var stub = sinon.stub(githubAuthoriser, "authorise", function(req, callback) {
                callback(null);
            });

            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 400);
                done();
            });
        });
        it("responds with status code 302 if oAuth authorise succeeds", function(done) {
            var user = testGithubUser;
            var stub = sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
                authCallback(user, testToken);
            });

            dbCollections.users.findOne.callsArgWith(1, null, user);

            request({url: requestUrl, followRedirect: false}, function(error, response) {
                assert.equal(response.statusCode, 302);
                done();
            });
        });
        it("responds with a redirect to '/' if oAuth authorise succeeds", function(done) {
            var user = testGithubUser;
            var stub = sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
                authCallback(user, testToken);
            });

            dbCollections.users.findOne.callsArgWith(1, null, user);

            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 200);
                assert.equal(response.request.uri.path, "/");
                done();
            });
        });
        it("add user to database if oAuth authorise succeeds and user id not found", function(done) {
            var user = testGithubUser;
            var stub = sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
                authCallback(user, testToken);
            });

            dbCollections.users.findOne.callsArgWith(1, null, null);

            request(requestUrl, function(error, response) {
                assert(dbCollections.users.insertOne.calledOnce);
                assert.deepEqual(dbCollections.users.insertOne.firstCall.args[0], {
                    _id: "bob",
                    name: "Bob Bilson",
                    avatarUrl: "http://avatar.url.com/u=test"
                });
                done();
            });
        });
    });
    describe("GET /api/oauth/uri", function() {
        var requestUrl = baseUrl + "/api/oauth/uri";
        it("responds with status code 200", function(done) {
            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 200);
                done();
            });
        });
        it("responds with a body encoded as JSON in UTF-8", function(done) {
            request(requestUrl, function(error, response) {
                assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
                done();
            });
        });
        it("responds with a body that is a JSON object containing a URI to GitHub with a client id", function(done) {
            request(requestUrl, function(error, response, body) {
                assert.deepEqual(JSON.parse(body), {
                    uri: "https://github.com/login/oauth/authorize?client_id=" + oauthClientId
                });
                done();
            });
        });
    });
    describe("GET /api/user", function() {
        var requestUrl = baseUrl + "/api/user";
        it("responds with status code 401 if user not authenticated", function(done) {
            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            cookieJar.setCookie(request.cookie("sessionToken=" + testExpiredToken), baseUrl);
            request({url: requestUrl, jar: cookieJar}, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("attempts to find user with correct ID if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert(dbCollections.users.findOne.calledTwice);
                    assert.deepEqual(dbCollections.users.findOne.secondCall.args[0], {
                        _id: "bob"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                request({url: requestUrl, jar: cookieJar}, function(error, response, body) {
                    assert.deepEqual(JSON.parse(body), {
                        _id: "bob",
                        name: "Bob Bilson",
                        avatarUrl: "http://avatar.url.com/u=test"
                    });
                    done();
                });
            });
        });
        it("responds with status code 404 if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {

                dbCollections.users.findOne.callsArgWith(1, {err: "Database error"}, null);

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {

                dbCollections.users.findOne.callsArgWith(1, {err: "Database error"}, null);

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("GET /api/users", function() {
        var requestUrl = baseUrl + "/api/users";
        var allUsers;
        beforeEach(function() {
            allUsers = {
                toArray: sinon.stub()
            };
            dbCollections.users.find.returns(allUsers);
        });
        it("responds with status code 401 if user not authenticated", function(done) {
            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            cookieJar.setCookie(request.cookie("sessionToken=" + testExpiredToken), baseUrl);
            request({url: requestUrl, jar: cookieJar}, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 200 if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                allUsers.toArray.callsArgWith(0, null, [testUser]);

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                allUsers.toArray.callsArgWith(0, null, [
                        testUser,
                        testUser2
                    ]);

                request({url: requestUrl, jar: cookieJar}, function(error, response, body) {
                    assert.deepEqual(JSON.parse(body), [
                        {
                            id: "bob",
                            name: "Bob Bilson",
                            avatarUrl: "http://avatar.url.com/u=test"
                        },
                        {
                            id: "charlie",
                            name: "Charlie Colinson",
                            avatarUrl: "http://avatar.url.com/u=charlie_colinson"
                        }
                    ]);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                allUsers.toArray.callsArgWith(0, {err: "Database failure"}, null);

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("GET /api/conversations/:id", function() {
        var requestUrl = baseUrl + "/api/conversations/" + testUser2._id;
        it("responds with status code 401 if user not authenticated", function(done) {
            request(requestUrl, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            cookieJar.setCookie(request.cookie("sessionToken=" + testExpiredToken), baseUrl);
            request({url: requestUrl, jar: cookieJar}, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("attempts to find conversation with correct ID if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert(dbCollections.conversations.findOne.calledOnce);
                    assert.deepEqual(dbCollections.conversations.findOne.firstCall.args[0], {
                        _id: "bob,charlie"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation exists", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the conversation if user is authenticated " +
            "and conversation exists", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    request({url: requestUrl, jar: cookieJar}, function(error, response, body) {
                        assert.deepEqual(JSON.parse(body), {
                                id: "bob,charlie",
                                participants: ["bob", "charlie"]
                            });
                        done();
                    });
                });
            }
        );
        it("responds with status code 404 if user is authenticated and conversation does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.conversations.findOne.callsArgWith(1, null, null);
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 404);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.conversations.findOne.callsArgWith(1, {err: "Database failure"}, null);
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("POST /api/conversations", function() {
        var requestUrl = baseUrl + "/api/conversations";
        it("responds with status code 401 if user not authenticated", function(done) {
            request.post({
                url: requestUrl,
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({recipient: "charlie"})
            }, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            cookieJar.setCookie(request.cookie("sessionToken=" + testExpiredToken), baseUrl);
            request.post({
                url: requestUrl,
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({recipient: "charlie"}),
                jar: cookieJar
            }, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("adds conversation to database if user is authenticated and conversation id not found", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({recipient: "charlie"}),
                    jar: cookieJar
                }, function(error, response, body) {
                    assert(dbCollections.conversations.insertOne.calledOnce);
                    assert.deepEqual(dbCollections.conversations.insertOne.firstCall.args[0], {
                        _id: "bob,charlie",
                        participants: ["bob", "charlie"]
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation is created successfully",
            function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                    dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                    dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({recipient: "charlie"}),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the created conversation if conversation is " +
            "created successfully", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                    dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                    dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({recipient: "charlie"}),
                        jar: cookieJar
                    }, function(error, response, body) {
                        assert.deepEqual(JSON.parse(body), {
                            id: "bob,charlie",
                            participants: ["bob", "charlie"]
                        });
                        done();
                    });
                });
            }
        );
        it("creates an identical conversation ID regardless of which participant creates the conversation",
            function(done) {
                authenticateUser(testGithubUser2, testUser2, testToken, function() {
                    dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser2);
                    dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser);
                    dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({recipient: "bob"}),
                        jar: cookieJar
                    }, function(error, response, body) {
                        assert.equal(JSON.parse(body).id, "bob,charlie");
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and sender does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, null);
                dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({recipient: "charlie"}),
                    jar: cookieJar
                }, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find sender", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.users.findOne.onSecondCall().callsArgWith(1, {err: "Database failure"}, null);
                dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({recipient: "charlie"}),
                    jar: cookieJar
                }, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and recipient does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, null);
                dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({recipient: "charlie"}),
                    jar: cookieJar
                }, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find " +
            "recipient", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                    dbCollections.users.findOne.onThirdCall().callsArgWith(1, {err: "Database failure"}, null);
                    dbCollections.conversations.insertOne.callsArgWith(1, null, testConversation);
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({recipient: "charlie"}),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.users.findOne.onSecondCall().callsArgWith(1, null, testUser);
                dbCollections.users.findOne.onThirdCall().callsArgWith(1, null, testUser2);
                dbCollections.conversations.insertOne.callsArgWith(1, {err: "Database failure"}, null);
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({recipient: "charlie"}),
                    jar: cookieJar
                }, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
});
