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
var testToken = "123123";
var testExpiredToken = "987978";

describe("conversations", function() {
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);
    describe("GET /api/conversations/:id", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find conversation with correct ID if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                return helpers.getConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("conversations"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("conversations", 0)[0], {
                    _id: "bob,charlie"
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation exists", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, testConversation);
                return helpers.getConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with a body that is a JSON representation of the conversation if user is authenticated " +
            "and conversation exists", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("conversations", true, testConversation);
                    return helpers.getConversation(testUser2._id);
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: "bob,charlie",
                        participants: ["bob", "charlie"]
                    });
                });
            }
        );
        it("responds with status code 404 if user is authenticated and conversation does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", true, null);
                return helpers.getConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("conversations", false, {err: "Database failure"});
                return helpers.getConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("POST /api/conversations", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.postConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.postConversation(testUser2._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("adds conversation to database if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                return helpers.postConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(helpers.getInsertOneCallCount("conversations"), 1);
                assert.deepEqual(helpers.getInsertOneArgs("conversations", 0)[0], {
                    _id: "bob,charlie",
                    participants: ["bob", "charlie"]
                });
            });
        });
        it("responds with status code 200 if user is authenticated and conversation is created successfully",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", true, testUser2, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    return helpers.postConversation(testUser2._id);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with a body that is a JSON representation of the created conversation if conversation is " +
            "created successfully", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", true, testUser2, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    return helpers.postConversation(testUser2._id);
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: "bob,charlie",
                        participants: ["bob", "charlie"]
                    });
                });
            }
        );
        it("creates an identical conversation ID regardless of which participant creates the conversation",
            function() {
                return helpers.authenticateUser(testGithubUser2, testUser2, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser2, 0);
                    helpers.setFindOneResult("users", true, testUser, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    return helpers.postConversation(testUser2._id);
                }).then(function(response) {
                    assert.equal(JSON.parse(response.body).id, "bob,charlie");
                });
            }
        );
        it("responds with status code 404 if user is authenticated and sender does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, null, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                return helpers.postConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find sender", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", false, {err: "Database failure"}, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                return helpers.postConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 404 if user is authenticated and recipient does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, null, 1);
                helpers.setInsertOneResult("conversations", true, testConversation);
                return helpers.postConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if user is authenticated and database error on find " +
            "recipient", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("users", true, testUser, 0);
                    helpers.setFindOneResult("users", false, {err: "Database failure"}, 1);
                    helpers.setInsertOneResult("conversations", true, testConversation);
                    return helpers.postConversation(testUser2._id);
                }).then(function(response) {
                    assert.equal(response.statusCode, 500);
                });
            }
        );
        it("responds with status code 500 if user is authenticated and database error on insert", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser, 0);
                helpers.setFindOneResult("users", true, testUser2, 1);
                helpers.setInsertOneResult("conversations", false, {err: "Database failure"});
                return helpers.postConversation(testUser2._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
});
