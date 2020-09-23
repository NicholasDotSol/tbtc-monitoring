const ethers = require('ethers');

const TokenStaking = require("@keep-network/keep-core/artifacts/TokenStaking.json")
const KeepBonding = require("@keep-network/keep-ecdsa/artifacts/KeepBonding.json")
const BondedECDSAKeepFactory = require("@keep-network/keep-ecdsa/artifacts/BondedECDSAKeepFactory.json")

async function main() {
	try {
		const ip = new ethers.providers.InfuraProvider('homestead', process.env.INFURA_API);

		const stakingContract = new ethers.Contract(TokenStaking.networks["1"].address, TokenStaking.abi, ip)
		const keepBondingContract = new ethers.Contract(KeepBonding.networks["1"].address, KeepBonding.abi, ip);
    const bondedECDSAKeepFactory = new ethers.Contract("0xa7d9e842efb252389d613da88eda3731512e40bd", BondedECDSAKeepFactory.abi, ip);

		const stakeEvs = await stakingContract.queryFilter(stakingContract.filters.OperatorStaked());
		const operators = stakeEvs.map((e) => { return [e.args['operator'], e.args['value']] })
		console.log(`We have ${operators.length} staking events`)

		const threshold = ethers.utils.parseEther('20.0')

		let kStaked = ethers.constants.Zero
		let eStaked = ethers.constants.Zero
		let eStakedAll = ethers.constants.Zero
    let registeredNodeCount = 0
		for (let op of operators) {
			const kbal = op[1]
      const available = await keepBondingContract.unbondedValue(op[0])
      const isRegistered = await bondedECDSAKeepFactory.isOperatorRegistered(op[0], "0xe20A5C79b39bC8C363f0f49ADcFa82C2a01ab64a")
			console.log(`${op[0]} stakes ${ethers.utils.formatEther(kbal)} KEEP + ${ethers.utils.formatEther(available)} ETH unbonded - registered ${isRegistered}`)
      eStakedAll = eStakedAll.add(available)
      if (isRegistered) {
        kStaked = kStaked.add(kbal)
        eStaked = eStaked.add(available)
        registeredNodeCount += 1
      }
		}
		console.log(`total staked amongst registered nodes: ${ethers.utils.formatEther(kStaked)} - with ${ethers.utils.formatEther(eStaked)} unbonded ${registeredNodeCount} nodes`)

	} catch(err) {
		console.error(`Something went wrong: ${err.message}`)
		process.exit(1)
	}
}

main().catch(err => {
	console.error(err);
})
