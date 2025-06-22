// --- Main Game Variables and UI Elements ---
const gameArea = document.getElementById("gameArea");
const scoreDisplay = document.getElementById("score");
const communityDisplay = document.getElementById("communityCount");
const levelDisplay = document.getElementById("level");
const startBtn = document.getElementById("startBtn");
const gameOverDisplay = document.getElementById("gameOver");
const speedBtn = document.getElementById("speedBtn");

let score = 0, coins = 0, level = 1;
let communities = [], pollutants = [], towers = [], bullets = [];
let gameInterval, intervalDelay = 300, speedMultiplier = 1, speedLevelIndex = 0;
let maxPollutants = 10, spawnedPollutants = 0;
let communityBaseHealth = 100, towerBaseHealth = 100;
let gameActive = false;
let speedLevels = [1, 10, 100];
let towerStats = { range: 60, power: 100, speed: 1.0, health: 100 };

// --- Coin panel UI ---
const coinPanel = document.createElement("div");
coinPanel.id = "coinPanel";
coinPanel.style.margin = "20px auto";
coinPanel.style.textAlign = "center";
coinPanel.innerHTML = `
  <div style="font-size:18px;margin-bottom:8px;">
    🪙 Coins: <span id="coinCount">0</span>
  </div>
  <button class="btn btn-warning m-1" id="buyPower">+10 Tower Power (10 coins)</button>
  <button class="btn btn-info m-1" id="buyRange">+10 Tower Range (10 coins)</button>
  <button class="btn btn-success m-1" id="buySpeed">+0.2 Tower Speed (10 coins)</button>
  <button class="btn btn-secondary m-1" id="buyHealth">+20 Community Health (10 coins)</button>
  <hr>
  <div class="dropdown d-inline-block">
    <button class="btn btn-outline-dark dropdown-toggle m-1" type="button" id="permDropdown" data-bs-toggle="dropdown" aria-expanded="false">
      Permanent Upgrades
    </button>
    <ul class="dropdown-menu" aria-labelledby="permDropdown" style="min-width:260px;">
      <li><button class="dropdown-item" id="permPower">+5 Power per Level (50 coins)</button></li>
      <li><button class="dropdown-item" id="permSpeed">Halve Tower Speed per Level (50 coins)</button></li>
      <li><button class="dropdown-item" id="permTowers">+3 Towers per Level (50 coins)</button></li>
      <li><button class="dropdown-item" id="permCommunityBuff">Communities gain tower stats (50 coins)</button></li>
      <li><button class="dropdown-item" id="permFullHP">Tower & Community HP = 100 × Level (20 coins)</button></li>
    </ul>
  </div>
`;
document.body.appendChild(coinPanel);

// --- Permanent upgrade flags ---
let permPowerActive = false, permSpeedActive = false, permTowersActive = false, permCommunityBuffActive = false, permFullHPActive = false;

// --- Coin logic ---
function updateCoins() {
  document.getElementById("coinCount").innerText = coins;
}

// --- Coin spend/upgrade logic ---
document.getElementById("buyPower").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.power += 10;
    towers.forEach(tower => tower.el.dataset.power = towerStats.power);
    updateCoins();
  }
};
document.getElementById("buyRange").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.range += 10;
    towers.forEach(tower => tower.el.dataset.range = towerStats.range);
    updateCoins();
  }
};
document.getElementById("buySpeed").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.speed += 0.2;
    towers.forEach(tower => tower.el.dataset.speed = towerStats.speed.toFixed(1));
    if (gameActive) restartGameInterval();
    updateCoins();
  }
};
document.getElementById("buyHealth").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    communityBaseHealth += 20;
    communities.forEach(comm => { if (comm.alive) comm.health += 20; comm.el.dataset.health = comm.health; });
    updateCoins();
  }
};

