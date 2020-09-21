const Web3 = require("web3");
var fs = require("fs");
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

var dir = "./data";
function time() {
  return new Date().toUTCString() + ":";
}
function wait(ms) {
  var start = new Date().getTime();
  var end = start;
  while (end < start + ms) {
    end = new Date().getTime();
  }
}
async function populate() {
  let start
  if (process.argv.length === 2) {
    start = 10867766
    console.log("No start block provided, defaulting to 10867766 (launch day!)");
  }
  else{
    start = Number(process.argv[2])
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  let nodeData = {};
  const web3 = new Web3(url);

  let END_BLOCK;
  let BN = await web3.eth.getBlockNumber();
  let remaining
  for (
    let START_BLOCK = start ;
    START_BLOCK <= BN - 1000;
    START_BLOCK += 1000
  ) {
   // wait becuase rate limits :s
    wait(1000);
    END_BLOCK = START_BLOCK + 1000;

    console.log(`checking interval ${START_BLOCK} - ${END_BLOCK}` )

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
    const tdt = loader.fromArtifact("TBTCDepositToken", TDTAddress);

    let log =`Gathering data from block range:${START_BLOCK} - ${END_BLOCK}\n`
    fs.appendFileSync("data/logs.txt", `${time()} ${log}`);
    fs.writeFileSync("data/blockUpdated.txt", END_BLOCK);

    // Get all events emitted by BondedECDSAKeepFactory in the interval provided
    let ecdsaevents = await ecdsaFactory.getPastEvents(
      "BondedECDSAKeepCreated",
      {
        fromBlock: START_BLOCK,
        toBlock: END_BLOCK, // You can also specify 'latest'
      }
    );
    let keepAddress;
    let blockNum;
    let txHash;
    let cloneAddress;
    let TDTOwner;
    let FRTExists;
    let TDTredeemable = false;
    let state;
    let lotSize;
    let events;

    // itterate over the ECDSA events for the interval
    for (let i = 0; i < ecdsaevents.length; i++) {
      // get array ov members for the keep
      let vls = ecdsaevents[i].returnValues["1"];
      for (let q = 0; q < vls.length; q++) {
        wait(500);
        // if the provided operator is part of the list, look for the DepositCloneCreated
        // event in the samt transaction (ensured by comparing transaction hashes) in order to get
        // the Deposit address. 
        // We need the Deposit address to get and interact with the deposit contract instance
        // The deposit address is also the TDT and FRT token ID. 
        if (vls[q] == operator) {
          txHash = ecdsaevents[i].transactionHash;
          blockNum = ecdsaevents[i].blockNumber;
          keepAddress = ecdsaevents[i].returnValues["keepAddress"];
          console.log(`opperator selected for keep ${keepAddress}`);
          events = await depositFactory.getPastEvents("DepositCloneCreated", {
            fromBlock: blockNum,
            toBlock: blockNum,
          });
          for (let i = 0; i < events.length; i++) {
            if (events[i].transactionHash == txHash) {
              cloneAddress = events[i].returnValues["0"];
            }
          }
          // create the deposit instance and get the State and lotSize of the Deposit
          const deposit = loader.fromArtifact("Deposit", cloneAddress);
          lotSize = await deposit.methods.lotSizeSatoshis().call();
          state = await deposit.methods.currentState().call();
          collateralizationRate = await deposit.methods.collateralizationPercentage().call()

          // If the FRT does not exist, the TDT has never been used to mint TBTC, and the deposit is not redeemable
          FRTExists = await frt.methods.exists(cloneAddress).call();
          if (FRTExists) {
            TDTOwner = await tdt.methods.ownerOf(cloneAddress).call();
            // if the TDT owner is not the VendingMAchine, the Deposit is not redeemable
            if (TDTOwner == vendingMachineAddress) {
              TDTredeemable = true;
            }
          }

          // Handle writing to Data folder...
          let KeepData = {
            keepAddress: keepAddress,
            blockNum: blockNum,
            cloneAddress: cloneAddress,
            lotSize: lotSize,
            state: states[state],
            FRTExists: FRTExists,
            redeemable: TDTredeemable,
            TDTOwner: TDTOwner,
            collateralizationRate: collateralizationRate,
          };
          var count = Object.keys(nodeData).length;
          nodeData[count.toString()] = KeepData;

          let logData = JSON.stringify(KeepData);
          fs.appendFileSync("data/logs.txt", `${time()} ${logData}\n`);
        }
        wait(1000);
      }
    }
    if (events == undefined || events.length == 0) {
      fs.appendFileSync(
        "data/logs.txt",
        `${time()} No keeps with member ${operator} in specified period\n`
      );
    }
  }
  let data = JSON.stringify(nodeData);
  fs.writeFileSync("data/nodeData.json", data);
}
populate();
