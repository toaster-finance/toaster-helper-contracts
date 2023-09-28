import { ethers } from "hardhat";
import { ISwapRouter02 } from "../../typechain-types";
import approveToken from "./approve";

export default async function makeWETHtoMATIC(
  WETHamount: string,
  WETHaddress: string,
  MATICaddress: string,
  swapRouter: ISwapRouter02
): Promise<bigint> {
  approveToken(WETHaddress, await swapRouter.getAddress());
  const [signer] = await ethers.getSigners();
  const gasUsed = await swapRouter
    .exactInputSingle({
      tokenIn: WETHaddress,
      tokenOut: MATICaddress,
      fee: 3000,
      recipient: signer.address,
      amountIn: ethers.parseEther(WETHamount),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    })
    .then((tx) => tx.wait())
    .then((tx) => tx?.gasUsed);

  return gasUsed as bigint;
}
