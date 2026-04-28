// firebase/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ethers } = require('ethers');

admin.initializeApp();

// Initialize Vertex AI
const vertex_ai = new VertexAI({
  project: functions.config().vertex.project_id,
  location: functions.config().vertex.location || 'us-central1'
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);

// Initialize Web3 for blockchain interaction
const provider = new ethers.providers.JsonRpcProvider(
  functions.config().polygon.rpc_url || 'https://rpc-mumbai.maticvigil.com'
);

const wallet = new ethers.Wallet(
  functions.config().polygon.private_key,
  provider
);

// CARB Token ABI (minimal for minting)
const CARB_TOKEN_ABI = [
  "function mintCarbonCredits(address _user, string _actionType, uint256 _carbAmount, bytes32 _proofHash, uint256 _verificationScore) external"
];

const carbTokenContract = new ethers.Contract(
  functions.config().polygon.carb_token_address,
  CARB_TOKEN_ABI,
  wallet
);

/**
 * Verify sustainable action using Vertex AI Vision
 * Cloud Function triggered by Firestore write
 */
exports.verifyCarbonAction = functions.firestore
  .document('carbon_actions/{actionId}')
  .onCreate(async (snap, context) => {
    try {
      const actionData = snap.data();
      const actionId = context.params.actionId;
      
      console.log(`Processing action ${actionId}:`, actionData);
      
      // Step 1: Download image from Firebase Storage
      const bucket = admin.storage().bucket();
      const imagePath = actionData.imagePath;
      const [imageBuffer] = await bucket.file(imagePath).download();
      
      // Step 2: Verify with Vertex AI AutoML Vision
      const visionScore = await verifyWithVertexAI(
        imageBuffer,
        actionData.actionType
      );
      
      console.log(`Vertex AI confidence score: ${visionScore}%`);
      
      // Step 3: Additional verification with Gemini Vision (multimodal)
      const geminiAnalysis = await verifyWithGemini(
        imageBuffer,
        actionData.actionType,
        actionData.location,
        actionData.timestamp
      );
      
      console.log('Gemini analysis:', geminiAnalysis);
      
      // Step 4: Calculate final verification score (weighted average)
      const finalScore = Math.round(visionScore * 0.7 + geminiAnalysis.score * 0.3);
      
      // Step 5: Check if score meets threshold
      const MIN_SCORE = 85;
      const verified = finalScore >= MIN_SCORE;
      
      // Step 6: Calculate CARB rewards based on action type
      const carbAmount = calculateCARBReward(actionData.actionType, actionData);
      
      // Step 7: Create proof hash (for blockchain uniqueness)
      const proofHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string', 'address', 'uint256', 'string'],
          [imagePath, actionData.userId, actionData.timestamp, actionData.actionType]
        )
      );
      
      // Step 8: Update Firestore with verification results
      await snap.ref.update({
        verificationScore: finalScore,
        verified: verified,
        carbAmount: carbAmount,
        proofHash: proofHash,
        vertexScore: visionScore,
        geminiAnalysis: geminiAnalysis.analysis,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: verified ? 'verified' : 'rejected'
      });
      
      // Step 9: If verified, mint CARB tokens on blockchain
      if (verified) {
        console.log(`Minting ${carbAmount} CARB tokens to ${actionData.userWallet}`);
        
        try {
          const tx = await carbTokenContract.mintCarbonCredits(
            actionData.userWallet,
            actionData.actionType,
            carbAmount,
            proofHash,
            finalScore
          );
          
          const receipt = await tx.wait();
          console.log('Blockchain TX:', receipt.transactionHash);
          
          // Update with blockchain transaction
          await snap.ref.update({
            blockchainTx: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            minted: true
          });
          
          // Send notification to user
          await sendNotification(
            actionData.userId,
            'Carbon Credits Earned!',
            `You earned ${carbAmount} CARB tokens for your ${actionData.actionType} action!`
          );
          
        } catch (blockchainError) {
          console.error('Blockchain minting error:', blockchainError);
          await snap.ref.update({
            error: blockchainError.message,
            status: 'verification_success_minting_failed'
          });
        }
      } else {
        // Send rejection notification
        await sendNotification(
          actionData.userId,
          'Verification Failed',
          `Your ${actionData.actionType} action could not be verified. Score: ${finalScore}% (minimum ${MIN_SCORE}% required)`
        );
      }
      
      return { success: true, verified, finalScore, carbAmount };
      
    } catch (error) {
      console.error('Verification error:', error);
      await snap.ref.update({
        error: error.message,
        status: 'error'
      });
      throw error;
    }
  });

/**
 * Verify image using Vertex AI AutoML Vision
 */
