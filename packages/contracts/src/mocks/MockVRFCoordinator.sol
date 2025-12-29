// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IVRFCoordinator } from "../interfaces/IVRFCoordinator.sol";
import { IVRFConsumer } from "../interfaces/IVRFConsumer.sol";

/**
 * @title MockVRFCoordinator
 * @author edsphinx
 * @custom:company blocketh
 * @notice Mock VRF Coordinator for local development and testing
 * @dev Deploy this alongside RiseJack for local Anvil testing
 *
 * Usage:
 * 1. Deploy MockVRFCoordinator
 * 2. Deploy Blackjack with MockVRFCoordinator address
 * 3. When player calls placeBet(), note the requestId from events
 * 4. Call fulfillRequest(requestId, randomNumbers) to simulate VRF response
 */
contract MockVRFCoordinator is IVRFCoordinator {
    // ==================== STATE ====================

    /// @notice Auto-incrementing request ID
    uint256 public lastRequestId;

    /// @notice Maps request ID to the consumer contract that made the request
    mapping(uint256 => address) public requestToConsumer;

    /// @notice Maps request ID to number of random numbers requested
    mapping(uint256 => uint32) public requestToNumNumbers;

    /// @notice Maps request ID to whether it has been fulfilled
    mapping(uint256 => bool) public requestFulfilled;

    // ==================== EVENTS ====================

    event RandomnessRequested(
        uint256 indexed requestId, address indexed consumer, uint32 numNumbers, uint256 seed
    );

    event RandomnessFulfilled(
        uint256 indexed requestId, address indexed consumer, uint256[] randomNumbers
    );

    // ==================== VRF COORDINATOR INTERFACE ====================

    /**
     * @notice Request random numbers (called by consumer contracts)
     * @param numNumbers How many random numbers you need
     * @param seed Seed for randomness generation (ignored in mock, but logged)
     * @return requestId Unique identifier for the request
     */
    function requestRandomNumbers(
        uint32 numNumbers,
        uint256 seed
    ) external override returns (uint256 requestId) {
        lastRequestId++;
        requestId = lastRequestId;

        // Store request details
        requestToConsumer[requestId] = msg.sender;
        requestToNumNumbers[requestId] = numNumbers;

        emit RandomnessRequested(requestId, msg.sender, numNumbers, seed);

        return requestId;
    }

    // ==================== MOCK FUNCTIONS ====================

    /**
     * @notice Fulfill a VRF request with specific random numbers
     * @dev Call this to simulate the VRF oracle response
     * @param requestId The request ID to fulfill
     * @param randomNumbers Array of random numbers to send to consumer
     */
    function fulfillRequest(
        uint256 requestId,
        uint256[] calldata randomNumbers
    ) external {
        address consumer = requestToConsumer[requestId];
        require(consumer != address(0), "Request ID not found");
        require(!requestFulfilled[requestId], "Already fulfilled");
        require(randomNumbers.length >= requestToNumNumbers[requestId], "Not enough random numbers");

        requestFulfilled[requestId] = true;

        emit RandomnessFulfilled(requestId, consumer, randomNumbers);

        // Call the consumer's callback
        IVRFConsumer(consumer).rawFulfillRandomNumbers(requestId, randomNumbers);
    }

    /**
     * @notice Fulfill a VRF request with auto-generated random numbers
     * @dev Generates pseudo-random numbers based on seed for convenience
     * @param requestId The request ID to fulfill
     * @param seed Seed to generate random numbers from
     */
    function fulfillRequestWithSeed(
        uint256 requestId,
        uint256 seed
    ) external {
        address consumer = requestToConsumer[requestId];
        require(consumer != address(0), "Request ID not found");
        require(!requestFulfilled[requestId], "Already fulfilled");

        uint32 numNumbers = requestToNumNumbers[requestId];
        uint256[] memory randomNumbers = new uint256[](numNumbers);

        for (uint32 i = 0; i < numNumbers; i++) {
            randomNumbers[i] = uint256(keccak256(abi.encode(seed, i, block.timestamp)));
        }

        requestFulfilled[requestId] = true;

        emit RandomnessFulfilled(requestId, consumer, randomNumbers);

        // Call the consumer's callback
        IVRFConsumer(consumer).rawFulfillRandomNumbers(requestId, randomNumbers);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get details about a request
     */
    function getRequest(
        uint256 requestId
    ) external view returns (address consumer, uint32 numNumbers, bool fulfilled) {
        return (
            requestToConsumer[requestId],
            requestToNumNumbers[requestId],
            requestFulfilled[requestId]
        );
    }

    /**
     * @notice Check if there are pending requests
     */
    function hasPendingRequests() external view returns (bool) {
        for (uint256 i = 1; i <= lastRequestId; i++) {
            if (!requestFulfilled[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Get all pending request IDs
     */
    function getPendingRequests() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= lastRequestId; i++) {
            if (!requestFulfilled[i]) {
                count++;
            }
        }

        uint256[] memory pending = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= lastRequestId; i++) {
            if (!requestFulfilled[i]) {
                pending[index] = i;
                index++;
            }
        }

        return pending;
    }
}
