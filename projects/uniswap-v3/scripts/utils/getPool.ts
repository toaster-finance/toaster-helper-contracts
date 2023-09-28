import { ethers } from "hardhat";
import { IUniswapV3Factory } from "../../typechain-types";
import { token } from "../../typechain-types/@openzeppelin/contracts";
import { CONFIGS } from "../../config/address";
async function getPool(
  factory: string,
  token0: string,
  token1: string,
  fee: number
) {
  const factoryContract = await ethers.getContractAt(
    "IUniswapV3Factory",
    factory
  );
  console.log(
    "Pool Address:",
    await factoryContract.getPool(token0, token1, fee)
  );
}
getPool(
  CONFIGS.goerli.uniswapV3.factory,
  CONFIGS.goerli.token.WETH,
  CONFIGS.goerli.token.USDC,
  10000
);
