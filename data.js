// ────────────────────────────────────────────
//  data.js — SQLite persistence layer
//  Drop-in replacement for the data.json system
// ─────────────────────────────────────────────
"use strict";

const Database = require("better-sqlite3");

const db = new Database("./fortnite.db");

// ─── Perf pragma ───────────────────────────────
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

// ─────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId              TEXT PRIMARY KEY,
    vbucks              INTEGER  DEFAULT 500,
    xp                  INTEGER  DEFAULT 0,
    level               INTEGER  DEFAULT 1,

    -- counters
    interactionCount    INTEGER  DEFAULT 0,
    boxes               INTEGER  DEFAULT 0,
    dailyStreak         INTEGER  DEFAULT 0,
    coinflipsWon        INTEGER  DEFAULT 0,
    coinflipsPlayed     INTEGER  DEFAULT 0,
    boxesOpened         INTEGER  DEFAULT 0,
    giftsGiven          INTEGER  DEFAULT 0,
    tradesCompleted     INTEGER  DEFAULT 0,
    shopPurchases       INTEGER  DEFAULT 0,
    spawnCatches        INTEGER  DEFAULT 0,
    zeropointUses       INTEGER  DEFAULT 0,
    vbucksChecked       INTEGER  DEFAULT 0,
    luckPotion          INTEGER  DEFAULT 0,
    xtraLuckPotion      INTEGER  DEFAULT 0,
    godlyLuckPotion     INTEGER  DEFAULT 0,
    llamaOpens          INTEGER  DEFAULT 0,
    fishCaught          INTEGER  DEFAULT 0,
    stormsSurvived      INTEGER  DEFAULT 0,
    supplyDrops         INTEGER  DEFAULT 0,
    duelsPlayed         INTEGER  DEFAULT 0,
    timesBuilt          INTEGER  DEFAULT 0,
    buildCharges        INTEGER  DEFAULT 0,
    godChest            INTEGER  DEFAULT 0,
    mysteriousChest     INTEGER  DEFAULT 0,
    foundersBoxes       INTEGER  DEFAULT 0,
    foundersBoxesOpened INTEGER  DEFAULT 0,

    -- timestamps
    lastQuestReset      INTEGER  DEFAULT 0,
    lastDailyClaim      INTEGER  DEFAULT 0,
    eliminatedUntil     INTEGER  DEFAULT 0,
    lastLlama           INTEGER  DEFAULT 0,
    lastSupplyDrop      INTEGER  DEFAULT 0,
    lastFish            INTEGER  DEFAULT 0,
    lastStorm           INTEGER  DEFAULT 0,
    freeSkinExpiry      INTEGER  DEFAULT 0,
    musicPassExpiry     INTEGER  DEFAULT 0,

    -- flags (0/1)
    brokeAttempt        INTEGER  DEFAULT 0,
    hasCreatorCode      INTEGER  DEFAULT 0,
    hasFoundersPack     INTEGER  DEFAULT 0,
    freeSkinRedeemed    INTEGER  DEFAULT 0,
    infiniteVbucks      INTEGER  DEFAULT 0,
    hasMusicPass        INTEGER  DEFAULT 0,

    -- text
    activeLuck          TEXT     DEFAULT 'none',
    buildMaterial       TEXT     DEFAULT 'none',
    creatorDiscount     REAL     DEFAULT 0,
    equippedSkin        TEXT     DEFAULT NULL,
    equippedPickaxe     TEXT     DEFAULT NULL,
    equippedBackbling   TEXT     DEFAULT NULL,

    -- JSON blobs
    inventory           TEXT     DEFAULT '[]',
    inventoryNames      TEXT     DEFAULT '{}',
    quests              TEXT     DEFAULT '[]',
    achievementsEarned  TEXT     DEFAULT '[]',
    weapons             TEXT     DEFAULT '[]',
    shopSkins           TEXT     DEFAULT '[]',
    shopSkinPrices      TEXT     DEFAULT '{}',
    refundCooldowns     TEXT     DEFAULT '{}',
    freeSkinIds         TEXT     DEFAULT '[]',
    foundersQuestPending TEXT    DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS item_shop (
    id        INTEGER PRIMARY KEY,
    skins     TEXT    NOT NULL DEFAULT '[]',
    lastReset INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS music_pass (
    id        INTEGER PRIMARY KEY,
    skin      TEXT    DEFAULT NULL,
    lastReset INTEGER DEFAULT 0,
    purchasers TEXT   DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS coinflip_challenges (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS crew_codes (
    code        TEXT    PRIMARY KEY,
    generatedAt INTEGER NOT NULL,
    used        INTEGER DEFAULT 0,
    userId      TEXT    DEFAULT NULL
  );
`);

// ─────────────────────────────────────────────
//  Migrations — add columns that may be missing
//  from older databases created before this file
// ─────────────────────────────────────────────
const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN equippedSkin      TEXT    DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN equippedPickaxe   TEXT    DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN equippedBackbling TEXT    DEFAULT NULL",
];
for (const sql of MIGRATIONS) {
  try { db.prepare(sql).run(); } catch (_) { /* column already exists — fine */ }
}

// Seed single-row tables
const shopRow = db.prepare("SELECT id FROM item_shop WHERE id = 1").get();
if (!shopRow) db.prepare("INSERT INTO item_shop (id, skins, lastReset) VALUES (1, '[]', 0)").run();
const passRow = db.prepare("SELECT id FROM music_pass WHERE id = 1").get();
if (!passRow) db.prepare("INSERT INTO music_pass (id, skin, lastReset, purchasers) VALUES (1, NULL, 0, '{}')").run();

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function j(v)  { return JSON.stringify(v); }
function p(v)  { try { return JSON.parse(v); } catch { return v; } }

const DAILY_QUEST_TEMPLATE = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",            xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                  xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",             xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",       xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];
function freshQuests() {
  return DAILY_QUEST_TEMPLATE.map((q) => ({ ...q, current: 0, completed: false }));
}

// Convert a DB row into the full user object the bot expects
function rowToUser(row) {
  return {
    ...row,
    // booleans
    brokeAttempt:     !!row.brokeAttempt,
    hasCreatorCode:   !!row.hasCreatorCode,
    hasFoundersPack:  !!row.hasFoundersPack,
    freeSkinRedeemed: !!row.freeSkinRedeemed,
    infiniteVbucks:   !!row.infiniteVbucks,
    hasMusicPass:     !!row.hasMusicPass,
    // JSON
    inventory:           p(row.inventory),
    inventoryNames:      p(row.inventoryNames),
    quests:              p(row.quests),
    achievementsEarned:  p(row.achievementsEarned),
    weapons:             p(row.weapons),
    shopSkins:           p(row.shopSkins),
    shopSkinPrices:      p(row.shopSkinPrices),
    refundCooldowns:     p(row.refundCooldowns),
    freeSkinIds:         p(row.freeSkinIds),
    foundersQuestPending: p(row.foundersQuestPending),
  };
}

// Prepared statements
const _getRow   = db.prepare("SELECT * FROM users WHERE userId = ?");
const _insertU  = db.prepare(`
  INSERT OR IGNORE INTO users (userId, quests, lastQuestReset)
  VALUES (?, ?, ?)
`);

// ─────────────────────────────────────────────
//  ensureUser (internal)
// ─────────────────────────────────────────────
function ensureUser(userId) {
  _insertU.run(userId, j(freshQuests()), Date.now());
}

// ─────────────────────────────────────────────
//  getUser
// ─────────────────────────────────────────────
function getUser(userId) {
  ensureUser(userId);
  const row = _getRow.get(userId);
  return rowToUser(row);
}

// ─────────────────────────────────────────────
//  updateUser
//  Accepts an object with any user fields and
//  persists them, auto-serialising JSON blobs
// ─────────────────────────────────────────────
const JSON_FIELDS = new Set([
  "inventory", "inventoryNames", "quests", "achievementsEarned",
  "weapons", "shopSkins", "shopSkinPrices", "refundCooldowns",
  "freeSkinIds", "foundersQuestPending",
]);
const BOOL_FIELDS = new Set([
  "brokeAttempt", "hasCreatorCode", "hasFoundersPack", "freeSkinRedeemed",
  "infiniteVbucks", "hasMusicPass",
]);

function updateUser(userId, update) {
  ensureUser(userId);
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(update)) {
    sets.push(`"${k}" = ?`);
    if (JSON_FIELDS.has(k))  vals.push(j(v));
    else if (BOOL_FIELDS.has(k)) vals.push(v ? 1 : 0);
    else vals.push(v);
  }
  if (!sets.length) return;
  vals.push(userId);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE userId = ?`).run(...vals);
}

// ─────────────────────────────────────────────
//  Economy
// ─────────────────────────────────────────────
function addVbucks(userId, amount) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  if (u.infiniteVbucks && amount < 0) return;
  db.prepare("UPDATE users SET vbucks = vbucks + ? WHERE userId = ?").run(amount, userId);
}

