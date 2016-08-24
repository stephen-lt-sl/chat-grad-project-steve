/*global console*/
(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        $scope.loggedIn = false;
        $scope.conversations = [];

        $scope.getConversation = getConversation;

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

        function addConversation(newConversation) {
            var conversationIdx = $scope.conversations.findIndex(function(conversation) {
                return conversation.id === newConversation.id;
            });
            if (conversationIdx === -1) {
                console.log("Adding new conversation with " + newConversation.id);
                $scope.conversations.push(newConversation);
            } else {
                console.log("Updating conversation with " + newConversation.id);
                $scope.conversations[conversationIdx] = newConversation;
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
    });
})();
