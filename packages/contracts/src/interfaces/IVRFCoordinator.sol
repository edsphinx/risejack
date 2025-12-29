// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IVRFCoordinator
 * @notice Interface for Rise Chain VRF Coordinator
 */
interface IVRFCoordinator {
    /**
     * @notice Request random numbers from VRF
     * @param numNumbers How many random numbers you need
     * @param seed Seed for randomness generation
     * @return requestId Unique identifier for the request
     */
    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 seed
    ) external returns (uint256 requestId);
}