async function verifyWithVertexAI(imageBuffer, actionType) {
  try {
    const model = 'imagetext@001'; // Multimodal model
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
    });

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      }
    };

    const prompts = {
      'transport': 'Analyze this image. Is this person using public transportation (bus, metro, train)? Provide a confidence score 0-100.',
      'tree': 'Analyze this image. Is there a newly planted tree or sapling visible? Is there evidence of recent planting (fresh soil, water, planting tools)? Provide confidence score 0-100.',
      'solar': 'Analyze this image. Are there solar panels visible? Are they properly installed and functional? Provide confidence score 0-100.',
      'route': 'Analyze this image. Is this a delivery vehicle or logistics truck on an eco-friendly route? Provide confidence score 0-100.'
    };

    const request = {
      contents: [
        {
          role: 'user',
          parts: [imagePart, { text: prompts[actionType] || prompts['transport'] }]
        }
      ],
    };

    const result = await generativeModel.generateContent(request);
    const response = result.response;
    const text = response.candidates[0].content.parts[0].text;
    
    // Extract score from response (basic parsing)
    const scoreMatch = text.match(/(\d+)%|score[:\s]+(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1] || scoreMatch[2]) : 50;
    
    return Math.min(100, Math.max(0, score));
    
  } catch (error) {
    console.error('Vertex AI error:', error);
    return 50; // Default mid-score on error
  }
}

/**
 * Verify and analyze using Gemini Vision API
 */
async function verifyWithGemini(imageBuffer, actionType, location, timestamp) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: "image/jpeg"
      }
    };

    const prompts = {
      'transport': `You are verifying a sustainable transport action. 
        Analyze if this image shows public transportation usage.
        Location: ${location?.latitude}, ${location?.longitude}
        Timestamp: ${new Date(timestamp).toISOString()}
        
        Check for:
        1. Public transport vehicle (bus, metro, train)
        2. Consistency with location/timestamp
        3. No signs of manipulation
        
        Return a JSON with: score (0-100), analysis (brief explanation), flags (any concerns)`,
      
      'tree': `You are verifying tree planting.
        Analyze if this shows a newly planted tree.
        Location: ${location?.latitude}, ${location?.longitude}
        
        Check for:
        1. Visible tree/sapling
        2. Fresh planting evidence
        3. Location plausibility
        4. No stock photo indicators
        
        Return JSON: {score, analysis, flags}`,
      
      'solar': `Verify solar panel installation.
        Check for: functional panels, proper installation, real setup (not catalog photo).
        Return JSON: {score, analysis, flags}`,
      
      'route': `Verify eco-friendly logistics route.
        Check for: delivery vehicle, route efficiency indicators.
        Return JSON: {score, analysis, flags}`
    };

    const result = await model.generateContent([
      prompts[actionType] || prompts['transport'],
      imagePart
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Try to parse JSON from response
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback parsing
      const scoreMatch = text.match(/score[:\s]*(\d+)/i);
      parsed = {
        score: scoreMatch ? parseInt(scoreMatch[1]) : 75,
        analysis: text,
        flags: []
      };
    }
    
    return {
      score: Math.min(100, Math.max(0, parsed.score || 75)),
      analysis: parsed.analysis || text,
      flags: parsed.flags || []
    };
    
  } catch (error) {
    console.error('Gemini error:', error);
    return {
      score: 75,
      analysis: 'Error in analysis',
      flags: ['analysis_error']
    };
  }
}

/**
 * Calculate CARB reward based on action type
 */
function calculateCARBReward(actionType, actionData) {
  const rewards = {
    'transport': 2.5,  // 2.5 CARB per public transport trip
    'tree': 20,        // 20 CARB per tree planted
    'solar': 50,       // 50 CARB per solar installation verification
    'route': 15,       // 15 CARB per eco-route
    'recycle': 3.2     // 3.2 CARB per kg recycled
  };
  
  let baseReward = rewards[actionType] || 1;
  
  // Multiply by quantity if provided
  if (actionData.quantity) {
    baseReward *= actionData.quantity;
  }
  
  return Math.round(baseReward * 10) / 10; // Round to 1 decimal
}

/**
 * Send push notification to user
 */
async function sendNotification(userId, title, body) {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    
    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: title,
          body: body
        },
        data: {
          type: 'carbon_action',
          timestamp: Date.now().toString()
        }
      });
    }
  } catch (error) {
    console.error('Notification error:', error);
  }
}

/**
 * HTTP endpoint to manually trigger verification (for testing)
 */
exports.testVerification = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    const { actionId } = req.body;
    
    if (!actionId) {
      return res.status(400).send('actionId required');
    }
    
    const actionRef = admin.firestore().collection('carbon_actions').doc(actionId);
    const actionSnap = await actionRef.get();
    
    if (!actionSnap.exists) {
      return res.status(404).send('Action not found');
    }
    
    // Trigger verification
    const result = await verifyCarbonAction(actionSnap, { params: { actionId } });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
