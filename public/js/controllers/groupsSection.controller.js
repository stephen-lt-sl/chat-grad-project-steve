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

        vm.startCreateGroup = startCreateGroup;
        vm.searchForGroups = searchForGroups;
        vm.searchString = "";
        vm.searchResults = [];

        vm.isInGroup = isInGroup;
        vm.joinGroup = joinGroup;
        vm.startEditGroup = startEditGroup;
        vm.leaveGroup = leaveGroup;

        vm.creatingNewGroup = false;
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
            $scope.notificationHandlers.group_changed.push(onGroupChanged);
        }

        function onGroupChanged(notificationData) {
            var groupSearchIdx = vm.searchResults.findIndex(function(searchResult) {
                return searchResult.id === notificationData.groupID;
            });
            if (groupSearchIdx !== -1 || vm.currentGroup.id === notificationData.groupID) {
                return chatDataService.getGroup(notificationData.groupID).then(function(group) {
                    var nextGroupSearchIdx = vm.searchResults.findIndex(function(searchResult) {
                        return searchResult.id === notificationData.groupID;
                    });
                    if (nextGroupSearchIdx !== -1) {
                        vm.searchResults[nextGroupSearchIdx] = group.data;
                    }
                    if (vm.currentGroup.id === group.data.id) {
                        viewGroup(group.data);
                    }
                });
            }
            return Promise.resolve();
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
            return chatDataService.joinGroup(groupID)
                .then(function(updateResponse) {
                    viewGroup(updateResponse.data);
                })
                .catch(function(errorResponse) {
                    console.log("Failed to join group. Server returned code " + errorResponse.status + ".");
                    return errorResponse;
                });
        }

        function startCreateGroup() {
            vm.editName = "";
            vm.editDescription = "";
            vm.editing = true;
            vm.creatingNewGroup = true;
        }

        function startEditGroup() {
            vm.editName = vm.currentGroup.name;
            vm.editDescription = vm.currentGroup.description;
            vm.editing = true;
        }

        function leaveGroup(groupID) {
            return chatDataService.removeUserFromGroup(groupID, $scope.user()._id)
                .then(function(updateResponse) {
                    viewGroup(updateResponse.data);
                })
                .catch(function(errorResponse) {
                    console.log("Failed to leave group. Server returned code " + errorResponse.status + ".");
                    return errorResponse;
                });
        }

        function saveEditGroup() {
            vm.savingEdits = true;
            var savePromise = vm.creatingNewGroup ?
                chatDataService.createGroup(vm.editName, vm.editDescription) :
                chatDataService.updateGroupInfo(vm.currentGroup.id, vm.editName, vm.editDescription);
            return savePromise
                .then(function(updateResponse) {
                    viewGroup(updateResponse.data);
                })
                .catch(function(errorResponse) {
                    console.log("Failed to update group. Server returned code " + errorResponse.status + ".");
                    return errorResponse;
                })
                .then(function() {
                    vm.editing = false;
                    vm.savingEdits = false;
                    vm.creatingNewGroup = false;
                });
        }

        function cancelEditGroup() {
            vm.editing = false;
            vm.savingEdits = false;
            vm.creatingNewGroup = false;
        }

        function inviteUser() {
            var recipientUsername = vm.invitationText;
            vm.invitationText = "";
            var recipient = $scope.users().find(function(user) {
                return user.data.name === recipientUsername;
            });
            if (recipient) {
                return chatDataService.inviteUserToGroup(vm.currentGroup.id, recipient.data.id)
                    .then(function(updateResponse) {
                        viewGroup(updateResponse.data);
                    })
                    .catch(function(errorResponse) {
                        console.log("Failed to invite user. Server returned code " + errorResponse.status + ".");
                        return errorResponse;
                    });
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
