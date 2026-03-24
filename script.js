const canvas = document.getElementById('fieldCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const saveButton = document.getElementById('saveButton');
const loadButton = document.getElementById('loadButton');
const loadInput = document.getElementById('loadInput');

const border = 20;
const fieldWidth = canvas.width - border * 2;
const fieldHeight = canvas.height - border * 2;

let players = [];
let animationId = null;
let dragging = null; // { player, offsetX, offsetY }
let nextPlayerId = 1;
let totalPlayers = 0;
const maxPlayers = 22;

function coordToPixel(coordX, coordY) {
    return {
        x: border + (coordX / 100) * fieldWidth,
        y: border + fieldHeight - (coordY / 53.3) * fieldHeight
    };
}

function pixelToCoord(pixelX, pixelY) {
    const dx = pixelX - border;
    const dy = pixelY - border;
    return {
        x: (dx / fieldWidth) * 100,
        y: (1 - dy / fieldHeight) * 53.3
    };
}

function updateInputsForPlayer(id, coord) {
    const xInput = document.getElementById(`x${id}`);
    const yInput = document.getElementById(`y${id}`);
    if (xInput) xInput.value = coord.x.toFixed(1);
    if (yInput) yInput.value = coord.y.toFixed(1);
}
const recordState = {
    active: false,
    playerId: null,
    recording: false,
    frames: [],
    originX: null,
    originY: null
};

// ── Edit-label modal ──────────────────────────────────────────────────────────
const editLabelState = { playerId: null };

function showEditLabelModal(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    editLabelState.playerId = playerId;

    const modal = document.getElementById('editLabelModal');
    const input = document.getElementById('editLabelInput');
    const title = document.getElementById('editLabelTitle');

    title.textContent = `Editar Label — Jogador ${playerId} (${player.team === 'offense' ? 'Ataque' : 'Defesa'})`;
    input.value = player.label || '';
    modal.style.display = 'flex';

    // Selects all text and focuses
    requestAnimationFrame(() => { input.focus(); input.select(); });
}

function closeEditLabelModal() {
    editLabelState.playerId = null;
    document.getElementById('editLabelModal').style.display = 'none';
}

function saveEditLabel() {
    const { playerId } = editLabelState;
    if (!playerId) return;

    const raw   = document.getElementById('editLabelInput').value.trim().toUpperCase();
    const label = raw.slice(0, 3);  // max 3 chars

    const player = players.find(p => p.id === playerId);
    if (player) {
        player.label = label;
        // keep sidebar input in sync
        const labelInput = document.getElementById(`label${playerId}`);
        if (labelInput) labelInput.value = label;
        redraw();
    }

    closeEditLabelModal();
}
// ─────────────────────────────────────────────────────────────────────────────

function showRecordModal(playerId) {
    recordState.active = true;
    recordState.playerId = playerId;
    recordState.recording = false;
    recordState.frames = [];
    recordState.originX = parseFloat(document.getElementById(`x${playerId}`).value);
    recordState.originY = parseFloat(document.getElementById(`y${playerId}`).value);

    const modal = document.getElementById('recordModal');
    const info = document.getElementById('recordInfo');
    modal.style.display = 'flex';
    info.textContent = 'Clique em "Iniciar gravação" e arraste o jogador pelo campo. Depois clique em "Parar gravação" e em "Salvar movimento".';

    document.getElementById('startRecord').disabled = false;
    document.getElementById('stopRecord').disabled = true;
}

function closeRecordModal() {
    recordState.active = false;
    recordState.playerId = null;
    recordState.recording = false;
    recordState.frames = [];

    const modal = document.getElementById('recordModal');
    modal.style.display = 'none';
    redraw();
}

function startRecording() {
    if (!recordState.active) return;
    recordState.recording = true;
    recordState.frames = [];
    document.getElementById('startRecord').disabled = true;
    document.getElementById('stopRecord').disabled = false;
}

function stopRecording() {
    recordState.recording = false;
    document.getElementById('startRecord').disabled = false;
    document.getElementById('stopRecord').disabled = true;
}

function saveRecording() {
    if (!recordState.active || !recordState.playerId) return;

    const frames = recordState.frames.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
    const frameString = frames.join(';');
    const framesField = document.getElementById(`frames${recordState.playerId}`);
    if (framesField) framesField.value = frameString;

    // Restore original position before reinserting player
    const xInput = document.getElementById(`x${recordState.playerId}`);
    const yInput = document.getElementById(`y${recordState.playerId}`);
    if (xInput) xInput.value = recordState.originX;
    if (yInput) yInput.value = recordState.originY;

    // Also update the player object if it exists
    const player = players.find(p => p.id === recordState.playerId);
    if (player) {
        player.x = recordState.originX;
        player.y = recordState.originY;
        updateInputsForPlayer(player.id, { x: recordState.originX, y: recordState.originY });
    }

    const savedId = recordState.playerId;
    insertPlayer(savedId);
    updateRouteButtonState(savedId);

    closeRecordModal();
}

function recordMousePosition(event) {
    if (!recordState.recording || !recordState.active) return;
    if (!(event.buttons & 1)) return; // Only record when left button is pressed

    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const coord = pixelToCoord(mx, my);

    recordState.frames.push({ x: coord.x, y: coord.y });

    const player = players.find(p => p.id === recordState.playerId);
    if (player) {
        player.x = mx;
        player.y = my;
        updateInputsForPlayer(player.id, coord);
        redraw();
    }
}
function addPlayerField(team, forcedId = null) {
    if (totalPlayers >= maxPlayers) return;

    const offenseColumn = document.getElementById('offenseColumn');
    const defenseColumn = document.getElementById('defenseColumn');
    const column = team === 'defense' ? defenseColumn : offenseColumn;

    const id = forcedId ?? nextPlayerId++;
    nextPlayerId = Math.max(nextPlayerId, id + 1);
    totalPlayers++;

    const fieldset = document.createElement('fieldset');
    fieldset.id = `player${id}`;
    fieldset.dataset.team = team;
    fieldset.dataset.id = id;
    fieldset.innerHTML = `
        <legend>Jogador ${id} (${team === 'offense' ? 'Ataque' : 'Defesa'})</legend>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <label style="margin:0; white-space:nowrap;">Letra (A-Z):</label>
            <input type="text" id="label${id}" maxlength="1" pattern="[A-Za-z]" placeholder="A" style="width:50px; margin:0;" />
            <button type="button" id="place${id}" style="margin:0; flex:1;">Inserir jogador ${id}</button>
            <button type="button" id="route${id}" title="Mostrar/ocultar rota no campo" style="margin:0; font-size:16px;">〰</button>
            <button type="button" id="remove${id}" style="margin:0;">Remover</button>
        </div>
        <label>Posição Inicial X (0-100):</label><input type="number" id="x${id}" min="0" max="100" value="50" required>
        <label>Posição Inicial Y (0-53):</label><input type="number" id="y${id}" min="0" max="53" value="10" required>
        <label>Frames (pares x,y separados por ; ex: 10,20;20,30):</label><textarea id="frames${id}" placeholder="10,20;20,30"></textarea>
    `;

    column.appendChild(fieldset);
    document.getElementById(`place${id}`).addEventListener('click', () => insertPlayer(id));
    document.getElementById(`route${id}`).addEventListener('click', () => toggleRoute(id));
    document.getElementById(`remove${id}`).addEventListener('click', () => removePlayer(id));

    updateAddButtons();

    // Automatically place player at default coordinates
    insertPlayer(id);
    return id;
}

function updateAddButtons() {
    const addOffense = document.getElementById('addOffense');
    const addDefense = document.getElementById('addDefense');
    const disabled = totalPlayers >= maxPlayers;
    addOffense.disabled = disabled;
    addDefense.disabled = disabled;
}

function removePlayer(id) {
    // Remove from array
    players = players.filter(p => p.id !== id);

    // Remove UI
    const fieldset = document.getElementById(`player${id}`);
    if (fieldset) {
        fieldset.remove();
    }

    totalPlayers = Math.max(0, totalPlayers - 1);
    updateAddButtons();

    redraw();
}

// Draw the field
function drawField() {
    const border = 20;
    const fieldX = border;
    const fieldY = border;
    const fieldWidth = canvas.width - border * 2;
    const fieldHeight = canvas.height - border * 2;

    // Outer border (dark green)
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fill end zones (inside border)
    ctx.fillStyle = '#2E8B57';
    ctx.fillRect(fieldX, fieldY, fieldWidth * 0.1, fieldHeight); // Left end zone
    ctx.fillRect(fieldX + fieldWidth * 0.9, fieldY, fieldWidth * 0.1, fieldHeight); // Right end zone

    // Fill main field
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(fieldX + fieldWidth * 0.1, fieldY, fieldWidth * 0.8, fieldHeight);

    // Draw sidelines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);

    // Draw yard lines (between end zones)
    const playStartX = fieldX + fieldWidth * 0.1;
    const playWidth = fieldWidth * 0.8; // 100 yards
    const yardStep = playWidth / 10;
    const halfYardStep = yardStep / 2;

    // 5-yard lines (lighter, thinner)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        if (i === 10) break;
        const x = playStartX + i * yardStep + halfYardStep;
        ctx.beginPath();
        ctx.moveTo(x, fieldY);
        ctx.lineTo(x, fieldY + fieldHeight);
        ctx.stroke();
    }

    // 10-yard lines (full white)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
        const x = playStartX + i * yardStep;
        ctx.beginPath();
        ctx.moveTo(x, fieldY);
        ctx.lineTo(x, fieldY + fieldHeight);
        ctx.stroke();
    }

    // Add yard numbers (10-50-10) inside playing field
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    const yardNumbers = [10, 20, 30, 40, 50, 40, 30, 20, 10];
    for (let i = 0; i < yardNumbers.length; i++) {
        const x = playStartX + (i + 1) * yardStep;
        ctx.fillText(yardNumbers[i], x, fieldY + 20); // Top inside field
        ctx.fillText(yardNumbers[i], x, fieldY + fieldHeight - 10); // Bottom inside field
    }

    // Add END ZONE text
    ctx.font = '16px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';

    // Left end zone
    ctx.save();
    ctx.translate(40, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('END ZONE', 0, 0);
    ctx.restore();

    // Right end zone
    ctx.save();
    ctx.translate(760, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('END ZONE', 0, 0);
    ctx.restore();

    // Add coordinate markings
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';

    // X axis (bottom and top) - 0..100 every 10
    for (let i = 0; i <= 100; i += 10) {
        const x = border + (i / 100) * fieldWidth;
        ctx.textAlign = 'center';
        ctx.fillText(i, x, canvas.height - 2);          // bottom (near border)
        ctx.fillText(i, x, 12);                        // top (near border)

        // ticks
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x, canvas.height - 10);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 10);
        ctx.stroke();
    }

    // Y axis (left and right) - 0..53 every 10
    for (let i = 0; i <= 53; i += 10) {
        const y = border + fieldHeight - (i / 53.3) * fieldHeight;
        ctx.textAlign = 'right';
        ctx.fillText(i, 20, y + 4);                    // left (near border)
        ctx.textAlign = 'left';
        ctx.fillText(i, canvas.width - 20, y + 4);     // right (near border)

        // ticks
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(10, y);
        ctx.moveTo(canvas.width, y);
        ctx.lineTo(canvas.width - 10, y);
        ctx.stroke();
    }
}