// --- Permanent upgrades ---
document.getElementById("permPower").onclick = function () {
  if (!permPowerActive && coins >= 50) { coins -= 50; permPowerActive = true; this.disabled = true; updateCoins(); }
};
document.getElementById("permSpeed").onclick = function () {
  if (!permSpeedActive && coins >= 50) { coins -= 50; permSpeedActive = true; this.disabled = true; updateCoins(); }
};
document.getElementById("permTowers").onclick = function () {
  if (!permTowersActive && coins >= 50) { coins -= 50; permTowersActive = true; this.disabled = true; updateCoins(); }
};
document.getElementById("permCommunityBuff").onclick = function () {
  if (!permCommunityBuffActive && coins >= 50) {
    coins -= 50; permCommunityBuffActive = true; this.disabled = true; updateCoins();
    communities.forEach(comm => { comm.hasTowerStats = true; });
  }
};
document.getElementById("permFullHP").onclick = function () {
  if (!permFullHPActive && coins >= 20) {
    coins -= 20; permFullHPActive = true; this.disabled = true; updateCoins();
    towers.forEach(tower => { tower.health = 100 * level; tower.el.dataset.health = tower.health; });
    communities.forEach(comm => { comm.health = 100 * level; comm.el.dataset.health = comm.health; });
    towerBaseHealth = 100 * level; communityBaseHealth = 100 * level;
  }
};

// --- Speed Button ---
speedBtn.addEventListener("click", () => {
  speedLevelIndex = (speedLevelIndex + 1) % speedLevels.length;
  speedMultiplier = speedLevels[speedLevelIndex];
  speedBtn.textContent = `Speed x${speedMultiplier}`;
  if (gameActive) restartGameInterval();
});

// --- Start Button ---
startBtn.addEventListener("click", startGame);

// --- Game Loop Interval ---
function restartGameInterval() {
  clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (spawnedPollutants < maxPollutants) createPollutant();
    updateGame();
  }, intervalDelay / (towerStats.speed * speedMultiplier));
}

// --- Utility Functions ---
function isOverlapping(x, y, size, arr, arrSize) {
  return arr.some(obj => {
    const dx = obj.x - x, dy = obj.y - y, dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (size / 2 + arrSize / 2 + 10);
  });
}

// --- Tooltip that follows mouse ---
function attachTooltipFollow(div, getHTML) {
  let tooltip = null;
  function mousemoveHandler(e) {
    if (tooltip) {
      tooltip.style.left = (e.pageX + 20) + "px";
      tooltip.style.top = (e.pageY + 10) + "px";
    }
  }
  div.addEventListener("mouseenter", function (e) {
    tooltip = document.createElement("div");
    tooltip.className = "pollutant-tooltip";
    tooltip.innerHTML = getHTML();
    document.body.appendChild(tooltip);
    mousemoveHandler(e);
    div._tooltip = tooltip;
    div.addEventListener("mousemove", mousemoveHandler);
  });
  div.addEventListener("mousemove", mousemoveHandler);
  div.addEventListener("mouseleave", function () {
    if (tooltip) tooltip.remove();
    tooltip = null;
    div.removeEventListener("mousemove", mousemoveHandler);
    div._tooltip = null;
  });
}

// --- Utility to create/update an HP bar ---
function setHpBar(parentDiv, hp, maxHp) {
  let bar = parentDiv.querySelector('.hp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'hp-bar';
    bar.style.position = 'absolute';
    bar.style.left = '0';
    bar.style.bottom = '-8px';
    bar.style.width = '100%';
    bar.style.height = '6px';
    bar.style.background = '#eee';
    bar.style.borderRadius = '3px';
    bar.style.overflow = 'hidden';
    let fill = document.createElement('div');
    fill.className = 'hp-bar-fill';
    fill.style.height = '100%';
    fill.style.background = '#4caf50';
    fill.style.width = '100%';
    bar.appendChild(fill);
    parentDiv.appendChild(bar);
  }
  let fill = bar.querySelector('.hp-bar-fill');
  let percent = Math.max(0, Math.min(1, hp / maxHp));
  fill.style.width = (percent * 100) + '%';
  fill.style.background = percent > 0.5 ? '#4caf50' : (percent > 0.2 ? '#ffc107' : '#f44336');
}

// --- Create Community ---
function createCommunity(x, y) {
  const minX = 0, minY = 0, maxX = gameArea.clientWidth - 40, maxY = gameArea.clientHeight - 40;
  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));
  if (isOverlapping(x, y, 40, towers, 30) || isOverlapping(x, y, 40, communities, 40)) return;
  const div = document.createElement("div");
  div.classList.add("entity", "community");
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.dataset.health = communityBaseHealth;
  div.dataset.type = "Community";
  // Use image for community
  const img = document.createElement("img");
  img.src = "img/community.png";
  img.alt = "Community";
  img.style.width = "40px";
  img.style.height = "40px";
  div.appendChild(img);
  let commObj = { el: div, x, y, alive: true, health: communityBaseHealth };
  if (permCommunityBuffActive) commObj.hasTowerStats = true;
  attachTooltipFollow(div, () => {
    let html = `<strong>Community</strong><br>Health: ${commObj.health}`;
    if (commObj.hasTowerStats) html += `<br>Power: ${towerStats.power}<br>Speed: ${towerStats.speed.toFixed(1)}<br>Range: ${towerStats.range}`;
    return html;
  });
  setHpBar(div, commObj.health, communityBaseHealth);
  gameArea.appendChild(div);
  communities.push(commObj);
}

