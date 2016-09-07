(function() {
    angular
        .module("ChatApp")
        .directive("chatGroupsSection", chatGroupsSection);

    function chatGroupsSection() {
        return {
            restrict: "E",
            scope: {
                user: "&"
            },
            templateUrl: "chat-groups-section.html",
            replace: true,
            controller: "GroupsSectionController",
            controllerAs: "vm"
        };
    }
})();
