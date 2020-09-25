const fs = require('fs')
const ethers = require('ethers')
const BondedECDSAKeepFactory = require("@keep-network/keep-ecdsa/artifacts/BondedECDSAKeepFactory.json")
const Deposit = require("@keep-network/tbtc/artifacts/Deposit.json")
const DepositFactory = require("@keep-network/tbtc/artifacts/DepositFactory.json")
const FeeRebateToken = require("@keep-network/tbtc/artifacts/FeeRebateToken.json")
const TBTCDepositToken = require("@keep-network/tbtc/artifacts/TBTCDepositToken.json")
const VendingMachine = require("@keep-network/tbtc/artifacts/VendingMachine.json")

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

function printUsage() {
  console.log('Usage: node all-keeps gather')
  console.log('Usage: node all-keeps stats')
}

async function main() {
  if (process.argv.length < 3) {
    printUsage()
    return
  }

  const action = process.argv[2]
  if (action === 'stats') {
    await stats()
  } else if (action === 'gather') {
    await gather()
  } else {
    printUsage()
    return
  }
}

async function stats() {
  let data = fs.readFileSync('data/allKeeps.json');
  let keeps = JSON.parse(data);
  const activeKeeps = keeps.filter(k => k.state === "ACTIVE")
  console.log(`Total keeps: ${keeps.length}`)
  console.log(`Total keeps active: ${activeKeeps.length}`)
  console.log(`BTC held in active keeps: ${activeKeeps.map(k => k.lotSize).reduce((a,b) => a + b, 0) / 100000000}`)
  console.log(`Lowest collateralization: ${Math.min.apply(Math, activeKeeps.map(k => k.collateralizationRate))}`)
}

async function gather() {
  const ip = new ethers.providers.InfuraProvider('homestead', "414a548bc7434bbfb7a135b694b15aa4")
  const bondedECDSAKeepFactory = new ethers.Contract("0xa7d9e842efb252389d613da88eda3731512e40bd", BondedECDSAKeepFactory.abi, ip)
  const depositFactory = new ethers.Contract(DepositFactory.networks["1"].address, DepositFactory.abi, ip)
  const frt = new ethers.Contract(FeeRebateToken.networks["1"].address, FeeRebateToken.abi, ip)
  const tdt = new ethers.Contract(TBTCDepositToken.networks["1"].address, TBTCDepositToken.abi, ip)

  // Assumption: these are the same length, and in the same order
  const createdKeeps = await bondedECDSAKeepFactory.queryFilter(bondedECDSAKeepFactory.filters.BondedECDSAKeepCreated());
  const depositClones = await depositFactory.queryFilter(depositFactory.filters.DepositCloneCreated());

  let index = 0;
  let allKeeps = []
  for (let keep of createdKeeps) {
    const depositCloneAddress = depositClones[index].args.depositCloneAddress
    const d = new ethers.Contract(depositCloneAddress, Deposit.abi, ip)
    const [frtExists, collateralizationRate, stateIndex, lotSize, tdtOwner] = await Promise.all([frt.exists(depositCloneAddress), d.collateralizationPercentage(), d.currentState(), d.lotSizeSatoshis(), tdt.ownerOf(depositCloneAddress)])
    const state = states[stateIndex]
    let tdtRedeemable = false
    if (frtExists) {
      if (tdtOwner == VendingMachine.networks["1"].address) {
        tdtRedeemable = true
      }
    }
    index++
    const newEntry = {
      keepAddress: keep.args.keepAddress,
      blockNum: keep.blockNumber,
      cloneAddress: depositCloneAddress,
      lotSize: lotSize.toNumber(),
      frtExists: frtExists,
      redeemable: tdtRedeemable,
      tdtOwner: tdtOwner,
      collateralizationRate: collateralizationRate.toNumber(),
      state: state,
      signers: keep.args.members
    }
    console.log(newEntry)
    allKeeps.push(newEntry)

    // Load existing data
    let data = JSON.stringify(allKeeps)
    fs.writeFileSync("data/allKeeps.json", data)
  }
  console.log(createdKeeps[0])
  console.log(depositClones[0])
  console.log(createdKeeps.length)
  console.log(depositClones.length)
}

main().catch(err => {
	console.error(err);
})
