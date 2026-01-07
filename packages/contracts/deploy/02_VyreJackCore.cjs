/**
 * 02_VyreJackCore - Deploy the blackjack game
 * 
 * Dependencies: VyreCasino
 * VRF: Rise Chain native VRF coordinator
 */

// Rise Testnet VRF Coordinator
const VRF_COORDINATOR = "0x9d57aB4517ba97349551C876a01a7580B1338909";

module.exports = async function (hre) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    // Get casino from previous deployment
    const casino = await get("VyreCasino");

    console.log(`\n🃏 Deploying VyreJackCore...`);
    console.log(`   Network: ${network.name}`);
    console.log(`   Casino: ${casino.address}`);
    console.log(`   VRF Coordinator: ${VRF_COORDINATOR}`);

    const result = await deploy("VyreJackCore", {
        from: deployer,
        args: [VRF_COORDINATOR, casino.address],
        log: true,
        autoMine: true,
        skipIfAlreadyDeployed: true,
        waitConfirmations: network.name === "rise" ? 2 : 1,
    });

    if (result.newlyDeployed) {
        console.log(`✅ VyreJackCore deployed at: ${result.address}`);

        if (network.name === "rise") {
            console.log(`🔍 Verifying on Blockscout...`);
            try {
                await hre.run("verify:verify", {
                    address: result.address,
                    constructorArguments: [VRF_COORDINATOR, casino.address],
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
        console.log(`⏭️  VyreJackCore already deployed at: ${result.address}`);
    }

    return true;
};

module.exports.id = "VyreJackCore_v1";
module.exports.tags = ["game", "blackjack", "all"];
module.exports.dependencies = ["casino"];
