import { expect } from "chai";
import { ethers } from "hardhat";
import ADDRESS from "../config/address-mainnet-fork.json";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractTransactionReceipt, N } from "ethers";
import {
  IERC20,
  IUniswapV3Pool,
  IWETH9,
  UniswapV3Menu,
  UniswapV3Toaster,
} from "../typechain-types";
import makeWETH from "../scripts/utils/makeWETH";
import { IUniswapV3Toaster } from "../typechain-types/contracts/core/UniswapV3Toaster";
import { IApproveAndCall } from "../typechain-types/contracts/interfaces";

const UNISWAPV3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const UNISWAPV3_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const test_case: {
  randomMax: number;
  caseNumber: number;
  randomAmount: number;
  randomETH: bigint;
  randomUpperTick: bigint;
  randomLowerTick: bigint;
}[] = [];
let c = 0;
for (let i = 1; i <= 3; i++) {
  for (let j = 1; j < 3; j++) {
    c++;
    let randomMax: number = Math.random() * 200;
    let randomAmount: number = Math.random() * randomMax;
    let randomUpperTick: bigint = BigInt(Math.floor(Math.random() * 2000));
    let randomLowerTick: bigint = BigInt(Math.floor(Math.random() * 2000));
    let randomETH: bigint = ethers.parseEther((Math.random() * 100).toString());

    test_case.push({
      randomMax: randomMax,
      caseNumber: c,
      randomAmount: randomAmount,
      randomETH: randomETH,
      randomUpperTick: randomUpperTick,
      randomLowerTick: randomLowerTick,
    });
  }
}
describe("UniswapV3Toaster", () => {
  let menu: UniswapV3Menu;
  let toaster: UniswapV3Toaster;
  let pool: IUniswapV3Pool;
  let signer: HardhatEthersSigner;
  let weth: IWETH9;
  let matic: IERC20;

  before("Deploy UniswapV3 Toaster", async () => {
    // Deploy menu & Deploy UniswapV3Toaster
    [signer] = await ethers.getSigners();
    const menu_f = await ethers.getContractFactory("UniswapV3Menu");
    menu = await menu_f.deploy();
    const toaster_f = await ethers.getContractFactory("UniswapV3Toaster");

    toaster = await toaster_f
      .deploy(
        UNISWAPV3_FACTORY,
        UNISWAPV3_POSITION_MANAGER,
        ADDRESS.WETH,
        await menu.getAddress()
      )
      .then((tx) => tx.waitForDeployment());

    weth = await ethers.getContractAt("IWETH9", ADDRESS.WETH);
    matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
  });
  it("Make WETH & MATIC", async () => {
    await makeWETH("10", ADDRESS.WETH);
    await toaster.exactInputSingle({
      tokenIn: ADDRESS.WETH,
      tokenOut: ADDRESS.MATIC,
      fee: 3000,
      recipient: signer.address,
      amountIn: ethers.parseEther("5"),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    });

    expect(
      ethers.formatEther(await weth.balanceOf(signer.address)),
      "WETH Balance"
    ).to.be.equal("5.0");
    expect(
      ethers.formatEther(await matic.balanceOf(signer.address)),
      "MATIC Balance"
    ).to.be.equal("14379.953430219486109481");
  });

  it("1️⃣ Swap WETH, Supply WETH from lack of ETH:Multicall UniswapV3Toaster with 100 MATIC & 1 WETH & 1ETH    ", async () => {
    const toasterItf = toaster.interface;
    const amount0 = ethers.parseEther("100"); // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = ethers.parseEther("1"); // WETH
    const token1 = ADDRESS.WETH;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
    const nativeInputAmount = ethers.parseEther("1");
    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: 60n * ((tick + 200n) / 60n),
        tickLower: 60n * ((tick - 200n) / 60n),
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    expect(ethers.formatEther(swapAmountIn)).to.be.equal(
      "1.084599928065271684"
    );
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: 60n * ((tick - 200n) / 60n),
      tickUpper: 60n * ((tick + 200n) / 60n),
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);

    const result = makeResultFromReceipt(receipt);

    expect(await weth.balanceOf(await toaster.getAddress())).to.be.equal(0);

    expect(await matic.balanceOf(await toaster.getAddress())).to.be.equal(0);
  });
  it("2️⃣ Swap MATIC, No Native Token: Multicall UniswapV3Toaster with 10000 MATIC & 1 WETH ", async () => {
    const toasterItf = toaster.interface;
    const amount0 = ethers.parseEther("10000"); // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = 0n; // WETH
    const token1 = ADDRESS.WETH;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
    const nativeInputAmount = ethers.parseEther("1");
    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: 60n * ((tick + 200n) / 60n),
        tickLower: 60n * ((tick - 200n) / 60n),
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: 60n * ((tick - 200n) / 60n),
      tickUpper: 60n * ((tick + 200n) / 60n),
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);

    const result = makeResultFromReceipt(receipt);
  });

  it("3️⃣ Swap WETH, with Native Coin: Multicall UniswapV3Toaster with 100 MATIC & 1ETH", async () => {
    const toasterItf = toaster.interface;
    const amount0 = ethers.parseEther("100"); // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = 0n; // WETH
    const token1 = ADDRESS.WETH;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
    const nativeInputAmount = ethers.parseEther("1");
    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: 60n * ((tick + 200n) / 60n),
        tickLower: 60n * ((tick - 200n) / 60n),
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: 60n * ((tick - 200n) / 60n),
      tickUpper: 60n * ((tick + 200n) / 60n),
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);

    const result = makeResultFromReceipt(receipt);
  });
  it("4️⃣ Invest only WETH , Swap WETH: Multicall UniswapV3Toaster with 1ETH", async () => {
    const toasterItf = toaster.interface;
    const amount0 = 0n; // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = ethers.parseEther("0.1"); // WETH
    const token1 = ADDRESS.WETH;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
    const nativeInputAmount = 0n;
    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: -79500,
        tickLower: -80100,
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: -80100,
      tickUpper: -79500,
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);

    const result = makeResultFromReceipt(receipt);
  });
  it("5️⃣ Invest WETH & MATIC, Swap WETH:Multicall UniswapV3Toaster with 1WETH & 100MATIC", async () => {
    const toasterItf = toaster.interface;
    const amount0 = ethers.parseEther("100"); // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = ethers.parseEther("1"); // WETH
    const token1 = ADDRESS.WETH;
    const nativeInputAmount = 0n;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);

    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: 60n * ((tick + 200n) / 60n),
        tickLower: 60n * ((tick - 200n) / 60n),
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: 60n * ((tick - 200n) / 60n),
      tickUpper: 60n * ((tick + 200n) / 60n),
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);
    const result = makeResultFromReceipt(receipt);
  });
  it("6️⃣ Invest only MATIC , Swap MATIC: Multicall UniswapV3Toaster with 100MATIC", async () => {
    const toasterItf = toaster.interface;
    const amount0 = ethers.parseEther("100"); // MATIC
    const token0 = ADDRESS.MATIC;
    const amount1 = 0n; // WETH
    const token1 = ADDRESS.WETH;
    const nativeInputAmount = 0n;
    const weth = await ethers.getContractAt("IERC20", ADDRESS.WETH);
    const matic = await ethers.getContractAt("IERC20", ADDRESS.MATIC);
    await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
    await matic.approve(await toaster.getAddress(), ethers.MaxUint256);

    const tick = await ethers
      .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
      .then((l) => l.slot0())
      .then((slot0) => slot0.tick);
    const [swapAmountIn, swapAmountOut, isSwap0] =
      await menu.getSwapAmountForAddLiquidity({
        pool: ADDRESS.POOL_MATIC_WETH,
        tickUpper: 60n * ((tick + 200n) / 60n),
        tickLower: 60n * ((tick - 200n) / 60n),
        amount0: amount0,
        amount1: amount1 + nativeInputAmount,
        height: 72,
      });
    const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
      ? [token0, token1, amount0, amount1]
      : [token1, token0, amount1, amount0];
    const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
      {
        tokenIn,
        tokenOut,
        fee: 3000,
        amountIn: swapAmountIn,
      };

    const mintParams: IApproveAndCall.MintParamsStruct = {
      token0: tokenIn < tokenOut ? tokenIn : tokenOut,
      token1: tokenOut < tokenIn ? tokenIn : tokenOut,
      fee: 3000,
      tickLower: 60n * ((tick - 200n) / 60n),
      tickUpper: 60n * ((tick + 200n) / 60n),
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
    })
      .then((t) => t.wait())
      .then((receipt) => receipt as ContractTransactionReceipt);
    const result = makeResultFromReceipt(receipt);
  });

  test_case.forEach((c) => {
    it(`🧪 ${c.caseNumber}: Make WETH & MATIC Randomly Test Case `, async () => {
      await weth.deposit({ value: ethers.parseEther(c.randomMax.toString()) });

      await toaster.exactInputSingle({
        tokenIn: ADDRESS.WETH,
        tokenOut: ADDRESS.MATIC,
        fee: 3000,
        recipient: signer.address,
        amountIn: ethers.parseEther(c.randomAmount.toString()),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      });
    });

    it(`🧪 Test Case ${c.caseNumber}`, async () => {
      const toasterItf = toaster.interface;
      const amount0 = await matic.balanceOf(signer.address); // MATIC
      const token0 = ADDRESS.MATIC;
      const amount1 = await weth.balanceOf(signer.address); // WETH
      const token1 = ADDRESS.WETH;

      await weth.approve(await toaster.getAddress(), ethers.MaxUint256);
      await matic.approve(await toaster.getAddress(), ethers.MaxUint256);
      const nativeInputAmount = c.randomETH;

      const tick = await ethers
        .getContractAt("IUniswapV3Pool", ADDRESS.POOL_MATIC_WETH)
        .then((l) => l.slot0())
        .then((slot0) => slot0.tick);
      const [swapAmountIn, swapAmountOut, isSwap0] =
        await menu.getSwapAmountForAddLiquidity({
          pool: ADDRESS.POOL_MATIC_WETH,
          tickUpper: 60n * ((tick + c.randomUpperTick) / 60n),
          tickLower: 60n * ((tick - c.randomLowerTick) / 60n),
          amount0: amount0,
          amount1: amount1 + nativeInputAmount,
          height: 120,
        });

      const [tokenIn, tokenOut, amountIn, amountOut] = isSwap0
        ? [token0, token1, amount0, amount1]
        : [token1, token0, amount1, amount0];
      const exactInputSingleBySelfParams: IUniswapV3Toaster.ExactInputBySelfParamsStruct =
        {
          tokenIn,
          tokenOut,
          fee: 3000,
          amountIn: swapAmountIn,
        };

      const mintParams: IApproveAndCall.MintParamsStruct = {
        token0: tokenIn < tokenOut ? tokenIn : tokenOut,
        token1: tokenOut < tokenIn ? tokenIn : tokenOut,
        fee: 3000,
        tickLower: 60n * ((tick - c.randomLowerTick) / 60n),
        tickUpper: 60n * ((tick + c.randomUpperTick) / 60n),
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
      })
        .then((t) => t.wait())
        .then((receipt) => receipt as ContractTransactionReceipt);

      const result = makeResultFromReceipt(receipt);
      expect(
        Number(result.addLiquidityAmount0) /
          Number(amount0 + (isSwap0 ? -swapAmountIn : swapAmountOut))
      ).to.be.equal(1, "100% of MATIC is added to liquidity");

      expect(
        Number(result.addLiquidityAmount1) /
          Number(
            amount1 +
              nativeInputAmount +
              (isSwap0 ? swapAmountOut : -swapAmountIn)
          )
      ).to.be.equal(1, "100% of WETH + ETH is added to liquidity");
    });
    it(`🧪 Check reserve of WETH & MATIC`, async () => {
      expect(
        await weth.balanceOf(await toaster.getAddress()),
        "WETH Balance of Toaster"
      ).to.be.equal(0n);
      expect(
        await matic.balanceOf(await toaster.getAddress()),
        "MATIC Balance of Toaster"
      ).to.be.equal(0n);
      expect(
        await ethers.provider.getBalance(await toaster.getAddress()),
        "ETH Balance of Toaster"
      ).to.be.equal(0n);
    });
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
function makeResultFromReceipt(receipt: ContractTransactionReceipt) {
  const tokenId = getTokenIdFromReceipt(receipt);

  const [swapAmountInResult, swapAmountOutResult]: bigint[] =
    getAmountInAndOutFromReceipt(receipt);
  const [addLiquidityAmount0, addLiquidityAmount1]: bigint[] =
    getAddLiquidityAmountFromReceipt(receipt);

  const { leftTokenAddress, leftTokenAmount } =
    getLeftTokensFromReceipt(receipt);
  const result = {
    tokenId: tokenId.toString(),
    addLiquidityAmount0: addLiquidityAmount0.toString(),
    addLiquidityAmount1: addLiquidityAmount1.toString(),
    swapAmountIn: swapAmountInResult.toString(),
    swapAmountOut: swapAmountOutResult.toString(),
    leftTokenAddress: leftTokenAddress,
    leftTokenAmount: leftTokenAmount.toString(),
  };
  return result;
}
function splitHash(hash: string): string[] {
  if (hash.slice(0, 2) !== "0x" || (hash.length - 2) % 64 > 0) return [];

  hash = hash.slice(2);
  const numChunks = Math.ceil(hash.length / 64);
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += 64) {
    chunks[i] = "0x" + hash.slice(o, o + 64);
  }
  return chunks;
}
function getAmountInAndOutFromReceipt(
  receipt: ContractTransactionReceipt
): bigint[] {
  const swapLogs = receipt.logs.filter(
    (l) => l.topics[0] === V3_SWAP_EVENT_SIGNATURE
  );
  const { data: swapData } = swapLogs[swapLogs.length - 1];
  // amount0, amount1, sqrtPriceX96, liquidity, tick
  const [amount0, amount1] = splitHash(swapData).map(BigInt);
  const [amountIn, amountOut] =
    amount0 > 0n ? [amount0, amount1] : [amount1, amount0];
  return [amountIn, ethers.MaxUint256 - amountOut + 1n];
}
function getAddLiquidityAmountFromReceipt(
  receipt: ContractTransactionReceipt
): bigint[] {
  const mintLogs = receipt.logs.filter(
    (l) => l.topics[0] === V3_MINT_EVENT_SIGNATURE
  );
  const { data: mintData } = mintLogs[mintLogs.length - 1];
  // amount0, amount1, sqrtPriceX96, liquidity, tick
  const [sender, amount, amount0, amount1] = splitHash(mintData).map(BigInt);
  return [amount0, amount1];
}
function getTokenIdFromReceipt(receipt: ContractTransactionReceipt): bigint {
  const tokenIdLog = receipt.logs.filter(
    (l) => l.topics[0] == INCREASE_EVENT_SIGNATURE
  );
  const tokenId = tokenIdLog[tokenIdLog.length - 1].topics[1];
  return BigInt(tokenId);
}
function getLeftTokensFromReceipt(receipt: ContractTransactionReceipt): {
  leftTokenAddress: string;
  leftTokenAmount: bigint;
} {
  // last Transfer event should be happened by sweepToken()
  const sweepTokenLog = receipt.logs[receipt.logs.length - 1];

  if (sweepTokenLog.topics[0] == TRANSFER_EVENT_SIGNATURE) {
    const leftTokenAddress = sweepTokenLog.address;
    const leftTokenAmount = BigInt(sweepTokenLog.data);

    return { leftTokenAddress, leftTokenAmount };
  }
  return { leftTokenAddress: "", leftTokenAmount: 0n };
}
