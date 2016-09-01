/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .controller("ChatController", ChatController);

    ChatController.$inject = ["chatDataService"];

    function ChatController(chatDataService) {
        /* jshint validthis: true */
        var vm = this;

        vm.loggedIn = false;
        vm.conversations = [];

        vm.openConversation = openConversation;
        vm.sendMessage = sendMessage;

        vm.getUserName = getUserName;

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
            chatDataService.getSelf().then(function(userResult) {
                vm.loggedIn = true;
                vm.user = userResult.data;
                chatDataService.getUsers().then(function(result) {
                    vm.users = result.data;
                });
                setInterval(function() {
                    vm.conversations.forEach(function(conversation) {
                        refreshMessages(conversation.data.id);
                    });
                }, 333);
            }).catch(function() {
                chatDataService.getOAuthUri().then(function(result) {
                    vm.loginUri = result.data.uri;
                });
            });
        }

        // If the given conversation is already being displayed, updates the current version to match, otherwise adds
        // the conversation to the display list
        function displayConversation(newConversationData) {
            var conversationIdx = vm.conversations.findIndex(function(conversation) {
                return conversation.data.id === newConversationData.id;
            });
            if (conversationIdx === -1) {
                vm.conversations.push({
                    data: newConversationData,
                    messageEntryText: "",
                    messages: []
                });
                refreshMessages(newConversationData.id);
            } else {
                vm.conversations[conversationIdx].data = newConversationData;
                refreshMessages(newConversationData.id);
            }
        }

        // Returns a promise whose `then` receives the conversation with the recipient, and whose `catch` receives
        // the failed response from the server
        function setupConversation(recipientID) {
            return chatDataService.getConversation(recipientID).then(function(conversationResponse) {
                return conversationResponse;
            }).catch(function() {
                // Conversation not received, create new conversation with recipient
                return chatDataService.createConversation(recipientID);
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
            return chatDataService.getConversationMessages(conversationID).then(function(messageResponse) {
                var conversationIdx = vm.conversations.findIndex(function(conversation) {
                    return conversation.data.id === conversationID;
                });
                if (conversationIdx !== -1) {
                    vm.conversations[conversationIdx].messages = messageResponse.data;
                }
                return messageResponse;
            }).catch(function(errorResponse) {
                console.log("Failed to update messages. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        function sendMessage(idx) {
            var conversationID = vm.conversations[idx].data.id;
            var contents = vm.conversations[idx].messageEntryText;
            vm.conversations[idx].messageEntryText = "";
            chatDataService.submitMessage(conversationID, contents).then(function(messageAddResult) {
                refreshMessages(conversationID);
            });
        }

        function getUserName(userID) {
            var userIdx = vm.users.findIndex(function(user) {
                return user.id === userID;
            });
            return userIdx !== -1 ? vm.users[userIdx].name : "unknown";
        }

        function timestampString(timestamp) {
            var date = new Date(timestamp);
            return "(" + new Intl.DateTimeFormat("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit"
            }).format(date) + ")";
        }
        function conversationName(conversation) {
            var otherParticipants = conversation.data.participants.filter(function(participant) {
                return participant !== vm.user._id;
            });
            if (otherParticipants.length > 0) {
                return otherParticipants
                    .map(function(participant) {
                        return vm.getUserName(participant);
                    })
                    .join(", ");
            } else {
                return "Self";
            }
        }
        function getSize(property) {
            if (typeof(vm.conversationBoxSizes[property]) === "function") {
                return vm.conversationBoxSizes[property]() + "px";
            }
            return vm.conversationBoxSizes[property] + "px";
        }
    }
})();
