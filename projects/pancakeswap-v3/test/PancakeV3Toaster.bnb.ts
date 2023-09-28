import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { ethers } from "hardhat";
import ADDRESS from "../config/address-bnb.json";

import { ContractTransactionReceipt } from "ethers";
import {
  IApproveAndCall,
  IERC20,
  IPancakeV3Factory,
  IWETH9,
  PancakeV3Menu,
  PancakeV3Toaster,
} from "../typechain-types";
import { IPancakeV3Toaster } from "../typechain-types/contracts/core/PancakeV3Toaster";

const PancakeV3_FACTORY = ADDRESS.PancakeV3Factory;
const PancakeV3_POSITION_MANAGER = ADDRESS.NonfungiblePositionManager;
const PancakeV3_DEPLOYER = ADDRESS.PancakeV3PoolDeployer;
describe("PancakeV3Toaster", () => {
  let menu: PancakeV3Menu;
  let toaster: PancakeV3Toaster;
  let factory: IPancakeV3Factory;
  let signer: HardhatEthersSigner;
  let wbnb: IWETH9;
  let usdt: IERC20;

  before("Deploy PancakeV3 Toaster", async () => {
    // Deploy menu & Deploy PancakeV3Toaster
    [signer] = await ethers.getSigners();
    factory = await ethers.getContractAt(
      "IPancakeV3Factory",
      PancakeV3_FACTORY
    );
    const menu_f = await ethers.getContractFactory("PancakeV3Menu");
    menu = await menu_f.deploy();
    const toaster_f = await ethers.getContractFactory("PancakeV3Toaster");
    toaster = await toaster_f
      .deploy(
        PancakeV3_DEPLOYER,
        PancakeV3_FACTORY,
        PancakeV3_POSITION_MANAGER,
        ADDRESS.WBNB,
        await menu.getAddress()
      )
      .then((tx) => tx.waitForDeployment());

    wbnb = await ethers.getContractAt("IWETH9", ADDRESS.WBNB);
    usdt = await ethers.getContractAt("IERC20", ADDRESS.USDT);

    await wbnb.approve(await toaster.getAddress(), ethers.MaxUint256);
    await usdt.approve(await toaster.getAddress(), ethers.MaxUint256);
  });
  it(`🧪 Make WBNB & USDT`, async () => {
    await wbnb.deposit({
      value: ethers.parseEther("100"),
    });
    await toaster.exactInputSingle({
      tokenIn: ADDRESS.WBNB,
      tokenOut: ADDRESS.USDT,
      fee: 2500,
      recipient: signer.address,
      amountIn: ethers.parseEther("1"),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
      deadline: ethers.MaxUint256,
    });
  });

  it("Invest only 1WBNB", async () => {
    const toasterItf = toaster.interface;
    const amount0 = 0n; // USDT
    const token0 = ADDRESS.USDT;
    const amount1 = ethers.parseEther("1"); // WBNB
    const token1 = ADDRESS.WBNB;
    const nativeInputAmount = 0n;

    const poolAddress = await factory.getPool(token0, token1, 2500);
    const slot0 = await ethers
      .getContractAt("IPancakeV3Pool", poolAddress)
      .then((t) => t.slot0());
    const tick = slot0.tick;
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_WBNB_USDT,
        tickUpper: 50n * ((tick + 200n) / 50n),
        tickLower: 50n * ((tick - 300n) / 50n),
        amount0: amount0,
        amount1: amount1,
        height: 120,
      });

    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IPancakeV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 2500,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 2500,
      tickUpper: 50n * ((tick + 200n) / 50n),
      tickLower: 50n * ((tick - 300n) / 50n),
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
    };

    const multicallData: string[] = [];
    if (nativeInputAmount > 0n) {
      multicallData.push(
        toasterItf.encodeFunctionData("wrapETH", [nativeInputAmount])
      );
    }

    if (amountIn > 0n) {
      multicallData.push(
        toasterItf.encodeFunctionData("pull", [tokenIn, amountIn])
      );
    }
    if (amountOut > 0n) {
      multicallData.push(
        toasterItf.encodeFunctionData("pull", [tokenOut, amountOut])
      );
    }

    multicallData.push(
      toasterItf.encodeFunctionData("exactInputSingleBySelf", [
        exactInputSingleBySelfParams,
      ])
    );

    multicallData.push(
      toasterItf.encodeFunctionData("approveMax", [tokenIn]),
      toasterItf.encodeFunctionData("approveMax", [tokenOut]),
      toasterItf.encodeFunctionData("mint", [mintParams])
    );

    if (nativeInputAmount > 0n) {
      multicallData.push(
        toasterItf.encodeFunctionData("unwrapWETH9(uint256)", [0n]),
        toasterItf.encodeFunctionData("sweepToken(address,uint256)", [
          tokenIn == token1 ? tokenOut : tokenIn,
          0n,
        ])
      );
    } else {
      multicallData.push(
        toasterItf.encodeFunctionData("sweepToken(address,uint256)", [
          tokenIn,
          0n,
        ]), // sweepToken tokenIn
        toasterItf.encodeFunctionData("sweepToken(address,uint256)", [
          tokenOut,
          0n,
        ])
      );
    }
    const receipt = await toaster["multicall(bytes[])"](multicallData, {
      value: nativeInputAmount,
    }).then((t) => t.wait());

    expect(receipt!.logs[9].topics[0]).to.equal(V3_MINT_EVENT_SIGNATURE);
    expect(+receipt!.logs[9].topics[1]).to.equal(
      0x46a15b0b27311cedf172ab29e4f4766fbe7f4364
    );
  });
});
const V3_SWAP_EVENT_SIGNATURE =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";
const V3_MINT_EVENT_SIGNATURE =
  "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde";
const TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const INCREASE_EVENT_SIGNATURE =
  "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";
