var asana = require('asana');
var Bluebird = require('bluebird');
var moment = require('moment');

var createAsanaClient = function() {
    var accessToken = process.argv[2];
    console.log("Loading Asana API with access token", accessToken);
    return asana.Client.create().useAccessToken(accessToken);
};

var deprovisionFunc = function(asanaClient) {
    var organizationId = process.argv[3];
    console.log("Will deprovision from", organizationId);
    return function(email) {
        return asanaClient.workspaces.removeUser(organizationId, {
            user: email
        }).then(function() {
            console.log("Successfully deprovisioned", email);
        }).catch(function(ex) {
            console.log("Error while deprovisioning", email, ex.value.errors)
        });
    }
};

/**
 * Returns guest users who haven't logged in for over a month by email address
 */
var usersToDeprovision = function(asanaClient) {
    var oneMonthAgo = moment().subtract(1, "months");
    var organizationId = process.argv[3];

    var users = asanaClient.users.findByWorkspace(organizationId, {
        opt_fields: "last_active_at,is_guest,email",
        domain: organizationId
    });

    return users.then(function(data) {
        console.log("data", data)
        throw "boom"
        var guests = data.filter(function(row) {
            return row["Internal"] === "false";
        });

        var rowsToDeprovision = guests.filter(function(row) {
            var lastActivityMoment = moment(row["Last Activity"]);

            if (!lastActivityMoment.isValid()) {
                // Probably hasn't logged in, fall back to invitation date instead
                lastActivityMoment = moment(row["Date Joined Organization"]);
            }
            return lastActivityMoment.isBefore(oneMonthAgo);
        });

        return rowsToDeprovision.map(function(row) {
            return row["Email Address"];
        });
    });
};

var main = function() {
    var asanaClient = createAsanaClient();
    var deprovision = deprovisionFunc();

    usersToDeprovision(asanaClient).then(function(emails) {
        emails.forEach(function(email) {
            console.log("Deprovisioning", email);
            // deprovision
        })
    });
};

main();