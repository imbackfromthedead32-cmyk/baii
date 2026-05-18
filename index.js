require("dotenv").config();

const {
  Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ComponentType, PermissionFlagsBits,
  ChannelType, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle,
  UserSelectMenuBuilder,
} = require("discord.js");
const fs   = require("fs");
const path = require("path");
const pg   = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ DATABASE_URL not set — user data will not persist across restarts.");
}

const _pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
let _db = {
  users: {},
  itemShop: { skins: [], lastReset: 0 },
  musicPass: { skin: null, lastReset: 0, purchasers: [] },
  spawnChannels: {},
  coinflipChallenges: {},
  crewCodes: {},
  pendingGifts: {},
};

let _saveTimer = null;
function save() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _pool.query(
      `INSERT INTO bot_store (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      ["data", JSON.stringify(_db)]
    ).catch((err) => console.error("[data] save failed:", err.message));
  }, 300);
}

async function initDB() {
  await _pool.query(`
    CREATE TABLE IF NOT EXISTS bot_store (
      key        TEXT        PRIMARY KEY,
      value      JSONB       NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const res = await _pool.query(
    "SELECT value FROM bot_store WHERE key = $1", ["data"]
  );
  if (res.rows.length > 0) {
    const stored = res.rows[0].value;
    if (stored.users)              _db.users              = stored.users;
    if (stored.itemShop)           _db.itemShop           = stored.itemShop;
    if (stored.musicPass)          _db.musicPass          = stored.musicPass;
    if (stored.spawnChannels)      _db.spawnChannels      = stored.spawnChannels;
    if (stored.coinflipChallenges) _db.coinflipChallenges = stored.coinflipChallenges;
    if (stored.crewCodes)          _db.crewCodes          = stored.crewCodes;
    if (stored.pendingGifts)       _db.pendingGifts       = stored.pendingGifts;
    console.log(`[data] Loaded ${Object.keys(_db.users).length} users from PostgreSQL`);
  } else {
    await _pool.query(
      "INSERT INTO bot_store (key, value) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      ["data", JSON.stringify(_db)]
    );
    console.log("[data] Fresh database initialised");
  }
}

function db() { return _db; }
function defaultUser() {
  return {
    vbucks: 0,
    infiniteVbucks: false,
    xp: 0,
    level: 1,
    inventory: [],
    inventoryNames: {},
    equippedSkin: null,
    weapons: [],
    buildMaterial: "none",
    buildCharges: 0,
    boxes: 0,
    foundersBoxes: 0,
    hasFoundersPack: false,
    luckPotion: 0,
    xtraLuckPotion: 0,
    godlyLuckPotion: 0,
    activeLuck: "none",
    godChest: 0,
    mysteriousChest: 0,
    dailyStreak: 0,
    lastDailyClaim: 0,
    lastLlama: 0,
    llamaOpens: 0,
    lastFish: 0,
    fishCaught: 0,
    lastStorm: 0,
    stormsSurvived: 0,
    lastSupplyDrop: 0,
    supplyDrops: 0,
    interactionCount: 0,
    eliminatedUntil: 0,
    achievementsEarned: [],
    hasCreatorCode: false,
    creatorDiscount: 0,
    freeSkinExpiry: 0,
    freeSkinRedeemed: false,
    freeSkinIds: [],
    shopPurchases: 0,
    shopSkins: [],
    shopSkinPrices: {},
    refundCooldowns: {},
    coinflipsWon: 0,
    coinflipsPlayed: 0,
    giftsGiven: 0,
    tradesCompleted: 0,
    timesBuilt: 0,
    duelsPlayed: 0,
    zeropointUses: 0,
    vbucksChecked: 0,
    boxesOpened: 0,
    spawnCatches: 0,
    brokeAttempt: false,
    hasMusicPass: false,
    musicPassExpiry: 0,
    quests: [],
    questProgress: {},
    questLastReset: 0,
    foundersQuests: [],
    foundersQuestProgress: {},
    stwPacks: 0,
    stwQuestBaseline: {},
    stwQuestCompleted: [],
    hackedFreeShop: false,
    equippedSkins: [],
  };
}

function defaultStore() {
  return {
    users: {},
    itemShop: { skins: [], lastReset: 0 },
    musicPass: { skin: null, lastReset: 0, purchasers: [] },
    spawnChannels: {},
    coinflipChallenges: {},
    crewCodes: {},
  };
}

function xpForLevel(level) {
  return level * 200;
}

function calculateLevelFromXP(xp) {
  let level = 1, total = 0;
  while (total + xpForLevel(level) <= xp) {
    total += xpForLevel(level);
    level++;
  }
  return level;
}
function getUser(userId) {
  if (!_db.users[userId]) {
    _db.users[userId] = defaultUser();
    save();
  }
  const def = defaultUser();
  let changed = false;
  for (const [k, v] of Object.entries(def)) {
    if (_db.users[userId][k] === undefined) {
      _db.users[userId][k] = v;
      changed = true;
    }
  }
  if (changed) save();
  return _db.users[userId];
}

function updateUser(userId, updates) {
  const user = getUser(userId);
  Object.assign(user, updates);
  save();
}

function getAllUsers() {
  return _db.users;
}
function addVbucks(userId, amount) {
  const user = getUser(userId);
  if (user.infiniteVbucks && amount < 0) return;
  user.vbucks = Math.max(0, (user.vbucks || 0) + amount);
  save();
}

function removeVbucks(userId, amount) {
  addVbucks(userId, -Math.abs(amount));
}

function addXP(userId, amount) {
  const user = getUser(userId);
  user.xp = (user.xp || 0) + amount;
  user.level = calculateLevelFromXP(user.xp);
  save();
}
function addInteraction(userId) {
  const user = getUser(userId);
  user.interactionCount = (user.interactionCount || 0) + 1;
  const gainedVbucks = user.interactionCount % 30 === 0;
  if (gainedVbucks) {
    user.vbucks = (user.vbucks || 0) + 250;
  }
  save();
  return { gainedVbucks };
}
function addSkinToInventory(userId, skinId, skinName) {
  const user = getUser(userId);
  if (!user.inventory.includes(skinId)) {
    user.inventory.push(skinId);
  }
  user.inventoryNames[skinId + "_" + Date.now()] = skinName;
  save();
}

function equipSkin(userId, skinId) {
  const user = getUser(userId);
  user.equippedSkin = skinId;
  save();
}

function getLocker(userId) {
  const user = getUser(userId);
  return {
    skins: Object.entries(user.inventoryNames).map(([k, n]) => ({ key: k, name: n })),
    equipped: user.equippedSkin,
  };
}
const DAILY_QUEST_POOL = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",            xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                  xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",             xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",       xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];

function freshQuests() {
  return DAILY_QUEST_POOL.map((q) => ({ ...q, progress: 0, completed: false }));
}

function resetQuestsIfNeeded(userId) {
  const user = getUser(userId);
  const now = Date.now(), day = 24 * 60 * 60 * 1000;
  if (!user.questLastReset || now - user.questLastReset > day) {
    user.quests = freshQuests();
    user.questProgress = {};
    user.questLastReset = now;
    save();
  }
}

function progressQuest(userId, questId) {
  const user = getUser(userId);
  if (!user.quests || !user.quests.length) return;
  const quest = user.quests.find((q) => q.id === questId);
  if (!quest || quest.completed) return;
  quest.progress = (quest.progress || 0) + 1;
  if (quest.progress >= quest.required) {
    quest.completed = true;
    addXP(userId, quest.xpReward);
  }
  save();
}
const FOUNDERS_QUEST_POOL_DATA = [
  { id: "catch_skins_3",  label: "Catch 3 skins",             stat: "spawnCatches",    required: 3    },
  { id: "catch_skins_5",  label: "Catch 5 skins",             stat: "spawnCatches",    required: 5    },
  { id: "win_flip_1",     label: "Win 1 coin flip",           stat: "coinflipsWon",    required: 1    },
  { id: "win_flip_3",     label: "Win 3 coin flips",          stat: "coinflipsWon",    required: 3    },
  { id: "buy_shop_1",     label: "Buy a skin from Shop",      stat: "shopPurchases",   required: 1    },
  { id: "open_stw",       label: "Open 1 STW Box",            stat: "boxesOpened",     required: 1    },
  { id: "daily_claim",    label: "Claim daily reward",        stat: "dailyStreak",     required: 1    },
  { id: "earn_xp_300",    label: "Earn 300 XP",               stat: "xp",              required: 300  },
  { id: "level_3",        label: "Reach Level 3",             stat: "level",           required: 3    },
];

function assignFoundersQuests(userId) {
  const user = getUser(userId);
  if (!user.hasFoundersPack) return;
  const shuffled = [...FOUNDERS_QUEST_POOL_DATA].sort(() => Math.random() - 0.5).slice(0, 3);
  user.foundersQuests = shuffled.map((q) => ({ ...q, completed: false }));
  user.foundersQuestProgress = {};
  save();
}

function checkFoundersQuests(userId) {
  const user = getUser(userId);
  if (!user.foundersQuests || !user.foundersQuests.length) return [];
  const completed = [];
  for (const q of user.foundersQuests) {
    if (q.completed) continue;
    const val = user[q.stat] || 0;
    if (val >= q.required) {
      q.completed = true;
      completed.push(q.label);
    }
  }
  if (completed.length) save();
  return completed;
}
function isEliminated(userId) {
  const user = getUser(userId);
  return (user.eliminatedUntil || 0) > Date.now();
}

function getEliminationTimeLeft(userId) {
  const user = getUser(userId);
  return Math.max(0, (user.eliminatedUntil || 0) - Date.now());
}
function hasActiveFreeSkin(userId) {
  const user = getUser(userId);
  return (user.freeSkinExpiry || 0) > Date.now() && !(user.freeSkinRedeemed || false);
}
function getItemShop() {
  return _db.itemShop;
}

function setItemShop(skins) {
  _db.itemShop = { skins, lastReset: Date.now() };
  save();
}
function setPendingGift(recipientId, gift) {
  if (!_db.pendingGifts) _db.pendingGifts = {};
  _db.pendingGifts[recipientId] = gift;
  save();
}

function getPendingGift(recipientId) {
  if (!_db.pendingGifts) return null;
  return _db.pendingGifts[recipientId] ?? null;
}

function deletePendingGift(recipientId) {
  if (!_db.pendingGifts) return;
  delete _db.pendingGifts[recipientId];
  save();
}
function getMusicPassData() {
  return _db.musicPass;
}

function setMusicPass(skin) {
  _db.musicPass.skin = skin;
  _db.musicPass.lastReset = Date.now();
  _db.musicPass.purchasers = [];
  save();
}

function addMusicPassPurchaser(userId) {
  if (!_db.musicPass.purchasers) _db.musicPass.purchasers = [];
  if (!_db.musicPass.purchasers.includes(userId)) {
    _db.musicPass.purchasers.push(userId);
    save();
  }
}

function isMusicPassPurchaser(userId) {
  return (_db.musicPass.purchasers || []).includes(userId);
}
function getSpawnChannel(guildId) {
  return _db.spawnChannels[guildId] || null;
}

function setSpawnChannel(guildId, channelId) {
  _db.spawnChannels[guildId] = channelId;
  save();
}

function getAllGuildSpawnChannels() {
  return _db.spawnChannels || {};
}
function setCoinflipChallenge(id, data) {
  _db.coinflipChallenges[id] = data;
  save();
}

function getCoinflipChallenge(id) {
  return _db.coinflipChallenges[id] || null;
}

function deleteCoinflipChallenge(id) {
  delete _db.coinflipChallenges[id];
  save();
}
function addCrewCode(code) {
  _db.crewCodes[code] = { used: false, usedBy: null, createdAt: Date.now() };
  save();
}

function getCrewCode(code) {
  return _db.crewCodes[code] || null;
}

function redeemCrewCode(code, userId) {
  if (_db.crewCodes[code]) {
    _db.crewCodes[code].used   = true;
    _db.crewCodes[code].usedBy = userId;
    save();
  }
}
const express = require("express");
const app = express();
app.use(express.json());
app.use("/skins", express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
app.get("/check", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.listen(PORT, () => console.log(`Express server on port ${PORT}`));
const VBUCKS_IMAGE   = "https://fortnite-api.com/images/vbuck.png";
const FP_PACK_IMAGE  = "https://static.wikia.nocookie.net/fortnite/images/4/4d/Founders_Pack_-_Icon.png";
const FP_BOX_IMAGE   = "https://static.wikia.nocookie.net/fortnite/images/9/98/Llama-_Standard.png";
const STW_LOGO_IMAGE = "https://static.wikia.nocookie.net/fortnite/images/a/a3/Save_the_World_-_Logo.png";
const LUCK_POT_IMG   = "https://static.wikia.nocookie.net/fortnite/images/f/f2/Slurp_Juice_-_Consumable_-_Fortnite.png";
const ZERO_PT_IMAGE  = "https://static.wikia.nocookie.net/fortnite/images/a/a5/Zero_Point.png";
const LLAMA_IMAGE    = "https://static.wikia.nocookie.net/fortnite/images/9/98/Llama-_Standard.png";
const SUPPLY_IMAGE   = "https://static.wikia.nocookie.net/fortnite/images/b/b6/Supply_Drop_-_Default_-_Fortnite.png";
const BUS_IMAGE      = "https://static.wikia.nocookie.net/fortnite/images/7/70/Battle_Bus_%28V10.40%29.png";

const SHOP_RESET_MS       = 24 * 60 * 60 * 1000;
const SKIN_PRICE          = 1500;
const BUNDLE_PRICE        = 4000;
const MUSIC_PASS_RESET_MS = 24 * 60 * 60 * 1000;
const MUSIC_PASS_COST     = 1000;
const FORTNITE_WEAPONS = [
  { id: "pump_shotgun",       name: "Pump Shotgun",            emoji: "🔫", type: "shotgun",   description: "One pump — if it lands."              },
  { id: "heavy_sniper",       name: "Heavy Sniper Rifle",       emoji: "🎯", type: "sniper",    description: "Walls? What walls?"                   },
  { id: "scar",               name: "SCAR",                     emoji: "⚡", type: "ar",        description: "The gold standard of ARs."            },
  { id: "rocket_launcher",    name: "Rocket Launcher",          emoji: "🚀", type: "explosive", description: "Shoot first, aim never."              },
  { id: "bolt_sniper",        name: "Bolt-Action Sniper Rifle", emoji: "🎯", type: "sniper",    description: "Patience is a virtue."                },
  { id: "hand_cannon",        name: "Hand Cannon",              emoji: "🔫", type: "pistol",    description: "A pistol with stopping power."        },
  { id: "combat_shotgun",     name: "Combat Shotgun",           emoji: "💥", type: "shotgun",   description: "Fast fire, no mercy."                 },
  { id: "grenade_launcher",   name: "Grenade Launcher",         emoji: "💣", type: "explosive", description: "Indirect fire specialist."            },
  { id: "stinger_smg",        name: "Stinger SMG",              emoji: "⚡", type: "smg",       description: "Up close and very personal."          },
  { id: "thermal_scoped",     name: "Thermal Scoped AR",        emoji: "🔭", type: "ar",        description: "Nobody hides from this."              },
  { id: "rapid_fire_smg",     name: "Rapid Fire SMG",           emoji: "💨", type: "smg",       description: "Half the accuracy, twice the panic."  },
  { id: "mythic_goldfish",    name: "Mythic Goldfish",           emoji: "🐟", type: "special",   description: "It's a fish. A very powerful fish."  },
  { id: "flint_knock",        name: "Flintlock Pistol",         emoji: "🔫", type: "pistol",    description: "Knocks them back to the Stone Age."  },
  { id: "minigun",            name: "Minigun",                  emoji: "🔥", type: "ar",        description: "Sustained fire destroyer."            },
  { id: "shockwave_launcher", name: "Shockwave Launcher",       emoji: "💫", type: "explosive", description: "Not lethal. Just humiliating."        },
];
const MULTI_AMMO_TYPES = new Set(["smg", "ar"]);
function isMultiAmmoWeapon(w) { return MULTI_AMMO_TYPES.has(w.type); }
function getWeaponByName(name) {
  const q = name.toLowerCase().trim();
  return FORTNITE_WEAPONS.find((w) => w.name.toLowerCase() === q || w.id === q || w.name.toLowerCase().includes(q));
}
function randomWeapon() { return FORTNITE_WEAPONS[Math.floor(Math.random() * FORTNITE_WEAPONS.length)]; }

const RARITY_WEIGHTS = { legendary: 5, epic: 10, rare: 20, uncommon: 30, common: 35 };
const FISH_SPOTS = ["Pleasant Park","Lazy Lake","Tilted Towers","Slurpy Swamp","Misty Meadows","Coral Castle","Holly Hatchery","Dirty Docks","Steamy Stacks"];
const FISH_TABLE = [
  { name: "Small Fry",      emoji: "🐟", weight: 30, action: (uid) => { addXP(uid, 75);                    return "A tiny **Small Fry**! +75 XP"; } },
  { name: "Flopper",        emoji: "🐠", weight: 25, action: (uid) => { addVbucks(uid, 200);                return "A **Flopper**! +200 V-Bucks"; } },
  { name: "Slurpfish",      emoji: "🐡", weight: 15, action: (uid) => { addXP(uid, 200); addVbucks(uid, 100); return "A **Slurpfish**! +200 XP + 100 V-Bucks"; } },
  { name: "Shield Fish",    emoji: "🛡️", weight: 10, action: (uid) => { const u = getUser(uid); updateUser(uid, { buildCharges: (u.buildCharges||0)+1, buildMaterial: u.buildMaterial==="none"?"wood":u.buildMaterial }); return "A **Shield Fish**! +1 build charge"; } },
  { name: "Mythic Goldfish", emoji: "✨", weight: 3,  action: (uid) => { const u = getUser(uid); updateUser(uid, { weapons: [...(u.weapons||[]), "Mythic Goldfish"] }); return "✨ **THE MYTHIC GOLDFISH!** Added to your arsenal!"; } },
  { name: "Junk",           emoji: "🗑️", weight: 12, action: (uid) => { addVbucks(uid, -50);                return "Junk! You lost 50 V-Bucks pulling it out"; } },
  { name: "Supply Chest",   emoji: "📦", weight: 5,  action: (uid) => { const u = getUser(uid); updateUser(uid, { boxes: (u.boxes||0)+1 }); return "A **Supply Chest** underwater! +1 STW Box"; } },
];
function weightedFish() {
  const total = FISH_TABLE.reduce((a,b)=>a+b.weight,0); let r = Math.random()*total;
  for (const f of FISH_TABLE) { r -= f.weight; if (r<=0) return f; } return FISH_TABLE[0];
}
const DROP_LOCATIONS = [
  { name: "Tilted Towers",  emoji: "🏙️", bonus: "hotspot", desc: "Hot drop! Contested. High risk, high reward." },
  { name: "Pleasant Park",  emoji: "🏘️", bonus: "xp",      desc: "Chill suburban vibes. Good XP gains."         },
  { name: "Lazy Lake",      emoji: "🏞️", bonus: "vbucks",  desc: "A quiet lake town hiding V-Bucks."            },
  { name: "Slurpy Swamp",   emoji: "🌿", bonus: "heal",    desc: "Healing waters flow here."                    },
  { name: "Steamy Stacks",  emoji: "🏭", bonus: "weapon",  desc: "Industrial zone. Weapons everywhere."         },
  { name: "Holly Hatchery", emoji: "🌲", bonus: "sneak",   desc: "Dense cover. Sneaky plays."                   },
  { name: "Coral Castle",   emoji: "🐚", bonus: "special", desc: "Mysterious underwater ruins."                 },
  { name: "Dirty Docks",    emoji: "⚓", bonus: "vbucks",  desc: "Shipping containers full of loot."            },
  { name: "Sweaty Sands",   emoji: "🏖️", bonus: "llama",   desc: "Llamas spotted on the beach!"                },
];
const FORTNITE_POIS = ["Tilted Towers","Pleasant Park","Lazy Lake","Slurpy Swamp","Retail Row","Misty Meadows","Steamy Stacks","Coral Castle","Holly Hatchery","Dirty Docks","Sweaty Sands","Craggy Cliffs","Catty Corner","Stark Industries","Authority"];
const BUILD_MATS = {
  wood:  { label: "🪵 Wood",  cost: 50,  charges: 1, desc: "Basic protection. Blocks 1 hit." },
  brick: { label: "🧱 Brick", cost: 125, charges: 2, desc: "Sturdy. Blocks 2 hits."          },
  metal: { label: "⚙️ Metal", cost: 250, charges: 3, desc: "Maximum defense. Blocks 3 hits." },
};
const STORM_EVENTS = [
  { name: "Safe Zone 🟢",    chance: 35, color: 0x00ff00, fn: (uid) => { addXP(uid, 100);         return "You're in the **safe zone**! +100 XP"; } },
  { name: "Storm Edge ⚠️",  chance: 25, color: 0xffaa00, fn: (uid) => { addVbucks(uid, -100);     return "You're on the **storm edge**! -100 V-Bucks"; } },
  { name: "Eye of Storm ⭐", chance: 15, color: 0xf4a01a, fn: (uid) => { addVbucks(uid, 500); addXP(uid, 200); return "You found the **Eye of the Storm**! +500 V-Bucks + 200 XP!"; } },
  { name: "In the Storm ☠️",chance: 20, color: 0xff0000, fn: (uid) => { addVbucks(uid, -250);     return "You're deep **inside the storm**! -250 V-Bucks"; } },
  { name: "Storm Surge ⚡",  chance: 5,  color: 0x9b4dca, fn: (uid) => { updateUser(uid, { eliminatedUntil: Date.now() + 3*60*1000 }); return "**Storm surge!** You were knocked down! Eliminated for 3 minutes"; } },
];
function rollStorm() {
  const total = STORM_EVENTS.reduce((a,b)=>a+b.chance,0); let r=Math.random()*total;
  for (const e of STORM_EVENTS) { r-=e.chance; if(r<=0) return e; } return STORM_EVENTS[0];
}
function getBattlePassTier(level, xp) { return Math.min(100, Math.floor(level*2 + xp/300)); }
const BP_REWARDS = [
  { tier: 5,   reward: "🎒 Spray: No Sweat"       },
  { tier: 10,  reward: "💃 Emote: Floss"           },
  { tier: 15,  reward: "🎒 Back Bling: Shield Can" },
  { tier: 20,  reward: "🔫 Wrap: Tiger"            },
  { tier: 30,  reward: "🎮 Loading Screen"         },
  { tier: 40,  reward: "👟 Contrail: Hearts"       },
  { tier: 50,  reward: "🌟 Outfit: Midas"          },
  { tier: 60,  reward: "🎭 Emote: On The Hook"     },
  { tier: 75,  reward: "💎 Glider: Midas' Drum"   },
  { tier: 100, reward: "👑 Full Gold Midas Skin!"  },
];
const VALID_CODES = {
  tylajadee:      { displayName: "Tylajadee",      discount: 0.1, freeSkin: true },
  ultravioletkaty:{ displayName: "ultravioletkaty", discount: 0.1 },
  clovel:         { displayName: "Clovel",          discount: 0.2 },
};
const DAILY_QUESTS = [
  { id: "catch_skins",    label: "Catch 3 spawned skins",            xpReward: 300, required: 3 },
  { id: "win_coinflip",   label: "Win a coin flip",                  xpReward: 200, required: 1 },
  { id: "check_shop",     label: "Browse the item shop",             xpReward: 100, required: 1 },
  { id: "check_vbucks",   label: "Check your V-Bucks balance",       xpReward:  50, required: 1 },
  { id: "challenge_flip", label: "Challenge someone to a coin flip", xpReward: 150, required: 1 },
];
const LUCK_BOOST = { none: 0, normal: 15, xtra: 40, godly: 80 };
function boostedChance(base, luck) { return Math.min(base + (LUCK_BOOST[luck] || 0), 99); }
function roll(pct) { return Math.random() * 100 < pct; }
const FOUNDERS_QUEST_POOL = [
  { id: "catch_skins_3",  label: "Catch 3 skins",             stat: "spawnCatches",    required: 3    },
  { id: "catch_skins_5",  label: "Catch 5 skins",             stat: "spawnCatches",    required: 5    },
  { id: "win_flip_1",     label: "Win 1 coin flip",           stat: "coinflipsWon",    required: 1    },
  { id: "win_flip_3",     label: "Win 3 coin flips",          stat: "coinflipsWon",    required: 3    },
  { id: "buy_shop_1",     label: "Buy a skin from Shop",      stat: "shopPurchases",   required: 1    },
  { id: "open_stw",       label: "Open 1 STW Box",            stat: "boxesOpened",     required: 1    },
  { id: "daily_claim",    label: "Claim daily reward",        stat: "dailyStreak",     required: 1    },
  { id: "use_zeropoint",  label: "Use /zeropoint",            stat: "zeropointUses",   required: 1    },
  { id: "trade_skin",     label: "Complete a trade",          stat: "tradesCompleted", required: 1    },
  { id: "gift_skin",      label: "Gift a skin",               stat: "giftsGiven",      required: 1    },
  { id: "earn_xp_300",    label: "Earn 300 XP",               stat: "xp",              required: 300  },
  { id: "earn_xp_1000",   label: "Earn 1,000 XP",            stat: "xp",              required: 1000 },
  { id: "level_3",        label: "Reach Level 3",             stat: "level",           required: 3    },
  { id: "open_llama",     label: "Open a Supply Llama",       stat: "llamaOpens",      required: 1    },
  { id: "go_fishing",     label: "Catch something fishing",   stat: "fishCaught",      required: 1    },
  { id: "survive_storm",  label: "Survive storm 3 times",     stat: "stormsSurvived",  required: 3    },
  { id: "supply_drop_1",  label: "Call in a supply drop",     stat: "supplyDrops",     required: 1    },
  { id: "duel_someone",   label: "Challenge someone to duel", stat: "duelsPlayed",     required: 1    },
  { id: "build_up",       label: "Build a structure",         stat: "timesBuilt",      required: 1    },
];
const ALL_ACHIEVEMENTS = [
  { id: "first_catch",     title: "First Catch",                  emoji: "🎮", description: "Catch your first spawned skin",               check: (u) => u.inventory.length >= 1 },
  { id: "collector",       title: "Collector",                    emoji: "🎒", description: "Own 10 skins",                                check: (u) => u.inventory.length >= 10 },
  { id: "hoarder",         title: "Hoarder",                      emoji: "📦", description: "Own 50 skins",                                check: (u) => u.inventory.length >= 50 },
  { id: "shop_regular",    title: "Shop Regular",                 emoji: "🛒", description: "Buy a skin from the Item Shop",               check: (u) => (u.shopPurchases??0) >= 1 },
  { id: "big_spender",     title: "Big Spender",                  emoji: "💸", description: "Buy 5 skins from the Item Shop",              check: (u) => (u.shopPurchases??0) >= 5 },
  { id: "generous",        title: "Generous",                     emoji: "🎁", description: "Gift a skin to another player",               check: (u) => (u.giftsGiven??0) >= 1 },
  { id: "trader",          title: "Trader",                       emoji: "🔄", description: "Complete a skin trade",                       check: (u) => (u.tradesCompleted??0) >= 1 },
  { id: "lucky_flip",      title: "Lucky Flip",                   emoji: "🪙", description: "Win a coin flip",                             check: (u) => (u.coinflipsWon??0) >= 1 },
  { id: "flip_master",     title: "Flip Master",                  emoji: "🎰", description: "Win 10 coin flips",                           check: (u) => (u.coinflipsWon??0) >= 10 },
  { id: "box_opener",      title: "Box Opener",                   emoji: "📬", description: "Open a Save the World Box",                   check: (u) => (u.boxesOpened??0) >= 1 },
  { id: "stw_devotee",     title: "STW Devotee",                  emoji: "⚡", description: "Open 10 Save the World Boxes",                check: (u) => (u.boxesOpened??0) >= 10 },
  { id: "streak_starter",  title: "Streak Starter",               emoji: "🔥", description: "3-day daily streak",                          check: (u) => (u.dailyStreak??0) >= 3 },
  { id: "on_fire",         title: "On Fire",                      emoji: "🌋", description: "7-day daily streak",                          check: (u) => (u.dailyStreak??0) >= 7 },
  { id: "unstoppable",     title: "Unstoppable",                  emoji: "👑", description: "30-day daily streak",                         check: (u) => (u.dailyStreak??0) >= 30 },
  { id: "level_5",         title: "Rising Star",                  emoji: "⭐", description: "Reach Level 5",                               check: (u) => u.level >= 5 },
  { id: "level_10",        title: "Veteran",                      emoji: "🌟", description: "Reach Level 10",                              check: (u) => u.level >= 10 },
  { id: "level_25",        title: "Legend",                       emoji: "💫", description: "Reach Level 25",                              check: (u) => u.level >= 25 },
  { id: "wealthy",         title: "Wealthy",                      emoji: "💰", description: "Hold 5,000 V-Bucks at once",                  check: (u) => u.vbucks >= 5000 },
  { id: "rich",            title: "Rich",                         emoji: "💎", description: "Hold 10,000 V-Bucks at once",                 check: (u) => u.vbucks >= 10000 },
  { id: "broke",           title: "Broke",                        emoji: "🪙", description: "Tried to buy something you can't afford",     check: (u) => u.brokeAttempt === true },
  { id: "scammed",         title: "Scammed",                      emoji: "🤡", description: "Fell for a free vbucks scam",                 check: () => false },
  { id: "epic_likes_you",  title: "Epic Games Likes You",         emoji: "💚", description: "Get a refund approved",                       check: () => false },
  { id: "epic_hates_you",  title: "Epic Games Doesn't Like You", emoji: "💔", description: "Get a refund rejected",                       check: () => false },
  { id: "llama_opener",    title: "Llama Opener",                 emoji: "🦙", description: "Open your first Supply Llama",                check: (u) => (u.llamaOpens??0) >= 1 },
  { id: "llama_hoarder",   title: "Llama Hoarder",                emoji: "🦙", description: "Open 5 Supply Llamas",                        check: (u) => (u.llamaOpens??0) >= 5 },
  { id: "angler",          title: "Angler",                       emoji: "🎣", description: "Catch your first fish",                       check: (u) => (u.fishCaught??0) >= 1 },
  { id: "master_angler",   title: "Master Angler",                emoji: "🐟", description: "Catch 10 fish",                               check: (u) => (u.fishCaught??0) >= 10 },
  { id: "goldfish",        title: "It's a Goldfish",              emoji: "✨", description: "Fish up the Mythic Goldfish",                 check: () => false },
  { id: "storm_survivor",  title: "Storm Survivor",               emoji: "🌪️", description: "Survive the storm 5 times",                    check: (u) => (u.stormsSurvived??0) >= 5 },
  { id: "builder",         title: "Builder",                      emoji: "🏗️", description: "Build your first structure",                   check: (u) => (u.timesBuilt??0) >= 1 },
  { id: "master_builder",  title: "Master Builder",               emoji: "🏰", description: "Build 10 structures",                         check: (u) => (u.timesBuilt??0) >= 10 },
  { id: "duel_champion",   title: "Duel Champion",                emoji: "⚔️", description: "Win a duel",                                  check: () => false },
  { id: "battle_pass_100", title: "Battle Pass Complete",         emoji: "👑", description: "Reach Battle Pass Tier 100",                  check: (u) => getBattlePassTier(u.level, u.xp) >= 100 },
];

function checkAndAwardAchievements(userId) {
  const user = getUser(userId);
  const newlyEarned = [];
  for (const ach of ALL_ACHIEVEMENTS) {
    if (!user.achievementsEarned.includes(ach.id) && ach.check(user)) {
      user.achievementsEarned.push(ach.id);
      newlyEarned.push(ach.title);
    }
  }
  if (newlyEarned.length) updateUser(userId, { achievementsEarned: user.achievementsEarned });
  return newlyEarned;
}
function awardAchievement(userId, achId) {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
  if (!ach) return null;
  const user = getUser(userId);
  if (user.achievementsEarned.includes(achId)) return null;
  updateUser(userId, { achievementsEarned: [...user.achievementsEarned, achId] });
  return ach;
}
function buildAchievementEmbed(ach) {
  return new EmbedBuilder().setTitle(`${ach.emoji} Achievement Unlocked!`).setDescription(`**${ach.title}**\n*${ach.description}*`).setColor(0xf4a01a).setTimestamp();
}
const SKIN_BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/skins`
  : `http://localhost:${process.env.PORT || 3000}/skins`;

const CUSTOM_SKINS = [
  { id:"custom_megan",          name:"Megan",            description:"Your just a gameboy.",                              rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292223901110342/file_00000000c49071f48b40e4646744b881-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=60e3a93518d5635a4be2e9006043012f64b5e856ed6dd670b7201a221b72398f&", isStw:false, isCustom:true },
  { id:"custom_manon",          name:"Manon",            description:"I go M.I.A!",                                       rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292224228130997/file_00000000b7c8720a84acd8f392c65c4d-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=4f3003d52790adc4770a4e5f2d8fb08bd75590ff0bdd669a78f432e11ee1ac83&", isStw:false, isCustom:true },
  { id:"custom_lara",           name:"Lara",             description:"This aint a debut.",                                rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292224538644562/Screenshot_20260514_010522_CapCut-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=7cb6b539387ea9d62d54544de0f3ebf60b30e621ea9af98bb01c617e42582bae&", isStw:false, isCustom:true },
  { id:"custom_daniela",        name:"Daniela",          description:"Gnarly.",                                           rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292224878514267/Screenshot_20260514_010604_CapCut-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=620dc4b71d4bb6948d11fd71729ce7c078da67542fd48853ce96333ac3f3fba3&", isStw:false, isCustom:true },
  { id:"custom_yoonchae",       name:"Yoonchae",         description:"Party in the hollywood hills.",                     rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292225272774830/Screenshot_20260514_010636_CapCut-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=8b49a18f0456570b1197c2246b3b600651127079c954d845c15c54abd540caad&", isStw:false, isCustom:true },
  { id:"custom_sophia",         name:"Sophia",           description:"If you get a call from Gabriela, hang up.",         rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292225599803432/Screenshot_20260514_010728_CapCut-removebg-preview.png?ex=6a0674ce&is=6a05234e&hm=99a0e39909fc7cd602faa95246ee5775fbebeb80f21e714cbed04225aafa9275&", isStw:false, isCustom:true },
  { id:"custom_manon_pinkyup",    name:"Manon (PINKY UP)",    description:"It's 6. Not 5.",                               rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292225939542016/Screenshot_20260514_010847_CapCut-removebg-preview.png?ex=6a0674cf&is=6a05234f&hm=4d886652c5780a7a319d10f8394c9dc707b51332496efddcddd963b6cda80bf1&", isStw:false, isCustom:true },
  { id:"custom_yoonchae_pinkyup", name:"Yoonchae (PINKY UP)", description:"The only true wisdom is knowing you know nothing.", rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292226367229992/Screenshot_20260514_011001_CapCut-removebg-preview.png?ex=6a0674cf&is=6a05234f&hm=40f216201f1345c8eb36958c817f54b7dd7a90b38988176c744fed9b1ac1eacb&", isStw:false, isCustom:true },
  { id:"custom_sophia_pinkyup",   name:"Sophia (PINKY UP)",   description:"She's screaming from cloud nine.",             rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292226770014399/Screenshot_20260514_010921_CapCut-removebg-preview.png?ex=6a0674cf&is=6a05234f&hm=99a0e39909fc7cd602faa95246ee5775fbebeb80f21e714cbed04225aafa9275&", isStw:false, isCustom:true },
  { id:"custom_lara_pinkyup",     name:"Lara (PINKY UP)",     description:"I bet it goes like this.",                     rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292227235447045/Screenshot_20260514_011053_CapCut-removebg-preview.png?ex=6a0674cf&is=6a05234f&hm=5eb96d02e15d02cad654fbaaaa17cf74eba8fd84dc1e755fcfd8138698bd929a&", isStw:false, isCustom:true },
  { id:"custom_daniela_pinkyup",  name:"Daniela (PINKY UP)",  description:"Us against the world shake and shake in the parking lot.", rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292276845940848/Screenshot_20260514_011145_CapCut-removebg-preview.png?ex=6a0674db&is=6a05235b&hm=2f6199f81e1076c6af712197fbc5b8c2c7983dc92c5a2799a6bdcaf8b8117b97&", isStw:false, isCustom:true },
  { id:"custom_megan_pinkyup",    name:"Megan (PINKY UP)",    description:"No can touch em if they tried.",              rarity:"Icon", imageUrl:"https://cdn.discordapp.com/attachments/1244713742281871380/1504292277160382554/Screenshot_20260514_011243_CapCut-removebg-preview.png?ex=6a0674db&is=6a05235b&hm=2bf017ff773b8411a75b2d2f0c0fa2bf95d377217759f275d94d4df7d50e8ca1&", isStw:false, isCustom:true },
];
const STATIC_BUNDLES = [
  {
    id: "bundle_eyekonic",
    name: "EYEKONIC Bundle",
    rarity: "Icon",
    imageUrl: "https://cdn.discordapp.com/attachments/1504485556325715980/1504534511734755418/250701-eyekons-global-membership-is-officially-open-v0-wz97d3saEhaS8vrod4ixzNY0QxorUEbCSmRWHTpJiSg.jpg?ex=6a07ff34&is=6a06adb4&hm=1b7dda52f15c7f150c66f2e21185e371649d5457d70cb7aff616c2a0004dad92&",
    price: BUNDLE_PRICE,
    isBundle: true,
    skins: [
      { id: "custom_megan",    name: "Megan"    },
      { id: "custom_manon",    name: "Manon"    },
      { id: "custom_sophia",   name: "Sophia"   },
      { id: "custom_lara",     name: "Lara"     },
      { id: "custom_daniela",  name: "Daniela"  },
      { id: "custom_yoonchae", name: "Yoonchae" },
    ],
  },
  {
    id: "bundle_pinkyup",
    name: "PINKY UP Bundle",
    rarity: "Icon",
    imageUrl: "https://cdn.discordapp.com/attachments/1504485556325715980/1504534511327772682/channels4_profile.jpg?ex=6a07ff34&is=6a06adb4&hm=ad77502395150f5fb7851507d58beff19a56bc3c357ff08fe881ae56c60132ed&",
    price: BUNDLE_PRICE,
    isBundle: true,
    skins: [
      { id: "custom_manon_pinkyup",    name: "Manon (PINKY UP)"    },
      { id: "custom_yoonchae_pinkyup", name: "Yoonchae (PINKY UP)" },
      { id: "custom_sophia_pinkyup",   name: "Sophia (PINKY UP)"   },
      { id: "custom_lara_pinkyup",     name: "Lara (PINKY UP)"     },
      { id: "custom_daniela_pinkyup",  name: "Daniela (PINKY UP)"  },
      { id: "custom_megan_pinkyup",    name: "Megan (PINKY UP)"    },
    ],
  },
];

let _overwatchBundleCache = null;
async function getOverwatchBundle() {
  if (_overwatchBundleCache) return _overwatchBundleCache;
  const skins = await fetchFortniteSkins();
  const OW_TERMS = ["tracer","mercy","genji","d.va"];
  const owSkins = skins.filter(s => OW_TERMS.some(t => s.name.toLowerCase().includes(t)));
  const chosen = owSkins.length >= 3 ? owSkins.slice(0,6) : skins.filter(s => s.rarity.toLowerCase() === "epic").slice(0,6);
  _overwatchBundleCache = {
    id: "bundle_overwatch",
    name: "Overwatch Bundle",
    rarity: "Epic",
    imageUrl: "https://cdn.discordapp.com/attachments/1504485556325715980/1504535529474232391/fortnite-x-overwatch-all-skins-emotes-prices-full-showcase.jpg?ex=6a080027&is=6a06aea7&hm=053ee4016f3e9fe9a6d76caf5523140a0d1ea2bb899a50e150e7e8eb93a7716f&",
    price: BUNDLE_PRICE,
    isBundle: true,
    skins: chosen.map(s => ({ id: s.id, name: s.name, imageUrl: s.imageUrl })),
  };
  return _overwatchBundleCache;
}
async function getAllBundles() {
  const ow = await getOverwatchBundle();
  return [...STATIC_BUNDLES, ow];
}
function getBundleById(id) {
  return STATIC_BUNDLES.find(b => b.id === id) ?? null;
}
const STW_KEYWORDS = ["robo","kevin","save the world","constructor","ninja","outlander","soldier","commando","striker","ramirez","headhunter","jonesy","penny","dim mak","brawler","dragon","powerhouse","hazard","renegade","urban assault","special forces"];
const KNOWN_STW_IDS = ["CID_028_Athena_Commando_F","CID_029_Athena_Commando_F_Halloween","CID_017_Athena_Commando_M","CID_040_Athena_Commando_M_NinjaBlue"];
let cachedSkins = [], cachedStwSkins = [];

async function fetchFortniteSkins() {
  if (cachedSkins.length > 0) return cachedSkins;
  try {
    const res = await fetch("https://fortnite-api.com/v2/cosmetics/br", { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const apiSkins = json.data.filter((s) => {
      if (s.type?.value !== "outfit") return false;
      const name = s.name?.trim();
      if (!name || name === "null" || name === "TBD" || name.toLowerCase().startsWith("tid_")) return false;
      const img = s.images?.featured || s.images?.icon || s.images?.small;
      return img && img.trim() !== "" && img !== "null";
    }).map((s) => {
      const nameLower = s.name.toLowerCase(), descLower = (s.description ?? "").toLowerCase();
      const tags = (s.gameplayTags ?? []).join(" ").toLowerCase();
      const isStw = KNOWN_STW_IDS.includes(s.id) || STW_KEYWORDS.some((k) => nameLower.includes(k) || descLower.includes(k) || tags.includes(k));
      return { id: s.id, name: s.name, description: s.description && s.description !== "null" ? s.description : "A Fortnite outfit.", rarity: s.rarity?.displayValue || "Common", imageUrl: s.images?.featured || s.images?.icon || s.images?.small || "", isStw };
    });
    cachedSkins = [...CUSTOM_SKINS, ...apiSkins];
    cachedStwSkins = cachedSkins.filter((s) => s.isStw);
  } catch (err) {
    console.error("Failed to fetch skins:", err.message);
    cachedSkins = [...CUSTOM_SKINS, { id: "default", name: "Default", description: "A basic outfit.", rarity: "Common", imageUrl: "", isStw: false }];
    cachedStwSkins = [];
  }
  return cachedSkins;
}

function weightedRandom(skins) {
  const weights = skins.map((s) => RARITY_WEIGHTS[s.rarity.toLowerCase()] ?? 15);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < skins.length; i++) { rand -= weights[i]; if (rand <= 0) return skins[i]; }
  return skins[skins.length - 1];
}
async function getRandomSkin() { const s = await fetchFortniteSkins(); return weightedRandom(s); }
async function getStwSkins() { if (cachedStwSkins.length) return cachedStwSkins; await fetchFortniteSkins(); return cachedStwSkins; }
async function getRandomStwSkin() { const s = await getStwSkins(); return s.length ? s[Math.floor(Math.random() * s.length)] : null; }
async function getRandomShopSkins(n = 5) { const s = await fetchFortniteSkins(); return [...s].sort(() => Math.random() - 0.5).slice(0, n); }
async function findSkinByName(query) {
  const skins = await fetchFortniteSkins(), q = query.trim().toLowerCase();
  const exact = skins.find((s) => s.name.toLowerCase() === q);
  if (exact) return exact;
  const partial = skins.filter((s) => s.name.toLowerCase().includes(q));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) return partial.find((s) => s.name.toLowerCase().startsWith(q)) ?? partial[0];
  return null;
}
function getRarityColor(rarity) {
  const c = { legendary:0xf4a01a, epic:0x9b4dca, rare:0x0075e3, uncommon:0x1a9b1a, common:0x808080, marvel:0xed1d24, icon:0x00d4ff, "icon series":0x00d4ff, shadow:0x2c2c2c, slurp:0x00e5ff, frozen:0xa8d8ea, lava:0xff4500, dark:0x6a0dad, crew:0x4169e1, "crew series":0x4169e1 };
  return c[rarity.toLowerCase()] ?? 0x808080;
}
function getRarityEmoji(rarity) {
  const e = { legendary:"🟡", epic:"🟣", rare:"🔵", uncommon:"🟢", common:"⚪", marvel:"🔴", icon:"🩵", "icon series":"🩵", crew:"👑", "crew series":"👑" };
  return e[rarity.toLowerCase()] ?? "⚪";
}
function getSpawnPercent(rarity) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a,b) => a+b, 0);
  return (((RARITY_WEIGHTS[rarity.toLowerCase()] ?? 15) / total) * 100).toFixed(1);
}
async function getIconSkins() { const s = await fetchFortniteSkins(); return s.filter(s => { const r = s.rarity.toLowerCase(); return r === "icon" || r === "icon series"; }); }
async function getCrewSkin() {
  const skins = await fetchFortniteSkins();
  const crew = skins.filter(s => { const r = s.rarity.toLowerCase(); return r === "crew" || r === "crew series"; });
  if (crew.length) return { ...crew[Math.floor(Math.random()*crew.length)], rarity: "Crew Series" };
  const fallback = skins[Math.floor(Math.random()*skins.length)];
  return { ...fallback, rarity: "Crew Series" };
}
function generateCrewCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const seg = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}
async function getMusicPass() {
  const data = getMusicPassData();
  if (data.skin && Date.now() - data.lastReset < MUSIC_PASS_RESET_MS) return data.skin;
  const iconSkins = await getIconSkins();
  const pool = iconSkins.length ? iconSkins : await fetchFortniteSkins();
  const skin = pool[Math.floor(Math.random() * pool.length)];
  setMusicPass(skin);
  return skin;
}
async function ensureShopFresh() {
  const shop = getItemShop();
  if (shop.skins.length > 0 && Date.now() - shop.lastReset < SHOP_RESET_MS) return shop.skins;
  const skins = await getRandomShopSkins(5);
  const shopSkins = skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: SKIN_PRICE }));
  setItemShop(shopSkins);
  return shopSkins;
}
function getTimeUntilReset() {
  const msLeft = Math.max(0, SHOP_RESET_MS - (Date.now() - getItemShop().lastReset));
  return `${Math.floor(msLeft/3600000)}h ${Math.floor((msLeft%3600000)/60000)}m`;
}
async function openGodChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.godChest <= 0) return interaction.reply({ content: "❌ You have no God Chests!", ephemeral: true });
  updateUser(userId, { godChest: player.godChest - 1 });
  const luck = player.activeLuck;
  const mystChance = boostedChance(25, luck), vbChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < mystChance) {
    updateUser(userId, { mysteriousChest: (getUser(userId).mysteriousChest ?? 0) + 1 });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`open_myst_inline`).setLabel("🔵 Open Mysterious Chest Now").setStyle(ButtonStyle.Primary));
    const embed = new EmbedBuilder().setColor("#5865F2").setTitle("🔵 A Mysterious Chest appeared!").setDescription("A **BLUE MYSTERIOUS CHEST** emerged from the God Chest!\n\nOpen it to reveal its contents!").setFooter({ text: "Click to open!" });
    const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const col = reply.createMessageComponentCollector({ time: 60000 });
    col.on("collect", async (btn) => {
      if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
      await openMysteriousChestInteraction(btn, userId); col.stop();
    });
  } else if (rng < mystChance + vbChance) {
    addVbucks(userId, 1000);
    const updated = getUser(userId);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#FFD700").setTitle("🌟 God Chest — 1,000 V-Bucks!").setDescription(`You received **1,000 V-Bucks** from the God Chest!\nTotal: **${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌟 God Chest — Empty").setDescription("The God Chest glimmered... but was hollow inside.\n\nBetter luck next time!").setFooter({ text: `Myst: ${mystChance}% | 1k V-Bucks: ${vbChance}% | Nothing: rest` })] });
  }
}
async function openMysteriousChestInteraction(interaction, userId) {
  const player = getUser(userId);
  if (player.mysteriousChest <= 0) return interaction.reply({ content: "❌ You have no Mysterious Chests!", ephemeral: true });
  updateUser(userId, { mysteriousChest: player.mysteriousChest - 1 });
  const luck = player.activeLuck;
  const infChance = boostedChance(15, luck), tenKChance = boostedChance(25, luck);
  const rng = Math.random() * 100;
  if (rng < infChance) {
    updateUser(userId, { infiniteVbucks: true });
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — INFINITE V-BUCKS!").setDescription("✨ **INFINITE V-BUCKS!** ✨\nYour V-Bucks will **never go down** again!")] });
  } else if (rng < infChance + tenKChance) {
    addVbucks(userId, 10000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 10,000 V-Bucks!").setDescription(`You received **10,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  } else {
    addVbucks(userId, 1000);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("💠 Mysterious Chest — 1,000 V-Bucks").setDescription(`You received **1,000 V-Bucks**!\nTotal: **${getUser(userId).vbucks.toLocaleString()} V-Bucks**`)] });
  }
}
const FOUNDERS_BOX_TIERS = [
  { amount: 100, weight: 40 }, { amount: 200, weight: 30 },
  { amount: 350, weight: 20 }, { amount: 550, weight: 10 },
];
function rollFoundersBoxVbucks() {
  const total = FOUNDERS_BOX_TIERS.reduce((a,b) => a+b.weight, 0); let r = Math.random()*total;
  for (const t of FOUNDERS_BOX_TIERS) { r -= t.weight; if (r <= 0) return t.amount; } return 100;
}
const activeSpawns = {};
const spawnTimers = {};
let botClient = null;
const MIN_SPAWN_MS = 3 * 60 * 1000, MAX_SPAWN_MS = 5 * 60 * 1000;
function getNextSpawnDelay() { return MIN_SPAWN_MS + Math.random() * (MAX_SPAWN_MS - MIN_SPAWN_MS); }
function getActiveSpawn(guildId) { return activeSpawns[guildId] ?? null; }
function scheduleNextSpawn(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  if (activeSpawns[guildId]) return;
  spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
}

