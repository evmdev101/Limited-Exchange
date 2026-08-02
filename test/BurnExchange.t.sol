// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BurnExchangeCore} from "../contracts/src/BurnExchangeCore.sol";
import {MockBurnableToken} from "../contracts/src/MockBurnableToken.sol";
import {MockLimitedToken} from "../contracts/src/MockLimitedToken.sol";

contract TestBurnExchange is BurnExchangeCore {
    constructor(address burnToken_, address limitedToken_, address initialOwner)
        BurnExchangeCore(burnToken_, limitedToken_, initialOwner)
    {}
}

contract ExchangeActor {
    function approve(IERC20 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function burnAndClaim(BurnExchangeCore exchange, uint256 amount) external {
        exchange.burnAndClaim(amount);
    }

    function tryBurnAndClaim(BurnExchangeCore exchange, uint256 amount) external returns (bool) {
        try exchange.burnAndClaim(amount) {
            return true;
        } catch {
            return false;
        }
    }

    function tryFund(BurnExchangeCore exchange, uint256 amount) external returns (bool) {
        try exchange.fund(amount) {
            return true;
        } catch {
            return false;
        }
    }
}

contract MockNonBurningToken is ERC20 {
    constructor(address recipient, uint256 supply) ERC20("Non-burning token", "NBT") {
        _mint(recipient, supply);
    }
}

contract MockTaxedLimitedToken is ERC20 {
    constructor(address recipient, uint256 supply) ERC20("Taxed limited token", "TLT") {
        _mint(recipient, supply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            if (fee != 0) {
                super._update(from, to, value - fee);
                super._update(from, address(0), fee);
                return;
            }
        }

        super._update(from, to, value);
    }
}

contract MockSixDecimalToken is ERC20 {
    constructor(address recipient, uint256 supply) ERC20("Six decimal token", "SIX") {
        _mint(recipient, supply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract BurnExchangeTest {
    uint256 private constant ONE = 1 ether;
    uint256 private constant ORIGINAL_SUPPLY = 1_000_000 * ONE;
    uint256 private constant LIMITED_SUPPLY = 100_000 * ONE;
    uint256 private constant INITIAL_RESERVE = 10_000 * ONE;

    MockBurnableToken private burnToken;
    MockLimitedToken private limitedToken;
    TestBurnExchange private exchange;
    ExchangeActor private alice;
    ExchangeActor private bob;

    function setUp() public {
        burnToken = new MockBurnableToken("Original", "ORG", address(this), ORIGINAL_SUPPLY);
        limitedToken = new MockLimitedToken("Limited", "LTD", address(this), LIMITED_SUPPLY);
        exchange = new TestBurnExchange(address(burnToken), address(limitedToken), address(this));
        alice = new ExchangeActor();
        bob = new ExchangeActor();

        burnToken.transfer(address(alice), 20_000 * ONE);
        burnToken.transfer(address(bob), 20_000 * ONE);
        limitedToken.approve(address(exchange), INITIAL_RESERVE);
        exchange.fund(INITIAL_RESERVE);
        alice.approve(burnToken, address(exchange), type(uint256).max);
        bob.approve(burnToken, address(exchange), type(uint256).max);
    }

    function testExactOneToOneBurnAndClaim() public {
        uint256 amount = 125 * ONE;
        uint256 supplyBefore = burnToken.totalSupply();

        alice.burnAndClaim(exchange, amount);

        require(burnToken.totalSupply() == supplyBefore - amount, "original supply did not fall exactly");
        require(limitedToken.balanceOf(address(alice)) == amount, "limited output was not 1:1");
        require(exchange.reserve() == INITIAL_RESERVE - amount, "reserve did not decrease exactly");
        require(exchange.totalBurned() == amount, "burn statistic is wrong");
        require(exchange.totalLimitedDistributed() == amount, "distribution statistic is wrong");
        require(exchange.exchangeCount() == 1, "exchange count is wrong");
        require(exchange.uniqueExchangers() == 1, "unique exchanger count is wrong");
        require(exchange.accountBurned(address(alice)) == amount, "wallet burn statistic is wrong");
    }

    function testTracksRepeatAndUniqueExchangers() public {
        alice.burnAndClaim(exchange, 100 * ONE);
        alice.burnAndClaim(exchange, 50 * ONE);
        bob.burnAndClaim(exchange, 25 * ONE);

        require(exchange.exchangeCount() == 3, "exchange count should include every exchange");
        require(exchange.uniqueExchangers() == 2, "repeat wallets must only count once");
        require(exchange.accountBurned(address(alice)) == 150 * ONE, "alice total is wrong");
        require(exchange.accountBurned(address(bob)) == 25 * ONE, "bob total is wrong");
    }

    function testRejectsInsufficientReserveWithoutChangingBalances() public {
        uint256 amount = INITIAL_RESERVE + ONE;
        uint256 supplyBefore = burnToken.totalSupply();
        uint256 aliceBefore = burnToken.balanceOf(address(alice));

        bool succeeded = alice.tryBurnAndClaim(exchange, amount);

        require(!succeeded, "exchange should fail when reserve is too low");
        require(burnToken.totalSupply() == supplyBefore, "failed exchange changed supply");
        require(burnToken.balanceOf(address(alice)) == aliceBefore, "failed exchange took originals");
        require(limitedToken.balanceOf(address(alice)) == 0, "failed exchange sent limited tokens");
        require(exchange.exchangeCount() == 0, "failed exchange changed statistics");
    }

    function testOnlyOwnerCanFund() public {
        uint256 amount = 100 * ONE;
        limitedToken.transfer(address(alice), amount);
        alice.approve(limitedToken, address(exchange), amount);
        uint256 reserveBefore = exchange.reserve();

        bool succeeded = alice.tryFund(exchange, amount);

        require(!succeeded, "non-owner funded the exchange");
        require(exchange.reserve() == reserveBefore, "failed funding changed reserve");
        require(limitedToken.balanceOf(address(alice)) == amount, "failed funding took tokens");
    }

    function testPauseBlocksExchangeAndPermitsOwnerWithdrawal() public {
        uint256 amount = 100 * ONE;
        uint256 ownerBefore = limitedToken.balanceOf(address(this));
        exchange.pause();

        bool succeeded = alice.tryBurnAndClaim(exchange, amount);
        require(!succeeded, "paused exchange accepted a burn");

        exchange.withdrawUnusedLimitedTokens(address(this), amount);
        require(limitedToken.balanceOf(address(this)) == ownerBefore + amount, "paused withdrawal failed");
        require(exchange.reserve() == INITIAL_RESERVE - amount, "withdrawal did not reduce reserve");

        exchange.unpause();
        alice.burnAndClaim(exchange, amount);
        require(limitedToken.balanceOf(address(alice)) == amount, "unpaused exchange did not resume");
    }

    function testLimitedTokenSupplyIsFixed() public {
        uint256 supplyBefore = limitedToken.totalSupply();
        alice.burnAndClaim(exchange, 100 * ONE);

        (bool mintSucceeded,) = address(limitedToken).call(
            abi.encodeWithSignature("mint(address,uint256)", address(this), ONE)
        );

        require(!mintSucceeded, "test limited token unexpectedly exposed minting");
        require(limitedToken.totalSupply() == supplyBefore, "exchange changed fixed limited supply");
    }

    function testRejectsAnOriginalThatDoesNotReallyBurn() public {
        MockNonBurningToken nonBurning = new MockNonBurningToken(address(this), ORIGINAL_SUPPLY);
        MockLimitedToken output = new MockLimitedToken("Limited", "LTD", address(this), LIMITED_SUPPLY);
        TestBurnExchange guardedExchange = new TestBurnExchange(address(nonBurning), address(output), address(this));
        ExchangeActor user = new ExchangeActor();
        uint256 amount = 100 * ONE;

        nonBurning.transfer(address(user), amount);
        output.approve(address(guardedExchange), amount);
        guardedExchange.fund(amount);
        user.approve(nonBurning, address(guardedExchange), amount);
        uint256 supplyBefore = nonBurning.totalSupply();

        bool succeeded = user.tryBurnAndClaim(guardedExchange, amount);

        require(!succeeded, "non-burning token passed the supply check");
        require(nonBurning.totalSupply() == supplyBefore, "failed exchange changed supply");
        require(nonBurning.balanceOf(address(user)) == amount, "failed exchange took original tokens");
        require(output.balanceOf(address(user)) == 0, "failed exchange sent output");
    }

    function testRejectsTaxedOutputAndRollsBackTheBurn() public {
        MockBurnableToken input = new MockBurnableToken("Original", "ORG", address(this), ORIGINAL_SUPPLY);
        MockTaxedLimitedToken taxedOutput = new MockTaxedLimitedToken(address(this), LIMITED_SUPPLY);
        TestBurnExchange guardedExchange = new TestBurnExchange(address(input), address(taxedOutput), address(this));
        ExchangeActor user = new ExchangeActor();
        uint256 amount = 100 * ONE;

        input.transfer(address(user), amount);
        taxedOutput.approve(address(guardedExchange), 1_000 * ONE);
        guardedExchange.fund(1_000 * ONE);
        user.approve(input, address(guardedExchange), amount);
        uint256 supplyBefore = input.totalSupply();

        bool succeeded = user.tryBurnAndClaim(guardedExchange, amount);

        require(!succeeded, "taxed output passed the exact-output check");
        require(input.totalSupply() == supplyBefore, "reverted exchange did not restore original supply");
        require(input.balanceOf(address(user)) == amount, "reverted exchange did not restore input");
        require(taxedOutput.balanceOf(address(user)) == 0, "reverted exchange left partial output");
        require(guardedExchange.exchangeCount() == 0, "reverted exchange changed statistics");
    }

    function testRejectsMismatchedDecimalsAtDeployment() public {
        MockSixDecimalToken sixDecimals = new MockSixDecimalToken(address(this), 1_000_000 * 1e6);
        bool reverted;

        try new TestBurnExchange(address(burnToken), address(sixDecimals), address(this)) returns (
            TestBurnExchange
        ) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "mismatched decimals should reject deployment");
    }
}
