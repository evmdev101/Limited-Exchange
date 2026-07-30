// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local testing helper only. Do not deploy this as a production Nexion token.
contract MockLimitedToken is ERC20 {
    constructor(string memory name_, string memory symbol_, address recipient, uint256 supply)
        ERC20(name_, symbol_)
    {
        _mint(recipient, supply);
    }
}
