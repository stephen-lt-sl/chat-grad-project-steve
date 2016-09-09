/*global Promise */

module.exports = function(app, db, baseUrl) {
    var dbActions = require("./dbActions")(db);

    var notifications = db.collection("notifications");

    app.get(baseUrl + "/notifications", function(req, res) {
        var userID = req.session.user;
        dbActions.getUserNotifications(userID).then(function(docs) {
            res.json(docs.map(dbActions.cleanIdField));
        }).catch(function(errorCode) {
            res.sendStatus(errorCode);
        });
    });

};