async function spawnRandom(client, guildId, channelId) {
  const r = Math.random();
  if (r < 1/35)  await spawnStwPacks(client, guildId, channelId);
  else if (r < 2/35) await spawnLuckPotion(client, guildId, channelId);
  else await spawnSkinOrBundle(client, guildId, channelId);
}

async function spawnSkinOrBundle(client, guildId, channelId, forced = false, specificSkin = null) {
  await spawnSkin(client, guildId, channelId, forced, specificSkin);
}

async function spawnSkin(client, guildId, channelId, forced = false, specificSkin) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const skin = specificSkin ?? await getRandomSkin();
    const embed = new EmbedBuilder()
      .setTitle(`${getRarityEmoji(skin.rarity)} **${skin.name}** has spawned!`)
      .setDescription(`*${skin.description}*\n\n✨ **Rarity:** ${skin.rarity}\n\nType \`buy\` to claim!`)
      .setColor(getRarityColor(skin.rarity))
      .setFooter({ text: "Fortnite Skin Catcher • First come, first served!" })
      .setTimestamp();
    if (skin.imageUrl) embed.setImage(skin.imageUrl);
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "skin", skin, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnBundle(client, guildId, channelId) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const bundles = await getAllBundles();
    const bundle = bundles[Math.floor(Math.random() * bundles.length)];
    const skinLines = bundle.skins.map(s => `• **${s.name}**`).join("\n");
    const embed = new EmbedBuilder()
      .setTitle(`🎁 **${bundle.name}** Bundle has spawned!`)
      .setDescription(`An exclusive **${bundle.name}** has appeared!\n\n**Includes:**\n${skinLines}\n\n💰 **Value: ${bundle.price.toLocaleString()} V-Bucks**\n\nType \`buy\` to claim all skins!`)
      .setColor(getRarityColor(bundle.rarity))
      .setFooter({ text: "Bundle Spawn • First come, first served!" })
      .setTimestamp();
    if (bundle.imageUrl) embed.setImage(bundle.imageUrl);
    const msg = await channel.send({ embeds: [embed] });
    activeSpawns[guildId] = { type: "bundle", bundle, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnVbucks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("💰 V-Bucks Drop!").setDescription("A bag of **1,000 V-Bucks** has appeared!\n\nType `buy` to grab them!").setColor(0x00d4ff).setImage(VBUCKS_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "vbucks", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnStwPacks(client, guildId, channelId, forced = false) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("⚡ Save the World Pack Drop!").setDescription("**5 Save the World Packs** have appeared!\n\nType `buy` to claim all 5 boxes!").setColor(0xff6600).setImage(STW_LOGO_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "stw_packs", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersPack(client, guildId, channelId) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("🌟 Founders Pack Has Spawned!").setDescription("A rare **Founders Pack** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_PACK_IMAGE).setFooter({ text: "Very rare!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_pack", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnFoundersBox(client, guildId, channelId) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle("📦 Founders Box Has Spawned!").setDescription("A **Founders Box** has appeared!\n\nType `buy` to claim!").setColor(0xffd700).setImage(FP_BOX_IMAGE).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: "founders_box", channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}
async function spawnLuckPotion(client, guildId, channelId, forced = false, type = "luckPotion") {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  const labels = { luckPotion: "🍀 Luck Potion", xtraLuckPotion: "🔮 Xtra Luck Potion" };
  const label = labels[type] || labels.luckPotion;
  const realType = labels[type] ? type : "luckPotion";
  try {
    const msg = await channel.send({ embeds: [new EmbedBuilder().setTitle(`${label} Spawned!`).setDescription(`A **${label}** has appeared!\n\nType \`buy\` to claim!`).setColor(0x2ecc71).setImage(LUCK_POT_IMG).setFooter({ text: "First come, first served!" }).setTimestamp()] });
    activeSpawns[guildId] = { type: realType, channelId, messageId: msg.id, claimedBy: null };
    return true;
  } catch { return false; }
}

async function spawnCrew(client, guildId, channelId) {
  if (activeSpawns[guildId]) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;
  try {
    const code = generateCrewCode();
    addCrewCode(code);
    const crewSkin = await getCrewSkin();
    const embed = new EmbedBuilder()
      .setTitle("👑 Fortnite Crew Pack Spawned!")
      .setDescription(`An exclusive **Fortnite Crew Pack** has appeared!\n\n**Includes:**\n💰 **1,000 V-Bucks**\n🎵 **Music Pass** (24 hours)\n🎮 **${crewSkin ? crewSkin.name : "Exclusive Crew Skin"}** *(Crew Series)*\n\n\`\`\`${code}\`\`\`\n\nClick **Redeem Crew Code** to claim!`)
      .setColor(0x4169e1)
      .setFooter({ text: "Crew Pack • First come, first served!" })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crew_redeem_${code}`).setLabel("👑 Redeem Crew Code").setStyle(ButtonStyle.Primary)
    );
    const msg = await channel.send({ embeds: [embed], components: [row] });
    activeSpawns[guildId] = { type: "crew", code, channelId, messageId: msg.id, claimedBy: null };
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 24 * 60 * 60 * 1000 });
    collector.on("collect", async (btn) => {
      if (!btn.customId.startsWith("crew_redeem_")) return;
      const btnCode = btn.customId.replace("crew_redeem_", "");
      const codeData = getCrewCode(btnCode);
      if (!codeData || codeData.used) { await btn.reply({ content: "❌ This crew code has already been redeemed!", ephemeral: true }); return; }
      redeemCrewCode(btnCode, btn.user.id);
      collector.stop("redeemed");
      delete activeSpawns[guildId];
      const rUserId = btn.user.id;
      addVbucks(rUserId, 1000);
      updateUser(rUserId, { hasMusicPass: true, musicPassExpiry: Date.now() + 24 * 60 * 60 * 1000 });
      if (crewSkin) addSkinToInventory(rUserId, crewSkin.id + "_crew_" + Date.now(), crewSkin.name + " (Crew)");
      const updated = getUser(rUserId);
      try {
        const dm = await btn.user.createDM();
        await dm.send({ embeds: [new EmbedBuilder().setTitle("👑 Your Fortnite Crew Code").setDescription(`Welcome to the Crew!\n\n**Your Crew Code:**\n\`\`\`${btnCode}\`\`\`\n\n**Rewards received:**\n💰 +1,000 V-Bucks\n🎵 Music Pass (24 hours)\n🎮 ${crewSkin ? crewSkin.name + " (Crew Series)" : "Crew Series Skin"}\n\n*Keep this code safe!*`).setColor(0x4169e1).setTimestamp()] });
      } catch { /* DMs closed */ }
      await btn.update({ embeds: [new EmbedBuilder().setTitle("👑 Crew Code Redeemed!").setDescription(`Welcome to the Crew, <@${rUserId}>!\n\n💰 **+1,000 V-Bucks** added!\n🎵 **Music Pass** activated (24 hours)!\n🎮 **${crewSkin ? crewSkin.name : "Crew Skin"}** (Crew Series) added!\n\n💳 **Balance:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n📬 **Your code was sent to your DMs!**`).setColor(0x4169e1).setTimestamp()], components: [] });
      if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
    });
    collector.on("end", (_, r) => {
      if (r !== "redeemed") {
        delete activeSpawns[guildId];
        if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
      }
    });
    return true;
  } catch { return false; }
}
async function handleBuyMessage(message) {
  const guildId = message.guildId;
  if (!guildId) return;
  const channelId = getSpawnChannel(guildId);
  if (!channelId || message.channelId !== channelId) return;
  const spawn = activeSpawns[guildId];
  if (!spawn || spawn.claimedBy) return;
  if (spawn.type === "crew") return; // crew uses button redemption
  const userId = message.author.id;
  if (isEliminated(userId)) {
    const m = Math.ceil(getEliminationTimeLeft(userId) / 60000);
    await message.channel.send({ content: `<@${userId}> ☠️ Eliminated! Can't catch anything for **${m} min**. Ask someone to \`/reboot\` you!` });
    return;
  }
  if (spawn.type === "founders_pack") {
    const user = getUser(userId);
    if (user.hasFoundersPack) { await message.channel.send({ content: `<@${userId}> ❌ You already own a Founders Pack!` }); return; }
  }
  spawn.claimedBy = userId;
  delete activeSpawns[guildId];
  const { gainedVbucks } = addInteraction(userId);
  addXP(userId, 50);
  updateUser(userId, { spawnCatches: (getUser(userId).spawnCatches ?? 0) + 1 });
  let embed;

  if (spawn.type === "bundle" && spawn.bundle) {
    for (const s of spawn.bundle.skins) addSkinToInventory(userId, s.id + "_bundle_" + Date.now(), s.name);
    const na = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> snagged the **${spawn.bundle.name}**! 🎁\n\n**Got:** ${spawn.bundle.skins.map(s=>`**${s.name}**`).join(", ")}\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🎁 ${message.author.username} claimed the ${spawn.bundle.name}!`).setDescription(desc).setColor(getRarityColor(spawn.bundle.rarity)).setTimestamp();
    if (spawn.bundle.imageUrl) embed.setThumbnail(spawn.bundle.imageUrl);
  } else if (spawn.type === "vbucks") {
    addVbucks(userId, 1000);
    let desc = `<@${userId}> grabbed **1,000 V-Bucks**! 💰\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    const na = checkAndAwardAchievements(userId);
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`💰 ${message.author.username} grabbed the V-Bucks!`).setDescription(desc).setColor(0x00d4ff).setTimestamp();
  } else if (spawn.type === "stw_packs") {
    const u_stw = getUser(userId);
    updateUser(userId, { stwPacks: (u_stw.stwPacks ?? 0) + 5 });
    let desc = `<@${userId}> claimed **5 STW Packs**! Open them with \`/savetheworld\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed STW Packs!`).setDescription(desc).setColor(0xff6600).setTimestamp();
  } else if (spawn.type === "founders_pack") {
    updateUser(userId, { hasFoundersPack: true });
    let desc = `<@${userId}> claimed the **Founders Pack**! 🌟\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`🌟 ${message.author.username} claimed the Founders Pack!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "founders_box") {
    const u3 = getUser(userId);
    updateUser(userId, { foundersBoxes: (u3.foundersBoxes ?? 0) + 1 });
    let desc = `<@${userId}> claimed a **Founders Box**! 📦\n\n${u3.hasFoundersPack ? "Open it with `/founderspack`!" : "Get a Founders Pack to open it!"}\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`📦 ${message.author.username} claimed a Founders Box!`).setDescription(desc).setColor(0xffd700).setTimestamp();
  } else if (spawn.type === "luckPotion" || spawn.type === "xtraLuckPotion") {
    const u4 = getUser(userId);
    updateUser(userId, { [spawn.type]: (u4[spawn.type] ?? 0) + 1 });
    const label = spawn.type === "luckPotion" ? "🍀 Luck Potion" : "🔮 Xtra Luck Potion";
    let desc = `<@${userId}> grabbed a **${label}**! Use it with \`/useluckpotion\`!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    embed = new EmbedBuilder().setTitle(`✨ ${message.author.username} claimed a ${label}!`).setDescription(desc).setColor(0x2ecc71).setTimestamp();
  } else if (spawn.type === "skin" && spawn.skin) {
    addSkinToInventory(userId, spawn.skin.id, spawn.skin.name);
    progressQuest(userId, "catch_skins");
    const na = checkAndAwardAchievements(userId);
    let desc = `<@${userId}> snagged **${spawn.skin.name}**!\n\n+50 XP earned!`;
    if (gainedVbucks) desc += `\n\n🎉 **Milestone!** +250 V-Bucks bonus!`;
    if (na.length) desc += `\n\n🏆 **Achievement Unlocked!** ${na.join(", ")}`;
    embed = new EmbedBuilder().setTitle(`🏆 ${message.author.username} caught ${spawn.skin.name}!`).setDescription(desc).setColor(getRarityColor(spawn.skin.rarity)).setTimestamp();
    if (spawn.skin.imageUrl) embed.setThumbnail(spawn.skin.imageUrl);
  } else return;

  await message.channel.send({ embeds: [embed] });
  if (botClient) scheduleNextSpawn(botClient, guildId, channelId);
}

function initSpawner(client) {
  botClient = client;
  for (const [guildId, channelId] of Object.entries(getAllGuildSpawnChannels())) {
    if (!channelId) continue;
    spawnTimers[guildId] = setTimeout(() => spawnRandom(client, guildId, channelId), getNextSpawnDelay());
  }
}
function restartSpawner(client, guildId, channelId) {
  if (spawnTimers[guildId]) clearTimeout(spawnTimers[guildId]);
  delete activeSpawns[guildId];
  scheduleNextSpawn(client, guildId, channelId);
}
const STW_QUESTS = [
  { id: "stw_q1", name: "Field Agent",   desc: "Use any 50 bot commands",        stat: "interactionCount", goal: 50,  reward: { vbucks: 200, stwBoxes: 1 } },
  { id: "stw_q2", name: "Supply Runner", desc: "Catch 10 spawns in the channel", stat: "spawnCatches",     goal: 10,  reward: { vbucks: 350, stwBoxes: 2 } },
  { id: "stw_q3", name: "Survivor",      desc: "Open 5 Supply Drops",            stat: "supplyDrops",      goal: 5,   reward: { vbucks: 250, stwBoxes: 1 } },
  { id: "stw_q4", name: "Llama Hunter",  desc: "Open 3 Llamas",                  stat: "llamaOpens",       goal: 3,   reward: { vbucks: 500, stwBoxes: 3 } },
  { id: "stw_q5", name: "High Roller",   desc: "Win 5 Coinflips",               stat: "coinflipsWon",     goal: 5,   reward: { vbucks: 400, stwBoxes: 2 } },
];

function getStwQuestProgress(user) {
  const baseline = user.stwQuestBaseline ?? {};
  const completed = user.stwQuestCompleted ?? [];
  return STW_QUESTS.map(q => {
    const base = baseline[q.stat] ?? 0;
    const current = user[q.stat] ?? 0;
    const progress = Math.min(current - base, q.goal);
    const done = completed.includes(q.id);
    return { ...q, progress: Math.max(0, progress), done, claimable: !done && progress >= q.goal };
  });
}
const activeLives = new Map();
const treasureChests = new Map();
const purchaseCooldowns = new Map(); // key: "coins_<uid>" or "vbucks_<uid>"



function getCoins(userId) {
  const u = getUser(userId);
  return u.coins ?? 0;
}

function addCoins(userId, amount) {
  const u = getUser(userId);
  updateUser(userId, {
    coins: Math.max(0, (u.coins ?? 0) + amount)
  });
}


const commands = [

{
  data: new SlashCommandBuilder()
    .setName("buycoins")
    .setDescription("Purchase coins")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount of coins to buy")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const COOLDOWN_MS = 2 * 60 * 60 * 1000;
    const lastUsed = purchaseCooldowns.get(`coins_${userId}`) ?? 0;
    const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
    if (remaining > 0) {
      const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000), s = Math.floor((remaining % 60000) / 1000);
      await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle("⏳ Cooldown Active").setDescription(`You can only purchase coins once every **2 hours**.

⏱️ **Time remaining:** ${h}h ${m}m ${s}s`).setColor(0xff6600).setTimestamp()], ephemeral: true });
      return;
    }
    const amount = interaction.options.getInteger("amount", true);
    const modal = new ModalBuilder().setCustomId("buycoins_auth_modal").setTitle("💳 Verify Payment");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("card_number").setLabel("Epic Games Card Number").setStyle(TextInputStyle.Short).setPlaceholder("XXXX-XXXX-XXXX").setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("employee_id").setLabel("Epic Games Employee ID").setStyle(TextInputStyle.Short).setPlaceholder("Enter your employee ID").setRequired(true))
    );
    await interaction.showModal(modal);
    const submitted = await interaction.awaitModalSubmit({ time: 90000 }).catch(() => null);
    if (!submitted) return;
    const enteredCard = submitted.fields.getTextInputValue("card_number").trim().replace(/\s/g, "");
    const enteredId = submitted.fields.getTextInputValue("employee_id").trim();
    const correctCard = "6767-6767-6767";
    const correctId = "77767774422006769";
    const cardOk = enteredCard === correctCard.replace(/-/g, "") || enteredCard === correctCard;
    const idOk = enteredId === correctId;
    if (!cardOk || !idOk) {
      await submitted.reply({ embeds: [new EmbedBuilder().setTitle("❌ Payment Declined").setDescription(!cardOk ? "That card number is invalid. Use format **XXXX-XXXX-XXXX**." : "That employee ID is not recognized.").setColor(0xff0000).setTimestamp()], ephemeral: true });
      return;
    }
    await submitted.deferReply({ ephemeral: true });
    await new Promise((r) => setTimeout(r, 1500));
    addCoins(userId, amount);
    purchaseCooldowns.set(`coins_${userId}`, Date.now());
    await submitted.editReply({ embeds: [new EmbedBuilder().setTitle("🪙 Coins Purchased!").setDescription(`Successfully purchased **${amount.toLocaleString()} coins**!

🏢 **Employee ID:** \`${correctId}\`
💳 **Card:** \`6767-6767-****\`

🪙 **New balance:** ${getCoins(userId).toLocaleString()} coins`).setColor(0xffd700).setTimestamp()] });
  },
},

