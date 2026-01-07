/**
 * 04_ConfigureLimits - Configure treasury limits and whitelist tokens
 * 
 * Dependencies: VyreTreasury, VyreCasino, VyreJackCore
 */

const { ethers } = require("hardhat");

// Existing contracts on Rise Testnet
const CHIP_TOKEN = "0x18cA3c414bD08C74622C3E3bFE7464903d95602A";

module.exports = async function (hre) {
    const { deployments, getNamedAccounts, network } = hre;
    const { get, execute, read } = deployments;
    const { deployer } = await getNamedAccounts();

    const treasury = await get("VyreTreasury");
    const casino = await get("VyreCasino");

    console.log(`\n⚙️  Configuring limits and whitelists...`);

    // 1. Set operator on Treasury (if not set)
    const currentOperator = await read("VyreTreasury", "operator");
    const zeroAddr = "0x0000000000000000000000000000000000000000";

    if (currentOperator === zeroAddr) {
        console.log(`   Setting Treasury operator to Casino...`);
        await execute(
            "VyreTreasury",
            { from: deployer, log: true },
            "setOperator",
            casino.address
        );
        console.log(`   ✅ Operator set`);
    } else if (currentOperator.toLowerCase() === casino.address.toLowerCase()) {
        console.log(`   ⏭️  Treasury operator already set to Casino`);
    } else {
        console.log(`   ⚠️  Treasury operator is ${currentOperator} (expected: ${casino.address})`);
    }

    // 2. Set daily limit on Treasury (1M CHIP)
    const dailyLimit = ethers.parseEther("1000000"); // 1M CHIP
    const currentLimit = await read("VyreTreasury", "dailyLimits", CHIP_TOKEN);
    if (currentLimit === 0n) {
        console.log(`   Setting daily limit for CHIP...`);
        await execute(
            "VyreTreasury",
            { from: deployer, log: true },
            "setDailyLimit",
            CHIP_TOKEN,
            dailyLimit
        );
        console.log(`   ✅ Daily limit set to 1M CHIP`);
    } else {
        console.log(`   ⏭️  Daily limit already set: ${ethers.formatEther(currentLimit)} CHIP`);
    }

    // 3. Whitelist CHIP in Casino (if not whitelisted)
    const isWhitelisted = await read("VyreCasino", "whitelistedTokens", CHIP_TOKEN);
    if (!isWhitelisted) {
        console.log(`   Whitelisting CHIP in Casino...`);
        await execute(
            "VyreCasino",
            { from: deployer, log: true },
            "whitelistToken",
            CHIP_TOKEN
        );
        console.log(`   ✅ CHIP whitelisted`);
    } else {
        console.log(`   ⏭️  CHIP already whitelisted`);
    }

    // 4. Set bet limits on VyreJackCore
    const minBet = ethers.parseEther("1"); // 1 CHIP
    const maxBet = ethers.parseEther("10000"); // 10K CHIP

    const currentMinBet = await read("VyreJackCore", "minBetByToken", CHIP_TOKEN);
    if (currentMinBet === 0n) {
        console.log(`   Setting bet limits for CHIP...`);
        await execute(
            "VyreJackCore",
            { from: deployer, log: true },
            "setMinBet",
            CHIP_TOKEN,
            minBet
        );
        await execute(
            "VyreJackCore",
            { from: deployer, log: true },
            "setMaxBet",
            CHIP_TOKEN,
            maxBet
        );
        console.log(`   ✅ Bet limits set: 1 - 10,000 CHIP`);
    } else {
        console.log(`   ⏭️  Bet limits already configured`);
    }

    console.log(`✅ Configuration complete`);
    return true;
};

module.exports.id = "ConfigureLimits_v1";
module.exports.tags = ["limits", "all"];
module.exports.dependencies = ["register"];
