require("@nomicfoundation/hardhat-verify");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
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
