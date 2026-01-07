/**
 * 01_VyreCasino - Deploy the central orchestrator
 * 
 * Dependencies: VyreTreasury
 * Owner: SAFE multisig
 */

// Existing contracts on Rise Testnet
const CHIP_TOKEN = "0x18cA3c414bD08C74622C3E3bFE7464903d95602A";

module.exports = async function (hre) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, get } = deployments;
    const { deployer, safe } = await getNamedAccounts();

    // Get treasury from previous deployment
    const treasury = await get("VyreTreasury");

    // Use SAFE on Rise Testnet, deployer on local
    const owner = network.name === "rise" ? safe : deployer;

    // XP Registry is optional (zero address for now)
    const xpRegistry = "0x0000000000000000000000000000000000000000";

    console.log(`\n🎰 Deploying VyreCasino...`);
    console.log(`   Network: ${network.name}`);
    console.log(`   Treasury: ${treasury.address}`);
    console.log(`   CHIP Token: ${CHIP_TOKEN}`);
    console.log(`   Owner (SAFE): ${owner}`);

    const result = await deploy("VyreCasino", {
        from: deployer,
        args: [treasury.address, CHIP_TOKEN, xpRegistry, owner],
        log: true,
        autoMine: true,
        skipIfAlreadyDeployed: true,
        waitConfirmations: network.name === "rise" ? 2 : 1,
    });

    if (result.newlyDeployed) {
        console.log(`✅ VyreCasino deployed at: ${result.address}`);

        if (network.name === "rise") {
            console.log(`🔍 Verifying on Blockscout...`);
            try {
                await hre.run("verify:verify", {
                    address: result.address,
                    constructorArguments: [treasury.address, CHIP_TOKEN, xpRegistry, owner],
                });
                console.log(`✅ Verified!`);
            } catch (e) {
                if (e.message && e.message.includes("Already Verified")) {
                    console.log(`ℹ️  Already verified`);
                } else {
                    console.log(`⚠️  Verification failed: ${e.message}`);
                }
            }
        }
    } else {
        console.log(`⏭️  VyreCasino already deployed at: ${result.address}`);
    }

    return true;
};

module.exports.id = "VyreCasino_v1";
module.exports.tags = ["casino", "core", "all"];
module.exports.dependencies = ["treasury"];
