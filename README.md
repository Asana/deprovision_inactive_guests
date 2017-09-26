# deprovision_inactive_guests
A small script which uses the Asana API to remove external users (ie without a company email) from an organization if they haven't logged in for 30 days

# Prerequisites
* install git
* clone the repository
* install node.js
* Create a service account in the organization (preferred, an admin PAT will also work)
* Obtain a signed url for csv export of the members of the domain. Only asana engineers can generate this.

# To Run
npm install

Dry run (displays which users would be deprovisioned):
> `node index.js <service account token> <csv export url> <organization id>`

Actually deprovision those users:
> `node index.js <service account token> <csv export url> <organization id> action`
