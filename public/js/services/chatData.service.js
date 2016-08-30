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
            submitMessage: submitMessage
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

        function getConversationMessages(conversationID) {
            return $http.get("/api/messages/" + conversationID);
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
    }
})();
