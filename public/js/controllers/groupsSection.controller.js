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

        vm.groups = [];

        vm.viewGroup = viewGroup;
        vm.currentGroup = false;

        vm.searchForGroups = searchForGroups;
        vm.searchString = "";
        vm.searchResults = [];

        vm.isInGroup = isInGroup;
        vm.joinGroup = joinGroup;
        vm.startEditGroup = startEditGroup;
        vm.leaveGroup = leaveGroup;

        vm.editing = false;
        vm.savingEdits = false;
        vm.editName = "";
        vm.editDescription = "";
        vm.saveEditGroup = saveEditGroup;
        vm.cancelEditGroup = cancelEditGroup;

        vm.inviteUser = inviteUser;
        vm.invitationText = "";
        vm.currentGroupMembers = [];
        vm.currentGroupNonMembers = [];
        vm.getGroupMembers = getGroupMembers;

        activate();

        function activate() {
            chatDataService.getGroups().then(function(groupResponse) {
                vm.groups = groupResponse.data;
            });
        }

        function viewGroup(group) {
            vm.currentGroup = group;
            setCurrentGroupMemberships();
        }

        function searchForGroups() {
            return chatDataService.getGroups(false, vm.searchString).then(function(searchResponse) {
                vm.searchResults = searchResponse.data;
            }).catch(function(errorResponse) {
                console.log("Failed to perform search. Server returned code " + errorResponse.status + ".");
                return errorResponse;
            });
        }

        function isInGroup(group) {
            return group.users.indexOf($scope.user()._id) !== -1;
        }

        function joinGroup(groupID) {
            return chatDataService.addGroupMember(groupID, $scope.user()._id);
        }

        function startEditGroup() {
            vm.editName = currentGroup.name;
            vm.editDescription = currentGroup.description;
            vm.editing = true;
        }

        function leaveGroup(groupID) {
            console.log("Leaving group " + groupID);
        }

        function saveEditGroup() {
            vm.savingEdits = true;
            return chatDataService.updateGroupInfo(vm.currentGroup.id, vm.editName, vm.editDescription)
                .catch(function(errorResponse) {
                    console.log("Failed to update group. Server returned code " + errorResponse.status + ".");
                    return errorResponse;
                })
                .then(function() {
                    vm.editing = false;
                    vm.savingEdits = false;
                });
        }

        function cancelEditGroup() {
            vm.editing = false;
            vm.savingEdits = false;
        }

        function inviteUser() {
            var recipientUsername = vm.invitationText;
            vm.invitationText = "";
            var recipient = $scope.users().find(function(user) {
                return user.name === username;
            });
            if (recipient) {
                return chatDataService.addGroupMember(groupID, recipient.id);
            } else {
                return Promise.reject();
            }
        }

        function setCurrentGroupMemberships() {
            vm.currentGroupMembers = [];
            vm.currentGroupNonMembers = [];
            $scope.users().forEach(function(user) {
                if (vm.currentGroup.users.indexOf(user.data.id) === -1) {
                    vm.currentGroupNonMembers.push(user.data);
                } else {
                    vm.currentGroupMembers.push(user.data);
                }
            });
        }

        function getGroupMembers(group) {
            if (!group.users) {
                return [];
            }
            return $scope.users().filter(function(user) {
                return group.users.indexOf(user.data.id) !== -1;
            }).map(function(user) {
                return user.data;
            });
        }

        function getGroupNonMembers(group) {
            if (!group.users) {
                return [];
            }
            return $scope.users().filter(function(user) {
                return group.users.indexOf(user.data.id) === -1;
            }).map(function(user) {
                return user.data;
            });
        }
    }
})();
