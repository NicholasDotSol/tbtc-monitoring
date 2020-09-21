const Web3 = require("web3");
var fs = require("fs");
var dir = "./data";

if (!fs.existsSync(dir)) {
  console.log("data folder does not exists. Run collector script first");
}
const { operator, url } = require("./scriptConfig.js");
const depositAddress = "0xCffDCB12b74bE900e2020B9D96D256F1fEA96342";
const depositFactoryAddress = "0x87EFFeF56C7fF13E2463b5d4dCE81bE2340FAf8b";
const keepFactoryAddress = "0xA7d9E842EFB252389d613dA88EDa3731512e40bD";
const feeRebateTokenAddress = "0xaf3fFF06b75f99352d8C2a3C4beF1339a2f94789";
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
function time() {
  return new Date().toUTCString() + ":";
}
async function getRecents() {
  let nodeData = require("./data/nodeData");

  const web3 = new Web3(url);
  const loader = setupLoader({ provider: web3 }).web3;

  const depositFactory = loader.fromArtifact(
    "DepositFactory",
    depositFactoryAddress
  );
  const ecdsaFactory = loader.fromArtifact(
    "BondedECDSAKeepFactory",
    keepFactoryAddress
  );
  const frt = loader.fromArtifact("FeeRebateToken", feeRebateTokenAddress);
  let END_BLOCK = await web3.eth.getBlockNumber();
  let read = fs.readFileSync("data/blockUpdated.txt");
  let START_BLOCK = Number(read);

  if (START_BLOCK == 0) {
    START_BLOCK = END_BLOCK - 999;
  }
  let log =`Gathering data from block range:${START_BLOCK} - ${END_BLOCK}\n`
  fs.appendFileSync("data/logs.txt", `${time()} ${log}`);

  fs.writeFileSync("data/blockUpdated.txt", END_BLOCK);

  let events = await ecdsaFactory.getPastEvents("BondedECDSAKeepCreated", {
    fromBlock: START_BLOCK,
    toBlock: END_BLOCK, // You can also specify 'latest'
  });
  let ecdsaSelected = false;
  let keepAddress;
  let blockNum;
  let transactionIndex;
  let txHash;
  let cloneAddress;
  let TDTOwner;
  let FRTExists;
  let TDTredeemable = false;
  let state;
  let lotSize;

  for (let i = 0; i < events.length; i++) {
    let vls = events[i].returnValues["1"];
    for (let q = 0; q < vls.length; q++) {
      if (vls[q] == operator) {
        txHash = events[i].transactionHash;
        blockNum = events[i].blockNumber;
        keepAddress = events[i].returnValues["keepAddress"];
        events = await depositFactory.getPastEvents("DepositCloneCreated", {
          fromBlock: blockNum,
          toBlock: blockNum, // You can also specify 'latest'
        });
        for (let i = 0; i < events.length; i++) {
          if (events[i].transactionHash == txHash) {
            cloneAddress = events[i].returnValues["0"];
          }
        }
    
        const deposit = loader.fromArtifact("Deposit", cloneAddress);
        lotSize = await deposit.methods.lotSizeSatoshis().call();
        state = await deposit.methods.currentState().call();
        collateralizationRate = await deposit.methods.collateralizationPercentage().call()
    
        FRTExists = await frt.methods.exists(cloneAddress).call();
        if (FRTExists) {
          TDTOwner = await frt.methods.ownerOf(cloneAddress).call();
          if (TDTOwner == vendingMachineAddress) {
            TDTredeemable = true;
          }
        }
    
        if (FRTExists && !TDTredeemable) {
        }
        let KeepData = {
          keepAddress: keepAddress,
          blockNum: blockNum,
          cloneAddress: cloneAddress,
          lotSize: lotSize,
          state: states[state],
          FRTExists: FRTExists,
          redeemable: TDTredeemable,
          collateralizationRate: collateralizationRate,
        };
    
        var count = Object.keys(nodeData).length;
        nodeData[count.toString()] = KeepData;
    
        let logData = JSON.stringify(KeepData);
    
        let data = JSON.stringify(nodeData);
        fs.appendFileSync("data/logs.txt", time() + " found " + logData);
    
        fs.writeFileSync("data/nodeData.json", data);
    
      }
    }
  }
  if (events == undefined || events.length == 0) {
    fs.appendFileSync(
      "data/logs.txt",
      `${time()} No keeps with member ${operator} in specified period\n`
    );
  }
}
getRecents();
