// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BurnExchangeCore} from "./BurnExchangeCore.sol";

// LEGACY RESERVE-FUNDED PROTOTYPES — DO NOT USE FOR THE PRODUCTION LIMITED
// TOKEN LAUNCH. The production mint-on-demand contracts are the four named
// *MintExchange.sol files that inherit SwapBurnMintExchangeCore.

/// @notice CashX -> LCashX burn exchange on PulseChain.
contract CashXBurnExchange is BurnExchangeCore {
    address public constant ORIGINAL_TOKEN = 0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665;

    constructor(address limitedToken_, address initialOwner)
        BurnExchangeCore(ORIGINAL_TOKEN, limitedToken_, initialOwner)
    {}
}

/// @notice DistroX -> LDistroX burn exchange on PulseChain.
contract DistroXBurnExchange is BurnExchangeCore {
    address public constant ORIGINAL_TOKEN = 0xA1198e47Ac3D89903D7eCFd04a14b8Bfd72d7B03;

    constructor(address limitedToken_, address initialOwner)
        BurnExchangeCore(ORIGINAL_TOKEN, limitedToken_, initialOwner)
    {}
}

/// @notice DivX -> LDivX burn exchange on PulseChain.
contract DivXBurnExchange is BurnExchangeCore {
    address public constant ORIGINAL_TOKEN = 0x6df9CD07BF067b42A700dc679bD9325Ff61Da8f3;

    constructor(address limitedToken_, address initialOwner)
        BurnExchangeCore(ORIGINAL_TOKEN, limitedToken_, initialOwner)
    {}
}

/// @notice GSX -> LGSX burn exchange on PulseChain.
contract GSXBurnExchange is BurnExchangeCore {
    address public constant ORIGINAL_TOKEN = 0x395127a44Ac1CDc609C8CC9d048E096e8E8fC30e;

    constructor(address limitedToken_, address initialOwner)
        BurnExchangeCore(ORIGINAL_TOKEN, limitedToken_, initialOwner)
    {}
}