{
  data: new SlashCommandBuilder()
    .setName("coins")
    .setDescription("Check your coin balance"),
  async execute(interaction) {
    const coins = getCoins(interaction.user.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🪙 Coin Balance")
          .setDescription(`You have **${coins.toLocaleString()} coins**`)
          .setColor(0xffd700)
      ]
    });
  },
},


{
  data: new SlashCommandBuilder()
    .setName("golive")
    .setDescription("Start a live stream"),
  async execute(interaction) {

    if (activeLives.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You're already live.",
        ephemeral: true
      });
    }

    activeLives.set(interaction.user.id, {
      started: Date.now(),
      gifts: 0,
      viewers: new Set(),
      agency: false
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔴 LIVE STARTED")
          .setDescription("People can now `/enterlive` and send gifts!")
          .setColor(0xff0000)
      ]
    });
  },
},


{
  data: new SlashCommandBuilder()
    .setName("agencylive")
    .setDescription("Start an agency live"),
  async execute(interaction) {

    const user = getUser(interaction.user.id);

    if (!user.inAgency) {
      return interaction.reply({
        content: "❌ You are not in Impact Agency.",
        ephemeral: true
      });
    }

    activeLives.set(interaction.user.id, {
      started: Date.now(),
      gifts: 0,
      viewers: new Set(),
      agency: true
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏢 AGENCY LIVE STARTED")
          .setDescription("15% fee enabled.")
          .setColor(0x00d4ff)
      ]
    });
  },
},


{
  data: new SlashCommandBuilder()
    .setName("enterlive")
    .setDescription("Join someone's live")
    .addUserOption(o =>
      o.setName("creator")
      .setDescription("Creator")
      .setRequired(true)
    ),

  async execute(interaction) {

    const creator = interaction.options.getUser("creator", true);

    const live = activeLives.get(creator.id);

    if (!live) {
      return interaction.reply({
        content: "❌ They are not live.",
        ephemeral: true
      });
    }

    live.viewers.add(interaction.user.id);

    await interaction.reply({
      content: `✅ Entered ${creator.username}'s live.`,
      ephemeral: true
    });
  },
},



