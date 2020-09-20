install dependencies:

> npm install

compile contracts:

> truffle compile

run collector script:

> node collector.js START_BLOCK

collector script generates `nodeData.json`. This contains all Deposits the operator has been involved with 
along with useful info.
START_BLOCK: >approx block your keep node started beeing eligible for keeps
START_BLOCK is optional, defaults to block #10867766 (early launch day)

run maintainer stript:

> node maintainer.js

maintainer script updates `nodeData.json`, appending any Deposit data found. 