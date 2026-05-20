// Contract addresses - UPDATE THESE after deployment
const CARB_TOKEN_ADDRESS = 'YOUR_CARB_TOKEN_CONTRACT_ADDRESS';
const MARKETPLACE_ADDRESS = 'YOUR_MARKETPLACE_CONTRACT_ADDRESS';

// Contract ABIs - These should match your deployed contracts
const CARB_TOKEN_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function mint(address to, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const MARKETPLACE_ABI = [
    "function listCredit(uint256 amount, uint256 pricePerToken) returns (uint256)",
    "function buyCredit(uint256 listingId) payable returns (bool)",
    "function getListings() view returns (tuple(uint256 id, address seller, uint256 amount, uint256 pricePerToken, bool active)[])",
    "function getUserListings(address user) view returns (uint256[])"
];

// Global variables
let web3;
let userAccount;
let carbTokenContract;
let marketplaceContract;

// Initialize on page load
window.addEventListener('load', async () => {
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask is installed!');
    } else {
        alert('Please install MetaMask to use this dApp!');
    }

    // Setup event listeners
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    // Connect Wallet
    document.getElementById('connectWallet').addEventListener('click', connectWallet);

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.dataset.section;
            switchSection(section);
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchSection(tab);
        });
    });

    // File upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleFileUpload(file);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }

    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Connect Wallet
async function connectWallet() {
    try {
        showLoading('Connecting wallet...');

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = accounts[0];

        // Initialize Web3
        web3 = new Web3(window.ethereum);

        // Initialize contracts
        carbTokenContract = new web3.eth.Contract(
            CARB_TOKEN_ABI.map(abi => web3.eth.abi.encodeFunctionSignature(abi)),
            CARB_TOKEN_ADDRESS
        );

        marketplaceContract = new web3.eth.Contract(
            MARKETPLACE_ABI.map(abi => web3.eth.abi.encodeFunctionSignature(abi)),
            MARKETPLACE_ADDRESS
        );

        // Update UI
        document.getElementById('connectWallet').textContent = 
            `${userAccount.substring(0, 6)}...${userAccount.substring(38)}`;
        document.getElementById('connectWallet').style.background = 'rgba(0, 255, 163, 0.2)';
        document.getElementById('connectWallet').style.color = 'var(--primary)';

        // Load user data
        await loadUserData();

        hideLoading();
        showSuccess('Wallet connected successfully!');

    } catch (error) {
        console.error('Error connecting wallet:', error);
        hideLoading();
        alert('Failed to connect wallet. Please try again.');
    }
}

