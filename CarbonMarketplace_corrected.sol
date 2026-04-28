// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CarbonMarketplace
 * @dev P2P marketplace for trading CARB tokens with escrow
 */
contract CarbonMarketplace is ReentrancyGuard, Ownable {
    
    IERC20 public carbToken;
    
    uint256 public platformFee = 2; // 2% fee
    uint256 public nextOrderId = 1;
    
    enum OrderType { BUY, SELL }
    enum OrderStatus { OPEN, FILLED, CANCELLED }
    
    struct Order {
        uint256 orderId;
        address trader;
        OrderType orderType;
        uint256 amount; // Amount of CARB tokens
        uint256 pricePerToken; // Price in wei per token
        OrderStatus status;
        uint256 timestamp;
    }
    
    // Storage
    mapping(uint256 => Order) public orders;
    uint256[] public openOrderIds;
    
    // Events
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        OrderType orderType,
        uint256 amount,
        uint256 pricePerToken
    );
    
    event OrderFilled(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 totalPrice
    );
    
    event OrderCancelled(uint256 indexed orderId);
    
   constructor(address _carbToken)
    Ownable(msg.sender)
{
    require(_carbToken != address(0), "Invalid token address");
    carbToken = IERC20(_carbToken);
}

/**
     * @dev Create a sell order (user offers CARB tokens)
     */
    function createSellOrder(uint256 _amount, uint256 _pricePerToken) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        
        // Transfer tokens to escrow
        require(
            carbToken.transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );
        
        Order memory newOrder = Order({
            orderId: nextOrderId,
            trader: msg.sender,
            orderType: OrderType.SELL,
            amount: _amount,
            pricePerToken: _pricePerToken,
            status: OrderStatus.OPEN,
            timestamp: block.timestamp
        });
        
        orders[nextOrderId] = newOrder;
        openOrderIds.push(nextOrderId);
        
        emit OrderCreated(nextOrderId, msg.sender, OrderType.SELL, _amount, _pricePerToken);
        
        nextOrderId++;
    }
    
    /**
     * @dev Create a buy order (user wants to buy CARB tokens)
     */
    function createBuyOrder(uint256 _amount, uint256 _pricePerToken) external payable nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_pricePerToken > 0, "Price must be greater than 0");
        
        uint256 totalCost = _amount * _pricePerToken;
        require(msg.value >= totalCost, "Insufficient payment");
        
        Order memory newOrder = Order({
            orderId: nextOrderId,
            trader: msg.sender,
            orderType: OrderType.BUY,
            amount: _amount,
            pricePerToken: _pricePerToken,
            status: OrderStatus.OPEN,
            timestamp: block.timestamp
        });
        
        orders[nextOrderId] = newOrder;
        openOrderIds.push(nextOrderId);
        
        // Refund excess
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit OrderCreated(nextOrderId, msg.sender, OrderType.BUY, _amount, _pricePerToken);
        
        nextOrderId++;
    }
    
    /**
     * @dev Fill a sell order (buyer purchases from seller)
     */
    function fillSellOrder(uint256 _orderId) external payable nonReentrant {
        Order storage order = orders[_orderId];
        
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(order.orderType == OrderType.SELL, "Not a sell order");
        require(msg.sender != order.trader, "Cannot fill your own order");
        
        uint256 totalPrice = order.amount * order.pricePerToken;
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Calculate fee
        uint256 fee = (totalPrice * platformFee) / 100;
        uint256 sellerAmount = totalPrice - fee;
        
        // Update order status
        order.status = OrderStatus.FILLED;
        _removeFromOpenOrders(_orderId);
        
        // Transfer tokens to buyer
        require(
            carbToken.transfer(msg.sender, order.amount),
            "Token transfer failed"
        );
        
        // Pay seller
        payable(order.trader).transfer(sellerAmount);
        
        // Refund excess
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
        
        emit OrderFilled(_orderId, msg.sender, order.trader, order.amount, totalPrice);
    }
    
    /**
     * @dev Fill a buy order (seller sells to buyer)
     */
    function fillBuyOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        
        require(order.status == OrderStatus.OPEN, "Order not open");
        require(order.orderType == OrderType.BUY, "Not a buy order");
        require(msg.sender != order.trader, "Cannot fill your own order");
        
        // Transfer tokens from seller to buyer
        require(
            carbToken.transferFrom(msg.sender, order.trader, order.amount),
            "Token transfer failed"
        );
        
        uint256 totalPrice = order.amount * order.pricePerToken;
        uint256 fee = (totalPrice * platformFee) / 100;
        uint256 sellerAmount = totalPrice - fee;
        
        // Update order status
        order.status = OrderStatus.FILLED;
        _removeFromOpenOrders(_orderId);
        
        // Pay seller
        payable(msg.sender).transfer(sellerAmount);
        
        emit OrderFilled(_orderId, order.trader, msg.sender, order.amount, totalPrice);
    }
    
    /**
     * @dev Cancel an order
     */
    function cancelOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        
        require(order.trader == msg.sender, "Not your order");
        require(order.status == OrderStatus.OPEN, "Order not open");
        
        order.status = OrderStatus.CANCELLED;
        _removeFromOpenOrders(_orderId);
        
        // Return escrowed assets
        if (order.orderType == OrderType.SELL) {
            // Return tokens
            require(
                carbToken.transfer(msg.sender, order.amount),
                "Token transfer failed"
            );
        } else {
            // Return MATIC
            uint256 totalCost = order.amount * order.pricePerToken;
            payable(msg.sender).transfer(totalCost);
        }
        
        emit OrderCancelled(_orderId);
    }
    
    /**
     * @dev Get all open orders
     */
    function getOpenOrders() external view returns (uint256[] memory) {
        return openOrderIds;
    }
    
    /**
     * @dev Get order details
     */
    function getOrder(uint256 _orderId) external view returns (
        address trader,
        OrderType orderType,
        uint256 amount,
        uint256 pricePerToken,
        OrderStatus status,
        uint256 timestamp
    ) {
        Order memory order = orders[_orderId];
        return (
            order.trader,
            order.orderType,
            order.amount,
            order.pricePerToken,
            order.status,
            order.timestamp
        );
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updateFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 10, "Fee too high"); // Max 10%
        platformFee = _newFee;
    }
    
    /**
     * @dev Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Internal: Remove order from open orders array
     */
    function _removeFromOpenOrders(uint256 _orderId) internal {
        for (uint256 i = 0; i < openOrderIds.length; i++) {
            if (openOrderIds[i] == _orderId) {
                openOrderIds[i] = openOrderIds[openOrderIds.length - 1];
                openOrderIds.pop();
                break;
            }
        }
    }
}
