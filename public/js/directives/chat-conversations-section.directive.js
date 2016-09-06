/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .directive("chatConversationsSection", chatConversationsSection);

    function chatConversationsSection() {
        return {
            restrict: "E",
            scope: {
                conversationControls: "=",
                notificationHandlers: "=",
                setMessagesUnread: "&",
                getUserName: "&",
                user: "&"
            },
            templateUrl: "chat-conversations-section.html",
            replace: true,
            controller: "ConversationsSectionController",
            controllerAs: "vm"
        };
    }
})();
