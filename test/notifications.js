/*global Promise*/
var server = require("../server/server");
var request = require("request-promise-native");
var assert = require("chai").assert;
var helpers = require("./serverHelpers");

var testUser = {
    _id: "bob",
    name: "Bob Bilson",
    avatarUrl: "http://avatar.url.com/u=test"
};
var testGithubUser = {
    login: "bob",
    name: "Bob Bilson",
    avatar_url: "http://avatar.url.com/u=test"
};
var testConversation = {
    _id: "bob,charlie",
    participants: ["bob", "charlie"]
};
var testToken = "123123";
var testExpiredToken = "987978";
var testNotification = {
    _id: "507f1f77bcf86cd799439011",
    userID: testUser._id,
    data: {
        conversationID: testConversation._id,
        messageCount: 2,
        since: new Date(2016, 8, 24, 14, 5, 4)
    }
};

describe("server", function() {
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);
    describe("GET /api/notifications", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getNotifications(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getNotifications(testConversation._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("makes database requests with the user's ID",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("notifications", true, [testNotification]);
                    return helpers.getNotifications(testConversation._id);
                }).then(function(response) {
                    assert.equal(helpers.getFindCallCount("notifications"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("notifications", 0)[0], {
                        userID: "bob"
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("notifications", true, [testNotification]);
                    return helpers.getNotifications(testConversation._id);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with a body that is a JSON representation of the user's notifications if user is authenticated",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("notifications", true, [testNotification]);
                    return helpers.getNotifications(testConversation._id);
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), [
                        {
                            id: "507f1f77bcf86cd799439011",
                            userID: testUser._id,
                            data: {
                                conversationID: testConversation._id,
                                messageCount: 2,
                                since: new Date(2016, 8, 24, 14, 5, 4).toISOString()
                            }
                        }
                    ]);
                });
            }
        );
        it("responds with status code 500 if database error on find notifications", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("notifications", false, {err: "Database failure"});
                return helpers.getNotifications(testConversation._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
});