// Draw players
function drawPlayers() {
    players.forEach(player => {
        ctx.fillStyle = player.team === 'offense' ? '#0000FF' : '#FF0000'; // Blue for offense, red for defense
        ctx.beginPath();
        ctx.arc(player.x, player.y, 9, 0, 2 * Math.PI);
        ctx.fill();

        if (player.selected) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(player.x, player.y, 11, 0, 2 * Math.PI);
            ctx.stroke();
        }

        // Draw label inside circle (moving)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const labelX = player.x;
        const labelY = player.y + 4;
        ctx.fillText(player.label || player.id, labelX, labelY);
    });
}

// Draw saved routes for players with showRoute enabled
function drawRoutes() {
    players.forEach(player => {
        if (!player.showRoute || player.frames.length === 0) return;

        const xInput = document.getElementById(`x${player.id}`);
        const yInput = document.getElementById(`y${player.id}`);
        if (!xInput || !yInput) return;

        const ox = parseFloat(xInput.value);
        const oy = parseFloat(yInput.value);
        if (isNaN(ox) || isNaN(oy)) return;

        const origin = coordToPixel(ox, oy);

        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        player.frames.forEach(f => ctx.lineTo(f.x, f.y));

        ctx.strokeStyle = player.team === 'offense'
            ? 'rgba(0, 0, 0, 0.9)'
            : 'rgba(0, 0, 139, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow at end of route
        if (player.frames.length >= 2) {
            const last = player.frames[player.frames.length - 1];
            const prev = player.frames[player.frames.length - 2];
            drawArrowHead(prev.x, prev.y, last.x, last.y, ctx.strokeStyle.replace(/[\d.]+\)$/, '1)'));
        }
    });
}