// --- Create Tower ---
function createTower(x, y) {
  const minX = 0, minY = 0, maxX = gameArea.clientWidth - 30, maxY = gameArea.clientHeight - 30;
  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));
  if (isOverlapping(x, y, 30, communities, 40) || isOverlapping(x, y, 30, towers, 30)) return;
  const div = document.createElement("div");
  div.classList.add("entity", "tower");
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.dataset.health = towerBaseHealth;
  div.dataset.power = towerStats.power;
  div.dataset.speed = towerStats.speed.toFixed(1);
  div.dataset.range = towerStats.range;
  div.dataset.type = "Tower";
  // Use image for tower
  const img = document.createElement("img");
  img.src = "img/water-can-transparent.png";
  img.alt = "Tower";
  img.style.width = "30px";
  img.style.height = "30px";
  div.appendChild(img);
  let towerObj = { el: div, x, y, cooldown: 0, health: towerBaseHealth };
  attachTooltipFollow(div, () => `
    <strong>Tower</strong><br>
    Health: ${towerObj.health}<br>
    Power: ${div.dataset.power}<br>
    Speed: ${div.dataset.speed}<br>
    Range: ${div.dataset.range}
  `);
  setHpBar(div, towerObj.health, towerBaseHealth);
  gameArea.appendChild(div);
  towers.push(towerObj);
}

// --- Create Tower Around Community ---
function createTowerAroundCommunity(community, minDist = 50, maxDist = 90, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = community.x + 20 + Math.cos(angle) * dist;
    const y = community.y + 20 + Math.sin(angle) * dist;
    const minX = 0, minY = 0, maxX = gameArea.clientWidth - 30, maxY = gameArea.clientHeight - 30;
    const tx = Math.max(minX, Math.min(x, maxX));
    const ty = Math.max(minY, Math.min(y, maxY));
    if (!isOverlapping(tx, ty, 30, towers, 30) && !isOverlapping(tx, ty, 30, communities, 40)) {
      createTower(tx, ty);
      return true;
    }
  }
  return false;
}

// --- Create Pollutant ---
function createPollutant() {
  if (spawnedPollutants >= maxPollutants || communities.length === 0) return;
  const edge = Math.floor(Math.random() * 4);
  let startX, startY;
  if (edge === 0) { startX = Math.random() * (gameArea.clientWidth - 30); startY = 0; }
  else if (edge === 1) { startX = gameArea.clientWidth - 30; startY = Math.random() * (gameArea.clientHeight - 30); }
  else if (edge === 2) { startX = Math.random() * (gameArea.clientWidth - 30); startY = gameArea.clientHeight - 30; }
  else { startX = 0; startY = Math.random() * (gameArea.clientHeight - 30); }
  let hp = 50 + (level * 10), speed = 1 + level * 0.2, power = 50 + (level * 10);
  const div = document.createElement("div");
  div.classList.add("entity", "pollutant");
  div.style.left = `${startX}px`;
  div.style.top = `${startY}px`;
  div.dataset.hp = hp;
  div.dataset.speed = speed.toFixed(1);
  div.dataset.power = power;
  div.dataset.level = level;
  // Use image for pollutant
  const img = document.createElement("img");
  img.src = "img/pollution.png";
  img.alt = "Pollutant";
  img.style.width = "30px";
  img.style.height = "30px";
  div.appendChild(img);
  let pollutantObj = { el: div, x: startX, y: startY, speed, hp, power };
  attachTooltipFollow(div, () => `
    <strong>Pollutant</strong><br>
    HP: ${pollutantObj.hp}<br>
    Speed: ${pollutantObj.speed.toFixed(1)}<br>
    Power: ${pollutantObj.power}<br>
    Level: ${level}
  `);
  setHpBar(div, pollutantObj.hp, hp);
  gameArea.appendChild(div);
  pollutants.push(pollutantObj);
  spawnedPollutants++;
}

