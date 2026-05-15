import pg from "pg";

const pool = new pg.Pool();

const DEFAULT_DATA = {
  config: { spawnChannelId: "", guildSpawnChannels: {} },
  users: {},
  itemShop: { skins: [], lastReset: 0 },
  coinflipChallenges: {},
};

const DAILY_QUESTS = [
  { id: "catch_skins", label: "Catch 3 spawned skins", xpReward: 300, required: 3 },
  { id: "win_coinflip", label: "Win a coin flip", xpReward: 200, required: 1 },
  { id: "check_shop", label: "Browse the item shop", xpReward: 100, required: 1 },
  { id: "check_vbucks", label: "Check your V-Bucks balance", xpReward: 50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];

let _data = structuredClone(DEFAULT_DATA);
let _saveTimeout = null;

export async function initStorage() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await pool.query(
    "SELECT value FROM bot_store WHERE key = $1",
    ["data"]
  );

  if (result.rows.length > 0) {
    _data = { ...DEFAULT_DATA, ...result.rows[0].value };

    if (!_data.coinflipChallenges) _data.coinflipChallenges = {};
    if (!_data.itemShop) _data.itemShop = { skins: [], lastReset: 0 };
    if (!_data.config) {
      _data.config = { spawnChannelId: "", guildSpawnChannels: {} };
    }

    if (!_data.config.guildSpawnChannels) {
      _data.config.guildSpawnChannels = {};
    }
  } else {
    await pool.query(
      "INSERT INTO bot_store (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      ["data", JSON.stringify(_data)]
    );
  }
}