// Draw route preview while recording
function drawRecordingPreview() {
    if (!recordState.active || recordState.frames.length === 0) return;

    const origin = coordToPixel(recordState.originX, recordState.originY);

    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    recordState.frames.forEach(f => {
        const p = coordToPixel(f.x, f.y);
        ctx.lineTo(p.x, p.y);
    });

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (recordState.frames.length >= 2) {
        const last = recordState.frames[recordState.frames.length - 1];
        const prev = recordState.frames[recordState.frames.length - 2];
        drawArrowHead(coordToPixel(prev.x, prev.y).x, coordToPixel(prev.x, prev.y).y,
                      coordToPixel(last.x, last.y).x, coordToPixel(last.x, last.y).y,
                      'rgba(0, 0, 0, 0.95)');
    }
}

function drawArrowHead(x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

// Standard redraw: field + routes + recording preview + players
function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
    drawRoutes();
    if (recordState.active) drawRecordingPreview();
    drawPlayers();
}

// Toggle route visibility for a single player
function toggleRoute(id) {
    const player = players.find(p => p.id === id);
    if (!player || player.frames.length === 0) return;
    player.showRoute = !player.showRoute;
    updateRouteButtonState(id);
    redraw();
}

// Update the visual state of a player's route button
function updateRouteButtonState(id) {
    const player = players.find(p => p.id === id);
    const btn = document.getElementById(`route${id}`);
    if (!btn) return;
    btn.style.color = (player?.showRoute && player?.frames.length > 0) ? 'var(--accent)' : '';
}

