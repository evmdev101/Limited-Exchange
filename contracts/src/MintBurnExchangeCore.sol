// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Minimal interface exposed by Nexion tokens created with Mintable enabled.
interface INexionMintableToken is IERC20Metadata {
    function minter() external view returns (address);
    function mint(address recipient, uint256 amount) external;
}

/// @title MintBurnExchangeCore
/// @notice Splits each original-token input 80% to a permanent burn and 20% to
/// the configured treasury, then mints the full input amount of its limited token.
/// @dev The original and limited tokens must use identical decimals. The Nexion
/// limited token must name this exchange as its minter before exchanges can run.
abstract contract MintBurnExchangeCore is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant BURN_BPS = 8_000;
    uint256 public constant TREASURY_BPS = 2_000;

    IERC20 public immutable burnToken;
    INexionMintableToken public immutable limitedToken;
    address public immutable treasury;

    uint256 public totalOriginalProcessed;
    uint256 public totalBurned;
    uint256 public totalTreasurySent;
    uint256 public totalLimitedMinted;
    uint256 public exchangeCount;
    uint256 public uniqueExchangers;

    mapping(address account => bool) public hasExchanged;
    mapping(address account => uint256 amount) public accountOriginalProcessed;

    error ZeroAddress();
    error ZeroAmount();
    error AmountTooSmall();
    error DecimalMismatch(uint8 burnDecimals, uint8 limitedDecimals);
    error ExchangeIsNotMinter(address currentMinter);
    error InvalidSupplyChange(uint256 beforeSupply, uint256 afterSupply);
    error ExactBurnRequired(uint256 expected, uint256 burned);
    error TreasuryShortfall(uint256 expected, uint256 received);
    error ExactMintRequired(uint256 expected, uint256 received);
    error ExactMintSupplyRequired(uint256 expected, uint256 minted);

    event BurnedAndMinted(
        address indexed account,
        uint256 originalAmount,
        uint256 burnedAmount,
        uint256 treasuryAmount,
        uint256 limitedAmount,
        uint256 indexed exchangeNumber
    );

    constructor(
        address burnToken_,
        address limitedToken_,
        address treasury_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            burnToken_ == address(0) || limitedToken_ == address(0)
                || treasury_ == address(0) || initialOwner == address(0)
        ) {
            revert ZeroAddress();
        }

        uint8 burnDecimals = IERC20Metadata(burnToken_).decimals();
        uint8 limitedDecimals = IERC20Metadata(limitedToken_).decimals();
        if (burnDecimals != limitedDecimals) {
            revert DecimalMismatch(burnDecimals, limitedDecimals);
        }

        burnToken = IERC20(burnToken_);
        limitedToken = INexionMintableToken(limitedToken_);
        treasury = treasury_;
    }

    /// @notice Returns the exact nominal split and output for an input amount.
    function quote(uint256 amount)
        public
        pure
        returns (uint256 burnAmount, uint256 treasuryAmount, uint256 limitedAmount)
    {
        burnAmount = amount * BURN_BPS / BPS_DENOMINATOR;
        treasuryAmount = amount - burnAmount;
        limitedAmount = amount;
    }

    /// @notice Burns 80%, sends 20% to treasury, and mints limited tokens 1:1.
    /// @dev Every check and the mint happen in one transaction. Any failure
    /// reverts the CashX transfers as well as the mint.
    function burnAndMint(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        (uint256 burnAmount, uint256 treasuryAmount, uint256 limitedAmount) = quote(amount);
        if (burnAmount == 0 || treasuryAmount == 0) revert AmountTooSmall();

        address currentMinter = limitedToken.minter();
        if (currentMinter != address(this)) revert ExchangeIsNotMinter(currentMinter);

        _processOriginal(msg.sender, burnAmount, treasuryAmount);
        _mintLimited(msg.sender, limitedAmount);

        totalOriginalProcessed += amount;
        totalBurned += burnAmount;
        totalTreasurySent += treasuryAmount;
        totalLimitedMinted += limitedAmount;
        exchangeCount += 1;
        accountOriginalProcessed[msg.sender] += amount;

        if (!hasExchanged[msg.sender]) {
            hasExchanged[msg.sender] = true;
            uniqueExchangers += 1;
        }

        emit BurnedAndMinted(
            msg.sender,
            amount,
            burnAmount,
            treasuryAmount,
            limitedAmount,
            exchangeCount
        );
    }

    function _processOriginal(address account, uint256 burnAmount, uint256 treasuryAmount)
        internal
    {
        uint256 supplyBefore = burnToken.totalSupply();
        uint256 treasuryBalanceBefore = burnToken.balanceOf(treasury);

        burnToken.safeTransferFrom(account, BURN_SINK, burnAmount);
        burnToken.safeTransferFrom(account, treasury, treasuryAmount);

        uint256 supplyAfter = burnToken.totalSupply();
        if (supplyAfter > supplyBefore) {
            revert InvalidSupplyChange(supplyBefore, supplyAfter);
        }

        uint256 burned = supplyBefore - supplyAfter;
        if (burned != burnAmount) revert ExactBurnRequired(burnAmount, burned);

        uint256 treasuryBalanceAfter = burnToken.balanceOf(treasury);
        uint256 treasuryReceived =
            treasuryBalanceAfter >= treasuryBalanceBefore
                ? treasuryBalanceAfter - treasuryBalanceBefore
                : 0;
        if (treasuryReceived < treasuryAmount) {
            revert TreasuryShortfall(treasuryAmount, treasuryReceived);
        }
    }

    function _mintLimited(address recipient, uint256 amount) internal {
        uint256 balanceBefore = limitedToken.balanceOf(recipient);
        uint256 supplyBefore = limitedToken.totalSupply();

        limitedToken.mint(recipient, amount);

        uint256 balanceAfter = limitedToken.balanceOf(recipient);
        uint256 received = balanceAfter - balanceBefore;
        if (received != amount) revert ExactMintRequired(amount, received);

        uint256 supplyAfter = limitedToken.totalSupply();
        uint256 supplyIncrease = supplyAfter - supplyBefore;
        if (supplyIncrease != amount) {
            revert ExactMintSupplyRequired(amount, supplyIncrease);
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
