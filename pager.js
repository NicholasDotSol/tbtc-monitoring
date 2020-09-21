const Web3 = require("web3");
let nodeData = require("./data/nodeData");
const { setupLoader } = require("@openzeppelin/contract-loader");
const { pagerdutyApiToken } = require("./scriptConfig.js");

const pdClient = require('node-pagerduty');
const pd = pdClient(pagerdutyApiToken)

function wait(ms) {
  var start = new Date().getTime();
  var end = start;
  while (end < start + ms) {
    end = new Date().getTime();
  }
}

async function notifyCollateral() {
  const web3 = new Web3(url);
  const loader = setupLoader({ provider: web3 }).web3;

  for (let i = 0; i < Object.keys(nodeData).length; i++) {
    const cloneAddress = nodeData[i]["cloneAddress"];
    let deposit = loader.fromArtifact("Deposit", cloneAddress);
    let collateralizationRate = await deposit.methods
      .collateralizationPercentage()
      .call();
    let undercollateralized = await deposit.methods
      .undercollateralizedThresholdPercent()
      .call();
    if (collateralizationRate > 0) { // don't check closed deposits
      if (collateralizationRate <= undercollateralized) {
        // PAGERDUTY ALERT
      }
    }
    wait(500);
  }
}
notifyCollateral();
