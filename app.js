// A unique ID for your extension's data so it doesn't clash with others
const EXTENSION_ID = "my-secret-bid-tracker";

let myPoints = 0;

// OBR.onReady ensures the code only runs AFTER Owlbear Rodeo is fully loaded
OBR.onReady(async () => {
    // Get this specific player's ID and Name
    const myId = OBR.player.id;
    const myName = await OBR.player.getName();
    
    // Grab all our HTML elements
    const pointsDisplay = document.getElementById("points-display");
    const minusBtn = document.getElementById("minus-btn");
    const plusBtn = document.getElementById("plus-btn");
    const setPointsBtn = document.getElementById("set-points-btn");
    
    const maxBidDisplay = document.getElementById("max-bid-display");
    const bidInput = document.getElementById("bid-input");
    const lockBidBtn = document.getElementById("lock-bid-btn");
    
    const roomStatusText = document.getElementById("room-status-text");
    const revealBtn = document.getElementById("reveal-btn");

    // --- 1. TRACKER LOGIC ---
    function updatePointsUI() {
        pointsDisplay.value = myPoints;
        // Prevent bidding negative points, even if tracker is negative
        maxBidDisplay.innerText = Math.max(0, myPoints); 
        updateRoomMetadata();
    }

    minusBtn.onclick = () => { myPoints--; updatePointsUI(); };
    plusBtn.onclick = () => { myPoints++; updatePointsUI(); };
    setPointsBtn.onclick = () => { 
        myPoints = parseInt(pointsDisplay.value) || 0; 
        updatePointsUI(); 
    };

    // --- 2. METADATA SYNC (HOW PLAYERS COMMUNICATE) ---
    async function updateRoomMetadata(bidData = null) {
        // Fetch current room data
        const metadata = await OBR.room.getMetadata();
        let gameData = metadata[EXTENSION_ID] || {};
        
        // Update just OUR player's entry in the shared pool
        gameData[myId] = {
            name: myName,
            points: myPoints,
            bid: bidData ? bidData.amount : (gameData[myId]?.bid || 0),
            locked: bidData ? bidData.locked : (gameData[myId]?.locked || false)
        };

        // Send the updated data back to the room
        await OBR.room.setMetadata({ [EXTENSION_ID]: gameData });
    }

    // --- 3. BIDDING LOGIC ---
    lockBidBtn.onclick = () => {
        const bidAmount = parseInt(bidInput.value) || 0;
        
        // Validation
        if (bidAmount > Math.max(0, myPoints)) {
            alert("You cannot bid more points than you have!");
            return;
        }
        if (bidAmount < 0) {
            alert("Bids must be 0 or higher.");
            return;
        }
        
        // Lock the UI
        lockBidBtn.disabled = true;
        bidInput.disabled = true;
        lockBidBtn.innerText = "Bid Locked!";
        
        // Update the room so others know you are ready
        updateRoomMetadata({ amount: bidAmount, locked: true });
    };

    // --- 4. LISTENING FOR CHANGES & REVEALING ---
    // This runs automatically whenever ANYONE updates the room metadata
    OBR.room.onMetadataChange((metadata) => {
        const gameData = metadata[EXTENSION_ID];
        if (!gameData) return;

        const players = Object.values(gameData);
        const lockedPlayers = players.filter(p => p.locked);
        
        roomStatusText.innerText = `Players locked in: ${lockedPlayers.length}`;

        // If at least 2 players are locked in, enable the reveal button
        if (lockedPlayers.length >= 2) {
            revealBtn.disabled = false;
        } else {
            revealBtn.disabled = true;
        }
    });

    // --- 5. REVEAL BUTTON ---
    revealBtn.onclick = async () => {
        const metadata = await OBR.room.getMetadata();
        const gameData = metadata[EXTENSION_ID] || {};
        
        let highestBid = -1;
        let winnerName = "No one";
        let isTie = false;

        // Loop through everyone's data to find the winner
        for (const [playerId, data] of Object.entries(gameData)) {
            if (data.locked) {
                if (data.bid > highestBid) {
                    highestBid = data.bid;
                    winnerName = data.name;
                    isTie = false;
                } else if (data.bid === highestBid) {
                    isTie = true;
                }
            }
        }

        // Announce results
        if (isTie) {
            roomStatusText.innerText = `Result: It's a tie! Highest bid was ${highestBid}.`;
        } else {
            roomStatusText.innerText = `Result: ${winnerName} wins with a bid of ${highestBid} points!`;
        }

        // Reset the locks for the next round
        const resetData = { ...gameData };
        for (const key in resetData) {
            resetData[key].locked = false;
            resetData[key].bid = 0;
        }
        await OBR.room.setMetadata({ [EXTENSION_ID]: resetData });
        
        // Unlock local UI
        lockBidBtn.disabled = false;
        bidInput.disabled = false;
        lockBidBtn.innerText = "Lock In Bid";
        bidInput.value = "";
        revealBtn.disabled = true;
    };
});
