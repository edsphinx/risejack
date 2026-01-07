/**
 * 00_VyreTreasury - Deploy the secure vault
 * 
 * Owner: SAFE multisig
 * Skip: If already deployed with same bytecode
 */
module.exports = async function (hre) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer, safe } = await getNamedAccounts();

    // Use SAFE on Rise Testnet, deployer on local
    const owner = network.name === "rise" ? safe : deployer;

    console.log(`\n🏦 Deploying VyreTreasury...`);
    console.log(`   Network: ${network.name}`);
    console.log(`   Deployer: ${deployer}`);
    console.log(`   Owner (SAFE): ${owner}`);

    const result = await deploy("VyreTreasury", {
        from: deployer,
        args: [owner],
        log: true,
        autoMine: true,
        skipIfAlreadyDeployed: true,
        waitConfirmations: network.name === "rise" ? 2 : 1,
    });

    if (result.newlyDeployed) {
        console.log(`✅ VyreTreasury deployed at: ${result.address}`);

        // Auto-verify on Rise Testnet
        if (network.name === "rise") {
            console.log(`🔍 Verifying on Blockscout...`);
            try {
                await hre.run("verify:verify", {
                    address: result.address,
                    constructorArguments: [owner],
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
        console.log(`⏭️  VyreTreasury already deployed at: ${result.address}`);
    }

    return true;
};

module.exports.id = "VyreTreasury_v1";
module.exports.tags = ["treasury", "core", "all"];
module.exports.dependencies = [];
