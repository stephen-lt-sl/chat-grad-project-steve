/*global Promise*/
var assert = require("chai").assert;
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
    timestamp: new Date(2016, 8, 24, 14, 5, 4)
};

describe("messages", function() {
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);

    describe("POST /api/messages", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.postMessage(testMessage.conversationID, testMessage.contents).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("adds message with correct ID, contents, and valid timestamp to database if user is authenticated, " +
            "conversation exists, and sender is a participant", function() {
                var beforeTimestamp;
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    beforeTimestamp = new Date();
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    var afterTimestamp = new Date();
                    assert.equal(helpers.getInsertOneCallCount("messages"), 1);
                    var insertedMessage = helpers.getInsertOneArgs("messages", 0)[0];
                    assert.equal(insertedMessage.conversationID, testConversation._id);
                    assert.equal(insertedMessage.contents, testMessage.contents);
                    assert.isAtLeast(insertedMessage.timestamp.getTime(), beforeTimestamp.getTime());
                    assert.isAtMost(insertedMessage.timestamp.getTime(), afterTimestamp.getTime());
                });
            }
        );
        it("attempts to upsert 'new_messages' notification for each participant if message is successfully added",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(helpers.getUpdateOneCallCount("notifications"), 2);
                    // Verify that notification upserts have been performed with correct values
                    // Query values
                    var upsertQuery = {
                        userID: "bob",
                        type: "new_messages",
                        "data.conversationID": testMessage.conversationID
                    };
                    // Update values
                    var upsertValue = {
                        $set: {
                            userID: "bob",
                            type: "new_messages",
                            "data.conversationID": testMessage.conversationID,
                            "data.since": testMessage.timestamp,
                            "data.otherID": "charlie"
                        },
                        $inc: {
                            "data.messageCount": 1
                        }
                    };
                    // Options
                    var upsertOptions = {
                        upsert: true
                    };
                    assert.deepEqual(helpers.getUpdateOneArgs("notifications", 0), [
                        upsertQuery, upsertValue, upsertOptions
                    ]);
                    upsertQuery.userID = "charlie";
                    upsertValue.$set.userID = "charlie";
                    upsertValue.$set["data.otherID"] = "bob";
                    assert.deepEqual(helpers.getUpdateOneArgs("notifications", 1), [
                        upsertQuery, upsertValue, upsertOptions
                    ]);
                });
            }
        );
        it("responds with status code 201 and creates no message if user is authenticated and message is blank",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, "");
                }).then(function(response) {
                    assert.equal(response.statusCode, 201);
                    assert.equal(helpers.getInsertOneCallCount("messages"), 0);
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, sender is a participant, " +
            "and message is created successfully", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("attempts to update the containing conversation's timestamp if message is created successfully",
            function() {
                var beforeTimestamp;
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(helpers.getUpdateOneCallCount("conversations"), 1);
                    var updateQuery = helpers.getUpdateOneArgs("conversations", 0)[0];
                    var updateObject = helpers.getUpdateOneArgs("conversations", 0)[1];
                    assert.deepEqual(updateQuery, {
                        _id: testMessage.conversationID
                    });
                    assert.deepEqual(updateObject, {
                        $set: {lastTimestamp: testMessage.timestamp}
                    });
                });
            }
        );
        it("responds with a body that is a JSON representation of the created message if message is " +
            "created successfully", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    var receivedMessage = JSON.parse(response.body);
                    var receivedTimestamp = new Date(receivedMessage.timestamp);
                    assert.equal(receivedMessage.conversationID, testConversation._id);
                    assert.equal(receivedMessage.contents, testMessage.contents);
                    assert.equal(receivedTimestamp.getTime(), testMessage.timestamp.getTime());
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "new_messages notification", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", false, {err: "Database failure"});
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "conversation timestamp", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", false, {err: "Database failure"});
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "new_messages notification", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", false, {err: "Database failure"});
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "conversation timestamp", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", false, {err: "Database failure"});
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "new_messages notification", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", false, {err: "Database failure"});
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if message insertion is valid but database error on update " +
            "conversation timestamp", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", false, {err: "Database failure"});
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 404 if user is authenticated and conversation does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.setInsertOneResult("messages", true, testMessage);
                helpers.setUpdateOneResult("notifications", true, null);
                helpers.setUpdateOneResult("conversations", true, null);
                return helpers.postMessage(testMessage.conversationID, testMessage.contents);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find conversation",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 500);
                });
            }
        );
        it("responds with status code 403 if user is authenticated and conversation exists but user is not " +
            "participant in conversation", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation2);
                    helpers.setInsertOneResult("messages", true, testMessage);
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testConversation2._id, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert " +
            "message", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    helpers.setInsertOneResult("messages", false, {err: "Database failure"});
                    helpers.setUpdateOneResult("notifications", true, null);
                    helpers.setUpdateOneResult("conversations", true, null);
                    return helpers.postMessage(testMessage.conversationID, testMessage.contents);
                }).then(function(response) {
                    assert.equal(response.statusCode, 500);
                });
            }
        );
    });
    describe("GET /api/messages/:id", function() {
        function validQuery(queryParams) {
            helpers.setFindOneResult("conversations", true, testConversation);
            helpers.setFindResult("messages", true, [testMessage, testMessage2]);
            helpers.setDeleteManyResult("notifications", true, null);
            return helpers.getMessages(testConversation._id, queryParams);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getMessages(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getMessages(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("makes database requests with the conversation ID sent in the request body",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(helpers.getFindOneCallCount("conversations"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("conversations", 0)[0], {
                        _id: testConversation._id
                    });
                    assert.equal(helpers.getFindCallCount("messages"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("messages", 0)[0], {
                        conversationID: testConversation._id
                    });
                });
            }
        );
        it("attempts to find only messages newer than the query timestamp if one exists", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery({
                        timestamp: new Date(2016, 8, 24, 14, 5, 2).toISOString()
                    });
                }).then(function(response) {
                    assert.equal(helpers.getFindCallCount("messages"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("messages", 0)[0], {
                        conversationID: testConversation._id,
                        timestamp: {
                            $gt: new Date(2016, 8, 24, 14, 5, 2)
                        }
                    });
                });
            }
        );
        it("attempts to delete the 'new_messages' notification for the user-conversation pair", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(helpers.getDeleteManyCallCount("notifications"), 1);
                    assert.deepEqual(helpers.getDeleteManyArgs("notifications", 0)[0], {
                        userID: testUser._id,
                        type: "new_messages",
                        "data.conversationID": testConversation._id
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, and user is a participant",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with a body that is a JSON representation of the messages in the conversation if user is " +
            "authenticated, conversation exists, and user is a participant", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
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
                            timestamp: new Date(2016, 8, 24, 14, 5, 4).toISOString()
                        }
                    ]);
                });
            }
        );
        it("responds with status code 200 if valid response but database error on clear notifications", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.setDeleteManyResult("notifications", false, {err: "Database failure"});
                return helpers.getMessages(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with status code 500 if database error on find messages", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setFindResult("messages", false, {err: "Database failure"});
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getMessages(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 403 if user is authenticated and conversation exists, but user is not a " +
            "participant", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation2);
                    helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                    helpers.setDeleteManyResult("notifications", true, null);
                    return helpers.getMessages(testConversation2._id);
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 404 if user is authenticated but conversation does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getMessages(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error on find conversation", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getMessages(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("GET /api/messages/:id/count", function() {
        function validQuery(queryParams) {
            helpers.setFindOneResult("conversations", true, testConversation);
            helpers.setCountResult("messages", true, 2);
            return helpers.getMessageCount(testConversation._id, queryParams);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getMessageCount(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getMessageCount(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("makes database requests with the conversation ID sent in the request body",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(helpers.getFindOneCallCount("conversations"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("conversations", 0)[0], {
                        _id: testConversation._id
                    });
                    assert.equal(helpers.getCountCallCount("messages"), 1);
                    assert.deepEqual(helpers.getCountArgs("messages", 0)[0], {
                        conversationID: testConversation._id
                    });
                });
            }
        );
        it("attempts to find only messages newer than the query timestamp if one exists", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery({
                        timestamp: new Date(2016, 8, 24, 14, 5, 2).toISOString()
                    });
                }).then(function(response) {
                    assert.equal(helpers.getCountCallCount("messages"), 1);
                    assert.deepEqual(helpers.getCountArgs("messages", 0)[0], {
                        conversationID: testConversation._id,
                        timestamp: {
                            $gt: new Date(2016, 8, 24, 14, 5, 2)
                        }
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated, conversation exists, and user is a participant",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with a body that is a JSON representation of the number of messages in the conversation if " +
            "user is authenticated, conversation exists, and user is a participant",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {count: 2});
                });
            }
        );
        it("responds with status code 200 if valid response but database error on clear notifications", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setFindResult("messages", true, [testMessage, testMessage2]);
                helpers.setDeleteManyResult("notifications", false, {err: "Database failure"});
                return helpers.getMessages(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with status code 500 if database error on find messages", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setCountResult("messages", false, {err: "Database failure"});
                return helpers.getMessageCount(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on find message count", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                helpers.setCountResult("messages", false, {err: "Database failure"});
                return helpers.getMessageCount(testConversation._id, {countOnly: true});
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 403 if user is authenticated and conversation exists, but user is not a " +
            "participant", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation2);
                    helpers.setCountResult("messages", true, 2);
                    return helpers.getMessageCount(testConversation2._id);
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 404 if user is authenticated but conversation does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                helpers.setCountResult("messages", true, 2);
                return helpers.getMessageCount(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error on find conversation", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                helpers.setCountResult("messages", true, 2);
                return helpers.getMessageCount(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
});
