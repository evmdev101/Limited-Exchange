// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SwapBurnMintExchangeCore} from "./SwapBurnMintExchangeCore.sol";

/// @title CashXTMTPlsMintExchange
/// @notice Mainnet test only. Uses TMT in place of LCashX.
contract CashXTMTPlsMintExchange is SwapBurnMintExchangeCore {
    address public constant CASHX = 0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665;
    address public constant TMT = 0x9a9a022BcA19146507091B64468775c8c9C45Cbd;
    address public constant PULSEX_V2_ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    address public constant WPLS = 0xA1077a294dDE1B09bB078844df40758a5D0f9a27;
    address public constant CASHX_TREASURY = 0xEda3aa737947337b425227dB8174519f623C041F;

    /// @dev For this test deployment, the deploying wallet is both the owner
    /// and the temporary recipient of the extra 5% TMT management mint.
    constructor()
        SwapBurnMintExchangeCore(
            CASHX,
            TMT,
            PULSEX_V2_ROUTER,
            WPLS,
            CASHX_TREASURY,
            msg.sender,
            msg.sender
        )
    {}
}
