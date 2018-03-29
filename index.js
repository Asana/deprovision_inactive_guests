const asana = require("asana");
const Bluebird = require("bluebird");
const csv = require("csv-parser");
const moment = require("moment");
const request = require("request-promise");
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
  return new Bluebird((resolve, reject) => {
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

const createAsanaClient = () => {
  const accessToken = process.argv[2];
  console.log("Loading Asana API with access token", accessToken);
  return asana.Client.create().useAccessToken(accessToken);
};

const deprovisionFunc = function() {
  const organizationId = process.argv[4];
  console.log("Will deprovision from", organizationId);
  const asanaClient = createAsanaClient();
  return email => {
    return asanaClient.workspaces
      .removeUser(organizationId, {
        user: email
      })
      .then(function() {
        console.log("Successfully deprovisioned", email);
      })
      .catch(function(ex) {
        console.log("Error while deprovisioning", email, ex.value.errors);
      });
  };
};

/**
 * Returns guest users who haven't logged in for over a month by email address
 */
const usersToDeprovision = csv => {
  const threshold = moment().subtract(parseInt(process.argv[5], 10), "days");

  return csv.then(function(data) {
    const realUsers = data.filter(row => {
      return row["Email Address"] !== "";
    });

    const guests = realUsers.filter(row => {
      return row["Internal"] === "false";
    });

    const rowsToDeprovision = guests.filter(row => {
      const lastActivityMoment = moment(row["Last Activity"]);

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
  if (process.argv.length < 6 || process.argv.length > 7) {
    console.log("Usage:");
    console.log(
      "node index.js <service account token> <member export csv path or url> <organization id> <# of days inactive threshold> [action]"
    );
  }

  if (process.argv[6] !== "action") {
    console.log(
      "In dry-run mode. Add 'action' to the command line to actually deprovision users"
    );
  }

  const deprovision = deprovisionFunc();

  // Decide whether or not this is a file path or a url
  const csvData = process.argv[3].includes("https://")
    ? loadRemoteCsv(process.argv[3])
    : loadLocalCsv(process.argv[3]);

  usersToDeprovision(csvData).then(emails => {
    if (emails.length > 0) {
      emails.forEach(email => {
        if (process.argv[6] === "action") {
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
