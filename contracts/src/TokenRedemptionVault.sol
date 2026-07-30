// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20BurnableFrom is IERC20 {
    function burnFrom(address account, uint256 amount) external;
}

/// @title TokenRedemptionVault
/// @notice Burns one supported token and releases its limited counterpart 1:1.
/// @dev Deploy one vault per pair. Both tokens must use the same decimals.
contract TokenRedemptionVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20BurnableFrom public immutable burnToken;
    IERC20 public immutable limitedToken;

    uint256 public totalRedeemed;

    error ZeroAddress();
    error ZeroAmount();
    error DecimalMismatch(uint8 burnDecimals, uint8 limitedDecimals);
    error InsufficientReserve(uint256 requested, uint256 available);
    error ExactOutputRequired(uint256 expected, uint256 received);

    event PoolFunded(address indexed funder, uint256 requested, uint256 received);
    event Redeemed(address indexed account, uint256 amount);
    event UnusedLimitedTokensWithdrawn(address indexed recipient, uint256 amount);

    constructor(address burnToken_, address limitedToken_, address initialOwner)
        Ownable(initialOwner)
    {
        if (burnToken_ == address(0) || limitedToken_ == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }

        uint8 burnDecimals = IERC20Metadata(burnToken_).decimals();
        uint8 limitedDecimals = IERC20Metadata(limitedToken_).decimals();
        if (burnDecimals != limitedDecimals) {
            revert DecimalMismatch(burnDecimals, limitedDecimals);
        }

        burnToken = IERC20BurnableFrom(burnToken_);
        limitedToken = IERC20(limitedToken_);
    }

    /// @notice Returns the limited tokens currently available for redemption.
    function reserve() public view returns (uint256) {
        return limitedToken.balanceOf(address(this));
    }

    /// @notice Pulls limited tokens into the pool and reports the actual amount received.
    /// @dev The owner can also transfer limited tokens directly to this vault.
    function fund(uint256 amount) external onlyOwner nonReentrant returns (uint256 received) {
        if (amount == 0) revert ZeroAmount();

        uint256 beforeBalance = reserve();
        limitedToken.safeTransferFrom(msg.sender, address(this), amount);
        received = reserve() - beforeBalance;

        emit PoolFunded(msg.sender, amount, received);
    }

    /// @notice Burns `amount` from the caller and transfers the same amount of limited tokens.
    /// @dev The burn and transfer are atomic: either both succeed or both are reverted.
    function redeem(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        uint256 available = reserve();
        if (available < amount) revert InsufficientReserve(amount, available);

        burnToken.burnFrom(msg.sender, amount);

        uint256 beforeBalance = limitedToken.balanceOf(msg.sender);
        limitedToken.safeTransfer(msg.sender, amount);
        uint256 received = limitedToken.balanceOf(msg.sender) - beforeBalance;
        if (received != amount) revert ExactOutputRequired(amount, received);

        totalRedeemed += amount;
        emit Redeemed(msg.sender, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Allows recovery of unused inventory only while redemptions are paused.
    function withdrawUnusedLimitedTokens(address recipient, uint256 amount)
        external
        onlyOwner
        whenPaused
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        limitedToken.safeTransfer(recipient, amount);
        emit UnusedLimitedTokensWithdrawn(recipient, amount);
    }
}
