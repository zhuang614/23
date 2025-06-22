const gameArea = document.getElementById("gameArea");
const scoreDisplay = document.getElementById("score");
const communityDisplay = document.getElementById("communityCount");
const levelDisplay = document.getElementById("level");
const startBtn = document.getElementById("startBtn");
const gameOverDisplay = document.getElementById("gameOver");
const speedBtn = document.getElementById("speedBtn");

let score = 0;
let coins = 0;
let communities = [];
let pollutants = [];
let towers = [];
let level = 1;
let gameInterval;
let intervalDelay = 300;
let speedMultiplier = 1;
let maxPollutants = 10;
let spawnedPollutants = 0;
let towerStats = {
  range: 60,
  power: 100,
  speed: 1.0,
  health: 100
};
let gameActive = false;
let speedLevels = [1, 10, 100];
let speedLevelIndex = 0;
let bullets = [];
let communityBaseHealth = 100;
let towerBaseHealth = 100;

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
let permPowerActive = false;
let permSpeedActive = false;
let permTowersActive = false;
let permCommunityBuffActive = false;
let permFullHPActive = false;

// --- Coin logic ---
function updateCoins() {
  document.getElementById("coinCount").innerText = coins;
}

// Coin spend/upgrade logic
document.getElementById("buyPower").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.power += 10;
    // Apply to all existing towers immediately
    towers.forEach(tower => {
      tower.el.dataset.power = towerStats.power;
    });
    updateCoins();
  }
};
document.getElementById("buyRange").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.range += 10;
    // Apply to all existing towers immediately
    towers.forEach(tower => {
      tower.el.dataset.range = towerStats.range;
    });
    updateCoins();
  }
};
document.getElementById("buySpeed").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    towerStats.speed += 0.2;
    // Apply to all existing towers immediately
    towers.forEach(tower => {
      tower.el.dataset.speed = towerStats.speed.toFixed(1);
    });
    if (gameActive) restartGameInterval();
    updateCoins();
  }
};
document.getElementById("buyHealth").onclick = function () {
  if (coins >= 10) {
    coins -= 10;
    communityBaseHealth += 20;
    // Apply to all existing communities immediately
    communities.forEach(comm => {
      if (comm.alive) {
        comm.health += 20;
        comm.el.dataset.health = comm.health;
      }
    });
    updateCoins();
  }
};

// Permanent upgrades
document.getElementById("permPower").onclick = function () {
  if (!permPowerActive && coins >= 50) {
    coins -= 50;
    permPowerActive = true;
    this.disabled = true;
    updateCoins();
  }
};
document.getElementById("permSpeed").onclick = function () {
  if (!permSpeedActive && coins >= 50) {
    coins -= 50;
    permSpeedActive = true;
    this.disabled = true;
    updateCoins();
  }
};
document.getElementById("permTowers").onclick = function () {
  if (!permTowersActive && coins >= 50) {
    coins -= 50;
    permTowersActive = true;
    this.disabled = true;
    updateCoins();
  }
};
document.getElementById("permCommunityBuff").onclick = function () {
  if (!permCommunityBuffActive && coins >= 50) {
    coins -= 50;
    permCommunityBuffActive = true;
    this.disabled = true;
    updateCoins();
    // Apply immediately to all existing communities
    communities.forEach(comm => {
      comm.hasTowerStats = true;
    });
  }
};
document.getElementById("permFullHP").onclick = function () {
  if (!permFullHPActive && coins >= 20) {
    coins -= 20;
    permFullHPActive = true;
    this.disabled = true;
    updateCoins();
    // Set all current towers and communities HP to 100 * level
    towers.forEach(tower => {
      tower.health = 100 * level;
      tower.el.dataset.health = tower.health;
    });
    communities.forEach(comm => {
      comm.health = 100 * level;
      comm.el.dataset.health = comm.health;
    });
    // Also set base health for new ones
    towerBaseHealth = 100 * level;
    communityBaseHealth = 100 * level;
  }
};

speedBtn.addEventListener("click", () => {
  speedLevelIndex = (speedLevelIndex + 1) % speedLevels.length;
  speedMultiplier = speedLevels[speedLevelIndex];
  speedBtn.textContent = `Speed x${speedMultiplier}`;
  if (gameActive) restartGameInterval();
});

