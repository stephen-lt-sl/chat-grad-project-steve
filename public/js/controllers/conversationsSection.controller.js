/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .controller("ConversationsSectionController", ConversationsSectionController);

    ConversationsSectionController.$inject = ["$scope"];

    function ConversationsSectionController($scope) {
        /* jshint validthis: true */
        var vm = this;

        vm.messageEntryTexts = {};
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

        }

        function submitMessage(conversationID) {
            var contents = vm.messageEntryTexts[conversationID];
            $scope.sendMessage({conversationID: conversationID, contents: contents});
            vm.messageEntryTexts[conversationID] = "";
        }

        function getUserName(userID) {
            return $scope.getUserName({userID: userID});
        }
        function getDisplayedConversationsData() {
            var conversationsData = Object.keys($scope.conversations).map(function(key) {
                return $scope.conversations[key].data;
            });
            return conversationsData;
        }
        function getMessages(conversationID) {
            return $scope.conversations[conversationID].messages;
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
                return participant !== $scope.user()._id;
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
