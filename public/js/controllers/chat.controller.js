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
        vm.users = [];

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
                    result.data.forEach(function(user) {
                        displayUser(user);
                    });
                });
                setInterval(pollNotifications, 1000);
            }).catch(function() {
                chatDataService.getOAuthUri().then(function(result) {
                    vm.loginUri = result.data.uri;
                });
            });
        }

        function processNotification(notification) {
            if (notification.type === "new_messages") {
                var conversationIdx = vm.conversations.findIndex(function(conversation) {
                    return conversation.data.id === notification.data.conversationID;
                });
                if (conversationIdx !== -1) {
                    // If we have the conversation open, refresh it
                    refreshConversation(notification.data.conversationID);
                } else {
                    // Otherwise set the visible unread message count
                    chatDataService.getConversationMessages(notification.data.conversationID, {
                        countOnly: true,
                        timestamp: notification.data.since
                    }).then(function(countResponse) {
                        var userIdx = vm.users.findIndex(function(currentUser) {
                            return currentUser.data.id === notification.data.otherID;
                        });
                        if (userIdx !== -1) {
                            vm.users[userIdx].unreadMessageCount = countResponse.data.count;
                        }
                    });
                }
            }
        }

        // Checks for new messages in any of the user's conversations (active or otherwise), and calls
        // `processNotification` to resolve to an action if either has
        function pollNotifications() {
            var pollPromises = [];
            var notifications = [];
            vm.users.forEach(function(user) {
                pollPromises.push(chatDataService.getConversation(user.data.id).then(function(conversationResponse) {
                    var conversationIdx = vm.conversations.findIndex(function(conversation) {
                        return conversation.data.id === conversationResponse.data.id;
                    });
                    var newTimestamp = conversationResponse.data.lastTimestamp || "1970-1-1";
                    var currentTimestamp = conversationIdx !== -1 ?
                        vm.conversations[conversationIdx].data.lastTimestamp || "1970-1-1" :
                        user.lastReadTimestamp;
                    if (Date.parse(currentTimestamp) < Date.parse(newTimestamp)) {
                        var notification = {
                            type: "new_messages",
                            data: {
                                conversationID: conversationResponse.data.id,
                                messageCount: 0,
                                otherID: getOtherID(conversationResponse.data),
                                since: currentTimestamp
                            }
                        };
                        notifications.push(notification);
                    }
                }).catch(function(errorResponse) {
                    return errorResponse;
                }));
            });
            return Promise.all(pollPromises).then(function() {
                notifications.forEach(function(notification) {
                    processNotification(notification);
                });
            });
        }

        function displayUser(newUserData) {
            var userIdx = vm.users.findIndex(function(user) {
                return user.data.id === newUserData.id;
            });
            if (userIdx === -1) {
                vm.users.push({
                    data: newUserData,
                    unreadMessageCount: 0,
                    lastReadTimestamp: "1970-1-1"
                });
            } else {
                vm.users[userIdx].data = newUserData;
            }
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
                var oldTimestamp = vm.conversations[conversationIdx].data.lastTimestamp;
                vm.conversations[conversationIdx].data = newConversationData;
                refreshMessages(newConversationData.id, oldTimestamp);
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
        // Similar to `openConversation`, but assumes the conversation already exists and is being displayed, and is
        // used to update the conversation from the server (including fetching messages)
        function refreshConversation(conversationID) {
            var conversationIdx = vm.conversations.findIndex(function(conversation) {
                return conversation.data.id === conversationID;
            });
            var recipientID = getOtherID(vm.conversations[conversationIdx]);
            return chatDataService.getConversation(recipientID).then(function(conversationResponse) {
                displayConversation(conversationResponse.data);
            });
        }

        function onConversationUpdated(conversation) {
            var otherParticipants = conversation.data.participants.filter(function(participant) {
                return participant !== vm.user._id;
            });
            var otherUserID = otherParticipants.length > 0 ? otherParticipants[0] : vm.user._id;
            var otherUserIdx = vm.users.findIndex(function(user) {
                return user.data.id === otherUserID;
            });
            vm.users[otherUserIdx].lastReadTimestamp = conversation.data.lastTimestamp;
            vm.users[otherUserIdx].unreadMessageCount = 0;
        }

        // Updates the message history for the conversation with the given ID, and returns a promise with the
        // server response
        function refreshMessages(conversationID, fromTimestamp) {
            var params;
            if (fromTimestamp) {
                var conversationIdx = vm.conversations.findIndex(function(conversation) {
                    return conversation.data.id === conversationID;
                });
                if (conversationIdx !== -1) {
                    params = {
                        timestamp: fromTimestamp
                    };
                }
            }
            return chatDataService.getConversationMessages(conversationID, params).then(
                function(messageResponse) {
                    var conversationIdx = vm.conversations.findIndex(function(conversation) {
                        return conversation.data.id === conversationID;
                    });
                    if (conversationIdx !== -1) {
                        var newMessages = messageResponse.data;
                        if (fromTimestamp) {
                            newMessages = newMessages.filter(function(message) {
                                return Date.parse(message.timestamp) > Date.parse(vm.conversations[conversationIdx].lastTimestamp);
                            })
                        }
                        vm.conversations[conversationIdx].messages = vm.conversations[conversationIdx].messages.concat(messageResponse.data);
                        onConversationUpdated(vm.conversations[conversationIdx]);
                    }
                    return messageResponse;
                }
            ).catch(function(errorResponse) {
                console.log("Failed to update messages. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        function sendMessage(idx) {
            var conversationID = vm.conversations[idx].data.id;
            var contents = vm.conversations[idx].messageEntryText;
            vm.conversations[idx].messageEntryText = "";
            chatDataService.submitMessage(conversationID, contents).then(function(messageAddResult) {
                refreshConversation(conversationID);
            });
        }

        function getUserName(userID) {
            var userIdx = vm.users.findIndex(function(user) {
                return user.data.id === userID;
            });
            return userIdx !== -1 ? vm.users[userIdx].data.name : "unknown";
        }
        function getOtherID(conversation) {
            var otherParticipants = conversation.data.participants.filter(function(participant) {
                return participant !== vm.user._id;
            });
            if (otherParticipants.length > 0) {
                return otherParticipants[0];
            } else {
                return vm.user._id;
            }
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
