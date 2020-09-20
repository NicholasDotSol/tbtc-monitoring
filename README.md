install dependencies:

> npm install

compile contracts:

> truffle compile

run collector script:

> node collector.js

collector script generates `nodeData.json`. This contains all Deposits the operator has been involved with 
along with useful info.

run maintainer stript:

> node maintainer.js

maintainer script updates `nodeData.json`, appending any Deposit data found. 