// --- Create Bullet ---
function createBullet(x, y, target, power) {
  const bullet = document.createElement("div");
  bullet.className = "bullet";
  bullet.style.position = "absolute";
  bullet.style.width = "14px";
  bullet.style.height = "14px";
  bullet.style.borderRadius = "50%";
  bullet.style.background = palette.darkBlue;
  bullet.style.border = `2px solid ${palette.yellow}`;
  bullet.style.boxShadow = `0 0 12px 4px ${palette.yellow}`;
  bullet.style.left = `${x + 8}px`; // center bullet on tower (tower is 30x30)
  bullet.style.top = `${y + 8}px`;
  bullet.style.zIndex = "20";
  bullet.style.pointerEvents = "none";
  bullet.style.transition = "left 0.05s linear, top 0.05s linear";
  gameArea.appendChild(bullet);

  bullets.push({
    el: bullet,
    x: x + 8,
    y: y + 8,
    target: target,
    power: power
  });
}

// (Make sure your towers call createBullet as in your updateGame loop.)
// The bullet CSS is already included in your code and will make bullets visible.

// --- Main Game Loop ---
function updateGame() {
  let pollutantsToRemove = [];
  // --- Pollutant merging logic ---
  for (let i = 0; i < pollutants.length; i++) {
    for (let j = i + 1; j < pollutants.length; j++) {
      const p1 = pollutants[i], p2 = pollutants[j];
      const dx = p1.x - p2.x, dy = p1.y - p2.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30) {
        p1.hp += p2.hp; p1.power += p2.power; p1.speed = Math.max(0.5, p1.speed / 2);
        p1.coinValue = (p1.coinValue || 5) + (p2.coinValue || 5) + 5;
        p1.el.dataset.hp = p1.hp; p1.el.dataset.power = p1.power; p1.el.dataset.speed = p1.speed.toFixed(1);
        setHpBar(p1.el, p1.hp, p1.hp);
        if (p2.el._tooltip) { p2.el._tooltip.remove(); p2.el._tooltip = null; }
        if (p2.el.parentNode) gameArea.removeChild(p2.el);
        pollutants.splice(j, 1); j--;
      }
    }
  }

  pollutants.forEach((pollutant, pIdx) => {
    let targetTower = null, minTowerDist = Infinity;
    towers.forEach(tower => {
      if (tower.health <= 0) return;
      const dx = tower.x - pollutant.x, dy = tower.y - pollutant.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minTowerDist) { minTowerDist = dist; targetTower = tower; }
    });

    let target = null;
    if (targetTower) { target = targetTower; target.type = "tower"; }
    else {
      let targetCommunity = null, minCommDist = Infinity;
      communities.forEach(comm => {
        if (!comm.alive) return;
        const dx = comm.x - pollutant.x, dy = comm.y - pollutant.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minCommDist) { minCommDist = dist; targetCommunity = comm; }
      });
      if (!targetCommunity) return;
      target = targetCommunity; target.type = "community";
    }

    const dx = target.x - pollutant.x, dy = target.y - pollutant.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) {
      if (target.type === "tower") {
        target.health -= 50;
        setHpBar(target.el, target.health, towerBaseHealth);
        if (target.health <= 0) {
          gameArea.removeChild(target.el);
          towers = towers.filter(t => t !== target);
          score = Math.max(0, score - 100);
          scoreDisplay.innerText = score;
        }
      } else if (target.type === "community") {
        target.health -= 50;
        setHpBar(target.el, target.health, communityBaseHealth);
        if (target.health <= 0) {
          target.alive = false;
          gameArea.removeChild(target.el);
          score = Math.max(0, score - 1000);
          scoreDisplay.innerText = score;
        }
      }
      pollutantsToRemove.push(pIdx);
    } else {
      pollutant.x += (dx / dist) * pollutant.speed;
      pollutant.y += (dy / dist) * pollutant.speed;
      pollutant.el.style.left = `${pollutant.x}px`;
      pollutant.el.style.top = `${pollutant.y}px`;
    }
  });

  pollutantsToRemove.reverse().forEach(idx => {
    if (pollutants[idx]) {
      let coinValue = pollutants[idx].coinValue || 5;
      gameArea.removeChild(pollutants[idx].el);
      pollutants.splice(idx, 1);
      coins += coinValue;
      scoreDisplay.innerText = score;
      updateCoins();
    }
  });

  towers.forEach(tower => {
    if (tower.health <= 0) return;
    if (tower.cooldown > 0) { tower.cooldown--; return; }
    let target = null, minDist = Infinity;
    pollutants.forEach((pollutant, idx) => {
      const dx = tower.x - pollutant.x, dy = tower.y - pollutant.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < towerStats.range && dist < minDist) { minDist = dist; target = { pollutant, idx }; }
    });
    if (target) {
      createBullet(tower.x, tower.y, target.pollutant, towerStats.power); // Use towerStats.power for bullet damage
      tower.cooldown = Math.max(1, Math.floor(30 / towerStats.speed));
    }
  });

  let bulletsToRemove = [];
  bullets.forEach((bullet, bIdx) => {
    if (!bullet.target || !pollutants.includes(bullet.target)) {
      if (bullet.el.parentNode) bullet.el.parentNode.removeChild(bullet.el);
      bulletsToRemove.push(bIdx);
      return;
    }
    const dx = bullet.target.x - bullet.x, dy = bullet.target.y - bullet.y, dist = Math.sqrt(dx * dx + dy * dy), speed = 8;
    if (dist < 10) {
      // Make damage equal to the current power value of the tower that fired the bullet
      // If you store tower reference in bullet, use bullet.tower.power, otherwise use bullet.power
      bullet.target.hp -= bullet.power; // bullet.power should be set to towerStats.power when fired
      bullet.target.el.dataset.hp = bullet.target.hp;
      setHpBar(bullet.target.el, bullet.target.hp, 50 + level * 20);
      if (bullet.target.hp <= 0) {
        let idx = pollutants.indexOf(bullet.target);
        if (idx !== -1) {
          let coinValue = bullet.target.coinValue || 5;
          gameArea.removeChild(bullet.target.el);
          pollutants.splice(idx, 1);
          score += 10;
          coins += coinValue;
          scoreDisplay.innerText = score;
          updateCoins();
        }
      }
      if (bullet.el.parentNode) bullet.el.parentNode.removeChild(bullet.el);
      bulletsToRemove.push(bIdx);
    } else {
      bullet.x += (dx / dist) * speed;
      bullet.y += (dy / dist) * speed;
      bullet.el.style.left = `${bullet.x}px`;
      bullet.el.style.top = `${bullet.y}px`;
    }
  });
  bulletsToRemove.reverse().forEach(idx => {
    if (bullets[idx]) {
      if (bullets[idx].el.parentNode) bullets[idx].el.parentNode.removeChild(bullets[idx].el);
      bullets.splice(idx, 1);
    }
  });

  communities = communities.filter(c => c.alive);
  communityDisplay.innerText = communities.length;
  if (communities.length === 0) {
    endGame();
    return;
  }
  if (spawnedPollutants >= maxPollutants && pollutants.length === 0 && bullets.length === 0) {
    clearInterval(gameInterval);
    if (autoNextLevelActive) {
      setTimeout(() => { if (autoNextLevelActive) nextLevel(); }, 800);
    }
  }
}

