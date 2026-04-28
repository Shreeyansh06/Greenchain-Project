// scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying GreenChain Smart Contracts to Polygon Amoy Testnet...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();

  console.log("📝 Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", balance.toString(), "wei\n");

  // Deploy CARB Token
  console.log("📦 Deploying CARBToken...");

  const initialPrice = hre.ethers.parseEther("0.00002");

  const CARBToken = await hre.ethers.getContractFactory("CARBToken");
  const carbToken = await CARBToken.deploy(initialPrice);

  await carbToken.waitForDeployment();

  const carbTokenAddress = await carbToken.getAddress();

  console.log("✅ CARBToken deployed to:", carbTokenAddress);

  // Deploy Marketplace
  console.log("📦 Deploying CarbonMarketplace...");

  const CarbonMarketplace = await hre.ethers.getContractFactory("CarbonMarketplace");
  const marketplace = await CarbonMarketplace.deploy(carbTokenAddress);

  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();

  console.log("✅ CarbonMarketplace deployed to:", marketplaceAddress);

  // Add deployer as verifier
  console.log("🔐 Adding deployer as authorized verifier...");

  const addVerifierTx = await carbToken.addVerifier(deployer.address);
  await addVerifierTx.wait();

  console.log("✅ Verifier added");

  // Save deployed addresses
  const addresses = {
    carbToken: carbTokenAddress,
    marketplace: marketplaceAddress,
    network: "amoy",
    chainId: 80002,
    deployedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("\n🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("CARB Token:", carbTokenAddress);
  console.log("Marketplace:", marketplaceAddress);
  console.log("NETWORK_RPC=https://rpc-amoy.polygon.technology");
  console.log("CHAIN_ID=80002");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });