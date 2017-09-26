var asana = require('asana');
var Bluebird = require('bluebird');
var csv = require("csv-parser");
var moment = require('moment');
var request = require('request-promise');

var loadRemoteCsv = function(url) {
    console.log("Downloading remote csv file", url);
    return loadCsv(request(url));
};

var loadCsv = function(stream) {
    return new Bluebird(function(resolve, reject) {
        var rows = [];

        stream.pipe(csv())
            .on("data", function (data) {
                rows.push(data);
            })
            .on("end", function () {
                resolve(rows);
            })
            .on("error", function (err) {
                reject(err);
            });
    });
};

var createAsanaClient = function() {
    var accessToken = process.argv[2];
    console.log("Loading Asana API with access token", accessToken);
    return asana.Client.create().useAccessToken(accessToken);
};

var deprovisionFunc = function() {
    var organizationId = process.argv[4];
    console.log("Will deprovision from", organizationId);
    var asanaClient = createAsanaClient();
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
var usersToDeprovision = function(csv) {
    var oneMonthAgo = moment().subtract(1, "months");

    return csv.then(function(data) {
        var realUsers = data.filter(function(row) {
            return row["Email Address"] !== "";
        });

        var guests = realUsers.filter(function(row) {
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
    if (process.argv.length < 5 || process.argv.length > 6) {
        console.log("Usage:");
        console.log("node index.js <service account token> <member export csv url> <organization id> [action]");
    }

    if (process.argv[5] !== "action") {
        console.log("In dry-run mode. Add 'action' to the command line to actually deprovision users");
    }

    var deprovision = deprovisionFunc();

    var csvData = loadRemoteCsv(process.argv[3]);
    usersToDeprovision(csvData).then(function (emails) {
        emails.forEach(function (email) {
            if (process.argv[5] === "action") {
                console.log("Deprovisioning", email);
                deprovision(email);
            } else {
                console.log("Planning to deprovision", email);
            }
        })
    });
};

main();