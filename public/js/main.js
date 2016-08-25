/*global console*/
/*global Promise*/
(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        $scope.loggedIn = false;
        $scope.conversations = [];

        $scope.getConversation = openConversation;
        $scope.sendMessage = sendMessage;

        $http.get("/api/user").then(function(userResult) {
            $scope.loggedIn = true;
            $scope.user = userResult.data;
            $http.get("/api/users").then(function(result) {
                $scope.users = result.data;
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        function displayConversation(newConversationData) {
            var conversationIdx = $scope.conversations.findIndex(function(conversation) {
                return conversation.data.id === newConversationData.id;
            });
            if (conversationIdx === -1) {
                $scope.conversations.push({
                    data: newConversationData,
                    messageEntryText: "",
                    messages: []
                });
                getMessages($scope.conversations.length - 1);
            } else {
                $scope.conversations[conversationIdx].data = newConversationData;
                getMessages(conversationIdx);
            }
        }

        // Returns a promise whose "then" receives the conversation with the recipient
        function setupConversation(recipientID) {
            return $http.get("/api/conversations/" + recipientID).then(function(conversationResult) {
                return conversationResult;
            }, function() {
                // Conversation not received, create new conversation with recipient
                return $http({
                    method: "POST",
                    url: "/api/conversations/",
                    headers: {
                        "Content-type": "application/json"
                    },
                    data: JSON.stringify({recipient: recipientID})
                });
            }).then(function(conversationResult) {
                return conversationResult.data;
            });
        }

        // Gets the conversation with the given recipient from the server, or creates a new conversation with the
        // recipient on the server if it does not already exist; afterwards the conversation is displayed in the client
        function openConversation(recipientID) {
            setupConversation(recipientID).then(function(conversation) {
                displayConversation(conversation);
            });
        }

        function getMessages(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            return $http.get("/api/messages/" + conversationID).then(function(messagesResult) {
                $scope.conversations[idx].messages = messagesResult.data;
            });
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

        function sendMessage(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            var contents = $scope.conversations[idx].messageEntryText;
            $scope.conversations[idx].messageEntryText = "";
            submitMessage(conversationID, contents).then(function(messageAddResult) {
                getMessages(idx);
            });
        }
    });
})();
