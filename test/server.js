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
var testConversation2 = {
    _id: "charlie,charlie",
    participants: ["charlie", "charlie"]
};
var testToken = "123123";
var testExpiredToken = "987978";
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
            },
            messages: {
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
        db.collection.withArgs("messages").returns(dbCollections.messages);

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
    describe("PUT /api/messages/:id", function() {
        var requestUrl = baseUrl + "/api/messages/" + testConversation._id;
        beforeEach(function() {
            // Proxy function that calls a stub with the original argument given to it, adding an _id: <ObjectID>
            // field in the same way as the actual database
            // This is done to preserve non-mockable server output, i.e. timestamps, so that the server receives its
            // own output correctly during the callback
            dbCollections.messages.insertOne = function(obj, callback) {
                var dbObj = obj;
                dbObj._id = testObjectID;
                dbCollections.messages.insertOne.stub(obj, function(err, success) {
                    callback(err, success ? dbObj : null);
                });
            };
            // Use the .stub field for all usual stub operations, e.g. calledOnce, firstCall, etc
            dbCollections.messages.insertOne.stub = sinon.stub();
        });
        it("responds with status code 401 if user not authenticated", function(done) {
            request.put({
                url: requestUrl,
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    contents: testMessageContents
                })
            }, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            cookieJar.setCookie(request.cookie("sessionToken=" + testExpiredToken), baseUrl);
            request.put({
                url: requestUrl,
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    contents: testMessageContents
                }),
                jar: cookieJar
            }, function(error, response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("adds message with correct ID, contents, and valid timestamp to database if user is authenticated, " +
            "conversation exists, and sender is a participant", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    var beforeTimestamp = new Date();
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response, body) {
                        var afterTimestamp = new Date();
                        assert(dbCollections.messages.insertOne.stub.calledOnce, "insertOne not called");
                        var insertedMessage = dbCollections.messages.insertOne.stub.firstCall.args[0];
                        assert.equal(insertedMessage.conversationID, testConversation._id);
                        assert.equal(insertedMessage.contents, testMessageContents);
                        assert(beforeTimestamp.getTime() <= insertedMessage.timestamp.getTime(),
                            "Timestamp is earlier than call"
                        );
                        assert(insertedMessage.timestamp.getTime() <= afterTimestamp.getTime(),
                            "Timestamp is later than call"
                        );
                        done();
                    });
                });
            }
        );
        it("responds with status code 201 and creates no message if user is authenticated and message is blank",
            function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: ""
                        }),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 201);
                        assert.isFalse(dbCollections.messages.insertOne.stub.called);
                        done();
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, sender is a participant, " +
            "and message is created successfully", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the created message if message is " +
            "created successfully", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    var beforeTimestamp = new Date();
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response, body) {
                        var afterTimestamp = new Date();
                        var receivedMessage = JSON.parse(body);
                        var receivedTimestamp = new Date(receivedMessage.timestamp);
                        assert.equal(receivedMessage.conversationID, testConversation._id);
                        assert.equal(receivedMessage.contents, testMessageContents);
                        assert(beforeTimestamp.getTime() <= receivedTimestamp.getTime(),
                            "Timestamp is earlier than call"
                        );
                        assert(receivedTimestamp.getTime() <= afterTimestamp.getTime(),
                            "Timestamp is later than call"
                        );
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and conversation does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCollections.conversations.findOne.callsArgWith(1, null, null);
                dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                request.put({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: testMessageContents
                    }),
                    jar: cookieJar
                }, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find conversation",
            function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, {err: "Database failure"}, null);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
        it("responds with status code 403 if user is authenticated and conversation exists but user is not " +
            "participant in conversation", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation2);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, null, true);
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 403);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert " +
            "message", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCollections.conversations.findOne.callsArgWith(1, null, testConversation);
                    dbCollections.messages.insertOne.stub.callsArgWith(1, {err: "Database failure"}, null);
                    request.put({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: testMessageContents
                        }),
                        jar: cookieJar
                    }, function(error, response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
    });
});
