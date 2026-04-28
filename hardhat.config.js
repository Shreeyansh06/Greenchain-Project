require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Polygon Mumbai Testnet
   amoy: {
  url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  chainId: 80002,
  gas: 2100000,
  gasPrice: 35000000000
},
    // Polygon Mainnet (for production)
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
      gas: 2100000,
      gasPrice: 35000000000 // 35 gwei
    },
    // Localhost for testing
    hardhat: {
      chainId: 31337
    }
  },
etherscan: {
  apiKey: {
    polygon: process.env.POLYGONSCAN_API_KEY || ""
  }
},

paths: {
  sources: "./contracts",
  tests: "./test",
  cache: "./cache",
  artifacts: "./artifacts"
}
};
