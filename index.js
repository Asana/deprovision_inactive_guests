const asana = require("asana");
const csv = require("csv-parser");
const moment = require("moment");
const request = require("request-promise");
const commander = require("commander");
const fs = require("fs");

const loadRemoteCsv = url => {
    console.log("Downloading remote csv file", url);
    return loadCsv(request(url));
};

const loadLocalCsv = path => {
    console.log("Reading local csv file", path);

    return loadCsv(fs.createReadStream(path));
};

const loadCsv = stream => {
    return new Promise((resolve, reject) => {
        const rows = [];

        stream
            .pipe(csv())
            .on("data", data => {
                rows.push(data);
            })
            .on("end", () => {
                resolve(rows);
            })
            .on("error", err => {
                reject(err);
            });
    });
};

const createAsanaClient = token => {
    console.log("Loading Asana API with access token", token);
    return asana.Client.create({}).useAccessToken(token);
};

const deprovisionFunc = (asanaClient, domain) => {
    console.log("Will deprovision from", domain);
    return email => {
        return asanaClient.workspaces
            .removeUser(domain, {
                user: email
            })
            .then(() => {
                console.log("Successfully deprovisioned", email);
            })
            .catch(ex => {
                console.log("Error while deprovisioning", email, ex.value.errors);
            });
    };
};

/**
 * Returns guest users who haven't logged in for over a month by email address
 */
const usersToDeprovision = (csv, days) => {
    const threshold = moment().subtract(days, "days");

    return csv.then(data => {
        const realUsers = data.filter(row => {
            return row["Email Address"] !== "";
        });

        const guests = realUsers.filter(row => {
            return row["Internal"] === "false";
        });

        const rowsToDeprovision = guests.filter(row => {
            let lastActivityMoment = moment(row["Last Activity"]);

            if (!lastActivityMoment.isValid()) {
                // Probably hasn't logged in, fall back to invitation date instead
                lastActivityMoment = moment(row["Date Joined Organization"]);
            }
            return lastActivityMoment.isBefore(threshold);
        });

        return rowsToDeprovision.map(row => {
            return row["Email Address"];
        });
    });
};

const main = () => {
    // 1. Take user inputs from options
    commander
        .version("0.0.2")
        .option("-a, --auth <token>", "Service account token")
        .option("-c, --csv <path>", "Path to member csv file")
        .option("-d, --domain <domainId>", "Organization or Workspace domain ID")
        .option("-t, --threshold <#>", "# of days inactive threshold", parseInt)
        .option("-m, --mode ['dry' or 'action']", "mode to run the script in")
        .parse(process.argv);

    // 2. Validate inputs
    if (!commander.auth) {
        console.log("Please set the `--auth` option with a service account token");
        return;
    }
    if (!commander.csv) {
        console.log("Please set the`--csv` option with a path or URL to a CSV file");
        return;
    }
    if (!commander.domain) {
        console.log("Please set a the `--domain` option with your domain ID");
        return;
    }
    if (!commander.threshold) {
        console.log(
            "Please set a the `--threshold` option with the number of days of inactivity you'd like to count as being inactive"
        );
        return;
    }
    if (commander.mode !== "action") {
        console.log("In dry-run mode. set --mode option to 'action' to actually deprovision users");
    }

    // 3. Process CSV
    const csvData = commander.csv.includes("https://")
        ? loadRemoteCsv(commander.csv)
        : loadLocalCsv(commander.csv);

    // 4. Create Asana client
    const asanaClient = createAsanaClient(commander.auth);

    // 5. Set up deprovision function
    const deprovision = deprovisionFunc(asanaClient, commander.domain);

    // 6. Deprovision users
    usersToDeprovision(csvData, commander.threshold).then(emails => {
        if (emails.length > 0) {
            emails.forEach(email => {
                if (commander.mode === "action") {
                    console.log("Deprovisioning", email);
                    deprovision(email);
                } else {
                    console.log("Planning to deprovision", email);
                }
            });
        } else {
            console.log("No one will be deprovisioned.");
        }
    });
};

main();

module.exports = {
    loadCsv,
    deprovisionFunc,
    usersToDeprovision
};
