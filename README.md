# GreenChain Project

## Project Title & Description

GreenChain is a blockchain-based carbon credit reward and trading platform built to encourage sustainable and eco-friendly actions. Users can earn CARB tokens by performing green activities such as planting trees, using public transport, using solar energy, and selecting eco-friendly transport routes. These tokens can then be traded through a decentralized marketplace using smart contracts on Polygon.

The project combines Blockchain, Smart Contracts, Firebase, Flutter, and Web UI to create a transparent and scalable sustainability ecosystem.

---

## Dataset / Input Source

This project mainly uses user-generated environmental activity proofs instead of a fixed dataset.

### Examples:

* Tree plantation proof (image upload)
* Public transport usage proof
* Solar panel usage proof
* Eco-friendly delivery route logs
* Carbon reduction activity verification

These activities are verified using backend logic and can later be enhanced using AI verification systems like Vertex AI.

---

## Installation & Setup

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Git
* MetaMask Extension
* VS Code
* Flutter SDK (for mobile app)
* Firebase CLI (optional for backend deployment)

---

## How to Run

### Step 1: Clone Repository

```bash
git clone YOUR_GITHUB_REPO_LINK
cd GreenChain-Project
```

---

### Step 2: Install Smart Contract Dependencies

```bash
cd contracts
npm install
```

---

### Step 3: Compile Smart Contracts

```bash
npm run compile
```

---

### Step 4: Create .env File

Inside the contracts folder create:

```env
PRIVATE_KEY=your_metamask_private_key
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=
```

---

### Step 5: Deploy Smart Contracts

```bash
npm run deploy:amoy
```

This deploys:

* CARBToken.sol
* CarbonMarketplace.sol

and generates deployed contract addresses.

---

### Step 6: Run Web UI

Open:

```text
greenchain_improved_ui/greenchain_improved.html
```

in browser.

---

### Step 7: Flutter App (Optional)

```bash
cd flutter_app
flutter pub get
flutter run
```

---

## Results Summary

### Best Output

* Smart contracts compiled successfully
* Deployment ready on Polygon Amoy Testnet
* Wallet integration using MetaMask
* CARB token minting and marketplace trading enabled
* Firebase backend verification logic integrated

### Key Metrics

* Transparent carbon credit tracking
* Secure blockchain transactions
* Reward-based sustainability engagement
* Decentralized token marketplace

### One Key Insight

Blockchain creates trust and transparency in sustainability systems by ensuring carbon credits cannot be manipulated or duplicated.

---

## Project Architecture

```text
GreenChain Project
│
├── contracts
│   ├── contracts
│   │   ├── CARBToken.sol
│   │   └── CarbonMarketplace.sol
│   ├── deploy.js
│   ├── hardhat.config.js
│   ├── package.json
│   └── .env
│
├── firebase
│   └── functions
│       └── index.js
│
├── flutter_app
│   ├── lib
│   │   └── main.dart
│   └── pubspec.yaml
│
├── greenchain_improved_ui
│   ├── greenchain_improved.html
│   ├── greenchain_improved.css
│   └── greenchain_improved.js
│
└── README.md
```

### Folder Explanation

* contracts → Smart contracts and blockchain deployment
* firebase → Backend verification and server functions
* flutter_app → Mobile application interface
* greenchain_improved_ui → Web-based frontend demo

---

## Tech Stack

### Blockchain

* Solidity
* Hardhat
* OpenZeppelin
* Polygon Amoy Testnet
* MetaMask

### Backend

* Firebase Functions
* Node.js

### Frontend

* HTML
* CSS
* JavaScript

### Mobile App

* Flutter
* Dart

### Tools

* GitHub
* VS Code

---

## Conclusion

GreenChain solves the problem of trust and transparency in carbon credit systems by using blockchain technology. It rewards sustainable actions through tokenized incentives and provides a decentralized marketplace for trading carbon credits. The project demonstrates how technology can be used for environmental impact and real-world sustainability solutions.

