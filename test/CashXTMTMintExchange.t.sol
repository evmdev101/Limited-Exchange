// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MintBurnExchangeCore} from "../contracts/src/MintBurnExchangeCore.sol";
import {MockBurnableToken} from "../contracts/src/MockBurnableToken.sol";
import {MockNexionMintableToken} from "../contracts/src/MockNexionMintableToken.sol";

contract TestMintBurnExchange is MintBurnExchangeCore {
    constructor(
        address burnToken_,
        address limitedToken_,
        address treasury_,
        address initialOwner
    ) MintBurnExchangeCore(burnToken_, limitedToken_, treasury_, initialOwner) {}
}

contract MintExchangeActor {
    function approve(IERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function burnAndMint(MintBurnExchangeCore exchange, uint256 amount) external {
        exchange.burnAndMint(amount);
    }

    function tryBurnAndMint(MintBurnExchangeCore exchange, uint256 amount)
        external
        returns (bool)
    {
        try exchange.burnAndMint(amount) {
            return true;
        } catch {
            return false;
        }
    }

    function tryPause(MintBurnExchangeCore exchange) external returns (bool) {
        try exchange.pause() {
            return true;
        } catch {
            return false;
        }
    }
}

contract MockNonBurningOriginal is ERC20 {
    constructor(address recipient, uint256 supply) ERC20("Non-burning original", "NBO") {
        _mint(recipient, supply);
    }
}

contract MockTaxedTreasuryOriginal is ERC20 {
    address public constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;
    address public immutable taxedTreasury;

    constructor(address recipient, address taxedTreasury_, uint256 supply)
        ERC20("Taxed treasury original", "TTO")
    {
        taxedTreasury = taxedTreasury_;
        _mint(recipient, supply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to == BURN_SINK) {
            super._update(from, address(0), value);
            return;
        }

        if (from != address(0) && to == taxedTreasury) {
            uint256 fee = value / 10;
            super._update(from, to, value - fee);
            super._update(from, address(0), fee);
            return;
        }

        super._update(from, to, value);
    }
}

contract MockSixDecimalMintable is ERC20 {
    address public minter;

    constructor(address initialMinter) ERC20("Six decimal limited", "SIX") {
        minter = initialMinter;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address recipient, uint256 amount) external {
        require(msg.sender == minter, "not minter");
        _mint(recipient, amount);
    }
}

contract CashXTMTMintExchangeTest {
    uint256 private constant ONE = 1 ether;
    uint256 private constant ORIGINAL_SUPPLY = 1_000_000 * ONE;
    address private constant TREASURY = address(0xBEEF);

    MockBurnableToken private cashX;
    MockNexionMintableToken private tmt;
    TestMintBurnExchange private exchange;
    MintExchangeActor private alice;
    MintExchangeActor private bob;

    function setUp() public {
        cashX = new MockBurnableToken("CashX", "CASHX", address(this), ORIGINAL_SUPPLY);
        tmt = new MockNexionMintableToken(address(this), ONE);
        exchange =
            new TestMintBurnExchange(address(cashX), address(tmt), TREASURY, address(this));
        alice = new MintExchangeActor();
        bob = new MintExchangeActor();

        cashX.transfer(address(alice), 10_000 * ONE);
        cashX.transfer(address(bob), 10_000 * ONE);
        alice.approve(cashX, address(exchange), type(uint256).max);
        bob.approve(cashX, address(exchange), type(uint256).max);
        tmt.setMinter(address(exchange));
    }

    function testQuoteIsExactEightyTwentyWithFullMint() public view {
        (uint256 burned, uint256 treasuryAmount, uint256 minted) = exchange.quote(100 * ONE);

        require(burned == 80 * ONE, "burn quote is not 80%");
        require(treasuryAmount == 20 * ONE, "treasury quote is not 20%");
        require(minted == 100 * ONE, "mint quote is not full 1:1 input");
    }

    function testBurnsEightySendsTwentyAndMintsFullAmount() public {
        uint256 amount = 100 * ONE;
        uint256 originalSupplyBefore = cashX.totalSupply();
        uint256 limitedSupplyBefore = tmt.totalSupply();

        alice.burnAndMint(exchange, amount);

        require(cashX.totalSupply() == originalSupplyBefore - 80 * ONE, "wrong burn");
        require(cashX.balanceOf(TREASURY) == 20 * ONE, "wrong treasury amount");
        require(tmt.balanceOf(address(alice)) == amount, "TMT output was not 1:1");
        require(tmt.totalSupply() == limitedSupplyBefore + amount, "wrong TMT supply increase");
        require(exchange.totalOriginalProcessed() == amount, "wrong processed statistic");
        require(exchange.totalBurned() == 80 * ONE, "wrong burn statistic");
        require(exchange.totalTreasurySent() == 20 * ONE, "wrong treasury statistic");
        require(exchange.totalLimitedMinted() == amount, "wrong mint statistic");
        require(exchange.exchangeCount() == 1, "wrong exchange count");
        require(exchange.uniqueExchangers() == 1, "wrong unique count");
    }

    function testTracksRepeatAndUniqueExchangers() public {
        alice.burnAndMint(exchange, 100 * ONE);
        alice.burnAndMint(exchange, 50 * ONE);
        bob.burnAndMint(exchange, 25 * ONE);

        require(exchange.exchangeCount() == 3, "every exchange should be counted");
        require(exchange.uniqueExchangers() == 2, "repeat wallet counted twice");
        require(
            exchange.accountOriginalProcessed(address(alice)) == 150 * ONE,
            "wrong alice total"
        );
        require(exchange.accountOriginalProcessed(address(bob)) == 25 * ONE, "wrong bob total");
    }

    function testRefusesToTakeCashXUnlessExchangeIsMinter() public {
        tmt.setMinter(address(this));
        uint256 aliceBefore = cashX.balanceOf(address(alice));
        uint256 supplyBefore = cashX.totalSupply();

        bool succeeded = alice.tryBurnAndMint(exchange, 100 * ONE);

        require(!succeeded, "exchange ran without minter role");
        require(cashX.balanceOf(address(alice)) == aliceBefore, "failed exchange took CashX");
        require(cashX.totalSupply() == supplyBefore, "failed exchange burned CashX");
        require(cashX.balanceOf(TREASURY) == 0, "failed exchange funded treasury");
        require(tmt.balanceOf(address(alice)) == 0, "failed exchange minted TMT");
    }

    function testMintFailureRollsBackBurnAndTreasuryTransfer() public {
        tmt.setMintShouldRevert(true);
        uint256 aliceBefore = cashX.balanceOf(address(alice));
        uint256 supplyBefore = cashX.totalSupply();

        bool succeeded = alice.tryBurnAndMint(exchange, 100 * ONE);

        require(!succeeded, "forced mint failure unexpectedly succeeded");
        require(cashX.balanceOf(address(alice)) == aliceBefore, "mint failure took CashX");
        require(cashX.totalSupply() == supplyBefore, "mint failure left CashX burned");
        require(cashX.balanceOf(TREASURY) == 0, "mint failure paid treasury");
        require(tmt.balanceOf(address(alice)) == 0, "mint failure left TMT");
        require(exchange.exchangeCount() == 0, "mint failure changed statistics");
    }

    function testPauseBlocksExchangeAndOnlyOwnerCanPause() public {
        bool nonOwnerPaused = alice.tryPause(exchange);
        require(!nonOwnerPaused, "non-owner paused exchange");

        exchange.pause();
        bool succeeded = alice.tryBurnAndMint(exchange, 100 * ONE);
        require(!succeeded, "paused exchange accepted input");

        exchange.unpause();
        alice.burnAndMint(exchange, 100 * ONE);
        require(tmt.balanceOf(address(alice)) == 100 * ONE, "unpause did not restore exchange");
    }

    function testRejectsOriginalThatDoesNotBurnAndRollsEverythingBack() public {
        MockNonBurningOriginal original =
            new MockNonBurningOriginal(address(this), ORIGINAL_SUPPLY);
        MockNexionMintableToken output = new MockNexionMintableToken(address(this), ONE);
        TestMintBurnExchange guarded =
            new TestMintBurnExchange(address(original), address(output), TREASURY, address(this));
        MintExchangeActor user = new MintExchangeActor();
        uint256 amount = 100 * ONE;

        original.transfer(address(user), amount);
        user.approve(original, address(guarded), amount);
        output.setMinter(address(guarded));

        bool succeeded = user.tryBurnAndMint(guarded, amount);

        require(!succeeded, "non-burning original passed burn check");
        require(original.balanceOf(address(user)) == amount, "failed check took original");
        require(original.balanceOf(TREASURY) == 0, "failed check funded treasury");
        require(output.balanceOf(address(user)) == 0, "failed check minted output");
    }

    function testRejectsTaxedTreasuryTransferAndRollsEverythingBack() public {
        MockTaxedTreasuryOriginal original =
            new MockTaxedTreasuryOriginal(address(this), TREASURY, ORIGINAL_SUPPLY);
        MockNexionMintableToken output = new MockNexionMintableToken(address(this), ONE);
        TestMintBurnExchange guarded =
            new TestMintBurnExchange(address(original), address(output), TREASURY, address(this));
        MintExchangeActor user = new MintExchangeActor();
        uint256 amount = 100 * ONE;

        original.transfer(address(user), amount);
        user.approve(original, address(guarded), amount);
        output.setMinter(address(guarded));
        uint256 supplyBefore = original.totalSupply();

        bool succeeded = user.tryBurnAndMint(guarded, amount);

        require(!succeeded, "taxed treasury transfer passed exact checks");
        require(original.totalSupply() == supplyBefore, "failed transfer changed supply");
        require(original.balanceOf(address(user)) == amount, "failed transfer took original");
        require(original.balanceOf(TREASURY) == 0, "failed transfer funded treasury");
        require(output.balanceOf(address(user)) == 0, "failed transfer minted output");
    }

    function testRejectsMismatchedDecimalsAtDeployment() public {
        MockSixDecimalMintable sixDecimals = new MockSixDecimalMintable(address(this));
        bool reverted;

        try new TestMintBurnExchange(
            address(cashX), address(sixDecimals), TREASURY, address(this)
        ) returns (TestMintBurnExchange) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "decimal mismatch should reject deployment");
    }
}
