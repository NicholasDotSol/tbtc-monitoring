const Web3 = require("web3");
var fs = require("fs");
var dir = "./data";
let nodeData = require("./data/nodeData");

if (!fs.existsSync(dir)) {
  console.log("data folder does not exists. Run collector script first");
}
const { operator, url } = require("./scriptConfig.js");
const depositAddress = "0xCffDCB12b74bE900e2020B9D96D256F1fEA96342";
const depositFactoryAddress = "0x87EFFeF56C7fF13E2463b5d4dCE81bE2340FAf8b";
const keepFactoryAddress = "0xA7d9E842EFB252389d613dA88EDa3731512e40bD";
const feeRebateTokenAddress = "0xaf3fFF06b75f99352d8C2a3C4beF1339a2f94789";
const TDTAddress = "0x10B66Bd1e3b5a936B7f8Dbc5976004311037Cdf0";
const vendingMachineAddress = "0x526c08E5532A9308b3fb33b7968eF78a5005d2AC";
const { setupLoader } = require("@openzeppelin/contract-loader");
const states = [
  "START",
  "AWAITING_SIGNER_SETUP",
  "AWAITING_BTC_FUNDING_PROOF",
  "FAILED_SETUP",
  "ACTIVE",
  "AWAITING_WITHDRAWAL_SIGNATURE",
  "AWAITING_WITHDRAWAL_PROOF",
  "REDEEMED",
  "COURTESY_CALL",
  "FRAUD_LIQUIDATION_IN_PROGRESS",
  "LIQUIDATION_IN_PROGRESS",
  "LIQUIDATED",
];

function wait(ms) {
    var start = new Date().getTime();
    var end = start;
    while (end < start + ms) {
      end = new Date().getTime();
    }
  }
async function update() {
  const web3 = new Web3(url);
  const loader = setupLoader({ provider: web3 }).web3;
  const frt = loader.fromArtifact("FeeRebateToken", feeRebateTokenAddress);
  const tdt = loader.fromArtifact("TBTCDepositToken", TDTAddress);

  for (let i = 0; i < Object.keys(nodeData).length; i++) {
    const cloneAddress = nodeData[i]["cloneAddress"];
    let deposit = loader.fromArtifact("Deposit", cloneAddress);
    let state = await deposit.methods.currentState().call();
    let collateralizationRate = await deposit.methods
      .collateralizationPercentage()
      .call();
    let FRTExists = await frt.methods.exists(cloneAddress).call();
    let TDTOwner = await tdt.methods.ownerOf(cloneAddress).call();
    let redeemable = false;
    if (TDTOwner == vendingMachineAddress) {
        redeemable = true;
    }
    if (nodeData[i]["state"] != states[state]) {
      nodeData[i]["state"] = states[state];
    }
    if (nodeData[i]["FRTExists"] != FRTExists) {
      nodeData[i]["FRTExists"] = FRTExists;
    }
    if (nodeData[i]["TDTOwner"] != TDTOwner) {
      nodeData[i]["TDTOwner"] = TDTOwner;
    }
    if (nodeData[i]["redeemable"] != redeemable) {
        nodeData[i]["redeemable"] = redeemable;
    }
    if (nodeData[i]["collateralizationRate"] != collateralizationRate) {
      nodeData[i]["collateralizationRate"] = collateralizationRate;
    }
    wait(500)
  }
  let data = JSON.stringify(nodeData);
  fs.writeFileSync("data/nodeData.json", data);
}
update();
