// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CARBToken
 * @dev ERC-20 Carbon Credit Token for GreenChain
 * 1 CARB = 0.1 kg CO₂ offset
 */
contract CARBToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    
    // Constants
    uint256 public constant CARB_TO_CO2_RATIO = 10; // 1 CARB = 0.1 kg CO₂
    uint256 public constant MIN_VERIFICATION_SCORE = 85; // 85% AI confidence minimum
    
    // State variables
    uint256 public tokenPrice; // Price in wei (e.g., 0.0001 MATIC = ₹0.50)
    uint256 public totalCO2Offset; // Total CO₂ offset in grams
    
    // Mappings
    mapping(address => uint256) public userCO2Offset;
    mapping(bytes32 => bool) public usedProofs; // Prevent duplicate claims
    mapping(address => bool) public verifiers; // Authorized AI verifiers
    
    // Structs
    struct CarbonAction {
        address user;
        string actionType; // "transport", "tree", "solar", "route"
        uint256 carbAmount;
        uint256 co2Amount;
        uint256 timestamp;
        bytes32 proofHash;
        uint256 verificationScore;
    }
    
    // Events
    event CarbonActionVerified(
        address indexed user,
        string actionType,
        uint256 carbAmount,
        uint256 co2Amount,
        bytes32 proofHash,
        uint256 verificationScore
    );
    
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 totalCost);
    event TokensSold(address indexed seller, uint256 amount, uint256 totalRevenue);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    // Storage
    CarbonAction[] public carbonActions;
    
    constructor(uint256 _initialPrice)
    ERC20("Carbon Credit Token", "CARB")
    Ownable(msg.sender)
{
    tokenPrice = _initialPrice;
        
        // Mint initial supply to contract for marketplace liquidity
        _mint(address(this), 1000000 * 10**decimals()); // 1M CARB tokens
    }
    
    /**
     * @dev Mint CARB tokens after AI verification of sustainable action
     * @param _user User who performed the action
     * @param _actionType Type of sustainable action
     * @param _carbAmount Amount of CARB tokens to mint
     * @param _proofHash Hash of verification proof (IPFS hash)
     * @param _verificationScore AI confidence score (0-100)
     */
    function mintCarbonCredits(
        address _user,
        string memory _actionType,
        uint256 _carbAmount,
        bytes32 _proofHash,
        uint256 _verificationScore
    ) external whenNotPaused {
        require(verifiers[msg.sender], "Only authorized verifiers can mint");
        require(_verificationScore >= MIN_VERIFICATION_SCORE, "Verification score too low");
        require(!usedProofs[_proofHash], "Proof already used");
        require(_user != address(0), "Invalid user address");
        require(_carbAmount > 0, "Amount must be greater than 0");
        
        // Mark proof as used
        usedProofs[_proofHash] = true;
        
        // Calculate CO₂ offset (CARB * 100 grams = total grams)
        uint256 co2Amount = _carbAmount * 100; // 1 CARB = 0.1 kg = 100 grams
        
        // Update tracking
        totalCO2Offset += co2Amount;
        userCO2Offset[_user] += co2Amount;
        
        // Store action
        carbonActions.push(CarbonAction({
            user: _user,
            actionType: _actionType,
            carbAmount: _carbAmount,
            co2Amount: co2Amount,
            timestamp: block.timestamp,
            proofHash: _proofHash,
            verificationScore: _verificationScore
        }));
        
        // Mint tokens to user
        _mint(_user, _carbAmount * 10**decimals());
        
        emit CarbonActionVerified(
            _user,
            _actionType,
            _carbAmount,
            co2Amount,
            _proofHash,
            _verificationScore
        );
    }
    
    /**
     * @dev Buy CARB tokens from marketplace
     */
    function buyTokens(uint256 _amount) external payable whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 cost = _amount * tokenPrice;
        require(msg.value >= cost, "Insufficient payment");
        
        // Transfer tokens from contract to buyer
        require(balanceOf(address(this)) >= _amount * 10**decimals(), "Insufficient token supply");
        _transfer(address(this), msg.sender, _amount * 10**decimals());
        
        // Refund excess payment
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }
        
        emit TokensPurchased(msg.sender, _amount, cost);
    }
    
    /**
     * @dev Sell CARB tokens to marketplace
     */
    function sellTokens(uint256 _amount) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= _amount * 10**decimals(), "Insufficient balance");
        
        uint256 revenue = _amount * tokenPrice;
        require(address(this).balance >= revenue, "Insufficient contract balance");
        
        // Transfer tokens from seller to contract
        _transfer(msg.sender, address(this), _amount * 10**decimals());
        
        // Pay seller
        payable(msg.sender).transfer(revenue);
        
        emit TokensSold(msg.sender, _amount, revenue);
    }
    
    /**
     * @dev Update token price (only owner)
     */
    function updatePrice(uint256 _newPrice) external onlyOwner {
        require(_newPrice > 0, "Price must be greater than 0");
        uint256 oldPrice = tokenPrice;
        tokenPrice = _newPrice;
        emit PriceUpdated(oldPrice, _newPrice);
    }
    
    /**
     * @dev Add authorized verifier (only owner)
     */
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid verifier address");
        verifiers[_verifier] = true;
    }
    
    /**
     * @dev Remove authorized verifier (only owner)
     */
    function removeVerifier(address _verifier) external onlyOwner {
        verifiers[_verifier] = false;
    }
    
    /**
     * @dev Get total number of carbon actions
     */
    function getActionsCount() external view returns (uint256) {
        return carbonActions.length;
    }
    
    /**
     * @dev Get carbon action by index
     */
    function getAction(uint256 _index) external view returns (
        address user,
        string memory actionType,
        uint256 carbAmount,
        uint256 co2Amount,
        uint256 timestamp,
        bytes32 proofHash,
        uint256 verificationScore
    ) {
        require(_index < carbonActions.length, "Invalid index");
        CarbonAction memory action = carbonActions[_index];
        return (
            action.user,
            action.actionType,
            action.carbAmount,
            action.co2Amount,
            action.timestamp,
            action.proofHash,
            action.verificationScore
        );
    }
    
    /**
     * @dev Get user's total CO₂ offset in kg
     */
    function getUserCO2OffsetKg(address _user) external view returns (uint256) {
        return userCO2Offset[_user] / 1000; // Convert grams to kg
    }
    
    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw contract balance (only owner)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev Receive MATIC for marketplace liquidity
     */
    receive() external payable {}
}