{
  data: new SlashCommandBuilder()
    .setName("coingift")
    .setDescription("Send a TikTok style gift")
    .addUserOption(o =>
      o.setName("creator")
      .setDescription("Creator")
      .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("gift")
      .setDescription("Gift to send")
      .setRequired(true)
      .addChoices(
        { name: "⭐ TikTok Stars — 99", value: "tiktokstars" },
        { name: "🐱 Leon The Kitten — 299", value: "leonkitten" },
        { name: "🏠 TikTok House — 999", value: "tiktokhouse" },
        { name: "✈️ Flying Jet — 19,999", value: "flyingjet" },
        { name: "🦁 Lion — 29,999", value: "lion" },
        { name: "🌌 TikTok Universe — 34,999", value: "universe" }
      )
    ),

  async execute(interaction) {

    const creator = interaction.options.getUser("creator", true);
    const giftKey = interaction.options.getString("gift", true);

    const gift = LIVE_GIFTS[giftKey];

    if (!gift) {
      return interaction.reply({
        content: "❌ Invalid gift.",
        ephemeral: true
      });
    }

    const live = activeLives.get(creator.id);

    if (!live) {
      return interaction.reply({
        content: "❌ That creator is not live.",
        ephemeral: true
      });
    }

    if (!live.viewers.has(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You must enter their live first.",
        ephemeral: true
      });
    }

    if (getCoins(interaction.user.id) < gift.coins) {
      return interaction.reply({
        content: `❌ You need ${gift.coins.toLocaleString()} coins.`,
        ephemeral: true
      });
    }

    addCoins(interaction.user.id, -gift.coins);

    const fee = live.agency ? 0.15 : 0.35;
    const creatorGets = Math.floor(gift.coins * (1 - fee));

    addCoins(creator.id, creatorGets);

    live.gifts += creatorGets;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${gift.icon} Gift Sent`)
          .setDescription(
            `You sent **${gift.name}** to ${creator.username}

Gift Value: **${gift.coins.toLocaleString()} coins**
Creator Receives: **${creatorGets.toLocaleString()} coins**`
          )
          .setColor(0xff2d55)
      ]
    });
  },
},

{
  data: new SlashCommandBuilder()
    .setName("endlive")
    .setDescription("End your live"),
  async execute(interaction) {

    const live = activeLives.get(interaction.user.id);

    if (!live) {
      return interaction.reply({
        content: "❌ You are not live.",
        ephemeral: true
      });
    }

    activeLives.delete(interaction.user.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("📊 Live Analytics")
          .setDescription(
            `Coins earned: **${live.gifts.toLocaleString()}**\nViewers: **${live.viewers.size}**`
          )
          .setColor(0x00ff00)
      ]
    });
  },
},


{
  data: new SlashCommandBuilder()
    .setName("joinagency")
    .setDescription("Join Impact Agency"),

  async execute(interaction) {

    const user = getUser(interaction.user.id);

    if ((user.vbucks ?? 0) < 10000) {
      return interaction.reply({
        content: "❌ You need 10,000 V-Bucks.",
        ephemeral: true
      });
    }

    updateUser(interaction.user.id, {
      inAgency: true,
      agencyName: "Impact Agency"
    });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏢 Joined Impact Agency")
          .setDescription("You now qualify for reduced live fees.")
          .setColor(0x00d4ff)
      ]
    });
  },
},


{
  data: new SlashCommandBuilder()
    .setName("treasurechest")
    .setDescription("Spawn a treasure chest")
    .addIntegerOption(o =>
      o.setName("coins")
      .setDescription("Coin amount")
      .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("people")
      .setDescription("Max openings")
      .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes")
      .setDescription("Duration")
      .setRequired(true)
    ),

  async execute(interaction) {

    const coins = interaction.options.getInteger("coins", true);
    const people = interaction.options.getInteger("people", true);
    const minutes = interaction.options.getInteger("minutes", true);

    const chestId = `${interaction.id}`;

    treasureChests.set(chestId, {
      remaining: coins,
      maxPeople: people,
      opened: []
    });

    const embed = new EmbedBuilder()
      .setTitle("🪙 Treasure Chest")
      .setDescription(
        `Coins: **${coins.toLocaleString()}**\nOpeners: **0/${people}**\nExpires: **${minutes} minutes**`
      )
      .setThumbnail("https://cdn.discordapp.com/attachments/1247303459359690805/1505279164289388544/Fx_CoinChest.webp")
      .setColor(0xffd700);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`openchest_${chestId}`)
        .setLabel("🪙 Open Chest")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  },
},



  {
    data: new SlashCommandBuilder().setName("setup").setDescription("Set the channel where Fortnite skins will spawn").addChannelOption((o) => o.setName("channel").setDescription("Text channel for spawns").addChannelTypes(ChannelType.GuildText).setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel", true);
      setSpawnChannel(guildId, channel.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Bot Setup Complete!").setDescription(`Skins will spawn in <#${channel.id}>!\n\nFirst skin appears shortly, then every **3–5 minutes**.\n\nType \`buy\` to catch spawns!`).setColor(0x00d4ff).setTimestamp()] });
      if (interaction.client) restartSpawner(interaction.client, guildId, channel.id);
    },
  },

  {
    data: new SlashCommandBuilder().setName("forcespawn").setDescription("Force a spawn in the spawn channel").addStringOption((o) => o.setName("item").setDescription("What to spawn").setRequired(false).addChoices({ name: "Random Skin", value: "skin" }, { name: "Bundle (25% chance variant)", value: "bundle" }, { name: "V-Bucks Drop", value: "vbucks" }, { name: "STW Packs", value: "stw" }, { name: "Founders Pack", value: "founders_pack" }, { name: "Founders Box", value: "founders_box" }, { name: "Luck Potion", value: "luckPotion" }, { name: "Xtra Luck Potion", value: "xtraLuckPotion" }, { name: "👑 Crew Pack", value: "crew" })).addStringOption((o) => o.setName("skin_name").setDescription("Specific skin name").setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const channelId = getSpawnChannel(guildId);
      if (!channelId) return interaction.reply({ content: "❌ No spawn channel! Use `/setup` first.", ephemeral: true });
      if (getActiveSpawn(guildId)) return interaction.reply({ content: `⚠️ Something is already spawned!`, ephemeral: true });
      const skinName = interaction.options.getString("skin_name");
      const item = interaction.options.getString("item") ?? "skin";
      if (skinName) {
        await interaction.deferReply({ ephemeral: true });
        const match = await findSkinByName(skinName);
        if (!match) { await interaction.editReply({ content: `❌ Couldn't find **"${skinName}"**.` }); return; }
        await interaction.editReply({ content: `🎮 Spawning **${match.name}** in <#${channelId}>...` });
        await spawnSkin(interaction.client, guildId, channelId, true, match); return;
      }
      if (item === "crew") { await interaction.reply({ content: `👑 Spawning a **Crew Pack** in <#${channelId}>...`, ephemeral: true }); await spawnCrew(interaction.client, guildId, channelId); return; }
      if (item === "bundle") { await interaction.reply({ content: `🎁 Spawning a **Bundle** in <#${channelId}>...`, ephemeral: true }); await spawnBundle(interaction.client, guildId, channelId); return; }
      const actions = { skin: () => spawnSkin(interaction.client, guildId, channelId, true), vbucks: () => spawnVbucks(interaction.client, guildId, channelId, true), stw: () => spawnStwPacks(interaction.client, guildId, channelId, true), founders_pack: () => spawnFoundersPack(interaction.client, guildId, channelId), founders_box: () => spawnFoundersBox(interaction.client, guildId, channelId), luckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "luckPotion"), xtraLuckPotion: () => spawnLuckPotion(interaction.client, guildId, channelId, true, "xtraLuckPotion") };
      await interaction.reply({ content: `✅ Spawning in <#${channelId}>...`, ephemeral: true });
      await (actions[item] ?? actions.skin)();
    },
  },

  {
    data: new SlashCommandBuilder().setName("resetshop").setDescription("Force the Item Shop to reset with 5 new skins").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const skins = await getRandomShopSkins(5);
      setItemShop(skins.map((s) => ({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: SKIN_PRICE })));
      const lines = skins.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · ${s.rarity}`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🛒 Item Shop Reset!").setDescription(`New skins:\n\n${lines.join("\n")}`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("resetmusic").setDescription("Force the Music Pass to reset with a new Icon skin").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      setMusicPass(null);
      const skin = await getMusicPass();
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎵 Music Pass Reset!").setDescription(`New Music Pass skin:\n\n${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ **${skin.rarity}**\n\nAll previous purchasers reset.`).setColor(getRarityColor(skin.rarity)).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("resetcrew").setDescription("Clear any active Crew Pack spawn and allow a new one").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
      const guildId = interaction.guildId;
      if (!guildId) return interaction.reply({ content: "❌ Server only.", ephemeral: true });
      const spawn = activeSpawns[guildId];
      if (spawn && spawn.type === "crew") {
        delete activeSpawns[guildId];
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("👑 Crew Spawn Cleared").setDescription("The active Crew Pack spawn has been removed.\n\nUse `/forcespawn item:Crew Pack` to spawn a new one.").setColor(0x4169e1).setTimestamp()], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("ℹ️ No Active Crew Spawn").setDescription("There is no active Crew Pack spawn to clear.\n\nUse `/forcespawn item:Crew Pack` to spawn one.").setColor(0x888888).setTimestamp()], ephemeral: true });
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName("release").setDescription("Force specific skins or bundles into the Item Shop (up to 5)")
      .addStringOption(o => o.setName("slot1").setDescription("Skin or bundle name").setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName("slot2").setDescription("Skin or bundle name").setRequired(false).setAutocomplete(true))
      .addStringOption(o => o.setName("slot3").setDescription("Skin or bundle name").setRequired(false).setAutocomplete(true))
      .addStringOption(o => o.setName("slot4").setDescription("Skin or bundle name").setRequired(false).setAutocomplete(true))
      .addStringOption(o => o.setName("slot5").setDescription("Skin or bundle name").setRequired(false).setAutocomplete(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    autocomplete: async (interaction) => {
      const focused = interaction.options.getFocused().toLowerCase();
      const skins = await fetchFortniteSkins();
      const bundles = await getAllBundles();
      const bundleChoices = bundles.filter(b => b.name.toLowerCase().includes(focused)).map(b => ({ name: `📦 ${b.name} — Bundle (${b.price.toLocaleString()} V-Bucks)`, value: `bundle:${b.id}` }));
      const skinChoices = skins.filter(s => s.name.toLowerCase().includes(focused)).slice(0, 20 - bundleChoices.length).map(s => ({ name: `${getRarityEmoji(s.rarity)} ${s.name} — ${s.rarity}`, value: `skin:${s.id}` }));
      await interaction.respond([...bundleChoices, ...skinChoices].slice(0, 25));
    },
    async execute(interaction) {
      await interaction.deferReply({ ephemeral: true });
      const slots = ["slot1","slot2","slot3","slot4","slot5"].map(s => interaction.options.getString(s)).filter(Boolean);
      const shopItems = [];
      const skins = await fetchFortniteSkins();
      const bundles = await getAllBundles();
      for (const val of slots) {
        if (val.startsWith("bundle:")) {
          const bundleId = val.replace("bundle:", "");
          const bundle = bundles.find(b => b.id === bundleId);
          if (bundle) shopItems.push({ skinId: bundle.id, name: bundle.name, rarity: bundle.rarity, imageUrl: bundle.imageUrl, price: bundle.price, isBundle: true, bundleSkins: bundle.skins });
        } else {
          const skinId = val.replace("skin:", "");
          const skin = skins.find(s => s.id === skinId) ?? await findSkinByName(val);
          if (skin) shopItems.push({ skinId: skin.id, name: skin.name, rarity: skin.rarity, imageUrl: skin.imageUrl, price: SKIN_PRICE });
        }
      }
      if (shopItems.length < 5) {
        const fill = await getRandomShopSkins(5 - shopItems.length);
        for (const s of fill) shopItems.push({ skinId: s.id, name: s.name, rarity: s.rarity, imageUrl: s.imageUrl, price: SKIN_PRICE });
      }
      setItemShop(shopItems.slice(0, 5));
      const lines = shopItems.slice(0, 5).map(s => `${s.isBundle ? "📦" : getRarityEmoji(s.rarity)} **${s.name}** — ${s.price.toLocaleString()} V-Bucks`);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Item Shop Updated!").setDescription(`The shop now features:\n\n${lines.join("\n")}`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("vbucks").setDescription("Check your V-Bucks balance"),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId);
      const { gainedVbucks } = addInteraction(userId);
      progressQuest(userId, "check_vbucks");
      const user = getUser(userId);
      updateUser(userId, { vbucksChecked: (user.vbucksChecked ?? 0) + 1 });
      const nextMilestone = 30 - (user.interactionCount % 30);
      const tier = getBattlePassTier(user.level, user.xp);
      const embed = new EmbedBuilder().setTitle("💰 V-Bucks Balance")
        .setDescription(`**${interaction.user.username}**, your wallet:\n\n💰 **${user.infiniteVbucks ? "INFINITE ∞" : user.vbucks.toLocaleString()} V-Bucks**\n\n📊 **Level:** ${user.level} · **XP:** ${user.xp}\n🎮 **Battle Pass Tier:** ${tier}/100\n🏗️ **Build:** ${user.buildCharges > 0 ? `${BUILD_MATS[user.buildMaterial]?.label ?? "🪵 Wood"} (${user.buildCharges} charge${user.buildCharges !== 1 ? "s" : ""})` : "None"}\n💬 **Interactions:** ${user.interactionCount}\n🎁 **Next bonus in:** ${nextMilestone} interactions`)
        .setColor(0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp()
        .setFooter({ text: gainedVbucks ? "🎉 You just earned 250 V-Bucks for a milestone!" : "Earn 250 V-Bucks every 30 interactions!" });
      await interaction.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("itemshop").setDescription("Browse today's Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId); progressQuest(userId, "check_shop");
      const skins = await ensureShopFresh();
      let page = 0;
      const buildPage = (p) => {
        const item = skins[p], user = getUser(userId);
        const isBundle = !!item.isBundle;
        const discount = isBundle ? 0 : (user.creatorDiscount ?? 0);
        const finalPrice = isBundle ? item.price : Math.floor(item.price * (1 - discount));
        const desc = isBundle
          ? `📦 **${item.name}** *(Bundle)*\n\n**Includes:**\n${(item.bundleSkins ?? []).map(s => `• **${s.name}**`).join("\n")}\n\n💰 **Price: ${finalPrice.toLocaleString()} V-Bucks**\n\n🔄 Shop resets in **${getTimeUntilReset()}**`
          : `${getRarityEmoji(item.rarity)} **${item.name}**\n✨ Rarity: **${item.rarity}**\n\n💰 **Price: ${finalPrice.toLocaleString()} V-Bucks**${user.hasCreatorCode && !isBundle ? ` 🏷️ *(${Math.round(discount*100)}% off)*` : ""}\n\n🔄 Shop resets in **${getTimeUntilReset()}**`;
        const embed = new EmbedBuilder().setTitle(`🛒 Item Shop — ${isBundle ? "📦 Bundle" : "Skin"} ${p+1} of ${skins.length}`).setDescription(desc).setColor(getRarityColor(item.rarity)).setFooter({ text: "Use /creatorcode for a discount!" }).setTimestamp();
        if (item.imageUrl) embed.setImage(item.imageUrl);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shop_prev_${p}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`shop_buy_${p}`).setLabel(`Buy — ${finalPrice.toLocaleString()} V-Bucks`).setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`shop_next_${p}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= skins.length - 1)
        );
        return { embed, row, finalPrice };
      };
      const { embed, row } = buildPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        if (btn.customId.startsWith("shop_prev")) { page = Math.max(0, page-1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_next")) { page = Math.min(skins.length-1, page+1); const { embed: e, row: r } = buildPage(page); await btn.update({ embeds: [e], components: [r] }); }
        else if (btn.customId.startsWith("shop_buy")) {
          const item = skins[page], freshUser = getUser(userId);
          const isBundle = !!item.isBundle;
          const fp = isBundle ? item.price : Math.floor(item.price * (1 - (freshUser.creatorDiscount ?? 0)));
          if (!freshUser.infiniteVbucks && freshUser.vbucks < fp) {
            if (!freshUser.brokeAttempt) { updateUser(userId, { brokeAttempt: true }); const ach = awardAchievement(userId, "broke"); await btn.reply({ content: `❌ Need **${fp.toLocaleString()} V-Bucks** but only have **${freshUser.vbucks.toLocaleString()}**.`, embeds: ach ? [buildAchievementEmbed(ach)] : [], ephemeral: true }); }
            else await btn.reply({ content: `❌ Not enough V-Bucks!`, ephemeral: true });
            return;
          }
          if (!isBundle && freshUser.inventory.includes(item.skinId)) { await btn.reply({ content: `⚠️ Already own **${item.name}**!`, ephemeral: true }); return; }
          if (!freshUser.infiniteVbucks) addVbucks(userId, -fp);
          if (isBundle) {
            for (const s of (item.bundleSkins ?? [])) addSkinToInventory(userId, s.id + "_shop_" + Date.now(), s.name);
          } else {
            addSkinToInventory(userId, item.skinId, item.name);
          }
          updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), item.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [item.skinId]: fp } });
          checkAndAwardAchievements(userId);
          const updated = getUser(userId);
          const purchaseDesc = isBundle
            ? `📦 You bought the **${item.name}** bundle!\n\n**All skins added to your locker!**\n💰 Spent: ${fp.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`
            : `${getRarityEmoji(item.rarity)} You bought **${item.name}**!\n💰 Spent: ${fp.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`;
          await btn.reply({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(purchaseDesc).setColor(getRarityColor(item.rarity)).setTimestamp()], ephemeral: true });
        }
      });
      collector.on("end", async () => { const { embed: e } = buildPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("buy").setDescription("Purchase a skin or bundle from the current Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      if (isEliminated(userId)) { const m = Math.ceil(getEliminationTimeLeft(userId)/60000); await interaction.editReply({ content: `☠️ Eliminated for **${m} min**. Ask someone to \`/reboot\` you.` }); return; }
      const skins = await ensureShopFresh(), user = getUser(userId);
      const isFree = hasActiveFreeSkin(userId);
      const isHacked = !!user.hackedFreeShop;

      function getBundleDiscount(bundleSkins) {
        const equipped = user.equippedSkins ?? [];
        const bundleSkinIds = (bundleSkins ?? []).map(s => s.id);
        const matches = equipped.filter(id => bundleSkinIds.some(bid => id.startsWith(bid))).length;
        return Math.min(matches, 2) * 0.35;
      }

      const skinOptions = skins.map((s, i) => {
        const isBundle = !!s.isBundle;
        let fp;
        if (isFree && !isBundle) {
          fp = 0;
        } else if (isBundle) {
          const disc = getBundleDiscount(s.bundleSkins);
          fp = Math.floor(s.price * (1 - disc));
        } else {
          fp = Math.floor(s.price * (1 - (user.creatorDiscount ?? 0)));
        }
        const discInfo = isBundle && getBundleDiscount(s.bundleSkins) > 0 ? ` 🎽 ${Math.round(getBundleDiscount(s.bundleSkins)*100)}% off!` : "";
        const label = isBundle ? `📦 ${s.name} — ${fp.toLocaleString()} V-Bucks${discInfo}` : (isFree ? `${s.name} — FREE 🎁` : `${s.name} — ${fp.toLocaleString()} V-Bucks`);
        return new StringSelectMenuOptionBuilder().setLabel(label.slice(0, 100)).setDescription((isBundle ? `Bundle: ${(s.bundleSkins??[]).length} skins` : `${getRarityEmoji(s.rarity)} ${s.rarity}`).slice(0, 100)).setValue(String(i));
      });

      const entireShopOption = new StringSelectMenuOptionBuilder()
        .setLabel(isHacked ? "🔴 GET ENTIRE SHOP FREE [HACKED]" : "🔒 GET ENTIRE SHOP FREE [Locked]")
        .setDescription(isHacked ? "Claim every item in the shop for FREE — once only!" : "You haven't been hacked. Only the hacked get this.")
        .setValue("entire_shop");

      const allOptions = [entireShopOption, ...skinOptions].slice(0, 25);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("buy_select").setPlaceholder("Choose a skin or bundle...").addOptions(allOptions)
      );

      const titleStr = isHacked ? "🔴 HACKED — Buy or Claim Entire Shop FREE" : isFree ? "🎁 Free Skin! Pick Yours" : "🛒 Buy a Skin or Bundle";
      const descStr = isHacked
        ? `⚡ You've been hacked! Select **🔴 GET ENTIRE SHOP FREE** to claim everything at once, or buy individual items.\n\n💳 Balance: **${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks**`
        : isFree ? "Free skin from Tylajadee creator code!" : `Balance: **${user.vbucks.toLocaleString()} V-Bucks**\n\nSelect an item:`;

      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(titleStr).setDescription(descStr).setColor(isHacked ? 0xff0000 : isFree ? 0xffd700 : 0x00d4ff).setTimestamp()], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });

      collector.on("collect", async (sel) => {
        const val = sel.values[0];
        const freshUser = getUser(userId);

        if (val === "entire_shop") {
          if (!freshUser.hackedFreeShop) {
            await sel.update({ content: "🔒 You haven't been hacked — this option isn't available to you.", embeds: [], components: [] });
            return;
          }
          let itemsGiven = [];
          for (const s of skins) {
            if (s.isBundle) {
              for (const sk of (s.bundleSkins ?? [])) addSkinToInventory(userId, sk.id + "_hack_" + Date.now(), sk.name);
              itemsGiven.push(`📦 ${s.name}`);
            } else {
              if (!freshUser.inventory.includes(s.skinId)) {
                addSkinToInventory(userId, s.skinId, s.name);
                itemsGiven.push(`${getRarityEmoji(s.rarity)} ${s.name}`);
              }
            }
          }
          updateUser(userId, { hackedFreeShop: false });
          await sel.update({ embeds: [new EmbedBuilder()
            .setTitle("🔴 Hacked Shop Claimed!")
            .setDescription(`You got the **entire Item Shop for FREE!**\n\n${itemsGiven.slice(0,15).join("\n")}${itemsGiven.length > 15 ? `\n*...and ${itemsGiven.length-15} more*` : ""}\n\n*Your free shop run is used up. Buy items normally from now on.*`)
            .setColor(0xff0000).setTimestamp()], components: [] });
          collector.stop();
          return;
        }

        const item = skins[parseInt(val)];
        if (!item) { await sel.update({ content: "❌ Invalid selection.", embeds: [], components: [] }); return; }
        const isBundle = !!item.isBundle;
        const freshFree = !isBundle && hasActiveFreeSkin(userId);
        let fp;
        if (freshFree) {
          fp = 0;
        } else if (isBundle) {
          const equipped2 = freshUser.equippedSkins ?? [];
          const bIds = (item.bundleSkins ?? []).map(s => s.id);
          const matches2 = equipped2.filter(id => bIds.some(bid => id.startsWith(bid))).length;
          fp = Math.floor(item.price * (1 - Math.min(matches2, 2) * 0.35));
        } else {
          fp = Math.floor(item.price * (1 - (freshUser.creatorDiscount ?? 0)));
        }
        if (!freshFree && !freshUser.infiniteVbucks && freshUser.vbucks < fp) { await sel.update({ content: `❌ Need **${fp.toLocaleString()} V-Bucks**.`, embeds: [], components: [] }); return; }
        if (!isBundle && freshUser.inventory.includes(item.skinId)) { await sel.update({ content: `⚠️ Already own **${item.name}**!`, embeds: [], components: [] }); return; }
        if (fp > 0 && !freshUser.infiniteVbucks) addVbucks(userId, -fp);
        if (isBundle) {
          for (const s of (item.bundleSkins ?? [])) addSkinToInventory(userId, s.id + "_shop_" + Date.now(), s.name);
        } else {
          addSkinToInventory(userId, item.skinId, item.name);
        }
        updateUser(userId, { shopPurchases: (freshUser.shopPurchases ?? 0) + 1, shopSkins: [...(freshUser.shopSkins ?? []), item.skinId], shopSkinPrices: { ...(freshUser.shopSkinPrices ?? {}), [item.skinId]: fp }, ...(freshFree ? { freeSkinRedeemed: true } : {}) });
        checkAndAwardAchievements(userId);
        const updated = getUser(userId);
        const purchaseDesc = isBundle
          ? `📦 You bought the **${item.name}** bundle!\n\n**All skins added to your locker!**\n💰 Spent: ${fp.toLocaleString()} V-Bucks\n💳 Remaining: ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`
          : `${getRarityEmoji(item.rarity)} You bought **${item.name}**!\n\n💰 **Spent:** ${fp.toLocaleString()} V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks`;
        await sel.update({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(purchaseDesc).setColor(getRarityColor(item.rarity)).setTimestamp()], components: [] });
        collector.stop();
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("gift")
      .setDescription("Gift a skin from the Item Shop to another player")
      .addUserOption((o) => o.setName("player").setDescription("Player to gift to").setRequired(true))
      .addBooleanOption((o) => o.setName("private").setDescription("Send your gift privately so only you can see it?").setRequired(false)),
    async execute(interaction) {
      const isPrivate = interaction.options.getBoolean("private") ?? false;
      await interaction.deferReply({ ephemeral: isPrivate });
      const userId = interaction.user.id;
      const target = interaction.options.getUser("player", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ You can't gift yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ You can't gift bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const skins = await ensureShopFresh(), user = getUser(userId);
      if (!skins.length) { await interaction.editReply({ content: "❌ The Item Shop is empty right now." }); return; }
      const options = skins.map((s, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${s.name} — ${s.price.toLocaleString()} V-Bucks`)
          .setDescription(s.isBundle ? `Bundle: ${(s.bundleSkins??[]).length} skins` : `${getRarityEmoji(s.rarity)} ${s.rarity}`)
          .setValue(String(i))
      );
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("gift_select").setPlaceholder("Choose a skin to gift...").addOptions(options)
      );
      const msg = await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle(`🎁 Gift a Skin to ${target.username}`)
          .setDescription(`**Your balance:** ${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks\n\nSelect a skin to gift — the V-Bucks will be deducted from your account.\nYour friend won't receive it until their next interaction.`)
          .setColor(0xffd700)
          .setTimestamp()],
        components: [row],
      });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      collector.on("collect", async (sel) => {
        const item = skins[parseInt(sel.values[0])];
        const freshUser = getUser(userId);
        if (!freshUser.infiniteVbucks && freshUser.vbucks < item.price) {
          await sel.update({ content: `❌ You need **${item.price.toLocaleString()} V-Bucks** to gift this.`, embeds: [], components: [] });
          return;
        }
        if (!freshUser.infiniteVbucks) addVbucks(userId, -item.price);
        updateUser(userId, { giftsGiven: (freshUser.giftsGiven ?? 0) + 1 });
        checkAndAwardAchievements(userId);
        setPendingGift(target.id, {
          fromId: userId,
          fromName: interaction.user.username,
          item: {
            name: item.name,
            price: item.price,
            rarity: item.rarity ?? "Common",
            skinId: item.skinId,
            isBundle: !!item.isBundle,
            bundleSkins: item.bundleSkins ?? [],
          },
          notified: false,
          guildId: interaction.guildId,
        });
        const updated = getUser(userId);
        await sel.update({
          embeds: [new EmbedBuilder()
            .setTitle("🎁 Gift Sent!")
            .setDescription(`You gifted **${item.name}** to <@${target.id}>!\n\n💰 **Spent:** ${item.price.toLocaleString()} V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n*They'll be notified next time they use a command!*`)
            .setColor(0xffd700)
            .setTimestamp()],
          components: [],
        });
        collector.stop();
      });
      collector.on("end", (_, r) => {
        if (r === "time") interaction.editReply({ content: "⏰ Timed out.", embeds: [], components: [] }).catch(() => {});
      });
    },
  },

  {
    data: new SlashCommandBuilder().setName("coinflip").setDescription("Flip a coin — heads or tails!").addStringOption((o) => o.setName("side").setDescription("Heads or Tails?").setRequired(true).addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })).addIntegerOption((o) => o.setName("wager").setDescription("V-Bucks to wager (50–2000)").setRequired(false).setMinValue(50).setMaxValue(2000)),
    async execute(interaction) {
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const side = interaction.options.getString("side", true), wager = interaction.options.getInteger("wager") ?? 100;
      const user = getUser(userId);
      if (!user.infiniteVbucks && user.vbucks < wager) { await interaction.reply({ content: `❌ Need **${wager} V-Bucks** to wager.` }); return; }
      if (!user.infiniteVbucks) addVbucks(userId, -wager);
      const result = Math.random() < 0.5 ? "heads" : "tails";
      const won = result === side;
      if (won) { addVbucks(userId, wager*2); updateUser(userId, { coinflipsWon: (user.coinflipsWon??0)+1 }); progressQuest(userId, "win_coinflip"); }
      updateUser(userId, { coinflipsPlayed: (user.coinflipsPlayed??0)+1 });
      checkAndAwardAchievements(userId);
      const updated = getUser(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(won ? "🪙 You Won!" : "🪙 You Lost!").setDescription(`The coin landed on **${result.toUpperCase()}**!\n\nYou chose **${side.toUpperCase()}** — ${won ? `✅ Correct! **+${wager} V-Bucks**!` : `❌ Wrong! **-${wager} V-Bucks**`}\n\n💳 Balance: **${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks**`).setColor(won ? 0x00ff00 : 0xff0000).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("challenge").setDescription("Challenge another player to a coin flip!").addUserOption((o) => o.setName("player").setDescription("Player to challenge").setRequired(true)).addIntegerOption((o) => o.setName("wager").setDescription("V-Bucks to wager (50–2000)").setRequired(false).setMinValue(50).setMaxValue(2000)),
    async execute(interaction) {
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const wager = interaction.options.getInteger("wager") ?? 100;
      if (target.id === userId) { await interaction.reply({ content: "❌ Can't challenge yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't challenge bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId); progressQuest(userId, "challenge_flip");
      const challenger = getUser(userId), targetData = getUser(target.id);
      if (!challenger.infiniteVbucks && challenger.vbucks < wager) { await interaction.reply({ content: `❌ Need **${wager} V-Bucks**.` }); return; }
      if (!targetData.infiniteVbucks && targetData.vbucks < wager) { await interaction.reply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
      const challengeId = `${userId}_${Date.now()}`;
      setCoinflipChallenge(challengeId, { challengerId: userId, targetId: target.id, wager, expires: Date.now() + 60000 });
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`flip_accept_${challengeId}`).setLabel("✅ Accept").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`flip_decline_${challengeId}`).setLabel("❌ Decline").setStyle(ButtonStyle.Danger));
      const msg = await interaction.reply({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🪙 Coin Flip Challenge!").setDescription(`<@${userId}> challenged <@${target.id}> to a **coin flip**!\n\n💰 **Wager:** ${wager.toLocaleString()} V-Bucks each\n🏆 **Winner takes:** ${(wager*2).toLocaleString()} V-Bucks\n\n<@${target.id}>, do you accept?`).setColor(0xf4a01a).setTimestamp()], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id });
      collector.on("collect", async (btn) => {
        const ch = getCoinflipChallenge(challengeId);
        if (!ch || Date.now() > ch.expires) { await btn.update({ content: "⏰ Challenge expired.", embeds: [], components: [] }); return; }
        if (btn.customId.includes("decline")) { deleteCoinflipChallenge(challengeId); await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Challenge Declined").setDescription(`<@${target.id}> backed down!`).setColor(0x888888).setTimestamp()], components: [], content: "" }); return; }
        deleteCoinflipChallenge(challengeId);
        const fC = getUser(userId), fT = getUser(target.id);
        if (!fC.infiniteVbucks) addVbucks(userId, -wager);
        if (!fT.infiniteVbucks) addVbucks(target.id, -wager);
        const winnerSide = Math.random() < 0.5 ? "heads" : "tails";
        const winnerId = winnerSide === "heads" ? userId : target.id, loserId = winnerId === userId ? target.id : userId;
        addVbucks(winnerId, wager*2);
        updateUser(winnerId, { coinflipsWon: (getUser(winnerId).coinflipsWon??0)+1 });
        updateUser(userId, { coinflipsPlayed: (getUser(userId).coinflipsPlayed??0)+1 });
        updateUser(target.id, { coinflipsPlayed: (getUser(target.id).coinflipsPlayed??0)+1 });
        checkAndAwardAchievements(winnerId);
        await btn.update({ embeds: [new EmbedBuilder().setTitle(`🪙 ${winnerId === userId ? interaction.user.username : target.username} wins!`).setDescription(`🏆 **<@${winnerId}>** wins **${(wager*2).toLocaleString()} V-Bucks!**\n💸 **<@${loserId}>** loses **${wager.toLocaleString()} V-Bucks**`).setColor(0xffd700).setTimestamp()], components: [], content: "" });
      });
      collector.on("end", (_, r) => { if (r === "time") { deleteCoinflipChallenge(challengeId); interaction.editReply({ content: "⏰ Challenge expired.", embeds: [], components: [] }).catch(() => {}); } });
    },
  },

  {
    data: new SlashCommandBuilder().setName("inventory").setDescription("View your Fortnite skin collection and items"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const names = Object.values(user.inventoryNames);
      const luck = user.activeLuck === "none" ? "None" : { normal: "🍀 Luck Potion (+15%)", xtra: "🔮 Xtra Luck Potion (+40%)", godly: "⚡ Godly Luck Potion (+80%)" }[user.activeLuck];
      const totalPages = Math.max(1, Math.ceil(names.length / 10));
      let page = 0;

      const buildInvPage = (p) => {
        const cu = getUser(userId);
        const slice = names.slice(p*10, p*10+10);
        const lines = slice.map((name, i) => `${p*10+i+1}. **${name}**`);
        const matInfo = cu.buildCharges > 0 ? `${BUILD_MATS[cu.buildMaterial]?.label ?? "🪵 Wood"} — ${cu.buildCharges} charge${cu.buildCharges !== 1 ? "s" : ""}` : "None";
        const itemsSection = `**Items:**\n🍀 Luck: ${cu.luckPotion||0} | 🔮 Xtra: ${cu.xtraLuckPotion||0} | ⚡ Godly: ${cu.godlyLuckPotion||0}\n🌟 God Chests: ${cu.godChest||0} | 🔵 Mysterious: ${cu.mysteriousChest||0}\n📦 Founders Boxes: ${cu.foundersBoxes||0} | 🏗️ Build: ${matInfo}`;
        const embed = new EmbedBuilder()
          .setTitle(`🎒 ${interaction.user.username}'s Inventory`)
          .setDescription((lines.length ? lines.join("\n")+"\n\n" : "*No skins yet.*\n\n") + itemsSection + `\n\n💰 **${cu.infiniteVbucks ? "∞" : cu.vbucks.toLocaleString()} V-Bucks** | ✨ Luck: **${luck}**`)
          .setColor(0x00d4ff)
          .setFooter({ text: `Page ${p+1} of ${totalPages} • ${names.length} skin(s)` })
          .setTimestamp();

        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("inv_prev").setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId("inv_next").setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages-1)
        );

        const hasGod  = (cu.godChest ?? 0) > 0;
        const hasMyst = (cu.mysteriousChest ?? 0) > 0;
        const chestRow = (hasGod || hasMyst) ? new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("inv_open_god").setLabel(`🌟 Open God Chest (${cu.godChest ?? 0})`).setStyle(ButtonStyle.Success).setDisabled(!hasGod),
          new ButtonBuilder().setCustomId("inv_open_myst").setLabel(`🔵 Open Mysterious Chest (${cu.mysteriousChest ?? 0})`).setStyle(ButtonStyle.Primary).setDisabled(!hasMyst)
        ) : null;

        const components = chestRow ? [navRow, chestRow] : [navRow];
        return { embed, components };
      };

      const { embed, components } = buildInvPage(0);
      const msg = await interaction.reply({ embeds: [embed], components, fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000, filter: (b) => b.user.id === userId });

      collector.on("collect", async (btn) => {
        if (btn.customId === "inv_prev") {
          page = Math.max(0, page-1);
          const { embed: e, components: c } = buildInvPage(page);
          await btn.update({ embeds: [e], components: c });
        } else if (btn.customId === "inv_next") {
          page = Math.min(totalPages-1, page+1);
          const { embed: e, components: c } = buildInvPage(page);
          await btn.update({ embeds: [e], components: c });
        } else if (btn.customId === "inv_open_god") {
          await openGodChestInteraction(btn, userId);
          setTimeout(async () => {
            const { embed: e, components: c } = buildInvPage(page);
            await interaction.editReply({ embeds: [e], components: c }).catch(() => {});
          }, 1500);
        } else if (btn.customId === "inv_open_myst") {
          await openMysteriousChestInteraction(btn, userId);
          setTimeout(async () => {
            const { embed: e, components: c } = buildInvPage(page);
            await interaction.editReply({ embeds: [e], components: c }).catch(() => {});
          }, 1500);
        }
      });

      collector.on("end", async () => {
        const { embed: e } = buildInvPage(page);
        await interaction.editReply({ embeds: [e], components: [] }).catch(() => {});
      });
    },
  },

  {
    data: new SlashCommandBuilder().setName("trade").setDescription("Offer a skin trade with another player").addUserOption((o) => o.setName("player").setDescription("Player to trade with").setRequired(true)),
    async execute(interaction) {
      const initiatorId = interaction.user.id, target = interaction.options.getUser("player", true);
      if (target.id === initiatorId) { await interaction.reply({ content: "❌ Can't trade with yourself!" }); return; }
      if (target.bot) { await interaction.reply({ content: "❌ Can't trade with bots!" }); return; }
      resetQuestsIfNeeded(initiatorId); addInteraction(initiatorId);
      const initUser = getUser(initiatorId), targUser = getUser(target.id);
      const initSkins = Object.entries(initUser.inventoryNames), targSkins = Object.entries(targUser.inventoryNames);
      if (!initSkins.length) { await interaction.reply({ content: "❌ You have no skins to trade!" }); return; }
      if (!targSkins.length) { await interaction.reply({ content: `❌ <@${target.id}> has no skins!` }); return; }
      let initPick = null, targPick = null;
      const initRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_initiator`).setPlaceholder(`${interaction.user.username}, pick your skin...`).addOptions(initSkins.slice(0,25).map(([k,n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
      const msg = await interaction.reply({ content: `<@${initiatorId}> <@${target.id}>`, embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> wants to trade with <@${target.id}>!\n\n**<@${initiatorId}>** — pick your skin below.`).setColor(0x00d4ff).setFooter({ text: "Expires in 2 minutes" }).setTimestamp()], components: [initRow], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 2*60*1000, filter: (i) => i.user.id === initiatorId || i.user.id === target.id });
      collector.on("collect", async (i) => {
        if (i.isStringSelectMenu()) {
          if (i.customId === "trade_initiator" && i.user.id === initiatorId) {
            initPick = { key: i.values[0], name: initUser.inventoryNames[i.values[0]] };
            const targetRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`trade_target`).setPlaceholder(`${target.username}, pick your skin...`).addOptions(targSkins.slice(0,25).map(([k,n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k))));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Trade Offer").setDescription(`<@${initiatorId}> offers **${initPick.name}**.\n\n<@${target.id}>, pick what you'd like to offer!`).setColor(0xf4a01a).setTimestamp()], components: [targetRow] }); return;
          }
          if (i.customId === "trade_target" && i.user.id === target.id) {
            if (!initPick) { await i.reply({ content: "❌ Wait for the other player!", ephemeral: true }); return; }
            targPick = { key: i.values[0], name: targUser.inventoryNames[i.values[0]] };
            const confirmRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("trade_confirm_initiator").setLabel(`✅ ${interaction.user.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_confirm_target").setLabel(`✅ ${target.username} Confirm`).setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("trade_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Danger));
            await i.update({ embeds: [new EmbedBuilder().setTitle("🔄 Confirm Trade").setDescription(`**<@${initiatorId}>** offers: **${initPick.name}**\n**<@${target.id}>** offers: **${targPick.name}**\n\nBoth must confirm!`).setColor(0x1a9b1a).setTimestamp()], components: [confirmRow] }); return;
          }
        }
        if (i.isButton()) {
          if (i.customId === "trade_cancel") { await i.update({ content: "❌ Trade cancelled.", embeds: [], components: [] }); collector.stop(); return; }
          if (i.customId === "trade_confirm_initiator" && i.user.id !== initiatorId) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && i.user.id !== target.id) { await i.reply({ content: "❌ Not your button!", ephemeral: true }); return; }
          if (i.customId === "trade_confirm_target" && initPick && targPick) {
            const fI = getUser(initiatorId), fT = getUser(target.id);
            delete fI.inventoryNames[initPick.key]; fI.inventory = fI.inventory.filter((id) => id !== initPick.key.split("_")[0]); fI.inventoryNames[targPick.key+"_t"] = targPick.name; fI.inventory.push(targPick.key.split("_")[0]);
            delete fT.inventoryNames[targPick.key]; fT.inventory = fT.inventory.filter((id) => id !== targPick.key.split("_")[0]); fT.inventoryNames[initPick.key+"_t"] = initPick.name; fT.inventory.push(initPick.key.split("_")[0]);
            fI.tradesCompleted = (fI.tradesCompleted??0)+1; fT.tradesCompleted = (fT.tradesCompleted??0)+1;
            updateUser(initiatorId, fI); updateUser(target.id, fT); checkAndAwardAchievements(initiatorId); checkAndAwardAchievements(target.id);
            await i.update({ embeds: [new EmbedBuilder().setTitle("✅ Trade Complete!").setDescription(`**<@${initiatorId}>** received **${targPick.name}**\n**<@${target.id}>** received **${initPick.name}**`).setColor(0x00ff00).setTimestamp()], components: [], content: "" });
            collector.stop();
          }
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Trade expired.", embeds: [], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("refund").setDescription("Request a refund for a skin you bought from the Item Shop"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, user = getUser(userId);
      const shopSkins = user.shopSkins ?? [];
      if (!shopSkins.length) { await interaction.editReply({ content: "❌ No Item Shop skins eligible for refund." }); return; }
      const refundable = [], seen = new Set();
      for (const skinId of shopSkins) {
        if (seen.has(skinId) || !user.inventory.includes(skinId)) continue; seen.add(skinId);
        const nameKey = Object.keys(user.inventoryNames).find((k) => k.startsWith(skinId+"_")) ?? skinId;
        const name = user.inventoryNames[nameKey] ?? skinId, price = (user.shopSkinPrices??{})[skinId] ?? 800;
        const isFree = (user.freeSkinIds??[]).includes(skinId);
        refundable.push({ skinId, nameKey, name, price, isFree });
      }
      if (!refundable.length) { await interaction.editReply({ content: "❌ None of your shop purchases are still in your inventory." }); return; }
      const options = refundable.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.isFree ? `${s.name} 🎁 (FREE)` : s.name).setDescription(s.isFree ? "⚠️ This was FREE — consequences await" : `Refund: ${s.price.toLocaleString()} V-Bucks`).setValue(s.skinId));
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Item Shop Refund").setDescription("Select the skin to refund.\n\n⚠️ **Refunding a FREE skin will have consequences.**").setColor(0xff6600).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("refund_select").setPlaceholder("Choose a skin...").addOptions(options))] });
      const selectCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId });
      selectCol.on("collect", async (sel) => {
        selectCol.stop("selected");
        const skinId = sel.values[0], skin = refundable.find((s) => s.skinId === skinId);
        if (skin.isFree) {
          await sel.update({ content: "Processing...", embeds: [], components: [] });
          const fu = getUser(userId), lostAmount = Math.floor(Math.abs(fu.vbucks)*0.1), newVb = fu.vbucks - lostAmount;
          const invIdx = fu.inventory.indexOf(skinId); if (invIdx !== -1) fu.inventory.splice(invIdx, 1); delete fu.inventoryNames[skin.nameKey];
          const randomSkinEntry = Object.entries(fu.inventoryNames).filter(([k]) => !(fu.shopSkins??[]).includes(k.replace(/_\d+$/,"")) && !k.startsWith(skinId+"_"))[0];
          let randomRemoved = null;
          if (randomSkinEntry) { randomRemoved = randomSkinEntry[1]; const rsId = randomSkinEntry[0].replace(/_\d+$/,""); const rsIdx = fu.inventory.indexOf(rsId); if (rsIdx !== -1) fu.inventory.splice(rsIdx, 1); delete fu.inventoryNames[randomSkinEntry[0]]; }
          updateUser(userId, { inventory: fu.inventory, inventoryNames: fu.inventoryNames, shopSkins: (fu.shopSkins??[]).filter((s) => s !== skinId), vbucks: newVb, eliminatedUntil: Date.now() + 5*60*1000 });
          awardAchievement(userId, "scammed");
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📧 Email from Epic Games").setDescription(`**From:** noreply@epicgames.com\n**Subject:** Your Refund Request — Seriously?\n\n> We noticed you tried to refund **${skin.name}**, which you got for **FREE**.\n>\n> We've gone ahead and:\n> — Removed **${skin.name}** from your locker\n> — Deducted **${lostAmount.toLocaleString()} V-Bucks** (10% penalty)${randomRemoved ? `\n> — Also removed **${randomRemoved}** as a lesson` : ""}\n> — Suspended you for **5 minutes**\n>\n> Regards, Epic Games\n> *P.S. You are literally so dumb lol*`).setColor(0xff0000).setTimestamp()], components: [] }); return;
        }
        const coolLeft = ((user.refundCooldowns??{})[skinId]??0) + 4*60*60*1000 - Date.now();
        if (coolLeft > 0) { await sel.update({ content: `⏳ Still under review. Try again in **${Math.floor(coolLeft/3600000)}h ${Math.floor((coolLeft%3600000)/60000)}m**.`, embeds: [], components: [] }); return; }
        const fu2 = getUser(userId), hasBribes = Object.entries(fu2.inventoryNames).some(([k]) => !(fu2.shopSkins??[]).includes(k.replace(/_\d+$/,"")) && !k.startsWith(skinId+"_"));
        const btnRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("refund_bribe").setLabel(hasBribes ? "💸 Bribe Epic Games" : "💸 No skins to bribe with").setStyle(ButtonStyle.Danger).setDisabled(!hasBribes), new ButtonBuilder().setCustomId("refund_request").setLabel("🙏 Request Anyway (33%)").setStyle(ButtonStyle.Secondary));
        await sel.update({ embeds: [new EmbedBuilder().setTitle("⚠️ Refund Warning").setDescription(`Refunding **${skin.name}**.\n\n💰 **Refund:** ${skin.price.toLocaleString()} V-Bucks\n\n> 💸 **Bribe Epic** — sacrifice a skin for guaranteed approval\n> 🙏 **Request Anyway** — 33% chance`).setColor(0xff0000).setTimestamp()], components: [btnRow] });
        const btnCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        btnCol.on("collect", async (btn) => {
          btnCol.stop("clicked"); const fu3 = getUser(userId); let approved = false, bribedSkin = null;
          if (btn.customId === "refund_bribe") {
            const bribes = Object.entries(fu3.inventoryNames).filter(([k]) => !(fu3.shopSkins??[]).includes(k.replace(/_\d+$/,"")) && !k.startsWith(skinId+"_"));
            if (!bribes.length) { await btn.update({ content: "❌ No skins to bribe with!", embeds: [], components: [] }); return; }
            const bribe = bribes[Math.floor(Math.random()*bribes.length)]; bribedSkin = bribe[1]; const bsId = bribe[0].replace(/_\d+$/,""); const bIdx = fu3.inventory.indexOf(bsId); if (bIdx !== -1) fu3.inventory.splice(bIdx, 1); delete fu3.inventoryNames[bribe[0]]; approved = true;
          } else approved = Math.random() < 0.33;
          if (approved) {
            const refIdx = fu3.inventory.indexOf(skinId); if (refIdx !== -1) fu3.inventory.splice(refIdx, 1); delete fu3.inventoryNames[skin.nameKey]; fu3.shopSkins = (fu3.shopSkins??[]).filter((s) => s !== skinId);
            addVbucks(userId, skin.price); updateUser(userId, { inventory: fu3.inventory, inventoryNames: fu3.inventoryNames, shopSkins: fu3.shopSkins });
            awardAchievement(userId, "epic_likes_you"); checkAndAwardAchievements(userId);
            await btn.update({ embeds: [new EmbedBuilder().setTitle("✅ Refund Approved!").setDescription(`✅ **Epic approved your refund** for **${skin.name}**!\n💰 **+${skin.price.toLocaleString()} V-Bucks**${bribedSkin ? `\n\n🤝 Bribed with **${bribedSkin}** — they took it immediately.` : ""}`).setColor(0x00ff00).setTimestamp()], components: [] });
          } else {
            const c2 = fu3.refundCooldowns??{}; c2[skinId] = Date.now(); updateUser(userId, { refundCooldowns: c2 }); awardAchievement(userId, "epic_hates_you");
            await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Refund Denied!").setDescription(`❌ **Epic rejected** your refund for **${skin.name}**.\n\nNo reason given. Try again in **4 hours**.`).setColor(0xff0000).setTimestamp()], components: [] });
          }
        });
      });
    },
  },
  {
    data: new SlashCommandBuilder().setName("freevbucks").setDescription("Claim free V-Bucks from a totally legit website!"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), lostAmount = Math.floor(user.vbucks * 0.25);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🤑 Free V-Bucks Generator — 100% LEGIT!!").setDescription("**Step 1:** Enter your login ✅\n**Step 2:** Select amount: **FREE** ✅\n**Step 3:** Waiting for verification...\n\n*Please wait up to 7 days for V-Bucks to arrive!*").setColor(0x00ff00).setFooter({ text: "freevbucks4real.biz • Totally not a virus" }).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 3000));
      addVbucks(userId, -lostAmount);
      const updated = getUser(userId), ach = awardAchievement(userId, "scammed");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("😱 A Week Later...").setDescription(`You entered your login like a genius and lost **${lostAmount.toLocaleString()} V-Bucks** — 25% of everything.\n\nhaha.\n\n💳 **New balance:** ${updated.vbucks.toLocaleString()} V-Bucks${updated.vbucks <= 0 ? " *(broke)*" : ""}`).setColor(0xff0000).setTimestamp(), ...(ach ? [buildAchievementEmbed(ach)] : [])] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("creatorcode").setDescription("Support a creator for a discount on the Item Shop").addStringOption((o) => o.setName("code").setDescription("Creator code (leave blank to remove)").setRequired(false)),
    async execute(interaction) {
      const userId = interaction.user.id; addInteraction(userId);
      const rawInput = interaction.options.getString("code");
      if (!rawInput || rawInput.trim() === "") {
        const user = getUser(userId);
        if (!user.hasCreatorCode) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("ℹ️ No Creator Code Active").setDescription("Use `/creatorcode <code>` to support a creator!").setColor(0x888888).setTimestamp()] }); return; }
        updateUser(userId, { hasCreatorCode: false, creatorDiscount: 0, freeSkinExpiry: 0, freeSkinRedeemed: false });
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Creator Code Removed").setColor(0xff6600).setTimestamp()] }); return;
      }
      const code = rawInput.toLowerCase().trim(), match = VALID_CODES[code];
      if (!match) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❓ Unknown Creator Code").setDescription(`**${rawInput}** isn't valid. Try \`tylajadee\`, \`ultravioletkaty\`, or \`clovel\`!`).setColor(0xff6600).setTimestamp()] }); return; }
      const user = getUser(userId), discountPct = Math.round(match.discount * 100);
      const updates = { hasCreatorCode: true, creatorDiscount: match.discount };
      if (match.freeSkin && !((user.freeSkinExpiry??0) > Date.now() && !(user.freeSkinRedeemed??false))) { updates.freeSkinExpiry = Date.now() + 7*24*60*60*1000; updates.freeSkinRedeemed = false; }
      updateUser(userId, updates);
      let desc = `You're supporting **${match.displayName}**! 🙌\n\n**${discountPct}% discount** on the Item Shop!`;
      if (match.freeSkin) desc += `\n\n🎁 **Perk — Free Skin Week!** Get **one FREE skin** from the shop!`;
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎉 Creator Code Applied!").setDescription(desc).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("zeropoint").setDescription("Interact with the mysterious Zero Point orb"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const player = getUser(userId);
      updateUser(userId, { zeropointUses: (player.zeropointUses??0)+1 });
      const buildZPEmbed = () => new EmbedBuilder().setTitle("🔵 The Zero Point").setDescription(`*A mysterious orb crackling with energy...*\n\n✨ **Donate a skin** — always get a weapon in return!\n> ⚡ SMGs & ARs: **30% chance for 25 ammo** — fire all at once!\n> 🔫 Other weapons: 1 ammo\n\n🌟 **Donate Founders Pack** — receive **2,500 V-Bucks**\n\n🍀 **Feed Luck Potion** → **50%** chance to upgrade to Xtra Luck Potion\n🔮 **Feed Xtra Luck Potion** → **25%** chance to upgrade to Godly Luck Potion`).setColor(0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp();
      const buildZPRow = () => {
        const fu = getUser(userId);
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("zp_donate_skin").setLabel("🎮 Donate a Skin").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("zp_donate_founders").setLabel(fu.hasFoundersPack ? "🌟 Donate Founders Pack (+2,500 V-Bucks)" : "🌟 No Founders Pack").setStyle(fu.hasFoundersPack ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!fu.hasFoundersPack),
          new ButtonBuilder().setCustomId("zp_luck_potion").setLabel(fu.luckPotion > 0 ? `🍀 Feed Luck Potion (${fu.luckPotion})` : "🍀 No Luck Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.luckPotion??0) === 0),
          new ButtonBuilder().setCustomId("zp_xtra_potion").setLabel(fu.xtraLuckPotion > 0 ? `🔮 Feed Xtra Potion (${fu.xtraLuckPotion})` : "🔮 No Xtra Potion").setStyle(ButtonStyle.Primary).setDisabled((fu.xtraLuckPotion??0) === 0)
        );
      };
      const msg = await interaction.reply({ embeds: [buildZPEmbed()], components: [buildZPRow()], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        collector.stop("interacted"); const cu = getUser(userId);
        if (btn.customId === "zp_luck_potion") {
          if ((cu.luckPotion??0) <= 0) { await btn.update({ content: "❌ No Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { luckPotion: cu.luckPotion-1 });
          if (roll(50)) { updateUser(userId, { xtraLuckPotion: (cu.xtraLuckPotion??0)+1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🌀 Success! Luck Potion → Xtra Luck Potion").setDescription("The **Zero Point** crackled with energy!\n\nYour **Luck Potion** transformed into an **Xtra Luck Potion**! 🔮").setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** consumed your **Luck Potion**... the transformation failed.").setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_xtra_potion") {
          if ((cu.xtraLuckPotion??0) <= 0) { await btn.update({ content: "❌ No Xtra Luck Potions!", embeds: [], components: [] }); return; }
          updateUser(userId, { xtraLuckPotion: cu.xtraLuckPotion-1 });
          if (roll(25)) { updateUser(userId, { godlyLuckPotion: (cu.godlyLuckPotion??0)+1 }); await btn.update({ embeds: [new EmbedBuilder().setColor("#f1c40f").setTitle("⚡ GODLY! Xtra Luck Potion → Godly Luck Potion!").setDescription("The **Zero Point** ERUPTED!\n\nYour **Xtra Luck Potion** ascended into a **Godly Luck Potion**! ⚡").setTimestamp()], components: [] }); }
          else await btn.update({ embeds: [new EmbedBuilder().setColor("#607d8b").setTitle("🌀 Failed...").setDescription("The **Zero Point** tried to ascend your **Xtra Luck Potion**... and failed.").setTimestamp()], components: [] });
          return;
        }
        if (btn.customId === "zp_donate_founders") {
          if (!cu.hasFoundersPack) { await btn.update({ content: "❌ No Founders Pack!", embeds: [], components: [] }); return; }
          updateUser(userId, { hasFoundersPack: false }); addVbucks(userId, 2500);
          const after = getUser(userId);
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🌟 The Zero Point Accepts Your Offering!").setDescription(`You offered your **Founders Pack**.\n\nThe orb pulses with golden energy...\n\n💰 **+2,500 V-Bucks!**\n💳 **New balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks\n\n*Your Founders Pack was consumed.*`).setColor(0xffd700).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] }); return;
        }
        if (btn.customId === "zp_donate_skin") {
          const entries = Object.entries(cu.inventoryNames);
          if (!entries.length) { await btn.update({ content: "❌ You have no skins to donate!", embeds: [], components: [] }); return; }
          const skinOpts = entries.slice(0,25).map(([k,n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
          await btn.update({ embeds: [new EmbedBuilder().setTitle("🔵 Choose Your Offering").setDescription("The Zero Point awaits.\n\nSelect a skin to sacrifice for a weapon:").setColor(0x4444ff).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("zp_skin_select").setPlaceholder("Choose a skin to sacrifice...").addOptions(skinOpts))] });
          const skinCol = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: (i) => i.user.id === userId && i.customId === "zp_skin_select" });
          skinCol.on("collect", async (sel) => {
            skinCol.stop("selected");
            const key = sel.values[0], skinName = cu.inventoryNames[key] ?? key, skinId = key.replace(/_\d+$/,"");
            const fu2 = getUser(userId), idx = fu2.inventory.indexOf(skinId); if (idx !== -1) fu2.inventory.splice(idx, 1); delete fu2.inventoryNames[key];
            updateUser(userId, { inventory: fu2.inventory, inventoryNames: fu2.inventoryNames });
            const weapon = randomWeapon(), isMulti = isMultiAmmoWeapon(weapon), getsMulti = isMulti && Math.random() < 0.3, ammoCount = getsMulti ? 25 : 1;
            const fu3 = getUser(userId); updateUser(userId, { weapons: [...(fu3.weapons??[]), ...Array(ammoCount).fill(weapon.name)] });
            await sel.update({ embeds: [new EmbedBuilder().setTitle(getsMulti ? `⚡ JACKPOT — ${weapon.name} × 25!` : `${weapon.emoji} The Zero Point Rewards You!`).setDescription(getsMulti ? `You sacrificed **${skinName}** to the Zero Point.\n\n${weapon.emoji} **You received: ${weapon.name} × 25 ammo!**\n*"${weapon.description}"*\n\n⚡ Use \`/attack @user ${weapon.name}\` to fire all 25 shots at once!` : `You sacrificed **${skinName}**.\n\n${weapon.emoji} **You received: ${weapon.name}** *(1 ammo)*\n*"${weapon.description}"*\n\nUse \`/attack @user ${weapon.name}\`!`).setColor(getsMulti ? 0xffd700 : 0x4444ff).setImage(ZERO_PT_IMAGE).setTimestamp()], components: [] });
          });
          skinCol.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ The Zero Point lost interest.", embeds: [], components: [] }).catch(() => {}); });
        }
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("attack").setDescription("Attack another player with a weapon from your arsenal").addUserOption((o) => o.setName("target").setDescription("Player to attack").setRequired(true)).addStringOption((o) => o.setName("weapon").setDescription("Weapon to use").setRequired(true).setAutocomplete(true)),
    autocomplete: async (interaction) => {
      const userId = interaction.user.id, user = getUser(userId), focused = interaction.options.getFocused().toLowerCase();
      const weapons = [...(user.weapons??[])], unique = [...new Set(weapons)];
      const choices = unique.filter((w) => w.toLowerCase().includes(focused)).slice(0,25).map((w) => { const ammo = weapons.filter((x) => x === w).length; const wi = getWeaponByName(w); return { name: `${w} — ${ammo} ammo${wi && isMultiAmmoWeapon(wi) && ammo > 1 ? " (fires all)" : ""}`, value: w }; });
      await interaction.respond(choices);
    },
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("target", true), weaponInput = interaction.options.getString("weapon", true);
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't attack yourself." }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Bots have unlimited HP." }); return; }
      const user = getUser(userId), weapons = [...(user.weapons??[])];
      const weaponName = weapons.find((w) => w.toLowerCase() === weaponInput.toLowerCase()) ?? null;
      if (!weaponName) { const owned = [...new Set(weapons)]; await interaction.editReply({ content: `❌ You don't have **${weaponInput}**.${owned.length ? `\n\n**Arsenal:** ${owned.join(", ")}` : "\n\n*No weapons. Use \`/zeropoint\` or \`/fish\`.*"}` }); return; }
      const weaponInfo = getWeaponByName(weaponName), emoji = weaponInfo?.emoji ?? "🔫", desc2 = weaponInfo?.description ?? "A powerful weapon.", isMulti = weaponInfo ? isMultiAmmoWeapon(weaponInfo) : false;
      const ammoCount = weapons.filter((w) => w.toLowerCase() === weaponName.toLowerCase()).length, usedAmmo = isMulti ? ammoCount : 1;
      const newWeapons = [...weapons]; let removed = 0;
      for (let i = newWeapons.length-1; i >= 0 && removed < usedAmmo; i--) { if (newWeapons[i].toLowerCase() === weaponName.toLowerCase()) { newWeapons.splice(i, 1); removed++; } }
      updateUser(userId, { weapons: newWeapons });
      const HIT_CHANCE = 0.25;
      const targetUser = getUser(target.id);
      const hasShield = (targetUser.buildCharges??0) > 0;
      if (isMulti && usedAmmo > 1) {
        let hits = 0, misses = 0;
        for (let i = 0; i < usedAmmo; i++) { if (Math.random() < HIT_CHANCE) hits++; else misses++; }
        let shieldAbsorbed = 0;
        if (hasShield && hits > 0) {
          shieldAbsorbed = Math.min(hits, targetUser.buildCharges);
          hits -= shieldAbsorbed;
          const newCharges = targetUser.buildCharges - shieldAbsorbed;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        const shieldLine = shieldAbsorbed > 0 ? `\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed ${shieldAbsorbed} hit(s)!**` : "";
        if (hits > 0) {
          const elimMs = Math.min(hits*10*60*1000, 120*60*1000);
          const existing = (getUser(target.id).eliminatedUntil??0) > Date.now() ? getUser(target.id).eliminatedUntil : Date.now();
          updateUser(target.id, { eliminatedUntil: existing + elimMs });
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} unloaded on ${target.username}!`).setDescription(`Fired **${usedAmmo} rounds** of **${weaponName}**!\n\n📊 **${hits} hit(s), ${misses} miss(es)** *(+${shieldAbsorbed} blocked)*${shieldLine}\n\n☠️ **${target.username}** eliminated for **${Math.round(elimMs/60000)} minutes!**\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${interaction.user.username} missed every shot!`).setDescription(`Fired **${usedAmmo} rounds**... **0 hits, ${misses} misses.**${shieldLine}\n\n🔫 All ammo wasted.`).setColor(0x888888).setTimestamp()] });
        }
      } else {
        const hit = Math.random() < HIT_CHANCE;
        let blocked = false;
        if (hit && hasShield) {
          blocked = true;
          const newCharges = targetUser.buildCharges-1;
          updateUser(target.id, { buildCharges: newCharges, ...(newCharges === 0 ? { buildMaterial: "none" } : {}) });
        }
        if (hit && !blocked) {
          updateUser(target.id, { eliminatedUntil: Date.now()+10*60*1000 });
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Direct Hit!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n💥 **ELIMINATED!** ${target.username} can't interact for **10 minutes**.\n\`/reboot\` for **299 V-Bucks**.`).setColor(0xff0000).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
        } else if (blocked) {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Hit Blocked!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**!\n\n*"${desc2}"*\n\n🏗️ **${target.username}'s ${BUILD_MATS[targetUser.buildMaterial]?.label ?? "structure"} absorbed the shot!**`).setColor(0x888888).setTimestamp()] });
        } else {
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${emoji} Missed!`).setDescription(`**${interaction.user.username}** attacked **${target.username}** with **${weaponName}**...\n\n*"${desc2}"*\n\n💨 **MISSED!**\n\n🔫 **${weaponName}** consumed.`).setColor(0x888888).setTimestamp()] });
        }
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName("reboot").setDescription("Reboot a downed player for 299 V-Bucks").addUserOption((o) => o.setName("player").setDescription("Player to reboot").setRequired(true)),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.editReply({ content: "❌ Can't reboot a bot." }); return; }
      if (!isEliminated(target.id)) { await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Player is Alive").setDescription(`**${target.username}** is not downed!`).setColor(0x00ff00).setTimestamp()] }); return; }
      const cu = getUser(userId);
      if (!cu.infiniteVbucks && cu.vbucks < 299) { await interaction.editReply({ content: `❌ Need **299 V-Bucks** to reboot.` }); return; }
      if (!cu.infiniteVbucks) addVbucks(userId, -299);
      updateUser(target.id, { eliminatedUntil: 0 });
      const after = getUser(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔄 Player Rebooted!").setDescription(`**${interaction.user.username}** spent **299 V-Bucks** to reboot **${target.username}**!\n\n${target.username} is back!\n\n💳 **Your balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()} V-Bucks`).setColor(0x00d4ff).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("useluckpotion").setDescription("Use a luck potion on yourself or another player!").addStringOption((o) => o.setName("type").setDescription("Which luck potion?").setRequired(true).addChoices({ name: "🍀 Luck Potion (+15%)", value: "luckPotion" }, { name: "🔮 Xtra Luck Potion (+40%)", value: "xtraLuckPotion" }, { name: "⚡ Godly Luck Potion (+80%)", value: "godlyLuckPotion" })).addUserOption((o) => o.setName("player").setDescription("Player to give the luck boost to (default: yourself)").setRequired(false)),
    async execute(interaction) {
      const type = interaction.options.getString("type");
      const targetUser = interaction.options.getUser("player") ?? interaction.user;
      const userId = interaction.user.id;
      const player = getUser(userId);
      const names = { luckPotion: "Luck Potion", xtraLuckPotion: "Xtra Luck Potion", godlyLuckPotion: "Godly Luck Potion" };
      if ((player[type]??0) <= 0) { await interaction.reply({ content: `❌ You don't have any **${names[type]}**!`, ephemeral: true }); return; }
      const targetId = targetUser.id, isSelf = targetId === userId;
      const luckKey = type === "luckPotion" ? "normal" : type === "xtraLuckPotion" ? "xtra" : "godly";
      updateUser(userId, { [type]: player[type]-1 });
      updateUser(targetId, { activeLuck: luckKey });
      const INFO = { normal: { emoji: "🍀", label: "Luck Potion", boost: "+15%", color: "#2ecc71" }, xtra: { emoji: "🔮", label: "Xtra Luck Potion", boost: "+40%", color: "#9b59b6" }, godly: { emoji: "⚡", label: "Godly Luck Potion", boost: "+80%", color: "#f1c40f" } };
      const info = INFO[luckKey];
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} ${info.label} Activated!`).setDescription(isSelf ? `All your luck-based chances boosted by **${info.boost}**!` : `You gifted your **${info.label}** to <@${targetId}>!\n\nTheir luck-based chances are boosted by **${info.boost}**!`).addFields({ name: "God Chest Chance", value: `${boostedChance(5, luckKey)}%`, inline: true }, { name: "Inf V-Bucks Chance", value: `${boostedChance(15, luckKey)}%`, inline: true }, { name: "10k V-Bucks Chance", value: `${boostedChance(25, luckKey)}%`, inline: true }).setFooter({ text: isSelf ? "Active on yourself" : `Active on ${targetUser.username}` })] });
      if (!isSelf && interaction.channel?.send) await interaction.channel.send({ content: `<@${targetId}>`, embeds: [new EmbedBuilder().setColor(info.color).setTitle(`${info.emoji} You received a Luck Boost!`).setDescription(`<@${userId}> used their **${info.label}** on you!\n\nYour luck-based chances are boosted by **${info.boost}**!`)] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("skinalogue").setDescription("Browse all catchable Fortnite skins").addStringOption((o) => o.setName("search").setDescription("Filter by name").setRequired(false)),
    async execute(interaction) {
      await interaction.deferReply();
      const query = (interaction.options.getString("search") ?? "").trim().toLowerCase();
      const allSkins = await fetchFortniteSkins(), filtered = query ? allSkins.filter((s) => s.name.toLowerCase().includes(query)) : allSkins;
      let page = 0;
      const buildSkinPage = (p) => {
        const total = filtered.length, totalPages = Math.max(1, Math.ceil(total/8)), safePage = Math.min(p, totalPages-1);
        const slice = filtered.slice(safePage*8, safePage*8+8);
        const embed = new EmbedBuilder().setTitle(query ? `📖 Skinalogue — "${query}"` : "📖 Skinalogue — All Skins").setDescription(total === 0 ? `No skins found for **"${query}"**.` : slice.map((s) => `${getRarityEmoji(s.rarity)} **${s.name}** · *${s.rarity}* · \`${getSpawnPercent(s.rarity)}%\` spawn`).join("\n")).setColor(0x00d4ff).setFooter({ text: total === 0 ? "No results" : `Page ${safePage+1} of ${totalPages} • ${total} skin(s)` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`skin_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0 || total === 0), new ButtonBuilder().setCustomId(`skin_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages-1 || total === 0));
        return { embed, row, totalPages, safePage };
      };
      const { embed, row } = buildSkinPage(0);
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      if (!filtered.length) return;
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000, filter: (b) => b.user.id === interaction.user.id });
      collector.on("collect", async (btn) => {
        const { totalPages, safePage } = buildSkinPage(page);
        if (btn.customId === "skin_prev") page = Math.max(0, safePage-1); else page = Math.min(totalPages-1, safePage+1);
        const { embed: _se, row: _sr } = buildSkinPage(page); await btn.update({ embeds: [_se], components: [_sr] });
      });
      collector.on("end", async () => { const { embed: e } = buildSkinPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("llama").setDescription("Open a Supply Llama! 1-hour cooldown — great random rewards inside"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 60*60*1000;
      if (now - (user.lastLlama??0) < cooldown) {
        const left = cooldown - (now - (user.lastLlama??0)), h = Math.floor(left/3600000), m = Math.floor((left%3600000)/60000), s = Math.floor((left%60000)/1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 No Llamas Available").setDescription(`The next Supply Llama spawns in:\n\n⏳ **${h>0?h+"h ":""}${m}m ${s}s**\n\n*Llamas are rare! Come back soon.*`).setColor(0x888888).setImage(LLAMA_IMAGE).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🦙 A Supply Llama appeared!").setDescription("You spotted a **Supply Llama** grazing nearby...\n\nPicking the locks...").setColor(0xf4a01a).setImage(LLAMA_IMAGE).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2000));
      updateUser(userId, { lastLlama: now, llamaOpens: (user.llamaOpens??0)+1 });
      const luck = user.activeLuck;
      const LLAMA_TABLE = [
        { weight: 20, fn: () => { addVbucks(userId, 200); return { desc: "💰 **200 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 15, fn: () => { addVbucks(userId, 500); return { desc: "💰 **500 V-Bucks**!", color: 0x00d4ff }; } },
        { weight: 10, fn: () => { addVbucks(userId, 1000); return { desc: "💰 **1,000 V-Bucks!**", color: 0xf4a01a }; } },
        { weight: 15, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons??[]), w.name] }); return { desc: `${w.emoji} **${w.name}** *(weapon)!*`, color: 0xff6600 }; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes??0)+2 }); return { desc: "📦 **2 STW Boxes**!", color: 0xff6600 }; } },
        { weight: 8,  fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion??0)+1 }); return { desc: "🍀 **Luck Potion**!", color: 0x2ecc71 }; } },
        { weight: 6,  fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion??0)+1 }); return { desc: "🔮 **Xtra Luck Potion**!", color: 0x9b4dca }; } },
        { weight: boostedChance(4, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return { desc: `${getRarityEmoji(skin.rarity)} **${skin.name}** *(${skin.rarity} skin!)* 🎮`, color: getRarityColor(skin.rarity), image: skin.imageUrl }; } },
        { weight: boostedChance(3, luck), fn: () => { updateUser(userId, { foundersBoxes: (getUser(userId).foundersBoxes??0)+1 }); return { desc: "📦 **Founders Box!**", color: 0xffd700 }; } },
        { weight: boostedChance(2, luck), fn: () => { updateUser(userId, { godChest: (getUser(userId).godChest??0)+1 }); return { desc: "🌟 **GOD CHEST!** Extremely rare!", color: 0xffd700 }; } },
      ];
      const total = LLAMA_TABLE.reduce((a,b) => a+b.weight, 0); let r = Math.random()*total; let chosen = LLAMA_TABLE[0];
      for (const item of LLAMA_TABLE) { r -= item.weight; if (r <= 0) { chosen = item; break; } }
      const result = await chosen.fn();
      checkAndAwardAchievements(userId);
      const embed = new EmbedBuilder().setTitle("🦙 Supply Llama Opened!").setDescription(`You cracked open the **Supply Llama** and found...\n\n${result.desc}\n\n+50 XP earned!`).setColor(result.color).setFooter({ text: "Next llama available in 1 hour" }).setTimestamp();
      if (result.image) embed.setThumbnail(result.image);
      addXP(userId, 50);
      const godChestRow = result.desc.includes("GOD CHEST") ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("llama_open_godchest").setLabel("🌟 Open God Chest!").setStyle(ButtonStyle.Success)) : null;
      await interaction.editReply({ embeds: [embed], ...(godChestRow ? { components: [godChestRow] } : {}) });
      if (godChestRow) {
        const gcMsg = await interaction.fetchReply();
        const gcCol = gcMsg.createMessageComponentCollector({ time: 60000 });
        gcCol.on("collect", async (btn) => {
          if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your chest!", ephemeral: true });
          await openGodChestInteraction(btn, userId); gcCol.stop();
        });
        gcCol.on("end", async () => { await interaction.editReply({ components: [] }).catch(() => {}); });
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName("fish").setDescription("Grab your fishing rod and head to a named location! 15-minute cooldown").addStringOption((o) => o.setName("location").setDescription("Where to fish").setRequired(false).addChoices(...FISH_SPOTS.slice(0,10).map((s) => ({ name: s, value: s })))),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 15*60*1000;
      if (now - (user.lastFish??0) < cooldown) {
        const left = cooldown - (now - (user.lastFish??0)), m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎣 Still Fishing...").setDescription(`You just went fishing! Wait **${m}m ${s}s** before going again.\n\n*The fish need time to respawn!*`).setColor(0x888888).setTimestamp()] }); return;
      }
      const spot = interaction.options.getString("location") ?? FISH_SPOTS[Math.floor(Math.random()*FISH_SPOTS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎣 Fishing at ${spot}...`).setDescription("You cast your line into the water...\n\n*Waiting for a bite...*").setColor(0x0075e3).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 1500 + Math.random()*2500));
      const catch_ = weightedFish();
      const resultDesc = catch_.action(userId);
      updateUser(userId, { lastFish: now, fishCaught: (user.fishCaught??0)+1 });
      addXP(userId, 60);
      checkAndAwardAchievements(userId);
      if (catch_.name === "Mythic Goldfish") awardAchievement(userId, "goldfish");
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`${catch_.emoji} You caught a ${catch_.name}!`).setDescription(`Fishing at **${spot}**...\n\n${resultDesc}!\n\n+60 XP earned!`).setColor(catch_.name === "Junk" ? 0x888888 : catch_.name === "Mythic Goldfish" ? 0xffd700 : 0x0075e3).setFooter({ text: "Next fishing trip in 15 minutes" }).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("battlepass").setDescription("View your Battle Pass progress and tier rewards"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const tier = getBattlePassTier(user.level, user.xp);
      const nextReward = BP_REWARDS.find((r) => r.tier > tier);
      const bar = "█".repeat(Math.round((tier/100)*20)) + "░".repeat(20 - Math.round((tier/100)*20));
      const rewardLines = BP_REWARDS.map((r) => `${tier >= r.tier ? "✅" : "🔒"} **Tier ${r.tier}:** ${r.reward}`);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🎮 ${interaction.user.username}'s Battle Pass`).setDescription(`**Tier:** ${tier}/100\n\`${bar}\`\n\n${nextReward ? `**Next reward at Tier ${nextReward.tier}:** ${nextReward.reward}\n*Earn XP to level up your Battle Pass tier!*` : "🏆 **BATTLE PASS COMPLETE!**"}\n\n**All Rewards:**\n${rewardLines.join("\n")}`).setColor(tier >= 100 ? 0xffd700 : tier >= 50 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "Tier increases with bot level & XP" }).setTimestamp()] });
      if (tier >= 100) checkAndAwardAchievements(userId);
    },
  },

  {
    data: new SlashCommandBuilder().setName("stormwatch").setDescription("Check the storm — you might be safe, or you might be in it! 10-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 10*60*1000;
      if (now - (user.lastStorm??0) < cooldown) {
        const left = cooldown - (now - (user.lastStorm??0)), m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Storm Already Checked").setDescription(`You already checked the storm recently.\n\nWait **${m}m ${s}s** before checking again.`).setColor(0x888888).setTimestamp()] }); return;
      }
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🌪️ Checking Storm Position...").setDescription("Pulling up the storm map...\n\n*Triangulating your position...*").setColor(0x888888).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 1500));
      const event = rollStorm();
      const result = event.fn(userId);
      updateUser(userId, { lastStorm: now });
      if (event.name.includes("Safe") || event.name.includes("Eye")) { updateUser(userId, { stormsSurvived: (user.stormsSurvived??0)+1 }); checkAndAwardAchievements(userId); }
      const pos = FORTNITE_POIS[Math.floor(Math.random()*FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🌪️ Storm Report — ${event.name}`).setDescription(`📍 **Your location:** ${pos}\n\n${result}!\n\n⏰ **Next circle closes in:** ${Math.floor(Math.random()*3)+1}m 30s`).setColor(event.color).setFooter({ text: "Next storm check in 10 minutes" }).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("supply_drop").setDescription("Call in a Supply Drop from the Battle Bus! 30-minute cooldown"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), cooldown = 30*60*1000;
      if (now - (user.lastSupplyDrop??0) < cooldown) {
        const left = cooldown - (now - (user.lastSupplyDrop??0)), m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop On Cooldown").setDescription(`A drop was already called. Next one in:\n\n⏳ **${m}m ${s}s**`).setColor(0x888888).setTimestamp()] }); return;
      }
      const location = FORTNITE_POIS[Math.floor(Math.random()*FORTNITE_POIS.length)];
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Incoming!").setDescription(`A Supply Drop was spotted over **${location}**!\n\n*Balloon descending...*`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setTimestamp()] });
      await new Promise((r) => setTimeout(r, 2000 + Math.random()*2000));
      updateUser(userId, { lastSupplyDrop: now, supplyDrops: (user.supplyDrops??0)+1 });
      const luck = user.activeLuck;
      const DROP_TABLE = [
        { weight: 25, fn: () => { addVbucks(userId, 300); return "💰 **300 V-Bucks**"; } },
        { weight: 20, fn: () => { addVbucks(userId, 750); return "💰 **750 V-Bucks**"; } },
        { weight: 20, fn: () => { const w = randomWeapon(); updateUser(userId, { weapons: [...(getUser(userId).weapons??[]), w.name, w.name] }); return `${w.emoji} **${w.name} × 2 ammo**`; } },
        { weight: 15, fn: () => { updateUser(userId, { luckPotion: (getUser(userId).luckPotion??0)+1 }); return "🍀 **Luck Potion**"; } },
        { weight: 10, fn: () => { updateUser(userId, { boxes: (getUser(userId).boxes??0)+1 }); return "📬 **STW Box**"; } },
        { weight: boostedChance(5, luck), fn: () => { updateUser(userId, { xtraLuckPotion: (getUser(userId).xtraLuckPotion??0)+1 }); return "🔮 **Xtra Luck Potion!**"; } },
        { weight: boostedChance(3, luck), fn: async () => { const skin = await getRandomSkin(); addSkinToInventory(userId, skin.id, skin.name); return `${getRarityEmoji(skin.rarity)} **${skin.name}** *(skin!)*`; } },
      ];
      const dtTotal = DROP_TABLE.reduce((a,b) => a+b.weight, 0); let dr = Math.random()*dtTotal; let chosenDrop = DROP_TABLE[0];
      for (const d of DROP_TABLE) { dr -= d.weight; if (dr <= 0) { chosenDrop = d; break; } }
      const dropResult = await chosenDrop.fn();
      addXP(userId, 75); checkAndAwardAchievements(userId);
      await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("📦 Supply Drop Landed!").setDescription(`The drop landed in **${location}** — you reached it first!\n\nInside the crate:\n\n${dropResult}!\n\n+75 XP earned!`).setColor(0x0075e3).setImage(SUPPLY_IMAGE).setFooter({ text: "Next supply drop in 30 minutes" }).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("build").setDescription("Build a structure for protection").addStringOption((o) => o.setName("material").setDescription("Building material").setRequired(true).addChoices({ name: "🪵 Wood — 50 V-Bucks (1 hit)", value: "wood" }, { name: "🧱 Brick — 125 V-Bucks (2 hits)", value: "brick" }, { name: "⚙️ Metal — 250 V-Bucks (3 hits)", value: "metal" })),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const material = interaction.options.getString("material"), mat = BUILD_MATS[material];
      const user = getUser(userId);
      if (!user.infiniteVbucks && user.vbucks < mat.cost) { await interaction.reply({ content: `❌ Need **${mat.cost} V-Bucks** to build with **${mat.label}**. You have **${user.vbucks.toLocaleString()}**.` }); return; }
      if (!user.infiniteVbucks) addVbucks(userId, -mat.cost);
      updateUser(userId, { buildCharges: mat.charges, buildMaterial: material, timesBuilt: (user.timesBuilt??0)+1 });
      addXP(userId, 30); checkAndAwardAchievements(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏗️ Structure Built — ${mat.label}!`).setDescription(`You built a **${mat.label}** structure!\n\n${mat.desc}\n\n💳 **V-Bucks spent:** ${mat.cost.toLocaleString()}\n🏗️ **Charges:** ${mat.charges}`).setColor(material === "wood" ? 0x8b4513 : material === "brick" ? 0xb05020 : 0x708090).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("medkit").setDescription("Use a medkit to cut your elimination time in half (costs 100 V-Bucks)"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!isEliminated(userId)) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ You're Not Eliminated!").setDescription("You don't need a medkit — you're alive!").setColor(0x00ff00).setTimestamp()] }); return; }
      if (!user.infiniteVbucks && user.vbucks < 100) { await interaction.reply({ content: `❌ Need **100 V-Bucks** for a medkit.` }); return; }
      const timeLeft = getEliminationTimeLeft(userId), newTime = Math.floor(timeLeft/2), newElimUntil = Date.now() + newTime;
      if (!user.infiniteVbucks) addVbucks(userId, -100);
      updateUser(userId, { eliminatedUntil: newElimUntil }); addXP(userId, 25);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("💊 Medkit Used!").setDescription(`Your elimination time was cut in half.\n\n⏳ **Time remaining:** ${Math.ceil(newTime/60000)} min(s)\n💳 **V-Bucks spent:** 100`).setColor(0x2ecc71).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("spy").setDescription("Spy on another player to see their public bot stats").addUserOption((o) => o.setName("player").setDescription("Player to spy on").setRequired(true)),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const target = interaction.options.getUser("player", true);
      if (target.bot) { await interaction.reply({ content: "❌ Can't spy on a bot." }); return; }
      const targetData = getUser(target.id), tier = getBattlePassTier(targetData.level, targetData.xp);
      const eliminated = isEliminated(target.id), timeLeft = eliminated ? Math.ceil(getEliminationTimeLeft(target.id)/60000) : 0;
      const matInfo = targetData.buildCharges > 0 ? `${BUILD_MATS[targetData.buildMaterial]?.label ?? "🪵 Wood"} (${targetData.buildCharges} charge${targetData.buildCharges !== 1 ? "s" : ""})` : "None";
      const spyActions = ["hacked a satellite dish","bribed a llama","intercepted their signals","found their trophy case","checked their Fortnite locker"];
      const spyFlavor = spyActions[Math.floor(Math.random()*spyActions.length)];
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🕵️ Intel Report — ${target.username}`).setDescription(`*You ${spyFlavor}*\n\n📊 **Level:** ${targetData.level}\n🎮 **Battle Pass Tier:** ${tier}/100\n🎒 **Skins:** ${targetData.inventory.length}\n💰 **V-Bucks (approx):** ~${Math.floor(targetData.vbucks/500)*500}+\n🔥 **Daily Streak:** ${targetData.dailyStreak??0} days\n🏗️ **Build:** ${matInfo}\n🪙 **Coin Flip Wins:** ${targetData.coinflipsWon??0}\n${eliminated ? `\n☠️ **Status:** ELIMINATED (${timeLeft} min left)` : "\n✅ **Status:** Active"}`).setColor(0x2c2c2c).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
    },
  },

  {
    data: new SlashCommandBuilder().setName("duel").setDescription("Challenge someone to a 1v1 skin or V-Bucks duel!").addUserOption((o) => o.setName("player").setDescription("Player to duel").setRequired(true)).addStringOption((o) => o.setName("wager").setDescription("What to wager").setRequired(false).addChoices({ name: "💰 V-Bucks (500)", value: "vbucks" }, { name: "🎮 A Skin from inventory", value: "skin" })),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id, target = interaction.options.getUser("player", true);
      const wagerType = interaction.options.getString("wager") ?? "vbucks";
      if (target.id === userId) { await interaction.editReply({ content: "❌ Can't duel yourself!" }); return; }
      if (target.bot) { await interaction.editReply({ content: "❌ Can't duel bots!" }); return; }
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const challenger = getUser(userId), targetData = getUser(target.id);
      updateUser(userId, { duelsPlayed: (challenger.duelsPlayed??0)+1 });
      if (wagerType === "vbucks") {
        const amount = 500;
        if (!challenger.infiniteVbucks && challenger.vbucks < amount) { await interaction.editReply({ content: `❌ Need **${amount} V-Bucks** to duel.` }); return; }
        if (!targetData.infiniteVbucks && targetData.vbucks < amount) { await interaction.editReply({ content: `❌ <@${target.id}> doesn't have enough V-Bucks.` }); return; }
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`duel_accept_${userId}`).setLabel("⚔️ Accept").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`duel_decline_${userId}`).setLabel("🏳️ Decline").setStyle(ButtonStyle.Secondary));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("⚔️ Duel Challenge!").setDescription(`<@${userId}> challenged <@${target.id}> to a **1v1 duel!**\n\n💰 **Wager:** 500 V-Bucks each\n🏆 **Winner takes:** 1,000 V-Bucks\n\n<@${target.id}>, do you accept?`).setColor(0xff4444).setTimestamp()], components: [row] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === target.id });
        collector.on("collect", async (btn) => {
          if (btn.customId.includes("decline")) { await btn.update({ embeds: [new EmbedBuilder().setTitle("🏳️ Duel Declined").setDescription(`<@${target.id}> backed down!`).setColor(0x888888).setTimestamp()], components: [], content: "" }); collector.stop(); return; }
          collector.stop("accepted");
          await btn.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Duel in Progress!").setDescription("```\n3...\n2...\n1...\nFIRE!\n```").setColor(0xff4444).setTimestamp()], components: [] });
          await new Promise((r) => setTimeout(r, 2500));
          const cLuck = LUCK_BOOST[challenger.activeLuck]??0, tLuck = LUCK_BOOST[targetData.activeLuck]??0;
          const cScore = Math.random()*100+cLuck, tScore = Math.random()*100+tLuck;
          const winnerId = cScore > tScore ? userId : target.id, loserId = winnerId === userId ? target.id : userId;
          if (!getUser(loserId).infiniteVbucks) addVbucks(loserId, -amount);
          addVbucks(winnerId, amount); addXP(winnerId, 150);
          awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
          const moves = ["landed a perfect headshot","built a 90 and edited out","pump-sniped from 200m","hit every shot with the Stinger","RNG blessed them"];
          await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Duel Over — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** ${moves[Math.floor(Math.random()*moves.length)]} and eliminated **<@${loserId}>**!\n\n🏆 **+${amount} V-Bucks** to the winner!\n💸 **-${amount} V-Bucks** from the loser`).setColor(0xffd700).setTimestamp()], content: "" });
        });
        collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      } else {
        const challSkins = Object.entries(challenger.inventoryNames), targSkins = Object.entries(targetData.inventoryNames);
        if (!challSkins.length) { await interaction.editReply({ content: "❌ You have no skins to wager." }); return; }
        if (!targSkins.length) { await interaction.editReply({ content: `❌ <@${target.id}> has no skins to wager.` }); return; }
        const challOpts = challSkins.slice(0,25).map(([k,n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
        const msg = await interaction.editReply({ content: `<@${target.id}>`, embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> challenged <@${target.id}> to a **skin duel**!\n\n<@${userId}>, pick a skin to wager first.`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_challenger").setPlaceholder("Pick your skin...").addOptions(challOpts))] });
        let challPick = null, targPick = null;
        const collector2 = msg.createMessageComponentCollector({ time: 2*60*1000, filter: (i) => i.user.id === userId || i.user.id === target.id });
        collector2.on("collect", async (i) => {
          if (i.isStringSelectMenu() && i.customId === "duel_skin_challenger" && i.user.id === userId) {
            challPick = { key: i.values[0], name: challenger.inventoryNames[i.values[0]] };
            const targOpts = targSkins.slice(0,25).map(([k,n]) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(k));
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel!").setDescription(`<@${userId}> wagers **${challPick.name}**!\n\n<@${target.id}>, pick your skin:`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("duel_skin_target").setPlaceholder("Pick your skin...").addOptions(targOpts))] }); return;
          }
          if (i.isStringSelectMenu() && i.customId === "duel_skin_target" && i.user.id === target.id) {
            if (!challPick) { await i.reply({ content: "❌ Wait!", ephemeral: true }); return; }
            targPick = { key: i.values[0], name: targetData.inventoryNames[i.values[0]] };
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Skin Duel — Ready?").setDescription(`**<@${userId}>** wagers: **${challPick.name}**\n**<@${target.id}>** wagers: **${targPick.name}**\n\nClick to fight!`).setColor(0xff4444).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("sduel_confirm").setLabel("⚔️ Both Confirm — Fight!").setStyle(ButtonStyle.Danger))] }); return;
          }
          if (i.isButton() && i.customId === "sduel_confirm") {
            collector2.stop("done");
            await i.update({ embeds: [new EmbedBuilder().setTitle("⚔️ Duel in Progress!").setDescription("```\n3...\n2...\n1...\nFIRE!\n```").setColor(0xff4444).setTimestamp()], components: [] });
            await new Promise((r) => setTimeout(r, 2000));
            const cLuck2 = LUCK_BOOST[challenger.activeLuck]??0, tLuck2 = LUCK_BOOST[targetData.activeLuck]??0;
            const cScore2 = Math.random()*100+cLuck2, tScore2 = Math.random()*100+tLuck2;
            const winnerId = cScore2 > tScore2 ? userId : target.id, loserId = winnerId === userId ? target.id : userId;
            const loserPick = loserId === userId ? challPick : targPick;
            const loserData = getUser(loserId); const idx = loserData.inventory.indexOf(loserPick.key.replace(/_\d+$/,"")); if (idx !== -1) loserData.inventory.splice(idx, 1); delete loserData.inventoryNames[loserPick.key];
            updateUser(loserId, { inventory: loserData.inventory, inventoryNames: loserData.inventoryNames });
            addSkinToInventory(winnerId, loserPick.key.replace(/_\d+$/,""), loserPick.name);
            awardAchievement(winnerId, "duel_champion"); checkAndAwardAchievements(winnerId);
            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ Skin Duel — <@${winnerId}> wins!`).setDescription(`**<@${winnerId}>** outplayed **<@${loserId}>**!\n\n🏆 **<@${winnerId}>** receives **${loserPick.name}**!`).setColor(0xffd700).setTimestamp()], content: "" });
          }
        });
        collector2.on("end", (_, r) => { if (r === "time") interaction.editReply({ content: "⏰ Duel expired.", embeds: [], components: [] }).catch(() => {}); });
      }
    },
  },

  {
    data: new SlashCommandBuilder().setName("leaderboard").setDescription("View top players ranked by skins, V-Bucks, or level"),
    async execute(interaction) {
      await interaction.deferReply();
      let mode = "skins";
      const buildLBEmbed = async (m) => {
        const guild = interaction.guild, allUsers2 = getAllUsers();
        const entries = await Promise.all(Object.entries(allUsers2).map(async ([uid, d]) => {
          let name = `User ${uid.slice(-4)}`;
          if (guild) { try { const mem = await guild.members.fetch(uid).catch(() => null); if (mem) name = mem.displayName; } catch {} }
          return { uid, name, skins: d.inventory.length, vbucks: d.vbucks, level: d.level, xp: d.xp };
        }));
        const sorted = [...entries].sort((a,b) => m === "skins" ? b.skins-a.skins : m === "vbucks" ? b.vbucks-a.vbucks : b.xp-a.xp);
        const medals = (r) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : `**${r}.**`;
        const modeLabel = m === "skins" ? "🎮 Most Skins" : m === "vbucks" ? "💰 Most V-Bucks" : "⭐ Highest Level";
        const lines2 = sorted.slice(0,10).map((p,i) => `${medals(i+1)} **${p.name}** — ${m === "skins" ? `${p.skins} skin(s)` : m === "vbucks" ? `${p.vbucks.toLocaleString()} V-Bucks` : `Level ${p.level} · ${p.xp.toLocaleString()} XP`}`);
        return new EmbedBuilder().setTitle(`🏆 Leaderboard — ${modeLabel}`).setDescription(lines2.length ? lines2.join("\n") : "No players yet!").setColor(0xf4a01a).setTimestamp();
      };
      const buildLBRow = (m) => new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("lb_skins").setLabel("🎮 Most Skins").setStyle(m==="skins"?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(m==="skins"), new ButtonBuilder().setCustomId("lb_vbucks").setLabel("💰 Most V-Bucks").setStyle(m==="vbucks"?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(m==="vbucks"), new ButtonBuilder().setCustomId("lb_level").setLabel("⭐ Highest Level").setStyle(m==="level"?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(m==="level"));
      const embed = await buildLBEmbed(mode);
      const msg = await interaction.editReply({ embeds: [embed], components: [buildLBRow(mode)] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000 });
      collector.on("collect", async (btn) => {
        if (btn.customId === "lb_skins") mode = "skins"; else if (btn.customId === "lb_vbucks") mode = "vbucks"; else mode = "level";
        await btn.update({ embeds: [await buildLBEmbed(mode)], components: [buildLBRow(mode)] });
      });
      collector.on("end", async () => { await interaction.editReply({ embeds: [await buildLBEmbed(mode)], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("daily").setDescription("Claim your daily V-Bucks reward — streaks add bonus V-Bucks!"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), now = Date.now(), last = user.lastDailyClaim??0, since = now - last;
      if (since < 24*60*60*1000) {
        const left = 24*60*60*1000 - since, h = Math.floor(left/3600000), m = Math.floor((left%3600000)/60000);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⏰ Already Claimed!").setDescription(`Already claimed today.\n\n⏳ **Next claim in:** ${h}h ${m}m\n🔥 **Streak:** ${user.dailyStreak} day(s)`).setColor(0xff6600).setTimestamp()] }); return;
      }
      const newStreak = last === 0 || since >= 48*60*60*1000 ? 1 : (user.dailyStreak??0)+1;
      const reward = 150 + (newStreak-1)*100;
      const streakBroken = last !== 0 && since >= 48*60*60*1000 && (user.dailyStreak??0) > 1;
      addVbucks(userId, reward); addXP(userId, 75);
      updateUser(userId, { lastDailyClaim: now, dailyStreak: newStreak });
      const updated = getUser(userId);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🎁 Daily Reward Claimed!").setDescription(`${streakBroken ? "⚠️ **Streak reset!**\n\n" : newStreak > 1 ? `🎉 **${newStreak}-day streak!**\n\n` : ""}💰 **+${reward} V-Bucks**!\n💳 **Balance:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n🔥 **Streak:** ${newStreak} day(s)`).setColor(newStreak >= 7 ? 0xf4a01a : newStreak >= 3 ? 0x9b4dca : 0x00d4ff).setThumbnail(interaction.user.displayAvatarURL()).setFooter({ text: "+75 XP bonus!" }).setTimestamp()] });
      checkAndAwardAchievements(userId);
    },
  },

  {
    data: new SlashCommandBuilder().setName("achievements").setDescription("View your achievements"),
    async execute(interaction) {
      const userId = interaction.user.id; resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId), earned = new Set(user.achievementsEarned??[]);
      let page = 0; const PAGE_SIZE = 8;
      const buildAchPage = (p) => {
        const total = ALL_ACHIEVEMENTS.length, totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE)), safePage = Math.min(p, totalPages-1);
        const slice = ALL_ACHIEVEMENTS.slice(safePage*PAGE_SIZE, safePage*PAGE_SIZE+PAGE_SIZE);
        const lines = slice.map((a) => earned.has(a.id) ? `🏆 ${a.emoji} **${a.title}**\n   *${a.description}*` : `🔒 ~~${a.emoji} ${a.title}~~\n   ||${a.description}||`);
        const bar = "█".repeat(Math.round((earned.size/total)*10)) + "░".repeat(10 - Math.round((earned.size/total)*10));
        const embed = new EmbedBuilder().setTitle(`🏆 ${interaction.user.username}'s Achievements`).setDescription(`\`${bar}\` ${earned.size}/${total}\n\n${lines.join("\n\n")}`).setColor(earned.size === total ? 0xf4a01a : 0x00d4ff).setFooter({ text: `Page ${safePage+1} of ${totalPages}` }).setTimestamp();
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ach_prev`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0), new ButtonBuilder().setCustomId(`ach_next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages-1));
        return { embed, row, totalPages };
      };
      const { embed, row } = buildAchPage(0);
      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5*60*1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        const { totalPages } = buildAchPage(page);
        if (btn.customId === "ach_prev") page = Math.max(0, page-1); else page = Math.min(totalPages-1, page+1);
        const { embed: _ae, row: _ar } = buildAchPage(page); await btn.update({ embeds: [_ae], components: [_ar] });
      });
      collector.on("end", async () => { const { embed: e } = buildAchPage(page); await interaction.editReply({ embeds: [e], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("musicpass").setDescription("Purchase today's Music Pass — 1 exclusive Icon Series skin! Refreshes every 24 hours"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const skin = await getMusicPass();
      if (!skin) { await interaction.editReply({ content: "❌ No Icon Series skins available right now. Try again later!" }); return; }
      const mpData = getMusicPassData();
      const alreadyPurchased = isMusicPassPurchaser(userId);
      const msLeft = Math.max(0, MUSIC_PASS_RESET_MS - (Date.now() - mpData.lastReset));
      const rh = Math.floor(msLeft/3600000), rm = Math.floor((msLeft%3600000)/60000);
      if (alreadyPurchased) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎵 Music Pass — Already Purchased").setDescription(`You already purchased today's Music Pass!\n\n🩵 **Today's skin:** ${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ Rarity: **${skin.rarity}**\n\n⏳ **Next refresh in:** ${rh}h ${rm}m`).setColor(getRarityColor(skin.rarity)).setTimestamp()] }); return;
      }
      const user = getUser(userId);
      const embed = new EmbedBuilder()
        .setTitle("🎵 Music Pass")
        .setDescription(`Today's Music Pass features an exclusive **Icon Series** skin:\n\n${getRarityEmoji(skin.rarity)} **${skin.name}**\n✨ Rarity: **${skin.rarity}**\n*${skin.description}*\n\n💰 **Cost: 1,000 V-Bucks**\n💳 **Your balance:** ${user.infiniteVbucks ? "∞" : user.vbucks.toLocaleString()} V-Bucks\n\n🔄 **Refreshes in:** ${rh}h ${rm}m`)
        .setColor(getRarityColor(skin.rarity))
        .setFooter({ text: "Music Pass • 1 Icon Series skin • Refreshes every 24 hours" })
        .setTimestamp();
      if (skin.imageUrl) embed.setImage(skin.imageUrl);
      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("musicpass_buy").setLabel("🎵 Purchase — 1,000 V-Bucks").setStyle(ButtonStyle.Success));
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 2*60*1000, filter: (b) => b.user.id === userId });
      collector.on("collect", async (btn) => {
        const freshUser = getUser(userId);
        if (isMusicPassPurchaser(userId)) { await btn.reply({ content: "❌ You already purchased today's Music Pass!", ephemeral: true }); return; }
        if (!freshUser.infiniteVbucks && freshUser.vbucks < MUSIC_PASS_COST) { await btn.reply({ content: `❌ Need **1,000 V-Bucks** but you only have **${freshUser.vbucks.toLocaleString()}**.`, ephemeral: true }); return; }
        if (!freshUser.infiniteVbucks) addVbucks(userId, -MUSIC_PASS_COST);
        addSkinToInventory(userId, skin.id + "_musicpass_" + Date.now(), skin.name + " 🎵");
        addMusicPassPurchaser(userId);
        const updated = getUser(userId);
        collector.stop("purchased");
        await btn.update({ embeds: [new EmbedBuilder().setTitle("🎵 Music Pass Purchased!").setDescription(`${getRarityEmoji(skin.rarity)} **${skin.name}** has been added to your locker!\n\n💰 **Spent:** 1,000 V-Bucks\n💳 **Remaining:** ${updated.infiniteVbucks ? "∞" : updated.vbucks.toLocaleString()} V-Bucks\n\n🔄 Come back in **${rh}h ${rm}m** for the next Music Pass!`).setColor(getRarityColor(skin.rarity)).setTimestamp()], components: [] });
      });
      collector.on("end", (_, r) => { if (r === "time") interaction.editReply({ embeds: [embed], components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("savetheworld").setDescription("View and claim your Save The World quests"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if ((user.stwPacks ?? 0) <= 0) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle("📦 Save The World")
          .setDescription("You don't have any STW Packs!\n\n**How to get them:**\nWatch the spawn channel — STW Packs drop occasionally. Type `buy` to claim them when they appear.\n\nOnce you have packs, come back here to tackle quests and earn rewards!")
          .setColor(0xff6600).setTimestamp()] });
        return;
      }
      if (!user.stwQuestBaseline || Object.keys(user.stwQuestBaseline).length === 0) {
        const baseline = {};
        for (const q of STW_QUESTS) baseline[q.stat] = user[q.stat] ?? 0;
        updateUser(userId, { stwQuestBaseline: baseline, stwQuestCompleted: [] });
      }
      const freshUser = getUser(userId);
      const quests = getStwQuestProgress(freshUser);
      if (quests.every(q => q.done)) {
        const newBaseline = {};
        for (const q of STW_QUESTS) newBaseline[q.stat] = freshUser[q.stat] ?? 0;
        updateUser(userId, { stwQuestBaseline: newBaseline, stwQuestCompleted: [] });
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle("🎉 All STW Quests Complete!")
          .setDescription("You've completed all quests this cycle!\n\nA **new set of quests** has been issued. Keep playing to progress!")
          .setColor(0xffd700).setTimestamp()] });
        return;
      }
      const questLines = quests.map(q => {
        const bar = `[${"█".repeat(Math.floor((q.progress/q.goal)*10))}${"░".repeat(10-Math.floor((q.progress/q.goal)*10))}] ${q.progress}/${q.goal}`;
        const status = q.done ? "✅" : q.claimable ? "🟢 **CLAIM READY!**" : "🔵";
        return `${status} **${q.name}**\n> ${q.desc}\n> ${bar}\n> 🏆 Reward: **${q.reward.vbucks} V-Bucks** + **${q.reward.stwBoxes} STW Box(es)**`;
      });
      const claimable = quests.filter(q => q.claimable);
      const components = claimable.length > 0
        ? [new ActionRowBuilder().addComponents(
            claimable.slice(0,5).map(q =>
              new ButtonBuilder().setCustomId(`stw_claim_${q.id}`).setLabel(`Claim: ${q.name}`).setStyle(ButtonStyle.Success)
            )
          )]
        : [];
      const embed = new EmbedBuilder()
        .setTitle("📦 Save The World — Quests")
        .setDescription(`**STW Packs:** ${freshUser.stwPacks ?? 0}\n\n${questLines.join("\n\n")}`)
        .setColor(0xff6600)
        .setFooter({ text: "Complete all 5 quests to start a new cycle!" })
        .setTimestamp();
      const msg = await interaction.editReply({ embeds: [embed], components });
      if (claimable.length === 0) return;
      const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: b => b.user.id === userId });
      col.on("collect", async btn => {
        const qid = btn.customId.replace("stw_claim_", "");
        const q = STW_QUESTS.find(x => x.id === qid);
        if (!q) { await btn.reply({ content: "❌ Unknown quest.", ephemeral: true }); return; }
        const cu = getUser(userId);
        const qProgress = getStwQuestProgress(cu);
        const qData = qProgress.find(x => x.id === qid);
        if (!qData || qData.done || !qData.claimable) { await btn.reply({ content: "❌ Quest not claimable.", ephemeral: true }); return; }
        addVbucks(userId, q.reward.vbucks);
        updateUser(userId, {
          stwQuestCompleted: [...(cu.stwQuestCompleted ?? []), qid],
          stwPacks: Math.max(0, (cu.stwPacks ?? 0) - 1),
          boxes: (cu.boxes ?? 0) + q.reward.stwBoxes,
        });
        await btn.update({ embeds: [new EmbedBuilder()
          .setTitle("✅ Quest Claimed!")
          .setDescription(`**${q.name}** complete!\n\n🏆 **+${q.reward.vbucks} V-Bucks**\n📦 **+${q.reward.stwBoxes} STW Box(es)**\n\n*Use \`/savetheworld\` to check remaining quests.*`)
          .setColor(0xff6600).setTimestamp()], components: [] });
        col.stop();
      });
    },
  },

  {
    data: new SlashCommandBuilder().setName("founderspack").setDescription("Open a Founders Box to earn exclusive rewards"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      if (!user.hasFoundersPack) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle("🌟 Founders Pack")
          .setDescription("You don't have a **Founders Pack**!\n\nWatch the spawn channel — the Founders Pack occasionally drops. Claim it with `buy`.")
          .setColor(0xffd700).setTimestamp()] });
        return;
      }
      if ((user.foundersBoxes ?? 0) <= 0) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle("📦 Founders Box")
          .setDescription(`You have a Founders Pack but **no Founders Boxes** to open.\n\nWatch the spawn channel — Founders Boxes drop occasionally. Claim them with \`buy\`.\n\n🌟 **Founders Pack:** Owned\n📦 **Founders Boxes:** 0`)
          .setColor(0xffd700).setTimestamp()] });
        return;
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fb_open").setLabel(`📦 Open Founders Box (${user.foundersBoxes} available)`).setStyle(ButtonStyle.Success)
      );
      const msg = await interaction.editReply({ embeds: [new EmbedBuilder()
        .setTitle("📦 Founders Box")
        .setDescription(`🌟 **Founders Pack:** Owned\n📦 **Boxes available:** ${user.foundersBoxes}\n\nOpen a box to receive one of the following:\n\n⚡ **Infinite V-Bucks** *(rare!)*\n🌟 **God Chest**\n🔵 **Mysterious Chest**\n💰 **V-Bucks** (100–1,500)\n\nPress the button to open one!`)
        .setColor(0xffd700).setTimestamp()], components: [row] });
      const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000, filter: b => b.user.id === userId });
      col.on("collect", async btn => {
        const cu = getUser(userId);
        if ((cu.foundersBoxes ?? 0) <= 0) { await btn.update({ content: "❌ No Founders Boxes left!", embeds: [], components: [] }); return; }
        updateUser(userId, { foundersBoxes: cu.foundersBoxes - 1 });
        const roll = Math.random();
        let title, desc, color;
        if (roll < 0.03) {
          updateUser(userId, { infiniteVbucks: true });
          title = "⚡ JACKPOT — Infinite V-Bucks!";
          desc = "You cracked open the box and found **INFINITE V-BUCKS**!\n\n⚡ Your balance is now unlimited. Spend freely!";
          color = 0xffd700;
        } else if (roll < 0.13) {
          updateUser(userId, { godChest: (getUser(userId).godChest ?? 0) + 1 });
          title = "🌟 God Chest!";
          desc = "You found a **God Chest** inside the Founders Box!\n\n🌟 Use it from your profile — it contains extraordinary loot.";
          color = 0xffd700;
        } else if (roll < 0.33) {
          updateUser(userId, { mysteriousChest: (getUser(userId).mysteriousChest ?? 0) + 1 });
          title = "🔵 Mysterious Chest!";
          desc = "A **Mysterious Chest** tumbled out of the Founders Box!\n\n🔵 Open it from your profile for a surprise reward.";
          color = 0x4444ff;
        } else {
          const vb = rollFoundersBoxVbucks();
          addVbucks(userId, vb);
          title = "💰 V-Bucks!";
          desc = `You cracked open the box and found **${vb.toLocaleString()} V-Bucks**!\n\n💳 Added to your balance.`;
          color = 0x00d4ff;
        }
        const remaining = getUser(userId).foundersBoxes ?? 0;
        await btn.update({ embeds: [new EmbedBuilder()
          .setTitle(title)
          .setDescription(`${desc}\n\n📦 **Remaining boxes:** ${remaining}`)
          .setColor(color).setTimestamp()], components: [] });
        col.stop();
      });
      col.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("equip").setDescription("Equip up to 2 skins from your locker — equipped bundle skins give 35% off that bundle (max 70%)"),
    async execute(interaction) {
      await interaction.deferReply();
      const userId = interaction.user.id;
      resetQuestsIfNeeded(userId); addInteraction(userId);
      const user = getUser(userId);
      const allBundles = await getAllBundles();

      const bundleSkinMap = {}; // skinId prefix → bundle name
      for (const bundle of allBundles) {
        for (const s of (bundle.skins ?? [])) {
          bundleSkinMap[s.id] = bundle.name;
        }
      }

      const ownedBundleSkins = [];
      for (const [key, name] of Object.entries(user.inventoryNames ?? {})) {
        const skinId = key.replace(/_\d+$/, "");
        if (bundleSkinMap[skinId]) {
          ownedBundleSkins.push({ key, name, skinId, bundleName: bundleSkinMap[skinId] });
        }
      }

      if (ownedBundleSkins.length === 0) {
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle("🎽 Equip Skin")
          .setDescription("You don't own any skins from a bundle yet!\n\nBuy a bundle from the Item Shop and come back here to equip skins for discounts.")
          .setColor(0x888888).setTimestamp()] });
        return;
      }

      const equipped = user.equippedSkins ?? [];
      const equippedLines = equipped.length > 0
        ? equipped.map((id, i) => `**Slot ${i+1}:** ${user.inventoryNames[id] ?? id}`).join("\n")
        : "None equipped";

      const options = ownedBundleSkins.slice(0, 23).map(s =>
        new StringSelectMenuOptionBuilder()
          .setLabel(s.name.slice(0, 100))
          .setDescription(`Bundle: ${s.bundleName} ${equipped.includes(s.key) ? "— ✅ Equipped" : ""}`.slice(0, 100))
          .setValue(s.key)
      );
      options.push(new StringSelectMenuOptionBuilder().setLabel("❌ Unequip All Skins").setDescription("Remove all equipped skins").setValue("unequip_all"));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("equip_select").setPlaceholder("Choose a skin to equip/unequip...").addOptions(options)
      );

      const embed = new EmbedBuilder()
        .setTitle("🎽 Equip Skin — Bundle Discount")
        .setDescription(`Equip up to **2 skins** from a bundle to earn discounts:\n> 🎽 **1 skin equipped** from bundle → **35% off** that bundle\n> 🎽🎽 **2 skins equipped** from bundle → **70% off** that bundle\n\n**Currently Equipped:**\n${equippedLines}\n\nSelect a skin below to equip or unequip it.`)
        .setColor(0x9b59b6)
        .setTimestamp();

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });
      const col = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000, filter: i => i.user.id === userId });
      col.on("collect", async sel => {
        const val = sel.values[0];
        const cu = getUser(userId);
        let currentEquipped = [...(cu.equippedSkins ?? [])];

        if (val === "unequip_all") {
          updateUser(userId, { equippedSkins: [] });
          await sel.update({ embeds: [new EmbedBuilder().setTitle("🎽 Unequipped All").setDescription("All skins have been unequipped. You no longer have any bundle discounts active.").setColor(0x888888).setTimestamp()], components: [] });
          col.stop(); return;
        }

        if (currentEquipped.includes(val)) {
          currentEquipped = currentEquipped.filter(x => x !== val);
          updateUser(userId, { equippedSkins: currentEquipped });
          const skinName = cu.inventoryNames[val] ?? val;
          await sel.update({ embeds: [new EmbedBuilder().setTitle("🎽 Skin Unequipped").setDescription(`**${skinName}** has been unequipped.\n\n**Equipped skins:** ${currentEquipped.length}/2`).setColor(0x888888).setTimestamp()], components: [] });
        } else if (currentEquipped.length >= 2) {
          await sel.reply({ content: "❌ You already have **2 skins equipped** (the maximum). Unequip one first!", ephemeral: true });
          return;
        } else {
          currentEquipped.push(val);
          updateUser(userId, { equippedSkins: currentEquipped });
          const skinName = cu.inventoryNames[val] ?? val;
          const skinIdClean = val.replace(/_\d+$/, "");
          const bundleName = bundleSkinMap[skinIdClean] ?? "a bundle";
          const discount = currentEquipped.filter(id => bundleSkinMap[id.replace(/_\d+$/, "")] === bundleName).length * 35;
          await sel.update({ embeds: [new EmbedBuilder()
            .setTitle("✅ Skin Equipped!")
            .setDescription(`**${skinName}** is now equipped!\n\n🎽 **Equipped:** ${currentEquipped.length}/2\n🏷️ **Bundle discount on ${bundleName}:** ${discount}% off\n\n*Open \`/buy\` to see your discount applied.*`)
            .setColor(0x9b59b6).setTimestamp()], components: [] });
        }
        col.stop();
      });
      col.on("end", (_, r) => { if (r === "time") interaction.editReply({ components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("buyvbucks")
      .setDescription("Purchase V-Bucks using your Epic Games card"),
    async execute(interaction) {
      const userId = interaction.user.id;
      const COOLDOWN_MS = 2 * 60 * 60 * 1000;
      const lastUsed = purchaseCooldowns.get(`vbucks_${userId}`) ?? 0;
      const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
      if (remaining > 0) {
        const h = Math.floor(remaining / 3600000), m = Math.floor((remaining % 3600000) / 60000), s = Math.floor((remaining % 60000) / 1000);
        await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle("⏳ Cooldown Active").setDescription(`You can only purchase V-Bucks once every **2 hours**.

⏱️ **Time remaining:** ${h}h ${m}m ${s}s`).setColor(0xff6600).setTimestamp()], ephemeral: true });
        return;
      }
      const modal = new ModalBuilder().setCustomId("buyvbucks_auth_modal").setTitle("💳 Verify Payment");
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("card_number").setLabel("Epic Games Card Number").setStyle(TextInputStyle.Short).setPlaceholder("XXXX-XXXX-XXXX").setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("employee_id").setLabel("Epic Games Employee ID").setStyle(TextInputStyle.Short).setPlaceholder("Enter your employee ID").setRequired(true))
      );
      await interaction.showModal(modal);
      const submitted = await interaction.awaitModalSubmit({ time: 90000 }).catch(() => null);
      if (!submitted) return;
      const enteredCard = submitted.fields.getTextInputValue("card_number").trim().replace(/\s/g, "");
      const enteredId = submitted.fields.getTextInputValue("employee_id").trim();
      const correctCard = "6767-6767-6767";
      const correctId = "77767774422006769";
      const cardOk = enteredCard === correctCard.replace(/-/g, "") || enteredCard === correctCard;
      const idOk = enteredId === correctId;
      if (!cardOk || !idOk) {
        await submitted.reply({ embeds: [new EmbedBuilder().setTitle("❌ Payment Declined").setDescription(!cardOk ? "That card number is invalid. Use format **XXXX-XXXX-XXXX**." : "That employee ID is not recognized in the Epic Games system.").setColor(0xff0000).setTimestamp()], ephemeral: true });
        return;
      }
      await submitted.deferReply({ ephemeral: true });
      await new Promise((r) => setTimeout(r, 1500));
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("bv_1000").setLabel("1,000 V-Bucks").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("bv_2800").setLabel("2,800 V-Bucks").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("bv_5000").setLabel("5,000 V-Bucks").setStyle(ButtonStyle.Primary),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("bv_13500").setLabel("13,500 V-Bucks").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("bv_22500").setLabel("22,500 V-Bucks").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("bv_55000").setLabel("55,000 V-Bucks").setStyle(ButtonStyle.Danger),
      );
      const shopMsg = await submitted.editReply({
        embeds: [new EmbedBuilder().setTitle("💳 Buy V-Bucks — Epic Games Card").setDescription(`✅ **Card verified!**

🏢 **Employee ID:** \`${correctId}\`
💳 **Card:** \`6767-6767-****\`

Select how many V-Bucks you'd like to purchase:`).setColor(0x00d4ff).setTimestamp()],
        components: [row1, row2],
        fetchReply: true,
      });
      const amountMap = { bv_1000: 1000, bv_2800: 2800, bv_5000: 5000, bv_13500: 13500, bv_22500: 22500, bv_55000: 55000 };
      const pkgCollector = shopMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
      pkgCollector.on("collect", async (btn) => {
        const chosenAmount = amountMap[btn.customId];
        if (!chosenAmount) return;
        pkgCollector.stop();
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bv_yes").setLabel("✅ Yes, buy now").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("bv_no").setLabel("❌ No, cancel").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("bv_gift").setLabel("🎁 Wanna Gift?").setStyle(ButtonStyle.Secondary),
        );
        await btn.update({
          embeds: [new EmbedBuilder().setTitle(`💳 Confirm — ${chosenAmount.toLocaleString()} V-Bucks`).setDescription(`Are you sure you want to purchase **${chosenAmount.toLocaleString()} V-Bucks**?

🏢 **Employee ID:** \`${correctId}\`
💳 **Card:** \`6767-6767-****\``).setColor(0xffaa00).setTimestamp()],
          components: [confirmRow],
        });
        const confirmCollector = shopMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        confirmCollector.on("collect", async (cb) => {
          confirmCollector.stop();
          if (cb.customId === "bv_no") {
            await cb.update({ embeds: [new EmbedBuilder().setTitle("❌ Purchase Cancelled").setDescription("No V-Bucks were charged.").setColor(0x888888).setTimestamp()], components: [] });
            return;
          }
          if (cb.customId === "bv_yes") {
            addVbucks(userId, chosenAmount);
            purchaseCooldowns.set(`vbucks_${userId}`, Date.now());
            const after = getUser(userId);
            await cb.update({ embeds: [new EmbedBuilder().setTitle("✅ Purchase Successful!").setDescription(`**+${chosenAmount.toLocaleString()} V-Bucks** added to your balance!

💰 **New V-Bucks balance:** ${after.infiniteVbucks ? "∞" : after.vbucks.toLocaleString()}

🏢 **Employee ID:** \`${correctId}\`
💳 **Card:** \`6767-6767-****\``).setColor(0x00d4ff).setTimestamp()], components: [] });
            return;
          }
          if (cb.customId === "bv_gift") {
            const giftRow = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("bv_gift_user").setPlaceholder("Select a player to gift V-Bucks to...").setMinValues(1).setMaxValues(1));
            await cb.update({ embeds: [new EmbedBuilder().setTitle(`🎁 Gift ${chosenAmount.toLocaleString()} V-Bucks`).setDescription("Select who you want to send the V-Bucks to!").setColor(0xffd700).setTimestamp()], components: [giftRow] });
            const giftCollector = shopMsg.createMessageComponentCollector({ componentType: ComponentType.UserSelect, time: 60000, filter: (b) => b.user.id === userId });
            giftCollector.on("collect", async (sel) => {
              giftCollector.stop();
              const targetId = sel.values[0];
              if (targetId === userId) { await sel.update({ content: "❌ You can't gift V-Bucks to yourself!", embeds: [], components: [] }); return; }
              addVbucks(targetId, chosenAmount);
              purchaseCooldowns.set(`vbucks_${userId}`, Date.now());
              await sel.update({ embeds: [new EmbedBuilder().setTitle("🎁 V-Bucks Gifted!").setDescription(`You gifted **${chosenAmount.toLocaleString()} V-Bucks** to <@${targetId}>!

🏢 **Employee ID:** \`${correctId}\`
💳 **Card:** \`6767-6767-****\``).setColor(0xffd700).setTimestamp()], components: [] });
            });
            giftCollector.on("end", (_, r) => { if (r === "time") shopMsg.edit({ components: [] }).catch(() => {}); });
          }
        });
        confirmCollector.on("end", (_, r) => { if (r === "time") shopMsg.edit({ components: [] }).catch(() => {}); });
      });
      pkgCollector.on("end", (_, r) => { if (r === "time") submitted.editReply({ components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName("topup")
      .setDescription("Top up your Epic Games card using your employee ID"),
    async execute(interaction) {
      const userId = interaction.user.id;
      const user = getUser(userId);

      if (!user.cardLinked) {
        await interaction.reply({ ephemeral: true,
          embeds: [new EmbedBuilder()
            .setTitle("❌ No Card Linked")
            .setDescription("You haven't linked an Epic Games card yet.\n\nUse `/buyvbucks` first to link your card.")
            .setColor(0xff0000).setTimestamp()],
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("topup_id_modal")
        .setTitle("🏢 Epic Games Employee Top-Up");
      const idInput = new TextInputBuilder()
        .setCustomId("employee_id")
        .setLabel("Enter your Epic Games employee ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter your employee ID number")
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(idInput));
      await interaction.showModal(modal);

      const submitted = await interaction.awaitModalSubmit({ time: 90000 }).catch(() => null);
      if (!submitted) return;

      const enteredId = submitted.fields.getTextInputValue("employee_id").trim();
      if (enteredId !== "77767774422006769") {
        await submitted.reply({ ephemeral: true,
          embeds: [new EmbedBuilder()
            .setTitle("❌ Invalid Employee ID")
            .setDescription("That employee ID is not recognized in the Epic Games system.\n\nDouble-check your ID and try `/topup` again.")
            .setColor(0xff0000).setTimestamp()],
          ephemeral: true,
        });
        return;
      }

      await submitted.deferReply({ ephemeral: true });
      await new Promise((r) => setTimeout(r, 1500));

      const currentBal = getUser(userId).cardBalance ?? 0;
      const maxAdd = 1000000 - currentBal;

      if (maxAdd <= 0) {
        await submitted.editReply({
          embeds: [new EmbedBuilder()
            .setTitle("💳 Card Already Full")
            .setDescription("Your card is already at the maximum balance of **1,000,000 V-Bucks**.\n\nSpend some V-Bucks first, then top up again.")
            .setColor(0xff6600).setTimestamp()],
        });
        return;
      }

      const tuRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tu_1000").setLabel("1,000 V-Bucks").setStyle(ButtonStyle.Primary).setDisabled(1000 > maxAdd),
        new ButtonBuilder().setCustomId("tu_2800").setLabel("2,800 V-Bucks").setStyle(ButtonStyle.Primary).setDisabled(2800 > maxAdd),
        new ButtonBuilder().setCustomId("tu_5000").setLabel("5,000 V-Bucks").setStyle(ButtonStyle.Primary).setDisabled(5000 > maxAdd),
      );
      const tuRow2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tu_13500").setLabel("13,500 V-Bucks").setStyle(ButtonStyle.Success).setDisabled(13500 > maxAdd),
        new ButtonBuilder().setCustomId("tu_22500").setLabel("22,500 V-Bucks").setStyle(ButtonStyle.Success).setDisabled(22500 > maxAdd),
        new ButtonBuilder().setCustomId("tu_55000").setLabel("55,000 V-Bucks").setStyle(ButtonStyle.Danger).setDisabled(55000 > maxAdd),
      );

      const topMsg = await submitted.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("🏢 Epic Games Employee Top-Up")
          .setDescription(`✅ **Employee ID verified!**\n\nHow much would you like to top up?\n\n💳 **Current card balance:** ${currentBal.toLocaleString()} V-Bucks\n📈 **Max you can add:** ${maxAdd.toLocaleString()} V-Bucks`)
          .setColor(0x00d4ff).setTimestamp()],
        components: [tuRow1, tuRow2],
        fetchReply: true,
      });

      const tuAmountMap = { tu_1000: 1000, tu_2800: 2800, tu_5000: 5000, tu_13500: 13500, tu_22500: 22500, tu_55000: 55000 };
      const tuCollector = topMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });

      tuCollector.on("collect", async (btn) => {
        const addAmount = tuAmountMap[btn.customId];
        if (!addAmount) return;
        tuCollector.stop();

        const curBal = getUser(userId).cardBalance ?? 0;
        if (addAmount > (1000000 - curBal)) {
          await btn.update({ embeds: [new EmbedBuilder().setTitle("❌ Exceeds card limit").setDescription(`Adding **${addAmount.toLocaleString()} V-Bucks** would exceed the 1,000,000 maximum.`).setColor(0xff0000).setTimestamp()], components: [] });
          return;
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("tu_yes").setLabel("✅ Yes, top up").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("tu_no").setLabel("❌ No, cancel").setStyle(ButtonStyle.Danger),
        );

        await btn.update({
          embeds: [new EmbedBuilder()
            .setTitle(`💳 Confirm Top-Up — ${addAmount.toLocaleString()} V-Bucks`)
            .setDescription(`Are you sure you want to add **${addAmount.toLocaleString()} V-Bucks** to your card?\n\n💳 **Current balance:** ${curBal.toLocaleString()} V-Bucks\n📈 **After top-up:** ${(curBal + addAmount).toLocaleString()} V-Bucks\n🔒 **Maximum:** 1,000,000 V-Bucks`)
            .setColor(0xffaa00).setTimestamp()],
          components: [confirmRow],
        });

        const finalCollector = topMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000, filter: (b) => b.user.id === userId });
        finalCollector.on("collect", async (fb) => {
          finalCollector.stop();
          if (fb.customId === "tu_no") {
            await fb.update({ embeds: [new EmbedBuilder().setTitle("❌ Top-Up Cancelled").setColor(0x888888).setTimestamp()], components: [] });
            return;
          }
          const u = getUser(userId);
          const newBal = Math.min((u.cardBalance ?? 0) + addAmount, 1000000);
          updateUser(userId, { cardBalance: newBal });
          await fb.update({
            embeds: [new EmbedBuilder()
              .setTitle("✅ Card Topped Up!")
              .setDescription(`**+${addAmount.toLocaleString()} V-Bucks** added to your Epic Games card!\n\n💳 **New card balance:** ${newBal.toLocaleString()} V-Bucks\n\nUse \`/buyvbucks\` to spend them!`)
              .setColor(0x00d4ff).setTimestamp()],
            components: [],
          });
        });
        finalCollector.on("end", (_, r) => { if (r === "time") topMsg.edit({ components: [] }).catch(() => {}); });
      });
      tuCollector.on("end", (_, r) => { if (r === "time") submitted.editReply({ components: [] }).catch(() => {}); });
    },
  },

  {
    data: new SlashCommandBuilder().setName("crew").setDescription("Learn about the Fortnite Crew Pack"),
    async execute(interaction) {
      await interaction.deferReply();
      resetQuestsIfNeeded(interaction.user.id); addInteraction(interaction.user.id);
      const channelId = getSpawnChannel(interaction.guildId ?? "");
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setTitle("👑 Fortnite Crew")
        .setDescription("**You cannot purchase Crew with real money on a Discord bot.**\n\n> Discord bots don't support payment processors or real currency.\n\n**How to get Crew:**\n\nKeep an eye on the spawn channel — a **\uD83D\uDC51 Crew Pack** will occasionally spawn!\n\nWhen it appears, click **Redeem Crew Code** to claim:\n\n\uD83D\uDCB0 **1,000 V-Bucks**\n\uD83C\uDFB5 **Music Pass** *(24 hours)*\n\uD83C\uDFAE **Exclusive Crew Series skin**\n\n" + (channelId ? "\uD83D\uDC40 Watch <#" + channelId + "> for the next spawn!" : "\u2699\uFE0F Ask an admin to set up a spawn channel with `/setup`."))
        .setColor(0x4169e1)
        .setFooter({ text: "👑 Crew is earned, not bought — watch for spawns!" })
        .setTimestamp()] });
    },
  },
];
const commandMap = new Map(commands.map((c) => [c.data.name, c]));

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error("[cmd error]", err);
      const msg = { content: "❌ Something went wrong.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
    return;
  }
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try { await command.autocomplete(interaction); } catch (err) { console.error("[autocomplete error]", err); }
    return;
  }
});