function removeVbucks(userId, amount) {
  ensureUser(userId);
  db.prepare("UPDATE users SET vbucks = MAX(vbucks - ?, 0) WHERE userId = ?").run(amount, userId);
}

// ─────────────────────────────────────────────
//  XP / levelling
// ─────────────────────────────────────────────
function xpForLevel(level) { return Math.min(100 * level, 450); }
function calculateLevelFromXP(totalXp) {
  let level = 1, remaining = totalXp;
  while (true) {
    const needed = xpForLevel(level);
    if (remaining < needed) return { level, xpInLevel: remaining, xpForNext: needed };
    remaining -= needed;
    level++;
  }
}

function addXP(userId, amount) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  const before = calculateLevelFromXP(u.xp);
  const newXp   = u.xp + amount;
  const after   = calculateLevelFromXP(newXp);
  const leveledUp = after.level > before.level;
  const levelDiff  = after.level - before.level;
  db.prepare(
    "UPDATE users SET xp = ?, level = ?, boxes = boxes + ? WHERE userId = ?"
  ).run(newXp, after.level, leveledUp ? levelDiff : 0, userId);
  return { leveledUp, newLevel: after.level };
}

// ─────────────────────────────────────────────
//  Interaction milestone
// ─────────────────────────────────────────────
function addInteraction(userId) {
  ensureUser(userId);
  db.prepare("UPDATE users SET interactionCount = interactionCount + 1 WHERE userId = ?").run(userId);
  const u = _getRow.get(userId);
  const gained = u.interactionCount % 30 === 0;
  if (gained && !u.infiniteVbucks) {
    db.prepare("UPDATE users SET vbucks = vbucks + 250 WHERE userId = ?").run(userId);
  }
  return { gainedVbucks: gained };
}

