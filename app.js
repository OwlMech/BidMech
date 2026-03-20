const EXTENSION_ID = "my-secret-bid-tracker";
let myPoints = 0;

OBR.onReady(async () => {
    const myId = OBR.player.id;
    const myName = await OBR.player.getName();
    
    const pointsDisplay = document.getElementById("points-display");
    const minusBtn = document.getElementById("minus-btn");
    const plusBtn = document.getElementById("plus-btn");
    const setPointsBtn = document.getElementById("set-points-btn");
    
    const maxBidDisplay = document.getElementById("max-bid-display");
    const bidInput = document.getElementById("bid-input");
    const lockBidBtn = document.getElementById("lock-bid-btn");
    
    const roomStatusText = document.getElementById("room-status-text");
    const revealBtn = document.getElementById("reveal-btn");
    const scoreboardList = document.getElementById("scoreboard-list"); // NEW

    // --- 0. INITIALIZATION ---
    // Fetch data on load in case we joined late or refreshed
    const initialMetadata = await OBR.room.getMetadata();
    const initialGameData = initialMetadata[EXTENSION_ID] || {};
    if (initialGameData[myId]) {
        myPoints = initialGameData[myId].points || 0;
        pointsDisplay.value = myPoints;
        maxBidDisplay.innerText = Math.max(0, myPoints);
    }

    // --- 1. TRACKER LOGIC ---
    function updatePointsUI() {
        pointsDisplay.value = myPoints;
        maxBidDisplay.innerText = Math.max(0, myPoints); 
        updateRoomMetadata();
    }

    minusBtn.onclick = () => { myPoints--; updatePointsUI(); };
    plusBtn.onclick = () => { myPoints++; updatePointsUI(); };
    setPointsBtn.onclick = () => { 
        myPoints = parseInt(pointsDisplay.value) || 0; 
        updatePointsUI(); 
    };

    // --- 2. METADATA SYNC ---
    async function updateRoomMetadata(bidData = null) {
        const metadata = await OBR.room.getMetadata();
        let gameData = metadata[EXTENSION_ID] || {};
        
        gameData[myId] = {
            name: myName,
            points: myPoints,
            bid: bidData ? bidData.amount : (gameData[myId]?.bid || 0),
            locked: bidData ? bidData.locked : (gameData[myId]?.locked || false)
        };

        await OBR.room.setMetadata({ [EXTENSION_ID]: gameData });
    }

    // --- 3. BIDDING LOGIC ---
    lockBidBtn.onclick = () => {
        const bidAmount = parseInt(bidInput.value) || 0;
        
        if (bidAmount > Math.max(0, myPoints)) {
            alert("You cannot bid more points than you have!");
            return;
        }
        if (bidAmount < 0) {
            alert("Bids must be 0 or higher.");
            return;
        }
        
        lockBidBtn.disabled = true;
        bidInput.disabled = true;
        lockBidBtn.innerText = "Bid Locked!";
        
        updateRoomMetadata({ amount: bidAmount, locked: true });
    };

    // --- 4. LISTENING FOR CHANGES & SCOREBOARD ---
    OBR.room.onMetadataChange((metadata) => {
        const gameData = metadata[EXTENSION_ID];
        if (!gameData) return;

        // Prevent Desync: Force local points to match the room's official record
        if (gameData[myId] && gameData[myId].points !== undefined) {
            myPoints = gameData[myId].points;
            pointsDisplay.value = myPoints;
            maxBidDisplay.innerText = Math.max(0, myPoints);
        }

        // Render Scoreboard
        scoreboardList.innerHTML = ""; 
        const players = Object.values(gameData);
        
        players.forEach(p => {
            const pElem = document.createElement("div");
            const lockStatus = p.locked ? "🔒 Ready" : "⏳ Bidding...";
            pElem.innerText = `${p.name}: ${p.points} pts | ${lockStatus}`;
            scoreboardList.appendChild(pElem);
        });

        const lockedPlayers = players.filter(p => p.locked);
        roomStatusText.innerText = `Players locked in: ${lockedPlayers.length}`;

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

        for (const [playerId, data] of Object.entries(gameData)) {
            if (data.locked) {
                // ANTI-CHEAT CLAMP: If someone somehow submitted a bid higher than their points, 
                // we forcefully shrink it down to their actual available points.
                const validBid = Math.min(data.bid, Math.max(0, data.points));
                
                if (validBid > highestBid) {
                    highestBid = validBid;
                    winnerName = data.name;
                    isTie = false;
                } else if (validBid === highestBid) {
                    isTie = true;
                }
            }
        }

        if (isTie) {
            roomStatusText.innerText = `Result: It's a tie! Highest bid was ${highestBid}.`;
        } else {
            roomStatusText.innerText = `Result: ${winnerName} wins with a bid of ${highestBid} points!`;
        }

        const resetData = { ...gameData };
        for (const key in resetData) {
            resetData[key].locked = false;
            resetData[key].bid = 0;
        }
        await OBR.room.setMetadata({ [EXTENSION_ID]: resetData });
        
        lockBidBtn.disabled = false;
        bidInput.disabled = false;
        lockBidBtn.innerText = "Lock In Bid";
        bidInput.value = "";
        revealBtn.disabled = true;
    };
});
