/*global console*/
/*global Promise*/
(function() {
    var app = angular.module("ChatApp", []);

    app.controller("ChatController", function($scope, $http) {
        $scope.loggedIn = false;
        $scope.conversations = [];

        $scope.openConversation = openConversation;
        $scope.sendMessage = sendMessage;

        $scope.getUserName = getUserName;

        $scope.conversationBoxSizes = {
            width: 350,
            header: 35,
            messages: 335,
            send: 30,
            buttonWidth: 50,
            totalHeight: function() {
                return (
                    $scope.conversationBoxSizes.header +
                    $scope.conversationBoxSizes.messages +
                    $scope.conversationBoxSizes.send
                );
            },
            sendBoxWidth: function() {
                return (
                    $scope.conversationBoxSizes.width -
                    $scope.conversationBoxSizes.buttonWidth
                );
            }
        };
        $scope.getSize = function(property) {
            if (typeof($scope.conversationBoxSizes[property]) === "function") {
                return $scope.conversationBoxSizes[property]() + "px";
            }
            return $scope.conversationBoxSizes[property] + "px";
        };

        $scope.conversationName = function(conversation) {
            var otherParticipants = conversation.data.participants.filter(function(participant) {
                return participant !== $scope.user._id;
            });
            if (otherParticipants.length > 0) {
                return otherParticipants
                    .map(function(participant) {
                        return $scope.getUserName(participant);
                    })
                    .join(", ");
            } else {
                return "Self";
            }
        };
        $scope.timestampString = function(timestamp) {
            var date = new Date(timestamp);
            return "(" + new Intl.DateTimeFormat("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit"
            }).format(date) + ")";
        };

        activate();

        function activate() {
            $http.get("/api/user").then(function(userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                $http.get("/api/users").then(function(result) {
                    $scope.users = result.data;
                });
                setInterval(function() {
                    $scope.conversations.forEach(function(conversation) {
                        refreshMessages(conversation.data.id);
                    });
                }, 333);
            }).catch(function() {
                $http.get("/api/oauth/uri").then(function(result) {
                    $scope.loginUri = result.data.uri;
                });
            });
        }

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
                if (conversationIdx !== -1) {
                    $scope.conversations[conversationIdx].messages = messageResponse.data;
                }
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

        function getUserName(userID) {
            var userIdx = $scope.users.findIndex(function(user) {
                return user.id === userID;
            });
            return userIdx !== -1 ? $scope.users[userIdx].name : "unknown";
        }
    });

    app.directive("chatTrackingScrollBox", function() {
        return {
            restrict: "A",
            scope: {
                listenerList: "=chatTrackingScrollBox"
            },
            link: function(scope, element, attrs) {
                var lastScrollHeight = element[0].scrollHeight;
                var onUpdate = function() {
                    if (lastScrollHeight - element[0].scrollTop === element[0].clientHeight) {
                        element[0].scrollTop = element[0].scrollHeight - element[0].clientHeight;
                    }
                    lastScrollHeight = element[0].scrollHeight;
                };
                scope.$on("$destroy", function() {
                    scope.listenerList = scope.listenerList.filter(function(listener) {
                        return listener !== onUpdate;
                    });
                });
                scope.$watch(function() { return element[0].scrollHeight; }, function() {
                    onUpdate();
                });
            }
        };
    });
})();