// ─────────────────────────────────────────────
//  Inventory
// ─────────────────────────────────────────────
function addSkinToInventory(userId, skinId, skinName) {
  ensureUser(userId);
  const u = rowToUser(_getRow.get(userId));
  const newInventory     = [...u.inventory, skinId];
  const newInventoryNames = { ...u.inventoryNames, [`${skinId}_${newInventory.length}`]: skinName };
  db.prepare(
    "UPDATE users SET inventory = ?, inventoryNames = ? WHERE userId = ?"
  ).run(j(newInventory), j(newInventoryNames), userId);
}

// ─────────────────────────────────────────────
//  Quests
// ─────────────────────────────────────────────
function resetQuestsIfNeeded(userId) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  if (Date.now() - u.lastQuestReset > 24 * 60 * 60 * 1000) {
    db.prepare(
      "UPDATE users SET quests = ?, lastQuestReset = ? WHERE userId = ?"
    ).run(j(freshQuests()), Date.now(), userId);
  }
}

function progressQuest(userId, questId, amount = 1) {
  resetQuestsIfNeeded(userId);
  const u = rowToUser(_getRow.get(userId));
  const quest = u.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return null;
  quest.current = Math.min(quest.current + amount, quest.required);
  const justCompleted = quest.current >= quest.required;
  if (justCompleted) {
    quest.completed = true;
    addXP(userId, quest.xpReward);
    db.prepare("UPDATE users SET foundersBoxes = foundersBoxes + 1 WHERE userId = ?").run(userId);
  }
  db.prepare("UPDATE users SET quests = ? WHERE userId = ?").run(j(u.quests), userId);
  return justCompleted ? quest : null;
}