// Toggle all routes: show all if any are hidden, hide all if all are showing
function toggleAllRoutes() {
    const playersWithFrames = players.filter(p => p.frames.length > 0);
    if (playersWithFrames.length === 0) return;

    const allShowing = playersWithFrames.every(p => p.showRoute);
    playersWithFrames.forEach(p => {
        p.showRoute = !allShowing;
        updateRouteButtonState(p.id);
    });

    const btn = document.getElementById('showAllRoutes');
    if (btn) btn.style.color = !allShowing ? 'var(--accent)' : '';

    redraw();
}

// Animate movement
function animate() {
    let allDone = true;
    players.forEach(player => {
        if (player.currentFrameIndex < player.frames.length) {
            allDone = false;
            const target = player.frames[player.currentFrameIndex];
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 1) {
                // Move towards target
                player.x += dx / distance * 2; // speed
                player.y += dy / distance * 2;
            } else {
                // Reached target, move to next
                player.x = target.x;
                player.y = target.y;
                player.currentFrameIndex++;
            }
        }
    });

    if (!allDone) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawField();
        drawRoutes();
        drawPlayers();

        animationId = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(animationId);
    }
}

// Setup UI and add buttons
window.onload = function() {
    const addOffense = document.getElementById('addOffense');
    const addDefense = document.getElementById('addDefense');

    addOffense.addEventListener('click', () => addPlayerField('offense'));
    addDefense.addEventListener('click', () => addPlayerField('defense'));

    document.getElementById('clearAllButton').addEventListener('click', clearAll);
    document.getElementById('clearMovesButton').addEventListener('click', clearAllMoves);
    document.getElementById('resetButton').addEventListener('click', resetPositions);
    document.getElementById('showAllRoutes').addEventListener('click', toggleAllRoutes);
    document.getElementById('quickOL').addEventListener('click', placeOffensiveLine);
    document.getElementById('quickIF').addEventListener('click', placeIFormation);
    document.getElementById('quickTSL').addEventListener('click', placeTripsStackLeft);
    document.getElementById('quickTSR').addEventListener('click', placeTripsStackRight);
    document.getElementById('quickAce22').addEventListener('click', placeAce22);
    document.getElementById('quickTreyTE').addEventListener('click', placeTreyTE31);
    document.getElementById('quickDL42').addEventListener('click', placeDefensiveFront42);
    document.getElementById('quickDL33').addEventListener('click', placeDefensiveFront33);
    document.getElementById('quickDL34').addEventListener('click', placeDefensiveFront34);
    saveButton.addEventListener('click', saveFormation);
    loadButton.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', handleLoadFile);
    document.getElementById('galleryButton').addEventListener('click', openGallery);
    document.getElementById('closeGallery').addEventListener('click', () => {
        document.getElementById('galleryModal').style.display = 'none';
    });
    document.getElementById('galleryModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('galleryModal')) {
            document.getElementById('galleryModal').style.display = 'none';
        }
    });

    document.getElementById('startRecord').addEventListener('click', startRecording);
    document.getElementById('stopRecord').addEventListener('click', stopRecording);
    document.getElementById('saveRecord').addEventListener('click', saveRecording);
    document.getElementById('cancelRecord').addEventListener('click', closeRecordModal);

    document.getElementById('saveEditLabel').addEventListener('click', saveEditLabel);
    document.getElementById('cancelEditLabel').addEventListener('click', closeEditLabelModal);

    // Esc fecha o modal de edição de label
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('editLabelModal').style.display !== 'none') {
            if (e.key === 'Escape') closeEditLabelModal();
            if (e.key === 'Enter')  saveEditLabel();
        }
    });

    // Clique fora do conteúdo do modal fecha o overlay
    document.getElementById('editLabelModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('editLabelModal')) closeEditLabelModal();
    });

    updateAddButtons();
};

