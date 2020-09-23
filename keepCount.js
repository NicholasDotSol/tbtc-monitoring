const Web3 = require("web3");
const { url } = require("./scriptConfig.js");

const { setupLoader } = require("@openzeppelin/contract-loader");

async function keepCount() {
  const web3 = new Web3(url);
  const loader = setupLoader({ provider: web3 }).web3;
  const factory = loader.fromArtifact("BondedECDSAKeepFactory", "0xa7d9e842efb252389d613da88eda3731512e40bd");
  let keepcount = await factory.methods.getKeepCount().call();
  console.log(`Total keeps created by factory: ${keepcount}`)
}
keepCount();
