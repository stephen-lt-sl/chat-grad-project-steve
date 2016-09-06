/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .controller("ConversationsSectionController", ConversationsSectionController);

    ConversationsSectionController.$inject = ["$scope", "chatDataService"];

    function ConversationsSectionController($scope, chatDataService) {
        /* jshint validthis: true */
        var vm = this;

        vm.conversations = {};

        vm.submitMessage = submitMessage;

        vm.getUserName = getUserName;
        vm.getDisplayedConversationsData = getDisplayedConversationsData;
        vm.getMessages = getMessages;

        vm.conversationBoxSizes = {
            width: 350,
            header: 35,
            messages: 335,
            send: 30,
            buttonWidth: 50,
            totalHeight: function() {
                return (
                    vm.conversationBoxSizes.header +
                    vm.conversationBoxSizes.messages +
                    vm.conversationBoxSizes.send
                );
            },
            sendBoxWidth: function() {
                return (
                    vm.conversationBoxSizes.width -
                    vm.conversationBoxSizes.buttonWidth
                );
            }
        };

        vm.getSize = getSize;
        vm.conversationName = conversationName;
        vm.timestampString = timestampString;

        activate();

        function activate() {
            $scope.notificationHandlers.new_messages.push(onNewMessagesReceived);
            $scope.conversationControls.toggleConversation = toggleConversation;
        }

        function onNewMessagesReceived(notificationData) {
            if (vm.conversations[notificationData.conversationID]) {
                // If we have the conversation open, refresh it
                return refreshConversation(notificationData.conversationID);
            } else {
                $scope.setMessagesUnread({
                    otherID: notificationData.otherID,
                    messageCount: notificationData.messageCount
                });
                return Promise.resolve();
            }
        }

        /*
         * Handle conversation data
         */

        function toggleConversation(recipientID) {
            return chatDataService.getConversation(recipientID).then(function(conversationResponse) {
                if (vm.conversations[conversationResponse.data.id]) {
                    delete vm.conversations[conversationResponse.data.id];
                } else {
                    displayConversation(conversationResponse.data);
                }
                return conversationResponse;
            }).catch(function() {
                return chatDataService.createConversation(recipientID).then(function(conversationResponse) {
                    displayConversation(conversationResponse.data);
                });
            }).catch(function(errorResponse) {
                console.log("Failed to setup conversation. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        // If the conversation with the given ID exists in the client, updates the conversation from the server
        // (including fetching messages)
        function refreshConversation(conversationID) {
            if (!vm.conversations[conversationID]) {
                return Promise.reject();
            }
            var recipientID = getOtherID(vm.conversations[conversationID].data);
            return chatDataService.getConversation(recipientID).then(function(conversationResponse) {
                displayConversation(conversationResponse.data);
            });
        }

        // If the given conversation is already being displayed, updates the current version to match, otherwise adds
        // the conversation to the display list
        function displayConversation(newConversationData) {
            if (!vm.conversations[newConversationData.id]) {
                vm.conversations[newConversationData.id] = {
                    data: newConversationData,
                    messageEntryText: "",
                    messages: []
                };
                refreshMessages(newConversationData.id);
            } else {
                var oldTimestamp = vm.conversations[newConversationData.id].data.lastTimestamp;
                vm.conversations[newConversationData.id].data = newConversationData;
                refreshMessages(newConversationData.id, oldTimestamp);
            }
        }

        // Updates the message history for the conversation with the given ID, and returns a promise with the
        // server response
        function refreshMessages(conversationID, fromTimestamp) {
            var params;
            if (fromTimestamp) {
                if (vm.conversations[conversationID]) {
                    params = {
                        timestamp: fromTimestamp
                    };
                }
            }
            return chatDataService.getConversationMessages(conversationID, params).then(
                function(messageResponse) {
                    var conversation = vm.conversations[conversationID];
                    if (conversation) {
                        var newMessages = messageResponse.data;
                        if (fromTimestamp) {
                            newMessages = newMessages.filter(function(message) {
                                return Date.parse(message.timestamp) > Date.parse(conversation.lastTimestamp);
                            });
                        }
                        conversation.messages = conversation.messages.concat(messageResponse.data);
                        onConversationUpdated(conversation);
                    }
                    return messageResponse;
                }
            ).catch(function(errorResponse) {
                console.log("Failed to update messages. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        function onConversationUpdated(conversation) {
            var otherID = getOtherID(conversation.data);
            $scope.setMessagesUnread({
                otherID: otherID,
                messageCount: 0
            });
        }

        function getOtherID(conversationData) {
            var otherParticipants = conversationData.participants.filter(function(participant) {
                return participant !== $scope.user()._id;
            });
            if (otherParticipants.length > 0) {
                return otherParticipants[0];
            } else {
                return $scope.user()._id;
            }
        }

        /*
         * Handle message data
         */

        function submitMessage(conversationID) {
            var contents = vm.messageEntryTexts[conversationID];
            vm.messageEntryTexts[conversationID] = "";
            chatDataService.submitMessage(conversationID, contents).then(function(messageAddResult) {
                refreshConversation(conversationID);
            });
        }

        /*
         * Cosmetic functions
         */

        function getUserName(userID) {
            return $scope.getUserName({userID: userID});
        }
        function getDisplayedConversationsData() {
            var conversationsData = Object.keys(vm.conversations).map(function(key) {
                return vm.conversations[key].data;
            });
            return conversationsData;
        }
        function getMessages(conversationID) {
            return vm.conversations[conversationID].messages;
        }

        var messageTimestampFormatter = new Intl.DateTimeFormat("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
        });

        function timestampString(timestamp) {
            var date = new Date(timestamp);
            return "(" + messageTimestampFormatter.format(date) + ")";
        }
        function conversationName(conversationData) {
            var otherID = getOtherID(conversationData);
            return otherID === $scope.user()._id ? "Self" : vm.getUserName(otherID);
        }
        function getSize(property) {
            if (typeof(vm.conversationBoxSizes[property]) === "function") {
                return vm.conversationBoxSizes[property]() + "px";
            }
            return vm.conversationBoxSizes[property] + "px";
        }
    }
})();