startBtn.addEventListener("click", startGame);

function restartGameInterval() {
  clearInterval(gameInterval);
  gameInterval = setInterval(() => {
    if (spawnedPollutants < maxPollutants) {
      createPollutant();
    }
    updateGame();
  }, intervalDelay / (towerStats.speed * speedMultiplier));
}

function isOverlapping(x, y, size, arr, arrSize) {
  return arr.some(obj => {
    const dx = obj.x - x;
    const dy = obj.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (size / 2 + arrSize / 2 + 10);
  });
}

// Tooltip that follows mouse
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
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
    div.removeEventListener("mousemove", mousemoveHandler);
    div._tooltip = null;
  });
}

// Utility to create/update an HP bar
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

// --- Update createCommunity ---
function createCommunity(x, y) {
  // Ensure spawn within gameArea bounds (blue area)
  const areaRect = gameArea.getBoundingClientRect();
  const minX = 0;
  const minY = 0;
  const maxX = gameArea.clientWidth - 40; // community width
  const maxY = gameArea.clientHeight - 40; // community height
  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));

  if (isOverlapping(x, y, 40, towers, 30)) return;
  if (isOverlapping(x, y, 40, communities, 40)) return;
  const div = document.createElement("div");
  div.classList.add("entity", "community");
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.dataset.health = communityBaseHealth;
  div.dataset.type = "Community";
  let commObj = { el: div, x, y, alive: true, health: communityBaseHealth };
  if (permCommunityBuffActive) commObj.hasTowerStats = true;
  attachTooltipFollow(div, () => {
    let html = `<strong>Community</strong><br>Health: ${commObj.health}`;
    if (commObj.hasTowerStats) {
      html += `<br>Power: ${towerStats.power}<br>Speed: ${towerStats.speed.toFixed(1)}<br>Range: ${towerStats.range}`;
    }
    return html;
  });
  setHpBar(div, commObj.health, communityBaseHealth);
  gameArea.appendChild(div);
  communities.push(commObj);
}

// --- Update createTower ---
function createTower(x, y) {
  // Ensure spawn within gameArea bounds (blue area)
  const areaRect = gameArea.getBoundingClientRect();
  const minX = 0;
  const minY = 0;
  const maxX = gameArea.clientWidth - 30; // tower width
  const maxY = gameArea.clientHeight - 30; // tower height
  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));

  if (isOverlapping(x, y, 30, communities, 40)) return;
  if (isOverlapping(x, y, 30, towers, 30)) return;
  const div = document.createElement("div");
  div.classList.add("entity", "tower");
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.dataset.health = towerBaseHealth;
  div.dataset.power = towerStats.power;
  div.dataset.speed = towerStats.speed.toFixed(1);
  div.dataset.range = towerStats.range;
  div.dataset.type = "Tower";
  attachTooltipFollow(div, () => `
    <strong>Tower</strong><br>
    Health: ${towerObj.health}<br>
    Power: ${div.dataset.power}<br>
    Speed: ${div.dataset.speed}<br>
    Range: ${div.dataset.range}
  `);
  let towerObj = { el: div, x, y, cooldown: 0, health: towerBaseHealth };
  setHpBar(div, towerObj.health, towerBaseHealth);
  gameArea.appendChild(div);
  towers.push(towerObj);
}

