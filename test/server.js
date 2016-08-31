/*global Promise*/
var server = require("../server/server");
var request = require("request");
var assert = require("chai").assert;
var sinon = require("sinon");
var helpers = require("./serverHelpers");

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
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);
    describe("GET /oauth", function() {
        it("responds with status code 400 if oAuth authorise fails", function(done) {
            helpers.setAuthenticationFunction(function(req, callback) {
                callback(null);
            });

            helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 400);
                done();
            });
        });
        it("responds with status code 302 if oAuth authorise succeeds", function(done) {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, testUser);

            helpers.getOAuth(false).then(function(response) {
                assert.equal(response.statusCode, 302);
                done();
            });
        });
        it("responds with a redirect to '/' if oAuth authorise succeeds", function(done) {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, testUser);

            helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 200);
                assert.equal(response.request.uri.path, "/");
                done();
            });
        });
        it("add user to database if oAuth authorise succeeds and user id not found", function(done) {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, null);
            helpers.setInsertOneResult("users", true, testUser);

            helpers.getOAuth().then(function(response) {
                assert.equal(helpers.getInsertOneCallCount("users"), 1);
                assert.deepEqual(helpers.getInsertOneArgs("users", 0)[0], {
                    _id: "bob",
                    name: "Bob Bilson",
                    avatarUrl: "http://avatar.url.com/u=test"
                });
                done();
            });
        });
    });
    describe("GET /api/oauth/uri", function() {
        it("responds with status code 200", function(done) {
            helpers.getOAuthUri().then(function(response) {
                assert.equal(response.statusCode, 200);
                done();
            });
        });
        it("responds with a body encoded as JSON in UTF-8", function(done) {
            helpers.getOAuthUri().then(function(response) {
                assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
                done();
            });
        });
        it("responds with a body that is a JSON object containing a URI to GitHub with a client id", function(done) {
            helpers.getOAuthUri().then(function(response) {
                assert.deepEqual(JSON.parse(response.body), {
                    uri: helpers.getOAuthUriString()
                });
                done();
            });
        });
    });
    describe("GET /api/user", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.getUser().then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.getUser().then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("attempts to find user with correct ID if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                helpers.getUser().then(function(response) {
                    assert.equal(helpers.getFindOneCallCount("users"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("users", 0)[0], {
                        _id: "bob"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                helpers.getUser().then(function(response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                helpers.getUser().then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        _id: "bob",
                        name: "Bob Bilson",
                        avatarUrl: "http://avatar.url.com/u=test"
                    });
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", false, {err: "Database failure"});
                helpers.getUser().then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("GET /api/users", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.getUsers().then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.getUsers().then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 200 if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", true, [testUser]);
                helpers.getUsers().then(function(response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", true, [testUser, testUser2]);
                helpers.getUsers().then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), [
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
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", false, {err: "Database failure"});
                helpers.getUsers().then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("GET /api/conversations/:id", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.getConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.getConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("attempts to find conversation with correct ID if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.getConversation(testUser2._id).then(function(response) {
                    assert.equal(helpers.getFindOneCallCount("conversations"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("conversations", 0)[0], {
                        _id: "bob,charlie"
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation exists", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.getConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 200);
                    done();
                });
            });
        });
        it("responds with a body that is a JSON representation of the conversation if user is authenticated " +
            "and conversation exists", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.getConversation(testUser2._id).then(function(response) {
                        assert.deepEqual(JSON.parse(response.body), {
                                id: "bob,charlie",
                                participants: ["bob", "charlie"]
                            });
                        done();
                    });
                });
            }
        );
        it("responds with status code 404 if user is authenticated and conversation does not exist", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.getConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 404);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                helpers.getConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("POST /api/conversations", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.postConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.postConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("adds conversation to database if user is authenticated", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                helpers.postConversation(testUser2._id).then(function(response) {
                    assert.equal(helpers.getInsertOneCallCount("conversations"), 1);
                    assert.deepEqual(helpers.getInsertOneArgs("conversations", 0)[0], {
                        _id: "bob,charlie",
                        participants: ["bob", "charlie"]
                    });
                    done();
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation is created successfully",
            function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", true, testUser2, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    helpers.postConversation(testUser2._id).then(function(response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the created conversation if conversation is " +
            "created successfully", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", true, testUser2, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    helpers.postConversation(testUser2._id).then(function(response) {
                        assert.deepEqual(JSON.parse(response.body), {
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
                helpers.authenticateUser(testGithubUser2, testUser2, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser2, 0);
                    helpers.setFindOneResult("users", true, testUser, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    helpers.postConversation(testUser2._id).then(function(response) {
                        assert.equal(JSON.parse(response.body).id, "bob,charlie");
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and sender does not exist", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, null, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                helpers.postConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find sender", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", false, {err: "Database failure"}, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                helpers.postConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and recipient does not exist", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, null, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                helpers.postConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find " +
            "recipient", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", false, {err: "Database failure"}, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    helpers.postConversation(testUser2._id).then(function(response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", false, {err: "Database failure"});
                helpers.postConversation(testUser2._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
    describe("POST /api/messages", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("adds message with correct ID, contents, and valid timestamp to database if user is authenticated, " +
            "conversation exists, and sender is a participant", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    var beforeTimestamp = new Date();
                    helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                        var afterTimestamp = new Date();
                        assert.equal(helpers.getInsertOneCallCount("messages"), 1);
                        var insertedMessage = helpers.getInsertOneArgs("messages", 0)[0];
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
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.postMessage(testMessage.conversationID, "").then(function(response) {
                        assert.equal(response.statusCode, 201);
                        assert.equal(helpers.getInsertOneCallCount("messages"), 0);
                        done();
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, sender is a participant, " +
            "and message is created successfully", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the created message if message is " +
            "created successfully", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                        var receivedMessage = JSON.parse(response.body);
                        var receivedTimestamp = new Date(receivedMessage.timestamp);
                        assert.equal(receivedMessage.conversationID, testConversation._id);
                        assert.equal(receivedMessage.contents, testMessage.contents);
                        assert.equal(receivedTimestamp.getTime(), testMessage.timestamp.getTime());
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and conversation does not exist", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.setInsertOneResult("messages", true, testMessage);
                helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find conversation",
            function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
        it("responds with status code 403 if user is authenticated and conversation exists but user is not " +
            "participant in conversation", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation2);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.postMessage(testConversation2._id, testMessage.contents).then(function(response) {
                        assert.equal(response.statusCode, 403);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert " +
            "message", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", false, {err: "Database failure"});
                    helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                        assert.equal(response.statusCode, 500);
                        done();
                    });
                });
            }
        );
    });
    describe("GET /api/messages", function() {
        it("responds with status code 401 if user not authenticated", function(done) {
            helpers.getMessages(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function(done) {
            helpers.setSessionToken(testExpiredToken);
            helpers.getMessages(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
                done();
            });
        });
        it("makes database requests with the conversation ID sent in the request body",
            function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                    helpers.getMessages(testConversation._id).then(function(response) {
                        assert.equal(helpers.getFindOneCallCount("conversations"), 1);
                        assert.deepEqual(helpers.getFindAnyArgs("conversations", 0)[0], {
                            _id: testConversation._id
                        });
                        assert.equal(helpers.getFindCallCount("messages"), 1);
                        assert.deepEqual(helpers.getFindAnyArgs("messages", 0)[0], {
                            conversationID: testConversation._id
                        });
                        done();
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, and user is a participant",
            function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                    helpers.getMessages(testConversation._id).then(function(response) {
                        assert.equal(response.statusCode, 200);
                        done();
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the messages in the conversation if user is " +
            "authenticated, conversation exists, and user is a participant", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                    helpers.getMessages(testConversation._id).then(function(response) {
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
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setFindResult("messages", false, {err: "Database failure"});
                helpers.getMessages(testConversation._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 403 if user is authenticated and conversation exists, but user is not a " +
            "participant", function(done) {
                helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation2);
                    helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                    helpers.getMessages(testConversation2._id).then(function(response) {
                        assert.equal(response.statusCode, 403);
                        done();
                    });
                });
            }
        );
        it("responds with status code 500 if user is authenticated but conversation does not exist", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.getMessages(testConversation._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
        it("responds with status code 500 if database error on find conversation", function(done) {
            helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.getMessages(testConversation._id).then(function(response) {
                    assert.equal(response.statusCode, 500);
                    done();
                });
            });
        });
    });
});