async function registerCommands(token, clientId) {
  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const validCommands = commands.filter((c) => c && c.data && typeof c.data.toJSON === "function");
const body = validCommands.map((c) => c.data.toJSON());
    const guildIdsRaw = process.env.GUILD_IDS;
    if (guildIdsRaw) {
      const guildIds = guildIdsRaw.split(",").map(id => id.trim()).filter(Boolean);
      for (const guildId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
        console.log(`✅ Registered ${body.length} commands for guild ${guildId}`);
      }
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log(`✅ Registered ${body.length} global commands`);
    }
  } catch (err) {
    console.error("❌ Registration failed:", err);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID || client.user.id;
  await registerCommands(token, clientId);
  try { await fetchFortniteSkins(); console.log("✅ Fortnite skins loaded"); } catch (err) { console.warn("⚠️ Could not pre-load skins:", err.message); }
  initSpawner(client);
  console.log("✅ Bot ready — SQLite database active");
});

const _loginToken = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
if (!_loginToken) {
  console.error("FATAL: DISCORD_TOKEN is not set. Set it in Railway environment variables.");
  process.exit(1);
}
client.login(_loginToken);

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith("openchest_")) return;

  const chestId = interaction.customId.split("_")[1];

  const chest = treasureChests.get(chestId);

  if (!chest) {
    return interaction.reply({
      content: "❌ Chest expired.",
      ephemeral: true
    });
  }

  if (Date.now() < chest.unlockTime) {
    const remaining = Math.ceil((chest.unlockTime - Date.now()) / 1000);

    return interaction.reply({
      content: `⏳ Unlocks in ${remaining}s`,
      ephemeral: true
    });
  }

  if (chest.claimed.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already opened this chest.",
      ephemeral: true
    });
  }

  if (chest.claimed.length >= chest.maxPeople) {
    return interaction.reply({
      content: "❌ This chest is fully claimed.",
      ephemeral: true
    });
  }

  chest.claimed.push(interaction.user.id);

  if (Math.random() <= 0.02) {
    return interaction.reply({
      content: "📦 The chest was empty...",
      ephemeral: true
    });
  }

  let reward = Math.floor(
    chest.remaining / (chest.maxPeople - chest.claimed.length + 1)
  );

  if (Math.random() <= 0.005) {
    reward = chest.remaining;
  }

  chest.remaining -= reward;

  addCoins(interaction.user.id, reward);

  return interaction.reply({
    content: `🪙 You got ${reward.toLocaleString()} coins!`,
    ephemeral: true
  });
});