// --- Pollutant spawn on random edge ---
function createPollutant() {
  if (spawnedPollutants >= maxPollutants || communities.length === 0) return;

  // Random edge: 0=top, 1=right, 2=bottom, 3=left
  const edge = Math.floor(Math.random() * 4);
  let startX, startY;
  if (edge === 0) { // top
    startX = Math.random() * (gameArea.clientWidth - 30);
    startY = 0;
  } else if (edge === 1) { // right
    startX = gameArea.clientWidth - 30;
    startY = Math.random() * (gameArea.clientHeight - 30);
  } else if (edge === 2) { // bottom
    startX = Math.random() * (gameArea.clientWidth - 30);
    startY = gameArea.clientHeight - 30;
  } else { // left
    startX = 0;
    startY = Math.random() * (gameArea.clientHeight - 30);
  }

  // Increase pollutant hp and power by 10 times level
  let hp = 50 + (level * 10 * 1); // base 50, +10*level
  let speed = 1 + level * 0.2;
  let power = 50 + (level * 10 * 1); // base 50, +10*level

  const div = document.createElement("div");
  div.classList.add("entity", "pollutant");
  div.style.left = `${startX}px`;
  div.style.top = `${startY}px`;
  div.dataset.hp = hp;
  div.dataset.speed = speed.toFixed(1);
  div.dataset.power = power;
  div.dataset.level = level;
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

function updateGame() {
  let pollutantsToRemove = [];
  // --- Pollutant merging logic ---
  for (let i = 0; i < pollutants.length; i++) {
    for (let j = i + 1; j < pollutants.length; j++) {
      const p1 = pollutants[i];
      const p2 = pollutants[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30) { // If overlapping (both are 30px wide)
        // Merge p2 into p1: sum hp and power, halve speed
        p1.hp += p2.hp;
        p1.power += p2.power;
        p1.speed = Math.max(0.5, p1.speed / 2); // Prevent speed from going to zero
        // Track coin value for merged pollutant
        p1.coinValue = (p1.coinValue || 5) + (p2.coinValue || 5) + 5;
        // Update dataset for tooltip
        p1.el.dataset.hp = p1.hp;
        p1.el.dataset.power = p1.power;
        p1.el.dataset.speed = p1.speed.toFixed(1);
        setHpBar(p1.el, p1.hp, p1.hp); // merged pollutant's max HP is its new HP
        // Remove lingering tooltip for p2 if present
        if (p2.el._tooltip) {
          p2.el._tooltip.remove();
          p2.el._tooltip = null;
        }
        // Remove p2 from DOM and array
        if (p2.el.parentNode) gameArea.removeChild(p2.el);
        pollutants.splice(j, 1);
        j--; // Stay at same index for next loop
      }
    }
  }

  pollutants.forEach((pollutant, pIdx) => {
    // Find the closest alive tower
    let targetTower = null;
    let minTowerDist = Infinity;
    towers.forEach(tower => {
      if (tower.health <= 0) return;
      const dx = tower.x - pollutant.x;
      const dy = tower.y - pollutant.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minTowerDist) {
        minTowerDist = dist;
        targetTower = tower;
      }
    });

    let target = null;

    if (targetTower) {
      target = targetTower;
      target.type = "tower";
    } else {
      // No towers left, head to closest community
      let targetCommunity = null;
      let minCommDist = Infinity;
      communities.forEach(comm => {
        if (!comm.alive) return;
        const dx = comm.x - pollutant.x;
        const dy = comm.y - pollutant.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minCommDist) {
          minCommDist = dist;
          targetCommunity = comm;
        }
      });
      if (!targetCommunity) return; // No communities left
      target = targetCommunity;
      target.type = "community";
    }

    // Move towards the target (tower or community)
    const dx = target.x - pollutant.x;
    const dy = target.y - pollutant.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) {
      if (target.type === "tower") {
        target.health -= 50;
        setHpBar(target.el, target.health, towerBaseHealth);
        if (target.health <= 0) {
          gameArea.removeChild(target.el);
          towers = towers.filter(t => t !== target);
          score = Math.max(0, score - 100); // -100 for tower destroyed
          scoreDisplay.innerText = score;
        }
      } else if (target.type === "community") {
        target.health -= 50;
        setHpBar(target.el, target.health, communityBaseHealth);
        if (target.health <= 0) {
          target.alive = false;
          gameArea.removeChild(target.el);
          score = Math.max(0, score - 1000); // -1000 for community destroyed
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
  // --- When a pollutant is killed, drop its coin value ---
  pollutantsToRemove.reverse().forEach(idx => {
    if (pollutants[idx]) {
      let coinValue = pollutants[idx].coinValue || 5;
      // Check if the pollutant died due to a community (not by bullet/tower)
      // If so, do NOT increase score
      // We'll check if the pollutant is close to a community and that community just lost health
      // But the easiest way is to only add score if the pollutant was killed by a bullet (handled in bullet logic)
      // So here, do NOT add score for pollutants removed by community/tower collision
      gameArea.removeChild(pollutants[idx].el);
      pollutants.splice(idx, 1);
      // Do NOT add: score += 100;
      coins += coinValue;
      scoreDisplay.innerText = score;
      updateCoins();
    }
  });
  towers.forEach(tower => {
    if (tower.health <= 0) return;
    if (tower.cooldown > 0) {
      tower.cooldown--;
      return;
    }
    let target = null;
    let minDist = Infinity;
    pollutants.forEach((pollutant, idx) => {
      const dx = tower.x - pollutant.x;
      const dy = tower.y - pollutant.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < towerStats.range && dist < minDist) {
        minDist = dist;
        target = { pollutant, idx };
      }
    });
    if (target) {
      createBullet(tower.x, tower.y, target.pollutant, towerStats.power);
      tower.cooldown = Math.max(1, Math.floor(30 / towerStats.speed));
    }
  });
  let bulletsToRemove = [];
  bullets.forEach((bullet, bIdx) => {
    if (!bullet.target || !pollutants.includes(bullet.target)) {
      gameArea.removeChild(bullet.el);
      bulletsToRemove.push(bIdx);
      return;
    }
    const dx = bullet.target.x - bullet.x;
    const dy = bullet.target.y - bullet.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 8;
    if (dist < 10) {
      bullet.target.hp -= bullet.power;
      bullet.target.el.dataset.hp = bullet.target.hp;
      setHpBar(bullet.target.el, bullet.target.hp, 50 + level * 20); // or use bullet.target.hp before damage as maxHp if you want dynamic bars
      // --- Also update bullet kill logic ---
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
      gameArea.removeChild(bullet.el);
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
      if (bullets[idx].el.parentNode) gameArea.removeChild(bullets[idx].el);
      bullets.splice(idx, 1);
    }
  });
  communities = communities.filter(c => c.alive);
  communityDisplay.innerText = communities.length;
  if (communities.length === 0) {
    endGame(); // End the game when all communities are destroyed
    return;
  }
  if (spawnedPollutants >= maxPollutants && pollutants.length === 0 && bullets.length === 0) {
    clearInterval(gameInterval);
    if (autoNextLevelActive) {
      setTimeout(() => {
        if (autoNextLevelActive) nextLevel();
      }, 800); // short delay for clarity
    } else {
      nextLevelBtn.style.display = "block";
    }
  }
}

function startGame() {
  gameActive = true;
  startBtn.style.display = "none";
  gameOverDisplay.style.display = "none";
  score = 0;
  level = 1;
  scoreDisplay.innerText = score;
  levelDisplay.innerText = level;
  spawnedPollutants = 0;
  maxPollutants = 10;
  coins = 0;
  updateCoins();
  towerStats.range = 60;
  towerStats.power = 100;
  towerStats.speed = 1.0;
  towerStats.health = 100;
  communityBaseHealth = 100;
  towerBaseHealth = 100;
  communities = [];
  towers = [];
  pollutants = [];
  bullets = [];
  // Spawn 3 communities at random positions
  for (let i = 0; i < 3; i++) {
    createCommunity(
      Math.random() * (gameArea.clientWidth - 40),
      Math.random() * (gameArea.clientHeight - 40)
    );
  }
  // Spawn 3 towers around those communities
  communities.forEach(comm => createTowerAroundCommunity(comm));
  restartGameInterval();
}

function endGame() {
  gameActive = false;
  clearInterval(gameInterval);
  gameOverDisplay.style.display = "block";
  showConfetti();
}

function resetGame() {
  startGame();
}

function nextLevel() {
  level++;
  levelDisplay.innerText = level;
  spawnedPollutants = 0;
  maxPollutants = level * 5; // Spawn level × 5 pollutants every level

  score += 1000; // +1000 for leveling up
  scoreDisplay.innerText = score;
  showConfetti(); // Celebrate every level

  if (permPowerActive) {
    towerStats.power += 5;
  }
  if (permSpeedActive) {
    towerStats.speed *= 2;
    if (gameActive) restartGameInterval();
  }
  if (permTowersActive) {
    // Spawn 3 towers around random communities (or random if none)
    for (let i = 0; i < 3; i++) {
      let comm = communities[Math.floor(Math.random() * communities.length)];
      if (comm) createTowerAroundCommunity(comm);
      else createTower(
        Math.random() * (gameArea.clientWidth - 30),
        Math.random() * (gameArea.clientHeight - 30)
      );
    }
  }

  if (permFullHPActive) {
    towerBaseHealth = 100 * level;
    communityBaseHealth = 100 * level;
  }

  // Always spawn 1 tower around a random community
  let comm = communities[Math.floor(Math.random() * communities.length)];
  if (comm) createTowerAroundCommunity(comm);
  else createTower(
    Math.random() * (gameArea.clientWidth - 30),
    Math.random() * (gameArea.clientHeight - 30)
  );

  // Spawn 1 community every 5 levels
  if (level % 5 === 0) {
    createCommunity(
      Math.random() * (gameArea.clientWidth - 40),
      Math.random() * (gameArea.clientHeight - 40)
    );
  }

  if (permCommunityBuffActive) {
    communities.forEach(comm => {
      comm.hasTowerStats = true;
    });
  }

  restartGameInterval();
}

// Add Next Level button
let nextLevelBtn = document.createElement("button");
nextLevelBtn.textContent = "Next Level";
nextLevelBtn.style.display = "none";
nextLevelBtn.style.position = "fixed";
nextLevelBtn.style.right = "40px";
nextLevelBtn.style.top = "40px";
nextLevelBtn.style.left = "";
nextLevelBtn.style.transform = "";
nextLevelBtn.style.fontSize = "1rem";
nextLevelBtn.style.padding = "8px 18px";
nextLevelBtn.style.zIndex = "2000";
nextLevelBtn.className = "btn btn-primary";
document.body.appendChild(nextLevelBtn);

// Add Auto Next Level button
let autoNextBtn = document.createElement("button");
autoNextBtn.textContent = "Auto Next Level: OFF";
autoNextBtn.style.position = "fixed";
autoNextBtn.style.right = "40px";
autoNextBtn.style.top = "90px";
autoNextBtn.style.fontSize = "1rem";
autoNextBtn.style.padding = "8px 18px";
autoNextBtn.style.zIndex = "2000";
autoNextBtn.className = "btn btn-outline-success";
document.body.appendChild(autoNextBtn);

let autoNextLevelActive = false;
autoNextBtn.onclick = function () {
  autoNextLevelActive = !autoNextLevelActive;
  autoNextBtn.textContent = "Auto Next Level: " + (autoNextLevelActive ? "ON" : "OFF");
};

// Place the Auto Next Level button next to the Permanent Upgrades button

// Find the permanent upgrades dropdown button
const permDropdown = document.getElementById("permDropdown");

// Style the auto next button for inline display
autoNextBtn.style.position = "static";
autoNextBtn.style.display = "inline-block";
autoNextBtn.style.marginLeft = "10px";
autoNextBtn.style.marginBottom = "5px";
autoNextBtn.style.verticalAlign = "middle";

// Insert the auto next button right after the permanent upgrades dropdown
permDropdown.parentNode.insertBefore(autoNextBtn, permDropdown.nextSibling);

// Optionally, do the same for nextLevelBtn if you want it inline as well:
nextLevelBtn.style.position = "static";
nextLevelBtn.style.display = "inline-block";
nextLevelBtn.style.marginLeft = "10px";
nextLevelBtn.style.marginBottom = "5px";
nextLevelBtn.style.verticalAlign = "middle";
permDropdown.parentNode.insertBefore(nextLevelBtn, autoNextBtn.nextSibling);

// --- Modal HTML
const permModal = document.createElement("div");
permModal.id = "permModal";
permModal.style.display = "none";
permModal.style.position = "fixed";
permModal.style.left = "0";
permModal.style.top = "0";
permModal.style.width = "100vw";
permModal.style.height = "100vh";
permModal.style.background = "rgba(0,0,0,0.5)";
permModal.style.zIndex = "3000";
permModal.innerHTML = `
  <div style="background:#fff;padding:24px 32px;border-radius:10px;max-width:350px;margin:100px auto;position:relative;top:10vh;">
    <h5>Select Permanent Upgrade</h5>
    <div id="permUpgradeList"></div>
    <button id="permUpgradeConfirm" class="btn btn-primary mt-3">Confirm</button>
    <button id="permUpgradeCancel" class="btn btn-secondary mt-3 ms-2">Cancel</button>
  </div>
`;
document.body.appendChild(permModal);

const permUpgrades = [
  { id: "permPower", label: "+5 Power per Level (50 coins)", price: 50, flag: "permPowerActive" },
  { id: "permSpeed", label: "Halve Tower Speed per Level (50 coins)", price: 50, flag: "permSpeedActive" },
  { id: "permTowers", label: "+3 Towers per Level (50 coins)", price: 50, flag: "permTowersActive" },
  { id: "permCommunityBuff", label: "Communities gain tower stats (50 coins)", price: 50, flag: "permCommunityBuffActive" },
  { id: "permFullHP", label: "Tower & Community HP = 100 × Level (20 coins)", price: 20, flag: "permFullHPActive" }
];

// --- Show modal when dropdown button is clicked ---
document.getElementById("permDropdown").onclick = function (e) {
  e.preventDefault();
  // Build upgrade list
  const list = document.getElementById("permUpgradeList");
  list.innerHTML = permUpgrades.map(upg => {
    const disabled = window[upg.flag] ? "disabled" : "";
    return `<div class="form-check">
      <input class="form-check-input" type="radio" name="permUpgradeSelect" id="radio_${upg.id}" value="${upg.id}" ${disabled}>
      <label class="form-check-label" for="radio_${upg.id}">${upg.label} ${window[upg.flag] ? "(Purchased)" : ""}</label>
    </div>`;
  }).join("");
  permModal.style.display = "block";
};

// --- Permanent upgrade logic as functions ---
function applyPermPower() {
  permPowerActive = true;
  // Apply effect immediately if needed (future levels handled in nextLevel)
}
function applyPermSpeed() {
  permSpeedActive = true;
  // Apply effect immediately if needed (future levels handled in nextLevel)
}
function applyPermTowers() {
  permTowersActive = true;
  // Apply effect immediately if needed (future levels handled in nextLevel)
}
function applyPermCommunityBuff() {
  permCommunityBuffActive = true;
  // Apply immediately to all existing communities
  communities.forEach(comm => {
    comm.hasTowerStats = true;
  });
}
function applyPermFullHP() {
  permFullHPActive = true;
  // Set all current towers and communities HP to 100 * level
  towers.forEach(tower => {
    tower.health = 10 * level;
    tower.el.dataset.health = tower.health;
    setHpBar(tower.el, tower.health, 100 * level);
  });
  communities.forEach(comm => {
    comm.health = 100 * level;
    comm.el.dataset.health = comm.health;
    setHpBar(comm.el, comm.health, 100 * level);
  });
  // Also set base health for new ones
  towerBaseHealth = 100 * level;
  communityBaseHealth = 100 * level;
}

// --- Modal confirm/cancel logic ---
document.getElementById("permUpgradeCancel").onclick = function () {
  permModal.style.display = "none";
};
document.getElementById("permUpgradeConfirm").onclick = function () {
  const selected = document.querySelector('input[name="permUpgradeSelect"]:checked');
  if (!selected) return;
  const upg = permUpgrades.find(u => u.id === selected.value);
  if (!upg || window[upg.flag] || coins < upg.price) return;
  coins -= upg.price;
  window[upg.flag] = true;
  updateCoins();
  permModal.style.display = "none";
  // Apply upgrade effect immediately
  if (upg.id === "permPower") applyPermPower();
  if (upg.id === "permSpeed") applyPermSpeed();
  if (upg.id === "permTowers") applyPermTowers();
  if (upg.id === "permCommunityBuff") applyPermCommunityBuff();
  if (upg.id === "permFullHP") applyPermFullHP();
};

// --- Hide modal on outside click ---
permModal.onclick = function(e) {
  if (e.target === permModal) permModal.style.display = "none";
};

// --- Create tower around community ---
function createTowerAroundCommunity(community, minDist = 50, maxDist = 90, maxTries = 20) {
  // Try to find a non-overlapping position around the community
  for (let i = 0; i < maxTries; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const x = community.x + 20 + Math.cos(angle) * dist; // +20 to center on community
    const y = community.y + 20 + Math.sin(angle) * dist;
    // Ensure within bounds
    const minX = 0, minY = 0;
    const maxX = gameArea.clientWidth - 30;
    const maxY = gameArea.clientHeight - 30;
    const tx = Math.max(minX, Math.min(x, maxX));
    const ty = Math.max(minY, Math.min(y, maxY));
    // Check overlap with other towers and communities
    if (
      !isOverlapping(tx, ty, 30, towers, 30) &&
      !isOverlapping(tx, ty, 30, communities, 40)
    ) {
      createTower(tx, ty);
      return true;
    }
  }
  return false; // Could not find a spot
}

// --- Responsive Layout & Brand Colors ---
document.body.style.background = "#8BD1CB";
document.body.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
if (typeof gameArea !== "undefined") {
  gameArea.style.background = "#EAF6FD";
  gameArea.style.border = "4px solid #2E9DF7";
  gameArea.style.borderRadius = "18px";
  gameArea.style.boxShadow = "0 4px 24px #2E9DF733";
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
  coinPanel.style.background = "#fff";
  coinPanel.style.border = "2px solid #FFC907";
  coinPanel.style.borderRadius = "12px";
  coinPanel.style.boxShadow = "0 2px 12px #FFC90733";
  coinPanel.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
  coinPanel.style.maxWidth = "900px";
  coinPanel.style.margin = "20px auto";
  coinPanel.style.width = "90vw";
}
if (typeof scoreDisplay !== "undefined") {
  scoreDisplay.style.color = "#2E9DF7";
  scoreDisplay.style.fontWeight = "bold";
}
if (typeof levelDisplay !== "undefined") {
  levelDisplay.style.color = "#FFC907";
  levelDisplay.style.fontWeight = "bold";
}
document.querySelectorAll("button").forEach(btn => {
  btn.style.fontFamily = "'Proxima Nova', 'Avenir', Arial, sans-serif";
  btn.style.fontWeight = "bold";
  btn.style.borderRadius = "8px";
});
const permDropdownBtn = document.getElementById("permDropdown");
if (permDropdownBtn) {
  permDropdownBtn.style.background = "#FFC907";
  permDropdownBtn.style.color = "#222";
}
if (typeof nextLevelBtn !== "undefined") {
  nextLevelBtn.style.background = "#2E9DF7";
  nextLevelBtn.style.color = "#fff";
}
if (typeof autoNextBtn !== "undefined") {
  autoNextBtn.style.background = "#FFC907";
  autoNextBtn.style.color = "#222";
  autoNextBtn.style.border = "none";
}
if (typeof resetBtn !== "undefined") {
  resetBtn.style.background = "#F5402C";
  resetBtn.style.color = "#fff";
  resetBtn.style.border = "none";
}
const styleBrand = document.createElement("style");
styleBrand.innerHTML = `
  .can:hover { filter: brightness(1.2) drop-shadow(0 0 8px #FFC907); }
  .mud:hover { filter: brightness(0.8) drop-shadow(0 0 8px #F5402C); }
  .can, .mud { border-radius: 50%; border: 2px solid #FFC907; }
  #coinPanel { box-shadow: 0 2px 12px #FFC90733; }
  @media (max-width: 700px) {
    #gameArea { min-width: 220px !important; min-height: 220px !important; width: 98vw !important; height: 60vw !important; }
    .can, .mud { width: 24px !important; height: 24px !important; }
    #coinPanel { font-size: 0.95rem; width: 98vw !important; }
  }
`;
document.head.appendChild(styleBrand);

window.addEventListener("resize", () => {
  if (typeof gameArea !== "undefined") {
    gameArea.style.width = Math.min(window.innerWidth * 0.9, 900) + "px";
    gameArea.style.height = Math.min(window.innerWidth * 0.6, 600) + "px";
  }
  if (typeof coinPanel !== "undefined") {
    coinPanel.style.width = Math.min(window.innerWidth * 0.9, 900) + "px";
  }
});

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
    setTimeout(() => {
      if (can.parentNode) can.parentNode.removeChild(can);
    }, 200);
    // Visual feedback: briefly animate score
    scoreDisplay.style.color = "#FFC907";
    setTimeout(() => { scoreDisplay.style.color = "#2E9DF7"; }, 300);
  };

  // Remove can after 7 seconds if not clicked
  setTimeout(() => {
    if (can.parentNode) can.parentNode.removeChild(can);
  }, 7000);
}