// ─────────────────────────────────────────────
//  Founders Quests
// ─────────────────────────────────────────────
const FOUNDERS_QUEST_POOL = [
  { id: "catch_skins_3",  label: "Catch 3 skins from the spawn channel",   stat: "spawnCatches",    required: 3    },
  { id: "catch_skins_5",  label: "Catch 5 skins from the spawn channel",   stat: "spawnCatches",    required: 5    },
  { id: "win_flip_1",     label: "Win 1 coin flip",                         stat: "coinflipsWon",    required: 1    },
  { id: "win_flip_3",     label: "Win 3 coin flips",                        stat: "coinflipsWon",    required: 3    },
  { id: "buy_shop_1",     label: "Buy a skin from the Item Shop",           stat: "shopPurchases",   required: 1    },
  { id: "buy_shop_2",     label: "Buy 2 skins from the Item Shop",          stat: "shopPurchases",   required: 2    },
  { id: "open_stw",       label: "Open 1 Save the World Box",               stat: "boxesOpened",     required: 1    },
  { id: "daily_claim",    label: "Claim your daily reward",                 stat: "dailyStreak",     required: 1    },
  { id: "use_zeropoint",  label: "Use the /zeropoint command",              stat: "zeropointUses",   required: 1    },
  { id: "trade_skin",     label: "Complete a skin trade with someone",      stat: "tradesCompleted", required: 1    },
  { id: "gift_skin",      label: "Gift a skin to another player",           stat: "giftsGiven",      required: 1    },
  { id: "play_flip",      label: "Challenge someone to a coin flip",        stat: "coinflipsPlayed", required: 1    },
  { id: "earn_xp_300",    label: "Earn 300 XP on the bot",                  stat: "xp",              required: 300  },
  { id: "earn_xp_1000",   label: "Earn 1,000 XP on the bot",               stat: "xp",              required: 1000 },
  { id: "check_vbucks_5", label: "Check your V-Bucks 5 times",              stat: "vbucksChecked",   required: 5    },
  { id: "catch_10",       label: "Catch 10 items from the spawn channel",   stat: "spawnCatches",    required: 10   },
  { id: "level_3",        label: "Reach Level 3 on the bot",                stat: "level",           required: 3    },
  { id: "level_5",        label: "Reach Level 5 on the bot",                stat: "level",           required: 5    },
  { id: "open_llama",     label: "Open a Supply Llama",                     stat: "llamaOpens",      required: 1    },
  { id: "go_fishing",     label: "Catch something while fishing",           stat: "fishCaught",      required: 1    },
  { id: "survive_storm",  label: "Survive the storm 3 times",               stat: "stormsSurvived",  required: 3    },
  { id: "supply_drop_1",  label: "Call in a supply drop",                   stat: "supplyDrops",     required: 1    },
  { id: "duel_someone",   label: "Challenge someone to a duel",             stat: "duelsPlayed",     required: 1    },
  { id: "build_up",       label: "Build a structure for protection",        stat: "timesBuilt",      required: 1    },
];

function pickRandom(arr, n) { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }

function assignFoundersQuests(userId) {
  const user  = getUser(userId);
  const pool  = pickRandom(FOUNDERS_QUEST_POOL, 3);
  const quests = pool.map((q) => ({ ...q, baseline: user[q.stat] ?? 0, awardedBox: false }));
  updateUser(userId, { foundersQuestPending: quests });
  return quests;
}