const LIVE_GIFTS = {
  tiktokstars: { name: "TikTok Stars", coins: 39999, emoji: "⭐" },
  universe: { name: "TikTok Universe", coins: 44999, emoji: "🌌" },
  lion: { name: "Lion", coins: 29999, emoji: "🦁" },
  pegasus: { name: "Pegasus", coins: 42999, emoji: "🪽" },
  firephoenix: { name: "Fire Phoenix", coins: 41999, emoji: "🔥" },
  thunderfalcon: { name: "Thunder Falcon", coins: 39999, emoji: "🦅" },
  flyingjets: { name: "Flying Jets", coins: 5000, emoji: "✈️" },
  leonkitten: { name: "Leon The Kitten", coins: 4888, emoji: "🐱" },
  galaxy: { name: "Galaxy", coins: 1000, emoji: "🌠" },
  motorcycle: { name: "Motorcycle", coins: 2988, emoji: "🏍️" },
  train: { name: "Train", coins: 899, emoji: "🚂" },
  partyonon: { name: "Party On&On", coins: 15000, emoji: "🎉" },
  privatejet: { name: "Private Jet", coins: 4888, emoji: "🛩️" }
};




client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  if (!interaction.customId.startsWith("openchest_")) return;

  const chestId = interaction.customId.replace("openchest_", "");

  const chest = treasureChests.get(chestId);

  if (!chest) {
    return interaction.reply({
      content: "❌ This chest expired.",
      ephemeral: true
    });
  }

  if (Date.now() < chest.unlockTime) {
    const remaining = Math.ceil(
      (chest.unlockTime - Date.now()) / 1000
    );

    return interaction.reply({
      content: `⏳ Unlocks in ${remaining}s`,
      ephemeral: true
    });
  }

  if (chest.claimed.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You already opened this chest.",
      ephemeral: true
    });
  }

  if (chest.claimed.length >= chest.maxPeople) {
    return interaction.reply({
      content: "❌ The chest is empty.",
      ephemeral: true
    });
  }

  chest.claimed.push(interaction.user.id);

  if (Math.random() <= 0.02) {
    return interaction.reply({
      content: "📦 The chest was empty...",
      ephemeral: true
    });
  }

  let reward = Math.floor(
    chest.remaining /
    (chest.maxPeople - chest.claimed.length + 1)
  );

  if (Math.random() <= 0.005) {
    reward = chest.remaining;
  }

  chest.remaining -= reward;

  addCoins(interaction.user.id, reward);

  return interaction.reply({
    content: `🪙 You got ${reward.toLocaleString()} coins!`,
    ephemeral: true
  });
});


