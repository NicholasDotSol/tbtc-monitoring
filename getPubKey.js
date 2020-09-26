const ethers = require('ethers');
const BondedECDSAKeep = require("@keep-network/keep-ecdsa/artifacts/BondedECDSAKeep.json")

async function main() {
    if(process.argv.length <= 2){
        console.log("Expected command line argument: KeepAddress")
    }
	try {
		const ip = new ethers.providers.InfuraProvider('homestead', "414a548bc7434bbfb7a135b694b15aa4");
    	const bondedECDSAKeep = new ethers.Contract(process.argv[2], BondedECDSAKeep.abi, ip);
        const events = await bondedECDSAKeep.queryFilter(bondedECDSAKeep.filters.PublicKeyPublished());
        const pubKey = events[0].args['publicKey']
		console.log(pubKey)
	} catch(err) {
		console.error(`Whoops: ${err.message}`)
		process.exit(1)
	}
}

main().catch(err => {
	console.error(err);
})