function checkFoundersQuests(userId) {
  const user = getUser(userId);
  if (!user.foundersQuestPending?.length) return { newBoxes: 0, quests: [] };
  let newBoxes = 0;
  const updated = user.foundersQuestPending.map((q) => {
    if (q.awardedBox) return q;
    const current = (user[q.stat] ?? 0) - (q.baseline ?? 0);
    const done    = current >= q.required;
    if (done) newBoxes++;
    return { ...q, awardedBox: done };
  });
  if (newBoxes > 0) {
    updateUser(userId, {
      foundersQuestPending: updated,
      foundersBoxes: (user.foundersBoxes ?? 0) + newBoxes,
    });
  } else {
    updateUser(userId, { foundersQuestPending: updated });
  }
  return { newBoxes, quests: updated };
}

// ─────────────────────────────────────────────
//  Achievements
// ─────────────────────────────────────────────
function checkAndAwardAchievements(userId, ALL_ACHIEVEMENTS) {
  const user = getUser(userId);
  const newlyEarned = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!user.achievementsEarned.includes(ach.id) && ach.check(user)) {
      user.achievementsEarned.push(ach.id);
      newlyEarned.push(ach.title);
    }
  }
  if (newlyEarned.length) {
    updateUser(userId, { achievementsEarned: user.achievementsEarned });
  }
  return newlyEarned;
}

function awardAchievement(userId, achId, ALL_ACHIEVEMENTS) {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
  if (!ach) return null;
  const user = getUser(userId);
  if (user.achievementsEarned.includes(achId)) return null;
  updateUser(userId, { achievementsEarned: [...user.achievementsEarned, achId] });
  return ach;
}

// ─────────────────────────────────────────────
//  State helpers
// ─────────────────────────────────────────────
function isEliminated(userId) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  return (u.eliminatedUntil ?? 0) > Date.now();
}

function getEliminationTimeLeft(userId) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  return Math.max(0, (u.eliminatedUntil ?? 0) - Date.now());
}

function hasActiveFreeSkin(userId) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  return (u.freeSkinExpiry ?? 0) > Date.now() && !u.freeSkinRedeemed;
}

// ─────────────────────────────────────────────
//  Item Shop
// ─────────────────────────────────────────────
function getItemShop() {
  const row = db.prepare("SELECT skins, lastReset FROM item_shop WHERE id = 1").get();
  return { skins: p(row.skins), lastReset: row.lastReset };
}

function setItemShop(skins) {
  db.prepare(
    "UPDATE item_shop SET skins = ?, lastReset = ? WHERE id = 1"
  ).run(j(skins), Date.now());
}

// ─────────────────────────────────────────────
//  Music Pass
// ─────────────────────────────────────────────
function getMusicPassData() {
  const row = db.prepare("SELECT * FROM music_pass WHERE id = 1").get();
  return {
    skin:       row.skin ? p(row.skin) : null,
    lastReset:  row.lastReset,
    purchasers: p(row.purchasers),
  };
}

function setMusicPass(skin) {
  db.prepare(
    "UPDATE music_pass SET skin = ?, lastReset = ?, purchasers = '{}' WHERE id = 1"
  ).run(j(skin), Date.now());
}

function addMusicPassPurchaser(userId) {
  const row  = db.prepare("SELECT purchasers FROM music_pass WHERE id = 1").get();
  const data = p(row.purchasers);
  data[userId] = true;
  db.prepare("UPDATE music_pass SET purchasers = ? WHERE id = 1").run(j(data));
}

function isMusicPassPurchaser(userId) {
  const row  = db.prepare("SELECT purchasers FROM music_pass WHERE id = 1").get();
  return !!(p(row.purchasers)[userId]);
}

// ─────────────────────────────────────────────
//  Guild Config (spawn channels)
// ─────────────────────────────────────────────
function getSpawnChannel(guildId) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(`spawn:${guildId}`);
  return row ? row.value : undefined;
}

function setSpawnChannel(guildId, channelId) {
  db.prepare(
    "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)"
  ).run(`spawn:${guildId}`, channelId);
}

function getAllGuildSpawnChannels() {
  const rows = db.prepare("SELECT key, value FROM config WHERE key LIKE 'spawn:%'").all();
  const result = {};
  for (const row of rows) {
    result[row.key.replace("spawn:", "")] = row.value;
  }
  return result;
}