// Spawn a can every 8-15 seconds
setInterval(() => {
  if (gameActive) spawnCan();
}, 8000 + Math.random() * 7000);

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
    setTimeout(() => {
      if (mud.parentNode) mud.parentNode.removeChild(mud);
    }, 200);
    // Visual feedback: briefly animate score
    scoreDisplay.style.color = "#F5402C";
    setTimeout(() => { scoreDisplay.style.color = "#2E9DF7"; }, 300);
  };

  // Remove mud after 6 seconds if not clicked
  setTimeout(() => {
    if (mud.parentNode) mud.parentNode.removeChild(mud);
  }, 6000);
}

// Spawn a mud puddle every 12-20 seconds
setInterval(() => {
  if (gameActive) spawnMud();
}, 12000 + Math.random() * 8000);

// --- Reset Button ---
const resetBtn = document.createElement("button");
resetBtn.textContent = "Reset";
resetBtn.className = "btn btn-danger";
resetBtn.style.marginLeft = "10px";
resetBtn.onclick = function () {
  // Reset all values to level 1 and restart the game
  score = 0;
  level = 1;
  coins = 0;
  towerStats.range = 60;
  towerStats.power = 100;
  towerStats.speed = 1.0;
  towerStats.health = 100;
  communityBaseHealth = 100;
  towerBaseHealth = 100;
  spawnedPollutants = 0;
  maxPollutants = 10;
  scoreDisplay.innerText = score;
  levelDisplay.innerText = level;
  updateCoins();
  // Remove all entities
  pollutants.forEach(p => p.el && p.el.parentNode && p.el.parentNode.removeChild(p.el));
  towers.forEach(t => t.el && t.el.parentNode && t.el.parentNode.removeChild(t.el));
  communities.forEach(c => c.el && c.el.parentNode && c.el.parentNode.removeChild(c.el));
  bullets.forEach(b => b.el && b.el.parentNode && b.el.parentNode.removeChild(b.el));
  document.querySelectorAll(".can, .mud").forEach(el => el.remove());
  pollutants = [];
  towers = [];
  communities = [];
  bullets = [];
  // Respawn 3 communities and towers
  for (let i = 0; i < 3; i++) {
    createCommunity(
      Math.random() * (gameArea.clientWidth - 40),
      Math.random() * (gameArea.clientHeight - 40)
    );
  }
  communities.forEach(comm => createTowerAroundCommunity(comm));
  // Restart game loop
  gameActive = true;
  startBtn.style.display = "none";
  gameOverDisplay.style.display = "none";
  restartGameInterval();
};
coinPanel.appendChild(resetBtn);

// --- Confetti celebration on win ---
function showConfetti() {
  // Simple confetti using emoji
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
    setTimeout(() => {
      conf.style.top = (80 + Math.random() * 15) + "vh";
    }, 10 + Math.random() * 400);
  }
  setTimeout(() => confettiContainer.remove(), 2500);
}

// --- Celebrate win when user wins the game ---
function endGame() {
  gameActive = false;
  clearInterval(gameInterval);
  gameOverDisplay.style.display = "block";
  showConfetti();
}

// --- Responsive font for score ---
scoreDisplay.style.fontSize = "clamp(1.2rem, 2vw, 2.2rem)";
scoreDisplay.style.fontWeight = "bold";
scoreDisplay.style.transition = "color 0.2s";

// --- Charity: water logo and message ---
const logo = document.createElement("img");
logo.src = "https://www.charitywater.org/images/logos/cw-logo.svg";
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

nextLevelBtn.onclick = function () {
  nextLevelBtn.style.display = "none";
  nextLevel();
};