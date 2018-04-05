# deprovision_inactive_guests

A small node script which uses the Asana API to remove external users (ie without a company email) from an organization if they haven't logged in for 30 days.

## To Develop

* Install node
* Clone this repository
* Run `npm install`

To test, run `npm run test`.

To build binarys, use `npm run build`.

## To Run

### Prerequisites

* Create a [service account](https://asana.com/guide/help/premium/service-accounts) in the organization (preferred, an admin PAT will also work)
* Export a csv of Organization Members from the [Organization settings panel](https://asana.com/guide/help/premium/admins#gl-console) or – if you are an Asana eng – obtain a signed url for csv export of the members of the domain.

### Running

Run as a node script:
`node depro-inactive-guests.js`

Or simply open the built binary for your OS.

The script will prompt you for the information it needs:

* Serivce account token
* URL or absolute file path to a .csv file
* Organization ID
* Threshold (number of inactive days we count as being an "inactive guest")
* Mode ("dry" run or "action" run)
