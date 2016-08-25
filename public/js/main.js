/*global console*/
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

        // Gets the conversation with the given recipient from the server, or creates a new conversation with the
        // recipient on the server if it does not already exist; afterwards the conversation is displayed in the client
        function openConversation(recipientID) {
            $http.get("/api/conversations/" + recipientID).then(function(conversationResult) {
                // Conversation received from server
                displayConversation(conversationResult.data);
            }, function() {
                // Conversation not received, create new conversation with recipient
                $http({
                    method: "POST",
                    url: "/api/conversations/",
                    headers: {
                        "Content-type": "application/json"
                    },
                    data: JSON.stringify({recipient: recipientID})
                }).then(function(conversationResult) {
                    displayConversation(conversationResult.data);
                });
            });
        }

        function getMessages(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            $http.get("/api/messages/" + conversationID).then(function(messagesResult) {
                $scope.conversations[idx].messages = messagesResult.data;
            });
        }

        function sendMessage(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            $http({
                method: "POST",
                url: "/api/messages",
                headers: {
                    "Content-type": "application/json"
                },
                data: JSON.stringify({
                    contents: $scope.conversations[idx].messageEntryText,
                    conversationID: conversationID
                })
            }).then(function(messageAddResult) {
                getMessages(idx);
            });
            $scope.conversations[idx].messageEntryText = "";
        }
    });
})();
