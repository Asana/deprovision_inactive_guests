const asana = require("asana");
const csv = require("csv-parser");
const moment = require("moment");
const request = require("request-promise");
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

const main = () => {
    // 1. Define schema
    const schema = {
        properties: {
            token: {
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

        // 3. Process CSV
        const csvData = inputs.csv.includes("https://")
            ? loadRemoteCsv(inputs.csv)
            : loadLocalCsv(inputs.csv);

        // 4. Create Asana client
        const asanaClient = createAsanaClient(inputs.token);

        // 5. Set up deprovision function
        const deprovision = deprovisionFunc(asanaClient, inputs.organization_id);

        // 6. Deprovision users
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
    });
};

main();

module.exports = {
    loadCsv,
    deprovisionFunc,
    usersToDeprovision
};