// Insert/update a single player based on its input fields
function insertPlayer(i) {
    const x = parseFloat(document.getElementById(`x${i}`).value);
    const y = parseFloat(document.getElementById(`y${i}`).value);
    const framesStr = document.getElementById(`frames${i}`).value;
    const frames = framesStr ? framesStr.split(';').map(f => {
        const [fx, fy] = f.split(',').map(Number);
        return { x: fx, y: fy };
    }).filter(f => !isNaN(f.x) && !isNaN(f.y)) : [];

    // Convert to pixels
    const { x: pixelX, y: pixelY } = coordToPixel(x, y);
    const labelInput = document.getElementById(`label${i}`).value.trim().toUpperCase();
    const label = labelInput ? labelInput[0] : '';

    const fieldset = document.getElementById(`player${i}`);
    const team = fieldset?.dataset?.team || 'offense';

    const playerIndex = players.findIndex(p => p.id === i);
    const newPlayer = {
        id: i,
        team,
        x: pixelX,
        y: pixelY,
        label,
        labelOffset: { x: 0, y: 0 },
        labelVelocity: { x: 0.5, y: 0.5 },
        showRoute: players[playerIndex]?.showRoute ?? false,
        frames: frames.map(f => {
            const { x, y } = coordToPixel(f.x, f.y);
            return { x, y };
        }),
        currentFrameIndex: 0
    };

    if (playerIndex >= 0) {
        players[playerIndex] = newPlayer;
    } else {
        players.push(newPlayer);
    }

    redraw();
}

function clearAll() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    players = [];
    totalPlayers = 0;
    nextPlayerId = 1;
    document.querySelectorAll('fieldset[data-id]').forEach(f => f.remove());
    updateAddButtons();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawField();
}

function clearAllMoves() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    players.forEach(p => {
        p.frames = [];
        p.currentFrameIndex = 0;
        p.showRoute = false;
        updateRouteButtonState(p.id);
        const framesField = document.getElementById(`frames${p.id}`);
        if (framesField) framesField.value = '';
    });
    const btn = document.getElementById('showAllRoutes');
    if (btn) btn.style.color = '';
    redraw();
}

function placeOffensiveLine() {
    const lineX = 50;
    const centerY = 26.5;
    const spacing = 3;
    const lineup = [
        { label: 'T', y: centerY + spacing * 2 },
        { label: 'G', y: centerY + spacing },
        { label: 'C', y: centerY },
        { label: 'G', y: centerY - spacing },
        { label: 'T', y: centerY - spacing * 2 },
    ];
    lineup.forEach(({ label, y }) => {
        const id = addPlayerField('offense');
        document.getElementById(`label${id}`).value = label;
        document.getElementById(`x${id}`).value = lineX;
        document.getElementById(`y${id}`).value = y.toFixed(1);
        insertPlayer(id);
    });
}