// ─────────────────────────────────────────────
//  Coinflip Challenges
// ─────────────────────────────────────────────
function setCoinflipChallenge(id, ch) {
  db.prepare(
    "INSERT OR REPLACE INTO coinflip_challenges (id, data) VALUES (?, ?)"
  ).run(id, j(ch));
}

function getCoinflipChallenge(id) {
  const row = db.prepare("SELECT data FROM coinflip_challenges WHERE id = ?").get(id);
  return row ? p(row.data) : undefined;
}

function deleteCoinflipChallenge(id) {
  db.prepare("DELETE FROM coinflip_challenges WHERE id = ?").run(id);
}

// ─────────────────────────────────────────────
//  Crew Codes
// ─────────────────────────────────────────────
function addCrewCode(code) {
  db.prepare(
    "INSERT OR IGNORE INTO crew_codes (code, generatedAt) VALUES (?, ?)"
  ).run(code, Date.now());
}

function getCrewCode(code) {
  return db.prepare("SELECT * FROM crew_codes WHERE code = ?").get(code) || null;
}

function redeemCrewCode(code, userId) {
  db.prepare(
    "UPDATE crew_codes SET used = 1, userId = ? WHERE code = ?"
  ).run(userId, code);
}

// ─────────────────────────────────────────────
//  getAllUsers — returns { userId: userObj, ... }
//  Used by leaderboard / admin commands
// ─────────────────────────────────────────────
function getAllUsers() {
  const rows = db.prepare("SELECT * FROM users").all();
  const out = {};
  for (const row of rows) out[row.userId] = rowToUser(row);
  return out;
}

// ─────────────────────────────────────────────
//  Inventory / Locker (from the user's example)
// ─────────────────────────────────────────────
function addItem(userId, itemId, itemType = "skin") {
  addSkinToInventory(userId, itemId, itemType);
}

function hasItem(userId, itemId) {
  const u = getUser(userId);
  return u.inventory.includes(itemId);
}

function getInventory(userId) {
  const u = getUser(userId);
  return u.inventory.map((id, i) => ({
    itemId:   id,
    itemName: u.inventoryNames[`${id}_${i + 1}`] || id,
  }));
}

// ─────────────────────────────────────────────
//  Locker (equipped skin per user)
//  Stored directly on the user row
// ─────────────────────────────────────────────
function equipSkin(userId, skinId) {
  updateUser(userId, { equippedSkin: skinId });
}

function getLocker(userId) {
  ensureUser(userId);
  const u = _getRow.get(userId);
  return {
    userId:           u.userId,
    equippedSkin:     u.equippedSkin     || null,
    equippedPickaxe:  u.equippedPickaxe  || null,
    equippedBackbling: u.equippedBackbling || null,
  };
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  db,

  // User CRUD
  ensureUser,
  getUser,
  updateUser,
  getAllUsers,

  // Economy
  addVbucks,
  removeVbucks,
  addXP,
  addInteraction,
  xpForLevel,
  calculateLevelFromXP,

  // Inventory / Locker
  addSkinToInventory,
  addItem,
  hasItem,
  getInventory,
  equipSkin,
  getLocker,

  // Quests
  resetQuestsIfNeeded,
  progressQuest,
  freshQuests,

  // Founders
  assignFoundersQuests,
  checkFoundersQuests,

  // Achievements
  checkAndAwardAchievements,
  awardAchievement,

  // State helpers
  isEliminated,
  getEliminationTimeLeft,
  hasActiveFreeSkin,

  // Item Shop
  getItemShop,
  setItemShop,

  // Music Pass
  getMusicPassData,
  setMusicPass,
  addMusicPassPurchaser,
  isMusicPassPurchaser,

  // Guild Config
  getSpawnChannel,
  setSpawnChannel,
  getAllGuildSpawnChannels,

  // Coinflip
  setCoinflipChallenge,
  getCoinflipChallenge,
  deleteCoinflipChallenge,

  // Crew codes
  addCrewCode,
  getCrewCode,
  redeemCrewCode,
};
