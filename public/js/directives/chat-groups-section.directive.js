(function() {
    angular
        .module("ChatApp")
        .directive("chatGroupsSection", chatGroupsSection);

    function chatGroupsSection() {
        return {
            restrict: "E",
            scope: {
                notificationHandlers: "=",
                user: "&",
                users: "&",
            },
            templateUrl: "chat-groups-section.html",
            replace: true,
            controller: "GroupsSectionController",
            controllerAs: "vm"
        };
    }
})();
