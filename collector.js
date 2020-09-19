
const Web3 = require('web3');
var fs = require("fs");

const depositAddress = "0xCffDCB12b74bE900e2020B9D96D256F1fEA96342"
const depositFactoryAddress = "0x87EFFeF56C7fF13E2463b5d4dCE81bE2340FAf8b"
const keepFactoryAddress = "0xA7d9E842EFB252389d613dA88EDa3731512e40bD"
const feeRebateTokenAddress = "0xaf3fFF06b75f99352d8C2a3C4beF1339a2f94789"
const TDTAddress = "0x10B66Bd1e3b5a936B7f8Dbc5976004311037Cdf0"
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

function wait(ms){
    var start = new Date().getTime();
    var end = start;
    while(end < start + ms) {
      end = new Date().getTime();
   }
 }
async function populate() {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
   }
    let nodeData = {}
    const web3 = new Web3(url);

    let END_BLOCK
    let BN = await web3.eth.getBlockNumber()

for(let START_BLOCK = 10879467; START_BLOCK<= BN - 999; START_BLOCK+= 1000 ){
    END_BLOCK = START_BLOCK + 1000
    const loader = setupLoader({ provider: web3 }).web3;
  
    const depositFactory = loader.fromArtifact('DepositFactory', depositFactoryAddress);
    const ecdsaFactory = loader.fromArtifact('BondedECDSAKeepFactory', keepFactoryAddress);
    const frt = loader.fromArtifact('FeeRebateToken', feeRebateTokenAddress);
    const tdt = loader.fromArtifact('TBTCDepositToken', TDTAddress);

    let log = "Gathering data from block #" + START_BLOCK + " - #" + END_BLOCK + '\n'
    fs.appendFile('logs.txt', log);
  
    fs.writeFileSync('blockUpdated.txt', END_BLOCK);
  
    let ecdsaevents = await ecdsaFactory.getPastEvents("BondedECDSAKeepCreated",
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
    let events
  
    for (let i = 0; i < ecdsaevents.length; i++) {
      let vls = ecdsaevents[i].returnValues["1"]
      for (let q = 0; q < vls.length; q++) {
        if (vls[q] == operator) {
          txHash = ecdsaevents[i].transactionHash
          blockNum = ecdsaevents[i].blockNumber
          keepAddress = ecdsaevents[i].returnValues['keepAddress']
          console.log("Got one")
          events = await depositFactory.getPastEvents("DepositCloneCreated",
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
          TDTOwner = await tdt.methods.ownerOf(cloneAddress).call()
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
          TDTOwner: TDTOwner
        };
        var count = Object.keys(nodeData).length;
        nodeData[count.toString()] = KeepData
      
        let logData = JSON.stringify(KeepData);
          fs.appendFileSync('logs.txt', logData + '\nend log\n');
        }
        wait(3000)
      }
    }
    if(events == undefined || events.length == 0){
        fs.appendFileSync('logs.txt', "no keeps with member " + operator + " in specified period \nend log\n");
    }
}
let data = JSON.stringify(nodeData);
console.log(data)
fs.writeFileSync('nodeData.json', data);

}
populate();