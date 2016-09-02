/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .controller("ChatController", ChatController);

    ChatController.$inject = ["chatDataService", "$interval"];

    function ChatController(chatDataService, $interval) {
        /* jshint validthis: true */
        var vm = this;

        vm.loggedIn = false;
        vm.conversations = {};
        vm.users = [];

        vm.openConversation = openConversation;
        vm.sendMessage = sendMessage;

        vm.getUserName = getUserName;
        vm.getDisplayedConversations = getDisplayedConversations;
        vm.getDisplayedConversationsData = getDisplayedConversationsData;

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
                }).then(function() {
                    pollNotifications();
                    $interval(pollNotifications, 500);
                });
            }).catch(function() {
                chatDataService.getOAuthUri().then(function(result) {
                    vm.loginUri = result.data.uri;
                });
            });
        }

        // Set of functions for handling different notification types
        var notificationHandler = {
            "new_messages": function(notificationData) {
                if (vm.conversations[notificationData.conversationID]) {
                    // If we have the conversation open, refresh it
                    return refreshConversation(notificationData.conversationID);
                } else {
                    // Otherwise set the unread message count for the user
                    return chatDataService.getConversationMessages(notificationData.conversationID, {
                        countOnly: true,
                        timestamp: notificationData.since
                    }).then(function(countResponse) {
                        var userIdx = vm.users.findIndex(function(currentUser) {
                            return currentUser.data.id === notificationData.otherID;
                        });
                        if (userIdx !== -1) {
                            vm.users[userIdx].unreadMessageCount = countResponse.data.count;
                        }
                    });
                }
            }
        };

        // Performs an action based on the received notification; this action does not necessarily "resolve" the
        // notification, but should be idempotent if the server has not changed state since the notification was
        // generated
        function processNotification(notification) {
            return notificationHandler[notification.type](notification.data);
        }

        // Checks for new messages in any of the user's conversations (active or otherwise), and calls
        // `processNotification` to resolve to an action if either has
        function pollNotifications() {
            var pollPromises = [];
            var notifications = [];
            vm.users.forEach(function(user) {
                pollPromises.push(chatDataService.getConversation(user.data.id).then(function(conversationResponse) {
                    var newTimestamp = conversationResponse.data.lastTimestamp || "1970-1-1";
                    var currentTimestamp = vm.conversations[conversationResponse.data.id] ?
                        vm.conversations[conversationResponse.data.id].data.lastTimestamp || "1970-1-1" :
                        user.lastReadTimestamp;
                    if (Date.parse(currentTimestamp) < Date.parse(newTimestamp)) {
                        console.log("New notification");
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
            var recipientID = getOtherID(vm.conversations[conversationID].data);
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

        function sendMessage(conversationID) {
            var contents = vm.conversations[conversationID].messageEntryText;
            vm.conversations[conversationID].messageEntryText = "";
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
        function getOtherID(conversationData) {
            var otherParticipants = conversationData.participants.filter(function(participant) {
                return participant !== vm.user._id;
            });
            if (otherParticipants.length > 0) {
                return otherParticipants[0];
            } else {
                return vm.user._id;
            }
        }
        function getDisplayedConversations() {
            var conversations = Object.keys(vm.conversations).map(function(key) {
                return vm.conversations[key];
            });
            return conversations;
        }
        function getDisplayedConversationsData() {
            var conversationsData = Object.keys(vm.conversations).map(function(key) {
                return vm.conversations[key].data;
            });
            return conversationsData;
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
            var otherParticipants = conversationData.participants.filter(function(participant) {
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