// --- Game Start/End/Next Level ---
function startGame() {
  gameActive = true;
  startBtn.style.display = "none";
  gameOverDisplay.style.display = "none";
  if (replayBtn) replayBtn.style.display = "none"; // Hide replay button on game start
  score = 0; level = 1; coins = 0;
  scoreDisplay.innerText = score;
  levelDisplay.innerText = level;
  spawnedPollutants = 0; maxPollutants = 10;
  // Apply permanent upgrades at game start
  towerStats = { range: 60, power: 100, speed: 1.0, health: 100 };
  communityBaseHealth = 100; towerBaseHealth = 100;
  if (permPowerActive) towerStats.power += 5 * level;
  if (permSpeedActive) towerStats.speed *= Math.pow(2, level - 1);
  if (permFullHPActive) {
    towerBaseHealth = 100 * level;
    communityBaseHealth = 100 * level;
  }
  communities = []; towers = []; pollutants = []; bullets = [];
  for (let i = 0; i < 3; i++) createCommunity(Math.random() * (gameArea.clientWidth - 40), Math.random() * (gameArea.clientHeight - 40));
  communities.forEach(comm => {
    if (permCommunityBuffActive) comm.hasTowerStats = true;
    createTowerAroundCommunity(comm);
  });
  if (permTowersActive) {
    for (let i = 0; i < 3; i++) {
      let comm = communities[Math.floor(Math.random() * communities.length)];
      if (comm) createTowerAroundCommunity(comm);
    }
  }
  updateCoins();
  restartGameInterval();
}