function addOffensePlayers(lineup) {
    lineup.forEach(({ label, x, y }) => {
        const id = addPlayerField('offense');
        document.getElementById(`label${id}`).value = label;
        document.getElementById(`x${id}`).value = x;
        document.getElementById(`y${id}`).value = y.toFixed(1);
        insertPlayer(id);
    });
}

function placeIFormation() {
    const los = 50, c = 26.5, sp = 3;
    addOffensePlayers([
        { label: 'T', x: los, y: c + sp * 2 },
        { label: 'G', x: los, y: c + sp },
        { label: 'C', x: los, y: c },
        { label: 'G', x: los, y: c - sp },
        { label: 'T', x: los, y: c - sp * 2 },
        { label: 'E', x: los, y: c - sp * 3 },   // TE direito
        { label: 'W', x: los, y: c + sp * 6 },   // WR esquerdo (split end)
        { label: 'Q', x: los + 3, y: c },         // QB
        { label: 'F', x: los + 7, y: c },         // Fullback
        { label: 'R', x: los + 11, y: c },        // Running Back
    ]);
}

function placeTripsStackLeft() {
    const los = 50, c = 26.5, sp = 3;
    addOffensePlayers([
        { label: 'T', x: los, y: c + sp * 2 },
        { label: 'G', x: los, y: c + sp },
        { label: 'C', x: los, y: c },
        { label: 'G', x: los, y: c - sp },
        { label: 'T', x: los, y: c - sp * 2 },
        { label: 'E', x: los, y: c - sp * 3 },   // TE direito
        { label: 'Q', x: los + 3, y: c },         // QB
        { label: 'R', x: los + 7, y: c - 2 },    // RB
        { label: 'W', x: los,     y: c + sp * 7 }, // trips externo (na linha)
        { label: 'W', x: los + 3, y: c + sp * 6.5 }, // trips meio (empilhado)
        { label: 'W', x: los + 6, y: c + sp * 6 }, // trips interno (empilhado)
    ]);
}

function placeTripsStackRight() {
    const los = 50, c = 26.5, sp = 3;
    addOffensePlayers([
        { label: 'T', x: los, y: c + sp * 2 },
        { label: 'G', x: los, y: c + sp },
        { label: 'C', x: los, y: c },
        { label: 'G', x: los, y: c - sp },
        { label: 'T', x: los, y: c - sp * 2 },
        { label: 'E', x: los, y: c + sp * 3 },   // TE esquerdo
        { label: 'Q', x: los + 3, y: c },         // QB
        { label: 'R', x: los + 7, y: c + 2 },    // RB
        { label: 'W', x: los,     y: c - sp * 7 }, // trips externo (na linha)
        { label: 'W', x: los + 3, y: c - sp * 6.5 }, // trips meio (empilhado)
        { label: 'W', x: los + 6, y: c - sp * 6 }, // trips interno (empilhado)
    ]);
}

function placeAce22() {
    const los = 50, c = 26.5, sp = 3;
    addOffensePlayers([
        { label: 'T', x: los,      y: c + sp * 2 },
        { label: 'G', x: los,      y: c + sp },
        { label: 'C', x: los,      y: c },
        { label: 'G', x: los,      y: c - sp },
        { label: 'T', x: los,      y: c - sp * 2 },
        { label: 'W', x: los,      y: c + sp * 6 },   // WR esquerdo externo
        { label: 'W', x: los + 3,  y: c + sp * 4.5 }, // WR esquerdo slot
        { label: 'W', x: los,      y: c - sp * 6 },   // WR direito externo
        { label: 'W', x: los + 3,  y: c - sp * 4.5 }, // WR direito slot
        { label: 'Q', x: los + 3,  y: c },             // QB
        { label: 'R', x: los + 7,  y: c },             // RB
    ]);
}

