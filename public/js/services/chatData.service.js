/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .factory("chatDataService", chatDataService);

    chatDataService.$inject = ["$http"];

    function chatDataService($http) {
        return {
            getSelf: getSelf,
            getUsers: getUsers,
            getOAuthUri: getOAuthUri,
            getConversation: getConversation,
            createConversation: createConversation,
            getConversationMessages: getConversationMessages,
            getConversationMessageCount: getConversationMessageCount,
            submitMessage: submitMessage,
            getNotifications: getNotifications,
            getGroups: getGroups,
            getGroup: getGroup,
            createGroup: createGroup,
            updateGroupInfo: updateGroupInfo,
            inviteUserToGroup: inviteUserToGroup,
            removeUserFromGroup: removeUserFromGroup,
            joinGroup: joinGroup
        };

        function getSelf() {
            return $http.get("/api/user");
        }

        function getUsers() {
            return $http.get("/api/users");
        }

        function getOAuthUri() {
            return $http.get("/api/oauth/uri");
        }

        function getConversation(recipientID) {
            return $http.get("/api/conversations/" + recipientID);
        }

        function createConversation(recipientID) {
            return $http({
                method: "POST",
                url: "/api/conversations/",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify({recipient: recipientID})
            });
        }

        function getConversationMessages(conversationID, params) {
            if (params) {
                return $http.get("/api/messages/" + conversationID, {params: params});
            } else {
                return $http.get("/api/messages/" + conversationID);
            }
        }

        function getConversationMessageCount(conversationID, params) {
            if (params) {
                return $http.get("/api/messages/" + conversationID + "/count", {params: params});
            } else {
                return $http.get("/api/messages/" + conversationID + "/count");
            }
        }

        function submitMessage(conversationID, contents) {
            return $http({
                method: "POST",
                url: "/api/messages",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify({
                    contents: contents,
                    conversationID: conversationID
                })
            });
        }

        function getNotifications() {
            return $http.get("/api/notifications/");
        }

        function getGroups(joinedOnly, searchString) {
            var queryParams = {};
            if (joinedOnly !== undefined) {
                queryParams.joinedOnly = joinedOnly;
            }
            if (searchString !== undefined) {
                queryParams.searchString = searchString;
            }
            return $http.get("/api/groups/", {params: queryParams});
        }

        function getGroup(groupID) {
            return $http.get("/api/groups/" + groupID);
        }

        function createGroup(name, description) {
            return $http({
                method: "POST",
                url: "/api/groups/",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify({
                    name: name,
                    description: description
                })
            });
        }

        function updateGroupInfo(groupID, name, description) {
            return $http({
                method: "PUT",
                url: "/api/groups/" + groupID + "/update",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify({
                    name: name,
                    description: description
                })
            });
        }

        function inviteUserToGroup(groupID, userID) {
            return $http({
                method: "PUT",
                url: "/api/groups/" + groupID + "/invite",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify([userID])
            });
        }

        function removeUserFromGroup(groupID, userID) {
            return $http({
                method: "PUT",
                url: "/api/groups/" + groupID + "/remove",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify([userID])
            });
        }

        function joinGroup(groupID) {
            return $http({
                method: "PUT",
                url: "/api/groups/" + groupID + "/join",
                headers: {
                    "Content-type": "application/json"
                }
            });
        }
    }
})();
