/**
 * 05_FundTreasury - Transfer initial CHIP to treasury
 * 
 * Dependencies: VyreTreasury configured
 * Action: CHIP.transfer(treasury, 100K CHIP)
 * Skip: If treasury already has sufficient balance
 */

const { ethers } = require("hardhat");

// Existing contracts on Rise Testnet
const CHIP_TOKEN = "0x18cA3c414bD08C74622C3E3bFE7464903d95602A";
const INITIAL_TREASURY_AMOUNT = ethers.parseEther("100000"); // 100K CHIP
const MIN_TREASURY_BALANCE = ethers.parseEther("10000"); // 10K CHIP minimum

module.exports = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { get } = deployments;
    const { deployer } = await getNamedAccounts();

    const treasury = await get("VyreTreasury");

    console.log(`\n💰 Funding Treasury with CHIP...`);
    console.log(`   Treasury: ${treasury.address}`);

    // Get CHIP contract
    const chip = await ethers.getContractAt("IERC20", CHIP_TOKEN);

    // Check treasury balance
    const treasuryBalance = await chip.balanceOf(treasury.address);
    console.log(`   Current treasury balance: ${ethers.formatEther(treasuryBalance)} CHIP`);

    if (treasuryBalance >= MIN_TREASURY_BALANCE) {
        console.log(`⏭️  Treasury already has sufficient CHIP balance`);
        return true;
    }

    // Check deployer balance
    const deployerBalance = await chip.balanceOf(deployer);
    console.log(`   Deployer balance: ${ethers.formatEther(deployerBalance)} CHIP`);

    if (deployerBalance < INITIAL_TREASURY_AMOUNT) {
        console.log(`⚠️  Deployer doesn't have enough CHIP to fund treasury`);
        console.log(`   Need: ${ethers.formatEther(INITIAL_TREASURY_AMOUNT)} CHIP`);
        console.log(`   Have: ${ethers.formatEther(deployerBalance)} CHIP`);
        console.log(`\n   To fund treasury manually:`);
        console.log(`   1. Mint CHIP from SAFE multisig`);
        console.log(`   2. Transfer to treasury: ${treasury.address}`);
        return true; // Don't fail the deployment
    }

    // Transfer CHIP to treasury
    console.log(`   Transferring ${ethers.formatEther(INITIAL_TREASURY_AMOUNT)} CHIP to treasury...`);
    const signer = await ethers.getSigner(deployer);
    const tx = await chip.connect(signer).transfer(treasury.address, INITIAL_TREASURY_AMOUNT);
    await tx.wait();

    const newBalance = await chip.balanceOf(treasury.address);
    console.log(`✅ Treasury funded: ${ethers.formatEther(newBalance)} CHIP`);

    return true;
};

module.exports.id = "FundTreasury_v1";
module.exports.tags = ["fund", "all"];
module.exports.dependencies = ["limits"];
