const asana = require("asana");
const csv = require("csv-parser");
const moment = require("moment");
const request = require("request-promise");
const commander = require("commander");
const prompt = require("prompt");
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

const processInputs = inputs => {
    const csvData = inputs.csv.includes("https://")
        ? loadRemoteCsv(inputs.csv)
        : loadLocalCsv(inputs.csv);

    // Create Asana client
    const asanaClient = createAsanaClient(inputs.auth);

    // Set up deprovision function
    const deprovision = deprovisionFunc(asanaClient, inputs.organization_id);

    // Deprovision or log users
    usersToDeprovision(csvData, inputs.threshold).then(emails => {
        if (emails.length > 0) {
            emails.forEach(email => {
                if (inputs.mode === "action") {
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

const main = () => {
    // 1. Take options if we have them
    commander
        .version("0.0.3")
        .option("-a, --auth <token>", "Service account token")
        .option("-c, --csv <path>", "Path to member csv file")
        .option("-o, --organization_id <organization_id>", "Organization or Workspace domain ID")
        .option("-t, --threshold <#>", "# of days inactive threshold", parseInt)
        .option("-m, --mode ['dry' or 'action']", "mode to run the script in")
        .parse(process.argv);

    if (commander.rawArgs.length > 2) {
        // We've been given options, lets check those and then and then process those through
        if (!commander.auth) {
            console.log("Please set the `--auth` option with a service account token");
            return;
        }
        if (!commander.csv) {
            console.log("Please set the`--csv` option with a path or URL to a CSV file");
            return;
        }
        if (!commander.organization_id) {
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
            console.log(
                "In dry-run mode. set --mode option to 'action' to actually deprovision users"
            );
        }

        processInputs(commander);
    } else {
        // If we have no options, prompt the user for the inputs we need.
        const schema = {
            properties: {
                auth: {
                    message: "please enter a valid service account token",
                    pattern: /^0\//,
                    required: true
                },
                csv: {
                    message: "absolute path or url to csv file",
                    required: true
                },
                organization_id: {
                    message: "please enter a valid organization id",
                    pattern: /^[1-9]\d*$/,
                    required: true
                },
                threshold: {
                    message: "number of days inactive",
                    required: true
                },
                mode: {
                    message: "mode (dry or action)",
                    required: false
                }
            }
        };

        // 2. Prompt user for inputs
        prompt.colors = false;
        prompt.message = "";
        prompt.start();

        prompt.get(schema, (err, inputs) => {
            if (err) {
                throw err;
            }
            processInputs(inputs);
        });
    }
};

main();

module.exports = {
    loadCsv,
    deprovisionFunc,
    usersToDeprovision
};
