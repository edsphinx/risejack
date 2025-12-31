require("@nomicfoundation/hardhat-verify");

/**
 * Hardhat Configuration for Rise Casino
 * 
 * PURPOSE: This config is ONLY used for contract verification on Blockscout.
 * All development, testing, and deployment is done with Foundry.
 * 
 * viaIR is ENABLED here to match the Foundry CI profile settings,
 * ensuring bytecode matches for verification of complex contracts
 * like RiseCasinoRouter that require IR optimization.
 */

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            // viaIR enabled to match Foundry CI profile for verification consistency
            viaIR: true,
            evmVersion: "prague",
        },
    },
    networks: {
        rise: {
            url: "https://testnet.riselabs.xyz",
            chainId: 11155931,
        },
    },
    sourcify: {
        enabled: false,
    },
    etherscan: {
        apiKey: {
            rise: "no-api-key-needed",
        },
        customChains: [
            {
                network: "rise",
                chainId: 11155931,
                urls: {
                    apiURL: "https://explorer.testnet.riselabs.xyz/api",
                    browserURL: "https://explorer.testnet.riselabs.xyz",
                },
            },
        ],
    },
    paths: {
        sources: "./src",
    },
};
