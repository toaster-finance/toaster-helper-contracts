import { ethers } from "hardhat";

async function getBalanceOf(tokenAddress: string, address: string) {
  const token = await ethers.getContractAt("IERC20", tokenAddress);
  return await token.balanceOf(address);
}

export default getBalanceOf;
