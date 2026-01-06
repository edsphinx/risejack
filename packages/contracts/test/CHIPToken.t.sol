// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { CHIPToken } from "../src/tokens/defi/CHIPToken.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CHIPTokenTest is Test {
    using SafeERC20 for IERC20;
    CHIPToken chip;
    address owner = address(this);
    address alice = address(0x1);
    address bob = address(0x2);

    uint256 constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 Billion

    function setUp() public {
        chip = new CHIPToken(owner);
        vm.label(address(chip), "CHIP");
        vm.label(alice, "Alice");
        vm.label(bob, "Bob");
    }

    // ==================== INITIAL STATE ====================

    function test_Name() public view {
        assertEq(chip.name(), "Vyre Chip");
    }

    function test_Symbol() public view {
        assertEq(chip.symbol(), "CHIP");
    }

    function test_Decimals() public view {
        assertEq(chip.decimals(), 18);
    }

    function test_InitialSupply() public view {
        assertEq(chip.totalSupply(), INITIAL_SUPPLY);
        assertEq(chip.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_Owner() public view {
        assertEq(chip.owner(), owner);
    }

    // ==================== MINT ====================

    function test_MintByOwner() public {
        uint256 amount = 1000e18;
        chip.mint(alice, amount);

        assertEq(chip.balanceOf(alice), amount);
        assertEq(chip.totalSupply(), INITIAL_SUPPLY + amount);
    }

    function test_MintToZeroAddress() public {
        vm.expectRevert();
        chip.mint(address(0), 1000e18);
    }

    function test_MintOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        chip.mint(alice, 1000e18);
    }

    function testFuzz_Mint(
        address to,
        uint256 amount
    ) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max - INITIAL_SUPPLY);

        uint256 balanceBefore = chip.balanceOf(to);
        chip.mint(to, amount);
        assertEq(chip.balanceOf(to), balanceBefore + amount);
    }

    // ==================== BURN ====================

    function test_Burn() public {
        uint256 burnAmount = 100e18;
        uint256 initialBalance = chip.balanceOf(owner);

        chip.burn(burnAmount);

        assertEq(chip.balanceOf(owner), initialBalance - burnAmount);
        assertEq(chip.totalSupply(), INITIAL_SUPPLY - burnAmount);
    }

    function test_BurnMoreThanBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        chip.burn(1e18);
    }

    function test_BurnFrom() public {
        uint256 amount = 100e18;
        IERC20(address(chip)).safeTransfer(alice, amount);

        vm.prank(alice);
        chip.approve(owner, amount);

        chip.burnFrom(alice, amount);

        assertEq(chip.balanceOf(alice), 0);
    }

    function test_BurnFromWithoutApproval() public {
        IERC20(address(chip)).safeTransfer(alice, 100e18);

        vm.expectRevert();
        chip.burnFrom(alice, 100e18);
    }

    // ==================== TRANSFER ====================

    function test_Transfer() public {
        uint256 amount = 100e18;
        IERC20(address(chip)).safeTransfer(alice, amount);

        assertEq(chip.balanceOf(alice), amount);
        assertEq(chip.balanceOf(owner), INITIAL_SUPPLY - amount);
    }

    function test_TransferFrom() public {
        uint256 amount = 100e18;
        chip.approve(alice, amount);

        vm.prank(alice);
        IERC20(address(chip)).safeTransferFrom(owner, bob, amount);

        assertEq(chip.balanceOf(bob), amount);
    }

    // ==================== PERMIT ====================

    function test_Permit() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        uint256 amount = 100e18;

        IERC20(address(chip)).safeTransfer(signer, amount);

        uint256 nonce = chip.nonces(signer);
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                chip.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256(
                            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                        ),
                        signer,
                        bob,
                        amount,
                        nonce,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        chip.permit(signer, bob, amount, deadline, v, r, s);

        assertEq(chip.allowance(signer, bob), amount);
    }

    function test_PermitExpired() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        uint256 amount = 100e18;
        uint256 deadline = block.timestamp - 1; // Expired

        bytes32 permitHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                chip.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256(
                            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                        ),
                        signer,
                        bob,
                        amount,
                        0,
                        deadline
                    )
                )
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, permitHash);

        vm.expectRevert();
        chip.permit(signer, bob, amount, deadline, v, r, s);
    }

    // ==================== OWNERSHIP ====================

    function test_TransferOwnership() public {
        chip.transferOwnership(alice);
        assertEq(chip.owner(), alice);
    }

    function test_RenounceOwnership() public {
        chip.renounceOwnership();
        assertEq(chip.owner(), address(0));
    }

    function test_TransferOwnershipOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        chip.transferOwnership(bob);
    }
}