commands.push({
  data: new SlashCommandBuilder()
    .setName("treasurechest")
    .setDescription("Create a treasure chest")
    .addIntegerOption(option =>
      option
        .setName("coins")
        .setDescription("Total coins")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("people")
        .setDescription("How many can open")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("seconds")
        .setDescription("Unlock time")
        .setRequired(true)
    ),

  async execute(interaction) {

    const coins = interaction.options.getInteger("coins");
    const people = interaction.options.getInteger("people");
    const seconds = interaction.options.getInteger("seconds");

    const chestId = `${Date.now()}_${interaction.user.id}`;

    treasureChests.set(chestId, {
      remaining: coins,
      maxPeople: people,
      claimed: [],
      unlockTime: Date.now() + (seconds * 1000)
    });

    const embed = new EmbedBuilder()
      .setTitle("🪙 Treasure Chest")
      .setDescription(
        `Coins: **${coins.toLocaleString()}**\n` +
        `Openers: **0/${people}**\n` +
        `Unlocks: <t:${Math.floor((Date.now() + seconds * 1000)/1000)}:R>`
      )
      .setThumbnail(
        "https://cdn.discordapp.com/attachments/1247303459359690805/1505279164289388544/Fx_CoinChest.webp"
      )
      .setColor(0xffd700);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`openchest_${chestId}`)
        .setLabel("🪙 Open Chest")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
  }
});
