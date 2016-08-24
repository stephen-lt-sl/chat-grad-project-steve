/*global console*/
(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        $scope.loggedIn = false;
        $scope.conversations = [];

        $scope.getConversation = getConversation;
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

        function addConversation(newConversationData) {
            var conversationIdx = $scope.conversations.findIndex(function(conversation) {
                return conversation.data.id === newConversationData.id;
            });
            if (conversationIdx === -1) {
                console.log("Adding new conversation with " + newConversationData.id);
                $scope.conversations.push({
                    data: newConversationData,
                    messageEntryText: "",
                    messages: []
                });
                getMessages($scope.conversations.length - 1);
            } else {
                console.log("Updating conversation with " + newConversationData.id);
                $scope.conversations[conversationIdx].data = newConversationData;
                getMessages(conversationIdx);
            }
        }

        function getConversation(recipientID) {
            console.log($scope.users);
            console.log(recipientID);
            console.log({recipient: recipientID});
            console.log(JSON.stringify({recipient: recipientID}));
            $http.get("/api/conversations/" + recipientID).then(function(conversationResult) {
                console.log("Updating conversation with");
                console.log(conversationResult);
                addConversation(conversationResult.data);
            }, function() {
                $http({
                    method: "POST",
                    url: "/api/conversations/",
                    headers: {
                        "Content-type": "application/json"
                    },
                    data: JSON.stringify({recipient: recipientID})
                }).then(function(conversationResult) {
                    console.log("Adding new conversation with");
                    console.log(conversationResult);
                    addConversation(conversationResult.data);
                });
            });
        }

        function getMessages(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            console.log("Getting new messages from: " + conversationID);
            $http.get("/api/messages/" + conversationID).then(function(messagesResult) {
                console.log("Got new messages for: " + conversationID);
                $scope.conversations[idx].messages = messagesResult.data;
            });
        }

        function sendMessage(idx) {
            var conversationID = $scope.conversations[idx].data.id;
            console.log("Sending message to: " + conversationID);
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
                console.log("Message added successfully");
                getMessages(idx);
            });
            $scope.conversations[idx].messageEntryText = "";
        }
    });
})();