function endGame() {
  gameActive = false;
  clearInterval(gameInterval);
  gameOverDisplay.style.display = "block";
  if (replayBtn) replayBtn.style.display = "inline-block"; // Show replay button on game over
  showConfetti();
}

function nextLevel() {
  level++;
  levelDisplay.innerText = level;
  spawnedPollutants = 0;
  maxPollutants = level * 5;
  score += 1000;
  scoreDisplay.innerText = score;
  // Show confetti every 10 levels
  if (level % 10 === 0) showConfetti();
  // Apply permanent upgrades at each new level
  if (permPowerActive) towerStats.power += 5;
  if (permSpeedActive) { towerStats.speed *= 2; if (gameActive) restartGameInterval(); }
  if (permTowersActive) {
    for (let i = 0; i < 3; i++) {
      let comm = communities[Math.floor(Math.random() * communities.length)];
      if (comm) createTowerAroundCommunity(comm);
      else createTower(Math.random() * (gameArea.clientWidth - 30), Math.random() * (gameArea.clientHeight - 30));
    }
  }
  if (permFullHPActive) {
    towerBaseHealth = 100 * level;
    communityBaseHealth = 100 * level;
    towers.forEach(tower => { tower.health = towerBaseHealth; tower.el.dataset.health = tower.health; });
    communities.forEach(comm => { comm.health = communityBaseHealth; comm.el.dataset.health = comm.health; });
  }
  let comm = communities[Math.floor(Math.random() * communities.length)];
  if (comm) createTowerAroundCommunity(comm);
  else createTower(Math.random() * (gameArea.clientWidth - 30), Math.random() * (gameArea.clientHeight - 30));
  // Spawn 1 community every 5 levels
  if (level % 5 === 0) {
    createCommunity(Math.random() * (gameArea.clientWidth - 40), Math.random() * (gameArea.clientHeight - 40));
  }
  if (permCommunityBuffActive) communities.forEach(comm => { comm.hasTowerStats = true; });
  restartGameInterval();
}

// --- Auto Next Level always ON and hidden ---
let autoNextLevelActive = true;

// --- Reset Button ---
const resetBtn = document.createElement("button");
resetBtn.textContent = "Reset";
resetBtn.className = "btn btn-danger";
resetBtn.style.marginLeft = "10px";
resetBtn.onclick = function () {
  // Remove all pollutants, towers, communities, bullets, cans, and muds from the screen
  pollutants.forEach(p => p.el && p.el.parentNode && p.el.parentNode.removeChild(p.el));
  towers.forEach(t => t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el));
  communities.forEach(c => c.el && c.el.parentNode && c.el.parentNode.removeChild(c.el));
  bullets.forEach(b => b.el && b.el.parentNode && b.el.parentNode.removeChild(b.el));
  document.querySelectorAll(".can, .mud").forEach(el => el.remove());
  // Now start the game fresh
  startGame();
};
coinPanel.appendChild(resetBtn);

// --- Replay Button logic ---
const replayBtn = document.getElementById("replayBtn");
if (replayBtn) {
  replayBtn.style.display = "none"; // Hide by default

  replayBtn.onclick = function () {
    // Remove all pollutants, towers, communities, bullets, cans, and muds from the screen
    pollutants.forEach(p => p.el && p.el.parentNode && p.el.parentNode.removeChild(p.el));
    towers.forEach(t => t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el));
    communities.forEach(c => c.el && c.el.parentNode && c.el.parentNode.removeChild(c.el));
    bullets.forEach(b => b.el && b.el.parentNode && b.el.parentNode.removeChild(b.el));
    document.querySelectorAll(".can, .mud").forEach(el => el.remove());
    // Start the game fresh
    startGame();
  };
}