function placeTreyTE31() {
    const los = 50, c = 26.5, sp = 3;
    addOffensePlayers([
        { label: 'T', x: los,      y: c + sp * 2 },
        { label: 'G', x: los,      y: c + sp },
        { label: 'C', x: los,      y: c },
        { label: 'G', x: los,      y: c - sp },
        { label: 'T', x: los,      y: c - sp * 2 },
        { label: 'E', x: los,      y: c - sp * 3 },   // TE (lado direito, na linha)
        { label: 'W', x: los,      y: c - sp * 5 },   // WR direito externo
        { label: 'W', x: los + 3,  y: c - sp * 4 },   // WR direito slot
        { label: 'W', x: los,      y: c + sp * 6 },   // WR esquerdo (1x)
        { label: 'Q', x: los + 3,  y: c },             // QB
        { label: 'R', x: los + 7,  y: c },             // RB
    ]);
}

function addDefensePlayers(lineup) {
    lineup.forEach(({ label, x, y }) => {
        const id = addPlayerField('defense');
        document.getElementById(`label${id}`).value = label;
        document.getElementById(`x${id}`).value = x;
        document.getElementById(`y${id}`).value = y.toFixed(1);
        insertPlayer(id);
    });
}

function placeDefensiveFront42() {
    const dlX = 40, lbX = 44, c = 26.5, sp = 4;
    addDefensePlayers([
        { label: 'E', x: dlX, y: c + sp * 1.5 },
        { label: 'T', x: dlX, y: c + sp * 0.5 },
        { label: 'T', x: dlX, y: c - sp * 0.5 },
        { label: 'E', x: dlX, y: c - sp * 1.5 },
        { label: 'M', x: lbX, y: c + sp },
        { label: 'S', x: lbX, y: c - sp },
    ]);
}

function placeDefensiveFront33() {
    const dlX = 40, lbX = 44, c = 26.5, sp = 4;
    addDefensePlayers([
        { label: 'E', x: dlX, y: c + sp },
        { label: 'T', x: dlX, y: c },
        { label: 'E', x: dlX, y: c - sp },
        { label: 'W', x: lbX, y: c + sp * 2 },
        { label: 'M', x: lbX, y: c },
        { label: 'S', x: lbX, y: c - sp * 2 },
    ]);
}

function placeDefensiveFront34() {
    const dlX = 40, lbX = 44, c = 26.5, sp = 4;
    addDefensePlayers([
        { label: 'E', x: dlX, y: c + sp },
        { label: 'T', x: dlX, y: c },
        { label: 'E', x: dlX, y: c - sp },
        { label: 'W', x: lbX, y: c + sp * 2 },
        { label: 'M', x: lbX, y: c + sp * 0.5 },
        { label: 'S', x: lbX, y: c - sp * 0.5 },
        { label: 'B', x: lbX, y: c - sp * 2 },
    ]);
}

function resetPositions() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    players.forEach(p => {
        const x = parseFloat(document.getElementById(`x${p.id}`)?.value);
        const y = parseFloat(document.getElementById(`y${p.id}`)?.value);
        if (!isNaN(x) && !isNaN(y)) {
            const pixel = coordToPixel(x, y);
            p.x = pixel.x;
            p.y = pixel.y;
        }
        p.currentFrameIndex = 0;
    });
    redraw();
}


// Start animation
startButton.addEventListener('click', () => {
    // Reset animation to start for all players
    players.forEach(p => p.currentFrameIndex = 0);
    animate();
});

function getFormationData() {
    return players.map(p => {
        const coord = pixelToCoord(p.x, p.y);
        return {
            id: p.id,
            team: p.team,
            label: p.label,
            x: Number(coord.x.toFixed(2)),
            y: Number(coord.y.toFixed(2)),
            frames: p.frames.map(f => {
                const coord = pixelToCoord(f.x, f.y);
                return { x: Number(coord.x.toFixed(2)), y: Number(coord.y.toFixed(2)) };
            })
        };
    });
}

function saveFormation() {
    const data = getFormationData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'formation.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function handleLoadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            loadFormation(data);
        } catch (e) {
            alert('Erro ao carregar formação: arquivo inválido.');
        }
    };
    reader.readAsText(file);

    loadInput.value = '';
}

