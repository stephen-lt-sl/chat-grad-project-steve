/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .directive("chatTrackingScrollBox", chatTrackingScrollBox);

    function chatTrackingScrollBox() {
        return {
            restrict: "A",
            link: function(scope, element, attrs) {
                var lastScrollHeight = element[0].scrollHeight;
                var onUpdate = function() {
                    if (lastScrollHeight - element[0].scrollTop === element[0].clientHeight) {
                        element[0].scrollTop = element[0].scrollHeight - element[0].clientHeight;
                    }
                    lastScrollHeight = element[0].scrollHeight;
                };
                var scrollListener = scope.$watch(function() { return element[0].scrollHeight; }, function() {
                    onUpdate();
                });
                scope.$on("$destroy", function() {
                    scrollListener();
                });
            }
        };
    }
})();
