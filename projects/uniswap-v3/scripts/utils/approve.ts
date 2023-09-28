import { ethers } from "hardhat";
import { IERC20 } from "../../typechain-types";

async function approveToken(tokenAddress: string, spender: string) {
  const token = await ethers.getContractAt("IERC20", tokenAddress);
  const signer = await ethers.getSigners();
  const allowance = await token.allowance(signer[0].address, spender);
  if (allowance != ethers.MaxUint256) {
    console.log("Approve Max");
    return token
      .approve(spender, ethers.MaxUint256)
      .then((tx) => tx.wait())
      .then((tx) => tx?.gasUsed!);
  }
  console.log(`Already Approved Max:${allowance}`);
  return allowance;
}

export default approveToken;
