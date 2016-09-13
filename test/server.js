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
var testToken = "123123";
var testExpiredToken = "987978";

describe("server", function() {
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);
    describe("GET /oauth", function() {
        it("responds with status code 400 if oAuth authorise fails", function() {
            helpers.setAuthenticationFunction(function(req, callback) {
                callback(null);
            });

            return helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 400);
            });
        });
        it("responds with status code 302 if oAuth authorise succeeds", function() {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, testUser);

            return helpers.getOAuth(false).then(function(response) {
                assert.equal(response.statusCode, 302);
            });
        });
        it("responds with a redirect to '/' if oAuth authorise succeeds", function() {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, testUser);

            return helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 200);
                assert.equal(response.request.uri.path, "/");
            });
        });
        it("add user to database if oAuth authorise succeeds and user id not found", function() {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, null);
            helpers.setInsertOneResult("users", true, testUser);

            return helpers.getOAuth().then(function(response) {
                assert.equal(helpers.getInsertOneCallCount("users"), 1);
                assert.deepEqual(helpers.getInsertOneArgs("users", 0)[0], {
                    _id: "bob",
                    name: "Bob Bilson",
                    avatarUrl: "http://avatar.url.com/u=test"
                });
            });
        });
        it("responds with status code 500 if database error on find user", function() {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", false, {err: "Database failure"});
            helpers.setInsertOneResult("users", true, testUser);

            return helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on insert user", function() {
            var user = testGithubUser;
            helpers.setAuthenticationFunction(function(req, authCallback) {
                authCallback(user, testToken);
            });

            helpers.setFindOneResult("users", true, null);
            helpers.setInsertOneResult("users", false, {err: "Database failure"});

            return helpers.getOAuth().then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("GET /api/oauth/uri", function() {
        it("responds with status code 200", function() {
            return helpers.getOAuthUri().then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with a body encoded as JSON in UTF-8", function() {
            return helpers.getOAuthUri().then(function(response) {
                assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
            });
        });
        it("responds with a body that is a JSON object containing a URI to GitHub with a client id", function() {
            return helpers.getOAuthUri().then(function(response) {
                assert.deepEqual(JSON.parse(response.body), {
                    uri: helpers.getOAuthUriString()
                });
            });
        });
    });
    describe("GET /api/user", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getUser().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getUser().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find user with correct ID if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                return helpers.getUser();
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("users"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("users", 0)[0], {
                    _id: "bob"
                });
            });
        });
        it("responds with status code 200 if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                return helpers.getUser();
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", true, testUser);
                return helpers.getUser();
            }).then(function(response) {
                assert.deepEqual(JSON.parse(response.body), {
                    _id: "bob",
                    name: "Bob Bilson",
                    avatarUrl: "http://avatar.url.com/u=test"
                });
            });
        });
        it("responds with status code 500 if database error", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("users", false, {err: "Database failure"});
                return helpers.getUser();
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("GET /api/users", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getUsers().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getUsers().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 200 if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", true, [testUser]);
                return helpers.getUsers().then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            });
        });
        it("responds with a body that is a JSON representation of the user if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", true, [testUser, testUser2]);
                return helpers.getUsers();
            }).then(function(response) {
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
            });
        });
        it("responds with status code 500 if database error", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("users", false, {err: "Database failure"});
                return helpers.getUsers();
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
});
