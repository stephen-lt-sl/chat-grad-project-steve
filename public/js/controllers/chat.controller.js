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
        vm.users = [];

        vm.currentActionsSection = "conversations";
        vm.setCurrentActionsSection = setCurrentActionsSection;

        vm.getUserName = getUserName;

        // Set of functions to control the conversations section with
        vm.conversationControls = {};
        // Set of function listeners for handling different notification types
        vm.notificationHandlers = {
            "new_messages": [],
            "group_changed": [],
        };

        vm.setMessagesUnread = setMessagesUnread;

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

        // Performs an action based on the received notification; this action does not necessarily "resolve" the
        // notification, but should not make any changes if the server has not changed state since the notification was
        // generated
        function processNotification(notification) {
            if (vm.notificationHandlers[notification.type]) {
                vm.notificationHandlers[notification.type].forEach(function(notificationHandler) {
                    notificationHandler(notification.data);
                });
            }
        }

        // Checks for new messages in any of the user's conversations (active or otherwise), and calls
        // `processNotification` to resolve to an action if either has
        function pollNotifications() {
            return chatDataService.getNotifications().then(function(notificationResponse) {
                notificationResponse.data.forEach(function(notification) {
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

        function setCurrentActionsSection(section) {
            vm.currentActionsSection = section;
        }

        function setMessagesUnread(otherID, messageCount) {
            var otherIdx = vm.users.findIndex(function(user) {
                return user.data.id === otherID;
            });
            if (otherIdx !== -1) {
                vm.users[otherIdx].unreadMessageCount = messageCount;
            }
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

    }
})();
