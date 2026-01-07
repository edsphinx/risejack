/**
 * 06_SyncABIs - Copy deployed contract ABIs to frontend
 * 
 * Dependencies: All contracts deployed and verified
 * Action: Copy deployments/rise/*.json ABIs to apps/web/src/lib/contracts/
 */

const fs = require("fs");
const path = require("path");

const FRONTEND_CONTRACTS_PATH = "../../apps/web/src/lib/contracts";

module.exports = async function (hre) {
    const { deployments, network } = hre;
    const { get } = deployments;

    console.log(`\n📦 Syncing ABIs to frontend...`);

    // Only sync for Rise Testnet
    if (network.name !== "rise") {
        console.log(`⏭️  Skipping ABI sync for network: ${network.name}`);
        return true;
    }

    const contractsDir = path.resolve(__dirname, FRONTEND_CONTRACTS_PATH);

    // Create directory if it doesn't exist
    if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
        console.log(`   Created directory: ${contractsDir}`);
    }

    // Contracts to sync
    const contracts = ["VyreTreasury", "VyreCasino", "VyreJackCore"];

    const deployedContracts = {};

    for (const contractName of contracts) {
        try {
            const deployment = await get(contractName);

            deployedContracts[contractName] = {
                address: deployment.address,
                abi: deployment.abi,
            };

            // Write individual ABI file
            const abiPath = path.join(contractsDir, `${contractName}.json`);
            fs.writeFileSync(abiPath, JSON.stringify({
                address: deployment.address,
                abi: deployment.abi,
            }, null, 2));

            console.log(`   ✅ ${contractName}: ${deployment.address}`);
        } catch (e) {
            console.log(`   ⚠️  ${contractName}: Not found in deployments`);
        }
    }

    // Write consolidated addresses file
    const addressesPath = path.join(contractsDir, "addresses.json");
    const addressesContent = {
        network: "rise-testnet",
        chainId: 11155931,
        timestamp: new Date().toISOString(),
        contracts: Object.fromEntries(
            Object.entries(deployedContracts).map(([name, info]) => [name, info.address])
        ),
        preExisting: {
            CHIPToken: "0x18cA3c414bD08C74622C3E3bFE7464903d95602A",
            VRFCoordinator: "0x9d57aB4517ba97349551C876a01a7580B1338909",
            UniswapV2Router: "0x67b3925D7b2b2d9BD316DAC8bCF888A60B9F24F0",
            SAFEWallet: "0x108ca5cf713cb0b964d187f19cd7b7d317841c31",
        },
    };
    fs.writeFileSync(addressesPath, JSON.stringify(addressesContent, null, 2));
    console.log(`   ✅ Generated addresses.json`);

    console.log(`\n✅ ABIs synced to: ${contractsDir}`);
    return true;
};

module.exports.id = "SyncABIs_v1";
module.exports.tags = ["sync", "frontend", "all"];
module.exports.dependencies = ["fund"];
module.exports.runAtTheEnd = true;
