/**
 * 03_RegisterGame - Register VyreJackCore in VyreCasino
 * 
 * Dependencies: VyreCasino, VyreJackCore
 * Action: casino.registerGame(vyreJackCore)
 * Skip: If game already registered
 */
module.exports = async function (hre) {
    const { deployments, getNamedAccounts } = hre;
    const { get, execute, read } = deployments;
    const { deployer } = await getNamedAccounts();

    const casino = await get("VyreCasino");
    const game = await get("VyreJackCore");

    console.log(`\n📝 Registering VyreJackCore in VyreCasino...`);
    console.log(`   Casino: ${casino.address}`);
    console.log(`   Game: ${game.address}`);

    // Check if already registered
    const isRegistered = await read("VyreCasino", "registeredGames", game.address);

    if (isRegistered) {
        console.log(`⏭️  VyreJackCore already registered in VyreCasino`);
        return true;
    }

    // Register the game
    console.log(`   Registering game...`);
    await execute(
        "VyreCasino",
        { from: deployer, log: true },
        "registerGame",
        game.address
    );

    console.log(`✅ VyreJackCore registered in VyreCasino`);
    return true;
};

module.exports.id = "RegisterGame_v1";
module.exports.tags = ["register", "all"];
module.exports.dependencies = ["game"];
