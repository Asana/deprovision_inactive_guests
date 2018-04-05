# deprovision_inactive_guests

A small script which uses the Asana API to remove external users (ie without a company email) from an organization if they haven't logged in for 30 days

## Prerequisites

* Install git
* Clone the repository
* Install [node.js](https://nodejs.org)
* Create a [service account](https://asana.com/guide/help/premium/service-accounts) in the organization (preferred, an admin PAT will also work)
* Export a csv of Organization Members from the [Organization settings panel](https://asana.com/guide/help/premium/admins#gl-console) or – if you are an Asana eng – obtain a signed url for csv export of the members of the domain.

## To Run

`npm install`

Dry run (displays which users would be deprovisioned):
> `node index.js --auth <service account token> --csv <csv export url or file path> --domain <organization id> --threshold <# of inactive days>`

Actually deprovision those users:
> `node index.js --auth <service account token> --csv <csv export url or file path> --domain <organization id> --threshold <# of inactive days> --mode action`
