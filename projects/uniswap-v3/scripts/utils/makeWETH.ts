import { ethers } from "hardhat";

export default async function makeWETH(ETHamount: string, WETHaddress: string) {
  const weth = await ethers.getContractAt("IWETH9", WETHaddress);
  await weth
    .deposit({ value: ethers.parseEther(ETHamount) })
    .then((tx) => tx.wait());
}
