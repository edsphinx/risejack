// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) external returns (address proxy);
}

interface ISafe {
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

/**
 * @title DeploySafe
 * @notice Deploy a Gnosis Safe multisig on Rise Testnet
 * 
 * Run with:
 * forge script script/DeploySafe.s.sol:DeploySafe --rpc-url https://testnet.riselabs.xyz --broadcast
 */
contract DeploySafe is Script {
    // Rise Testnet addresses (deterministic deployment, same as mainnet)
    address constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address constant SAFE_SINGLETON = 0x41675C099F32341bf84BFc5382aF534df5C7461a; // Safe L2 v1.3.0
    address constant COMPATIBILITY_FALLBACK_HANDLER = 0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        // Owners for the Safe (2/2 multisig)
        address[] memory owners = new address[](2);
        owners[0] = 0x062FCBbE1CA8FC6d79D9a650d8022412d53B08F6; // Deployer
        owners[1] = 0xd7137FC5acE1327B816DE9271f12883EB885435e; // Second owner
        
        uint256 threshold = 2; // Require both signatures
        
        // Encode the setup call
        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            threshold,
            address(0), // to - no delegate call
            "", // data
            COMPATIBILITY_FALLBACK_HANDLER, // fallbackHandler
            address(0), // paymentToken
            0, // payment
            payable(address(0)) // paymentReceiver
        );
        
        // Use timestamp as salt nonce for uniqueness
        uint256 saltNonce = block.timestamp;
        
        vm.startBroadcast(deployerPrivateKey);
        
        ISafeProxyFactory factory = ISafeProxyFactory(SAFE_PROXY_FACTORY);
        
        address safeProxy = factory.createProxyWithNonce(
            SAFE_SINGLETON,
            initializer,
            saltNonce
        );
        
        vm.stopBroadcast();
        
        console.log("=== Safe Multisig Deployed ===");
        console.log("Safe Address:", safeProxy);
        console.log("Owners:");
        console.log("  1:", owners[0]);
        console.log("  2:", owners[1]);
        console.log("Threshold: 2/2");
        console.log("");
        console.log("Add to app.safe.global with Rise Testnet:");
        console.log("  RPC: https://testnet.riselabs.xyz");
        console.log("  Chain ID: 713715");
    }
}