function loadFormation(data) {
    // Remove existing players
    players = [];
    totalPlayers = 0;

    // Remove existing UI fields
    document.querySelectorAll('fieldset[data-id]').forEach(f => f.remove());

    // Add players from file
    const maxId = data.reduce((acc, p) => Math.max(acc, p.id ?? 0), 0);
    data.forEach(p => {
        addPlayerField(p.team || 'offense', p.id);
        document.getElementById(`label${p.id}`).value = p.label || '';
        document.getElementById(`x${p.id}`).value = p.x ?? 50;
        document.getElementById(`y${p.id}`).value = p.y ?? 10;
        document.getElementById(`frames${p.id}`).value = (p.frames || []).map(f => `${f.x},${f.y}`).join(';');
        insertPlayer(p.id);
        updateRouteButtonState(p.id);
    });

    nextPlayerId = Math.max(nextPlayerId, maxId + 1);
    updateAddButtons();
}

// Initial draw
drawField();

// Disable default context menu on canvas
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

// Drag-to-position support with multi-select
canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    const clicked = players.find(p => {
        const dx = mx - p.x;
        const dy = my - p.y;
        return Math.sqrt(dx * dx + dy * dy) <= 10;
    });

    if (recordState.active && recordState.playerId) {
        const player = players.find(p => p.id === recordState.playerId);
        if (player) {
            dragging = {
                players: [player],
                offsets: [{
                    x: player.x - mx,
                    y: player.y - my
                }]
            };
        }
        return;
    }

    if (clicked) {
        if (event.button === 2) {
            // right click opens recording modal
            showRecordModal(clicked.id);
            return;
        }

        const addSelection = event.shiftKey || event.ctrlKey || event.metaKey;

        if (!addSelection) {
            players.forEach(p => p.selected = false);
        }

        clicked.selected = !clicked.selected || addSelection;

        const selected = players.filter(p => p.selected);
        if (selected.length) {
            dragging = {
                players: selected,
                offsets: selected.map(p => ({
                    x: p.x - mx,
                    y: p.y - my
                }))
            };
        }

        redraw();
    } else {
        // click on empty space clears selection
        players.forEach(p => p.selected = false);
        dragging = null;
        redraw();
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (recordState.recording) {
        recordMousePosition(event);
        return;
    }

    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    dragging.players.forEach((player, idx) => {
        player.x = mx + dragging.offsets[idx].x;
        player.y = my + dragging.offsets[idx].y;

        const coord = pixelToCoord(player.x, player.y);
        updateInputsForPlayer(player.id, coord);
    });

    redraw();
});

canvas.addEventListener('mouseup', (event) => {
    dragging = null;
    if (recordState.recording) {
        recordMousePosition(event.clientX, event.clientY);
    }
});

canvas.addEventListener('mouseleave', () => {
    dragging = null;
    if (recordState.recording) {
        stopRecording();
    }
});

// Duplo clique → abre modal de edição de label
canvas.addEventListener('dblclick', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    const clicked = players.find(p => {
        const dx = mx - p.x;
        const dy = my - p.y;
        return Math.sqrt(dx * dx + dy * dy) <= 10;
    });

    if (clicked) {
        event.preventDefault();
        showEditLabelModal(clicked.id);
    }
});

// ── Gallery ───────────────────────────────────────────────────────────────────

async function openGallery() {
    const modal = document.getElementById('galleryModal');
    const body  = document.getElementById('galleryBody');

    modal.style.display = 'flex';
    body.innerHTML = '<p style="opacity:0.5; text-align:center;">Carregando...</p>';

    try {
        const res = await fetch('playbook/manifest.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const manifest = await res.json();

        body.innerHTML = manifest.categories.map(cat => `
            <div class="gallery-category">
                <div class="gallery-category-name">${cat.name}</div>
                <div class="gallery-plays">
                    ${cat.files.map(f =>
                        `<button type="button" data-path="${f.path}">${f.label}</button>`
                    ).join('')}
                </div>
            </div>
        `).join('');

        body.querySelectorAll('.gallery-plays button').forEach(btn => {
            btn.addEventListener('click', () => loadFromUrl(btn.dataset.path));
        });
    } catch (e) {
        body.innerHTML = '<p style="color:#ff6b6b; text-align:center;">Erro ao carregar galeria.<br>Verifique se o arquivo playbook/manifest.json existe.</p>';
    }
}

async function loadFromUrl(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        loadFormation(data);
        document.getElementById('galleryModal').style.display = 'none';
    } catch (e) {
        alert('Erro ao carregar playbook: ' + e.message);
    }
}