// Load user data from blockchain
async function loadUserData() {
    try {
        // Get user balance
        const balance = await carbTokenContract.methods.balanceOf(userAccount).call();
        const balanceFormatted = web3.utils.fromWei(balance, 'ether');
        document.getElementById('userBalance').textContent = parseFloat(balanceFormatted).toFixed(1);

        // Update wallet address display
        document.getElementById('walletAddress').textContent = 
            `${userAccount.substring(0, 10)}...${userAccount.substring(34)}`;

        // Load marketplace listings
        await loadMarketplace();

        // Load portfolio
        await loadPortfolio();

    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load marketplace listings
async function loadMarketplace() {
    try {
        const listings = await marketplaceContract.methods.getListings().call();
        const marketplaceGrid = document.getElementById('marketplaceGrid');
        marketplaceGrid.innerHTML = '';

        listings.forEach((listing, index) => {
            if (listing.active) {
                const listingCard = createListingCard(listing, index);
                marketplaceGrid.appendChild(listingCard);
            }
        });

    } catch (error) {
        console.error('Error loading marketplace:', error);
        document.getElementById('marketplaceGrid').innerHTML = 
            '<p style="text-align: center; color: var(--text-muted);">No listings available</p>';
    }
}

// Create listing card element
function createListingCard(listing, index) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    
    const sellerShort = `${listing.seller.substring(0, 6)}...`;
    const amount = web3.utils.fromWei(listing.amount, 'ether');
    const price = web3.utils.fromWei(listing.pricePerToken, 'ether');
    const total = (parseFloat(amount) * parseFloat(price)).toFixed(2);

    card.innerHTML = `
        <div class="listing-header">
            <div class="user-info">
                <div class="user-avatar">${sellerShort.charAt(0)}</div>
                <div class="user-details">
                    <h4>${sellerShort}</h4>
                    <div class="user-location">Seller</div>
                </div>
            </div>
            <span class="listing-badge badge-sell">Sell</span>
        </div>
        
        <div class="listing-amount">${parseFloat(amount).toFixed(1)} CARB</div>
        
        <div class="listing-details">
            <div class="detail-item">
                <span class="detail-label">Price per CARB</span>
                <span class="detail-value">₹${parseFloat(price).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total Value</span>
                <span class="detail-value">₹${total}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">CO₂ Offset</span>
                <span class="detail-value">${(parseFloat(amount) * 0.1).toFixed(1)} kg</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Listing ID</span>
                <span class="detail-value">#${listing.id}</span>
            </div>
        </div>

        <div class="listing-tags">
            <span class="verified-badge">✓ Verified</span>
        </div>

        <button class="btn btn-primary" style="width: 100%;" onclick="buyListing(${listing.id}, '${amount}', '${price}', '${sellerShort}')">
            Buy Now
        </button>
    `;

    return card;
}

// Buy listing
async function buyListing(listingId, amount, price, seller) {
    try {
        const total = (parseFloat(amount) * parseFloat(price)).toFixed(2);

        // Show confirmation modal
        document.getElementById('buyDetails').innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span style="color: var(--text-muted);">Seller</span>
                <span style="font-weight: 600;">${seller}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span style="color: var(--text-muted);">Amount</span>
                <span style="font-weight: 600;">${amount} CARB</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span style="color: var(--text-muted);">Price per CARB</span>
                <span style="font-weight: 600;">₹${price}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 1rem; border-top: 1px solid var(--border);">
                <span style="font-weight: 600;">Total</span>
                <span style="font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700; color: var(--primary);">₹${total}</span>
            </div>
        `;

        document.getElementById('confirmBuyBtn').onclick = async () => {
            await executeBuy(listingId, total);
        };

        openModal('buyConfirmModal');

    } catch (error) {
        console.error('Error preparing buy:', error);
        alert('Failed to prepare purchase');
    }
}

// Execute buy transaction
async function executeBuy(listingId, totalPrice) {
    try {
        closeModal('buyConfirmModal');
        showLoading('Processing purchase...');

        const totalWei = web3.utils.toWei(totalPrice.toString(), 'ether');

        const tx = await marketplaceContract.methods.buyCredit(listingId).send({
            from: userAccount,
            value: totalWei
        });

        hideLoading();
        showSuccess('Purchase successful! Credits transferred to your wallet.');
        
        // Refresh data
        await loadUserData();

    } catch (error) {
        console.error('Error executing buy:', error);
        hideLoading();
        alert('Transaction failed. Please try again.');
    }
}

// List credits for sale
async function listCredits() {
    try {
        const amount = document.getElementById('listAmount').value;
        const price = document.getElementById('listPrice').value;

        if (!amount || !price) {
            alert('Please enter both amount and price');
            return;
        }

        closeModal('listCreditsModal');
        showLoading('Listing credits on marketplace...');

        const amountWei = web3.utils.toWei(amount, 'ether');
        const priceWei = web3.utils.toWei(price, 'ether');

        // Approve marketplace to spend tokens
        await carbTokenContract.methods.approve(MARKETPLACE_ADDRESS, amountWei).send({
            from: userAccount
        });

        // List on marketplace
        await marketplaceContract.methods.listCredit(amountWei, priceWei).send({
            from: userAccount
        });

        hideLoading();
        showSuccess('Credits listed successfully!');
        
        // Refresh marketplace
        await loadMarketplace();

        // Clear inputs
        document.getElementById('listAmount').value = '';
        document.getElementById('listPrice').value = '';

    } catch (error) {
        console.error('Error listing credits:', error);
        hideLoading();
        alert('Failed to list credits. Please try again.');
    }
}

// Mint tokens (after AI verification)
async function mintTokens(amount) {
    try {
        if (!userAccount) {
            alert('Please connect your wallet first');
            return;
        }

        closeModal('verificationModal');
        showLoading('Minting CARB tokens...');

        const amountWei = web3.utils.toWei(amount.toString(), 'ether');

        // Call mint function on smart contract
        await carbTokenContract.methods.mint(userAccount, amountWei).send({
            from: userAccount
        });

        hideLoading();
        showSuccess(`Successfully minted ${amount} CARB tokens!`, 'Tokens have been added to your wallet');

        // Refresh balance
        await loadUserData();

    } catch (error) {
        console.error('Error minting tokens:', error);
        hideLoading();
        alert('Failed to mint tokens. Please try again.');
    }
}

// Load portfolio data
async function loadPortfolio() {
    try {
        const balance = await carbTokenContract.methods.balanceOf(userAccount).call();
        const balanceFormatted = parseFloat(web3.utils.fromWei(balance, 'ether'));

        document.getElementById('portfolioHoldings').textContent = balanceFormatted.toFixed(1);
        document.getElementById('portfolioValue').textContent = `₹${(balanceFormatted * 0.5).toFixed(2)}`;
        document.getElementById('totalEarned').textContent = balanceFormatted.toFixed(1);
        document.getElementById('co2Offset').textContent = (balanceFormatted * 0.1).toFixed(1);

        // Load holdings breakdown (can be enhanced with more data)
        loadHoldings(balanceFormatted);

    } catch (error) {
        console.error('Error loading portfolio:', error);
    }
}

// Load holdings breakdown
function loadHoldings(totalBalance) {
    const holdingsGrid = document.getElementById('holdingsGrid');
    holdingsGrid.innerHTML = `
        <div class="holding-card">
            <div class="holding-header">
                <div class="holding-icon-title">
                    <span class="holding-icon">🌳</span>
                    <div>
                        <div class="holding-name">Tree Planting</div>
                        <div class="holding-date">Last earned: Recently</div>
                    </div>
                </div>
            </div>
            <div class="holding-amount">${(totalBalance * 0.5).toFixed(1)} CARB</div>
            <div style="color: var(--text-secondary);">₹${(totalBalance * 0.5 * 0.5).toFixed(2)}</div>
        </div>
        <div class="holding-card">
            <div class="holding-header">
                <div class="holding-icon-title">
                    <span class="holding-icon">☀️</span>
                    <div>
                        <div class="holding-name">Solar Energy</div>
                        <div class="holding-date">Last earned: Recently</div>
                    </div>
                </div>
            </div>
            <div class="holding-amount">${(totalBalance * 0.3).toFixed(1)} CARB</div>
            <div style="color: var(--text-secondary);">₹${(totalBalance * 0.3 * 0.5).toFixed(2)}</div>
        </div>
        <div class="holding-card">
            <div class="holding-header">
                <div class="holding-icon-title">
                    <span class="holding-icon">🚌</span>
                    <div>
                        <div class="holding-name">Public Transport</div>
                        <div class="holding-date">Last earned: Recently</div>
                    </div>
                </div>
            </div>
            <div class="holding-amount">${(totalBalance * 0.2).toFixed(1)} CARB</div>
            <div style="color: var(--text-secondary);">₹${(totalBalance * 0.2 * 0.5).toFixed(2)}</div>
        </div>
    `;
}

// File upload handler
function handleFileUpload(file) {
    console.log('File uploaded:', file.name);
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.innerHTML = `
        <div class="upload-icon">✓</div>
        <p style="color: var(--success);">File uploaded: ${file.name}</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Ready to verify</p>
    `;
}

// AI Verification simulation
function verifyTreePhoto() {
    closeModal('uploadTreeModal');
    
    // Simulate AI processing
    showLoading('AI verifying photo...');
    
    setTimeout(() => {
        hideLoading();
        openModal('verificationModal');
    }, 2000);
}

// Navigation functions
function switchSection(sectionName) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionName) {
            link.classList.add('active');
        }
    });

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === sectionName) {
            btn.classList.add('active');
        }
    });

    // Show/hide sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    if (sectionName === 'earn') {
        document.getElementById('earnSection').classList.add('active');
    } else if (sectionName === 'marketplace') {
        document.getElementById('marketplaceSection').classList.add('active');
    } else if (sectionName === 'portfolio') {
        document.getElementById('portfolioSection').classList.add('active');
    }
}

function switchToMarketplace() {
    switchSection('marketplace');
}

// Filter marketplace listings
function filterListings(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Filter logic can be enhanced based on listing types
    console.log('Filtering by:', filter);
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Loading functions
function showLoading(text = 'Processing...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Success message
function showSuccess(title, message = '') {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    openModal('successModal');
}

// Refresh all data
async function refreshData() {
    if (userAccount) {
        await loadUserData();
    }
}

// Listen for account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            console.log('Please connect to MetaMask.');
            location.reload();
        } else if (accounts[0] !== userAccount) {
            userAccount = accounts[0];
            loadUserData();
        }
    });

    window.ethereum.on('chainChanged', function () {
        location.reload();
    });
}