// --- Confetti celebration on win or every 10 levels ---
function showConfetti() {
  const confettiContainer = document.createElement("div");
  confettiContainer.style.position = "fixed";
  confettiContainer.style.left = "0";
  confettiContainer.style.top = "0";
  confettiContainer.style.width = "100vw";
  confettiContainer.style.height = "100vh";
  confettiContainer.style.pointerEvents = "none";
  confettiContainer.style.zIndex = "9999";
  document.body.appendChild(confettiContainer);
  for (let i = 0; i < 60; i++) {
    const conf = document.createElement("div");
    conf.textContent = ["💧", "🎉", "✨", "💙", "🟡"][Math.floor(Math.random() * 5)];
    conf.style.position = "absolute";
    conf.style.left = Math.random() * 100 + "vw";
    conf.style.top = "-5vh";
    conf.style.fontSize = (24 + Math.random() * 24) + "px";
    conf.style.transition = "top 2.2s cubic-bezier(.23,1.01,.32,1)";
    confettiContainer.appendChild(conf);
    setTimeout(() => { conf.style.top = (80 + Math.random() * 15) + "vh"; }, 10 + Math.random() * 400);
  }
  setTimeout(() => confettiContainer.remove(), 2500);
}

// --- Responsive font for score ---
scoreDisplay.style.fontSize = "clamp(1.2rem, 2vw, 2.2rem)";
scoreDisplay.style.fontWeight = "bold";
scoreDisplay.style.transition = "color 0.2s";

// --- Charity: water logo and message ---
const logo = document.createElement("img");
logo.src = "img/cw_logo.png"; // Replace with your actual image file name in the img/ folder
logo.alt = "charity: water";
logo.style.height = "40px";
logo.style.margin = "10px";
logo.style.display = "block";
logo.style.marginLeft = "auto";
logo.style.marginRight = "auto";
document.body.insertBefore(logo, document.body.firstChild);

const mission = document.createElement("div");
mission.innerHTML = `<span style="color:#ffd700;font-weight:bold;">Every drop counts!</span> Help keep communities safe and clean.`;
mission.style.textAlign = "center";
mission.style.fontSize = "1.1rem";
mission.style.marginBottom = "10px";
document.body.insertBefore(mission, coinPanel);

// --- Style for cans and muds (add to your CSS or here for demo) ---
const style = document.createElement("style");
style.innerHTML = `
  .can:hover { filter: brightness(1.2) drop-shadow(0 0 8px #ffd700); }
  .mud:hover { filter: brightness(0.8) drop-shadow(0 0 8px #b5651d); }
  @media (max-width: 700px) {
    #gameArea { min-width: 220px !important; min-height: 220px !important; }
    .can, .mud { width: 24px !important; height: 24px !important; }
    #coinPanel { font-size: 0.95rem; }
  }
`;
document.head.appendChild(style);

// --- Interactive "can" elements to collect points ---
function spawnCan() {
  const can = document.createElement("div");
  can.className = "can";
  can.style.position = "absolute";
  can.style.width = "32px";
  can.style.height = "32px";
  can.style.background = "url('https://cdn-icons-png.flaticon.com/512/1046/1046857.png') no-repeat center/contain";
  can.style.left = Math.random() * (gameArea.clientWidth - 32) + "px";
  can.style.top = Math.random() * (gameArea.clientHeight - 32) + "px";
  can.style.cursor = "pointer";
  can.style.transition = "box-shadow 0.2s";
  gameArea.appendChild(can);

  can.onclick = function () {
    score += 15;
    scoreDisplay.innerText = score;
    can.style.boxShadow = "0 0 16px 4px #FFC907";
    can.style.backgroundColor = "#FFE066";
    setTimeout(() => { if (can.parentNode) can.parentNode.removeChild(can); }, 200);
    scoreDisplay.style.color = "#FFC907";
    setTimeout(() => { scoreDisplay.style.color = "#2E9DF7"; }, 300);
  };

  setTimeout(() => { if (can.parentNode) can.parentNode.removeChild(can); }, 7000);
}
setInterval(() => { if (gameActive) spawnCan(); }, 8000 + Math.random() * 7000);

// --- Obstacle: "mud puddle" that reduces score ---
function spawnMud() {
  const mud = document.createElement("div");
  mud.className = "mud";
  mud.style.position = "absolute";
  mud.style.width = "36px";
  mud.style.height = "36px";
  mud.style.background = "url('https://cdn-icons-png.flaticon.com/512/616/616494.png') no-repeat center/contain";
  mud.style.left = Math.random() * (gameArea.clientWidth - 36) + "px";
  mud.style.top = Math.random() * (gameArea.clientHeight - 36) + "px";
  mud.style.cursor = "pointer";
  mud.style.opacity = "0.85";
  gameArea.appendChild(mud);

  mud.onclick = function () {
    score = Math.max(0, score - 10);
    scoreDisplay.innerText = score;
    mud.style.boxShadow = "0 0 16px 4px #F5402C";
    mud.style.backgroundColor = "#F5402C";
    setTimeout(() => { if (mud.parentNode) mud.parentNode.removeChild(mud); }, 200);
    scoreDisplay.style.color = "#F5402C";
    setTimeout(() => { scoreDisplay.style.color = "#2E9DF7"; }, 300);
  };

  setTimeout(() => { if (mud.parentNode) mud.parentNode.removeChild(mud); }, 6000);
}
setInterval(() => { if (gameActive) spawnMud(); }, 12000 + Math.random() * 8000);

