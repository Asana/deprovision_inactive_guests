const fs = require("fs");
const index = require("./../depro-inactive-guests");
const fixtures = require("./../fixtures/fixtures");

describe("Processes a local CSV correctly", () => {
    // setup
    const csv = fs.createReadStream("./fixtures/test.csv");
    const parsedCsv = fixtures.parsedCsv;

    test("Given a valid csv, loadCsv resolves with data", () => {
        expect.assertions(1);

        return index.loadCsv(csv).then(data => expect(data).toEqual(parsedCsv));
    });

    test("Given a parsed csv and a 30 day threshold, usersToDeprovision returns the correct users", () => {
        expect.assertions(1);
        const threshold = 30;
        const promisedCsv = Promise.resolve(parsedCsv);
        const result = ["guest1@external.com", "guest2@external.com"];

        return index
            .usersToDeprovision(promisedCsv, threshold)
            .then(data => expect(data).toEqual(result));
    });

    test("Given a client, a domain, and an email address, deprovisionFunc calls `.removeUser`", () => {
        const removeUser = jest.fn((domain, config) => Promise.resolve());
        const client = { workspaces: { removeUser } };
        const email = "guest1@external.com";
        const domain = 1138;
        const deprovision = index.deprovisionFunc(client, domain);

        deprovision(email);

        expect(removeUser).toBeCalledWith(domain, { user: email });
    });
});
