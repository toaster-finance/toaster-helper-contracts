import { ethers } from "hardhat";

export default async function initialize(pool: string, sqrtPriceX96: bigint) {
  const pool_ = await ethers.getContractAt("IUniswapV3Pool", pool);
  const sqrtPriceX96_ = await pool_.slot0().then((res) => res.sqrtPriceX96);

  if (sqrtPriceX96_ == 0n) {
    await pool_.initialize(sqrtPriceX96).then((tx) => tx.wait());
    console.log("Initialize Pool!");
  } else {
    console.log(
      "Already Initialized",
      await pool_.slot0().then((res) => res.sqrtPriceX96)
    );
  }
}