// --- Color palette from image ---
const palette = {
  yellow: "#FFC907",
  darkBlue: "#003366",
  blue: "#77A8BB",
  lightYellow: "#FFF7E1",
  black: "#1A1A1A",
  peach: "#FED8C1",
  brown: "#BF6C46",
  lightGray: "#CBCCD1"
};

// --- Responsive Layout & Brand Colors ---
document.body.style.background = palette.lightYellow;
document.body.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
if (typeof gameArea !== "undefined") {
  gameArea.style.background = palette.blue;
  gameArea.style.border = `4px solid ${palette.darkBlue}`;
  gameArea.style.borderRadius = "18px";
  gameArea.style.boxShadow = `0 4px 24px ${palette.lightGray}`;
  gameArea.style.width = "90vw";
  gameArea.style.maxWidth = "900px";
  gameArea.style.height = "60vw";
  gameArea.style.maxHeight = "600px";
  gameArea.style.minHeight = "350px";
  gameArea.style.minWidth = "350px";
  gameArea.style.margin = "auto";
  gameArea.style.position = "relative";
  gameArea.style.overflow = "hidden";
}
if (typeof coinPanel !== "undefined") {
  coinPanel.style.background = palette.lightYellow;
  coinPanel.style.border = `2px solid ${palette.yellow}`;
  coinPanel.style.borderRadius = "12px";
  coinPanel.style.boxShadow = `0 2px 12px ${palette.lightGray}`;
  coinPanel.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
  coinPanel.style.maxWidth = "900px";
  coinPanel.style.margin = "20px auto";
  coinPanel.style.width = "90vw";
}
if (typeof scoreDisplay !== "undefined") {
  scoreDisplay.style.color = palette.darkBlue;
  scoreDisplay.style.fontWeight = "bold";
}
if (typeof levelDisplay !== "undefined") {
  levelDisplay.style.color = palette.yellow;
  levelDisplay.style.fontWeight = "bold";
}
document.querySelectorAll("button").forEach(btn => {
  btn.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
  btn.style.fontWeight = "bold";
  btn.style.borderRadius = "8px";
  btn.style.background = palette.yellow;
  btn.style.color = palette.black;
  btn.style.border = `2px solid ${palette.darkBlue}`;
});
const permDropdownBtn = document.getElementById("permDropdown");
if (permDropdownBtn) {
  permDropdownBtn.style.background = palette.yellow;
  permDropdownBtn.style.color = palette.black;
}
const styleBrand = document.createElement("style");
styleBrand.innerHTML = `
  .can:hover { filter: brightness(1.2) drop-shadow(0 0 8px ${palette.yellow}); }
  .mud:hover { filter: brightness(0.8) drop-shadow(0 0 8px ${palette.brown}); }
  .can, .mud { border-radius: 50%; border: 2px solid ${palette.yellow}; }
  #coinPanel { box-shadow: 0 2px 12px ${palette.lightGray}; }
  .can { background-color: ${palette.peach} !important; }
  .mud { background-color: ${palette.brown} !important; }
  #gameOver, #score, #level { color: ${palette.darkBlue} !important; }
  @media (max-width: 700px) {
    #gameArea { min-width: 220px !important; min-height: 220px !important; width: 98vw !important; height: 60vw !important; }
    .can, .mud { width: 24px !important; height: 24px !important; }
    #coinPanel { font-size: 0.95rem; width: 98vw !important; }
  }
`;
document.head.appendChild(styleBrand);

// --- Add bullet CSS for visibility ---
const bulletStyle = document.createElement("style");
bulletStyle.innerHTML = `
  .bullet {
    transition: left 0.05s linear, top 0.05s linear;
    border: 2px solid ${palette.yellow};
    box-sizing: border-box;
    background: ${palette.darkBlue};
    box-shadow: 0 0 8px ${palette.yellow};
  }
`;
document.head.appendChild(bulletStyle);