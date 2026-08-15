// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MintBurnExchangeCore} from "./MintBurnExchangeCore.sol";

/// @title CashXTMTMintExchange
contract CashXTMTMintExchange is MintBurnExchangeCore {
    address public constant CASHX = 0x4C450b3C2b89a2DAbE5A3eE39FF475134A30d665;
    address public constant TMT = 0x9a9a022BcA19146507091B64468775c8c9C45Cbd;
    address public constant CASHX_TREASURY = 0xEda3aa737947337b425227dB8174519f623C041F;

    constructor() MintBurnExchangeCore(CASHX, TMT, CASHX_TREASURY, msg.sender) {}
}
