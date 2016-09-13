/*global Promise*/
var assert = require("chai").assert;
var helpers = require("./serverHelpers");
var ObjectID = require("mongodb").ObjectID;

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
var testToken = "123123";
var testExpiredToken = "987978";
var testGroup = {
    _id: "507f1f77bcf86cd799439011",
    name: "Test Group",
    description: "A test group",
    users: ["bob"]
};
var testGroup2 = {
    _id: "507f1f77bcf86cd799439012",
    name: "Test Group",
    description: "A test group",
    users: ["charlie"]
};
var testGroup3 = {
    _id: "507f1f77bcf86cd799439013",
    name: "Test Group",
    description: "A test group",
    users: ["bob", "charlie"]
};

describe("groups", function() {
    beforeEach(helpers.setupServer);
    afterEach(helpers.teardownServer);

    describe("GET /api/groups/", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getGroups().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getGroups().then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find all groups in the database if user is authenticated and no query parameters are set",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("groups", true, [testGroup]);
                    helpers.setDeleteManyResult("notifications", true, null);
                    return helpers.getGroups();
                }).then(function(response) {
                    assert.equal(helpers.getFindCallCount("groups"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {});
                });
            }
        );
        it("attempts to find only groups that the user has joined if user is authenticated and `joinedOnly` query " +
            "parameter is set to true", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("groups", true, [testGroup]);
                    helpers.setDeleteManyResult("notifications", true, null);
                    return helpers.getGroups({joinedOnly: true});
                }).then(function(response) {
                    assert.equal(helpers.getFindCallCount("groups"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                        users: testUser._id
                    });
                });
            }
        );
        it("attempts to find only groups that match the given search string if user is authenticated and " +
            "`searchString` query parameter is set", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("groups", true, [testGroup]);
                    helpers.setDeleteManyResult("notifications", true, null);
                    return helpers.getGroups({searchString: "Test Group"});
                }).then(function(response) {
                    assert.equal(helpers.getFindCallCount("groups"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                        $text: {
                            $search: "Test Group"
                        }
                    });
                });
            }
        );
        it("attempts to delete any of the user's 'group_changed' notifications for the groups found", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindResult("groups", true, [testGroup]);
                    helpers.setDeleteManyResult("notifications", true, null);
                    return helpers.getGroups();
                }).then(function(response) {
                    assert.equal(helpers.getDeleteManyCallCount("notifications"), 1);
                    assert.deepEqual(helpers.getDeleteManyArgs("notifications", 0)[0], {
                        userID: testUser._id,
                        type: "group_changed",
                        "data.groupID": {$in: [testGroup._id]}
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("groups", true, [testGroup]);
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getGroups();
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with a body that is a JSON representation of all groups if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("groups", true, [testGroup]);
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getGroups();
            }).then(function(response) {
                assert.deepEqual(JSON.parse(response.body), [{
                    id: testGroup._id,
                    name: testGroup.name,
                    description: testGroup.description,
                    users: testGroup.users
                }]);
            });
        });
        it("responds with status code 500 if database error on find", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindResult("groups", false, {err: "Database failure"});
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getGroups();
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("GET /api/groups/:id", function() {
        function validQuery() {
            helpers.setFindOneResult("groups", true, testGroup);
            helpers.setDeleteManyResult("notifications", true, null);
            return helpers.getGroup(testGroup._id);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.getGroup(testGroup._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.getGroup(testGroup._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find the group with the given ID if user is authenticated",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(helpers.getFindOneCallCount("groups"), 1);
                    assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {_id: new ObjectID(testGroup._id)});
                });
            }
        );
        it("attempts to the user's 'group_changed' notification for the group found", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.equal(helpers.getDeleteManyCallCount("notifications"), 1);
                    assert.deepEqual(helpers.getDeleteManyArgs("notifications", 0)[0], {
                        userID: testUser._id,
                        type: "group_changed",
                        "data.groupID": testGroup._id
                    });
                });
            }
        );
        it("responds with status code 200 if user is authenticated", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validQuery();
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with a body that is a JSON representation of the group found if user is authenticated",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: testGroup._id,
                        name: testGroup.name,
                        description: testGroup.description,
                        users: testGroup.users
                    });
                });
            }
        );
        it("responds with status code 200 if valid query but database error on delete notifications", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup);
                helpers.setDeleteManyResult("notifications", false, {err: "Database failure"});
                return helpers.getGroup(testGroup._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with status code 500 if database error on find", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"});
                helpers.setDeleteManyResult("notifications", true, null);
                return helpers.getGroup(testGroup._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("POST /api/groups/", function() {
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.postGroup(testGroup.name, testGroup.description).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.postGroup(testGroup.name, testGroup.description).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find a group with the given name in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null);
                helpers.setInsertOneResult("groups", true, testGroup);
                return helpers.postGroup(testGroup.name, testGroup.description);
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                    name: testGroup.name
                });
            });
        });
        it("responds with status code 200 if user is authenticated and no group with the given name already exists",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, null);
                    helpers.setInsertOneResult("groups", true, testGroup);
                    return helpers.postGroup(testGroup.name, testGroup.description);
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with a body that is a JSON representation of the newly created group if user is authenticated " +
            "and no group with the given name already exists", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, null);
                    helpers.setInsertOneResult("groups", true, testGroup);
                    return helpers.postGroup(testGroup.name, testGroup.description);
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: testGroup._id,
                        name: testGroup.name,
                        description: testGroup.description,
                        users: ["bob"]
                    });
                });
            }
        );
        it("responds with status code 500 if database error on insert", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null);
                helpers.setInsertOneResult("groups", false, {err: "Database failure"});
                return helpers.postGroup(testGroup.name, testGroup.description);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 409 if user is authenticated but group with given name already exists",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, {_id: new ObjectID(testGroup2._id)});
                    helpers.setInsertOneResult("groups", true, testGroup);
                    return helpers.postGroup(testGroup.name, testGroup.description);
                }).then(function(response) {
                    assert.equal(response.statusCode, 409);
                });
            }
        );
        it("responds with status code 500 if database error on findOne", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"});
                helpers.setInsertOneResult("groups", true, testGroup);
                return helpers.postGroup(testGroup.name, testGroup.description);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("PUT /api/groups/:id/update", function() {
        var updatedTestGroup = {
            _id: "507f1f77bcf86cd799439011",
            name: "New Test Group",
            description: "A test group",
            users: ["bob"]
        };
        function validUpdateQuery() {
            helpers.setFindOneResult("groups", true, testGroup, 0);
            helpers.setFindOneResult("groups", true, null, 1);
            helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
            helpers.setUpdateOneResult("notifications", true, null);
            return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.updateGroup(testGroup._id, {name: "New Test Group"}).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.updateGroup(testGroup._id, {name: "New Test Group"}).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find a group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validUpdateQuery();
            }).then(function(response) {
                assert.isAtLeast(helpers.getFindOneCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update the group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validUpdateQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update a group in the database with the update parameters given in the request", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validUpdateQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[1], {
                    $set: {
                        name: "New Test Group"
                    }
                });
            });
        });
        it("does not attempt to `set` any of: fields that are undefined, the '_id' field, or the 'users' field",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup, 0);
                    helpers.setFindOneResult("groups", true, null, 1);
                    helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                    return helpers.updateGroup(testGroup._id, {
                        name: "New Test Group",
                        testField: "New value",
                        _id: "New ID",
                        users: "New users"
                    });
                }).then(function(response) {
                    assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                    assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[1], {
                        $set: {
                            name: "New Test Group"
                        }
                    });
                });
            }
        );
        it("attempts to add a `group_changed` notification for each user in the group other than the user who " +
            "performed the change", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup3, 0);
                    helpers.setFindOneResult("groups", true, null, 1);
                    helpers.setFindOneAndUpdateResult("groups", true, {
                        _id: "507f1f77bcf86cd799439013",
                        name: "New Test Group",
                        description: "A test group",
                        users: ["bob", "charlie"]
                    });
                    helpers.setUpdateOneResult("notifications", true, null);
                    return helpers.updateGroup(testGroup3._id, {name: "New Test Group"});
                }).then(function(response) {
                    assert.equal(helpers.getUpdateOneCallCount("notifications"), 1);
                    var timestamp = helpers.getUpdateOneArgs("notifications", 0)[1].$set["data.since"];
                    assert.deepEqual(helpers.getUpdateOneArgs("notifications", 0), [
                        {
                            userID: "charlie",
                            type: "group_changed",
                            "data.groupID": testGroup3._id,
                        }, {
                            $set: {
                                userID: "charlie",
                                type: "group_changed",
                                "data.groupID": testGroup3._id,
                                "data.since": timestamp,
                            }
                        }, {
                            upsert: true
                        }
                    ]);
                });
            }
        );
        it("responds with status code 200 if user is authenticated, group exists, and user is member of group",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validUpdateQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with body that is a JSON representation of the group returned by the database if user is " +
            "authenticated, group exists, and user is member of group", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validUpdateQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: updatedTestGroup._id,
                        name: updatedTestGroup.name,
                        description: updatedTestGroup.description,
                        users: updatedTestGroup.users
                    });
                });
            }
        );
        it("responds with status code 200 if valid update query that does not require name validation", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup, 0);
                helpers.setFindOneResult("groups", true, null, 1);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.updateGroup(testGroup._id, {description: "A new test group"});
            }).then(function(response) {
                assert.equal(response.statusCode, 200);
            });
        });
        it("responds with status code 200 if valid update query that sets the name field to its original value",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup, 0);
                    helpers.setFindOneResult("groups", true, {_id: new ObjectID(testGroup._id)}, 1);
                    helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                    return helpers.updateGroup(testGroup._id, {name: testGroup.name, description: "A new test group"});
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 200 if valid update query but database failure on add notifications",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup3, 0);
                    helpers.setFindOneResult("groups", true, {_id: new ObjectID(testGroup3._id)}, 1);
                    helpers.setFindOneAndUpdateResult("groups", true, {
                        _id: "507f1f77bcf86cd799439013",
                        name: "New Test Group",
                        description: "A test group",
                        users: ["bob", "charlie"]
                    });
                    helpers.setUpdateOneResult("notifications", false, {err: "Database failure"});
                    return helpers.updateGroup(testGroup3._id, {name: "New Test Group"});
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with status code 403 if user is authenticated, group exists, but user is not member of group",
            function() {
                return helpers.authenticateUser(testGithubUser2, testUser2, testToken).then(function() {
                    return validUpdateQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 404 if user is authenticated, but group does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null, 0);
                helpers.setFindOneResult("groups", true, null, 1);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 409 if user is authenticated and group exists but updated name is already in " +
            "use", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup, 0);
                    helpers.setFindOneResult("groups", true, {_id: new ObjectID(testGroup2._id)}, 1);
                    helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                    return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
                }).then(function(response) {
                    assert.equal(response.statusCode, 409);
                });
            }
        );
        it("responds with status code 500 if database error on findOneAndUpdate", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup, 0);
                helpers.setFindOneResult("groups", true, null, 1);
                helpers.setFindOneAndUpdateResult("groups", false, {err: "Database failure"});
                return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on findOne during group validation", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"}, 0);
                helpers.setFindOneResult("groups", true, null, 1);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on findOne during name validation", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup, 0);
                helpers.setFindOneResult("groups", false, {err: "Database failure"}, 1);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.updateGroup(testGroup._id, {name: "New Test Group"});
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("PUT /api/groups/:id/invite", function() {
        var updatedTestGroup = {
            _id: "507f1f77bcf86cd799439011",
            name: "Test Group",
            description: "A test group",
            users: ["bob", "charlie"]
        };
        function validInviteQuery() {
            helpers.setFindOneResult("groups", true, testGroup);
            helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
            helpers.setUpdateOneResult("notifications", true, null);
            return helpers.inviteToGroup(testGroup._id, ["charlie"]);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.inviteToGroup(testGroup._id, ["charlie"]).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.inviteToGroup(testGroup._id, ["charlie"]).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find a group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validInviteQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update the group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validInviteQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update a group in the database with the update parameters given in the request", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validInviteQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[1], {
                    $addToSet: {
                        users: {$each: ["charlie"]}
                    }
                });
            });
        });
        it("responds with status code 200 if user is authenticated, group exists, and user is member of group",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validInviteQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with body that is a JSON representation of the group returned by the database if user is " +
            "authenticated, group exists, and user is member of group", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validInviteQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: updatedTestGroup._id,
                        name: updatedTestGroup.name,
                        description: updatedTestGroup.description,
                        users: updatedTestGroup.users
                    });
                });
            }
        );
        it("responds with status code 403 if user is authenticated, group exists, but user is not member of group",
            function() {
                return helpers.authenticateUser(testGithubUser2, testUser2, testToken).then(function() {
                    return validInviteQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 404 if user is authenticated, but group does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.inviteToGroup(testGroup._id, ["charlie"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error on findOneAndUpdate", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup);
                helpers.setFindOneAndUpdateResult("groups", false, {err: "Database failure"});
                return helpers.inviteToGroup(testGroup._id, ["charlie"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on findOne", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"});
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.inviteToGroup(testGroup._id, ["charlie"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("PUT /api/groups/:id/remove", function() {
        var updatedTestGroup = {
            _id: "507f1f77bcf86cd799439011",
            name: "New Test Group",
            description: "A test group",
            users: []
        };
        function validRemoveQuery() {
            helpers.setFindOneResult("groups", true, testGroup);
            helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
            helpers.setUpdateOneResult("notifications", true, null);
            return helpers.removeFromGroup(testGroup._id, ["bob"]);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.removeFromGroup(testGroup._id, ["bob"]).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.removeFromGroup(testGroup._id, ["bob"]).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find a group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validRemoveQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update the group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validRemoveQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update a group in the database with the update parameters given in the request", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validRemoveQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[1], {
                    $pull: {
                        users: {$in: ["bob"]}
                    }
                });
            });
        });
        it("responds with status code 200 if user is authenticated, group exists, user is member of group, and" +
            "removal is valid", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validRemoveQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with body that is a JSON representation of the group returned by the database if user is " +
            "authenticated, group exists, user is member of group, and removal is valid", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validRemoveQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: updatedTestGroup._id,
                        name: updatedTestGroup.name,
                        description: updatedTestGroup.description,
                        users: updatedTestGroup.users
                    });
                });
            }
        );
        it("responds with status code 403 if user is authenticated, group exists, but user is not member of group",
            function() {
                return helpers.authenticateUser(testGithubUser2, testUser2, testToken).then(function() {
                    return validRemoveQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 403);
                });
            }
        );
        it("responds with status code 409 if user is authenticated, group exists, user is member of group, and user " +
            "attempts to remove a different user", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup);
                    helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                    return helpers.removeFromGroup(testGroup._id, ["charlie"]);
                }).then(function(response) {
                    assert.equal(response.statusCode, 409);
                });
            }
        );
        it("responds with status code 409 if user is authenticated, group exists, user is member of group, and user " +
            "attempts to remove more than one user", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    helpers.setFindOneResult("groups", true, testGroup);
                    helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                    return helpers.removeFromGroup(testGroup._id, ["bob", "charlie"]);
                }).then(function(response) {
                    assert.equal(response.statusCode, 409);
                });
            }
        );
        it("responds with status code 404 if user is authenticated, but group does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.removeFromGroup(testGroup._id, ["bob"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error on findOneAndUpdate", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup);
                helpers.setFindOneAndUpdateResult("groups", false, {err: "Database failure"});
                return helpers.removeFromGroup(testGroup._id, ["bob"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on findOne", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"});
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.removeFromGroup(testGroup._id, ["bob"]);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
    describe("PUT /api/groups/:id/join", function() {
        var updatedTestGroup = {
            _id: "507f1f77bcf86cd799439011",
            name: "Test Group",
            description: "A test group",
            users: ["bob", "charlie"]
        };
        function validJoinQuery() {
            helpers.setFindOneResult("groups", true, testGroup2);
            helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
            helpers.setUpdateOneResult("notifications", true, null);
            return helpers.joinGroup(testGroup._id);
        }
        it("responds with status code 401 if user not authenticated", function() {
            return helpers.joinGroup(testGroup._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("responds with status code 401 if user has an unrecognised session token", function() {
            helpers.setSessionToken(testExpiredToken);
            return helpers.joinGroup(testGroup._id).then(function(response) {
                assert.equal(response.statusCode, 401);
            });
        });
        it("attempts to find a group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validJoinQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindAnyArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update the group with the given id in the database", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validJoinQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[0], {
                    _id: new ObjectID(testGroup._id)
                });
            });
        });
        it("attempts to update a group in the database by adding the user's ID to `users`", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                return validJoinQuery();
            }).then(function(response) {
                assert.equal(helpers.getFindOneAndUpdateCallCount("groups"), 1);
                assert.deepEqual(helpers.getFindOneAndUpdateArgs("groups", 0)[1], {
                    $addToSet: {
                        users: {
                            $each: ["bob"]
                        }
                    }
                });
            });
        });
        it("responds with status code 200 if user is authenticated and group exists",
            function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validJoinQuery();
                }).then(function(response) {
                    assert.equal(response.statusCode, 200);
                });
            }
        );
        it("responds with body that is a JSON representation of the group returned by the database if user is " +
            "authenticated and group exists", function() {
                return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                    return validJoinQuery();
                }).then(function(response) {
                    assert.deepEqual(JSON.parse(response.body), {
                        id: updatedTestGroup._id,
                        name: updatedTestGroup.name,
                        description: updatedTestGroup.description,
                        users: updatedTestGroup.users
                    });
                });
            }
        );
        it("responds with status code 404 if user is authenticated, but group does not exist", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, null);
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.joinGroup(testGroup._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 404);
            });
        });
        it("responds with status code 500 if database error on findOneAndUpdate", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", true, testGroup);
                helpers.setFindOneAndUpdateResult("groups", false, {err: "Database failure"});
                return helpers.joinGroup(testGroup._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
        it("responds with status code 500 if database error on findOne", function() {
            return helpers.authenticateUser(testGithubUser, testUser, testToken).then(function() {
                helpers.setFindOneResult("groups", false, {err: "Database failure"});
                helpers.setFindOneAndUpdateResult("groups", true, updatedTestGroup);
                return helpers.joinGroup(testGroup._id);
            }).then(function(response) {
                assert.equal(response.statusCode, 500);
            });
        });
    });
});
