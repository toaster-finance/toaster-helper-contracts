// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import "../interfaces/IPancakeV3Menu.sol";
import "../interfaces/IPancakeV3Toaster.sol";
import "@pancakeswap/v3-periphery/contracts/base/PeripheryImmutableState.sol";
import "@pancakeswap/v3-core/contracts/interfaces/IPancakeV3Factory.sol";
import "../external/SwapRouter.sol";
import "../external/base/ApproveAndCall.sol";
import "../external/base/ImmutableState.sol";

contract PancakeV3Toaster is
    IPancakeV3Toaster,
    SwapRouter,
    ImmutableState,
    ApproveAndCall
{
    address public immutable menu;

    constructor(
        address _deployer,
        address _factory,
        address _positionManager,
        address _WETH9,
        address _menu
    ) ImmutableState(_positionManager) SwapRouter(_deployer, _factory, _WETH9) {
        menu = _menu;
    }

    function exactInputSingleBySelf(
        ExactInputBySelfParams memory params
    ) external payable returns (uint256 amountOut) {
        amountOut = exactInputInternal(
            params.amountIn,
            address(this),
            0,
            SwapCallbackData({
                path: abi.encodePacked(
                    params.tokenIn,
                    params.fee,
                    params.tokenOut
                ),
                payer: address(this)
            })
        );
    }

    function getSwapAmountForAddLiquidity(
        SwapAmountForAddLiquidityParams calldata params
    )
        external
        view
        returns (uint256 amountIn, uint256 amountOut, bool isSwapX)
    {
        return IPancakeV3Menu(menu).getSwapAmountForAddLiquidity(params);
    }

    function getSwapAmountForIncreaseLiquidity(
        SwapAmountForIncreaseLiquidityParams calldata params
    )
        external
        view
        returns (uint256 amountIn, uint256 amountOut, bool isSwapX)
    {
        return IPancakeV3Menu(menu).getSwapAmountForIncreaseLiquidity(params);
    }

    function total(
        uint256 tokenId
    )
        external
        view
        returns (uint256 amount0, uint256 amount1, uint160 sqrtRatioX96)
    {
        sqrtRatioX96 = getSqrtRatioX96FromId(tokenId);
        (amount0, amount1) = IPancakeV3Menu(menu).total(
            INonfungiblePositionManager(positionManager),
            tokenId,
            sqrtRatioX96
        );
    }

    function principal(
        uint256 tokenId
    )
        external
        view
        returns (uint256 amount0, uint256 amount1, uint160 sqrtRatioX96)
    {
        sqrtRatioX96 = getSqrtRatioX96FromId(tokenId);
        (amount0, amount1) = IPancakeV3Menu(menu).principal(
            INonfungiblePositionManager(positionManager),
            tokenId,
            sqrtRatioX96
        );
    }

    function fees(
        uint256 tokenId
    ) external view returns (uint256 amount0, uint256 amount1) {
        return
            IPancakeV3Menu(menu).fees(
                INonfungiblePositionManager(positionManager),
                tokenId
            );
    }

    function getSqrtRatioX96FromId(
        uint tokenId
    ) internal view returns (uint160 sqrtRatioX96) {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            ,
            ,
            ,
            ,
            ,
            ,

        ) = INonfungiblePositionManager(positionManager).positions(tokenId);
        (sqrtRatioX96, , , , , , ) = IPancakeV3Pool(
            IPancakeV3Factory(factory).getPool(token0, token1, fee)
        ).slot0();
    }

    // Fork from UniswapV3 SwapRouter02 PeripheyPaymentsWithFee
    function wrapETH(uint256 value) external payable {
        IWETH9(WETH9).deposit{value: value}();
    }

    function pull(address token, uint256 value) external payable {
        TransferHelper.safeTransferFrom(
            token,
            msg.sender,
            address(this),
            value
        );
    }

    function unwrapWETH9(uint256 amountMinimum) external payable {
        unwrapWETH9(amountMinimum, msg.sender);
    }

    function sweepToken(address token, uint256 amountMinimum) external payable {
        sweepToken(token, amountMinimum, msg.sender);
    }

    //Fork from UniswapV3 SwapRouter02 MulticallExtended
    function multicall(
        uint256 deadline,
        bytes[] calldata data
    ) external payable checkDeadline(deadline) returns (bytes[] memory) {
        return multicall(data);
    }
}
