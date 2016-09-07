/*global console*/
/*global Promise*/
(function() {
    angular
        .module("ChatApp")
        .controller("GroupsSectionController", GroupsSectionController);

    GroupsSectionController.$inject = ["$scope", "chatDataService"];

    function GroupsSectionController($scope, chatDataService) {
        /* jshint validthis: true */
        var vm = this;

        vm.viewGroup = viewGroup;
        vm.currentGroup = {};

        vm.searchForGroups = searchForGroups;
        vm.searchString = "";
        vm.searchResults = [];

        vm.isInGroup = isInGroup;
        vm.joinGroup = joinGroup;
        vm.startEditGroup = startEditGroup;
        vm.leaveGroup = leaveGroup;

        vm.inviteUser = inviteUser;
        vm.invitationText = "";
        vm.currentGroupMembers = [];
        vm.getGroupMembers = getGroupMembers;

        activate();

        function activate() {
            vm.searchResults = [
                {
                    id: "5",
                    name: "Test group",
                    description: "This is just a test group; nothing more, nothing less.",
                    users: ["stephen-lt-sl", "Melamoto"]
                }, {
                    id: "6",
                    name: "Test group 2",
                    description: "This is another test group; it might be a little less.",
                    users: ["Melamoto"]
                }
            ];
            viewGroup(vm.searchResults[0]);
        }

        function viewGroup(group) {
            vm.currentGroup = group;
            vm.currentGroupMembers = getGroupMembers(group);
        }

        function searchForGroups() {
            console.log("Searching for " + vm.searchString);
        }

        function isInGroup(group) {
            return group.users.indexOf($scope.user().i) !== -1;
        }

        function joinGroup(groupID) {
            console.log("Joining group " + groupID);
        }

        function startEditGroup() {
            console.log("Editing group " + vm.currentGroup.groupID);
        }

        function leaveGroup(groupID) {
            console.log("Leaving group " + groupID);
        }

        function inviteUser() {
            console.log("Inviting " + vm.invitationText);
        }

        function getGroupMembers(group) {
            if (!group.users) {
                return [];
            }
            return group.users.map(function(member) {
                return {name: member};
            });
        }
    }
})();
