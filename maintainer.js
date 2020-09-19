
const Web3 = require('web3');
var fs = require("fs");
let nodeData = require('./nodeData')

const depositAddress = "0xCffDCB12b74bE900e2020B9D96D256F1fEA96342"
const depositFactoryAddress = "0x87EFFeF56C7fF13E2463b5d4dCE81bE2340FAf8b"
const keepFactoryAddress = "0xA7d9E842EFB252389d613dA88EDa3731512e40bD"
const feeRebateTokenAddress = "0xaf3fFF06b75f99352d8C2a3C4beF1339a2f94789"
const vendingMachineAddress = "0x526c08E5532A9308b3fb33b7968eF78a5005d2AC"
const { setupLoader } = require('@openzeppelin/contract-loader');
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
  "LIQUIDATED"
]
//change these only
const operator = '0x39d2aCBCD80d80080541C6eed7e9feBb8127B2Ab'
const url = "https://eth-mainnet.alchemyapi.io/v2/6Euy0LCtPGXsd5fnPe3Er4CZ7bEgwd6w";
//
var dir = './data';


async function getRecents() {

  if (!fs.existsSync(dir)){
    console.log("data folder does not exists. Run collector script first")
  }
  const web3 = new Web3(url);
  const loader = setupLoader({ provider: web3 }).web3;

  const depositFactory = loader.fromArtifact('DepositFactory', depositFactoryAddress);
  const ecdsaFactory = loader.fromArtifact('BondedECDSAKeepFactory', keepFactoryAddress);
  const frt = loader.fromArtifact('FeeRebateToken', feeRebateTokenAddress);
  let END_BLOCK = await web3.eth.getBlockNumber()

  let read = fs.readFileSync('data/blockUpdated.txt');
  let START_BLOCK = Number(read);

  if (START_BLOCK == 0) {
    START_BLOCK = END_BLOCK - 999
  }
  let log = "Gathering data from block #" + START_BLOCK + " - #" + END_BLOCK + '\n'
  fs.appendFile('data/logs.txt', log);

  fs.writeFileSync('data/blockUpdated.txt', END_BLOCK);

  let events = await ecdsaFactory.getPastEvents("BondedECDSAKeepCreated",
    {
      fromBlock: START_BLOCK,
      toBlock: END_BLOCK // You can also specify 'latest'          
    })
  let ecdsaSelected = false
  let keepAddress
  let blockNum
  let transactionIndex
  let txHash
  let cloneAddress
  let TDTOwner
  let FRTExists
  let TDTredeemable = false
  let state
  let lotSize

  for (let i = 0; i < events.length; i++) {
    let vls = events[i].returnValues["1"]
    for (let q = 0; q < vls.length; q++) {

      if (vls[q] == operator) {
        txHash = events[i].transactionHash
        blockNum = events[i].blockNumber
        ecdsaSelected = true
        keepAddress = events[i].returnValues['keepAddress']
      }
    }
  }
  if (ecdsaSelected) {
    let events = await depositFactory.getPastEvents("DepositCloneCreated",
      {
        fromBlock: blockNum,
        toBlock: blockNum // You can also specify 'latest'          
      })
    for (let i = 0; i < events.length; i++) {
      if (events[i].transactionHash == txHash) {
        cloneAddress = events[i].returnValues["0"]
      }
    }

    const deposit = loader.fromArtifact('Deposit', cloneAddress);
    lotSize = await deposit.methods.lotSizeSatoshis().call()
    state = await deposit.methods.currentState().call()

    FRTExists = await frt.methods.exists(cloneAddress).call()
    if (FRTExists) {
      TDTOwner = await frt.methods.ownerOf(cloneAddress).call()
      if (TDTOwner == vendingMachineAddress) {
        TDTredeemable = true
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
    };
  
    var count = Object.keys(nodeData).length;
    nodeData[count.toString()] = KeepData
  
    let logData = JSON.stringify(KeepData);

    let data = JSON.stringify(nodeData);
    fs.appendFile('data/logs.txt', data + '\nend log\n');

    fs.writeFileSync('data/nodeData.json', logData);
  }
  else {
    fs.appendFile('data/logs.txt', "no keeps with member " + operator + " in specified period \nend log\n");
  }
}
getRecents();