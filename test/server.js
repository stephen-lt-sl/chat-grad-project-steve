/*global Promise*/
var server = require("../server/server");
var request = require("request");
var assert = require("chai").assert;
var sinon = require("sinon");
var helpers = require("./serverHelpers");

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
    var dbCursors;
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);
    function authenticateUser(githubUser, user, token, callback) {
        sinon.stub(githubAuthoriser, "authorise", function(req, authCallback) {
            authCallback(githubUser, token);
        });

        dbCursors.users.singleResult.next.returns(Promise.resolve(user));

        request(baseUrl + "/oauth", function(error, response) {
            cookieJar.setCookie(request.cookie("sessionToken=" + token), baseUrl);
            dbCollections.users.find.reset();
            dbCursors.users.singleResult.next.reset();
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

            dbCursors.users.singleResult.next.returns(Promise.resolve(testUser));

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

            dbCursors.users.singleResult.next.returns(Promise.resolve(testUser));

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

            dbCursors.users.singleResult.next.returns(Promise.resolve(null));
            dbCollections.users.insertOne.returns(Promise.resolve({ops: [testUser]}));

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
                dbCursors.users.singleResult.next.returns(Promise.resolve(testUser));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert(dbCollections.users.find.calledOnce);
                    assert.deepEqual(dbCollections.users.find.firstCall.args[0], {
                        _id: "bob"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.users.singleResult.next.returns(Promise.resolve(testUser));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.users.singleResult.next.returns(Promise.resolve(testUser));
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
        it("responds with status code 500 if database error", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {

                dbCursors.users.singleResult.next.returns(Promise.reject({err: "Database error"}));

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("GET /api/users", function() {
        var requestUrl = baseUrl + "/api/users";
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
                dbCursors.users.toArray.returns(Promise.resolve([testUser]));

                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.users.toArray.returns(Promise.resolve([testUser, testUser2]));

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
                dbCursors.users.toArray.returns(Promise.reject({err: "Database failure"}));

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
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert(dbCollections.conversations.find.calledOnce);
                    assert.deepEqual(dbCollections.conversations.find.firstCall.args[0], {
                        _id: "bob,charlie"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation exists", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the conversation if user is authenticated " +
            "and conversation exists", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
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
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(null));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 404);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.conversations.singleResult.next.returns(Promise.reject({err: "Database failure"}));
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
                dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                    dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                    dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                    dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                    dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                    dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                    dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                    dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser2));
                    dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser));
                    dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(null));
                dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                dbCursors.users.singleResult.next.onFirstCall().returns(Promise.reject({err: "Database failure"}));
                dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(null));
                dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                    dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                    dbCursors.users.singleResult.next.onSecondCall().returns(Promise.reject({err: "Database failure"}));
                    dbCollections.conversations.insertOne.returns(Promise.resolve({ops: [testConversation]}));
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
                dbCursors.users.singleResult.next.onFirstCall().returns(Promise.resolve(testUser));
                dbCursors.users.singleResult.next.onSecondCall().returns(Promise.resolve(testUser2));
                dbCollections.conversations.insertOne.returns(Promise.reject({err: "Database failure"}));
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
    describe("POST /api/messages", function() {
        var requestUrl = baseUrl + "/api/messages";
        beforeEach(function() {
            // Proxy function that calls a stub with the original argument given to it, and returns a promise which
            // returns either the original object with an added _id: <ObjectID> field wrapped in a `InsertOneResult`
            // object (mimicking the action of the actual database) if the stub returns a promise that resolves to
            // true, or null if the stub returns a promise that resolves to false
            // This is necessary to preserve server output that shouldn't be mocked i.e. timestamps, so that the
            // server receives correct input data when resolving the insertion
            dbCollections.messages.insertOne = function(obj) {
                var dbObj = obj;
                dbObj._id = testMessage._id;
                return dbCollections.messages.insertOne.stub(obj).then(function(found) {
                    return found ? {ops: [dbObj]} : null;
                });
            };
            // Use the .stub field for all usual stub operations, e.g. calledOnce, firstCall, etc, keeping in mind
            // that it must return a promise that either rejects to signify an error, or resolves to true or false to
            // determine whether the server receives a result from the operation or not (see above)
            dbCollections.messages.insertOne.stub = sinon.stub();
        });
        it("responds with status code 401 if user not authenticated", function(done) {
            request.post({
                url: requestUrl,
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    conversationID: testMessage.conversationID,
                    contents: testMessage.contents
                })
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
                body: JSON.stringify({
                    conversationID: testMessage.conversationID,
                    contents: testMessage.contents
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    var beforeTimestamp = new Date();
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testMessage.conversationID,
                            contents: testMessage.contents
                        }),
                        jar: cookieJar
                    }, function(error, response, body) {
                        var afterTimestamp = new Date();
                        assert(dbCollections.messages.insertOne.stub.calledOnce, "insertOne not called");
                        var insertedMessage = dbCollections.messages.insertOne.stub.firstCall.args[0];
                        assert.equal(insertedMessage.conversationID, testConversation._id);
                        assert.equal(insertedMessage.contents, testMessage.contents);
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    request.post({
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testMessage.conversationID,
                            contents: testMessage.contents
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    var beforeTimestamp = new Date();
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testMessage.conversationID,
                            contents: testMessage.contents
                        }),
                        jar: cookieJar
                    }, function(error, response, body) {
                        var afterTimestamp = new Date();
                        var receivedMessage = JSON.parse(body);
                        var receivedTimestamp = new Date(receivedMessage.timestamp);
                        assert.equal(receivedMessage.conversationID, testConversation._id);
                        assert.equal(receivedMessage.contents, testMessage.contents);
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
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(null));
                dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                request.post({
                    url: requestUrl,
                    headers: {
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({
                        conversationID: testMessage.conversationID,
                        contents: testMessage.contents
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
                    dbCursors.conversations.singleResult.next.returns(Promise.reject({err: "Database failure"}));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testMessage.conversationID,
                            contents: testMessage.contents
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation2));
                    dbCollections.messages.insertOne.stub.returns(Promise.resolve(true));
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testConversation2.id,
                            contents: testMessage.contents
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
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCollections.messages.insertOne.stub.returns(Promise.reject({err: "Database failure"}));
                    request.post({
                        url: requestUrl,
                        headers: {
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            conversationID: testMessage.conversationID,
                            contents: testMessage.contents
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
    describe("GET /api/messages", function() {
        var requestUrl = baseUrl + "/api/messages/" + testConversation._id;
        var requestUrl2 = baseUrl + "/api/messages/" + testConversation2._id;
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
        it("makes database requests with the conversation ID sent in the request body",
            function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                    request({url: requestUrl, jar: cookieJar}, function(error, response) {
                        assert(dbCollections.conversations.find.calledOnce);
                        assert.deepEqual(dbCollections.conversations.find.firstCall.args[0], {
                            _id: testConversation._id
                        });
                        assert(dbCollections.messages.find.calledOnce);
                        assert.deepEqual(dbCollections.messages.find.firstCall.args[0], {
                            conversationID: testConversation._id
                        });
                        done();
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, and user is a participant",
            function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                    request({url: requestUrl, jar: cookieJar}, function(error, response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the messages in the conversation if user is " +
            "authenticated, conversation exists, and user is a participant", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                    dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                    request({url: requestUrl, jar: cookieJar}, function(error, response) {
                        assert.deepEqual(JSON.parse(response.body), [
                            {
                                id: "507f1f77bcf86cd799439011",
                                senderID: "bob",
                                conversationID: "bob,charlie",
                                contents: "here come dat boi!",
                                timestamp: new Date(2016, 8, 24, 14, 5, 2).toISOString()
                            },
                            {
                                id: "507f191e810c19729de860ea",
                                senderID: "charlie",
                                conversationID: "bob,charlie",
                                contents: "waddup!",
                                timestamp: new Date(2016, 8, 24, 14, 5, 2).toISOString()
                            }
                        ]);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if database error on find messages", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation));
                dbCursors.messages.toArray.returns(Promise.reject({err: "Database failure"}));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 403 if user is authenticated and conversation exists, but user is not a " +
            "participant", function(done) {
                authenticateUser(testGithubUser, testUser, testToken, function() {
                    dbCursors.conversations.singleResult.next.returns(Promise.resolve(testConversation2));
                    dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                    request({url: requestUrl2, jar: cookieJar}, function(error, response) {
                        assert.equal(response.statusCode, 403);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated but conversation does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.conversations.singleResult.next.returns(Promise.resolve(null));
                dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated but conversation does not exist", function(done) {
            authenticateUser(testGithubUser, testUser, testToken, function() {
                dbCursors.conversations.singleResult.next.returns(Promise.reject({err: "Database failure"}));
                dbCursors.messages.toArray.returns(Promise.resolve([testMessage, testMessage2]));
                request({url: requestUrl, jar: cookieJar}, function(error, response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
});