function save() {
  if (_saveTimeout) clearTimeout(_saveTimeout);

  _saveTimeout = setTimeout(() => {
    _saveTimeout = null;

    pool
      .query(
        `INSERT INTO bot_store (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        ["data", JSON.stringify(_data)]
      )
      .catch(() => {});
  }, 300);
}

export function getConfig() {
  return _data.config;
}

export function getSpawnChannel(guildId) {
  return _data.config.guildSpawnChannels[guildId];
}

export function getAllGuildSpawnChannels() {
  return _data.config.guildSpawnChannels;
}

export function setSpawnChannel(guildId, channelId) {
  _data.config.guildSpawnChannels[guildId] = channelId;
  save();
}

export function getUser(userId) {
  if (!_data.users[userId]) {
    _data.users[userId] = {
      vbucks: 500,
      inventory: [],
      inventoryNames: {},
      xp: 0,
      level: 1,
      interactionCount: 0,
      boxes: 0,
      quests: freshQuests(),
      lastQuestReset: Date.now(),
      lastDailyClaim: 0,
      dailyStreak: 0,
      achievementsEarned: [],
      coinflipsWon: 0,
      boxesOpened: 0,
      giftsGiven: 0,
      tradesCompleted: 0,
      shopPurchases: 0,
      shopSkins: [],
      shopSkinPrices: {},
      brokeAttempt: false,
      refundCooldowns: {},
      hasCreatorCode: false,
      creatorDiscount: 0,
      hasFoundersPack: false,
      foundersBoxes: 0,
      foundersBoxesOpened: 0,
      freeSkinExpiry: 0,
      freeSkinRedeemed: false,
      freeSkinIds: [],
      eliminatedUntil: 0,
      weapons: [],
      zeroPointUseTimes: [],
      zeroPointCrackedUntil: 0,
    };

    save();
  }

  const u = _data.users[userId];

  if (!u.achievementsEarned) u.achievementsEarned = [];
  if (u.coinflipsWon === undefined) u.coinflipsWon = 0;
  if (u.boxesOpened === undefined) u.boxesOpened = 0;
  if (u.giftsGiven === undefined) u.giftsGiven = 0;
  if (u.tradesCompleted === undefined) u.tradesCompleted = 0;
  if (u.shopPurchases === undefined) u.shopPurchases = 0;
  if (!u.shopSkins) u.shopSkins = [];
  if (!u.shopSkinPrices) u.shopSkinPrices = {};
  if (u.brokeAttempt === undefined) u.brokeAttempt = false;
  if (!u.refundCooldowns) u.refundCooldowns = {};
  if (u.hasCreatorCode === undefined) u.hasCreatorCode = false;
  if (u.creatorDiscount === undefined) {
    u.creatorDiscount = u.hasCreatorCode ? 0.1 : 0;
  }

  if (u.hasFoundersPack === undefined) u.hasFoundersPack = false;
  if (u.foundersBoxes === undefined) u.foundersBoxes = 0;
  if (u.foundersBoxesOpened === undefined) u.foundersBoxesOpened = 0;
  if (u.freeSkinExpiry === undefined) u.freeSkinExpiry = 0;
  if (u.freeSkinRedeemed === undefined) u.freeSkinRedeemed = false;
  if (!u.freeSkinIds) u.freeSkinIds = [];
  if (u.eliminatedUntil === undefined) u.eliminatedUntil = 0;
  if (!u.weapons) u.weapons = [];
  if (!u.zeroPointUseTimes) u.zeroPointUseTimes = [];
  if (u.zeroPointCrackedUntil === undefined) {
    u.zeroPointCrackedUntil = 0;
  }

  return u;
}

export function freshQuests() {
  return DAILY_QUESTS.map((q) => ({
    ...q,
    current: 0,
    completed: false,
  }));
}

export function resetQuestsIfNeeded(userId) {
  const user = getUser(userId);
  const dayMs = 24 * 60 * 60 * 1000;

  if (Date.now() - user.lastQuestReset > dayMs) {
    user.quests = freshQuests();
    user.lastQuestReset = Date.now();
    save();
  }
}

export function updateUser(userId, update) {
  const user = getUser(userId);

  Object.assign(user, update);

  _data.users[userId] = user;

  save();
}

export function addInteraction(userId) {
  const user = getUser(userId);

  user.interactionCount += 1;

  const gainedVbucks = user.interactionCount % 30 === 0;

  if (gainedVbucks) {
    user.vbucks += 250;
  }

  _data.users[userId] = user;

  save();

  return { gainedVbucks };
}

export function addVbucks(userId, amount) {
  const user = getUser(userId);

  user.vbucks += amount;

  save();
}

export function addSkinToInventory(userId, skinId, skinName) {
  const user = getUser(userId);

  user.inventory.push(skinId);

  user.inventoryNames[skinId + "_" + user.inventory.length] = skinName;

  _data.users[userId] = user;

  save();
}

export function xpForLevel(level) {
  return Math.min(100 * level, 450);
}

export function calculateLevelFromXP(totalXp) {
  let level = 1;
  let remaining = totalXp;

  while (true) {
    const needed = xpForLevel(level);

    if (remaining < needed) {
      return {
        level,
        xpInLevel: remaining,
        xpForNext: needed,
      };
    }

    remaining -= needed;
    level++;
  }
}

export function addXP(userId, amount) {
  const user = getUser(userId);

  const before = calculateLevelFromXP(user.xp);

  user.xp += amount;

  const after = calculateLevelFromXP(user.xp);

  const leveledUp = after.level > before.level;

  user.level = after.level;

  if (leveledUp) {
    const levelsGained = after.level - before.level;
    user.boxes += levelsGained;
  }

  _data.users[userId] = user;

  save();

  return {
    leveledUp,
    newLevel: after.level,
  };
}

export function progressQuest(userId, questId, amount = 1) {
  resetQuestsIfNeeded(userId);

  const user = getUser(userId);

  const quest = user.quests.find((q) => q.id === questId);

  if (!quest || quest.completed) return null;

  quest.current = Math.min(
    quest.current + amount,
    quest.required
  );

  if (quest.current >= quest.required) {
    quest.completed = true;
    user.foundersBoxes = (user.foundersBoxes || 0) + 1;
  }

  _data.users[userId] = user;

  save();

  return quest.completed ? quest : null;
}

export function completeQuest(userId, questId) {
  const user = getUser(userId);

  const quest = user.quests.find(
    (q) => q.id === questId && !q.completed
  );

  if (!quest) return null;

  quest.completed = true;

  user.foundersBoxes = (user.foundersBoxes || 0) + 1;

  addXP(userId, quest.xpReward);

  save();

  return quest;
}

export function isEliminated(userId) {
  const user = getUser(userId);

  return (user.eliminatedUntil || 0) > Date.now();
}

export function getEliminationTimeLeft(userId) {
  const user = getUser(userId);

  return Math.max(
    0,
    (user.eliminatedUntil || 0) - Date.now()
  );
}

export function hasActiveFreeSkin(userId) {
  const user = getUser(userId);

  return (
    (user.freeSkinExpiry || 0) > Date.now() &&
    !(user.freeSkinRedeemed || false)
  );
}

export function getItemShop() {
  return _data.itemShop;
}

export function setItemShop(skins) {
  _data.itemShop = {
    skins,
    lastReset: Date.now(),
  };

  save();
}

export function setCoinflipChallenge(id, challenge) {
  _data.coinflipChallenges[id] = challenge;
  save();
}

export function getCoinflipChallenge(id) {
  return _data.coinflipChallenges[id];
}

export function deleteCoinflipChallenge(id) {
  delete _data.coinflipChallenges[id];
  save();
}

export function getAllCoinflipChallenges() {
  return _data.coinflipChallenges;
}

export function getAllUsers() {
  return _data.users;
}
