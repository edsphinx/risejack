// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IVRFConsumer
 * @author edsphinx
 * @custom:company blocketh
 * @notice Interface that contracts must implement to receive VRF callbacks
 */
interface IVRFConsumer {
    /**
     * @notice Callback function called by VRF Coordinator with random numbers
     * @param requestId The request ID returned from requestRandomNumbers
     * @param randomNumbers Array of random numbers
     */
    function rawFulfillRandomNumbers(uint256 requestId, uint256[] memory randomNumbers) external;
}
