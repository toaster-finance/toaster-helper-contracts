import { FeeDataNetworkPlugin } from "ethers";
import { ethers, network } from "hardhat";
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export default async function createPool(
  factory: string,
  token0: string,
  token1: string,
  fee: bigint
) {
  const factory_ = await ethers.getContractAt("IUniswapV3Factory", factory);

  if ((await factory_.getPool(token0, token1, fee)) == ADDRESS_ZERO) {
    await factory_.createPool(token0, token1, fee).then((tx) => tx.wait());
    const pool = await factory_.getPool(token0, token1, fee);
    console.log("Pool Address:", pool);
    return pool;
  } else {
    const pool = await factory_.getPool(token0, token1, fee);
    console.log("Pool Address:", pool);
    return await factory_.getPool(token0, token1, fee);
  }
}
