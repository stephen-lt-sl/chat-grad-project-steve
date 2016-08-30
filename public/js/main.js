/*global console*/
/*global Promise*/
(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        $scope.loggedIn = false;
        $scope.conversations = [];

        $scope.openConversation = openConversation;
        $scope.sendMessage = sendMessage;

        $http.get("/api/user").then(function(userResult) {
            $scope.loggedIn = true;
            $scope.user = userResult.data;
            $http.get("/api/users").then(function(result) {
                $scope.users = result.data;
            });
        }).catch(function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });

        // If the given conversation is already being displayed, updates the current version to match, otherwise adds
        // the conversation to the display list
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
                refreshMessages(newConversationData.id);
            } else {
                $scope.conversations[conversationIdx].data = newConversationData;
                refreshMessages(newConversationData.id);
            }
        }

        // Returns a promise whose `then` receives the conversation with the recipient, and whose `catch` receives
        // the failed response from the server
        function setupConversation(recipientID) {
            return $http.get("/api/conversations/" + recipientID).then(function(conversationResponse) {
                return conversationResponse;
            }).catch(function() {
                // Conversation not received, create new conversation with recipient
                return $http({
                    method: "POST",
                    url: "/api/conversations/",
                    headers: {
                        "Content-type": "application/json"
                    },
                    data: JSON.stringify({recipient: recipientID})
                });
            }).then(function(conversationResponse) {
                return conversationResponse.data;
            }).catch(function(errorResponse) {
                console.log("Failed to setup conversation. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        // Gets the conversation with the given recipient from the server, or creates a new conversation with the
        // recipient on the server if it does not already exist; afterwards the conversation is displayed in the client
        function openConversation(recipientID) {
            setupConversation(recipientID).then(function(conversation) {
                displayConversation(conversation);
            });
        }

        // Updates the message history for the conversation with the given ID, and returns a promise with the
        // server response
        function refreshMessages(conversationID) {
            return $http.get("/api/messages/" + conversationID).then(function(messageResponse) {
                var conversationIdx = $scope.conversations.findIndex(function(conversation) {
                    return conversation.data.id === conversationID;
                });
                $scope.conversations[conversationIdx].messages = messageResponse.data;
                return messageResponse;
            }).catch(function(errorResponse) {
                console.log("Failed to update messages. Server returned code " + errorResponse.status + ".");
                return errorResponse;
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
                refreshMessages(conversationID);
            });
        }
    });
})();
