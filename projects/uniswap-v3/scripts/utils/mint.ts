import { ethers } from "hardhat";

export default async function mintToken(tokenAddress: string, amount: string) {
  if (amount != "0") {
    const signer = await ethers.getSigners();
    const token = await ethers.getContractAt("MockToken", tokenAddress);
    await token.mint(signer[0].address, amount).then((tx) => tx.wait());
    console.log(`${tokenAddress} minted!`);
  }
}

async function mintToaster() {
  const signer = await ethers.getSigners();
  const toasterToken = await ethers.getContractFactory("ToasterToken");
  const toaster = await toasterToken.deploy("Toaster token", "TOAST", 18);
  await toaster.waitForDeployment();

  return toaster.getAddress();
}
